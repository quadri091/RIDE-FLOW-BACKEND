const usermodel = require("../model/form-model.js");
const bannedModel = require("../model/banned.js");
const staffModel = require("../model/staff-model.js");
const suspendedModel = require("../model/suspended.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { uploadImage } = require("../utils/uploader.js");
const generateOTP = require("otp-generator");
const { getSocketsByUserId } = require("../socket.js");
const { changeEmail } = require("../utils/send-to-email.js");
// otp
const generate = async () => {
  const code = generateOTP.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  return code;
};

//
// PASSWORD

const getResetCode = async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.googleSub) {
      return res
        .status(400)
        .json({ message: "Please Sign In with google instead" });
    }
    const code = await generate();
    const updatedUser = await usermodel.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          otp: code,
          passwordIsForogtten: true,
          otpExpiry: Date.now() + 10 * 60 * 1000,
        },
      },
      {returnDocument: "after"},
    );

    const send = await sendForgotPasswordEmail(user.email, code, user.userName);
    if (!send) {
      return res.status(400).json({ message: "Failed to send OTP email" });
    }

    return res.status(200).json({
      message: "OTP sent to your email for password reset",
      data: updatedUser.email,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const confirmPasswordOTP = async (req, res) => {
  const { email } = req.params;
  const { otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otpExpiry < Date.now()) {
      user.otp = null;
      user.otpExpiry = null;
      await user.save();

      return res.status(400).json({ message: "OTP has expired" });
    }
    if (String(user.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    res.status(200).json({ message: "OTP Verification Successful" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.params;

  const { newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email and Password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const update = await usermodel.findOneAndUpdate(
      { email },
      { $set: { password: hashedPassword, passwordIsForogtten: false } },
      {returnDocument: "after"},
    );
    if (!update) {
      return res
        .status(400)
        .json({ message: "Unathorized User", status: "failed" });
    }
    const io = req.app.get("io");
    const sockets = getSocketsByUserId(update.id.toString());
    io.to(sockets).emit("password-updated", "reload");

    return res
      .status(200)
      .json({ message: "Password Updated Successfully", status: "success" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const changeUserPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Fields are mandatory", status: "failed" });
  }

  try {
    const { email } = req.user;
    const user = await usermodel.findOne({ email });
    if (!user) return res.status(400).json("Unathourized User");
    const checkPassword = await bcrypt.compare(oldPassword, user.password);
    if (!checkPassword) {
      return res
        .status(400)
        .json({ message: "Wrong password given", status: "password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const update = await usermodel.findOneAndUpdate(
      { email },
      { $set: { password: hashedPassword } },
      {returnDocument: "after"},
    );

    if (!update) {
      return res
        .status(400)
        .json({ message: "Error updating password", status: "failed" });
    }

    const io = req.app.get("io");
    const sockets = getSocketsByUserId(update.id.toString());
    io.to(sockets).emit("password-updated", "reload");

    return res.status(200).json({ message: "Password Updated Succesfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const uploadPicture = async (req, res) => {
  const { picture } = req.body;
  if (!picture) {
    return res.status(400).json({ message: "Image Is Required" });
  }

  try {
    const update = await usermodel
      .findOneAndUpdate(
        { email: req.user.email },
        { $set: { profileImage: image != "failed" ? image : "" } },
        {returnDocument: "after"},
      )
      .select("-password");
    if (!update) {
      return res
        .status(400)
        .json({ message: "Unathorized User", status: "failed" });
    }

    const io = req.app.get("io");
    const sockets = getSocketsByUserId(update.id.toString());
    io.to(sockets).emit("picture-updated", update);
    io.to("admins").emit("picture-updated", update);
    return res.status(200).json({ message: "Picture Changed Successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const updateDetails = async (req, res) => {
  const { bio, number, userName, picture } = req.body;
  if (!number || !userName) {
    return res
      .status(401)
      .json({ message: "Name, Email and Number is required" });
  }

  try {
    let object = {
      number,
      userName,
      bio: bio ? bio : "",
    };
    if (picture) {
      const image = await uploadImage(picture);
      object.profileImage = image;
    }

    const update = await usermodel
      .findOneAndUpdate(
        { email: req?.user?.email },
        {
          $set: object,
        },
        {returnDocument: "after"},
      )
      .select("-password");
    if (!update) {
      res.status(404).json({ message: "Update Failed" });
    }
    const io = req.app.get("io");

    io.to("admins").emit("profile-updated", update);
    return res
      .status(200)
      .json({ message: "Update Successful", status: "success" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// change Email;
const changeUserEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email Is Required" });
  }
  try {
    let existingUser = await usermodel.findOne({ email });
    if (!existingUser) {
      existingUser = await staffModel.findOne({ email });
    }
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }
    const find = await usermodel.findOne({ email: req.user.email });
    if (!find) {
      return res.status(400).json({ message: "Unathorized User" });
    }

    const code = await generate();
    const update = await usermodel.findOneAndUpdate(
      { email: req.user.email },
      {
        $set: {
          changeEmail: email,
          emailIsChanging: true,
          otp: code,
          otpExpiry: Date.now() + 10 * 60 * 1000,
        },
      },
      {returnDocument: "after"},
    );
    await changeEmail(email, code, update.userName);
    res.status(200).json({ message: "Enter The Code Sent To Your Mail" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMailChangedCode = async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ message: "Email Is Required" });
  }
  try {
    const find = await usermodel.findOne({
      changeEmail: email,
    });

    if (!find) {
      return res.status(400).json({ message: "Unathorized User" });
    }
    const code = await generate();
    const update = await usermodel.findOneAndUpdate(
      { changeEmail: email },
      {
        $set: {
          emailIsChanging: true,
          otp: code,
          otpExpiry: Date.now() + 10 * 60 * 1000,
        },
      },
      {returnDocument: "after"},
    );
    await changeEmail(email, code, update.userName);
    res.status(200).json({ message: "Enter The Code Sent To Your Mail" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const emailCode = async (req, res) => {
  const { email, otp } = req.body;
  const { userEmail } = req.params;
  if (!userEmail) {
    return res.status(400).json({ message: "User Email Is Required" });
  }
  if (!otp || !email) {
    return res.status(400).json({ message: "Fields Are Required" });
  }
  try {
    const find = await usermodel.findOne({ email: userEmail });
    if (!find) {
      return res.status(404).json({ message: "User not found" });
    }
    if (find.otpExpiry < Date.now()) {
      find.otp = null;
      find.otpExpiry = null;
      await find.save();

      return res.status(400).json({ message: "OTP has expired" });
    }
    if (String(find.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    if (find.changeEmail != email) {
      return res.status(400).json({ message: "Email does not match" });
    }
    //
    find.otp = null;
    find.otpExpiry = null;
    await find.save();
    await usermodel.findOneAndUpdate(
      { email: req.user.email },
      [
        {
          $set: {
            email: find.changeEmail,
            changeEmail: "",
            emailIsChanging: false,
          },
        },
      ],
      {returnDocument: "after"},
    );

    return res
      .status(200)
      .json({ message: "OTP Verification Successful", status: "logout" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// driver
const updateLocation = async (req, res) => {
  const { location } = req.body;
  if (!location) {
    return res
      .status(400)
      .json({ message: "Location Is Required", status: "failed" });
  }

  if (!req?.user?.id?.toString()) {
    return res.status(400).json({ message: "Unathorized User" });
  }

  try {
    const update = await usermodel.findByIdAndUpdate(
      req.user.id,
      { $set: { location } },
      {returnDocument: "after"},
    );

    if (!update) {
      return res.status(400).json({ message: "Update failed" });
    }

    const io = req.app.get("io");
    io.emit("driver-updated", update);
    return res.status(200).json({ message: "Location Update Successful" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// driver toggle active/inactive
const activeSwitch = async (req, res) => {
  const { location } = req.body;
  if (!location || !location.coordinates || location.coordinates.length !== 2) {
    return res.status(400).json({ message: "Invalid request data" });
  }

  try {
    const update = await usermodel.findByIdAndUpdate(
      req.user.id,
      { $set: { location, isActive: !req.user.isActive } },
      {returnDocument: "after"},
    );

    if (!update) {
      return res.status(400).json({ message: "Update failed" });
    }

    const io = req.app.get("io");
    io.emit("active-driver", update);
    return res.status(200).json({
      message: `Driver is now ${update.isActive ? "active" : "inactive"}`,
      isActive: update.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// rider get nearby drivers
const getNearbyDrivers = async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) {
    return res.status(400).json({ message: "Invalid request data" });
  }
  try {
    const drivers = await usermodel
      .find({
        role: "driver",
        isActive: true,
        location: {
          $nearSphere: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: 5000,
          },
        },
      })
      .select("-password");

    return res.status(200).json({
      message: "Nearby drivers fetched successfully",
      data: drivers,
    });
  } catch (error) {
    console.log(error.message);

    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get all active drivers
const getAllActiveDrivers = async (req, res) => {
  try {
    const drivers = await usermodel
      .find({ role: "driver", isActive: true })
      .select("-password");
    return res.status(200).json({
      message: "Active drivers fetched successfully",
      data: drivers,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateTimeOuts = async (req, res) => {
  const { assign, accept } = req.body;
  console.log(assign);
  console.log(accept);

  if (!assign || !accept) {
    return res.status(400).json({ message: "Fields are empty" });
  }
  try {
    const find = await usermodel.findByIdAndUpdate(req.user.id, {
      assignTimeOut: +assign,
      acceptTimeOut: +accept,
    });
    if (!find) {
      return res.status(400).json({ message: "Unathorized User" });
    }
    return res.status(200).json({ message: "Update Successful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  getResetCode,
  updateLocation,
  emailCode,
  changeUserEmail,
  updateDetails,
  confirmPasswordOTP,
  resetPassword,
  changeUserPassword,
  uploadPicture,
  activeSwitch,
  getNearbyDrivers,
  getAllActiveDrivers,
  updateTimeOuts,
  getMailChangedCode,
};

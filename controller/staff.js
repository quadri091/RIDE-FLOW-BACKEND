const staffModel = require("../model/staff-model.js");
const usermodel = require("../model/form-model.js");
const bcrypt = require("bcryptjs");
const cloudinary = require("../utils/claudinary.js");
const generateOTP = require("otp-generator");
const jwt = require("jsonwebtoken");
const { sendAdminEmail } = require("../utils/send-to-email.js");

const broadCastStaff = async (io, room, payload) => {
  io.to("super").emit(room, payload);
};
const generate = async () => {
  const code = generateOTP.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  return code;
};

const createAdmin = async (req, res) => {
  const { email, number, password, userName, role, adminCode } = req.body;

  const isInvalidString = (val) => typeof val !== "string" || !val.trim();

  if (
    isInvalidString(email) ||
    isInvalidString(number) ||
    isInvalidString(password) ||
    isInvalidString(userName) ||
    isInvalidString(role) ||
    isInvalidString(adminCode)
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (adminCode !== process.env.adminCode) {
    return res.status(403).json({ message: "Invalid admin code" });
  }

  try {
    let existingUser = await usermodel.findOne({
      email,
    });
    if (existingUser) {
      return res.status(400).json({ message: "A user already exists" });
    }

    existingAdmin = await staffModel.findOne({
      email,
    });
    if (existingAdmin) {
      return res.status(400).json({ message: "This admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const code = await generate();
    const user = await staffModel.create({
      email,
      password: hashedPassword,
      userName,
      number,
      role,
    });

    //  await sendAdminEmail( /// here send email should be notify
    //     user.email,
    //     code,
    //     user.userName,
    //     user.role == "superadmin" ? "Super Admin" : "Admin",
    //   );
    if (!user) {
      return res.status(400).json({ message: "Failed To Create Account" });
    }

    await broadCastStaff(req.app.get("io"), "staff:created", user);

    return res.status(200).json({
      message: "Log In Regularly For Approval From Admin",
      role: user.role,
      status: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const denyUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const user = await staffModel.findByIdAndDelete(id);

    await broadCastStaff(req.app.get("io"), "staff:denied", user);
    return res.status(200).json({ message: "User denied successful " });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const approveUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const user = await staffModel.findByIdAndUpdate(
      id,
      { $set: { isApproved: true } },
      { returnDocument: "after" },
    );

    await broadCastStaff(req.app.get("io"), "staff:approved", user);
    return res.status(200).json({ message: "User approved successful " });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const staff = await staffModel.find();
    return res
      .status(200)
      .json({ message: "Staff fetched successfully", data: staff });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// send admin email should suppose to be verified email

const staffLogin = async (req, res) => {
  try {
    const { email, password, adminCode } = req.body;
    if (!email.trim() || !password.trim() || !adminCode) {
      return res.status(400).json({ message: "All Fields Are Required" });
    }
    if (adminCode !== process.env.adminCode) {
      return res.status(403).json({ message: "Invalid admin code" });
    }
    const find = await staffModel.findOne({ email });
    if (!find) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, find.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (!find.isApproved) {
      return res.status(403).json({ message: "Not approved yet" });
    }
    const token = await jwt.sign(
      { email: find.email, id: find.id },
      process.env.jwtSecretKey,
      {
        expiresIn: 60 * 60,
      },
    );
    const verified = await staffModel.findOneAndUpdate(
      { email: find.email },
      { $set: { token } },
      { returnDocument: "after" },
    );

    if (!verified) {
      return res.status(400).json({ message: "Failed to generate token" });
    }

    return res.status(200).json({
      message: "Login Successful",
      status: true,
      data: { role: verified.role, token },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
const verifyStaffToken = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(400).json({ message: "Token is required" });
    const jwtVerify = await jwt.verify(token, process.env.jwtSecretKey);
    if (!jwtVerify) return res.status(400).json({ message: "Invalid Token" });

    const find = await staffModel
      .findOne({ email: jwtVerify.email })
      .select("-password");
    res.status(200).json({ message: "Token is valid", data: find });
  } catch (error) {
    console.log(error);

    return res.status(400).json({ message: "Token verification failed" });
  }
};

module.exports = {
  createAdmin,
  denyUser,
  approveUser,
  getAllStaff,
  staffLogin,
  verifyStaffToken,
};

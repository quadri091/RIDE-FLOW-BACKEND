const usermodel = require("../model/form-model.js");
const bannedModel = require("../model/banned.js");
const suspendedModel = require("../model/suspended.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const formatTimestamp = require("../utils/format.js");
const cloudinary = require("../utils/claudinary.js");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(
  process.env.googleClientId,
  process.env.googleClientSecret,
  "postmessage",
);
const CLIENT_ID = process.env.googleClientId;
const {
  sendEmail,
  sendForgotPasswordEmail,
} = require("../utils/send-to-email.js");
const generateOTP = require("otp-generator");

const generate = async () => {
  const code = generateOTP.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  return code;
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first", status: "code" });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "Please Sign In with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }
    if (user.suspended) {
      const find = await suspendedModel.findOne({ "user.id": user.id });
      const time = formatTimestamp(find.suspendedUntil);
      return res.status(403).json({
        message: `User has been suspended till ${time}`,
      });
    }

    if (user.banned) {
      return res.status(403).json({ message: `User has been banned` });
    }

    const token = await jwt.sign(
      { email: user.email, id: user.id },
      process.env.jwtSecretKey,
      {
        expiresIn: 60 * 60,
      },
    );

    const verified = await usermodel.findOneAndUpdate(
      { email: user.email },
      { $set: { token } },
      { new: true },
    );

    if (!verified) {
      return res.status(400).json({ message: "Failed to generate token" });
    }

    return res.status(200).json({
      message: "Login Successful",
      data: { role: user.role, token },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const signup = async (req, res) => {
  console.log(req.body);

  const { email, password, userName, number } = req.body;
  if (!email || !password || !userName || !number) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const bannedUser = await bannedModel.findOne({ "user.email": email });
    if (bannedUser) {
      return res.status(400).json({ message: "User is banned already" });
    }
    const suspendedUser = await suspendedModel.findOne({ "user.email": email });
    if (suspendedUser) {
      return res.status(400).json({ message: "User is suspended already" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const code = await generate();

    const user = await usermodel.create({
      email,
      password: hashedPassword,
      userName,
      number,
      otp: code,
      otpExpiry: Date.now() + 10 * 60 * 1000,
    });

    const emailResult = await sendEmail(user.email, code, user.userName);
    if (!emailResult.success) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    const io = req.app.get("io");
    io.to("admins").emit("new:signup", user);

    return res.status(200).json({
      message: "OTP sent to your email for verification",
      email: user.email,
      status: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getCode = async (req, res) => {
  const { email, forgot } = req.body;
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
      { $set: { otp: code, otpExpiry: Date.now() + 10 * 60 * 1000 } },
      { new: true },
    );

    const send = forgot
      ? await sendForgotPasswordEmail(user.email, code, user.userName)
      : await sendEmail(user.email, code, user.userName);
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

const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(400).json({ message: "Token is required" });
    const jwtVerify = await jwt.verify(token, process.env.jwtSecretKey);
    if (!jwtVerify)
      return res
        .status(400)
        .json({ status: "invalid", message: "Invalid Token" });

    const find = await usermodel
      .findOne({ email: jwtVerify.email })
      .select("-password");
    res.status(200).json({ message: "Token is valid", data: find });
  } catch (error) {
    console.log(error);

    return res.status(400).json({ message: "Token verification failed" });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ status: "not-found", message: "User not found" });
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

    user.verified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    const io = req.app.get("io");
    io.to("admins").emit("new:updated", user);

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};
const driverSignup = async (req, res) => {
  console.log(req.body);
  const {
    userName,
    email,
    password,
    number,
    plateNumber,
    carBrand,
    carModel,
    carYear,
    carImage,
    age,
    drivingLicense,
  } = req.body;
  if (
    !email ||
    !password ||
    !userName ||
    !number ||
    !plateNumber ||
    !carBrand ||
    !carModel ||
    !carYear ||
    !carImage ||
    !age ||
    !drivingLicense
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const bannedUser = await bannedModel.findOne({ "user.email": email });
    if (bannedUser) {
      return res.status(400).json({ message: "User is banned already" });
    }
    const suspendedUser = await suspendedModel.findOne({ "user.email": email });
    if (suspendedUser) {
      return res.status(400).json({ message: "User is suspended already" });
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18) {
      return res
        .status(400)
        .json({ message: "Driver must be at least 18 years old" });
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await usermodel.create({
      email,
      password: hashedPassword,
      userName,
      number,
      plateNumber,
      carBrand,
      age: ageNum,
      drivingLicense,
      role: "driver",
      carYear,
      carModel,
      carImage,
    });

    const code = await generate();
    const updatedUser = await usermodel.findOneAndUpdate(
      { email: user.email },
      { $set: { otp: code, otpExpiry: Date.now() + 10 * 60 * 1000 } },
      { new: true },
    );

    const send = await sendEmail(user.email, code, user.userName);
    if (!send) {
      return res.status(400).json({ message: "Failed to send OTP email" });
    }
    const io = req.app.get("io");
    io.to("admins").emit("new:signup", updatedUser);

    return res.status(200).json({
      message: "OTP sent to your email for verification",
      status: true,
      email: user.email,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const uploadCarImage = async (req, res) => {
  const { plate, license } = req.body;
  if (!plate || !license) {
    return res
      .status(400)
      .json({ message: "Plate and license images are required" });
  }
  try {
    const plateRequest = await cloudinary.uploader.upload(plate);
    const licenseRequest = await cloudinary.uploader.upload(license);
    return res.status(200).json({
      message: "Images uploaded successfully",
      data: {
        plate: plateRequest.secure_url,
        license: licenseRequest.secure_url,
      },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const verifyGoogleToken = async (req, res) => {
  const { code } = req.body;
  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: userId, email, name, picture: profileImage } = payload;

    let user = await usermodel.findOne({ email });

    // If user doesn't exist, create them
    // 1. Check if user exists with manual account
    if (user && user.googleSub == null) {
      return res.status(400).json({ message: "Sign in manually" });
    }

    const bannedUser = await bannedModel.findOne({ "user.email": email });
    if (bannedUser) {
      return res.status(400).json({ message: "User is banned already" });
    }
    const suspendedUser = await suspendedModel.findOne({ "user.email": email });
    if (suspendedUser) {
      return res.status(400).json({ message: "User is suspended already" });
    }

    // 2. Create if doesn't exist
    if (!user) {
      try {
        user = await usermodel.create({
          email,
          userName: name,
          profileImage,
          googleSub: userId,
          verified: true,
        });
        const io = req.app.get("io");
        io.to("admins").emit("new:signup", user);
      } catch (error) {
        return res.status(400).json({ message: "Failed to create user" });
      }
    }

    if (user.suspended) {
      const find = await suspendedModel.findOne({ "user.id": user.id });
      const time = formatTimestamp(find.suspendedUntil);
      return res.status(403).json({
        message: `User has been suspended till ${time}`,
      });
    }

    if (user.banned) {
      return res.status(403).json({ message: `User has been banned` });
    }

    // 3. At this point user exists (either found or just created)
    const token = jwt.sign({ email, id: user.id }, process.env.jwtSecretKey, {
      expiresIn: 60 * 60,
    });

    const updatedUser = await usermodel.findOneAndUpdate(
      { email },
      { $set: { token } },
      { new: true },
    );
    const io = req.app.get("io");
    io.to("admins").emit("new:signup", updatedUser);
    return res.status(200).json({
      message: "Login Successful",
      data: { role: user.role, token },
    });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Invalid Google Token" });
  }
};

module.exports = {
  signup,
  login,
  driverSignup,
  getCode,
  verifyOTP,
  uploadCarImage,
  verifyToken,
  verifyGoogleToken,
};

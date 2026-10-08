const usermodel = require("../model/form-model.js");
const staffModel = require("../model/staff-model.js");
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
const { sendEmail } = require("../utils/send-to-email.js");
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
      return res.status(400).json({
        message: "Please verify your email first",
        status: "not-verified",
      });
    }

    if (user.emailIsChanging) {
      return res.status(400).json({
        data: user.changeEmail,
        mailer: user.email,
        message: `Confirm the email ${user.changeEmail} which you changed`,
        status: "email-changed",
      });
    }

    if (user.passwordIsForogtten) {
      return res.status(400).json({
        data: user.email,
        message: `Confirm the otp code for changing your password`,
        status: "password-otp",
      });
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
        expiresIn: 60 * 60 * 2,
      },
    );

    const verified = await usermodel.findOneAndUpdate(
      { email: user.email },
      { $set: { token } },
      { returnDocument: "after" },
    );

    if (!verified) {
      return res.status(400).json({ message: "Failed to generate token" });
    }

    return res.status(200).json({
      message: "Login Successful",
      status: true,
      data: { role: user.role, token },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const signup = async (req, res) => {
  const { email, password, userName, number } = req.body;
  if (!email || !password || !userName || !number) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    let existingUser = await staffModel.findOne({
      email,
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    existingUser = await usermodel.findOne({ email });
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
      role: "rider",
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
    if (error.code === 11000) {
      // Look inside the keyPattern object to find the field name
      const duplicatedField = Object.keys(error.keyPattern)[0];

      if (duplicatedField === "email") {
        return res
          .status(400)
          .json({ message: "This email address is already registered." });
      }

      if (duplicatedField === "number") {
        return res
          .status(400)
          .json({ message: "This phone number is already registered." });
      }
    }
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(400).json({ message: "Token is required" });
    const jwtVerify = await jwt.verify(token, process.env.jwtSecretKey);
    if (!jwtVerify) return res.status(400).json({ message: "Invalid Token" });

    const find = await usermodel
      .findOne({ email: jwtVerify.email })
      .select("-password");
    res.status(200).json({ message: "Token is valid", data: find });
  } catch (error) {
    console.log(error);

    return res.status(400).json({ message: "Token verification failed" });
  }
};

const getCode = async (req, res) => {
  const { email } = req.body;
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
      { returnDocument: "after" },
    );

    const send = await sendEmail(user.email, code, user.userName);
    if (!send.success) {
      console.log(send.text); // "Failed to send mail" — now you'll actually see this
      return res.status(400).json({ message: "Failed to send OTP email" });
    }
    console.log(send);

    return res.status(200).json({
      status: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
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

    user.verified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    const io = req.app.get("io");
    io.to("admins").emit("new:updated", user);

    return res
      .status(200)
      .json({ message: "OTP Verified Successfully", status: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server Error" });
  }
};
const driverSignup = async (req, res) => {
  let imageArray = [];
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
    const code = await generate();
    for (const element of carImage) {
      const req1 = await cloudinary.uploader.upload(element);
      imageArray.push(req1.secure_url);
    }

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
      carImage: imageArray,
      otp: code,
      otpExpiry: Date.now() + 10 * 60 * 1000,
    });

    const send = await sendEmail(user.email, code, user.userName);
    if (!send.success) {
      console.log(send.text); // "Failed to send mail" — now you'll actually see this
      return res.status(400).json({ message: "Failed to send OTP email" });
    }
    const io = req.app.get("io");
    io.to("admins").emit("new:signup", user);

    return res.status(200).json({
      message: "OTP sent to your email for verification",
      status: true,
      email: user.email,
    });
  } catch (error) {
    console.log(error);
    if (error.code === 11000) {
      // Look inside the keyPattern object to find the field name
      const duplicatedField = Object.keys(error.keyPattern)[0];

      if (duplicatedField === "email") {
        return res
          .status(400)
          .json({ message: "This email address is already registered." });
      }

      if (duplicatedField === "number") {
        return res
          .status(400)
          .json({ message: "This phone number is already registered." });
      }
    }
    return res.status(500).json({ message: "Server error" });
  }
};

const uploadCarImage = async (req, res) => {
  console.log("HIT uploadCarImage", req.body);
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
    console.log(error, "Error");
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

    let user = await staffModel.findOne({
      email,
    });
    if (user) {
      return res.status(400).json({ message: "A user already exists" });
    }

    user = await usermodel.findOne({ email });

    // Existing manual account trying to use Google sign-in
    if (user && user.googleSub == null) {
      return res.status(400).json({ message: "Sign in manually" });
    }

    // Single source of truth for ban/suspension — works even if no
    // usermodel document exists yet (e.g. pre-banned email)
    const bannedUser = await bannedModel.findOne({ "user.email": email });
    if (bannedUser) {
      return res.status(403).json({ message: "User has been banned" });
    }

    const suspendedUser = await suspendedModel.findOne({ "user.email": email });
    if (suspendedUser) {
      const time = formatTimestamp(suspendedUser.suspendedUntil);
      return res.status(403).json({
        message: `User has been suspended till ${time}`,
      });
    }

    if (user?.emailIsChanging) {
      return res.status(400).json({
        data: user.changeEmail,
        mailer: user.email,
        message: `Confirm the email ${user.changeEmail} which you changed`,
        status: "email-changed",
      });
    }

    if (user?.passwordIsForogtten) {
      return res.status(400).json({
        data: user.email,
        message: `Confirm the otp code for changing your password`,
        status: "password-otp",
      });
    }

    const io = req.app.get("io");
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      // Explicit, minimal payload — number is intentionally NOT included
      // so Mongoose leaves it fully unset (required for the sparse
      // unique index on `number` to correctly skip this document).
      const newUserData = {
        email,
        userName: name,
        profileImage,
        googleSub: userId,
        verified: true,
      };

      try {
        user = await usermodel.create(newUserData);
      } catch (error) {
        console.log(error);

        // Duplicate key errors (email, number, googleSub, etc.)
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern || {})[0] || "field";
          return res.status(409).json({
            message: `An account with this ${field} already exists`,
            field,
          });
        }

        return res
          .status(400)
          .json({ message: "Failed to create user", error: error.message });
      }
    }

    // Token generated once, after we're guaranteed a real, persisted user
    const token = jwt.sign({ email, id: user._id }, process.env.jwtSecretKey, {
      expiresIn: 60 * 60 * 2,
    });
    user.token = token;
    await user.save();

    if (isNewUser) {
      io.to("admins").emit("new:signup", user);
    }

    return res.status(200).json({
      message: "Login Successful",
      data: { role: user.role, token },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(401)
      .json({ message: "Invalid Google Token", error: error.message });
  }
};

module.exports = {
  signup,
  login,
  driverSignup,
  getCode,
  verifyToken,
  verifyOTP,
  uploadCarImage,
  verifyGoogleToken,
};

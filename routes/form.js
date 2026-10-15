const express = require("express");
const formRouter = express.Router();
const {
  signup,
  login,
  driverSignup,
  verifyOTP,
  uploadCarImage,
  verifyToken,
  verifyGoogleToken,
  getCode,
  sendSupport,
} = require("../controller/form.js");

formRouter.post("/signup", signup);
formRouter.post("/send-verify-email", getCode);
formRouter.post("/verify-otp", verifyOTP);
formRouter.post("/login", login);
formRouter.post("/verify-token", verifyToken);
formRouter.post("/upload", uploadCarImage);
formRouter.post("/driver-signup", driverSignup);
formRouter.post("/auth/google", verifyGoogleToken);
formRouter.post("/send-support", sendSupport);

module.exports = formRouter;

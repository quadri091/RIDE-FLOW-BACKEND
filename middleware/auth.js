const jwt = require("jsonwebtoken");
const usermodel = require("../model/form-model");
const staffmodel = require("../model/staff-model");

const authMiddleWare = async (req, res, next) => {
  try {
    let find;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ text: "auth", message: "Token is required" });
    }
    const token = authHeader.split(" ")[1];
    if (!token)
      return res
        .status(400)
        .json({ text: "auth", message: "Token is required" });
    const jwtVerify = await jwt.verify(token, process.env.jwtSecretKey);
    if (!jwtVerify)
      return res.status(400).json({ text: "auth", message: "Invalid Token" });

    find = await usermodel.findOne({ email: jwtVerify.email });
    if (!find) {
      find = await staffmodel.findOne({ email: jwtVerify.email });
    }
    if (!find)
      return res.status(400).json({ text: "auth", message: "User not found" });
    req.user = find.toObject({ virtuals: true });
    next();
  } catch (error) {
    console.log(error);

    return res
      .status(400)
      .json({
        text: "auth",
        message: `Token verification failed: ${error.message}`,
      });
  }
};

module.exports = authMiddleWare;

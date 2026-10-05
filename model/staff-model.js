const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userName: { type: String, required: true },
  number: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ["admin", "superadmin"],
    default: "admin",
    lowercase: true,
  },
  isApproved: { type: Boolean, default: false },
  bio: { type: String, default: "" },
  token: { type: String },
  otp: { type: Number },
  otpExpiry: { type: Date },
  profileImage: {
    type: String,
    default: function () {
      if (this.role === "admin") {
        return "https://res.cloudinary.com/dwshzqcf2/image/upload/v1787324766/bvgynwuljjwam1xcqmt7.png";
      } else if (this.role === "superadmin") {
        return "https://res.cloudinary.com/dwshzqcf2/image/upload/v1787324607/jzkdunpwv1xr539fwtx4.png";
      }
      return "";
    },
  },
});

const staffModel = mongoose.model("staff", staffSchema);
module.exports = staffModel;

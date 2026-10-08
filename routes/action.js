const {
  getResetCode,
  updateLocation,
  emailCode,
  changeUserEmail,
  updateDetails,
  confirmPasswordOTP,
  resetPassword,
  changeUserPassword,
  getMailChangedCode,
  activeSwitch,
  getNearbyDrivers,
  getAllActiveDrivers,
  updateTimeOuts,
} = require("../controller/action");
const express = require("express");
const actionRouter = express.Router();
const authMiddleWare = require("../middleware/auth.js");
const roleMiddleware = require("../middleware/role.js");

actionRouter.post("/get-reset-code/:email", getResetCode);
actionRouter.post("/verify-reset-password/:email", confirmPasswordOTP);
actionRouter.post("/apply-reset-password/:email", resetPassword);
actionRouter.post("/update-location", authMiddleWare, updateLocation);
actionRouter.post("/change-user-password", authMiddleWare, changeUserPassword);
actionRouter.post("/update-user-details", authMiddleWare, updateDetails);
actionRouter.post("/change-user-email", authMiddleWare, changeUserEmail);
actionRouter.post("/verify-user-email/:userEmail", emailCode);
actionRouter.post("/get-mail-changed-code/:email", getMailChangedCode);
actionRouter.post("/toggle-active", authMiddleWare, activeSwitch);
actionRouter.post("/get-nearby-drivers", authMiddleWare, getNearbyDrivers);
actionRouter.post(
  "/get-all-active-drivers",
  authMiddleWare,
  roleMiddleware("admin", "superadmin"),
  getAllActiveDrivers,
);

actionRouter.post(
  "/update-time-out",
  authMiddleWare,
  roleMiddleware("rider"),
  updateTimeOuts,
);
module.exports = actionRouter;

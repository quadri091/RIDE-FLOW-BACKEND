const express = require("express");
const disputeRouter = express.Router();
const authMiddleWare = require("../middleware/auth.js");
const roleMiddleware = require("../middleware/role.js");
const {
  processAll,
  getAllDisputes,
  getDisputeByCode,
  updateDisputeStatus,
  escalateDispute,
  getMyDispute,
  resolveDispute,
  deleteDispute,
  addEvidence,
} = require("../controller/dispute.js");

// rider or driver
disputeRouter.post("/create-dispute", authMiddleWare, processAll);
disputeRouter.get("/get-my-dispute", authMiddleWare, getMyDispute);

// any admin
disputeRouter.get(
  "/all-disputes",
  authMiddleWare,
  roleMiddleware("admin", "superadmin"),
  getAllDisputes,
);
disputeRouter.get("/get-dispute/:matchCode", authMiddleWare, getDisputeByCode);

// ops manager only
disputeRouter.put(
  "/update-dispute/:matchCode",
  authMiddleWare,
  roleMiddleware("admin", "superadmin"),
  updateDisputeStatus,
);
disputeRouter.put(
  "/escalate-dispute/:matchCode",
  authMiddleWare,
  roleMiddleware("admin"),
  escalateDispute,
);

// super admin only
disputeRouter.put(
  "/resolve-dispute/:matchCode",
  authMiddleWare,
  roleMiddleware("superadmin"),
  resolveDispute,
);

// super admin only
disputeRouter.delete(
  "/delete-dispute/:matchCode",
  authMiddleWare,
  roleMiddleware("superadmin"),
  deleteDispute,
);
disputeRouter.post("/add-evidence/:matchCode", authMiddleWare, addEvidence);

module.exports = disputeRouter;

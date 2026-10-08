const suspendedModel = require("../model/suspended.js");
const bannedModel = require("../model/banned.js");
const usermodel = require("../model/form-model.js");
const { emitToUser } = require("../socket.js");
const broadCastSuspended = async (room, io, request) => {
  io.to("admins").emit(room, request);
};

// ADMIN + SUPER ADMIN — suspend a rider or driver temporarily
const suspendUser = async (req, res) => {
  const { userId, reason, suspendedUntil, relatedDispute } = req.body;

  if (!userId || !reason || !suspendedUntil) {
    return res
      .status(400)
      .json({ message: "User ID, reason, and suspendedUntil are required" });
  }

  if (new Date(suspendedUntil) <= new Date()) {
    return res
      .status(400)
      .json({ message: "Suspended date must be a future date" });
  }

  try {
    const user = await usermodel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["rider", "driver"].includes(user.role)) {
      return res
        .status(400)
        .json({ message: "Only riders or drivers can be suspended" });
    }

    const existingBan = await bannedModel.findOne({ "user.id": userId });
    if (existingBan) {
      return res.status(400).json({ message: "User is already banned" });
    }

    const existingSuspension = await suspendedModel.findOne({
      "user.id": userId,
    });
    if (existingSuspension) {
      return res.status(400).json({ message: "User is already suspended" });
    }

    const suspension = await suspendedModel.create({
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
      reason,
      relatedDispute: relatedDispute || null,
      suspendedBy: {
        id: req.user.id,
        name: req.user.userName,
      },
      suspendedUntil,
    });
    //
    await usermodel.findByIdAndUpdate(
      userId,
      { $set: { suspended: true } },
      { returnDocument: "after" },
    );

    scheduleAutoUnsuspend(userId, suspendedUntil, req.app.get("io"));

    const io = req.app.get("io");
    await broadCastSuspended("suspended:created", io, suspension);
    emitToUser(io, userId, "suspended", {
      message: "You have been suspended",
      data: suspension,
    });

    return res.status(201).json({
      message: "User suspended successfully",
      data: suspension,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ADMIN + SUPER ADMIN — lift a suspension early
const unsuspendUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const suspension = await suspendedModel.findOneAndDelete({
      "user.id": userId,
    });

    if (!suspension) {
      return res
        .status(404)
        .json({ message: "No active suspension found for this user" });
    }

    await usermodel.findByIdAndUpdate(
      userId,
      { $set: { suspended: false } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");

    await broadCastSuspended(
      "suspended:deleted",
      req.app.get("io"),
      suspension,
    );
    emitToUser(io, userId, "unsuspended", {
      message: "Your suspension has been lifted",
      data: suspension,
    });

    return res.status(200).json({
      message: "Suspension lifted successfully",
      data: suspension,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ADMIN + SUPER ADMIN — view all suspended users
const getAllSuspended = async (req, res) => {
  try {
    const suspended = await suspendedModel.find().sort({ suspendedAt: -1 });
    return res.status(200).json({
      message: "Suspended users fetched successfully",
      data: suspended,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// check suspension status for a single user
const getSuspensionByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const suspension = await suspendedModel.findOne({ "user.id": userId });
    if (!suspension) {
      return res.status(404).json({ message: "This user is not suspended" });
    }

    return res.status(200).json({
      message: "Suspension record fetched successfully",
      data: suspension,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

//

// controller/suspended.js

const scheduleAutoUnsuspend = (userId, suspendedUntil, io) => {
  const msLeft = new Date(suspendedUntil).getTime() - Date.now();

  if (msLeft <= 0) {
    return runAutoUnsuspend(userId, io);
  }

  setTimeout(() => {
    runAutoUnsuspend(userId, io);
  }, msLeft);
};

const runAutoUnsuspend = async (userId, io) => {
  try {
    const suspension = await suspendedModel.findOneAndDelete({
      "user.id": userId,
    });

    await usermodel.findByIdAndUpdate(
      userId,
      { $set: { suspended: false } },
      { returnDocument: "after" },
    );

    if (!suspension) {
      console.log(`No active suspension found for user ${userId}`);
    }

    if (io) {
      await broadCastSuspended("suspended:deleted", io, suspension);
      emitToUser(io, userId, "unsuspended", {
        message: "Your suspension has been lifted",
        data: suspension,
      });
    }

    console.log(
      `Auto-unsuspended user ${userId} at ${new Date().toISOString()}`,
    );
  } catch (error) {
    console.error(`Failed to auto-unsuspend user ${userId}:`, error.message);
  }
};

const getAllSuspendedAndStartUnsuspend = async (io) => {
  try {
    const suspensions = await suspendedModel.find().sort({ suspendedAt: -1 });

    if (!suspensions || suspensions.length === 0) {
      return;
    }

    for (const suspension of suspensions) {
      if (suspension.suspendedUntil) {
        scheduleAutoUnsuspend(
          suspension.user.id,
          suspension.suspendedUntil,
          io,
        );
      }
    }
  } catch (error) {
    console.error("Error fetching suspended users:", error.message);
  }
};
// export all functions

module.exports = {
  suspendUser,
  unsuspendUser,
  getAllSuspended,
  getSuspensionByUser,
  getAllSuspendedAndStartUnsuspend,
};

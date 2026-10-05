const bannedModel = require("../model/banned.js");
const suspendedModel = require("../model/suspended.js");
const usermodel = require("../model/form-model.js");
const {
  lifeUpdate,
  getSocketsByUserId,
  getSocketsByRole,
} = require("../socket.js");
const broadCastBanned = async (room, io, request) => {
  if (!io) return;
  io.to("admins").emit(room, request);
};

// SUPER ADMIN ONLY — ban a rider or driver
const banUser = async (req, res) => {
  const { userId, reason, relatedDispute } = req.body;

  if (!userId || !reason) {
    return res.status(400).json({ message: "User ID and reason are required" });
  }

  try {
    const user = await usermodel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingBan = await bannedModel.findOne({ "user.id": userId });
    if (existingBan) {
      return res.status(400).json({ message: "User is already banned" });
    }

    const ban = await bannedModel.create({
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
      reason,
      relatedDispute: relatedDispute || null,
      bannedBy: {
        id: req.user.id,
        name: req.user.userName,
      },
    });
    await usermodel.findByIdAndUpdate(
      userId,
      { $set: { banned: true } },
      { returnDocument: "after" },
    );

    // clear any existing suspension since ban supersedes it
    const io = req.app.get("io");
    await suspendedModel.findOneAndDelete({ "user.id": userId });

    await broadCastBanned("ban:created", io, ban);
    const sockets = getSocketsByUserId(userId);
    io.to(sockets).emit("banned", {
      message: "You have been banned",
      data: ban,
    });

    return res.status(201).json({
      message: "User banned successfully",
      data: ban,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// SUPER ADMIN ONLY — reinstate a banned user
const unbanUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const ban = await bannedModel.findOneAndDelete({ "user.id": userId });
    if (!ban) {
      return res.status(404).json({ message: "No ban found for this user" });
    }
    await usermodel.findByIdAndUpdate(
      userId,
      { $set: { banned: false } },
      { returnDocument: "after" },
    );
    const io = req.app.get("io");
    await broadCastBanned("ban:deleted", io, ban);
    const sockets = getSocketsByUserId(userId);
    io.to(sockets).emit("unbanned", {
      message: "You have been unbanned",
      data: ban,
    });
    return res.status(200).json({
      message: "User unbanned successfully",
      data: ban,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ADMIN + SUPER ADMIN — view all banned users
const getAllBanned = async (req, res) => {
  try {
    const banned = await bannedModel.find().sort({ bannedAt: -1 });
    return res.status(200).json({
      message: "Banned users fetched successfully",
      data: banned,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// check ban status for a single user (used internally / by admin lookup)
const getBanByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const ban = await bannedModel.findOne({ "user.id": userId });
    if (!ban) {
      return res.status(404).json({ message: "This user is not banned" });
    }

    return res.status(200).json({
      message: "Ban record fetched successfully",
      data: ban,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  banUser,
  unbanUser,
  getAllBanned,
  getBanByUser,
};

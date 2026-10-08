const jwt = require("jsonwebtoken");
const usermodel = require("./model/form-model.js");
const staffModel = require("./model/staff-model.js");
const tripModel = require("./model/trip-model.js");
const userSocket = [];

const lifeUpdate = (io) => {
  io.on("connection", async (socket) => {
    const { token } = socket.handshake.query;

    if (!token || typeof token !== "string" || !token.trim()) {
      return socket.disconnect(true);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.jwtSecretKey);
    } catch (err) {
      return socket.disconnect(true);
    }

    let user;
    try {
      user = await usermodel.findOne({ email: decoded.email });
      if (!user) {
        user = await staffModel.findOne({ email: decoded.email });
      }
    } catch (err) {
      return socket.disconnect(true);
    }

    if (!user) {
      return socket.disconnect(true);
    }

    const userId = user.id.toString();

    userSocket.push({
      userId,
      role: user.role.toLowerCase(),
      name: user.userName,
      socketId: socket.id,
    });

    if (["admin", "superadmin"].includes(user.role.toLowerCase())) {
      socket.join("admins");
    }
    if (user.role.toLowerCase() != "driver") {
      socket.join("getDrivers");
    }
    if (user.role.toLowerCase() == "driver") {
      socket.join("drivers");
    }
    if (user.role.toLowerCase() == "superadmin") {
      socket.join("super");
    }

    // trip room
    socket.on("joinTrip", (matchCode) => {
      console.log(`User with id ${userId} joined`);

      socket.join(matchCode);
    });

    socket.on("driverLocation", async ({ lat, lng }) => {
      if (typeof lat !== "number" || typeof lng !== "number") return;

      try {
        const trips = await tripModel
          .find(
            {
              "driver.id": userId,
              status: { $in: ["accepted", "trip started"] },
            },
            "matchCode rider.id",
          )
          .lean();

        if (!trips.length) return;

        // 1. push to riders first so it feels instant
        for (const trip of trips) {
          emitToUser(io, trip.rider.id, "locationUpdate", {
            matchCode: trip.matchCode,
            lat,
            lng,
          });
          io.to("admins").emit("locationUpdate", {
            matchCode: trip.matchCode,
            driverId: userId,
            lat,
            lng,
          });
        }

        // 2. then save it (no await needed for the emit to go out)
        await tripModel.updateMany(
          { _id: { $in: trips.map((t) => t._id) } },
          { $set: { driverLocation: [lat, lng] } },
        );
      } catch (err) {
        console.error("driverLocation error:", err.message);
      }
    });

    // create call part

    socket.on("call", ({ targetUserId, offer }) => {
      const targetSockets = getSocketsByUserId(targetUserId);
      if (targetSockets.length === 0) {
        socket.emit("callFailed", { message: "User is not available" });
        return;
      }

      const caller = userSocket.find((u) => u.socketId === socket.id);

      emitToUser(io, targetUserId, "incomingCall", {
        callerId: userId,
        callerName: caller?.name || "Unknown",
        callerRole: caller?.role || "",
        offer,
      });
    });

    // answer call
    socket.on("answerCall", ({ targetUserId, answer }) => {
      emitToUser(io, targetUserId, "callAnswered", { answer });
    });

    // Step 3 - both sides exchange ICE candidates
    // sender sends: { targetUserId: otherPersonsId, candidate }
    socket.on("iceCandidate", ({ targetUserId, candidate }) => {
      emitToUser(io, targetUserId, "iceCandidate", { candidate });
    });

    // sender sends: { targetUserId: otherPersonsId }
    socket.on("endCall", ({ targetUserId }) => {
      emitToUser(io, targetUserId, "callEnded");
    });
    //

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected`);
      const userIndex = userSocket.findIndex(
        (u) => u.userId === userId && u.socketId === socket.id,
      );
      if (userIndex !== -1) {
        userSocket.splice(userIndex, 1);
      }
    });
  });
};

// get all socket ids belonging to one specific user (handles multi-tab/device)
const getSocketsByUserId = (userId) =>
  userSocket
    .filter((u) => u.userId === userId.toString())
    .map((u) => u.socketId);

// get all socket ids belonging to a set of roles (e.g. ["admin", "super_admin"])
const getSocketsByRole = (roles) =>
  userSocket.filter((u) => roles.includes(u.role)).map((u) => u.socketId);

// emit to every socket of one user; no-op if they're offline
// (io.to([]) would otherwise broadcast to everyone)
const emitToUser = (io, userId, event, payload) => {
  if (!userId) return;
  const ids = getSocketsByUserId(userId);
  if (ids.length) io.to(ids).emit(event, payload);
};

module.exports = {
  lifeUpdate,
  getSocketsByUserId,
  getSocketsByRole,
  emitToUser,
};

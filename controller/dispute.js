const disputeModel = require("../model/dispute-model.js");

const totaltripModel = require("../model/totaltrip-model.js");
const { uploadImage } = require("../utils/uploader.js");
const { emitToUser } = require("../socket.js");
const broadCastDispute = async (room, io, request) => {
  io.to("admins").emit(room, request);
};
// RIDER or DRIVER creates a dispute
// Phase 1: checks only, no uploads, no writes
const validateDispute = async ({ matchCode, reason, description }, user) => {
  if (!matchCode || !reason || !description) {
    return { status: false, message: "All fields are required" };
  }

  const trip = await totaltripModel.findOne({ matchCode });
  if (!trip) return { status: false, message: "Trip not found" };

  if (trip.status !== "trip completed") {
    return { status: false, message: "Can only dispute completed trips" };
  }

  const existing = await disputeModel.findOne({ "trip.matchCode": matchCode });
  if (existing) {
    return { status: false, message: "A dispute already exists for this trip" };
  }

  const isRider = trip.rider.id.toString() === user.id.toString();
  const isDriver = trip.driver.id.toString() === user.id.toString();
  if (!isRider && !isDriver) {
    return { status: false, message: "You are not part of this trip" };
  }

  return { status: true, trip, isRider };
};

// Phase 2: uploads + create (only runs after everything validated)
const createDispute = async (params, checked, io, user) => {
  const { reason, description, imageArr } = params;
  const { trip, isRider } = checked;

  const evidence = [];
  for (const picture of imageArr || []) {
    const image = await uploadImage(picture);
    if (image != "failed") {
      evidence.push({
        imageUrl: image,
        sender: { id: user.id, name: user.userName, role: user.role },
      });
    }
  }

  const me = isRider ? trip.rider : trip.driver;
  const other = isRider ? trip.driver : trip.rider;

  const dispute = await disputeModel.create({
    trip: {
      id: trip.id,
      matchCode: trip.matchCode,
      price: trip.price,
      startLocation: {
        coordinates: trip.startLocation.coordinates,
        address: trip.startLocation.address,
      },
      endLocation: {
        coordinates: trip.endLocation.coordinates,
        address: trip.endLocation.address,
      },
    },
    evidence,
    raisedBy: {
      id: me.id,
      name: me.name,
      number: me.number,
      role: isRider ? "rider" : "driver",
    },
    against: {
      id: other.id,
      name: other.name,
      number: other.number,
      role: isRider ? "driver" : "rider",
    },
    reason,
    description,
  });

  await broadCastDispute("dispute:created", io, dispute);
  emitToUser(io, trip.rider.id, "dispute:created", dispute);
  emitToUser(io, trip.driver.id, "dispute:created", dispute);
};

const processAll = async (req, res) => {
  const { createList } = req.body;

  if (!Array.isArray(createList) || createList.length === 0) {
    return res.status(400).json({ message: "No disputes provided" });
  }

  // same trip twice in one batch
  const codes = createList.map((d) => d.matchCode);
  if (new Set(codes).size !== codes.length) {
    return res
      .status(400)
      .json({ message: "Two disputes are for the same trip" });
  }

  try {
    const io = req.app.get("io");

    // Phase 1: validate ALL first
    const checked = [];
    for (const element of createList) {
      const result = await validateDispute(element, req.user);
      if (!result.status) {
        return res.status(400).json({
          message: `${element.matchCode || "A dispute"}: ${result.message}`,
        });
      }
      checked.push(result);
    }

    // Phase 2: create ALL
    for (let i = 0; i < createList.length; i++) {
      await createDispute(createList[i], checked[i], io, req.user);
    }

    return res.status(201).json({ message: "Dispute(s) created successfully" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getMyDispute = async (req, res) => {
  try {
    const allMyDispute = await disputeModel.find({
      $or: [{ "raisedBy.id": req.user.id }, { "against.id": req.user.id }],
    });

    return res
      .status(200)
      .json({ message: "Dispute Fetched", data: allMyDispute });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
const addUrComment = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message || !id) {
    return res.status(400).json({ message: "Message and Id are required" });
  }
  try {
    const dispute = await disputeModel.findById(id);
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }
    const newComment = {
      sender: {
        id: req.user.id,
        name: req.user.userName,
        role: req.user.role,
        profileImage: req.user.profileImage || "",
      },
      message,
    };
    dispute.comments.push(newComment);
    await dispute.save();
    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:comment", dispute);
    emitToUser(io, dispute.against.id, "dispute:comment", dispute);
    await broadCastDispute("dispute:comment", io, dispute);

    return res
      .status(200)
      .json({ message: "Comment added successfully", data: dispute });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ADMIN — get all disputes
const getAllDisputes = async (req, res) => {
  try {
    const disputes = await disputeModel.find().sort({ createdAt: -1 });
    return res.status(200).json({
      message: "Disputes fetched successfully",
      data: disputes,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get single dispute by matchCode
const getDisputeByCode = async (req, res) => {
  const { matchCode } = req.params;

  try {
    const dispute = await disputeModel.findOne({ "trip.matchCode": matchCode });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    return res.status(200).json({
      message: "Dispute fetched successfully",
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// OPS MANAGER — update status (Open → Under Review → Escalated)
const updateDisputeStatus = async (req, res) => {
  const { matchCode } = req.params;
  const { status, note } = req.body;

  if (!status || !note) {
    return res.status(400).json({ message: "Status and note are required" });
  }

  // admin cannot set Resolved — only super_admin can
  if (
    req.user.role == "admin" &&
    status.toString().toLowerCase() === "resolved"
  ) {
    return res
      .status(403)
      .json({ message: "Only Super Admin can resolve disputes" });
  }

  try {
    const dispute = await disputeModel.findOne({ "trip.matchCode": matchCode });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    dispute.status = status;
    dispute.resolution.note = note;
    dispute.resolution.resolvedBy = req.user.id;
    dispute.resolution.resolvedAt = new Date();

    await dispute.save();
    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:updated", dispute);
    emitToUser(io, dispute.against.id, "dispute:updated", dispute);
    await broadCastDispute("dispute:updated", req.app.get("io"), dispute);

    return res.status(200).json({
      message: "Dispute updated successfully",
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const addEvidence = async (req, res) => {
  const { imageArr } = req.body;
  const { matchCode } = req.params;
  if (!Array.isArray(imageArr) || imageArr.length === 0 || !matchCode?.trim()) {
    return res
      .status(400)
      .json({ message: "Image array and Match Code are required" });
  }

  try {
    const user = req.user;
    const dispute = await disputeModel.findOne({ "trip.matchCode": matchCode });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    // upload all images in parallel
    const urls = await Promise.all(imageArr.map((img) => uploadImage(img)));

    const sender = {
      id: user.id,
      name: user.userName,
      role: user.role,
    };

    dispute.evidence.push(...urls.map((imageUrl) => ({ imageUrl, sender })));
    await dispute.save();

    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:updated", dispute);
    emitToUser(io, dispute.against.id, "dispute:updated", dispute);
    await broadCastDispute("dispute:updated", io, dispute);

    return res.status(200).json({
      message: "Evidence added successfully",
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// OPS MANAGER — escalate to super admin
const escalateDispute = async (req, res) => {
  const { matchCode } = req.params;
  const { note } = req.body;

  try {
    const dispute = await disputeModel.findOne({ "trip.matchCode": matchCode });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    if (
      dispute.status.toLowerCase() === "resolved" ||
      dispute.status.toLowerCase() === "rejected"
    ) {
      return res
        .status(400)
        .json({ message: "Cannot escalate a closed dispute" });
    }

    dispute.status = "Escalated";
    dispute.resolution.note = note || "Escalated to Super Admin for review";
    dispute.resolution.resolvedBy = req.user.id;
    dispute.resolution.resolvedAt = new Date();

    await dispute.save();

    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:escalated", dispute);
    emitToUser(io, dispute.against.id, "dispute:escalated", dispute);
    await broadCastDispute("dispute:escalated", req.app.get("io"), dispute);

    return res.status(200).json({
      message: "Dispute escalated to Super Admin",
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// SUPER ADMIN — final resolution
const resolveDispute = async (req, res) => {
  const { matchCode } = req.params;
  const { status, note } = req.body;

  if (!status || !note) {
    return res.status(400).json({ message: "Status and note are required" });
  }

  if (!["resolved", "rejected"].includes(status.toLowerCase())) {
    return res
      .status(400)
      .json({ message: "Super Admin can only Resolve or Reject" });
  }

  try {
    const dispute = await disputeModel.findOne({ "trip.matchCode": matchCode });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    dispute.status = status;
    dispute.resolution.note = note;
    dispute.resolution.resolvedBy = req.user.id;
    dispute.resolution.resolvedAt = new Date();

    await dispute.save();
    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:resolved", dispute);
    emitToUser(io, dispute.against.id, "dispute:resolved", dispute);
    await broadCastDispute("dispute:resolved", req.app.get("io"), dispute);

    return res.status(200).json({
      message: `Dispute ${status.toLowerCase()} successfully`,
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ADMIN — delete dispute
const deleteDispute = async (req, res) => {
  const { matchCode } = req.params;

  try {
    const dispute = await disputeModel.findOneAndDelete({
      "trip.matchCode": matchCode,
    });
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }
    const io = req.app.get("io");
    emitToUser(io, dispute.raisedBy.id, "dispute:deleted", dispute);
    emitToUser(io, dispute.against.id, "dispute:deleted", dispute);
    await broadCastDispute("dispute:deleted", req.app.get("io"), dispute);
    return res.status(200).json({
      message: "Dispute deleted successfully",
      data: dispute,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  processAll,
  getAllDisputes,
  getDisputeByCode,
  getMyDispute,
  updateDisputeStatus,
  addUrComment,
  escalateDispute,
  resolveDispute,
  deleteDispute,
  addEvidence,
};

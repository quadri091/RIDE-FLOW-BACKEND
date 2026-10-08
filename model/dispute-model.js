const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema({
  // which trip this dispute is about
  trip: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "trip", required: true },
    matchCode: { type: String, required: true },
    price: { type: String },
    startLocation: {
      coordinates: { type: [Number] },
      address: { type: String },
    },
    endLocation: {
      coordinates: { type: [Number] },
      address: { type: String },
    },
  },

  // who raised the dispute
  raisedBy: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["rider", "driver"], required: true },
  },

  // the other party involved
  against: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["rider", "driver"], required: true },
  },
  comments: [
    {
      sender: {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        role: { type: String, enum: ["rider", "driver", "admin", "superadmin"], required: true },
        profileImage: { type: String, default: "" },
      },
      message: { type: String, required: true },
      sentAt: { type: Date, default: Date.now },
    }
  ],
  evidence: [
    {
      imageUrl: {
        type: String,
        required: true,
      },
      sender: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          required: true,
        },
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ], // The square brackets here tell Mongoose this is an array of these objects

  // what the dispute is about
  reason: {
    type: String,
    required: true,
    enum: [
      "Fair payment",
      "Incorrect Route Taken",
      "Vehicle Mismatch",
      "Rider No-Show",
      "Driver No-Show",
      "Vehicle Damage or Mess",
      "Safety or Behavior Concern",
    ],
  },

  description: {
    type: String,
    required: true, // user explains what happened
  },

  // admin resolution
  resolution: {
    note: { type: String, default: "" }, // admin's comment
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // admin id
    resolvedAt: { type: Date, default: null },
  },

  status: {
    type: String,
    enum: ["Open", "Under Review", "Escalated", "Resolved", "Rejected"],
    default: "Open",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const disputeModel = mongoose.model("dispute", disputeSchema);
module.exports = disputeModel;

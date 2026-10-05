const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema({
  rider: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    name: { type: String, required: true },
  },
  driver: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    name: { type: String, default: "" },
  },
  matchCode: {
    type: String,
    required: true,
    unique: true,
  },
  startLocation: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: { type: String, default: "" },
  },
  price: {
    type: String,
    required: true,
  },
  endLocation: {
    coordinates: {
      type: [Number],
      required: true,
    },
    address: { type: String, default: "" },
  },
  routeCoordinates: {
    type: [[Number]],
    default: [],
  },
  distance: {
    type: Number,
    default: 0,
  },
  duration: {
    type: Number,
    default: 0,
  },
  assigned: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    name: { type: String },
    appliedAt: { type: Date },
  },
  applicants: [
    {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
      name: { type: String, required: true },
      appliedAt: { type: Date, default: Date.now },
    },
  ],
  declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  status: {
    type: String,
    enum: [
      "available",
      "accepted",
      "trip started",
      "trip completed",
      "cancelled",
    ],
    default: "available",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

tripSchema.index({ status: 1 });

const totaltripModel = mongoose.model("totaltrip", tripSchema);
module.exports = totaltripModel;

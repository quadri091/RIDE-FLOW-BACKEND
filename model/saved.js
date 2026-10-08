const mongoose = require("mongoose");

const savedSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  startLocation: {
    coordinates: {
      type: [Number],
      required: true,
    },
    address: { type: String, default: "" },
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
});
const savedModel = mongoose.model("saved", savedSchema);
module.exports = savedModel;

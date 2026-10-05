const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  // who sent it
  sender: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    profileImage: {
      type: String,
    },
    role: {
      type: String,
      enum: ["rider", "driver", "admin", "superadmin"],
      required: true,
    },
  },

  // who receives it
  receiver: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    profileImage: {
      type: String,
    },
    role: {
      type: String,
      enum: ["rider", "driver", "admin", "superadmin"],
      required: true,
    },
  },

  // the actual message text
  content: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
});

const messageModel = mongoose.model("message", messageSchema);
module.exports = messageModel;

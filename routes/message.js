const express = require("express");
const messageRouter = express.Router();

const {
  sendMessage,
  fetchReciverDetails,
  getChat,
  getInbox,
  addNewInboxPerson,
} = require("../controller/message.js");

// adjust this import to match wherever your auth middleware actually lives
const authMiddleWare = require("../middleware/auth.js");

// ─── MESSAGE ROUTES ──────────────────────────────────────────────────────────

// send a new message
messageRouter.post(
  "/new-chat",
  authMiddleWare,
  fetchReciverDetails,
  sendMessage,
);
messageRouter.post("/add-coming-inbox", authMiddleWare, addNewInboxPerson);

// get full chat history with a specific user
messageRouter.get("/chat/:userId", authMiddleWare, getChat);

// get inbox (list of conversations)
messageRouter.get("/inbox", authMiddleWare, getInbox);

module.exports = messageRouter;

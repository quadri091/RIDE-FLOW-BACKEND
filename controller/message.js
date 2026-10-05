const usermodel = require("../model/form-model.js");
const messageModel = require("../model/message.js");
const { getSocketsByUserId } = require("../socket.js");
// ─── SEND A MESSAGE ─────────────────────────────────────────────────────────
// called when rider or driver sends a message
const fetchReciverDetails = async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    const driverDetails = await usermodel.findById(receiverId);
    if (!driverDetails) {
      return res
        .status(400)
        .json({ message: "Receiver is not a member on this platform" });
    }
    req.driver = driverDetails;
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};
const sendMessage = async (req, res) => {
  const {
    _id: receiverId,
    userName: receiverName,
    role: receiverRole,
    profileImage: receiverPicture,
  } = req.driver;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ message: "Message is required" });
  }

  try {
    const message = await messageModel.create({
      sender: {
        id: req.user.id,
        name: req.user.userName,
        role: req.user.role,
        profileImage: req.user.profileImage,
      },
      receiver: {
        id: receiverId,
        name: receiverName,
        role: receiverRole,
        profileImage: receiverPicture,
      },
      content,
    });

    // notify receiver in real time via socket
    const io = req.app.get("io");
    const targetSockets = getSocketsByUserId(receiverId);
    const senderSockets = getSocketsByUserId(req.user.id);
    const issender = message.sender.id.toString() === req.user.id.toString();
    targetSockets.forEach((socketId) => {
      io.to(socketId).emit("newMessage", {
        person: message.sender,
        message: message.content,
        lastMessageAt: message.createdAt,
        lastMessageFromMe: issender,
      });

      io.to(socketId).emit("newInbox", {
        person: message.sender,
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
        lastMessageFromMe: false,
      });
    });

    senderSockets.forEach((socketId) => {
      io.to(socketId).emit("newMessage", {
        person: message.receiver,
        message: message.content,
        lastMessageAt: message.createdAt,
        lastMessageFromMe: issender,
      });
      io.to(socketId).emit("newInbox", {
        person: message.receiver,
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
        lastMessageFromMe: true,
      });
    });

    return res.status(200).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {}
};

// ─── GET CHAT BETWEEN TWO USERS ─────────────────────────────────────────────
// returns all messages between the logged in user and another user
// sorted oldest to newest so chat appears top to bottom
const getChat = async (req, res) => {
  const { userId } = req.params;

  try {
    let arr = [];
    const messages = await messageModel
      .find({
        $or: [
          { "sender.id": req.user.id, "receiver.id": userId },
          { "sender.id": userId, "receiver.id": req.user.id },
        ],
      })
      .sort({ createdAt: 1 }); // oldest first

    messages.forEach((member) => {
      const issender = member.sender.id.toString() === req.user.id.toString();
      let object = {
        person: member.sender,
        message: member.content,
        lastMessageAt: member.createdAt,
        lastMessageFromMe: issender,
      };
      arr.push(object);
    });
    return res.status(200).json({
      message: "Chat fetched successfully",
      data: arr,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};
const addNewInboxPerson = (req, res) => {
  const { id, name, profileImage, role } = req.body;

  const io = req.app.get("io");

  const userSockets = getSocketsByUserId(req.user.id);

  const data = {
    person: {
      id,
      name,
      profileImage,
      role,
    },
    comingNew: true,
  };

  userSockets.forEach((socketId) => {
    io.to(socketId).emit("addNewInboxPerson", data);
  });

  return res.status(200).json({
    message: "Person added to inbox",
  });
};

// ─── GET INBOX ───────────────────────────────────────────────────────────────
// returns a list of all people the logged in user has chatted with
// showing only the latest message from each conversation
const getInbox = async (req, res) => {
  try {
    const messages = await messageModel
      .find({
        $or: [{ "sender.id": req.user.id }, { "receiver.id": req.user.id }],
      })
      .sort({ createdAt: -1 }); // newest first

    // build inbox - one entry per unique conversation partner
    const inboxMap = {};

    messages.forEach((msg) => {
      // figure out who the OTHER person is in this message
      const issender = msg.sender.id.toString() === req.user.id.toString();
      const otherPerson = issender ? msg.receiver : msg.sender;
      const otherPersonId = otherPerson.id.toString();

      // only keep the first (newest) message per conversation partner
      if (!inboxMap[otherPersonId]) {
        inboxMap[otherPersonId] = {
          person: otherPerson,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          lastMessageFromMe: issender,
        };
      }
    });

    // convert map to array
    const inbox = Object.values(inboxMap);

    return res.status(200).json({
      message: "Inbox fetched successfully",
      data: inbox,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  sendMessage,
  getChat,
  fetchReciverDetails,
  getInbox,
  addNewInboxPerson,
};

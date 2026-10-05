const express = require("express");

require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connect = require("./database/database.js");
const formRouter = require("./routes/form.js");
const savedRouter = require("./routes/saved.js");
const messageRouter = require("./routes/message.js");
const tripRouter = require("./routes/trip.js");
const disputeRouter = require("./routes/dispute.js");
const totalTripRouter = require("./routes/totaltrip.js");
const staffRouter = require("./routes/staff.js");
const bannedRouter = require("./routes/banned.js");
const actionRouter = require("./routes/action.js");
const suspendedRouter = require("./routes/suspended.js");
const { lifeUpdate } = require("./socket.js");
const {
  getAllSuspendedAndStartUnsuspend,
} = require("./controller/suspended.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const port = 8000;
connect();

app.use(express.json({ limit: "20mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);
app.set("io", io);
app.use("/form", formRouter);
app.use("/dispute", disputeRouter);
app.use("/location", savedRouter);
app.use("/total-trip", totalTripRouter);
app.use("/staff", staffRouter);
app.use("/message", messageRouter);
app.use("/trip", tripRouter);
app.use("/banned", bannedRouter);
app.use("/action", actionRouter);
app.use("/suspended", suspendedRouter);
lifeUpdate(io);
getAllSuspendedAndStartUnsuspend(io);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

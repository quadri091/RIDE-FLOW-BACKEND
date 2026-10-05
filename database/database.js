const mongoose = require("mongoose");
// db.js
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const connect = async () => {
  if (!process.env.LINK) {
    console.warn("Missing MongoDB connection string in process.env.LINK");
    return;
  }

  try {
    await mongoose.connect(process.env.LINK, {
      bufferTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000, // how long to try finding a server
      socketTimeoutMS: 45000, // how long an individual query can run
      connectTimeoutMS: 30000, // how long initial connection attempt can take
    });
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

module.exports = connect;

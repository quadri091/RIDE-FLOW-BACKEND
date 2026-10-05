const express = require("express");
const savedRouter = express.Router();
const authMiddleWare = require("../middleware/auth.js");
const { getUsedLocation, deleteLocation } = require("../controller/saved.js");
savedRouter.get("/get-used-location", authMiddleWare, getUsedLocation);
savedRouter.delete("/delete-location/:id", authMiddleWare, deleteLocation);

module.exports = savedRouter;

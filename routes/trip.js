const express = require("express");
const tripRouter = express.Router();
const authMiddleWare = require("../middleware/auth.js");
const {
  createTrip,
  getTripRoute,
  assignTrip,
  applyTrip,
  acceptTrip,
  declineTrip,
  startTrip,
  endTrip,
  getTrip,
  getActiveTrip,
  getTotalTrip,
  giveRating,
  viewApplied,
  getOwnedTrip,
  cancelTrip,
  fetchDriverDetails,
} = require("../controller/trip.js");
const roleMiddleware = require("../middleware/role.js");

tripRouter.post("/create-trip", authMiddleWare, createTrip);
tripRouter.post("/assign-trip", authMiddleWare, assignTrip);
tripRouter.get("/get-owned-trip", authMiddleWare, getOwnedTrip);
tripRouter.post("/apply-trip", authMiddleWare, applyTrip);
tripRouter.post("/accept-trip", authMiddleWare, acceptTrip);
tripRouter.post("/decline-trip", authMiddleWare, declineTrip);
tripRouter.post("/start-trip", authMiddleWare, startTrip);
tripRouter.post("/view-applied", authMiddleWare, viewApplied);
tripRouter.delete("/delete-trip/:matchCode", authMiddleWare, cancelTrip);
tripRouter.get(
  "/get-driver-details/:driverId",
  authMiddleWare,
  fetchDriverDetails,
);
tripRouter.post("/end-trip", authMiddleWare, endTrip);
tripRouter.post("/get-trip-route", authMiddleWare, getTripRoute);
tripRouter.get("/get-trip/:matchCode", authMiddleWare, getTrip);
tripRouter.get("/get-active-trip", authMiddleWare, getActiveTrip);

tripRouter.get("/get-total-trip", authMiddleWare, getTotalTrip);
tripRouter.post("/give-rating", authMiddleWare, giveRating);

module.exports = tripRouter;

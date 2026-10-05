const tripModel = require("../model/trip-model.js");
const savedModel = require("../model/saved.js");
const totaltripModel = require("../model/totaltrip-model.js");
const axios = require("axios");
const mongoose = require("mongoose");
const usermodel = require("../model/form-model.js");
const { getSocketsByUserId } = require("../socket.js");
const generateMatchCode = async () => {
  const lastTrip = await totaltripModel
    .findOne()
    .sort({ createdAt: -1 })
    .select("matchCode");

  if (!lastTrip || !lastTrip.matchCode) {
    return "T-1001";
  }

  const lastNum = parseInt(lastTrip.matchCode.split("-")[1]);
  return `T-${lastNum + 1}`;
};

const broadCastTrip = async (io, room, path, data) => {
  io.to(room).emit(path, data);
};

const createTrip = async (req, res) => {
  const { route, price, usedArea } = req.body;

  if (!route || !price) {
    return res.status(400).json({ message: "All Fields Are Required" });
  }

  try {
    let matchCode = await generateMatchCode();
    let codeExists = await tripModel.findOne({ matchCode });
    while (codeExists) {
      matchCode = await generateMatchCode();
      codeExists = await tripModel.findOne({ matchCode });
    }

    const tripData = {
      rider: { id: req.user.id, name: req.user.userName },
      price,
      matchCode,
      startLocation: {
        coordinates: usedArea
          ? route.startLocation.coordinates
          : route.startCoordinates,
        address: usedArea
          ? route.startLocation.address
          : route.startAddress || "",
      },
      endLocation: {
        coordinates: usedArea
          ? route.endLocation.coordinates
          : route.endCoordinates,
        address: usedArea ? route.endLocation.address : route.endAddress || "",
      },
      routeCoordinates: usedArea
        ? route.routeCoordinates
        : route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      status: "available",
    };

    const trip = await tripModel.create(tripData);
    await totaltripModel.create(tripData);

    if (!trip) {
      return res.status(400).json({ message: "Error creating account" });
    }

    if (!usedArea) {
      const savedObject = {
        email: req.user.email,
        startLocation: {
          coordinates: route.startCoordinates,
          address: route.startAddress || "",
        },
        endLocation: {
          coordinates: route.endCoordinates,
          address: route.endAddress || "",
        },
        routeCoordinates: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration,
      };
      await savedModel.create(savedObject);
    }

    const io = req.app.get("io");
    const socket = getSocketsByUserId(req.user.id.toString());
    io.to(socket).emit("trip:created", trip);
    io.to("drivers").emit("trip:created", trip);
    io.to("drivers").emit("saved:created", savedObject);
    io.to("admins").emit("trip:created", trip);

    return res.status(200).json({
      message: "Trip created successfully",
      data: trip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

const getTripRoute = async (req, res) => {
  const { startCoordinates, endCoordinates } = req.body;
  if (!startCoordinates || !endCoordinates) {
    return res
      .status(400)
      .json({ message: "Start and end coordinates are required" });
  }
  try {
    const [osrmResponse, startOpenStreet, endOpenStreet] = await Promise.all([
      axios.get(
        `https://router.project-osrm.org/route/v1/driving/${startCoordinates[1]},${startCoordinates[0]};${endCoordinates[1]},${endCoordinates[0]}?geometries=geojson&overview=full`,
      ),
      axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${startCoordinates[0]}&lon=${startCoordinates[1]}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "RIDE-FLOW" } },
      ),
      axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${endCoordinates[0]}&lon=${endCoordinates[1]}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "RIDE-FLOW" } },
      ),
    ]);

    const route = osrmResponse.data.routes[0];
    if (!route) {
      return res
        .status(404)
        .json({ message: "No route found between these locations" });
    }
    route.startCoordinates = startCoordinates;
    route.endCoordinates = endCoordinates;
    route.startAddress = startOpenStreet.data.display_name;
    route.endAddress = endOpenStreet.data.display_name;
    return res
      .status(200)
      .json({ message: "Route Found", data: route, status: true });
  } catch (error) {
    return res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

const viewApplied = async (req, res) => {
  const { matchCode } = req.body;
  if (!matchCode) {
    return res.status(400).json({ message: "Match Code Is Required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode }).lean();
    if (!trip) {
      return res.status(400).json({ message: "Error While Fetching" });
    }

    const ids = (trip.applicants || []).map((a) => a.id);

    const users = await usermodel
      .find({ _id: { $in: ids } })
      .select("-password")
      .lean();

    return res.status(200).json({
      message: "Fetched Successfully",
      data: { ...trip, applicants: users },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

const assignTrip = async (req, res) => {
  const { userId, matchCode } = req.body;
  if (!userId || !matchCode) {
    return res
      .status(400)
      .json({ message: "User Id and Match Code are required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.rider.id.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the rider can assign a driver" });
    }

    if (trip.status !== "available") {
      return res.status(400).json({ message: "Trip is no longer available" });
    }

    if (trip.assigned.id) {
      return res.status(400).json({
        message: `Trip Already Assigned To <b>${trip.assigned.name}</b>`,
      });
    }

    const driver = await usermodel.findById(userId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (driver.role !== "driver") {
      return res.status(400).json({ message: "This user is not a driver" });
    }

    if (trip.driver?.id) {
      return res
        .status(400)
        .json({ message: "Trip already has a driver assigned" });
    }
    if (trip.assigned?.id) {
      return res.status(400).json({
        message: "You already have someone assigned to the Trip",
      });
    }

    const update = {
      id: driver.id.toString(),
      name: driver.userName,
      appliedAt: new Date(),
    };
    const updatedTrip = await tripModel.findOneAndUpdate(
      { matchCode },
      { $set: { assigned: update, status: "available" } },
      { returnDocument: "after" },
    );

    await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { assigned: update, status: "available" } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:assigned", updatedTrip);
    const socket1 = getSocketsByUserId(trip.rider.id.toString());
    const socket2 = getSocketsByUserId(driver.id.toString());
    io.to(socket2).emit("trip:assigned", updatedTrip);
    io.to(socket1).emit("trip:assigned", updatedTrip);
    const find = await usermodel.findById(trip?.rider?.id);

    if (find) {
      setTimeout(
        async () => {
          respond = await autoDeleteAssign(req, matchCode, update.id);
        },
        +find.assignTimeOut * 60 * 1000,
      );
    }

    return res.status(200).json({
      message: `Assigned driver will be auto removed after ${req.user.assignTimeOut} minutes`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const applyTrip = async (req, res) => {
  const { matchCode } = req.body;

  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.status !== "available") {
      return res.status(400).json({ message: "Trip is no longer available" });
    }

    if (trip.driver?.id) {
      return res
        .status(400)
        .json({ message: "Trip already has a driver assigned" });
    }

    const alreadyApplied = trip.applicants.find(
      (a) => a.id.toString() === req.user.id.toString(),
    );

    if (alreadyApplied) {
      return res
        .status(400)
        .json({ message: "You already applied for this trip" });
    }

    const update = [
      ...trip.applicants,
      {
        id: req.user.id.toString(),
        name: req.user.userName,
      },
    ];

    const updatedTrip = await tripModel.findOneAndUpdate(
      { matchCode },
      { $set: { applicants: update, status: "available" } },
      { returnDocument: "after" },
    );

    await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { applicants: update, status: "available" } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:updated", updatedTrip);
    const socket1 = getSocketsByUserId(req.user.id.toString());
    const socket2 = getSocketsByUserId(trip.rider.id.toString());
    io.to(socket1).emit("trip:updated", updatedTrip);
    io.to(socket2).emit("trip:updated", updatedTrip);

    return res.status(200).json({
      message: "Applied for trip successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const acceptTrip = async (req, res) => {
  const { matchCode } = req.body;

  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assigned?.id?.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the assigned driver can accept" });
    }

    if (trip.status !== "available") {
      return res.status(400).json({ message: "Trip is no longer available" });
    }
    const update = {
      id: req.user.id.toString(),
      name: req.user.userName,
    };

    const updatedTrip = await tripModel.findOneAndUpdate(
      { matchCode },
      { $set: { driver: update, assigned: {}, status: "accepted" } },

      { returnDocument: "after" },
    );

    await totaltripModel.findOneAndUpdate(
      { matchCode },
      {
        $set: {
          driver: update,
          assigned: {},
          status: "accepted",
          isBusy: true,
        },
      },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:accepted", updatedTrip);
    const socket1 = getSocketsByUserId(trip.rider.id.toString());
    const socket2 = getSocketsByUserId(req.user.id.toString());
    io.to(socket1).emit("trip:accepted", updatedTrip);
    io.to(socket2).emit("trip:accepted", updatedTrip);

    const find = await usermodel.findById(trip?.rider?.id);
    if (find) {
      setTimeout(async () => {
        await autoDeleteAccept(req, matchCode, req.user.id.toString());
      }, 5000);
    }
    return res.status(200).json({
      message: "Trip accepted successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const autoDeleteAssign = async (req, matchCode, driverId) => {
  if (!matchCode.trim() || !driverId.trim()) {
    return { text: "Match code and driver Id is required", code: 1 };
  }

  try {
    const find = await tripModel.findOne({ matchCode });
    if (
      find &&
      find?.assigned?.id?.toString() == driverId &&
      (find.status == "available" || find.status == "accepted")
    ) {
      const updatedTrip = await tripModel.findOneAndUpdate(
        { matchCode },
        {
          $set: {
            driver: {},
            assigned: {},
            status: "available",
            isBusy: false,
          },
        },
        { returnDocument: "after" },
      );

      await totaltripModel.findOneAndUpdate(
        { matchCode },
        {
          $set: {
            driver: {},
            assigned: {},
            status: "available",
            isBusy: false,
          },
        },
        { returnDocument: "after" },
      );

      const io = req.app.get("io");
      await broadCastTrip(
        io,
        "admins",
        "trip:auto-remove-assign",
        `Driver: <b>${find.assigned.name} has been remove from Trip: ${updatedTrip.matchCode}</b>`,
      );
      const socket1 = getSocketsByUserId(find.rider.id.toString());
      const socket2 = getSocketsByUserId(driverId.toString());
      io.to(socket2).emit(
        "trip:auto-remove-assign",
        `You have been remove from Trip: ${find.matchCode}</b>`,
      );
      io.to(socket1).emit(
        "trip:auto-remove-assign",
        `Driver: <b>${find.assigned.name} has been remove from Trip: ${find.matchCode}</b>`,
      );
      return { text: "auto-remove-assign", code: 2 };
    } else {
      if (!find) {
        return { text: "Trip not found", code: 3 };
      }

      const io = req.app.get("io");
      await broadCastTrip(
        io,
        "admins",
        "trip:failed-to-auto-delete",
        `Driver: ${driverId} is not assigned to this trip`,
      );

      const socket1 = getSocketsByUserId(find.rider.id.toString());
      io.to(socket1).emit(
        "trip:failed-to-auto-delete",
        `Driver: ${driverId} is not assigned to this trip`,
      );

      return { text: "failed", code: 3 };
    }
  } catch (error) {
    return { text: "Internal Server error", code: 4 };
  }
};

const autoDeleteAccept = async (req, matchCode, driverId) => {
  if (!matchCode.trim() || !driverId.trim()) {
    return { text: "Match code and driver Id is required", code: 1 };
  }

  try {
    const find = await tripModel.findOne({ matchCode });
    if (
      find &&
      find.driver?.id?.toString() == driverId.toString() &&
      find.status == "accepted"
    ) {
      const updatedTrip = await tripModel.findOneAndUpdate(
        { matchCode },
        {
          $set: {
            driver: {},
            assigned: {},
            status: "available",
            isBusy: false,
          },
        },
        { returnDocument: "after" },
      );

      await totaltripModel.findOneAndUpdate(
        { matchCode },
        {
          $set: {
            driver: {},
            assigned: {},
            status: "available",
            isBusy: false,
          },
        },
        { returnDocument: "after" },
      );
      const io = req.app.get("io");
      await broadCastTrip(io, "admins", "trip:auto-delete-accept", updatedTrip);
      const socket1 = getSocketsByUserId(driverId.toString());
      const socket2 = getSocketsByUserId(find.rider.id.toString());
      io.to(socket1).emit("trip:auto-delete-accept", updatedTrip);
      io.to(socket2).emit("trip:auto-delete-accept", updatedTrip);
      return { text: "auto-delete-accept", code: 2 };
    }
    return { text: "failed", code: 3 };
  } catch (error) {
    return { text: "Internal Server error", code: 4 };
  }
};

const declineTrip = async (req, res) => {
  const { matchCode } = req.body;

  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assigned?.id?.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the assigned driver can decline" });
    }

    if (trip.status !== "available") {
      return res.status(400).json({ message: "Trip is no longer available" });
    }

    const declined = trip.declinedBy;
    declined.push(req.user.id.toString());

    const updatedTrip = await tripModel.findOneAndUpdate(
      { matchCode },
      { $set: { declinedBy: declined, status: "available", assigned: {} } },
      { returnDocument: "after" },
    );

    await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { declinedBy: declined, status: "available", assigned: {} } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:declined", updatedTrip);
    const socket1 = getSocketsByUserId(req.user.id.toString());
    const socket2 = getSocketsByUserId(trip.rider.id.toString());
    io.to(socket1).emit("trip:declined", updatedTrip);
    io.to(socket2).emit("trip:declined", updatedTrip);

    return res.status(200).json({
      message: "Trip declined successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const startTrip = async (req, res) => {
  const { matchCode } = req.body;

  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.driver?.id?.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the assigned driver can start the trip" });
    }

    if (trip.status !== "accepted") {
      return res.status(400).json({ message: "Trip is not ready to start" });
    }

    const updatedTrip = await tripModel.findOneAndUpdate(
      { matchCode },
      { $set: { status: "trip started", applicants: [] } },
      { returnDocument: "after" },
    );

    await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { status: "trip started", applicants: [] } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:started", updatedTrip);
    const socket1 = getSocketsByUserId(req.user.id.toString());
    const socket2 = getSocketsByUserId(trip.rider.id.toString());
    io.to(socket1).emit("trip:started", updatedTrip);
    io.to(socket2).emit("trip:started", updatedTrip);

    return res.status(200).json({
      message: "Trip started successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const fetchDriverDetails = async (req, res) => {
  const { driverId } = req.params;

  if (
    !driverId ||
    driverId === "null" ||
    driverId === "undefined" ||
    !mongoose.Types.ObjectId.isValid(driverId)
  ) {
    return res.status(400).json({
      message: "Valid Driver ID is required",
    });
  }

  try {
    const driver = await usermodel.findById(driverId).select("-password");

    if (!driver) {
      return res.status(404).json({
        message: "Driver is not a member of this platform",
      });
    }

    return res.status(200).json({
      message: "Driver details fetched successfully",
      data: driver,
    });
  } catch (error) {
    console.log("My " + error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const endTrip = async (req, res) => {
  const { matchCode } = req.body;

  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }

  try {
    const trip = await tripModel.findOne({ matchCode });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (
      trip.rider.id.toString() !== req.user.id.toString() &&
      trip.driver?.id?.toString() !== req.user.id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Only the rider or driver can end the trip" });
    }

    const updatedTrip = await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { status: "trip completed" } },
      { returnDocument: "after" },
    );
    await tripModel.findOneAndDelete({ matchCode });

    const io = req.app.get("io");
    await broadCastTrip(io, "admins", "trip:completed", updatedTrip);
    const socket1 = getSocketsByUserId(trip.rider.id.toString());
    const socket2 = getSocketsByUserId(trip.driver?.id?.toString());
    io.to(socket1).emit("trip:completed", updatedTrip);
    io.to(socket2).emit("trip:completed", updatedTrip);

    return res.status(200).json({
      message: "Trip completed successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const cancelTrip = async (req, res) => {
  const { matchCode } = req.params;
  if (!matchCode) {
    return res.status(400).json({ message: "Match code is required" });
  }
  try {
    const trip = await tripModel.findOneAndDelete({ matchCode });
    await totaltripModel.findOneAndUpdate(
      { matchCode },
      { $set: { status: "cancelled" } },
    );

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    const io = req.app.get("io");
    for (const element of trip.applicants) {
      const socket = getSocketsByUserId(element?.id?.toString());
      io.to(socket).emit("trip:cancelled", trip);
    }
    await broadCastTrip(io, "admins", "trip:cancelled", trip);
    return res
      .status(200)
      .json({ message: "Trip Deleted Successfuly", data: trip });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getTrip = async (req, res) => {
  const { matchCode } = req.params;
  try {
    const trip = await tripModel.findOne({ matchCode });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    return res.status(200).json({
      message: "Trip fetched successfully",
      data: trip,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getOwnedTrip = async (req, res) => {
  try {
    const all = await totaltripModel.find({
      $or: [{ "rider.id": req.user.id }, { "driver.id": req.user.id }],
      // status: "trip completed",
    });
    return res.status(200).json({ data: all });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getActiveTrip = async (req, res) => {
  try {
    const trips = await tripModel.find({
      $or: [{ "rider.id": req.user.id }, { "driver.id": req.user.id }],
    });

    const tripsWithDriverDetails = await Promise.all(
      trips.map(async (trip) => {
        const tripObj = trip.toObject(); // detach from Mongoose doc so you can add fields freely

        if (trip.driver && trip.driver.id) {
          const driverDetails = await usermodel
            .findById(trip.driver.id)
            .select(
              "plateNumber drivingLicense carBrand carModel carYear profileImage carImage",
            );
          tripObj.driverDetails = driverDetails || null;
        } else {
          tripObj.driverDetails = null;
        }

        return tripObj;
      }),
    );

    res
      .status(200)
      .json({ data: tripsWithDriverDetails, message: "Fetched Successful" });
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getTotalTrip = async (req, res) => {
  try {
    const all = await totaltripModel.find();
    return res.status(200).json({ data: all });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const giveRating = async (req, res) => {
  const { driverId, rating } = req.body;

  if (!driverId || !rating) {
    return res
      .status(400)
      .json({ message: "Driver ID and Rating are Required" });
  }

  const numericRating = Number(rating);
  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    return res
      .status(400)
      .json({ message: "Rating must be a whole number from 1 to 5" });
  }

  try {
    const find = await usermodel.findById(driverId);
    if (!find) {
      return res.status(400).json({ message: "Driver Not Found" });
    }

    const pointsToAdd = numericRating * 20; // 1→20, 2→40, 3→60, 4→80, 5→100

    if (+find.rating >= 1000) {
      return res.status(400).json({ message: "Driver rating full. Thanks" });
    }

    const newRating = Math.min(+find.rating + pointsToAdd, 1000);

    const update = await usermodel.findByIdAndUpdate(
      driverId,
      { $set: { rating: newRating } },
      { returnDocument: "after" },
    );

    const io = req.app.get("io");
    const socket = getSocketsByUserId(driverId);
    io.to(socket).emit("rating-update", update);
    await broadCastTrip(io, "rating-update", "trip:cancelled", update);
    return res.status(200).json({ message: "Success" });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  createTrip,
  assignTrip,
  applyTrip,
  acceptTrip,
  declineTrip,
  startTrip,
  endTrip,
  viewApplied,
  getTrip,
  getTripRoute,
  getOwnedTrip,
  getActiveTrip,
  getTotalTrip,
  giveRating,
  fetchDriverDetails,
  cancelTrip,
};

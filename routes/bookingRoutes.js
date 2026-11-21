
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyCustomer from "../middlewares/verifyCustomer.js";
import verifyTechnician from "../middlewares/verifyTechnician.js";

const router = express.Router();

// Create a Booking (Customer)
router.post("/", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();

    const {
      serviceId,
      phone,
      address,
      preferredDate,
      problemDescription,
    } = req.body || {};

    if (
      typeof serviceId !== "string" ||
      typeof phone !== "string" ||
      typeof address !== "string" ||
      typeof preferredDate !== "string" ||
      typeof problemDescription !== "string" ||
      !serviceId.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !preferredDate.trim() ||
      !problemDescription.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required booking information.",
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    if (problemDescription.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "Problem description must be at least 20 characters.",
      });
    }

    const selectedDate = new Date(`${preferredDate}T00:00:00`);

    if (
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate < new Date(new Date().toDateString())
    ) {
      return res.status(400).json({
        success: false,
        message: "Preferred date must be today or a future date.",
      });
    }

    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or currently unavailable.",
      });
    }

    if (!service.technicianId) {
      return res.status(400).json({
        success: false,
        message: "No technician is assigned to this service.",
      });
    }

    const customerId = req.user.id;

    const existingBooking = await db.collection("bookings").findOne({
      serviceId: service._id.toString(),
      customerId,
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active booking for this service.",
      });
    }

    const booking = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image || "",
      category: service.category,

      customerId,
      customerName: req.user.name || "",
      customerEmail: req.user.email,

      technicianId: service.technicianId,
      technicianName: service.technicianName || "",
      technicianEmail: service.technicianEmail || "",

      phone: phone.trim(),
      address: address.trim(),
      preferredDate,
      problemDescription: problemDescription.trim(),

      basePrice: Number(service.basePrice),
      finalAmount: null,

      status: "requested",
      paymentStatus: "unpaid",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully.",
      booking: {
        ...booking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    if (
      error.code === 11000 &&
      error.message.includes("unique_active_customer_service_booking")
    ) {
      return res.status(409).json({
        success: false,
        message: "You already have an active booking for this service.",
      });
    }

    console.error("Create Booking Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create booking.",
    });
  }
});

// Get Customer's Own Bookings
router.get("/my-bookings", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();

    const bookings = await db
      .collection("bookings")
      .find({ customerId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Get Customer Bookings Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
    });
  }
});

// Get Technician's Booking Requests
router.get(
  "/technician-requests",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const db = getDB();

      const bookings = await db
        .collection("bookings")
        .find({ technicianId: req.user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        bookings,
      });
    } catch (error) {
      console.error("Get Technician Requests Error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to fetch technician requests.",
      });
    }
  }
);

// Update Booking Status (Technician)
router.patch("/:id/status", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { status, finalAmount } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
      technicianId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or access denied.",
      });
    }

    const allowedTransitions = {
      requested: ["accepted", "rejected"],
      accepted: ["in-progress"],
      "in-progress": ["completed"],
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change booking status from ${booking.status} to ${status}.`,
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "completed") {
      const amount = Number(finalAmount);

      if (
        (typeof finalAmount !== "number" &&
          typeof finalAmount !== "string") ||
        String(finalAmount).trim() === "" ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid final amount greater than zero is required.",
        });
      }

      updateData.finalAmount = amount;
    }

    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        technicianId: req.user.id,
        status: booking.status,
      },
      {
        $set: updateData,
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Booking status was changed. Please refresh and try again.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully.`,
    });
  } catch (error) {
    console.error("Update Booking Status Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update booking status.",
    });
  }
});

// Cancel Customer's Own Booking
router.patch("/:id/cancel", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        customerId: req.user.id,
        status: "requested",
      },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found, or it can no longer be cancelled.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel Booking Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to cancel booking.",
    });
  }
});

export default router;

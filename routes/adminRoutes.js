import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyAdmin from "../middlewares/verifyAdmin.js";

const router = express.Router();

// Admin Overview Statistics
router.get("/overview", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();

    const [totalUsers, totalTechnicians, pendingServices] = await Promise.all([
      db.collection("user").countDocuments(),
      db.collection("user").countDocuments({ role: "technician" }),
      db.collection("services").countDocuments({
        approvalStatus: "pending",
      }),
    ]);

    res.status(200).json({
      success: true,
      totalUsers,
      totalTechnicians,
      pendingServices,
    });
  } catch (error) {
    console.error("Admin Overview Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load admin overview.",
    });
  }
});

// Get All Users
router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();

    const users = await db
      .collection("user")
      .find({})
      .project({
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get Users Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
});

// Update User Role
router.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["customer", "technician", "admin"];

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    if (id === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role.",
      });
    }

    const result = await db.collection("user").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully.",
    });
  } catch (error) {
    console.error("Update User Role Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update user role.",
    });
  }
});

// Get All Services for Admin
router.get("/services", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status = "all" } = req.query;

    const filter = {};

    if (["pending", "approved", "rejected"].includes(status)) {
      filter.approvalStatus = status;
    } else if (status !== "all") {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status.",
      });
    }

    const services = await db
      .collection("services")
      .find(filter)
      .sort({ approvalStatus: 1, createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Get Admin Services Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
});

// Approve or Reject Service
router.patch(
  "/services/:id/approval",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const db = getDB();
      const { id } = req.params;
      const { approvalStatus } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service ID.",
        });
      }

      if (!["approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json({
          success: false,
          message: "Approval status must be approved or rejected.",
        });
      }

      const result = await db.collection("services").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            approvalStatus,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Service not found.",
        });
      }

      res.status(200).json({
        success: true,
        message: `Service ${approvalStatus} successfully.`,
      });
    } catch (error) {
      console.error("Service Approval Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update service approval.",
      });
    }
  },
);
// Get All Bookings for Admin
router.get("/bookings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status, paymentStatus } = req.query;

    const filter = {};

    const allowedStatuses = [
      "requested",
      "accepted",
      "rejected",
      "cancelled",
      "in-progress",
      "completed",
    ];

    if (status && status !== "all") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking status.",
        });
      }

      filter.status = status;
    }

    if (paymentStatus && paymentStatus !== "all") {
      if (!["paid", "unpaid"].includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status.",
        });
      }

      filter.paymentStatus = paymentStatus;
    }

    const bookings = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get Admin Bookings Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
    });
  }
});

// Get All Transactions
router.get("/transactions", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const paymentsCollection = db.collection("payments");

    const [payments, totalTransactions, revenueResult] = await Promise.all([
      paymentsCollection.find({}).sort({ createdAt: -1 }).toArray(),

      paymentsCollection.countDocuments({}),

      paymentsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$amount",
              },
            },
          },
        ])
        .toArray(),
    ]);

    res.status(200).json({
      success: true,
      totalTransactions,
      totalRevenue: revenueResult[0]?.totalRevenue || 0,
      payments: payments.map((payment) => ({
        ...payment,
        paymentStatus: payment.paymentStatus || payment.status || "paid",
      })),
    });
  } catch (error) {
    console.error("Get Transactions Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions.",
    });
  }
});

export default router;

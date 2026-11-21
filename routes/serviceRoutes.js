
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyTechnician from "../middlewares/verifyTechnician.js";

const router = express.Router();

// Create a new service (Technician only)
router.post("/", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();

    const {
      title,
      category,
      description,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
      image,
    } = req.body;

    if (
      !title?.trim() ||
      !category ||
      !description?.trim() ||
      basePrice === undefined ||
      !estimatedDuration ||
      !serviceMode ||
      !serviceArea
    ) {
      return res.status(400).json({
        message: "Please provide all required service information.",
      });
    }

    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Please provide a valid service price.",
      });
    }

    const newService = {
      title: title.trim(),
      category,
      description: description.trim(),
      basePrice: price,
      estimatedDuration,
      serviceMode,
      serviceArea,
      image: image || "",
      technicianId: req.user.id,
      technicianName: req.user.name || "",
      technicianEmail: req.user.email || "",
      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("services").insertOne(newService);

    res.status(201).json({
      message: "Service submitted successfully. Waiting for admin approval.",
      serviceId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create service.",
      error: error.message,
    });
  }
});

// Get technician's own services
// Keep this before GET "/:id"
router.get("/my-services", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();

    const services = await db
      .collection("services")
      .find({ technicianId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      message: "Your services fetched successfully.",
      services,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch your services.",
      error: error.message,
    });
  }
});

// Edit service (Owner technician only)
router.patch("/:id/edit", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const {
      title,
      category,
      description,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
      image,
    } = req.body;

    if (
      !title?.trim() ||
      !category ||
      !description?.trim() ||
      basePrice === undefined ||
      !estimatedDuration ||
      !serviceMode ||
      !serviceArea
    ) {
      return res.status(400).json({
        message: "Please provide all required service information.",
      });
    }

    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Please provide a valid service price.",
      });
    }

    const result = await db.collection("services").updateOne(
      {
        _id: new ObjectId(id),
        technicianId: req.user.id,
      },
      {
        $set: {
          title: title.trim(),
          category,
          description: description.trim(),
          basePrice: price,
          estimatedDuration,
          serviceMode,
          serviceArea,
          ...(image !== undefined ? { image } : {}),
          approvalStatus: "pending",
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you do not own this service.",
      });
    }

    res.status(200).json({
      message: "Service updated successfully. Waiting for admin approval.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update service.",
      error: error.message,
    });
  }
});

// Update service availability (Owner technician only)
router.patch(
  "/:id/availability",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const db = getDB();
      const { id } = req.params;
      const { isAvailable } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid service ID.",
        });
      }

      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          message: "Please provide a valid availability status.",
        });
      }

      const result = await db.collection("services").updateOne(
        {
          _id: new ObjectId(id),
          technicianId: req.user.id,
        },
        {
          $set: {
            isAvailable,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "Service not found or you do not own this service.",
        });
      }

      res.status(200).json({
        message: "Service availability updated successfully.",
        isAvailable,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to update availability.",
        error: error.message,
      });
    }
  },
);

// Delete service (Owner technician only)
router.delete("/:id", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const result = await db.collection("services").deleteOne({
      _id: new ObjectId(id),
      technicianId: req.user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you do not own this service.",
      });
    }

    res.status(200).json({
      message: "Service deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete service.",
      error: error.message,
    });
  }
});

// Get all approved and available services
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const { search, category, serviceMode, sort } = req.query;

    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (category) query.category = category;
    if (serviceMode) query.serviceMode = serviceMode;

    let sortOption = { createdAt: -1 };

    if (sort === "price-low") {
      sortOption = { basePrice: 1 };
    } else if (sort === "price-high") {
      sortOption = { basePrice: -1 };
    }

    const services = await db
      .collection("services")
      .find(query)
      .sort(sortOption)
      .toArray();

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch services.",
      error: error.message,
    });
  }
});

// Get single approved service by ID
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const service = await db.collection("services").findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found.",
      });
    }

    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch service.",
      error: error.message,
    });
  }
});

export default router;

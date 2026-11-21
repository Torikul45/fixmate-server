
import express from "express";
import { ObjectId } from "mongodb";
import verifyToken from "../middlewares/verifyToken.js";
import { getDB } from "../config/db.js";

const router = express.Router();

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const { name, image, phone, area, bio } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    const updateData = {
      name: name.trim(),
      image: typeof image === "string" ? image : "",
      phone: typeof phone === "string" ? phone.trim() : "",
      area: typeof area === "string" ? area.trim() : "",
      bio: typeof bio === "string" ? bio.trim() : "",
      updatedAt: new Date(),
    };

    const result = await db.collection("user").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
});

export default router;

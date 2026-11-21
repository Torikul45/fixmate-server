
import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

const seedAdmin = async () => {
  try {
    await client.connect();

    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("user");

    const adminEmail = process.argv[2];

    if (!adminEmail) {
      console.log("Please provide admin email.");
      return;
    }

    const result = await usersCollection.updateOne(
      { email: adminEmail },
      {
        $set: {
          role: "admin",
        },
      },
    );

    if (result.matchedCount === 0) {
      console.log("User not found. Please sign up first.");
      return;
    }

    console.log("Admin role assigned successfully!");
  } catch (error) {
    console.error("Admin seeding failed:", error.message);
  } finally {
    await client.close();
  }
};

seedAdmin();

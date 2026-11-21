import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import createPaymentIndexes from "./paymentIndexes.js";

dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

const connectDB = async () => {
  try {
    await client.connect();

    db = client.db(process.env.DB_NAME);

    await createPaymentIndexes(db);

    console.log("MongoDB Database Connected!");

    return db;
  } catch (error) {
    console.error("Database Connection Error:", error.message);
    throw error;
  }
};

const getDB = () => db;
const getClient = () => client;

export { connectDB, getDB, getClient };

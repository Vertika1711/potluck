import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import cors from "cors";
import listingRoutes from "./routes/listings.js";

// Reads the .env file and loads its values into process.env,
// so we can access things like MONGODB_URI in the code below
dotenv.config();

const app = express();

// Allows the frontend (running on a different port) to make requests to this backend.
// Without this, the browser blocks the requests before they even arrive here.
app.use(cors());

const PORT = 5000;

// Pull the connection string out of the environment instead of hardcoding it here —
// this is what keeps the real credentials out of the code (and out of GitHub)
const MONGODB_URI = process.env.MONGODB_URI as string;

// Lets Express automatically parse incoming JSON request bodies
// (needed for the frontend to send signup/login data as JSON)
app.use(express.json());

// A simple test route — confirms the server is alive and responding
app.get("/", (req, res) => {
  res.send("Potluck backend is running.");
});

// Every route inside auth.ts becomes reachable under /api/auth/...
// so the signup route becomes: POST /api/auth/signup
app.use("/api/auth", authRoutes);

app.use("/api/listings", listingRoutes);

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

startServer();
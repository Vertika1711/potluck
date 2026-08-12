import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Reads the .env file and loads its values into process.env,
// so we can access things like MONGODB_URI in the code below
dotenv.config();

const app = express();
const PORT = 5000;

// Pull the connection string out of the environment instead of hardcoding it here —
// this is what keeps the real credentials out of the code (and out of GitHub)
const MONGODB_URI = process.env.MONGODB_URI as string;

// A simple test route — confirms the server is alive and responding
app.get("/", (req, res) => {
  res.send("Potluck backend is running.");
});

// Wrapped in an async function so we can "await" the database connection
// before the server starts accepting requests
async function startServer() {
  try {
    // Try connecting to MongoDB Atlas first
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB Atlas");

    // Only start listening for requests once the database connection succeeds —
    // this avoids the server appearing "up" while actually being broken
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    // If the connection fails, log a clear error and stop the process
    // instead of running silently broken
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

startServer();
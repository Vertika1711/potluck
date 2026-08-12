import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// POST /api/auth/signup — creates a new user account
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation — make sure the required fields actually arrived
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required." });
    }

    // Check if someone already signed up with this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Hash the password — 10 is the "salt rounds," a standard, safe default
    const passwordHash = await bcrypt.hash(password, 10);

    // Create and save the new user in MongoDB
    const user = await User.create({ name, email, passwordHash });

    // Respond without ever sending the password hash back
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Something went wrong during signup." });
  }
});

export default router;
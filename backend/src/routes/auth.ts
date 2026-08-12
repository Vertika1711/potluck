import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

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

// POST /api/auth/login — verifies credentials and returns a JWT token
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Deliberately vague error — don't reveal whether the email exists or not
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare the submitted password against the stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Create a signed token containing the user's ID, valid for 7 days
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Something went wrong during login." });
  }
});

// GET /api/auth/me — returns the currently logged-in user's info.
// requireAuth runs first: if the token is missing or invalid, this route never even runs.
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    // .select("-passwordHash") tells Mongoose "give me everything about this user
    // except the password hash" — an extra safety layer so it's structurally
    // impossible to accidentally leak it here
    const user = await User.findById(req.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
});

export default router;
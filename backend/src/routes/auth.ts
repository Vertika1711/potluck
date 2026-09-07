import { validatePassword } from "../utils/validatePassword.js";
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import crypto from "crypto";
import { Resend } from "resend";

const router = express.Router();

// UPDATED: NOT created here at module load time. In an ES module
// ("type": "module" in package.json), import statements are resolved
// and run BEFORE any other code in the importING file -- meaning this
// file's top-level code runs before server.ts even reaches its
// dotenv.config() line. Creating the Resend client here would run
// before RESEND_API_KEY exists in process.env at all, causing
// "Missing API key" even with a perfectly correct .env file. Moved
// inside the route handler below instead, so it's only created once an
// actual request comes in -- long after dotenv.config() has already run.

// POST /api/auth/signup — creates a new user account
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation — make sure the required fields actually arrived
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required." });
    }

    // NEW: enforce the password policy -- min 8 chars, at least one
    // letter, one digit, one special character.
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
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

// POST /api/auth/forgot-password — starts a password reset. Takes an
// email, and IF an account exists for it, generates a secure random
// token + 1-hour expiry, saves it on that user, and emails a real
// reset link via Resend.
//
// UPDATED: previously returned resetLink directly in the API response
// (dev-mode only, since no real email service was wired up yet -- see
// decisions-log.md #22). Now that Resend is connected, a real email is
// sent instead, and resetLink is no longer included in the response at
// all -- exactly the change decisions-log #22 flagged as needed "once
// real users with real inboxes exist."
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ email });

    // Deliberately vague response either way -- same email-enumeration
    // protection principle as login's error message. We don't want an
    // attacker to be able to tell which emails have accounts just by
    // trying this route.
    const genericMessage = "If an account exists for this email, a password reset link has been sent.";

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    // crypto.randomBytes generates genuinely unpredictable bytes --
    // NOT something homemade like Math.random(), which is not
    // cryptographically secure and shouldn't be used for anything
    // security-sensitive like a reset token.
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    await user.save();

    // FRONTEND_URL is the same "one config value, different per
    // environment" pattern as the frontend's own API_URL -- locally
    // this is http://localhost:5173, and on Render it's set to the
    // real deployed Vercel URL, so this link is always correct
    // regardless of where the backend is running.
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // NEW: Resend client created HERE, not at the top of the file --
    // see the comment near the top imports for why. By this point,
    // dotenv.config() has definitely already run, so
    // process.env.RESEND_API_KEY is guaranteed to be available.
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Wrapped in its own try/catch, separate from the outer one --
    // same graceful-degradation principle used for the AI tagging/
    // matching calls (decisions-log #66's notification writes follow
    // this too). If Resend's API has a hiccup, the user still gets a
    // normal-looking success response (so we don't leak whether their
    // email exists), and the real error is logged server-side for us
    // to notice, rather than the whole request failing with a 500.
    try {
      await resend.emails.send({
        from: "Potluck <onboarding@resend.dev>",
        to: email,
        subject: "Reset your Potluck password",
        html: `
          <p>Someone requested a password reset for your Potluck account.</p>
          <p><a href="${resetLink}">Click here to reset your password</a></p>
          <p>This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Something went wrong processing your request." });
  }
});

// POST /api/auth/reset-password — completes a password reset. Takes
// the token from the reset link's URL plus a new password.
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required." });
    }

    // $gt: Date.now() means "expires-at is still in the FUTURE" --
    // i.e. this token hasn't expired yet. Mongo can compare directly
    // against the stored Date field this way.
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);

    // Clear the token fields -- this is what makes the link a genuine
    // ONE-TIME use. Without this, the same link could reset the
    // password again and again until it naturally expired.
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Something went wrong resetting your password." });
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
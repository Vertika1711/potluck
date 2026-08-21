import { Router } from "express";
import Listing from "../models/Listing.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import OpenAI from "openai";

// Groq is OpenAI-compatible, so we use the OpenAI SDK but point it
// at Groq's servers instead of OpenAI's, using our Groq key.

// Creates the Groq client only when actually called (inside a route handler),
// not at import time -- this avoids a startup crash where process.env
// isn't populated yet because dotenv.config() hasn't run before this
// file gets imported by server.ts.
function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// Express router — same pattern as auth.ts. This groups all
// listing-related routes together, then gets mounted onto the
// main app in server.ts (we'll do that step after this).
const router = Router();

// POST /api/listings — create a new listing.
// requireAuth runs FIRST, before this handler function even starts.
// If there's no valid token, requireAuth already sent a 401 response
// and this code never runs at all.
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, type, skillTags } = req.body;

    // Basic validation — required fields must actually be present.
    // (Zod will replace this with cleaner validation later in the
    // brief's tech stack, but plain checks work fine for now.)
    if (!title || !description || !type) {
      return res.status(400).json({ error: "Title, description, and type are required." });
    }

    if (type !== "offer" && type !== "want") {
      return res.status(400).json({ error: "Type must be either 'offer' or 'want'." });
    }

    // req.userId was attached by requireAuth middleware — this is
    // how the listing knows WHO created it, without the user having
    // to send their own ID (which they could fake/tamper with).
    const listing = await Listing.create({
      userId: req.userId,
      title,
      description,
      type,
      skillTags: skillTags || [], // defaults to empty array if not provided
    });

    res.status(201).json(listing);
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ error: "Something went wrong creating the listing." });
  }
});

// POST /api/listings/suggest-tags — takes free text and returns
// AI-suggested skill tags. This does NOT create a listing -- it's a
// separate step the frontend calls first, so the user can review/edit
// suggestions before the real listing gets created.
router.post("/suggest-tags", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    const completion = await getGroqClient().chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          // This system prompt is doing the real work -- it tells the AI
          // EXACTLY what format to respond in, so we can reliably parse it.
          content:
            "You extract skill tags from a user's goal or offer description. " +
            "Respond with ONLY a JSON array of short, lowercase skill tag strings. " +
            'Example: ["html", "css", "javascript", "web hosting"]. ' +
            "No explanation, no markdown, just the raw JSON array.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.3, // lower temperature = more consistent, less "creative" output
    });

    const raw = completion.choices[0].message.content || "[]";

    // The AI might still wrap its answer in markdown code fences
    // (```json ... ```) even when told not to -- this strips that off
    // before we try to parse it as real JSON.
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const tags = JSON.parse(cleaned);

    res.status(200).json({ tags });
  } catch (error) {
    // If the Groq API fails, times out, or returns something we can't
    // parse, we DON'T break the whole request -- we return an empty
    // array so the frontend can fall back to manual tagging.
    console.error("AI tag suggestion error:", error);
    res.status(200).json({ tags: [], aiFailed: true });
  }
});

// GET /api/listings — browse all active listings.
// No requireAuth here — anyone can browse without logging in,
// same as browsing a marketplace before creating an account.
router.get("/", async (req, res) => {
  try {
    // Only show active listings — closed ones (already swapped away,
    // or taken down by the user) shouldn't clutter the browse view.
    const listings = await Listing.find({ status: "active" }).sort({ createdAt: -1 });
    // sort by createdAt descending -> newest listings appear first

    res.status(200).json(listings);
  } catch (error) {
    console.error("Fetch listings error:", error);
    res.status(500).json({ error: "Something went wrong fetching listings." });
  }
});

// PUT /api/listings/:id — edit an existing listing.
// requireAuth confirms someone is logged in, but we ALSO need to check
// that the logged-in user actually OWNS this listing — otherwise any
// logged-in user could edit anyone else's listings just by knowing the ID.
router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found." });
    }

    // listing.userId is stored as a MongoDB ObjectId, req.userId is a string
    // (from the JWT) -- .toString() makes sure we're comparing like with like,
    // otherwise this comparison would always be false even for the real owner.
    if (listing.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "You can only edit your own listings." });
    }

    // Only update fields that were actually provided in the request body,
    // so a partial edit (e.g. just changing the title) doesn't accidentally
    // wipe out the other fields.
    const { title, description, type, skillTags, status } = req.body;
    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (type !== undefined) listing.type = type;
    if (skillTags !== undefined) listing.skillTags = skillTags;
    if (status !== undefined) listing.status = status;

    await listing.save();
    res.status(200).json(listing);
  } catch (error) {
    console.error("Update listing error:", error);
    res.status(500).json({ error: "Something went wrong updating the listing." });
  }
});

// DELETE /api/listings/:id — delete a listing.
// Same ownership check as PUT: must be logged in AND be the owner.
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found." });
    }

    if (listing.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "You can only delete your own listings." });
    }

    await listing.deleteOne();
    res.status(200).json({ message: "Listing deleted successfully." });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({ error: "Something went wrong deleting the listing." });
  }
});

export default router;
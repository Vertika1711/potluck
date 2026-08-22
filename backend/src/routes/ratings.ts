import { Router } from "express";
import Rating from "../models/Rating.js";
import Swap from "../models/Swap.js";
import User from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// POST /api/ratings — leave a rating (and optional comment) on a
// completed swap. Either participant can rate the OTHER person --
// never themselves, and only once per swap per rater.
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { swapId, score, comment } = req.body;

    if (!swapId || score === undefined) {
      return res.status(400).json({ error: "swapId and score are required." });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ error: "score must be between 1 and 5." });
    }

    const swap = await Swap.findById(swapId);

    if (!swap) {
      return res.status(404).json({ error: "Swap not found." });
    }

    // Only COMPLETED swaps can be rated -- rating a pending or
    // accepted-but-not-yet-completed swap doesn't make sense, since
    // the exchange hasn't actually happened yet.
    if (swap.status !== "completed") {
      return res.status(400).json({ error: "Only completed swaps can be rated." });
    }

    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    // Must be one of the two people actually involved in this swap.
    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "You are not part of this swap." });
    }

    // Figures out WHO is being rated -- automatically the "other"
    // person in the swap, never the rater themselves. This is derived
    // server-side, not trusted from the request body, same principle
    // as receiverId in swaps.ts.
    const ratedUserId = isRequester ? swap.receiverId : swap.requesterId;

    // Prevents rating the same swap twice -- one rating per rater per swap.
    const existingRating = await Rating.findOne({ swapId, raterId: req.userId });
    if (existingRating) {
      return res.status(400).json({ error: "You have already rated this swap." });
    }

    const rating = await Rating.create({
      swapId,
      raterId: req.userId,
      ratedUserId,
      score,
      comment: comment || undefined, // stays unset if not provided, rather than an empty string
    });

    // Recalculates and caches the rated user's trust score right after
    // a new rating comes in -- per Section 7.3 of the brief, this is
    // cached on the User document, NOT computed live on every profile
    // view (which would be far more expensive since profiles are
    // viewed much more often than ratings are submitted).
    const allRatingsForUser = await Rating.find({ ratedUserId });
    const averageScore =
      allRatingsForUser.reduce((sum, r) => sum + r.score, 0) / allRatingsForUser.length;

    await User.findByIdAndUpdate(ratedUserId, { trustScore: averageScore });

    res.status(201).json(rating);
  } catch (error) {
    console.error("Create rating error:", error);
    res.status(500).json({ error: "Something went wrong submitting the rating." });
  }
});

// GET /api/ratings/mine — returns all ratings the logged-in user has
// GIVEN (not received). Used by the frontend to know, upfront, which
// completed swaps they've already rated, so the "Rate this exchange"
// button can be correctly hidden from the first render, not just
// after a same-session submission.
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myRatings = await Rating.find({ raterId: req.userId });
    res.status(200).json(myRatings);
  } catch (error) {
    console.error("Fetch my ratings error:", error);
    res.status(500).json({ error: "Something went wrong fetching your ratings." });
  }
});

// GET /api/ratings/user/:userId — fetch all ratings ABOUT a specific
// user (their reviews), sortable by most recent (default) or most
// helpful. Public -- no login needed to read reviews, same as
// browsing listings.
router.get("/user/:userId", async (req, res) => {
  try {
    const sort = req.query.sort === "helpful" ? "helpful" : "recent";

    const ratings = await Rating.find({ ratedUserId: req.params.userId }).populate(
      "raterId",
      "name"
    );
    // .populate("raterId", "name") -- same technique as listings.ts's
    // single-listing route -- shows WHO left each review by name,
    // without exposing their email or other private fields.

    if (sort === "helpful") {
      // Most helpful first -- more helpfulUserIds entries = ranked higher.
      ratings.sort((a, b) => b.helpfulUserIds.length - a.helpfulUserIds.length);
    } else {
      // Most recent first -- the default.
      ratings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    res.status(200).json(ratings);
  } catch (error) {
    console.error("Fetch ratings error:", error);
    res.status(500).json({ error: "Something went wrong fetching ratings." });
  }
});

// PUT /api/ratings/:id/helpful — toggle the logged-in user's "helpful"
// vote on a rating. If they've already voted, this REMOVES their vote
// (acts as the "undo" / thumbs-down action); if they haven't, it ADDS
// their vote.
router.put("/:id/helpful", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rating = await Rating.findById(req.params.id);

    if (!rating) {
      return res.status(404).json({ error: "Rating not found." });
    }

    // Blocks the person the review is ABOUT from voting on their own
    // review -- prevents an obvious self-inflation abuse vector.
    if (rating.ratedUserId.toString() === req.userId) {
      return res.status(403).json({ error: "You can't mark a review about yourself as helpful." });
    }

    const alreadyVoted = rating.helpfulUserIds.some((id) => id.toString() === req.userId);

    if (alreadyVoted) {
      // Remove their vote -- this is the "thumbs down" / undo action.
      rating.helpfulUserIds = rating.helpfulUserIds.filter(
        (id) => id.toString() !== req.userId
      );
    } else {
      // Add their vote -- "thumbs up".
      rating.helpfulUserIds.push(req.userId as any);
    }

    await rating.save();
    res.status(200).json(rating);
  } catch (error) {
    console.error("Toggle helpful vote error:", error);
    res.status(500).json({ error: "Something went wrong updating this vote." });
  }
});

export default router;
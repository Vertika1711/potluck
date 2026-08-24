import { Router } from "express";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Swap from "../models/Swap.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/users/:id/profile
// Returns PUBLIC-safe fields only for any user -- name, trustScore,
// completed-swap count, joined date, and their active listings.
// Deliberately does NOT include email or phone: those are private,
// and only ever shared with an actual swap participant via the
// separate GET /api/swaps/:id/contact route (see decisions-log.md #14).
//
// Note: no requireAuth here -- a public profile is meant to be
// viewable by anyone, logged in or not (unlike /api/auth/me, which
// is the private "your own full data" route and stays protected).
router.get("/:id/profile", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Completed-swap count isn't stored directly on the User document --
    // it's derived by counting Swap records where this user was EITHER
    // side (requester or receiver) and the status is "completed".
    // $or matches either field, since a completed swap could have this
    // user as the requester in one exchange and the receiver in another.
    const completedSwapCount = await Swap.countDocuments({
      status: "completed",
      $or: [{ requesterId: user._id }, { receiverId: user._id }],
    });

    // Only this user's currently-active listings show up on their
    // public profile -- closed listings stay hidden here too, same
    // as they're already hidden from Browse/Suggested (decisions-log.md #9).
    const activeListings = await Listing.find({
      userId: user._id,
      status: "active",
    });

    res.status(200).json({
      name: user.name,
      trustScore: user.trustScore,
      completedSwapCount,
      joinedAt: user.createdAt,
      activeListings,
    });
  } catch (error) {
    console.error("Fetch public profile error:", error);
    res.status(500).json({ error: "Something went wrong fetching this profile." });
  }
});

// PUT /api/users/me
// Lets the LOGGED-IN user update their own profile fields.
// Deliberately uses req.userId (from the JWT, via requireAuth) to
// decide WHOSE profile to update -- never an ID from the request body,
// since that would let any logged-in user edit someone else's profile
// just by passing a different id.
router.put("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, skillsOffered, skillsWanted, phone, phoneVisible } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Each field is only updated if it was actually included in the
    // request body -- this makes it a genuine PARTIAL update (e.g.
    // sending just { phoneVisible: true } doesn't wipe out name or
    // skills), rather than requiring the frontend to always resend
    // every field just to change one.
    if (name !== undefined) user.name = name;
    if (skillsOffered !== undefined) user.skillsOffered = skillsOffered;
    if (skillsWanted !== undefined) user.skillsWanted = skillsWanted;
    if (phone !== undefined) user.phone = phone;
    if (phoneVisible !== undefined) user.phoneVisible = phoneVisible;

    await user.save();

    // Re-fetch with .select("-passwordHash") to exclude the hash from
    // the response -- same safeguard pattern as GET /me in auth.ts,
    // kept consistent rather than using a different technique here.
    const safeUser = await User.findById(user._id).select("-passwordHash");
    res.status(200).json(safeUser);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Something went wrong updating your profile." });
  }
});

// GET /api/users/search?q=...
// Searches users by name, case-insensitive partial match -- e.g.
// "test" matches "Test User" and "Test User Two" alike.
// Public, same as the profile route -- searching for a user to swap
// with doesn't require being logged in, only sending a request does.
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q as string;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "A search query 'q' is required." });
    }

    // $regex with 'i' flag = case-insensitive partial match, same idea
    // as SQL's LIKE '%q%'. This is a simple approach -- fine for a
    // small community-scale user base (per the brief's own honest
    // limitations in Section 11), but wouldn't scale well to a huge
    // user base without a dedicated search index (e.g. MongoDB Atlas
    // Search or Elasticsearch) -- worth knowing as a limitation, not
    // hiding it.
    const users = await User.find({
      name: { $regex: q, $options: "i" },
    }).select("name trustScore createdAt");

    res.status(200).json(users);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Something went wrong searching for users." });
  }
});

// GET /api/users/me/stats
// Aggregation endpoint for the Personal Dashboard -- computes swap
// status breakdown, taught-vs-learned counts, and month-by-month
// completed-swap data for the activity chart. Everything is computed
// live here rather than cached, since this is a low-traffic route
// (visited far less often than, say, a profile view) -- unlike
// trustScore, which IS cached because profiles are viewed constantly.
router.get("/me/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myId = req.userId;
    const user = await User.findById(myId).select("name createdAt");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Every swap I've ever been part of, either side.
    const allMySwaps = await Swap.find({
      $or: [{ requesterId: myId }, { receiverId: myId }],
    });

    // Status breakdown -- counts across BOTH directions, per status.
    const pendingCount = allMySwaps.filter((s) => s.status === "pending").length;
    const acceptedCount = allMySwaps.filter((s) => s.status === "accepted").length;
    const rejectedCount = allMySwaps.filter((s) => s.status === "rejected").length;
    const cancelledCount = allMySwaps.filter((s) => s.status === "cancelled").length;
    const completedCount = allMySwaps.filter((s) => s.status === "completed").length;

    // "Requested" is a DIFFERENT slice -- specifically swaps where I was
    // the one who sent the request, regardless of what happened to it.
    // Not a status value itself, so counted separately from the block above.
    const requestedCount = allMySwaps.filter(
      (s) => s.requesterId.toString() === myId
    ).length;

    // Taught vs. learned -- only meaningful for COMPLETED swaps, and
    // needs each swap's listing type, so we populate listingId here.
    const completedSwaps = await Swap.find({
      $or: [{ requesterId: myId }, { receiverId: myId }],
      status: "completed",
    }).populate("listingId", "type");

    let taughtCount = 0;
    let learnedCount = 0;

    for (const swap of completedSwaps) {
      const listing = swap.listingId as any; // populated -- has a "type" field
      const isRequester = swap.requesterId.toString() === myId;

      // offer + I'm the receiver (it's MY listing, I'm providing the
      // skill) = I taught. offer + I'm the requester (someone else's
      // listing, I'm the one reaching out for it) = I learned.
      // want is the mirror image of this.
      if (listing.type === "offer") {
        if (isRequester) learnedCount++;
        else taughtCount++;
      } else {
        // type === "want"
        if (isRequester) taughtCount++;
        else learnedCount++;
      }
    }

    // Swaps-over-time -- group completed swaps by month (YYYY-MM), for
    // the activity chart. Only completed swaps have a completedAt date.
    const swapsByMonth: Record<string, number> = {};
    for (const swap of completedSwaps) {
      if (!swap.completedAt) continue; // shouldn't happen for a completed swap, but a safe guard
      const monthKey = swap.completedAt.toISOString().slice(0, 7); // "2026-08"
      swapsByMonth[monthKey] = (swapsByMonth[monthKey] || 0) + 1;
    }

    // Convert to a sorted array -- easier for Recharts to consume than
    // an object, and sorted so the chart reads chronologically.
    const swapsOverTime = Object.entries(swapsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.status(200).json({
      name: user.name,
      joinedAt: user.createdAt,
      completedCount,
      requestedCount,
      pendingCount,
      acceptedCount,
      rejectedCount,
      cancelledCount,
      taughtCount,
      learnedCount,
      swapsOverTime,
    });
  } catch (error) {
    console.error("Fetch dashboard stats error:", error);
    res.status(500).json({ error: "Something went wrong fetching your stats." });
  }
});

export default router;
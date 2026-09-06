import { Router } from "express";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Swap from "../models/Swap.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

// NEW: how many predefined avatars exist -- kept in sync manually with
// the frontend's AVATARS array length (utils/avatar.ts). Used here only
// to validate an incoming avatarId is actually in range, so a bad value
// can't get saved even though the Mongoose schema also enforces
// min/max as a second layer of defense.
const AVATAR_COUNT = 18;

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
      // NEW: included so PublicProfile.tsx can render the same avatar
      // logic (chosen, or fall back to the deterministic default) that
      // Profile.tsx uses for the account owner's own view. Undefined
      // is a valid value here -- the frontend's getAvatarSrc() already
      // handles "no avatarId set" by falling back to the hash-based
      // default, so nothing extra is needed on this end.
      avatarId: user.avatarId,
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
    const { name, skillsOffered, skillsWanted, phone, phoneVisible, avatarId } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // NEW: validate avatarId is actually a real avatar index BEFORE
    // touching the user document -- same "fail fast, before any save"
    // principle as the rest of this route's fields, even though the
    // Mongoose schema's min/max would also catch this on .save().
    // Checking explicitly here lets us return a clearer error message
    // than a generic Mongoose validation error would.
    if (avatarId !== undefined && (avatarId < 0 || avatarId >= AVATAR_COUNT)) {
      return res.status(400).json({ error: "Invalid avatar selection." });
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
    if (avatarId !== undefined) user.avatarId = avatarId;

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

// DELETE /api/users/me — permanently deletes the logged-in user's
// account. Requires re-entering the current password first, since
// this is irreversible.
//
// What happens to related data:
// - Any of my PENDING or ACCEPTED swaps get CANCELLED (not deleted) --
//   this keeps the swap visible in the other participant's history,
//   rather than silently vanishing or leaving them stuck with a
//   request that can never be responded to.
// - My own listings are deleted entirely.
// - COMPLETED/REJECTED/CANCELLED swaps and ALL ratings (given or
//   received) are left completely untouched -- this is deliberate:
//   someone else's swap/review history shouldn't disappear just
//   because I later delete my account. Their view of that history is
//   preserved permanently; only my ability to log in and manage my
//   own data goes away.
router.delete("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete your account." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Cancel any swaps still awaiting action, in EITHER direction --
    // otherwise the other participant would be left with a request
    // that can never be accepted/rejected/completed.
    await Swap.updateMany(
      {
        $or: [{ requesterId: user._id }, { receiverId: user._id }],
        status: { $in: ["pending", "accepted"] },
      },
      { status: "cancelled" }
    );

    // Delete all of my own listings.
    await Listing.deleteMany({ userId: user._id });

    // Finally, delete the account itself. Everything else (completed
    // swaps, ratings) stays in place, referencing a user that no
    // longer exists -- the frontend handles this gracefully by
    // showing "Deleted User" wherever that name would have appeared.
    await User.findByIdAndDelete(user._id);

    res.status(200).json({ message: "Your account has been permanently deleted." });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Something went wrong deleting your account." });
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
    // NEW: avatarId included so Explore's People tab shows each
    // person's ACTUAL chosen avatar (or the correct deterministic
    // fallback, computed client-side from their real _id) -- without
    // this, search results would show a generic default that could
    // mismatch what's shown on that same person's own profile.
    const users = await User.find({
      name: { $regex: q, $options: "i" },
    }).select("name trustScore createdAt avatarId");

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

    // Requests-sent-over-time -- group EVERY swap I originally
    // requested (any status, not just completed) by the month it was
    // CREATED. Tracks when I reached OUT to people, regardless of how
    // those requests were eventually resolved.
    const requestsSentByMonth: Record<string, number> = {};
    for (const swap of allMySwaps) {
      if (swap.requesterId.toString() !== myId) continue; // only swaps I sent
      const monthKey = swap.createdAt.toISOString().slice(0, 7);
      requestsSentByMonth[monthKey] = (requestsSentByMonth[monthKey] || 0) + 1;
    }

    // NEW: requests-received-over-time -- the mirror image of the above,
    // grouping swaps where I was the RECEIVER (someone else reached out
    // to ME) by the month they were created. Together with requests
    // sent, this gives a fuller "engagement" picture -- how much
    // activity is flowing in each direction, not just how proactive I've been.
    const requestsReceivedByMonth: Record<string, number> = {};
    for (const swap of allMySwaps) {
      if (swap.receiverId.toString() !== myId) continue; // only swaps sent TO me
      const monthKey = swap.createdAt.toISOString().slice(0, 7);
      requestsReceivedByMonth[monthKey] = (requestsReceivedByMonth[monthKey] || 0) + 1;
    }

    // Convert to sorted arrays -- easier for Recharts to consume than
    // an object, and sorted so the chart reads chronologically.
    const swapsOverTime = Object.entries(swapsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const requestsOverTime = Object.entries(requestsSentByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const requestsReceivedOverTime = Object.entries(requestsReceivedByMonth)
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
      requestsOverTime,
      requestsReceivedOverTime, // NEW
    });
  } catch (error) {
    console.error("Fetch dashboard stats error:", error);
    res.status(500).json({ error: "Something went wrong fetching your stats." });
  }
});

export default router;
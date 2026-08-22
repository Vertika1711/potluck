import { Router } from "express";
import Swap from "../models/Swap.js";
import Listing from "../models/Listing.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import User from "../models/User.js";

const router = Router();

// POST /api/swaps — send a swap request on a listing.
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required." });
    }

    // We need the actual listing to find out WHO owns it -- the
    // receiverId isn't something the frontend sends us directly,
    // since that could be tampered with (e.g. claiming a different
    // owner than the listing actually has).
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found." });
    }

    // Stops a user from sending a swap request to themselves --
    // doesn't make sense to "request" your own listing.
    if (listing.userId.toString() === req.userId) {
      return res.status(400).json({ error: "You can't send a swap request on your own listing." });
    }

    // Blocks sending a SECOND active request on a listing you already
    // have a pending or accepted swap on -- doesn't make sense to
    // request the same thing twice while an earlier request is still
    // "live." Rejected/completed/cancelled swaps don't count here,
    // since those are genuinely finished -- a new request afterward
    // is a legitimate new attempt, not a duplicate.
    const existingActiveSwap = await Swap.findOne({
      listingId,
      requesterId: req.userId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingActiveSwap) {
      return res.status(400).json({ error: "You already have an active request on this listing." });
    }

    const swap = await Swap.create({
      listingId,
      requesterId: req.userId, // whoever is logged in and sending this request
      receiverId: listing.userId, // the listing's actual owner, looked up above
      // status defaults to "pending" automatically, per the schema
    });

    res.status(201).json(swap);
  } catch (error) {
    console.error("Create swap error:", error);
    res.status(500).json({ error: "Something went wrong sending the swap request." });
  }
});

// GET /api/swaps/mine — returns all swaps where the logged-in user
// is EITHER the requester or the receiver, split into two groups so
// the frontend can show "Incoming" and "Outgoing" sections separately.
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Incoming: swaps where I'm the receiver -- these are requests
    // OTHER people sent me, about MY listings.
    const incoming = await Swap.find({ receiverId: req.userId }).sort({ createdAt: -1 });

    // Outgoing: swaps where I'm the requester -- these are requests
    // I sent to OTHER people, about THEIR listings.
    const outgoing = await Swap.find({ requesterId: req.userId }).sort({ createdAt: -1 });

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error("Fetch swaps error:", error);
    res.status(500).json({ error: "Something went wrong fetching your swaps." });
  }
});

// PUT /api/swaps/:id/respond — accept or reject a pending swap request.
// Only the RECEIVER (the listing owner who got the request) can do this --
// not the requester, and not some unrelated third user.
router.put("/:id/respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body; // expected to be "accept" or "reject"

    if (action !== "accept" && action !== "reject") {
      return res.status(400).json({ error: "action must be 'accept' or 'reject'." });
    }

    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    // Only the receiver can accept/reject -- the requester doesn't get
    // to decide the outcome of their own request, and no unrelated
    // user should be able to touch this swap at all.
    if (swap.receiverId.toString() !== req.userId) {
      return res.status(403).json({ error: "Only the listing owner can respond to this request." });
    }

    // Prevents responding to a swap that's already been decided --
    // e.g. accepting something that was already rejected, or accepting
    // twice. Once it leaves "pending", it's locked from this action.
    if (swap.status !== "pending") {
      return res.status(400).json({ error: `This request has already been ${swap.status}.` });
    }

    swap.status = action === "accept" ? "accepted" : "rejected";
    await swap.save();

    res.status(200).json(swap);
  } catch (error) {
    console.error("Respond to swap error:", error);
    res.status(500).json({ error: "Something went wrong responding to the swap request." });
  }
});

// PUT /api/swaps/:id/complete — mark an accepted swap as completed.
// Per the brief: "Either party marks the swap complete" -- so unlike
// respond (receiver-only), BOTH the requester and receiver are allowed
// to do this, since either side of the exchange could be the one to
// confirm it actually happened.
router.put("/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    // Must be ONE of the two people involved in this swap -- not
    // some unrelated third user who happens to know the swap's ID.
    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "You are not part of this swap." });
    }

    // Can only complete a swap that's currently accepted -- doesn't
    // make sense to "complete" something still pending, or something
    // already rejected/cancelled/completed.
    if (swap.status !== "accepted") {
      return res.status(400).json({ error: `Only accepted swaps can be marked complete. This swap is currently ${swap.status}.` });
    }

    swap.status = "completed";
    swap.completedAt = new Date(); // records exactly when this happened
    await swap.save();

    res.status(200).json(swap);
  } catch (error) {
    console.error("Complete swap error:", error);
    res.status(500).json({ error: "Something went wrong completing the swap." });
  }
});

// PUT /api/swaps/:id/cancel — cancel an accepted swap before completion.
// Per decisions-log.md #1: represents a swap that was accepted, but
// called off before the exchange actually happened. Either participant
// can cancel, same reasoning as complete -- either side might be the
// one backing out.
router.put("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "You are not part of this swap." });
    }

    // Only an ACCEPTED swap can be cancelled -- a pending one should be
    // rejected instead (different action, different meaning), and a
    // completed/already-cancelled/rejected swap can't be cancelled again.
    if (swap.status !== "accepted") {
      return res.status(400).json({ error: `Only accepted swaps can be cancelled. This swap is currently ${swap.status}.` });
    }

    swap.status = "cancelled";
    await swap.save();

    res.status(200).json(swap);
  } catch (error) {
    console.error("Cancel swap error:", error);
    res.status(500).json({ error: "Something went wrong cancelling the swap." });
  }
});

// GET /api/swaps/:id/contact
// Returns the other swap participant's contact info — but only if:
// - you're actually one of the two people in this swap (not a random user guessing IDs)
// - the swap has been accepted (or completed) — contact info stays hidden while still pending
router.get("/:id/contact", requireAuth, async (req: AuthRequest, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap not found" });
    }

    // req.userId is a string (from the JWT), but requesterId/receiverId are
    // Mongoose ObjectIds — .toString() makes sure we're comparing like-for-like
    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      // Deliberately vague — same principle as the login error (see project-history.md):
      // don't reveal whether the swap exists to someone who isn't part of it
      return res.status(403).json({ error: "Not authorized to view this swap's contact info" });
    }

    if (swap.status !== "accepted" && swap.status !== "completed") {
      return res.status(400).json({ error: "Contact info is only available after a swap is accepted" });
    }

    // Whichever side I'm on, "the other person" is the opposite field
    const otherUserId = isRequester ? swap.receiverId : swap.requesterId;

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Email is always shared once a swap is accepted — it's mandatory at signup.
    // Phone is only included if the user has explicitly opted in via phoneVisible.
    const contactInfo = {
      name: otherUser.name,
      email: otherUser.email,
      phone: otherUser.phoneVisible ? otherUser.phone : undefined,
    };

    res.json(contactInfo);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching contact info" });
  }
});

export default router;
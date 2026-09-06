import { Router } from "express";
import type { HydratedDocument } from "mongoose";
import Swap, { ISwap } from "../models/Swap.js";
import Listing from "../models/Listing.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import User from "../models/User.js";
import { createNotification } from "../utils/notifications.js";

const router = Router();

// Every status that counts as "still unfinished" for the purposes of
// (a) blocking a duplicate request on the same listing, and (b) being
// eligible for the 7-day auto-expiry check below. "accepted" is
// deliberately NOT included in either list -- once both sides have
// agreed, the actual exchange happens off-platform on its own timeline
// (per the brief's Section 10), so there's no "waiting on one specific
// action" clock to run out.
// Typed explicitly against ISwap["status"] (not left as a plain
// string[]) so it lines up with Mongoose's stricter typing for the
// $in queries below -- without this, TypeScript can't confirm every
// element is actually a valid status value.
// UPDATED: exported (was module-private) -- notifications.ts needs
// this exact same list to compute expiry reminders consistently,
// rather than maintaining a second, potentially-drifting copy.
export const UNFINISHED_STATUSES: ISwap["status"][] = ["pending", "pending_share", "pending_pick", "pending_confirmation"];
export const EXPIRY_DAYS = 7;

// Checks whether a swap has been sitting in one of the UNFINISHED_STATUSES
// for longer than EXPIRY_DAYS since its CURRENT status started (not since
// it was originally created) -- each step gets its own fresh window. If
// it's overdue, flips it to "rejected" and saves that change immediately,
// so the database reflects the real state going forward rather than this
// being computed fresh on every read. Called at the top of every route
// that fetches a swap by ID, so an expired swap can never be acted on.
//
// Typed as HydratedDocument<ISwap>, not plain ISwap -- Swap.findById()
// actually returns a full Mongoose document (with .save(), __v, etc.),
// which a plain ISwap interface doesn't describe. Using the wrong type
// here was what caused the "swap is possibly null" errors elsewhere:
// TypeScript couldn't confirm the reassignment (`swap = await
// expireIfOverdue(swap)`) preserved the same real document type, so it
// lost track of the earlier null-check narrowing.
//
// UPDATED: exported -- notifications.ts reuses this exact check when
// computing expiry reminders, so a swap that's already expired never
// also generates a misleading "expires soon" reminder.
export async function expireIfOverdue(swap: HydratedDocument<ISwap>): Promise<HydratedDocument<ISwap>> {
  if (!UNFINISHED_STATUSES.includes(swap.status)) {
    return swap; // already resolved one way or another, nothing to check
  }

  const msSinceStatusChange = Date.now() - swap.statusUpdatedAt.getTime();
  const msInExpiryWindow = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  if (msSinceStatusChange > msInExpiryWindow) {
    swap.status = "rejected";
    swap.rejectionReason = "expired";
    swap.statusUpdatedAt = new Date();
    await swap.save();
  }

  return swap;
}

// Given a swap's current status and its listingType (which case it is),
// returns the userId of whoever needs to act next. Centralizing this
// mapping in one place means every route below can just call this
// instead of re-deriving "who's turn is it" with its own inline logic,
// which would be an easy place for the two cases (offer vs. want) to
// silently drift out of sync with each other over time.
//
// UPDATED: exported -- notifications.ts uses this to check "is it MY
// turn on this swap" when computing expiry reminders, and the swap
// routes below use it to figure out WHO to send a "your_turn"
// notification to.
export function actingUserId(swap: HydratedDocument<ISwap>): string {
  const requester = swap.requesterId.toString();
  const receiver = swap.receiverId.toString();

  switch (swap.status) {
    case "pending":
      // The old simple fallback flow -- always the receiver, exactly
      // like the original /respond route already worked.
      return receiver;
    case "pending_share":
      // Case A only (listingType "want"): the want-listing owner
      // (receiver) needs to share their active offer listings.
      return receiver;
    case "pending_pick":
      // Case A (want): the ORIGINAL REQUESTER picks from the receiver's
      // shared list. Case B (offer): the RECEIVER picks from the
      // requester's list, which was attached at request time.
      return swap.listingType === "want" ? requester : receiver;
    case "pending_confirmation":
      // Whoever's list just got picked from gives the final word.
      // Case A (want): that's the receiver (their list was picked from).
      // Case B (offer): that's the requester (their list was picked from).
      return swap.listingType === "want" ? receiver : requester;
    default:
      // No single "acting user" for a resolved status -- caller should
      // never reach here for accepted/rejected/completed/cancelled.
      return "";
  }
}

// POST /api/swaps — send a swap request on a listing.
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    // NEW: offeredListingIds is only meaningful for Case B (target is
    // an "offer" listing) -- the requester attaches their own active
    // offer listings right here at request time, since Case B skips
    // straight to pending_pick with no separate "share" step.
    const { listingId, offeredListingIds } = req.body;

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
    // have an unfinished swap on. UPDATED: now checks the full
    // UNFINISHED_STATUSES list, not just ["pending", "accepted"] --
    // a swap sitting mid-negotiation (pending_share/pick/confirmation)
    // is just as "live" as old-style pending was.
    const existingActiveSwap = await Swap.findOne({
      listingId,
      requesterId: req.userId,
      status: { $in: [...UNFINISHED_STATUSES, "accepted"] },
    });

    if (existingActiveSwap) {
      return res.status(400).json({ error: "You already have an active request on this listing." });
    }

    const listingType = listing.type; // "offer" or "want" -- determines which case this swap is

    let status: ISwap["status"] = "pending"; // fallback default; overwritten below if negotiation is possible
    let finalOfferedListingIds: string[] = [];

    if (listingType === "want") {
      // CASE A: the target listing is a "want" -- the requester is
      // offering to teach it. Check whether the RECEIVER (the
      // want-listing owner) has anything of their own to trade back.
      const receiverOffers = await Listing.find({
        userId: listing.userId,
        type: "offer",
        status: "active",
      });

      if (receiverOffers.length > 0) {
        // They have something to share -- start the real negotiation.
        // offeredListingIds stays empty until they actually share it
        // via PUT /:id/share.
        status = "pending_share";
      }
      // Otherwise: they have nothing to trade right now, so this stays
      // a plain "pending" fallback swap, resolved via the old simple
      // accept/reject (/respond) instead.
    } else {
      // CASE B: the target listing is an "offer" -- the requester wants
      // to learn it. The requester should have attached their own
      // active offer listings in the request body. Validate that
      // whatever was sent actually belongs to them, is really type
      // "offer", and is currently active -- never trust the client's
      // list at face value.
      if (Array.isArray(offeredListingIds) && offeredListingIds.length > 0) {
        const validOffers = await Listing.find({
          _id: { $in: offeredListingIds },
          userId: req.userId,
          type: "offer",
          status: "active",
        });

        if (validOffers.length > 0) {
          status = "pending_pick";
          finalOfferedListingIds = validOffers.map((l) => l._id.toString());
        }
        // If none of the submitted IDs were valid, falls through to
        // the "pending" fallback below -- same as sending none at all.
      }
      // Otherwise: no offer listings to attach, so this stays a plain
      // "pending" fallback swap.
    }

    const swap = await Swap.create({
      listingId,
      requesterId: req.userId,
      receiverId: listing.userId,
      listingType,
      status,
      offeredListingIds: finalOfferedListingIds,
      statusUpdatedAt: new Date(),
    });

    // NEW: notify the receiver that a new swap request has come in --
    // regardless of which case/status this swap ended up in, the
    // receiver is always the one who sees this first.
    await createNotification({
      userId: listing.userId.toString(),
      type: "new_request",
      message: `You received a new swap request for "${listing.title}".`,
      link: "/swap-requests",
      relatedSwapId: swap._id.toString(),
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
    const incomingRaw = await Swap.find({ receiverId: req.userId }).sort({ createdAt: -1 });

    // Outgoing: swaps where I'm the requester -- these are requests
    // I sent to OTHER people, about THEIR listings.
    const outgoingRaw = await Swap.find({ requesterId: req.userId }).sort({ createdAt: -1 });

    // NEW: run the lazy expiry check on every swap being returned, so
    // anything that's been sitting unfinished past its 7-day window
    // gets flipped to "rejected" (and saved) before the frontend ever
    // sees it, rather than showing a stale status.
    const incoming = await Promise.all(incomingRaw.map(expireIfOverdue));
    const outgoing = await Promise.all(outgoingRaw.map(expireIfOverdue));

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error("Fetch swaps error:", error);
    res.status(500).json({ error: "Something went wrong fetching your swaps." });
  }
});

// PUT /api/swaps/:id/respond — accept or reject a PLAIN PENDING swap
// (the fallback case, where one side had nothing to negotiate with).
// Only the RECEIVER can do this -- unchanged from before.
router.put("/:id/respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body; // expected to be "accept" or "reject"

    if (action !== "accept" && action !== "reject") {
      return res.status(400).json({ error: "action must be 'accept' or 'reject'." });
    }

    let swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    swap = await expireIfOverdue(swap);

    if (swap.receiverId.toString() !== req.userId) {
      return res.status(403).json({ error: "Only the listing owner can respond to this request." });
    }

    // This route is deliberately only for the plain "pending" fallback
    // case -- the real negotiation steps have their own routes below.
    if (swap.status !== "pending") {
      return res.status(400).json({ error: `This request has already been ${swap.status}.` });
    }

    swap.status = action === "accept" ? "accepted" : "rejected";
    if (action === "reject") swap.rejectionReason = "declined";
    swap.statusUpdatedAt = new Date();
    await swap.save();

    // NEW: notify the requester when their request is accepted --
    // covers the plain fallback flow's accept path. No notification on
    // reject here, since "rejected" already has its own visible status
    // badge/rejectionReason shown directly on the swap card, and adding
    // a notification for every possible outcome would start to dilute
    // what the bell icon is actually for (things worth actively
    // checking, not a duplicate of status the page already shows).
    if (action === "accept") {
      const acceptedListing = await Listing.findById(swap.listingId);
      await createNotification({
        userId: swap.requesterId.toString(),
        type: "swap_accepted",
        message: `Your swap request for "${acceptedListing?.title ?? "a listing"}" was accepted!`,
        link: "/swap-requests",
        relatedSwapId: swap._id.toString(),
      });
    }

    res.status(200).json(swap);
  } catch (error) {
    console.error("Respond to swap error:", error);
    res.status(500).json({ error: "Something went wrong responding to the swap request." });
  }
});

// PUT /api/swaps/:id/share — Case A only. The want-listing owner
// (receiver) shares one or more of their active offer listings, moving
// the swap from pending_share to pending_pick. Can also be used to
// simply reject at this stage instead, per the "either side can bail
// out at any point" decision.
router.put("/:id/share", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action, offeredListingIds } = req.body; // action: "share" or "reject"

    let swap = await Swap.findById(req.params.id);
    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    swap = await expireIfOverdue(swap);

    if (swap.status !== "pending_share") {
      return res.status(400).json({ error: `This request is not awaiting a shared list (currently ${swap.status}).` });
    }

    if (actingUserId(swap) !== req.userId) {
      return res.status(403).json({ error: "It's not your turn to act on this request." });
    }

    if (action === "reject") {
      swap.status = "rejected";
      swap.rejectionReason = "declined";
      swap.statusUpdatedAt = new Date();
      await swap.save();
      return res.status(200).json(swap);
    }

    if (action !== "share") {
      return res.status(400).json({ error: "action must be 'share' or 'reject'." });
    }

    // Never trust the client's list at face value -- re-validate that
    // every submitted listing genuinely belongs to this user, is type
    // "offer", and is currently active.
    if (!Array.isArray(offeredListingIds) || offeredListingIds.length === 0) {
      return res.status(400).json({ error: "Select at least one listing to share." });
    }

    const validOffers = await Listing.find({
      _id: { $in: offeredListingIds },
      userId: req.userId,
      type: "offer",
      status: "active",
    });

    if (validOffers.length === 0) {
      return res.status(400).json({ error: "None of the selected listings are valid active offer listings." });
    }

    swap.offeredListingIds = validOffers.map((l) => l._id);
    swap.status = "pending_pick";
    swap.statusUpdatedAt = new Date();
    await swap.save();

    // NEW: notify whoever needs to act next -- always the original
    // requester at this transition, since /share only ever runs for
    // Case A (listingType "want").
    const sharedListing = await Listing.findById(swap.listingId);
    await createNotification({
      userId: actingUserId(swap),
      type: "your_turn",
      message: `It's your turn to pick a listing for the "${sharedListing?.title ?? "swap"}" request.`,
      link: "/swap-requests",
      relatedSwapId: swap._id.toString(),
    });

    res.status(200).json(swap);
  } catch (error) {
    console.error("Share offer listings error:", error);
    res.status(500).json({ error: "Something went wrong sharing your offer listings." });
  }
});

// PUT /api/swaps/:id/pick — whoever's turn it is (see actingUserId)
// picks exactly one listing from swap.offeredListingIds, moving the
// swap to pending_confirmation. Can also reject at this stage instead.
router.put("/:id/pick", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action, selectedListingId } = req.body; // action: "pick", "reject", or "accept_without_pick"

    let swap = await Swap.findById(req.params.id);
    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    swap = await expireIfOverdue(swap);

    if (swap.status !== "pending_pick") {
      return res.status(400).json({ error: `This request is not awaiting a pick (currently ${swap.status}).` });
    }

    if (actingUserId(swap) !== req.userId) {
      return res.status(403).json({ error: "It's not your turn to act on this request." });
    }

    if (action === "reject") {
      swap.status = "rejected";
      swap.rejectionReason = "declined";
      swap.statusUpdatedAt = new Date();
      await swap.save();
      return res.status(200).json(swap);
    }

    // NEW: lets the picker agree to the swap WITHOUT claiming any
    // specific one of the offered listings -- e.g. they're fine
    // proceeding on some other informal basis, arranged off-platform
    // (per the brief's Section 10, the actual exchange always happens
    // off-platform anyway). Goes straight to "accepted" with
    // selectedListingId left unset, same end state the plain fallback
    // flow already produces when there was nothing to negotiate in the
    // first place -- so this doesn't introduce a new resolved shape,
    // just a new PATH to an existing one. No separate confirmation step
    // is needed here, unlike a normal pick: the picker is only giving
    // something up on their OWN behalf (not claiming from the other
    // side's offered pool), so there's nothing for the other participant
    // to additionally confirm.
    if (action === "accept_without_pick") {
      swap.status = "accepted";
      swap.statusUpdatedAt = new Date();
      await swap.save();

      // NEW: notify the OTHER participant -- whoever is NOT the one
      // who just clicked this (i.e., not req.userId), since they're
      // the one who doesn't already know this happened.
      const otherUserId =
        swap.requesterId.toString() === req.userId
          ? swap.receiverId.toString()
          : swap.requesterId.toString();
      const targetListing = await Listing.findById(swap.listingId);
      await createNotification({
        userId: otherUserId,
        type: "swap_accepted",
        message: `Your swap for "${targetListing?.title ?? "a listing"}" was accepted!`,
        link: "/swap-requests",
        relatedSwapId: swap._id.toString(),
      });

      return res.status(200).json(swap);
    }

    if (action !== "pick") {
      return res.status(400).json({ error: "action must be 'pick', 'reject', or 'accept_without_pick'." });
    }

    // The picked listing must actually be one of the ones that was
    // offered -- never trust an arbitrary listing ID from the client.
    const isValidPick = swap.offeredListingIds.some(
      (id) => id.toString() === selectedListingId
    );

    if (!isValidPick) {
      return res.status(400).json({ error: "selectedListingId must be one of the offered listings." });
    }

    swap.selectedListingId = selectedListingId;
    swap.status = "pending_confirmation";
    swap.statusUpdatedAt = new Date();
    await swap.save();

    // Notify whoever needs to give the final confirmation.
    const targetListing = await Listing.findById(swap.listingId);
    await createNotification({
      userId: actingUserId(swap),
      type: "your_turn",
      message: `A swap for "${targetListing?.title ?? "a listing"}" is awaiting your confirmation.`,
      link: "/swap-requests",
      relatedSwapId: swap._id.toString(),
    });

    res.status(200).json(swap);
  } catch (error) {
    console.error("Pick offered listing error:", error);
    res.status(500).json({ error: "Something went wrong recording your pick." });
  }
});

// PUT /api/swaps/:id/confirm — the final accept/reject once a pick
// has been made, given by whoever's list was picked from.
router.put("/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body; // "accept" or "reject"

    if (action !== "accept" && action !== "reject") {
      return res.status(400).json({ error: "action must be 'accept' or 'reject'." });
    }

    let swap = await Swap.findById(req.params.id);
    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    swap = await expireIfOverdue(swap);

    if (swap.status !== "pending_confirmation") {
      return res.status(400).json({ error: `This request is not awaiting confirmation (currently ${swap.status}).` });
    }

    if (actingUserId(swap) !== req.userId) {
      return res.status(403).json({ error: "It's not your turn to act on this request." });
    }

    swap.status = action === "accept" ? "accepted" : "rejected";
    if (action === "reject") swap.rejectionReason = "declined";
    swap.statusUpdatedAt = new Date();
    await swap.save();

    // NEW: notify the OTHER participant -- confirm's actor is whoever
    // was picked FROM, so the person who doesn't already know is the
    // one on the opposite side of actingUserId.
    if (action === "accept") {
      const otherUserId =
        swap.requesterId.toString() === req.userId
          ? swap.receiverId.toString()
          : swap.requesterId.toString();
      const targetListing = await Listing.findById(swap.listingId);
      await createNotification({
        userId: otherUserId,
        type: "swap_accepted",
        message: `Your swap for "${targetListing?.title ?? "a listing"}" was accepted!`,
        link: "/swap-requests",
        relatedSwapId: swap._id.toString(),
      });
    }

    res.status(200).json(swap);
  } catch (error) {
    console.error("Confirm swap error:", error);
    res.status(500).json({ error: "Something went wrong confirming the swap." });
  }
});

// PUT /api/swaps/:id/complete — mark an accepted swap as completed.
// Per the brief: "Either party marks the swap complete" -- unchanged.
router.put("/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    let swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "You are not part of this swap." });
    }

    if (swap.status !== "accepted") {
      return res.status(400).json({ error: `Only accepted swaps can be marked complete. This swap is currently ${swap.status}.` });
    }

    swap.status = "completed";
    swap.statusUpdatedAt = new Date();
    swap.completedAt = new Date(); // records exactly when this happened
    await swap.save();

    // NEW: notify the OTHER participant -- not the person who just
    // clicked "Mark Complete", since they already know.
    const otherUserId = isRequester ? swap.receiverId.toString() : swap.requesterId.toString();
    const targetListing = await Listing.findById(swap.listingId);
    await createNotification({
      userId: otherUserId,
      type: "swap_completed",
      message: `Your swap for "${targetListing?.title ?? "a listing"}" has been marked complete.`,
      link: "/swap-requests",
      relatedSwapId: swap._id.toString(),
    });

    res.status(200).json(swap);
  } catch (error) {
    console.error("Complete swap error:", error);
    res.status(500).json({ error: "Something went wrong completing the swap." });
  }
});

// PUT /api/swaps/:id/cancel — cancel an accepted swap before completion.
// Unchanged from before.
router.put("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    let swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap request not found." });
    }

    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "You are not part of this swap." });
    }

    if (swap.status !== "accepted") {
      return res.status(400).json({ error: `Only accepted swaps can be cancelled. This swap is currently ${swap.status}.` });
    }

    swap.status = "cancelled";
    swap.statusUpdatedAt = new Date();
    await swap.save();

    res.status(200).json(swap);
  } catch (error) {
    console.error("Cancel swap error:", error);
    res.status(500).json({ error: "Something went wrong cancelling the swap." });
  }
});

// GET /api/swaps/:id/contact — unchanged. Only available once accepted
// or completed, regardless of which path (fallback or negotiation) the
// swap took to get there.
router.get("/:id/contact", requireAuth, async (req: AuthRequest, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ error: "Swap not found" });
    }

    const isRequester = swap.requesterId.toString() === req.userId;
    const isReceiver = swap.receiverId.toString() === req.userId;

    if (!isRequester && !isReceiver) {
      return res.status(403).json({ error: "Not authorized to view this swap's contact info" });
    }

    if (swap.status !== "accepted" && swap.status !== "completed") {
      return res.status(400).json({ error: "Contact info is only available after a swap is accepted" });
    }

    const otherUserId = isRequester ? swap.receiverId : swap.requesterId;

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ error: "User not found" });
    }

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
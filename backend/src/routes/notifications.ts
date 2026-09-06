import { Router } from "express";
import Notification from "../models/Notification.js";
import Swap from "../models/Swap.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { UNFINISHED_STATUSES, EXPIRY_DAYS, actingUserId, expireIfOverdue } from "./swaps.js";

const router = Router();

// GET /api/notifications -- returns the logged-in user's notifications,
// most recent first, capped at 20 REAL (stored) ones, plus any
// currently-true expiry reminders computed LIVE on this read -- same
// lazy-check pattern already used for expiry itself (decisions-log.md
// #44). Reminders are NOT stored as their own Notification documents,
// since "expires within 24 hours" is a constantly-shifting fact about
// existing data, not a discrete one-time event.
const RETENTION_DAYS = 30;

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    // NEW: lazy cleanup -- deletes this user's own notifications older
    // than RETENTION_DAYS, right before fetching the current list. Same
    // "check opportunistically on read, not a background job" pattern
    // already used for swap expiry (expireIfOverdue in swaps.ts) --
    // consistent with this project's established preference for
    // lightweight solutions over scheduled jobs (decisions-log #6, #15,
    // #44). Scoped to just THIS user on THIS request, rather than a
    // global sweep across every user's notifications, since there's no
    // single moment where "every user" is naturally being touched at
    // once.
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({ userId: req.userId, createdAt: { $lt: cutoff } });

    const stored = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    // Every swap where I'm a participant and it's currently in an
    // unfinished state -- candidates for an expiry reminder.
    const myTurnCandidates = await Swap.find({
      $or: [{ requesterId: req.userId }, { receiverId: req.userId }],
      status: { $in: UNFINISHED_STATUSES },
    });

    const reminders: any[] = [];
    const msInExpiryWindow = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const msInOneDay = 24 * 60 * 60 * 1000;

    for (let swap of myTurnCandidates) {
      // Runs the SAME expiry check used everywhere else first, so a
      // swap that's actually already expired doesn't also generate a
      // misleading "expires soon" reminder right alongside it.
      swap = await expireIfOverdue(swap);

      if (!UNFINISHED_STATUSES.includes(swap.status)) continue; // just expired -- no longer pending
      if (actingUserId(swap) !== req.userId) continue; // not my turn -- no reminder needed

      const msRemaining = msInExpiryWindow - (Date.now() - swap.statusUpdatedAt.getTime());

      if (msRemaining > 0 && msRemaining <= msInOneDay) {
        reminders.push({
          _id: `reminder-${swap._id}`, // synthetic id -- never written to the database
          type: "expiry_reminder",
          message: "A swap request is waiting on you and expires within 24 hours.",
          link: "/swap-requests",
          read: false, // reminders represent a currently-true fact, not a one-time event to dismiss
          createdAt: swap.statusUpdatedAt,
        });
      }
    }

    // Reminders surface first (most time-sensitive), then stored
    // notifications in their existing most-recent-first order.
    res.status(200).json({ notifications: [...reminders, ...stored] });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    res.status(500).json({ error: "Something went wrong fetching your notifications." });
  }
});

// PUT /api/notifications/:id/read -- marks ONE stored notification as
// read. Only ever called on REAL notification ids -- the frontend
// never calls this for a synthetic "reminder-..." id, since those
// aren't stored documents.
router.put("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, userId: req.userId });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }

    notification.read = true;
    await notification.save();

    res.status(200).json(notification);
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Something went wrong updating this notification." });
  }
});

// PUT /api/notifications/read-all -- marks every one of the logged-in
// user's stored notifications as read in one go, for a "mark all read"
// action when the dropdown opens/closes.
router.put("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Something went wrong updating your notifications." });
  }
});

export default router;
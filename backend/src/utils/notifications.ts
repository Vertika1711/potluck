import Notification from "../models/Notification.js";

// EVENT-DRIVEN notification creation -- called directly from whichever
// route just made something happen (a new swap request, a stage
// change, a completion, a new rating), at the exact moment it occurs.
// This is the one place that actually writes a Notification document,
// so every route that needs to notify someone calls through here
// instead of duplicating the Notification.create() call inline.
export async function createNotification(params: {
  userId: string;
  type: "new_request" | "your_turn" | "swap_completed" | "new_rating" | "swap_accepted";
  message: string;
  link: string;
  relatedSwapId?: string;
  relatedRatingId?: string;
}) {
  try {
    await Notification.create(params);
  } catch (error) {
    // A notification failing to save should NEVER break the actual
    // action that triggered it (sending a request, completing a swap,
    // etc.) -- same graceful-degradation principle used throughout
    // this project (e.g. Phase 2's AI tagging fallback).
    console.error("Failed to create notification:", error);
  }
}
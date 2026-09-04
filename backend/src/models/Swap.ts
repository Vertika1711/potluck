import mongoose, { Schema, Document } from "mongoose";

// Describes the shape of a Swap in TypeScript terms — same pattern
// as Listing.ts. Document adds Mongo's built-in fields (like _id).
export interface ISwap extends Document {
  listingId: mongoose.Types.ObjectId; // which listing this request is about
  requesterId: mongoose.Types.ObjectId; // who sent the swap request
  receiverId: mongoose.Types.ObjectId; // who owns the listing (must accept/reject)

  // NEW: a snapshot of the target listing's type, taken at the moment
  // the swap is created. Needed because "who acts next" at pending_pick
  // and pending_confirmation depends on which case this swap is --
  // Case A (listingType "want": the requester is offering to teach)
  // or Case B (listingType "offer": the requester wants to learn).
  // Storing it here means every later route can check this one field
  // instead of re-fetching the original listing every time (which
  // could theoretically also change type later, though that's not
  // expected in practice).
  listingType: "offer" | "want";

  status:
    | "pending" // the old simple flow -- used as the fallback when one side has no offer listings to negotiate with
    | "pending_share" // Case A only: waiting on the want-listing owner to share their active offer listings
    | "pending_pick" // waiting on whoever's turn it is to pick one specific listing from the shared pool
    | "pending_confirmation" // waiting on final accept/reject from whoever's list just got picked from
    | "accepted"
    | "rejected"
    | "completed"
    | "cancelled";

  // NEW: the pool of listings shared at the "share" (Case A) or
  // "attach at request time" (Case B) step. Plural, since more than
  // one listing can be offered as options to choose from.
  offeredListingIds: mongoose.Types.ObjectId[];

  // NEW: the ONE specific listing actually picked from offeredListingIds.
  // Unset until the pick step happens.
  selectedListingId?: mongoose.Types.ObjectId;

  // NEW: when the CURRENT status was set (not when the swap was first
  // created) -- this is what the 7-day auto-expiry checks against,
  // since each new step in the negotiation gets its own fresh 7-day
  // window rather than one running clock from the very start.
  statusUpdatedAt: Date;

  // NEW: distinguishes WHY a swap ended up rejected -- someone actively
  // declining vs. the 7-day auto-expiry silently kicking in. Without
  // this, both cases look identical once resolved (just "rejected"),
  // and there'd be no way to show the real reason on the frontend
  // after the fact.
  rejectionReason?: "declined" | "expired";

  matchScore?: number; // optional for now -- Phase 4's matching engine will populate this
  createdAt: Date;
  completedAt?: Date; // only set once the swap is actually marked complete
}

const swapSchema = new Schema<ISwap>({
  listingId: {
    type: Schema.Types.ObjectId,
    ref: "Listing", // lets us "populate" the full listing later if needed
    required: true,
  },
  requesterId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  listingType: {
    type: String,
    enum: ["offer", "want"],
    required: true,
  },
  status: {
    type: String,
    // "cancelled" added per decisions-log.md #1. "pending_share",
    // "pending_pick", and "pending_confirmation" added for the
    // negotiation flow -- see decisions-log entry for the full design.
    enum: [
      "pending",
      "pending_share",
      "pending_pick",
      "pending_confirmation",
      "accepted",
      "rejected",
      "completed",
      "cancelled",
    ],
    default: "pending", // overwritten explicitly at creation time based on which case applies
  },
  offeredListingIds: {
    type: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    default: [],
  },
  selectedListingId: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: false,
  },
  statusUpdatedAt: {
    type: Date,
    default: Date.now, // set on creation; every route that changes status must also update this
  },
  rejectionReason: {
    type: String,
    enum: ["declined", "expired"],
    required: false,
  },
  matchScore: {
    type: Number,
    required: false, // not used until Phase 4's matching engine exists
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    required: false, // stays unset until the swap is actually completed
  },
});

const Swap = mongoose.model<ISwap>("Swap", swapSchema);

export default Swap;
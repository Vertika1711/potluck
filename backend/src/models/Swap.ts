import mongoose, { Schema, Document } from "mongoose";

// Describes the shape of a Swap in TypeScript terms — same pattern
// as Listing.ts. Document adds Mongo's built-in fields (like _id).
export interface ISwap extends Document {
  listingId: mongoose.Types.ObjectId; // which listing this request is about
  requesterId: mongoose.Types.ObjectId; // who sent the swap request
  receiverId: mongoose.Types.ObjectId; // who owns the listing (must accept/reject)
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
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
  status: {
    type: String,
    // "cancelled" added per decisions-log.md #1 -- represents a swap that
    // was accepted, then called off before actually happening. Excluded
    // from trust score / completed-swap counts, same as "rejected".
    enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
    default: "pending", // every new swap request starts here
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
import mongoose, { Schema, Document } from "mongoose";

// Describes the shape of a Rating in TypeScript terms -- same pattern
// as Listing.ts and Swap.ts.
export interface IRating extends Document {
  swapId: mongoose.Types.ObjectId; // which swap this rating is about -- MANDATORY,
  // every rating is inherently tied to exactly one completed exchange
  raterId: mongoose.Types.ObjectId; // who left this rating
  ratedUserId: mongoose.Types.ObjectId; // who the rating is ABOUT
  score: number; // 1-5, required
  comment?: string; // optional free text
  helpfulUserIds: mongoose.Types.ObjectId[]; // users who clicked "helpful" --
  // storing actual IDs (not just a count) is what lets us enforce one
  // vote per user and support toggling on/off
  createdAt: Date;
}

const ratingSchema = new Schema<IRating>({
  swapId: {
    type: Schema.Types.ObjectId,
    ref: "Swap",
    required: true,
  },
  raterId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ratedUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5, // Mongoose itself rejects anything outside 1-5, not just the frontend
  },
  comment: {
    type: String,
    required: false, // per our discussion -- score is mandatory, comment is optional
  },
  helpfulUserIds: {
    type: [Schema.Types.ObjectId],
    ref: "User",
    default: [], // starts empty -- no one has voted yet when a rating is created
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Rating = mongoose.model<IRating>("Rating", ratingSchema);

export default Rating;
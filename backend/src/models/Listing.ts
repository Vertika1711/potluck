import mongoose, { Schema, Document } from "mongoose";

// This interface describes the "shape" of a Listing in TypeScript terms.
// It's separate from the Mongoose schema below, but they should match.
// Document is imported from mongoose because every saved listing will
// also have Mongo's built-in fields (like _id) on top of these.
export interface IListing extends Document {
  userId: mongoose.Types.ObjectId; // links this listing to the user who created it
  title: string;
  description: string;
  type: "offer" | "want"; // restricts this field to exactly these two values
  skillTags: string[]; // array of strings, e.g. ["HTML", "CSS", "JavaScript"]
  status: "active" | "closed";
  createdAt: Date;
}

// This is the actual Mongoose schema — the rules the database enforces
// every time a listing is created or updated.
const listingSchema = new Schema<IListing>({
  // "ref: User" doesn't copy user data into the listing — it just stores
  // a reference (the user's _id) that Mongoose can later use to "populate"
  // (fetch) the full user info if we ever need it, without duplicating data.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true, // trims whitespace, e.g. " Guitar Lessons " -> "Guitar Lessons"
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["offer", "want"], // Mongoose rejects anything outside this list
    required: true,
  },
  skillTags: {
    type: [String], // an array where every item must be a string
    default: [], // if no tags are given yet, default to an empty array
  },
  status: {
    type: String,
    enum: ["active", "closed"],
    default: "active", // every new listing starts as active
  },
  createdAt: {
    type: Date,
    default: Date.now, // automatically set when the document is created
  },
});

// Compiles the schema into a usable Mongoose model, the same pattern as User.ts.
const Listing = mongoose.model<IListing>("Listing", listingSchema);

export default Listing;
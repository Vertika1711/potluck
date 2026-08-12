import mongoose, { Schema, Document } from "mongoose";

// Describes the shape of a User document in TypeScript,
// so the rest of our code gets autocomplete and type-checking on user data
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  skillsOffered: string[];
  skillsWanted: string[];
  trustScore: number;
  createdAt: Date;
}

// The actual schema — this is what Mongoose uses to validate
// and structure data before it's saved to MongoDB
const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },

  // unique: true prevents two users from signing up with the same email
  email: { type: String, required: true, unique: true },

  // We only ever store a hashed password, never the real one
  passwordHash: { type: String, required: true },

  skillsOffered: { type: [String], default: [] },
  skillsWanted: { type: [String], default: [] },

  // Starts at 0 for a brand new user with no completed swaps yet
  trustScore: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

// Turns the schema into an actual usable model we can create/find/update users with
export default mongoose.model<IUser>("User", UserSchema);
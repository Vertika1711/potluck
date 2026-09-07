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
  phone?: string;
  phoneVisible: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // NEW: email verification -- same shape as the reset-password token
  // pair above, since it's the exact same underlying mechanism (a
  // random token + an expiry, emailed as a link). emailVerified starts
  // false for every new signup and gets flipped to true once the
  // verification link is clicked; login is blocked until then.
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  // NEW: which of the 18 predefined illustrated avatars this user has
  // chosen (an index into the frontend's AVATARS array, 0-17).
  // Optional/undefined means "hasn't picked one" -- the frontend falls
  // back to a deterministic default (hashed from the user's own _id)
  // via getAvatarSrc() in utils/avatar.ts, so every user always has
  // SOME avatar even before ever visiting Edit Profile.
  avatarId?: number;
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

  phone: {
    type: String,
    required: false, // optional — not everyone wants to share a phone number
  },
  phoneVisible: {
    type: Boolean,
    default: false, // opt-in: contact route will only return phone if this is true
  },
  resetPasswordToken: {
    type: String,
    required: false, // only set while a reset request is actively pending
  },
  resetPasswordExpires: {
    type: Date,
    required: false, // set alongside the token, cleared once used or expired
  },
  // NEW: defaults to false for every new signup -- login is blocked
  // until this flips to true via the /verify-email/:token route.
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    required: false, // only set while verification is pending, cleared once used
  },
  emailVerificationExpires: {
    type: Date,
    required: false, // 24 hours from signup, per our agreed expiry window
  },
  // NEW: optional -- undefined until the user explicitly picks one via
  // Edit Profile. min/max match the frontend's 18-avatar set (indices
  // 0-17); kept as a plain Number rather than an enum since the count
  // may grow later and a range check is simpler to adjust than an enum
  // list. IMPORTANT: if the frontend's AVATARS array in utils/avatar.ts
  // ever changes length, this max needs updating to match.
  avatarId: {
    type: Number,
    required: false,
    min: 0,
    max: 17,
  },
});

// Turns the schema into an actual usable model we can create/find/update users with
export default mongoose.model<IUser>("User", UserSchema);
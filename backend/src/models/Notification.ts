import mongoose, { Schema, Document } from "mongoose";

// Describes the shape of a Notification in TypeScript terms -- same
// pattern as every other model in this project. A notification is
// always FOR one specific user (userId), and carries a pre-built
// message + link so the read path (GET /api/notifications) never
// needs to populate or re-derive anything just to render the list.
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId; // who this notification is FOR
  type: "new_request" | "your_turn" | "swap_completed" | "new_rating" | "swap_accepted";
  message: string;
  link: string; // where clicking this notification should navigate to
  relatedSwapId?: mongoose.Types.ObjectId;
  relatedRatingId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["new_request", "your_turn", "swap_completed", "new_rating", "swap_accepted"],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    required: true,
  },
  relatedSwapId: {
    type: Schema.Types.ObjectId,
    ref: "Swap",
    required: false,
  },
  relatedRatingId: {
    type: Schema.Types.ObjectId,
    ref: "Rating",
    required: false,
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
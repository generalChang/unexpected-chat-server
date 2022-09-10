const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chatRoomSchema = mongoose.Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    joiners: {
      type: Array,
      default: [],
    },
    privacy: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

module.exports = ChatRoom;

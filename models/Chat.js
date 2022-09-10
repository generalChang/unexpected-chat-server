const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const chatSchema = mongoose.Schema(
  {
    chatRoom: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
    },
    chatRead: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", chatSchema);

module.exports = Chat;

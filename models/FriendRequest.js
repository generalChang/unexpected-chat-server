const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const FriendRequestSchema = mongoose.Schema({
  userFrom: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  userTo: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  request: {
    type: Number,
    default: 0,
  },
});

const FriendRequest = mongoose.model("FriendRequest", FriendRequestSchema);

module.exports = FriendRequest;

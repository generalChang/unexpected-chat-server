const e = require("express");
const express = require("express");
const auth = require("../middlewares/auth");
const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const router = express.Router();

router.post("/requestFriend", (req, res) => {
  const { userFrom, userTo, request } = req.body;
  User.findOne({
    _id: userFrom,
  }).exec((err, userInfo) => {
    if (err) return res.send({ success: false, err });
    if (!userInfo) return res.send({ success: false, err });

    let isAlreadyFriend = false;
    userInfo.friends.forEach((friend) => {
      if (friend.userId == userTo) {
        isAlreadyFriend = true;
      }
    });

    if (isAlreadyFriend) {
      //이미 친구라면?
      return res.send({ success: false, isAlreadyFriend: true });
    } else {
      FriendRequest.findOne({
        userFrom,
        userTo,
        request,
      }).exec((err, info) => {
        if (err) return res.send({ success: false, err });
        if (!info) {
          ///친구요청을 안보냈었다면.
          const fr = new FriendRequest(req.body);
          fr.save((err, frInfo) => {
            if (err) return res.send({ success: false, err });
            return res.send({ success: true });
          });
        } else {
          return res.send({ success: true, alreadyRequest: true });
        }
      });
    }
  });
});

router.post("/waitingForApproval", (req, res) => {
  const { userTo, request } = req.body;
  FriendRequest.find({
    userTo,
    request,
  })
    .populate("userFrom")
    .exec((err, frs) => {
      //나에게 친구 요청을 보낸 사람들의 정보를 알 수 있다.
      if (err) return res.send({ success: false, err });
      let friendsRequestMe = [];
      frs.forEach((fr) => {
        friendsRequestMe.push(fr.userFrom);
      });

      return res.send({ success: true, friendsRequestMe });
    });
});

router.post("/acceptFriend", (req, res) => {
  //친구수락하기.
  //친구를 수락하면 각각의 친구요청데이터는 사라지며
  //각각의 User의 firends필드에 상대방이 추가됨.
  const { me, partner } = req.body;

  FriendRequest.findOne({
    userFrom: partner,
    userTo: me,
    request: 1,
  }).exec((err, fr) => {
    if (err) return res.send({ success: false, err });
    if (!fr) return res.send({ success: false, isAlreadyFriend: true });

    FriendRequest.findOneAndDelete({
      userFrom: me,
      userTo: partner,
    }).exec((err, frinfo) => {
      if (err) return res.send({ success: false, err });

      FriendRequest.findOneAndDelete({
        userFrom: partner,
        userTo: me,
      }).exec((err, frinfo2) => {
        if (err) return res.send({ success: false, err });

        User.findOneAndUpdate(
          {
            _id: me,
          },
          {
            $push: {
              friends: {
                userId: partner,
              },
            },
          }
        ).exec((err, userInfo) => {
          if (err) return res.send({ success: false, err });

          User.findOneAndUpdate(
            {
              _id: partner,
            },
            {
              $push: {
                friends: {
                  userId: me,
                },
              },
            }
          ).exec((err, userInfo2) => {
            if (err) return res.send({ success: false, err });

            return res.send({ success: true });
          });
        });
      });
    });
  });
});

router.get("/friends", auth, (req, res) => {
  User.findOne({
    _id: req.user._id,
  }).exec((err, userInfo) => {
    if (err) return res.send({ success: false, err });
    return res.send({ success: true, friends: userInfo.friends });
  });
});

router.post("/friendsInfo", (req, res) => {
  const { friendsId } = req.body;

  let friendsIdArr = [];
  friendsId.forEach((fi) => {
    friendsIdArr.push(fi.userId);
  });

  User.find({
    _id: {
      $in: friendsIdArr,
    },
  }).exec((err, users) => {
    if (err) return res.send({ success: false, err });
    return res.send({ success: true, users });
  });
});

module.exports = router;

const express = require("express");
const async = require("async");
const Chat = require("../models/Chat");
const ChatRoom = require("../models/ChatRoom");
const User = require("../models/User");
const auth = require("../middlewares/auth");
const router = express.Router();

router.post("/createChatRoom", (req, res) => {
  const chatRoom = new ChatRoom(req.body);
  chatRoom.save((err, info) => {
    if (err) return res.send({ success: false, err });

    ChatRoom.findOneAndUpdate(
      {
        _id: info._id,
      },
      {
        $push: {
          joiners: {
            userId: req.body.userId,
            date: Date.now(), //이양반이 입장한 시간.
          },
        },
      },
      { new: true }
    ).exec((err, chatroominfo) => {
      if (err) return res.send({ success: false, err });
      return res.send({ success: true, chatRoom: chatroominfo });
    });
  });
});

router.post("/chatrooms", (req, res) => {
  const keyword = req.body.keyword ? req.body.keyword : "";
  const skip = req.body.skip ? req.body.skip : 0;
  const limit = req.body.limit ? req.body.limit : 12;
  ChatRoom.find({
    title: {
      $regex: keyword,
    },
  })
    .skip(skip)
    .limit(limit)
    .populate("userId")
    .exec((err, rooms) => {
      if (err) return res.send({ success: false, err });
      ChatRoom.find({
        title: {
          $regex: keyword,
        },
      })
        .skip(skip + limit)
        .limit(limit)
        .populate("userId")
        .exec((err, chatRooms) => {
          if (err) return res.send({ success: false, err });
          return res.send({
            success: true,
            isNext: chatRooms.length > 0,
            rooms: rooms,
          });
        });
    });
});

router.post("/chatroomsByUser", (req, res) => {
  const { userId } = req.body;
  ChatRoom.find()
    .populate("userId")
    .exec((err, rooms) => {
      if (err) return res.send({ success: false, err });

      let roomsArr = []; //접속되어 있는 방의 리스트.
      rooms.forEach((room, index) => {
        let joinersId = [];
        room.joiners.forEach((joiner, index) => {
          joinersId.push(joiner.userId);
        });
        if (joinersId.includes(userId)) {
          //방에 접속중인 인원이라면
          roomsArr.push(room._id);
        }
      });

      ChatRoom.find({
        _id: {
          $in: roomsArr,
        },
      })
        .populate("userId")
        .exec((err, chatRoomsInfo) => {
          if (err) return res.send({ success: false, err });
          return res.send({ success: true, chatRooms: chatRoomsInfo });
        });
    });
});

router.post("/chatroom", (req, res) => {
  const { roomId } = req.body;
  ChatRoom.findOne({
    _id: roomId,
  })
    .populate("userId")
    .exec((err, chatRoomInfo) => {
      if (err) return res.send({ success: false, err });
      if (!chatRoomInfo) return res.send({ success: false, closed: true });

      return res.send({ success: true, chatRoom: chatRoomInfo });
    });
});
router.post("/join", (req, res) => {
  // 해당 채팅방에 이미 들어와있는지 아닌지 검사
  //
  //아니라면 join.

  ChatRoom.findOne({
    _id: req.body.chatRoom,
  }).exec((err, chatRoomInfo) => {
    if (err) return res.send({ success: false, err });
    if (!chatRoomInfo) return res.send({ success: false, closed: true });
    let isNewUser = true; //새로운 유입자인지 아닌지.
    chatRoomInfo.joiners.forEach((joinder, index) => {
      if (joinder.userId === req.body.userId) {
        isNewUser = false; //유입자가 아니라 이미 접속자다.
        return;
      }
    });

    if (isNewUser) {
      //신규 유입자라면
      const chat = new Chat(req.body);
      chat.save((err, chatInfo) => {
        if (err) return res.send({ success: false, err });

        ChatRoom.findOneAndUpdate(
          {
            _id: chatInfo.chatRoom._id,
          },
          {
            $push: {
              joiners: {
                userId: req.body.userId,
                date: Date.now(),
              },
            },
          },
          { new: true }
        ).exec((err, info) => {
          if (err) return res.send({ success: false, err });
          return res.send({ success: true, chatRoom: info });
        });
      });
    } else {
      return res.send({ success: true, chatRoom: chatRoomInfo });
    }
  });
});

//채팅목록을 불러온다.
router.post("/chat", auth, (req, res) => {
  const { roomId } = req.body;
  Chat.find({
    chatRoom: roomId,
  })
    .populate("userId")
    .exec((err, chatInfo) => {
      if (err) return res.send({ success: false, err });

      ChatRoom.findOne({
        _id: roomId,
      }).exec((err, chatRoomInfo) => {
        if (err) return res.send({ success: false, err });
        if (!chatRoomInfo) return res.send({ success: false, closed: true });

        let myJoinTime;
        chatRoomInfo.joiners.forEach((joiner) => {
          if (joiner.userId == req.user._id) {
            myJoinTime = joiner.date;
          }
        });
        // 내가 접속한 시간을 얻어온다.

        let chattings = [];
        chatInfo.forEach((chatting) => {
          if (myJoinTime < new Date(chatting.createdAt).getTime()) {
            chattings.push(chatting);
          }
        });
        // 내가 접속한 시간보다 더 나중에 쌓인 채팅들을 얻어온다.

        return res.send({ success: true, chatting: chattings });
      });
    });
});

router.post("/sendMessage", (req, res) => {
  ChatRoom.findOne({
    _id: req.body.chatRoom,
  }).exec((err, chatroom) => {
    if (err) return res.send({ success: false, err });
    if (!chatroom) return res.send({ success: false, closed: true });

    const chat = new Chat(req.body);
    chat.save((err, info) => {
      if (err) return res.send({ success: false, err });
      return res.send({ success: true });
    });
  });
});

router.post("/exit", (req, res) => {
  // 방을 나가는 유저가 방장인경우
  // -> chatroom을 없애고, chatroomid값을 갖고있는 chat들도 다 없앤다.
  // 방을 나가는 유저가 방장이 아닌경우
  // -> chatroom의 joiners에서 제외시킨다.

  const { roomId, userId, message } = req.body;
  ChatRoom.findOne({
    _id: roomId,
  }).exec((err, chatRoomInfo) => {
    if (err) return res.send({ success: false, err });

    if (!chatRoomInfo)
      return res.send({ success: false, leaveExitedRoom: true });
    let isOwner = false;

    if (chatRoomInfo.userId._id == userId) {
      isOwner = true;
    }

    if (isOwner) {
      //방을 나가려 하는 유저가 방장인경우.

      Chat.find({
        chatRoom: roomId,
      }).exec((err, chatInfo) => {
        if (err) return res.send({ success: false, err });

        const chattings = chatInfo;

        //방에 있는 채팅목록을 전부 없애주고
        async.eachSeries(
          chattings,
          (chatting, callback) => {
            Chat.findOneAndDelete({
              chatRoom: chatting.chatRoom,
            }).exec(callback);
          },
          (err) => {
            if (err) return res.send({ success: false, err });
          }
        );

        //해당 채팅방도 없애준다.
        ChatRoom.findOneAndDelete({
          _id: roomId,
        }).exec((err, info) => {
          if (err) return res.send({ success: false, err });
          return res.send({ success: true, roomDelete: true });
        });
      });
    } else {
      //방장이 아닌경우
      //joiner에서 그냥 뺀다.
      ChatRoom.findOneAndUpdate(
        {
          _id: roomId,
        },
        {
          $pull: {
            joiners: {
              userId,
            },
          },
        },
        { new: true }
      ).exec((err, chatRoomInfo) => {
        if (err) return res.send({ success: false, err });

        const chat = {
          chatRoom: roomId,
          userId,
          message,
        };

        const chatting = new Chat(chat);
        chatting.save((err, chattingInfo) => {
          if (err) return res.send({ success: false, err });
          return res.send({ success: true });
        });
      });
    }
  });
});

router.post("/joiners", (req, res) => {
  const { roomId } = req.body;
  ChatRoom.findOne({
    _id: roomId,
  }).exec((err, chatRoomInfo) => {
    if (err) return res.send({ success: false, err });
    if (!chatRoomInfo) return res.send({ success: false });

    const joinersId = [];
    chatRoomInfo.joiners.sort((a, b) => {
      return a.date - b.date;
    });

    chatRoomInfo.joiners.forEach((joiner, index) => {
      joinersId.push(joiner.userId);
    });

    User.find({
      _id: {
        $in: joinersId,
      },
    }).exec((err, users) => {
      if (err) return res.send({ success: false, err });

      return res.send({ success: true, joiners: users });
    });
  });
});
module.exports = router;

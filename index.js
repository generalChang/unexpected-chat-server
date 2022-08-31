const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./config/key");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketIo = require("socket.io");
const moment = require("moment");
const app = express();

mongoose
  .connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB Connected..!!!");
  })
  .catch((err) => console.log(err));

app.use(
  cors({
    credentials: true,
    origin: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

app.use("/api/user/", require("./routes/user"));

const port = process.env.PORT || 5000;

const server = http.createServer(app);
const io = socketIo(server);

function publicRooms(roomtype) {
  const sids = io.sockets.adapter.sids; //연결된 모든 소켓의 id값을 받아옴.
  const rooms = io.sockets.adapter.rooms;

  const sidsArr = [];
  const roomsArr = [];

  console.log(rooms);
  for (let key in sids) {
    sidsArr.push(key);
  }

  const publicRooms = [];

  for (let key in rooms) {
    roomsArr.push(key);
  }

  roomsArr.forEach((roomId) => {
    if (sidsArr.indexOf(roomId) === -1) {
      let parse = JSON.parse(roomId);
      if (parse.roomtype === roomtype) {
        publicRooms.push({ roomId: roomId, userCount: rooms[roomId].length });
      }
    }
  });

  console.log("public rooms : ", publicRooms);
  return publicRooms; //해당 카테고리의 room_id들을 담아서 반환.
}

function numberOfPeople(roomId) {
  const rooms = io.sockets.adapter.rooms;
  return rooms[roomId].length; ///인원수
}

function searchingSomeone(socket) {
  // for (let key in io.sockets.connected) {
  //   if (socket.id === key) {
  //     console.log("나야");
  //   } else {
  //     console.log("나 아니야");
  //   }
  // }

  for (let key in io.sockets.connected) {
    if (socket.id !== key) {
      if (
        io.sockets.connected[key] &&
        io.sockets.connected[key].searching === true &&
        io.sockets.connected[key].searched === false
      ) {
        ///매칭 상대를 찾은거임.
        ///룸을 만들고 그 둘을 그 룸에 넣어주면 된다.
        socket.searching = false;
        socket.searched = true;
        io.sockets.connected[key].searching = false;
        io.sockets.connected[key].searched = true;

        const roomId = Date.now();
        socket.join(roomId);
        socket.roomId = roomId;
        socket.type = "RANDOM_CHAT";
        io.sockets.connected[key].join(roomId);
        io.sockets.connected[key].roomId = roomId;
        io.sockets.connected[key].type = "RANDOM_CHAT";
        io.sockets.in(roomId).emit("enter_room", roomId);

        break;
      }
    }
  }
}
io.on("connection", (socket) => {
  console.log("connection complete!!");

  socket.on("disconnect", () => {
    if (socket.roomId && socket.roomtype === "GROUP_CHAT") {
      //GROUP_CHAT
      socket.to(socket.obj.roomId).emit("leave_room", socket.obj);
      io.sockets.emit(
        "public_rooms",
        socket.obj.roomtype,
        publicRooms(socket.obj.roomtype)
      );
    }

    if (socket.type === "RANDOM_CHAT" && socket.roomId) {
      ///RANDOM_CHAT
      socket.to(socket.roomId).emit("leave_random_chat_room", {
        username: "Your partner",
        image: `http://gravatar.com/avatar/${moment().unix()}?d=identicon`,
      });
    }

    if (socket.roomtype === "CALL_CHAT" && socket.roomId) {
      socket.to(socket.roomId).emit("leave-video-chat-room", socket.obj);
      io.sockets.emit(
        "public_rooms",
        socket.roomtype,
        publicRooms(socket.roomtype)
      );
    }
  });
  socket.on("public_rooms", (type) => {
    socket.emit("public_rooms", type, publicRooms(type));
  });

  socket.on("create_room", (obj, done) => {
    const roomId = JSON.stringify(obj);
    socket.roomId = roomId;
    socket.roomtype = obj.roomtype;
    socket.obj = { ...obj, roomId };
    socket.join(roomId);
    done(roomId);
    io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
  });

  socket.on("enter_room", (obj, done) => {
    socket.join(obj.roomId);
    socket.roomId = obj.roomId;
    socket.roomtype = obj.roomtype;
    socket.obj = obj;
    done();
    socket.to(obj.roomId).emit("welcome", obj);
    io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
  });

  socket.on("send_msg", (obj, done) => {
    done(obj);
    socket.to(obj.roomId).emit("send_msg", obj);
  });

  socket.on("leave_room", (obj, done) => {
    socket.to(obj.roomId).emit("leave_room", obj);
    done(obj);
    socket.leave(obj.roomId);
    socket.roomId = null;
    io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
  });

  socket.on("leave_random_chat_room", (obj, done) => {
    socket.to(obj.roomId).emit("leave_random_chat_room", obj);
    socket.searching = false; //찾고있는중.
    socket.searched = false; //매칭된상태.
    socket.roomId = null;
    done(obj);
    socket.leave(obj.roomId);
  });

  socket.on("startSearchingSomeone", (done) => {
    socket.searching = true; //찾고있는중.
    socket.searched = false; //매칭된상태.
    // console.log("socket.id : ", socket.id);
    // console.log("io.sockets.connected : ", io.sockets.connected);
    done();
    searchingSomeone(socket);
  });

  socket.on("create-video-chat-room", (obj, done) => {
    obj["_id"] = Date.now();
    const roomId = JSON.stringify(obj);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.roomtype = obj.roomtype;
    socket.obj = obj;
    done(roomId);
    io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
  });

  socket.on("enter-video-chat-room", (obj, done) => {
    if (numberOfPeople(obj.roomId) >= 2) {
      done(false);
      return;
    } else {
      socket.join(obj.roomId);
      socket.roomId = obj.roomId;
      socket.roomtype = obj.roomtype;
      socket.obj = obj;
      done(true);
      socket.to(obj.roomId).emit("welcome", obj);
      io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
    }
  });

  socket.on("leave-video-chat-room", (obj, done) => {
    socket.to(obj.roomId).emit("leave-video-chat-room", obj);
    done(obj);
    socket.leave(obj.roomId);
    socket.roomId = null;
    io.sockets.emit("public_rooms", obj.roomtype, publicRooms(obj.roomtype));
  });

  socket.on("offer", (sdp) => {
    // room에는 두 명 밖에 없으므로 broadcast 사용해서 전달
    // 여러 명 있는 처리는 다음 포스트 1:N에서...
    socket.to(socket.roomId).emit("getOffer", sdp);
  });

  socket.on("answer", (sdp) => {
    // room에는 두 명 밖에 없으므로 broadcast 사용해서 전달
    // 여러 명 있는 처리는 다음 포스트 1:N에서...
    socket.to(socket.roomId).emit("getAnswer", sdp);
  });

  socket.on("candidate", (candidate) => {
    // room에는 두 명 밖에 없으므로 broadcast 사용해서 전달
    // 여러 명 있는 처리는 다음 포스트 1:N에서...
    socket.to(socket.roomId).emit("getCandidate", candidate);
  });
});

server.listen(port, () => {
  console.log(`server listening on ${port} port`);
});

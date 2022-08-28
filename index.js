const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./config/key");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketIo = require("socket.io");
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

io.on("connection", (socket) => {
  console.log("connection complete!!");

  socket.on("disconnect", () => {
    if (
      socket.roomId &&
      socket.obj &&
      socket.obj.roomId &&
      socket.obj.roomtype
    ) {
      socket.to(socket.obj.roomId).emit("leave_room", socket.obj);
      io.sockets.emit(
        "public_rooms",
        socket.obj.roomtype,
        publicRooms(socket.obj.roomtype)
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
});

server.listen(port, () => {
  console.log(`server listening on ${port} port`);
});

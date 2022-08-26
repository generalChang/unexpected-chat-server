const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./config/key");
const cookieParser = require("cookie-parser");
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

app.listen(port, () => {
  console.log(`server listening on ${port} port`);
});

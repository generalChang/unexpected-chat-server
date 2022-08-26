const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;
var jwt = require("jsonwebtoken");

const userSchema = mongoose.Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
    unique: 1,
  },
  emailCertificated: {
    type: Boolean,
    default: false,
  },
  authCode: {
    type: String,
  },
  password: {
    type: String,
  },
  passwordReset: {
    type: Boolean,
    default: false,
  },
  gender: {
    type: Number,
    default: 1,
  },
  age: {
    type: Number,
  },
  role: {
    type: Number,
    default: 0,
  },
  image: {
    type: String,
  },
  token: {
    type: String,
  },
  tokenExp: {
    type: Number,
  },
});

userSchema.pre("save", function (next) {
  let user = this;
  if (user.isModified("password")) {
    bcrypt.genSalt(saltRounds, function (err, salt) {
      bcrypt.hash(user.password, salt, function (err, hash) {
        if (err) return next(err);
        user.password = hash;
        return next();
      });
    });
  } else {
    next();
  }
});

userSchema.methods.comparePassword = function (plainPassword, cb) {
  const user = this;
  bcrypt.compare(plainPassword, user.password, function (err, result) {
    if (err) return cb(err);
    return cb(null, result);
  });
};

userSchema.methods.generateToken = function (cb) {
  let user = this;
  jwt.sign(user._id.toHexString(), "secret", function (err, token) {
    if (err) return cb(err);

    user.token = token;
    user.save((err, userInfo) => {
      if (err) return cb(err);
      return cb(null, userInfo);
    });
  });
};

userSchema.statics.findOneByToken = function (token, cb) {
  jwt.verify(token, "secret", function (err, decoded) {
    //decoded : 복호화된 토큰. 즉 user의 id값임.
    User.findOne({
      token: token,
      _id: decoded,
    }).exec((err, userinfo) => {
      if (err) return cb(err);
      return cb(null, userinfo);
    });
  });
};

userSchema.methods.verifyAuthCode = function (plainAuthCode, cb) {
  let user = this;
  if (user.authCode === plainAuthCode) {
    ///이메일 인증 코드 일치
    return cb(null, true);
  } else {
    return cb(null, false);
  }
};

userSchema.methods.generateNewPassword = function (randomPassword, cb) {
  let user = this;
  bcrypt.genSalt(saltRounds, function (err, salt) {
    bcrypt.hash(randomPassword, salt, function (err, hash) {
      if (err) return cb(err);
      return cb(null, hash);
    });
  });
};
const User = mongoose.model("User", userSchema);

module.exports = User;

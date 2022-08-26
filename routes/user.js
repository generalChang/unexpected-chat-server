const express = require("express");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const mailSender = require("../modules/mailSender");

const router = express.Router();

///랜덤한 이메일 인증코드를 만든다.
function generateRandomAuthCode() {
  return Math.floor(Math.random() * 10 ** 8)
    .toString()
    .padStart("0", 8);
}

function generateRandomPassword() {
  return Math.floor(Math.random() * 10 ** 8)
    .toString()
    .padStart("0", 8);
}

router.post("/register", (req, res) => {
  const authCode = generateRandomAuthCode();
  req.body.authCode = authCode;
  const user = new User(req.body);
  user.save((err, userinfo) => {
    if (err) return res.send({ success: false, err });

    mailSender.sendGmail({
      toEmail: userinfo.email,
      subject: "Email certification required. check it out.",
      text: `Your Auth code is... : [${authCode}]`,
    });
    setTimeout(() => {
      //1시간 이내에 이메일 인증을 하지않으면 자동으로 유저정보 파괴.
      if (!userinfo.emailCertificated) {
        User.findOneAndDelete({ _id: userinfo._id }).exec((err, info) => {
          if (err) return res.send({ success: false, err });
          return res.send({ success: true, remove: true });
        });
      }
    }, 60 * 60 * 1000);

    return res.send({ success: true });
  });
});

router.post("/login", (req, res) => {
  ///이메일이 있는지 확인
  ///이메일이 있으면 비밀번호가 매칭되는지 확인.
  ///비밀번호가 매칭이 된다면, 토큰을 포함한 응답을 보내고 데이터베이스에
  ///토큰저장.

  const { email, password } = req.body;
  User.findOne({
    email,
  }).exec((err, userInfo) => {
    if (err) return res.send({ success: false, err });
    if (!userInfo) return res.send({ success: false, msg: "Email not found." });
    userInfo.comparePassword(password, (err, isMatch) => {
      if (err) return res.send({ success: false, err });
      if (!isMatch) return res.send({ success: false, msg: "Wrong Password." });

      userInfo.generateToken((err, userinfo) => {
        if (err) return res.send({ success: false, err });

        res.cookie("x_auth", userinfo.token, {
          sameSite: "none",
          secure: true,
          httpOnly: true,
        });
        return res.send({ success: true });
      });
    });
  });
});

router.get("/auth", auth, (req, res) => {
  res.send({
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    gender: req.user.gender,
    age: req.user.age,
    isAuth: true,
    isAdmin: req.user.role === 1,
    image: req.user.image,
    emailCertificated: req.user.emailCertificated,
    passwordReset: req.user.passwordReset,
  });
});

router.get("/logout", auth, (req, res) => {
  User.findOneAndUpdate(
    {
      _id: req.user._id,
    },
    {
      token: "",
    }
  ).exec((err, userInfo) => {
    if (err) res.send({ success: false, err });
    return res.send({ success: true });
  });
});

//받아온 authcode와 데이터베이스의 authcode가 같은지 확인.
router.post("/email/certificate", auth, (req, res) => {
  const { authCode } = req.body;

  console.log(authCode);
  User.findOne({
    _id: req.user._id,
  }).exec((err, userInfo) => {
    if (err) return res.send({ success: false, err });

    userInfo.verifyAuthCode(authCode, (err, isMatch) => {
      if (err) return res.send({ success: false, err });
      if (!isMatch) return res.send({ success: false, msg: "Wrong Auth Code" });

      ///여기까지 오면 이메일 인증 성공이다.
      User.findOneAndUpdate(
        {
          _id: userInfo._id,
        },
        {
          emailCertificated: true,
        }
      ).exec((err, info) => {
        if (err) return res.send({ success: false, err });
        return res.send({ success: true, emailCertificated: true });
      });
    });
  });
});

router.post("/resetPassword", (req, res) => {
  const { email } = req.body;

  User.findOne({
    email,
  }).exec((err, userInfo) => {
    if (err) res.send({ success: false, err });
    if (!userInfo) res.send({ success: false, msg: "Email not found" });
    const randomPw = generateRandomPassword();
    userInfo.generateNewPassword(randomPw, (err, hashPw) => {
      if (err) return res.send({ success: false, err });

      User.findOneAndUpdate(
        {
          _id: userInfo._id,
        },
        {
          password: hashPw,
          passwordReset: true,
        }
      ).exec((err, info) => {
        if (err) return res.send({ success: false, err });

        mailSender.sendGmail({
          toEmail: email,
          subject: "We initialized your password! Check it out!",
          text: `Your new password is... : [${randomPw}]`,
        });

        return res.send({ success: true, resetPassword: true });
      });
    });
  });
});

router.post("/updatePassword", auth, (req, res) => {
  const { password } = req.body;
  User.findOne({
    _id: req.user._id,
  }).exec((err, userInfo) => {
    if (err) return res.send({ success: false, err });
    if (!userInfo) return res.send({ success: false, msg: "User not found" });

    userInfo.generateNewPassword(password, (err, hashPw) => {
      if (err) return res.send({ success: false, err });

      User.findOneAndUpdate(
        {
          _id: userInfo._id,
        },
        {
          password: hashPw,
          passwordReset: false,
        }
      ).exec((err, info) => {
        if (err) return res.send({ success: false, err });
        return res.send({ success: true, resetPassword: true });
      });
    });
  });
});
module.exports = router;

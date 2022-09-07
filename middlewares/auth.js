const User = require("../models/User");

function auth(req, res, next) {
  const token = req.cookies.x_auth;

  User.findOneByToken(token, (err, userInfo) => {
    if (err) return next(err);

    if (!userInfo) {
      return res.send({
        isAuth: false,
        error: true,
      });
    }

    req.user = userInfo;
    req.token = token;
    next();
  });
}

module.exports = auth;

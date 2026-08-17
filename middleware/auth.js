const jwt = require("jsonwebtoken");

const COOKIE_NAME = "token";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function readUserId(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch (err) {
    return null;
  }
}

function attachUser(req, res, next) {
  req.userId = readUserId(req);
  next();
}

function requireAuth(req, res, next) {
  req.userId = readUserId(req);
  if (!req.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

module.exports = { COOKIE_NAME, cookieOptions, signToken, attachUser, requireAuth };

const jwt = require("jsonwebtoken");

const COOKIE_NAME = "token";
// 400 days: the longest lifetime Chromium-based browsers will actually honor
// for a cookie (they silently clamp anything longer), so this keeps you
// signed in as close to "log in once" as a cookie can get.
const SESSION_DAYS = 400;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
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
  // Sliding session: re-issue the cookie on every authenticated request so the
  // 400-day clock resets while the app is in regular use, instead of counting
  // down from the original login.
  res.cookie(COOKIE_NAME, signToken(req.userId), cookieOptions());
  next();
}

module.exports = { COOKIE_NAME, cookieOptions, signToken, attachUser, requireAuth };

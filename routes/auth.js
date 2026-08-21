const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { COOKIE_NAME, cookieOptions, signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const password = req.body.password || "";

  if (!email || password.length < 6) {
    return res.status(400).json({ error: "Email and a password of at least 6 characters are required." });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });

  res.cookie(COOKIE_NAME, signToken(user._id), cookieOptions());
  res.status(201).json({ email: user.email, name: user.name });
});

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const password = req.body.password || "";

  const user = await User.findOne({ email });
  const valid = user && (await user.comparePassword(password));
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  res.cookie(COOKIE_NAME, signToken(user._id), cookieOptions());
  res.json({ email: user.email, name: user.name });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("email name");
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: user.email, name: user.name });
});

router.put("/name", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });

  const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true }).select("email name");
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: user.email, name: user.name });
});

module.exports = router;

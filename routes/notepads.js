const express = require("express");
const User = require("../models/User");
const Notepad = require("../models/Notepad");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const ADMIN_EMAIL = "saadamin691@gmail.com";

// Scoped to the paths this router owns. Unscoped, the admin check below
// rejected every other /api route for the admin account, including ones
// mounted after this router.
router.use("/notepads", requireAuth);

// Custom notepads are only for non-admin accounts; the admin keeps the fixed
// Quantum Logics Income / Poly Learning Foundation sections instead.
router.use("/notepads", async (req, res, next) => {
  const user = await User.findById(req.userId).select("email");
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (user.email === ADMIN_EMAIL) return res.status(403).json({ error: "Not available for this account" });
  next();
});

router.get("/notepads", async (req, res) => {
  const docs = await Notepad.find({ user: req.userId }).sort({ createdAt: 1 });
  res.json(docs);
});

router.post("/notepads", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });
  const hasBudget = !!req.body.hasBudget;
  const doc = await Notepad.create({ user: req.userId, name, hasBudget, budget: 0, items: [] });
  res.status(201).json(doc);
});

router.put("/notepads/:id", async (req, res) => {
  const { items, budget, name } = req.body;
  const update = { items: Array.isArray(items) ? items : [] };
  if (typeof budget === "number") update.budget = budget;
  if (typeof name === "string" && name.trim()) update.name = name.trim();

  const doc = await Notepad.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { $set: update }, { new: true });
  if (!doc) return res.status(404).json({ error: "Notepad not found." });
  res.json(doc);
});

router.delete("/notepads/:id", async (req, res) => {
  const doc = await Notepad.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!doc) return res.status(404).json({ error: "Notepad not found." });
  res.json({ ok: true });
});

module.exports = router;

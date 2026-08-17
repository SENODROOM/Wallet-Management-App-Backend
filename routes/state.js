const express = require("express");
const Section = require("../models/Section");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const VALID_SECTIONS = ["income", "poly", "monthly"];

router.use(requireAuth);

router.get("/state", async (req, res) => {
  const docs = await Section.find({ user: req.userId });
  const state = {
    income: { budget: 0, items: [] },
    poly: { budget: 0, items: [] },
    monthly: { budget: 0, items: [] }
  };
  docs.forEach((doc) => {
    state[doc.section] = { budget: doc.budget, items: doc.items };
  });
  res.json(state);
});

router.put("/state/:section", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: "Invalid section" });
  }

  const { budget, items } = req.body;
  const update = { items: Array.isArray(items) ? items : [] };
  if (typeof budget === "number") update.budget = budget;

  const doc = await Section.findOneAndUpdate(
    { user: req.userId, section },
    { $set: update },
    { upsert: true, new: true }
  );
  res.json(doc);
});

module.exports = router;

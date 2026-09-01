const express = require("express");
const Section = require("../models/Section");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const VALID_SECTIONS = ["income", "poly", "monthly", "wallets"];

router.use(requireAuth);

router.get("/state", async (req, res) => {
  const docs = await Section.find({ user: req.userId });
  const state = {
    income: { budget: 0, items: [], description: "", period: "" },
    poly: { budget: 0, items: [], description: "", period: "" },
    monthly: { budget: 0, items: [], description: "", period: "" },
    wallets: { budget: 0, items: [], description: "", period: "" }
  };
  docs.forEach((doc) => {
    state[doc.section] = {
      budget: doc.budget,
      items: doc.items,
      description: doc.description,
      period: doc.period || ""
    };
  });
  res.json(state);
});

router.put("/state/:section", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: "Invalid section" });
  }

  const { budget, items, description, period } = req.body;
  const update = { items: Array.isArray(items) ? items : [] };
  if (typeof budget === "number") update.budget = budget;
  if (typeof description === "string") update.description = description;
  // Every monthly save re-stamps the month it belongs to, so entries can never
  // drift into the wrong period if a tab is left open past the 1st.
  if (section === "monthly" && typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    update.period = period;
  }

  const doc = await Section.findOneAndUpdate(
    { user: req.userId, section },
    { $set: update },
    { upsert: true, new: true }
  );
  res.json(doc);
});

module.exports = router;

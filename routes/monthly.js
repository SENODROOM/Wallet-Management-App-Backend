const express = require("express");
const Section = require("../models/Section");
const MonthlyArchive = require("../models/MonthlyArchive");
const { requireAuth } = require("../middleware/auth");
const { isPeriod, planRollover } = require("../lib/period");

const router = express.Router();

router.use(requireAuth);

function sumItems(items) {
  return (items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

function liveView(doc) {
  return {
    budget: doc.budget,
    items: doc.items,
    description: doc.description,
    period: doc.period || ""
  };
}

function summarize(doc) {
  return {
    period: doc.period,
    budget: doc.budget,
    total: sumItems(doc.items),
    count: (doc.items || []).length,
    archivedAt: doc.archivedAt
  };
}

async function historyFor(userId) {
  const docs = await MonthlyArchive.find({ user: userId }).sort({ period: 1 });
  return docs.map(summarize);
}

// Opens `period` as the live month. The month boundary is the client's, not the
// server's — the browser knows the user's timezone and the server does not — so
// the period comes in from the client, and this is a no-op whenever the live
// section already sits in it. Called on load, and again if a tab is left open
// across midnight on the 1st.
router.post("/monthly/rollover", async (req, res) => {
  const period = String(req.body.period || "");
  if (!isPeriod(period)) return res.status(400).json({ error: "Invalid period" });

  let doc = await Section.findOne({ user: req.userId, section: "monthly" });
  if (!doc) {
    doc = await Section.create({ user: req.userId, section: "monthly", period, items: [] });
    return res.json({ period, archived: null, monthly: liveView(doc), history: [] });
  }

  const plan = planRollover(doc, period);

  for (const archive of plan.archives) {
    await MonthlyArchive.findOneAndUpdate(
      { user: req.userId, period: archive.period },
      {
        $set: {
          budget: archive.budget,
          description: archive.description,
          items: archive.items.map((item) => ({ day: item.day, name: item.name, price: item.price })),
          archivedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  if (plan.keep) {
    // The budget amount is the recurring monthly allowance, so it carries
    // forward; the entries left behind are the ones dated in the new month.
    doc.items = plan.keep.map((item) => ({ day: item.day, name: item.name, price: item.price }));
  }
  if (plan.reset) doc.description = "";
  doc.period = plan.period;
  if (doc.isModified()) await doc.save();

  res.json({
    period: doc.period,
    archived: plan.archives.length ? plan.archives[plan.archives.length - 1].period : null,
    monthly: liveView(doc),
    history: await historyFor(req.userId)
  });
});

router.get("/monthly/history", async (req, res) => {
  res.json({ history: await historyFor(req.userId) });
});

router.get("/monthly/history/:period", async (req, res) => {
  const { period } = req.params;
  if (!isPeriod(period)) return res.status(400).json({ error: "Invalid period" });
  const doc = await MonthlyArchive.findOne({ user: req.userId, period });
  if (!doc) return res.status(404).json({ error: "No record for that month." });
  res.json({
    period: doc.period,
    budget: doc.budget,
    description: doc.description,
    items: doc.items,
    archivedAt: doc.archivedAt
  });
});

module.exports = router;

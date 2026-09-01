const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    day: { type: String, default: "" },
    name: { type: String, default: "" },
    price: { type: Number, default: 0 }
  },
  { _id: false }
);

// A closed month: the Monthly Budget exactly as it stood when the next month
// opened. Written once by the rollover, then kept as a read-only record.
const monthlyArchiveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // "YYYY-MM" — sorts and compares as a plain string.
  period: { type: String, required: true },
  budget: { type: Number, default: 0 },
  description: { type: String, default: "" },
  items: { type: [itemSchema], default: [] },
  archivedAt: { type: Date, default: Date.now }
});

monthlyArchiveSchema.index({ user: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("MonthlyArchive", monthlyArchiveSchema);

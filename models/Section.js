const mongoose = require("mongoose");

const walletSubItemSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    price: { type: Number, default: 0 }
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    day: { type: String, default: "" },
    name: { type: String, default: "" },
    price: { type: Number, default: 0 },
    // Only used by the "wallets" section: itemized entries nested under a wallet.
    items: { type: [walletSubItemSchema], default: undefined }
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  section: {
    type: String,
    required: true,
    enum: ["income", "poly", "monthly", "wallets"]
  },
  budget: { type: Number, default: 0 },
  description: { type: String, default: "" },
  items: { type: [itemSchema], default: [] }
});

sectionSchema.index({ user: 1, section: 1 }, { unique: true });

module.exports = mongoose.model("Section", sectionSchema);

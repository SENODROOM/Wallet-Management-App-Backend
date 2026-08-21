const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    price: { type: Number, default: 0 }
  },
  { _id: false }
);

const notepadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  hasBudget: { type: Boolean, default: false },
  budget: { type: Number, default: 0 },
  items: { type: [itemSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notepad", notepadSchema);

require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const stateRoutes = require("./routes/state");
const authRoutes = require("./routes/auth");
const { attachUser } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || !process.env.JWT_SECRET) {
  console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env and set them.");
  process.exit(1);
}

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

app.use(express.json());
app.use(cookieParser());
app.use(express.static(FRONTEND_DIR));

app.use("/api/auth", authRoutes);
app.use("/api", stateRoutes);

app.get("/", attachUser, (req, res) => {
  if (!req.userId) return res.redirect("/login.html");
  res.sendFile(path.join(FRONTEND_DIR, "notepad.html"));
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Wallet Notepad running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

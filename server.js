require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const stateRoutes = require("./routes/state");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

app.use(express.json());
app.use(cookieParser());
app.use(express.static(FRONTEND_DIST));

// Reuse the connection across invocations instead of reconnecting (and
// blocking startup) on every serverless cold start.
let connectPromise = null;
function ensureDbConnection() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connectPromise) {
    connectPromise = mongoose.connect(MONGODB_URI).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

app.use("/api", async (req, res, next) => {
  if (!MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Missing MONGODB_URI or JWT_SECRET.");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  try {
    await ensureDbConnection();
    next();
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    res.status(500).json({ error: "Database unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api", stateRoutes);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"), (err) => {
    if (err) res.status(200).send("Wallet Notepad API is running.");
  });
});

// Vercel imports this module and calls the exported app per request; it
// never runs the block below, so a missing/bad connection fails just that
// one request (handled above) instead of crashing the whole function.
if (!process.env.VERCEL) {
  if (!MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env and set them.");
    process.exit(1);
  }
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
}

module.exports = app;

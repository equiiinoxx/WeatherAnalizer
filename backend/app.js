const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const pool = require("./config/db");
const importRoutes = require("./routes/importRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const analysisRoutes = require("./routes/analysisRoutes");

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

// Serve generated matplotlib charts from analysis/charts
const chartsDir = path.resolve(__dirname, "..", "analysis", "charts");
app.use("/api/charts", express.static(chartsDir));

// Route handlers
app.use("/api/import", importRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/analysis", analysisRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Weather Data Analysis API is running",
    endpoints: {
      health: "/api/health",
      import: "/api/import/batches",
      records: "/api/weather/records",
      summary: "/api/weather/summary",
      trends: "/api/weather/trends",
      analysis: "/api/analysis/latest"
    }
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name, NOW() AS server_time"
    );

    res.json({
      status: "ok",
      database: rows[0].database_name,
      serverTime: rows[0].server_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      status: "error",
      message: "Unable to connect to the database",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Weather API running at http://localhost:${PORT}`);
});
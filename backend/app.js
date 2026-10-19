const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const pool = require("./config/db");
const weatherRoutes = require("./routes/weatherRoutes");
const analysisRoutes = require("./routes/analysisRoutes");

const app = express();

// CORS configuration for local React frontend at http://localhost:5173
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve generated matplotlib charts from analysis/charts
const chartsDir = path.resolve(__dirname, "..", "analysis", "charts");
app.use("/api/charts", express.static(chartsDir));

// Route handlers
app.use("/api/weather", weatherRoutes);
app.use("/api/analysis", analysisRoutes);

// Root informational endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Weather Data Analysis API is running",
    endpoints: {
      health: "GET /api/health",
      weather: "GET /api/weather",
      locations: "GET /api/weather/locations",
      upload: "POST /api/weather/upload",
      imports: "GET /api/weather/imports",
      importIssues: "GET /api/weather/imports/:batchId/issues",
      qualityIssues: "GET /api/weather/quality-issues",
      summary: "GET /api/weather/summary",
      trends: "GET /api/weather/trends",
      export: "GET /api/weather/export",
      analysis: "GET /api/analysis/latest"
    }
  });
});

// Health check endpoint
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

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Weather API running at http://localhost:${PORT}`);
  });
}

module.exports = app;
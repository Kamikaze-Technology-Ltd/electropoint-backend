// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();

// Get allowed origins from environment or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "https://electropointhub.com",
      "https://www.electropointhub.com",
      "http://localhost:3000",
      "http://localhost:5173", // Vite dev server
    ];

// Get environment
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment =
  process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log("Allowed Origins:", allowedOrigins);

// Dynamic CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin && isDevelopment) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log("CORS blocked for origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

// Configure Helmet based on environment
const helmetConfig = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false,
};

if (isProduction) {
  // Production CSP
  helmetConfig.contentSecurityPolicy = {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https://electropointhub.com",
        "https://www.electropointhub.com",
        "https://api.electropointhub.com",
        "http://localhost:3000",
        "http://localhost:5000",
        "https:",
      ],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://electropointhub.com",
        "https://js.paystack.co", // ✅ Added Paystack
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "connect-src": [
        "'self'",
        "https://electropointhub.com",
        "https://www.electropointhub.com",
        "https://api.electropointhub.com",
        "https://api.paystack.co", // ✅ Paystack API
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",
        "ws://localhost:3000",
        "ws://localhost:5000",
        "ws://localhost:5173",
      ],
    },
  };
} else {
  // Development CSP - more permissive
  helmetConfig.contentSecurityPolicy = {
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:", "http:", "https:"],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "http:",
        "https:",
      ],
      "style-src": ["'self'", "'unsafe-inline'", "http:", "https:"],
      "font-src": ["'self'", "data:", "http:", "https:"],
      "connect-src": ["'self'", "http:", "https:", "ws:", "wss:"],
    },
  };
}

// ✅ Helmet BEFORE cors
app.use(helmet(helmetConfig));

// ✅ Handle OPTIONS preflight globally BEFORE all routes
app.options("*", cors(corsOptions));

app.use(cors(corsOptions));
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Dynamic origin middleware for static files
const dynamicOriginMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (isDevelopment) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
};

// Serve uploaded files with dynamic origin handling
app.use(
  "/uploads",
  dynamicOriginMiddleware,
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        res.setHeader("Cache-Control", "public, max-age=31536000");
      }
    },
  }),
);

// Routes
app.use("/api/auth", dynamicOriginMiddleware, require("./routes/auth"));
app.use("/api/products", dynamicOriginMiddleware, require("./routes/products"));
app.use(
  "/api/categories",
  dynamicOriginMiddleware,
  require("./routes/categories"),
);
app.use("/api/cart", dynamicOriginMiddleware, require("./routes/cart"));
app.use("/api/wishlist", dynamicOriginMiddleware, require("./routes/wishlist"));
app.use("/api/orders", dynamicOriginMiddleware, require("./routes/orders"));
app.use("/api/reviews", dynamicOriginMiddleware, require("./routes/reviews"));
app.use("/api/coupons", dynamicOriginMiddleware, require("./routes/coupons"));
app.use(
  "/api/newsletter",
  dynamicOriginMiddleware,
  require("./routes/newsletter"),
);
app.use("/api/admin", dynamicOriginMiddleware, require("./routes/admin"));
app.use("/api/wallet", dynamicOriginMiddleware, require("./routes/wallet"));
app.use("/api/seller", dynamicOriginMiddleware, require("./routes/seller"));

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    allowedOrigins: allowedOrigins,
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    name: "Electropoint Hub API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    status: "online",
    documentation: "https://electropointhub.com/api-docs",
    support: "brabadan13@gmail.com",
  });
});

// API documentation route
app.get("/api", (req, res) => {
  res.json({
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      categories: "/api/categories",
      cart: "/api/cart",
      wishlist: "/api/wishlist",
      orders: "/api/orders",
      reviews: "/api/reviews",
      coupons: "/api/coupons",
      newsletter: "/api/newsletter",
      admin: "/api/admin",
      wallet: "/api/wallet",
      seller: "/api/seller",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  res.status(err.status || 500).json({
    message: isProduction ? "Something went wrong!" : err.message,
    error: isProduction
      ? {}
      : {
          message: err.message,
          stack: err.stack,
        },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    requestedUrl: req.originalUrl,
    method: req.method,
    availableEndpoints: "/api",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📡 Allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

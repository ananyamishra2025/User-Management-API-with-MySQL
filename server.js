const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

// Handle malformed JSON body errors gracefully
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      if (buf && buf.length) {
        JSON.parse(buf.toString(encoding || 'utf8'));
      }
    } catch (e) {
      req.invalidJson = true;
    }
  }
}));

app.use((req, res, next) => {
  if (req.invalidJson) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload format. Please check request body syntax.'
    });
  }
  next();
});

app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP API] ${req.method} ${req.originalUrl} -> Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
app.use('/api', userRoutes);

// SPA Fallback / Serve Frontend
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `Endpoint '${req.originalUrl}' not found.` });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Server Initialization
async function startServer() {
  console.log('----------------------------------------------------');
  console.log('🤖 Starting Humanoid User Management API Service...');
  
  const dbSuccess = await initializeDatabase();
  if (!dbSuccess) {
    console.warn('⚠️ Warning: MySQL database connection failed. Make sure MySQL service is running and credentials in .env are correct.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 REST API & Humanoid Control Dashboard running at: http://localhost:${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    console.log(`📊 Stats URL: http://localhost:${PORT}/api/stats`);
    console.log('----------------------------------------------------');
  });
}

startServer();

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(cors());

// Lazy DB initialization middleware for Vercel Serverless
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
  } catch (e) {
    console.error('[DB Init Error]:', e);
  }
  next();
});

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
app.use('/', userRoutes);

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

/**
 * Starts express server with automatic port fallback if port is in use
 */
function listenOnPort(expressApp, port) {
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(port);

    server.once('listening', () => {
      resolve({ server, port });
    });

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${port} is currently in use. Automatically trying port ${port + 1}...`);
        resolve(listenOnPort(expressApp, port + 1));
      } else {
        reject(err);
      }
    });
  });
}

// Local Server Initialization (skipped on Vercel)
if (!process.env.VERCEL) {
  (async function startServer() {
    console.log('----------------------------------------------------');
    console.log('🚀 Starting User Management REST API Service...');
    
    await initializeDatabase();

    try {
      const { port } = await listenOnPort(app, DEFAULT_PORT);
      console.log(`🚀 REST API & Control Dashboard running at: http://localhost:${port}`);
      console.log(`📡 Health Check URL: http://localhost:${port}/api/health`);
      console.log(`📊 Stats URL: http://localhost:${port}/api/stats`);
      console.log('----------------------------------------------------');
    } catch (err) {
      console.error('❌ Failed to start HTTP server:', err);
    }
  })();
}

// Export Express app for Vercel Serverless Function engine
module.exports = app;

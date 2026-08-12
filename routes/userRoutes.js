const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { checkHealth } = require('../config/db');

// Health Check Endpoint
router.get('/health', async (req, res) => {
  const health = await checkHealth();
  return res.status(200).json(health);
});

// Telemetry & Stats Endpoint
router.get('/stats', userController.getStats);

// Database Seeder Endpoint
router.post('/seed', userController.seedDatabase);

// REST API CRUD Endpoints
router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserById);
router.post('/users', userController.createUser);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;

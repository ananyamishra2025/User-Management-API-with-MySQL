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

// Authentication Endpoints & Aliases
router.post('/auth/login', userController.login);
router.post('/login', userController.login);
router.post('/users/login', userController.login);

router.post('/auth/register', userController.register);
router.post('/register', userController.register);
router.post('/users/register', userController.register);

router.get('/auth/me', userController.getProfile);
router.get('/me', userController.getProfile);
router.get('/profile', userController.getProfile);
router.get('/users/me', userController.getProfile);

// REST API CRUD Endpoints
router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserById);
router.post('/users', userController.createUser);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;

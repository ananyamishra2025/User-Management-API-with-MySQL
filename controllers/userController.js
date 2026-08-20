const UserModel = require('../models/userModel');

/**
 * Controller for User REST API Endpoints
 */

// GET /api/users
exports.getUsers = async (req, res, next) => {
  try {
    const { search, role, status, sortBy, order, limit, offset } = req.query;
    const result = await UserModel.findAll({ search, role, status, sortBy, order, limit, offset });

    return res.status(200).json({
      success: true,
      count: result.users.length,
      total: result.total,
      data: result.users,
      queryExecuted: result.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id
exports.getUserById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Entity ID format. ID must be a numeric integer.' });
    }

    const result = await UserModel.findById(id);
    if (!result.user) {
      return res.status(404).json({ success: false, message: `Entity with ID ${id} not found in database.` });
    }

    return res.status(200).json({
      success: true,
      data: result.user,
      queryExecuted: result.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/users
exports.createUser = async (req, res, next) => {
  try {
    const { username, email, full_name, role, status, biometric_id, avatar_url } = req.body;

    // Validation
    if (!username || !email || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Required fields (username, email, full_name) are missing.'
      });
    }

    // Check duplicate
    const existing = await UserModel.findExisting({ username, email, biometric_id });
    if (existing) {
      if (existing.username === username) {
        return res.status(409).json({ success: false, message: `Conflict: Username '${username}' is already registered.` });
      }
      if (existing.email === email) {
        return res.status(409).json({ success: false, message: `Conflict: Email '${email}' is already registered.` });
      }
      if (biometric_id && existing.biometric_id === biometric_id) {
        return res.status(409).json({ success: false, message: `Conflict: Biometric ID '${biometric_id}' is already registered.` });
      }
    }

    const created = await UserModel.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role,
      status,
      biometric_id,
      avatar_url
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully in database.',
      data: created.user,
      queryExecuted: created.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format.' });
    }

    const { username, email, full_name, role, status, biometric_id, avatar_url } = req.body;

    // Check duplicate if updating username, email, or biometric_id
    if (username || email || biometric_id) {
      const existing = await UserModel.findExisting({ username, email, biometric_id, excludeId: id });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Conflict: Unique field constraint violation (username, email, or biometric_id already exists).'
        });
      }
    }

    const updated = await UserModel.update(id, {
      username,
      email: email ? email.toLowerCase() : undefined,
      full_name,
      role,
      status,
      biometric_id,
      avatar_url
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: `User with ID ${id} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: `User ID ${id} updated successfully.`,
      data: updated.user,
      queryExecuted: updated.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format.' });
    }

    const result = await UserModel.remove(id);
    if (!result) {
      return res.status(404).json({ success: false, message: `User with ID ${id} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: `User ID ${id} removed permanently from database.`,
      deletedUser: result.deletedUser,
      queryExecuted: result.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/seed
exports.seedDatabase = async (req, res, next) => {
  try {
    const result = await UserModel.seedDefaultData();
    return res.status(200).json({
      success: true,
      message: 'Sample records seeded successfully into database.',
      result,
      queryExecuted: result.executedQuery
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/stats
exports.getStats = async (req, res, next) => {
  try {
    const stats = await UserModel.getSystemStats();
    return res.status(200).json({
      success: true,
      telemetry: stats
    });
  } catch (error) {
    next(error);
  }
};

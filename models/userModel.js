const { getActiveEngine, getMysqlPool, sqliteRun, sqliteAll, sqliteGet, getInMemoryStore } = require('../config/db');

class UserModel {
  /**
   * Fetch all users with search, role filter, status filter, and pagination
   */
  static async findAll({ search, role, status, sortBy = 'id', order = 'DESC', limit = 100, offset = 0 } = {}) {
    const engine = getActiveEngine();

    // 1. MySQL Engine
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      let sql = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      if (search) {
        sql += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ? OR biometric_id LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }
      if (role && role !== 'All') {
        sql += ' AND role = ?';
        params.push(role);
      }
      if (status && status !== 'All') {
        sql += ' AND status = ?';
        params.push(status);
      }

      const allowedSortCols = ['id', 'username', 'email', 'full_name', 'role', 'status', 'created_at'];
      const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'id';
      const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      sql += ` ORDER BY ${safeSortBy} ${safeOrder} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const [rows] = await pool.query(sql, params);

      let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
      const countParams = [];
      if (search) {
        countSql += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ? OR biometric_id LIKE ?)';
        const term = `%${search}%`;
        countParams.push(term, term, term, term);
      }
      if (role && role !== 'All') {
        countSql += ' AND role = ?';
        countParams.push(role);
      }
      if (status && status !== 'All') {
        countSql += ' AND status = ?';
        countParams.push(status);
      }

      const [countRows] = await pool.query(countSql, countParams);

      return {
        users: rows,
        total: countRows[0].total,
        executedQuery: { sql, params }
      };
    }

    // 2. SQLite Engine
    if (engine === 'SQLITE') {
      let sql = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      if (search) {
        sql += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ? OR biometric_id LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }
      if (role && role !== 'All') {
        sql += ' AND role = ?';
        params.push(role);
      }
      if (status && status !== 'All') {
        sql += ' AND status = ?';
        params.push(status);
      }

      const allowedSortCols = ['id', 'username', 'email', 'full_name', 'role', 'status', 'created_at'];
      const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'id';
      const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      sql += ` ORDER BY ${safeSortBy} ${safeOrder} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const rows = await sqliteAll(sql, params);

      let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
      const countParams = [];
      if (search) {
        countSql += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ? OR biometric_id LIKE ?)';
        const term = `%${search}%`;
        countParams.push(term, term, term, term);
      }
      if (role && role !== 'All') {
        countSql += ' AND role = ?';
        countParams.push(role);
      }
      if (status && status !== 'All') {
        countSql += ' AND status = ?';
        countParams.push(status);
      }

      const countRow = await sqliteGet(countSql, countParams);

      return {
        users: rows,
        total: countRow.total,
        executedQuery: { sql, params }
      };
    }

    // 3. In-Memory Store Fallback
    const { inMemoryUsers } = getInMemoryStore();
    let filtered = [...inMemoryUsers];

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.full_name.toLowerCase().includes(term) ||
        (u.biometric_id && u.biometric_id.toLowerCase().includes(term))
      );
    }
    if (role && role !== 'All') {
      filtered = filtered.filter(u => u.role === role);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter(u => u.status === status);
    }

    const total = filtered.length;
    const safeOrderMultiplier = order.toUpperCase() === 'ASC' ? 1 : -1;
    filtered.sort((a, b) => (a.id > b.id ? 1 : -1) * safeOrderMultiplier);

    const paginated = filtered.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

    return {
      users: paginated,
      total,
      executedQuery: { sql: `SELECT * FROM users (In-Memory Standby Engine)`, params: [] }
    };
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const sql = 'SELECT * FROM users WHERE id = ?';
      const [rows] = await pool.query(sql, [id]);
      return {
        user: rows[0] || null,
        executedQuery: { sql, params: [id] }
      };
    }

    if (engine === 'SQLITE') {
      const sql = 'SELECT * FROM users WHERE id = ?';
      const user = await sqliteGet(sql, [id]);
      return {
        user: user || null,
        executedQuery: { sql, params: [id] }
      };
    }

    const { inMemoryUsers } = getInMemoryStore();
    const user = inMemoryUsers.find(u => u.id === Number(id)) || null;
    return {
      user,
      executedQuery: { sql: 'SELECT * FROM users WHERE id = ?', params: [id] }
    };
  }

  /**
   * Check duplicates
   */
  static async findExisting({ username, email, biometric_id, excludeId = null }) {
    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      let sql = 'SELECT * FROM users WHERE (username = ? OR email = ?';
      const params = [username, email];

      if (biometric_id) {
        sql += ' OR biometric_id = ?';
        params.push(biometric_id);
      }
      sql += ')';

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const [rows] = await pool.query(sql, params);
      return rows[0] || null;
    }

    if (engine === 'SQLITE') {
      let sql = 'SELECT * FROM users WHERE (username = ? OR email = ?';
      const params = [username, email];

      if (biometric_id) {
        sql += ' OR biometric_id = ?';
        params.push(biometric_id);
      }
      sql += ')';

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const row = await sqliteGet(sql, params);
      return row || null;
    }

    const { inMemoryUsers } = getInMemoryStore();
    return inMemoryUsers.find(u =>
      (u.id !== Number(excludeId)) &&
      (u.username.toLowerCase() === username.toLowerCase() ||
       u.email.toLowerCase() === email.toLowerCase() ||
       (biometric_id && u.biometric_id && u.biometric_id.toLowerCase() === biometric_id.toLowerCase()))
    ) || null;
  }

  /**
   * Create user
   */
  static async create({ username, email, full_name, role = 'User', status = 'Active', biometric_id, avatar_url }) {
    const generatedBiometric = biometric_id || `BIO-${Math.floor(1000 + Math.random() * 9000)}-${username.slice(0, 2).toUpperCase()}`;
    const generatedAvatar = avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const sql = `
        INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [username, email, full_name, role, status, generatedBiometric, generatedAvatar];
      const [result] = await pool.query(sql, params);
      const created = await this.findById(result.insertId);

      return {
        id: result.insertId,
        user: created.user,
        executedQuery: { sql, params }
      };
    }

    if (engine === 'SQLITE') {
      const sql = `
        INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [username, email, full_name, role, status, generatedBiometric, generatedAvatar];
      const res = await sqliteRun(sql, params);
      const created = await this.findById(res.lastID);

      return {
        id: res.lastID,
        user: created.user,
        executedQuery: { sql, params }
      };
    }

    const store = getInMemoryStore();
    const newUser = {
      id: store.nextMemoryId++,
      username,
      email,
      full_name,
      role,
      status,
      biometric_id: generatedBiometric,
      avatar_url: generatedAvatar,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.inMemoryUsers.push(newUser);

    return {
      id: newUser.id,
      user: newUser,
      executedQuery: {
        sql: 'INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [username, email, full_name, role, status, generatedBiometric, generatedAvatar]
      }
    };
  }

  /**
   * Update user
   */
  static async update(id, { username, email, full_name, role, status, biometric_id, avatar_url }) {
    const existing = await this.findById(id);
    if (!existing.user) return null;

    const updatedUser = {
      username: username || existing.user.username,
      email: email || existing.user.email,
      full_name: full_name || existing.user.full_name,
      role: role || existing.user.role,
      status: status || existing.user.status,
      biometric_id: biometric_id || existing.user.biometric_id,
      avatar_url: avatar_url || existing.user.avatar_url
    };

    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const sql = `
        UPDATE users
        SET username = ?, email = ?, full_name = ?, role = ?, status = ?, biometric_id = ?, avatar_url = ?
        WHERE id = ?
      `;
      const params = [
        updatedUser.username,
        updatedUser.email,
        updatedUser.full_name,
        updatedUser.role,
        updatedUser.status,
        updatedUser.biometric_id,
        updatedUser.avatar_url,
        id
      ];

      await pool.query(sql, params);
      const freshUser = await this.findById(id);

      return {
        user: freshUser.user,
        executedQuery: { sql, params }
      };
    }

    if (engine === 'SQLITE') {
      const sql = `
        UPDATE users
        SET username = ?, email = ?, full_name = ?, role = ?, status = ?, biometric_id = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        updatedUser.username,
        updatedUser.email,
        updatedUser.full_name,
        updatedUser.role,
        updatedUser.status,
        updatedUser.biometric_id,
        updatedUser.avatar_url,
        id
      ];

      await sqliteRun(sql, params);
      const freshUser = await this.findById(id);

      return {
        user: freshUser.user,
        executedQuery: { sql, params }
      };
    }

    const { inMemoryUsers } = getInMemoryStore();
    const idx = inMemoryUsers.findIndex(u => u.id === Number(id));
    if (idx === -1) return null;

    const current = inMemoryUsers[idx];
    const updated = {
      ...current,
      username: username || current.username,
      email: email || current.email,
      full_name: full_name || current.full_name,
      role: role || current.role,
      status: status || current.status,
      biometric_id: biometric_id || current.biometric_id,
      avatar_url: avatar_url || current.avatar_url,
      updated_at: new Date().toISOString()
    };

    inMemoryUsers[idx] = updated;

    return {
      user: updated,
      executedQuery: {
        sql: 'UPDATE users SET username=?, email=?, full_name=?, role=?, status=?, biometric_id=?, avatar_url=? WHERE id=?',
        params: [updated.username, updated.email, updated.full_name, updated.role, updated.status, updated.biometric_id, updated.avatar_url, id]
      }
    };
  }

  /**
   * Delete user
   */
  static async remove(id) {
    const existing = await this.findById(id);
    if (!existing.user) return null;

    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const sql = 'DELETE FROM users WHERE id = ?';
      await pool.query(sql, [id]);

      return {
        deletedUser: existing.user,
        executedQuery: { sql, params: [id] }
      };
    }

    if (engine === 'SQLITE') {
      const sql = 'DELETE FROM users WHERE id = ?';
      await sqliteRun(sql, [id]);

      return {
        deletedUser: existing.user,
        executedQuery: { sql, params: [id] }
      };
    }

    const { inMemoryUsers } = getInMemoryStore();
    const idx = inMemoryUsers.findIndex(u => u.id === Number(id));
    if (idx === -1) return null;

    const [deletedUser] = inMemoryUsers.splice(idx, 1);

    return {
      deletedUser,
      executedQuery: { sql: 'DELETE FROM users WHERE id = ?', params: [id] }
    };
  }

  /**
   * Seed default data
   */
  static async seedDefaultData() {
    const engine = getActiveEngine();
    const sampleUsers = [
      ['nexus_prime', 'nexus.prime@cyber.io', 'Nexus Prime Unit 01', 'Humanoid-Core', 'Synchronized', 'BIO-9901-NX', 'https://api.dicebear.com/7.x/bottts/svg?seed=nexus_prime'],
      ['cyber_sentry', 'sentry.v2@cyber.io', 'Aria Vance', 'Cyber-Unit', 'Active', 'BIO-4412-AV', 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber_sentry'],
      ['synth_admin', 'admin.sys@cyber.io', 'Kaelen Thorne', 'Admin', 'Active', 'BIO-1002-KT', 'https://api.dicebear.com/7.x/bottts/svg?seed=synth_admin'],
      ['droid_vector', 'vector.droid@cyber.io', 'Vector-7 Droid', 'Android', 'Active', 'BIO-8821-VD', 'https://api.dicebear.com/7.x/bottts/svg?seed=droid_vector'],
      ['user_solaris', 'solaris@cyber.io', 'Elena Rostova', 'User', 'Inactive', 'BIO-3309-ER', 'https://api.dicebear.com/7.x/bottts/svg?seed=user_solaris']
    ];

    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const sql = `
        INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url)
        VALUES ?
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `;
      const [result] = await pool.query(sql, [sampleUsers]);
      return {
        affectedRows: result.affectedRows,
        executedQuery: { sql: 'INSERT INTO users (...) VALUES ? ON DUPLICATE KEY UPDATE...', params: `${sampleUsers.length} seed records` }
      };
    }

    if (engine === 'SQLITE') {
      for (const u of sampleUsers) {
        await sqliteRun(
          `INSERT OR IGNORE INTO users (username, email, full_name, role, status, biometric_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          u
        );
      }

      return {
        affectedRows: sampleUsers.length,
        executedQuery: { sql: 'INSERT OR IGNORE INTO users (...) VALUES (...)', params: `${sampleUsers.length} seed records` }
      };
    }

    return {
      affectedRows: 5,
      executedQuery: { sql: 'SEED (In-Memory Standby Engine)', params: [] }
    };
  }

  /**
   * Get telemetry stats
   */
  static async getSystemStats() {
    const engine = getActiveEngine();
    if (engine === 'MYSQL') {
      const pool = getMysqlPool();
      const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM users');
      const [statusRows] = await pool.query('SELECT status, COUNT(*) as count FROM users GROUP BY status');
      const [roleRows] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
      const [latestUser] = await pool.query('SELECT * FROM users ORDER BY id DESC LIMIT 1');

      const statusCounts = { Active: 0, Inactive: 0, Synchronized: 0, Quarantined: 0 };
      statusRows.forEach(r => { statusCounts[r.status] = r.count; });

      const roleCounts = { Admin: 0, User: 0, 'Cyber-Unit': 0, Android: 0, 'Humanoid-Core': 0 };
      roleRows.forEach(r => { roleCounts[r.role] = r.count; });

      return {
        totalUsers: totalRows[0].total,
        statusCounts,
        roleCounts,
        latestEntity: latestUser[0] || null
      };
    }

    if (engine === 'SQLITE') {
      const totalRow = await sqliteGet('SELECT COUNT(*) as total FROM users');
      const statusRows = await sqliteAll('SELECT status, COUNT(*) as count FROM users GROUP BY status');
      const roleRows = await sqliteAll('SELECT role, COUNT(*) as count FROM users GROUP BY role');
      const latestUser = await sqliteGet('SELECT * FROM users ORDER BY id DESC LIMIT 1');

      const statusCounts = { Active: 0, Inactive: 0, Synchronized: 0, Quarantined: 0 };
      statusRows.forEach(r => { statusCounts[r.status] = r.count; });

      const roleCounts = { Admin: 0, User: 0, 'Cyber-Unit': 0, Android: 0, 'Humanoid-Core': 0 };
      roleRows.forEach(r => { roleCounts[r.role] = r.count; });

      return {
        totalUsers: totalRow ? totalRow.total : 0,
        statusCounts,
        roleCounts,
        latestEntity: latestUser || null
      };
    }

    const { inMemoryUsers } = getInMemoryStore();
    const statusCounts = { Active: 0, Inactive: 0, Synchronized: 0, Quarantined: 0 };
    const roleCounts = { Admin: 0, User: 0, 'Cyber-Unit': 0, Android: 0, 'Humanoid-Core': 0 };

    inMemoryUsers.forEach(u => {
      if (statusCounts[u.status] !== undefined) statusCounts[u.status]++;
      if (roleCounts[u.role] !== undefined) roleCounts[u.role]++;
    });

    return {
      totalUsers: inMemoryUsers.length,
      statusCounts,
      roleCounts,
      latestEntity: inMemoryUsers[inMemoryUsers.length - 1] || null
    };
  }
}

module.exports = UserModel;

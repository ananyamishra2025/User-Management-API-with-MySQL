const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn('[Database Notice] sqlite3 native module not available in current environment:', e.message);
}

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10),
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const databaseName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'user_management_db';

let mysqlPool = null;
let sqliteDb = null;
let activeEngine = 'NONE'; // 'MYSQL', 'SQLITE', or 'MEMORY'
let lastErrorNotice = null;
let isInitDone = false;

// In-Memory store fallback for Serverless / Standby environments
let inMemoryUsers = [
  {
    id: 1,
    username: 'nexus_prime',
    email: 'nexus.prime@cyber.io',
    full_name: 'Nexus Prime Unit 01',
    role: 'Humanoid-Core',
    status: 'Synchronized',
    biometric_id: 'BIO-9901-NX',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=nexus_prime',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    username: 'cyber_sentry',
    email: 'sentry.v2@cyber.io',
    full_name: 'Aria Vance',
    role: 'Cyber-Unit',
    status: 'Active',
    biometric_id: 'BIO-4412-AV',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber_sentry',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    username: 'synth_admin',
    email: 'admin.sys@cyber.io',
    full_name: 'Kaelen Thorne',
    role: 'Admin',
    status: 'Active',
    biometric_id: 'BIO-1002-KT',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=synth_admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 4,
    username: 'droid_vector',
    email: 'vector.droid@cyber.io',
    full_name: 'Vector-7 Droid',
    role: 'Android',
    status: 'Active',
    biometric_id: 'BIO-8821-VD',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=droid_vector',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 5,
    username: 'user_solaris',
    email: 'solaris@cyber.io',
    full_name: 'Elena Rostova',
    role: 'User',
    status: 'Inactive',
    biometric_id: 'BIO-3309-ER',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=user_solaris',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let nextMemoryId = 6;

/**
 * Promisified SQLite run helper
 */
function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return reject(new Error('SQLite instance unavailable'));
    sqliteDb.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return reject(new Error('SQLite instance unavailable'));
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function sqliteGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return reject(new Error('SQLite instance unavailable'));
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Initialize relational SQL database (MySQL, SQLite, or In-Memory fallback)
 */
async function initializeDatabase() {
  if (isInitDone) return true;

  // Option A: Try MySQL first
  try {
    const rootConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 3000
    });

    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await rootConnection.end();

    mysqlPool = mysql.createPool({
      ...dbConfig,
      database: databaseName
    });

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`email\` VARCHAR(100) NOT NULL UNIQUE,
        \`full_name\` VARCHAR(100) NOT NULL,
        \`role\` ENUM('Admin', 'User', 'Cyber-Unit', 'Android', 'Humanoid-Core') NOT NULL DEFAULT 'User',
        \`status\` ENUM('Active', 'Inactive', 'Synchronized', 'Quarantined') NOT NULL DEFAULT 'Active',
        \`biometric_id\` VARCHAR(100) UNIQUE,
        \`avatar_url\` VARCHAR(255),
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_users_role\` (\`role\`),
        INDEX \`idx_users_status\` (\`status\`),
        INDEX \`idx_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await mysqlPool.query(createTableQuery);
    activeEngine = 'MYSQL';
    isInitDone = true;
    console.log(`[Database Core] Connected successfully to MySQL database '${databaseName}' at ${dbConfig.host}:${dbConfig.port}`);
    return true;
  } catch (mysqlErr) {
    lastErrorNotice = mysqlErr.message;
    console.warn(`[Database Notice] MySQL connection skipped (${mysqlErr.message}).`);
  }

  // Option B: SQLite relational database
  if (sqlite3) {
    try {
      // Use /tmp/ on Vercel / serverless if main folder is read-only
      const baseDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..');
      const dbPath = path.join(baseDir, 'user_management.sqlite');
      sqliteDb = new sqlite3.Database(dbPath);

      const createSqliteTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'User',
          status TEXT NOT NULL DEFAULT 'Active',
          biometric_id TEXT UNIQUE,
          avatar_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sqliteRun(createSqliteTable);

      const countRow = await sqliteGet('SELECT COUNT(*) as count FROM users');
      if (countRow.count === 0) {
        const seedSql = `
          INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url) VALUES
          ('nexus_prime', 'nexus.prime@cyber.io', 'Nexus Prime Unit 01', 'Humanoid-Core', 'Synchronized', 'BIO-9901-NX', 'https://api.dicebear.com/7.x/bottts/svg?seed=nexus_prime'),
          ('cyber_sentry', 'sentry.v2@cyber.io', 'Aria Vance', 'Cyber-Unit', 'Active', 'BIO-4412-AV', 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber_sentry'),
          ('synth_admin', 'admin.sys@cyber.io', 'Kaelen Thorne', 'Admin', 'Active', 'BIO-1002-KT', 'https://api.dicebear.com/7.x/bottts/svg?seed=synth_admin'),
          ('droid_vector', 'vector.droid@cyber.io', 'Vector-7 Droid', 'Android', 'Active', 'BIO-8821-VD', 'https://api.dicebear.com/7.x/bottts/svg?seed=droid_vector'),
          ('user_solaris', 'solaris@cyber.io', 'Elena Rostova', 'User', 'Inactive', 'BIO-3309-ER', 'https://api.dicebear.com/7.x/bottts/svg?seed=user_solaris');
        `;
        await sqliteRun(seedSql);
      }

      activeEngine = 'SQLITE';
      isInitDone = true;
      console.log(`[Database Core] SQLite relational database ready at: ${dbPath}`);
      return true;
    } catch (sqliteErr) {
      console.warn('[Database Notice] SQLite setup skipped:', sqliteErr.message);
    }
  }

  // Option C: In-Memory Fallback (Guarantees zero-crash on serverless platform)
  activeEngine = 'MEMORY';
  isInitDone = true;
  console.log(`[Database Core] Running in-memory database mode.`);
  return true;
}

/**
 * Health check monitor
 */
async function checkHealth() {
  await initializeDatabase();
  const startTime = Date.now();

  if (activeEngine === 'MYSQL' && mysqlPool) {
    try {
      const [rows] = await mysqlPool.query('SELECT COUNT(*) as count FROM users');
      return {
        status: 'Connected',
        engine: 'MySQL 8.0 Engine',
        database: databaseName,
        userCount: rows[0].count,
        latencyMs: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        status: 'Error',
        engine: 'MySQL Engine',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  if (activeEngine === 'SQLITE' && sqliteDb) {
    try {
      const row = await sqliteGet('SELECT COUNT(*) as count FROM users');
      return {
        status: 'Connected',
        engine: 'SQLite Relational Database',
        database: 'user_management.sqlite',
        userCount: row.count,
        latencyMs: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        status: 'Error',
        engine: 'SQLite Engine',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  return {
    status: 'Connected',
    engine: 'In-Memory Engine (Serverless Standby)',
    database: 'in_memory',
    userCount: inMemoryUsers.length,
    latencyMs: '<1ms',
    timestamp: new Date().toISOString()
  };
}

function getActiveEngine() {
  return activeEngine;
}

function getMysqlPool() {
  return mysqlPool;
}

function getInMemoryStore() {
  return { inMemoryUsers, nextMemoryId };
}

module.exports = {
  initializeDatabase,
  checkHealth,
  getActiveEngine,
  getMysqlPool,
  sqliteRun,
  sqliteAll,
  sqliteGet,
  getInMemoryStore
};

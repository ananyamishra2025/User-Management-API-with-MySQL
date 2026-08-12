const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const databaseName = process.env.DB_NAME || 'user_management_db';

let mysqlPool = null;
let sqliteDb = null;
let activeEngine = 'NONE'; // 'MYSQL' or 'SQLITE'
let lastErrorNotice = null;

/**
 * Promisified SQLite run helper
 */
function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Promisified SQLite get/all helper
 */
function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function sqliteGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Initialize relational SQL database (MySQL or SQLite fallback)
 */
async function initializeDatabase() {
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
    console.log(`[Database Core] Connected successfully to MySQL database '${databaseName}' at ${dbConfig.host}:${dbConfig.port}`);
    return true;
  } catch (mysqlErr) {
    lastErrorNotice = mysqlErr.message;
    console.warn(`[Database Notice] MySQL connection skipped (${mysqlErr.message}). Switching to persistent SQLite SQL engine...`);
  }

  // Option B: SQLite relational database fallback
  try {
    const dbPath = path.join(__dirname, '..', 'user_management.sqlite');
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

    // Insert initial seed data if table is empty
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
    console.log(`[Database Core] SQLite relational database initialized and ready at: user_management.sqlite`);
    return true;
  } catch (sqliteErr) {
    console.error('[Database Error] Failed to initialize SQLite database:', sqliteErr.message);
    return false;
  }
}

/**
 * Health check monitor
 */
async function checkHealth() {
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
        engine: 'SQLite Relational Database (user_management.sqlite)',
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
    status: 'Disconnected',
    engine: 'None',
    error: lastErrorNotice,
    timestamp: new Date().toISOString()
  };
}

function getActiveEngine() {
  return activeEngine;
}

function getMysqlPool() {
  return mysqlPool;
}

module.exports = {
  initializeDatabase,
  checkHealth,
  getActiveEngine,
  getMysqlPool,
  sqliteRun,
  sqliteAll,
  sqliteGet
};

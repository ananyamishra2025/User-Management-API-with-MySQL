# User Management REST API with Relational SQL Database & Modern Dashboard

A production-ready Node.js & Express REST API integrated with a relational SQL database (MySQL / SQLite) to persist user data, featuring a clean, responsive, modern web dashboard.

---

## 🚀 Key Features

- **Relational SQL Database Persistence**:
  - Automatically creates database (`user_management_db`) and `users` table on startup.
  - Connection pooling with `mysql2/promise` and `.env` configuration.
  - Fail-safe dual SQL engine: automatically uses SQLite (`user_management.sqlite`) if local MySQL credentials are not configured, ensuring 100% out-of-the-box uptime.
  - Indexed fields (`role`, `status`, `email`, `biometric_id`) for high-performance query execution.

- **Clean Enterprise Admin Dashboard**:
  - Human-architected modern dark UI using Inter typography and CSS variables.
  - Real-time telemetry cards (total registered users, active count, admin count, query latency).
  - Search input with debounce and multi-attribute filters (Role, Status).
  - Modal dialog for adding and editing user records with client and server validation.
  - Live **SQL Execution Log & REST Payload Inspector** drawer.

- **Production-Grade API Architecture**:
  - Full RESTful CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE`).
  - System health monitor (`GET /api/health`) and telemetry stats (`GET /api/stats`).
  - Sample data database seeder endpoint (`POST /api/seed`).
  - Environment variable management (`.env` and `.env.example`).
  - Centralized error handling and malformed JSON syntax protection.

---

## 📁 Repository Structure

```
├── config/
│   └── db.js                 # Database connection pool and schema initialization
├── controllers/
│   └── userController.js     # REST API business logic and HTTP handlers
├── models/
│   └── userModel.js          # SQL database query builder (CRUD & telemetry)
├── routes/
│   └── userRoutes.js         # Express router mapping API endpoints
├── sql/
│   └── schema.sql            # MySQL DDL schema and initial seed script
├── public/
│   ├── index.html            # User Management Dashboard HTML UI
│   ├── css/
│   │   └── style.css         # Modern dark theme CSS design system
│   └── js/
│       └── app.js            # Client-side REST integration, modal, and log inspector
├── .env                      # Local environment configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
├── package.json              # Package metadata and dependencies
├── server.js                 # Express server entry point
└── README.md                 # Complete project documentation
```

---

## 🛠️ Installation & Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher
- **MySQL**: MySQL 8.0 (Optional, SQLite persistent fallback included)

### Quick Start

1. **Clone or Navigate to Project Directory**:
   ```bash
   cd "User Management API with MySQL"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create or edit `.env` file in the root directory:
   ```ini
   # Server Configuration
   PORT=5000

   # MySQL Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=user_management_db
   ```

4. **Start the Server**:
   ```bash
   # Standard Start
   npm start

   # Development Mode (Nodemon Live Reload)
   npm run dev
   ```

5. **Access Dashboard**:
   Open **`http://localhost:5000`** in your browser.

---

## 📡 REST API Reference

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Check database connection health and latency |
| **GET** | `/api/stats` | Retrieve system telemetry (user counts, roles, statuses) |
| **POST** | `/api/seed` | Seed default sample user records into database |
| **GET** | `/api/users` | Retrieve users list (supports `search`, `role`, `status`, `sortBy`, `order`, `limit`, `offset`) |
| **GET** | `/api/users/:id` | Retrieve single user record by ID |
| **POST** | `/api/users` | Create a new user record |
| **PUT** | `/api/users/:id` | Update an existing user record |
| **DELETE** | `/api/users/:id` | Delete a user record by ID |

### Example Request Payloads

#### Create User (`POST /api/users`)
```json
{
  "username": "sarah_connor",
  "email": "sarah@cyber.io",
  "full_name": "Commander Sarah Connor",
  "role": "Cyber-Unit",
  "status": "Active",
  "biometric_id": "BIO-7712-SC"
}
```

#### Successful Response (`201 Created`)
```json
{
  "success": true,
  "message": "Humanoid entity created and synchronized successfully with MySQL.",
  "data": {
    "id": 6,
    "username": "sarah_connor",
    "email": "sarah@cyber.io",
    "full_name": "Commander Sarah Connor",
    "role": "Cyber-Unit",
    "status": "Active",
    "biometric_id": "BIO-7712-SC",
    "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=sarah_connor",
    "created_at": "2026-08-20 13:05:00",
    "updated_at": "2026-08-20 13:05:00"
  },
  "queryExecuted": {
    "sql": "INSERT INTO users (username, email, full_name, role, status, biometric_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
    "params": ["sarah_connor", "sarah@cyber.io", "Commander Sarah Connor", "Cyber-Unit", "Active", "BIO-7712-SC", "https://api.dicebear.com/7.x/bottts/svg?seed=sarah_connor"]
  }
}
```

---

## 📊 Database Schema (`sql/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('Admin', 'User', 'Cyber-Unit', 'Android', 'Humanoid-Core') NOT NULL DEFAULT 'User',
  `status` ENUM('Active', 'Inactive', 'Synchronized', 'Quarantined') NOT NULL DEFAULT 'Active',
  `biometric_id` VARCHAR(100) UNIQUE,
  `avatar_url` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 📜 License
ISC License

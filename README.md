# User Management REST API with MySQL Persistence & Humanoid UI/UX

A high-performance Node.js & Express REST API integrated with MySQL for persisting user data, featuring a futuristic Humanoid Cyber-Entity Control Hub UI/UX interface.

---

## 🌟 Key Features

1. **MySQL Database Persistence**:
   - Automated database (`user_management_db`) and table (`users`) auto-creation on startup.
   - Connection pooling using `mysql2/promise`.
   - Indexed fields (`role`, `status`, `email`, `biometric_id`) for optimal search & query performance.

2. **Humanoid Cyber-Entity UI/UX Control Interface**:
   - Obsidian dark theme with glassmorphism cards and cybernetic neon accents (`#00f3ff`, `#00ff9d`, `#9d4edd`).
   - **Interactive Humanoid Bio-Core Node Visualizer** SVG canvas diagram.
   - **Live SQL Query Stream & REST Inspector** terminal panel.
   - **Web Audio API Synth**: Subtle sci-fi audio click & beep feedback on user interaction.
   - Full CRUD modal dialogs, search with debounce, role/status filters, and live telemetry cards.

3. **Production Readiness**:
   - Environment variable support via `.env` and `.env.example`.
   - `.gitignore` for hiding credentials and node dependencies.
   - Input validation, duplicate constraints checking (username, email, biometric_id), and centralized error handling middleware.

---

## 📁 Directory Structure

```
├── config/
│   └── db.js                 # MySQL pool connection and auto-initialization
├── controllers/
│   └── userController.js     # REST API business logic & HTTP response handlers
├── models/
│   └── userModel.js          # SQL database query builder & schema operations
├── routes/
│   └── userRoutes.js         # Express router mapping API endpoints
├── sql/
│   └── schema.sql            # DDL database & table creation script
├── public/
│   ├── index.html            # Humanoid HUD control dashboard HTML
│   ├── css/
│   │   └── style.css         # Dark obsidian cyber glassmorphism design system
│   └── js/
│       └── app.js            # Client-side REST integration, live log stream & Web Audio API
├── .env                      # Local environment configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignored patterns
├── package.json              # Project metadata & dependencies
├── server.js                 # Express application entry point
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MySQL**: MySQL 8.0 or PostgreSQL service running locally on port `3306`

### Installation

1. **Clone or Navigate to Project Directory**:
   ```bash
   cd "User Management API with MySQL"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and enter your local MySQL credentials:
   ```ini
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=user_management_db
   ```

4. **Run the Application**:
   ```bash
   # Production mode
   npm start

   # Development mode with live reload
   npm run dev
   ```

5. **Open Dashboard**:
   Open `http://localhost:5000` in your web browser.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Check MySQL connection health and latency |
| **GET** | `/api/stats` | System telemetry (total users, role breakdown, status counts) |
| **POST** | `/api/seed` | Seed default sample humanoid records into MySQL |
| **GET** | `/api/users` | Retrieve users (supports `search`, `role`, `status`, `sortBy`, `order`, `limit`, `offset`) |
| **GET** | `/api/users/:id` | Fetch single user details by ID |
| **POST** | `/api/users` | Create new user entity |
| **PUT** | `/api/users/:id` | Update existing user details |
| **DELETE** | `/api/users/:id` | Delete user entity from MySQL |

### Sample JSON Body for Creating User (`POST /api/users`):
```json
{
  "username": "cyber_sentry",
  "email": "sentry@cyber.io",
  "full_name": "Aria Vance",
  "role": "Cyber-Unit",
  "status": "Active",
  "biometric_id": "BIO-4412-AV"
}
```

---

## 🛡️ License
ISC License

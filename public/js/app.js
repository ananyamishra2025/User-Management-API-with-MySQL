/**
 * USER MANAGEMENT DASHBOARD CLIENT JS
 * Handles REST API interaction, table filtering, modal forms, toast alerts, and SQL query inspection.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbStatusLabel = document.getElementById('dbStatusLabel');
  const seedDataBtn = document.getElementById('seedDataBtn');
  const openCreateUserBtn = document.getElementById('openCreateUserBtn');

  const statTotalUsers = document.getElementById('statTotalUsers');
  const statActiveUsers = document.getElementById('statActiveUsers');
  const statAdminUsers = document.getElementById('statAdminUsers');
  const statLatency = document.getElementById('statLatency');
  const statEngineMode = document.getElementById('statEngineMode');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');
  const refreshTableBtn = document.getElementById('refreshTableBtn');

  const usersTbody = document.getElementById('usersTbody');
  const showingCount = document.getElementById('showingCount');
  const totalCount = document.getElementById('totalCount');

  const sqlConsole = document.getElementById('sqlConsole');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');

  // Modal References
  const userModal = document.getElementById('userModal');
  const modalHeading = document.getElementById('modalHeading');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const userForm = document.getElementById('userForm');

  const userIdInput = document.getElementById('userIdInput');
  const inputUsername = document.getElementById('inputUsername');
  const inputFullName = document.getElementById('inputFullName');
  const inputEmail = document.getElementById('inputEmail');
  const inputBiometric = document.getElementById('inputBiometric');
  const inputRole = document.getElementById('inputRole');
  const inputStatus = document.getElementById('inputStatus');

  const errUsername = document.getElementById('errUsername');
  const errFullName = document.getElementById('errFullName');
  const errEmail = document.getElementById('errEmail');

  const toastContainer = document.getElementById('toastContainer');

  let searchDebounceTimer = null;

  // Toast Notification Manager
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.2s reverse forwards';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // Developer Query Console Logger
  function logQuery(queryData, route = 'API') {
    if (!queryData) return;
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-line';

    let sqlText = typeof queryData === 'string' ? queryData : (queryData.sql || JSON.stringify(queryData));
    if (queryData.params && Array.isArray(queryData.params) && queryData.params.length > 0) {
      sqlText += ` | Params: ${JSON.stringify(queryData.params)}`;
    }

    entry.innerHTML = `<span class="time">[${timeStr}] (${route})</span> <span class="sql-query">${escapeHtml(sqlText)}</span>`;
    sqlConsole.appendChild(entry);
    sqlConsole.scrollTop = sqlConsole.scrollHeight;
  }

  function logConsoleError(msg) {
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-line log-error';
    entry.innerHTML = `<span class="time">[${timeStr}]</span> <span>ERROR: ${escapeHtml(msg)}</span>`;
    sqlConsole.appendChild(entry);
    sqlConsole.scrollTop = sqlConsole.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Database Health Check
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();

      if (data.status === 'Connected') {
        dbStatusBadge.className = 'db-status-badge';
        dbStatusLabel.textContent = `Connected (${data.engine || 'MySQL'})`;
        statLatency.textContent = data.latencyMs || '<1ms';
        statEngineMode.textContent = data.engine || 'Relational SQL Engine';
      } else {
        dbStatusBadge.className = 'db-status-badge db-standby';
        dbStatusLabel.textContent = 'Database Standby';
        statLatency.textContent = 'N/A';
        statEngineMode.textContent = 'SQL Standby';
      }
    } catch (err) {
      dbStatusBadge.className = 'db-status-badge db-standby';
      dbStatusLabel.textContent = 'API Offline';
    }
  }

  // Fetch Telemetry & Stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success && data.telemetry) {
        const { totalUsers, statusCounts, roleCounts } = data.telemetry;
        statTotalUsers.textContent = totalUsers || 0;
        statActiveUsers.textContent = statusCounts ? (statusCounts.Active || 0) : 0;
        statAdminUsers.textContent = roleCounts ? (roleCounts.Admin || 0) : 0;
      }
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    }
  }

  // Fetch Users List
  async function fetchUsers() {
    usersTbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-solid fa-spinner fa-spin"></i> Loading users from database...
        </td>
      </tr>
    `;

    const search = searchInput.value.trim();
    const role = roleFilter.value;
    const status = statusFilter.value;

    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (role !== 'All') queryParams.append('role', role);
    if (status !== 'All') queryParams.append('status', status);

    try {
      const res = await fetch(`/api/users?${queryParams.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch user records');
      }

      if (data.queryExecuted) {
        logQuery(data.queryExecuted, 'GET /api/users');
      }

      renderUsersTable(data.data);
      showingCount.textContent = data.data.length;
      totalCount.textContent = data.total;

      fetchStats();
      checkHealth();

    } catch (err) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state" style="color: var(--accent-rose);">
            <i class="fa-solid fa-circle-exclamation"></i> Error loading records: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
      logConsoleError(err.message);
    }
  }

  // Render Table Rows
  function renderUsersTable(users) {
    if (!users || users.length === 0) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <i class="fa-solid fa-folder-open"></i> No user records found.
          </td>
        </tr>
      `;
      return;
    }

    usersTbody.innerHTML = users.map(user => {
      const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`;
      const formattedDate = new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      // Role badge class
      let roleBadgeClass = 'badge-user';
      if (user.role === 'Admin') roleBadgeClass = 'badge-admin';
      else if (user.role === 'Cyber-Unit') roleBadgeClass = 'badge-cyber';
      else if (user.role === 'Humanoid-Core') roleBadgeClass = 'badge-humanoid';
      else if (user.role === 'Android') roleBadgeClass = 'badge-android';

      // Status badge class
      let statusBadgeClass = 'status-inactive';
      if (user.status === 'Active') statusBadgeClass = 'status-active';
      else if (user.status === 'Synchronized') statusBadgeClass = 'status-sync';
      else if (user.status === 'Quarantined') statusBadgeClass = 'status-quarantined';

      return `
        <tr>
          <td><strong>#${user.id}</strong></td>
          <td>
            <div class="user-info-cell">
              <div class="user-avatar">
                <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.username)}" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(user.username)}'">
              </div>
              <div class="user-names">
                <span class="user-fullname">${escapeHtml(user.full_name)}</span>
                <span class="user-username">@${escapeHtml(user.username)}</span>
              </div>
            </div>
          </td>
          <td><span style="font-family: var(--font-mono); font-size: 13px;">${escapeHtml(user.email)}</span></td>
          <td><span class="badge ${roleBadgeClass}">${escapeHtml(user.role)}</span></td>
          <td><span class="badge ${statusBadgeClass}">${escapeHtml(user.status)}</span></td>
          <td><span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">${escapeHtml(user.biometric_id || 'N/A')}</span></td>
          <td><span style="font-size: 12px; color: var(--text-muted);">${formattedDate}</span></td>
          <td>
            <div class="action-buttons">
              <button class="action-btn action-btn-edit" onclick="openEditUserModal(${user.id})" title="Edit User">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="action-btn action-btn-delete" onclick="confirmDeleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Delete User">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Modal Manager
  function openModal(isEdit = false, userData = null) {
    clearFormErrors();
    if (isEdit && userData) {
      modalHeading.innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit User #${userData.id}`;
      userIdInput.value = userData.id;
      inputUsername.value = userData.username;
      inputFullName.value = userData.full_name;
      inputEmail.value = userData.email;
      inputBiometric.value = userData.biometric_id || '';
      inputRole.value = userData.role;
      inputStatus.value = userData.status;
    } else {
      modalHeading.innerHTML = `<i class="fa-solid fa-user-plus"></i> Add New User`;
      userForm.reset();
      userIdInput.value = '';
    }

    userModal.classList.add('active');
  }

  function closeModal() {
    userModal.classList.remove('active');
  }

  function clearFormErrors() {
    errUsername.textContent = '';
    errFullName.textContent = '';
    errEmail.textContent = '';
  }

  window.openEditUserModal = async function(id) {
    try {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        openModal(true, data.data);
      } else {
        showToast(data.message || 'User not found', 'error');
      }
    } catch (err) {
      showToast(`Error fetching user details: ${err.message}`, 'error');
    }
  };

  window.confirmDeleteUser = async function(id, username) {
    if (confirm(`Are you sure you want to delete user '@${username}' (#${id})?`)) {
      try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          showToast(`User '@${username}' deleted successfully.`, 'success');
          if (data.queryExecuted) logQuery(data.queryExecuted, `DELETE /api/users/${id}`);
          fetchUsers();
        } else {
          showToast(data.message || 'Failed to delete user.', 'error');
          logConsoleError(data.message);
        }
      } catch (err) {
        showToast(`Error deleting user: ${err.message}`, 'error');
        logConsoleError(err.message);
      }
    }
  };

  // Form Submit Handler
  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const username = inputUsername.value.trim();
    const full_name = inputFullName.value.trim();
    const email = inputEmail.value.trim();
    const biometric_id = inputBiometric.value.trim();
    const role = inputRole.value;
    const status = inputStatus.value;
    const id = userIdInput.value;

    let hasError = false;
    if (!username) { errUsername.textContent = 'Username is required.'; hasError = true; }
    if (!full_name) { errFullName.textContent = 'Full name is required.'; hasError = true; }
    if (!email) { errEmail.textContent = 'Email address is required.'; hasError = true; }

    if (hasError) return;

    const payload = { username, full_name, email, role, status };
    if (biometric_id) payload.biometric_id = biometric_id;

    const isEdit = Boolean(id);
    const url = isEdit ? `/api/users/${id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'User saved successfully.', 'success');
        if (data.queryExecuted) logQuery(data.queryExecuted, `${method} ${url}`);
        closeModal();
        fetchUsers();
      } else {
        showToast(data.message || 'Validation error.', 'error');
        logConsoleError(data.message);
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
      logConsoleError(err.message);
    }
  });

  // Seed Data Handler
  seedDataBtn.addEventListener('click', async () => {
    if (confirm('Populate database with sample user records?')) {
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Sample data seeded successfully!', 'success');
          if (data.queryExecuted) logQuery(data.queryExecuted, 'POST /api/seed');
          fetchUsers();
        } else {
          showToast(data.message || 'Seeding failed.', 'error');
        }
      } catch (err) {
        showToast(`Seeding error: ${err.message}`, 'error');
      }
    }
  });

  // Event Listeners
  openCreateUserBtn.addEventListener('click', () => openModal(false));
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(fetchUsers, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    fetchUsers();
  });

  roleFilter.addEventListener('change', fetchUsers);
  statusFilter.addEventListener('change', fetchUsers);
  refreshTableBtn.addEventListener('click', fetchUsers);

  clearConsoleBtn.addEventListener('click', () => {
    sqlConsole.innerHTML = '<div class="log-line system-line"><span class="time">[SYSTEM]</span> Logs cleared. Listening to database events...</div>';
  });

  // Initial Load
  checkHealth();
  fetchUsers();
});

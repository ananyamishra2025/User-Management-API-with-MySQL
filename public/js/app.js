/**
 * HUMANOID-CORE CONTROL HUB - CLIENT JS
 * Manages REST API interaction with MySQL server, modal dialogs, live SQL console, and Web Audio SFX
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dbStatusPill = document.getElementById('dbStatusPill');
  const dbStatusText = document.getElementById('dbStatusText');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const sfxStateText = document.getElementById('sfxState');
  const seedDbBtn = document.getElementById('seedDbBtn');

  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  const statSync = document.getElementById('statSync');
  const statInactive = document.getElementById('statInactive');

  const infoLatency = document.getElementById('infoLatency');
  const infoPool = document.getElementById('infoPool');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');

  const usersTable = document.getElementById('usersTable');
  const usersTbody = document.getElementById('usersTbody');
  const showingCount = document.getElementById('showingCount');
  const totalCount = document.getElementById('totalCount');
  const refreshBtn = document.getElementById('refreshBtn');

  const sqlConsole = document.getElementById('sqlConsole');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  // Modal & Form Elements
  const entityModal = document.getElementById('entityModal');
  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const entityForm = document.getElementById('entityForm');
  const modalTitle = document.getElementById('modalTitle');
  
  const entityIdInput = document.getElementById('entityId');
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

  // Application State
  let soundEnabled = true;
  let searchTimeout = null;

  // Initialize Web Audio API Context
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
  }

  function playSciFiSound(type = 'click') {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'delete') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Toast Notifications
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // SQL Console Logger
  function logSql(queryData, method = 'REST API') {
    if (!queryData) return;
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let sqlText = typeof queryData === 'string' ? queryData : (queryData.sql || JSON.stringify(queryData));
    if (queryData.params && Array.isArray(queryData.params)) {
      sqlText += ` [Params: ${JSON.stringify(queryData.params)}]`;
    }

    entry.innerHTML = `<span class="log-time">[${timeStr}] (${method})</span> <span class="log-sql">${escapeHtml(sqlText)}</span>`;
    sqlConsole.appendChild(entry);
    sqlConsole.scrollTop = sqlConsole.scrollHeight;
  }

  function logError(message) {
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry log-error';
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> <span>⚠️ ERROR: ${escapeHtml(message)}</span>`;
    sqlConsole.appendChild(entry);
    sqlConsole.scrollTop = sqlConsole.scrollHeight;
  }

  // Helper HTML escaper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Check Database Health & Connection
  async function checkDbHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();

      if (data.status === 'Connected') {
        dbStatusPill.className = 'status-pill';
        dbStatusText.textContent = `MYSQL CONNECTED (${data.database})`;
        infoLatency.textContent = data.latencyMs;
      } else {
        dbStatusPill.className = 'status-pill status-disconnected';
        dbStatusText.textContent = 'MYSQL DISCONNECTED';
        infoLatency.textContent = 'N/A';
      }
    } catch (err) {
      dbStatusPill.className = 'status-pill status-disconnected';
      dbStatusText.textContent = 'API OFFLINE';
    }
  }

  // Load Telemetry Stats
  async function fetchTelemetryStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success && data.telemetry) {
        const { totalUsers, statusCounts } = data.telemetry;
        statTotal.textContent = totalUsers || 0;
        statActive.textContent = statusCounts.Active || 0;
        statSync.textContent = statusCounts.Synchronized || 0;
        statInactive.textContent = (statusCounts.Inactive || 0) + (statusCounts.Quarantined || 0);
      }
    } catch (err) {
      console.error('Failed to load telemetry stats:', err);
    }
  }

  // Fetch and Render Users Table
  async function fetchUsers() {
    usersTbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center loading-cell">
          <i class="fa-solid fa-spinner fa-spin"></i> Querying MySQL Database...
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
        throw new Error(data.message || 'Failed to fetch users');
      }

      if (data.queryExecuted) {
        logSql(data.queryExecuted, 'GET /api/users');
      }

      renderUsersTable(data.data);
      showingCount.textContent = data.data.length;
      totalCount.textContent = data.total;

      // Update telemetry
      fetchTelemetryStats();
      checkDbHealth();

    } catch (err) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-error" style="color: var(--neon-red); padding: 20px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error loading entities: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
      logError(err.message);
    }
  }

  // Render Table Rows
  function renderUsersTable(users) {
    if (!users || users.length === 0) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-folder-open"></i> No humanoid entities found matching criteria.
          </td>
        </tr>
      `;
      return;
    }

    usersTbody.innerHTML = users.map(user => {
      const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`;
      const formattedDate = new Date(user.created_at).toLocaleString();

      // Role CSS Class
      let roleClass = 'role-user';
      if (user.role === 'Admin') roleClass = 'role-admin';
      else if (user.role === 'Humanoid-Core') roleClass = 'role-humanoid';
      else if (user.role === 'Cyber-Unit') roleClass = 'role-cyber';
      else if (user.role === 'Android') roleClass = 'role-android';

      // Status CSS Class
      let statusClass = 'status-inactive';
      if (user.status === 'Active') statusClass = 'status-active';
      else if (user.status === 'Synchronized') statusClass = 'status-sync';
      else if (user.status === 'Quarantined') statusClass = 'status-quarantined';

      return `
        <tr>
          <td><strong style="color: var(--neon-cyan); font-family: var(--font-code);">#${user.id}</strong></td>
          <td>
            <div class="user-cell">
              <div class="avatar-frame">
                <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.username)}" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(user.username)}'">
              </div>
              <div class="user-names">
                <span class="username-text">${escapeHtml(user.username)}</span>
                <span class="biometric-hash">${escapeHtml(user.biometric_id || 'N/A')}</span>
              </div>
            </div>
          </td>
          <td><strong>${escapeHtml(user.full_name)}</strong></td>
          <td><span style="font-family: var(--font-code); color: var(--text-muted);">${escapeHtml(user.email)}</span></td>
          <td><span class="badge ${roleClass}">${escapeHtml(user.role)}</span></td>
          <td><span class="badge ${statusClass}">${escapeHtml(user.status)}</span></td>
          <td><span style="font-size: 11px; color: var(--text-dim); font-family: var(--font-code);">${formattedDate}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn-act btn-edit" onclick="openEditModal(${user.id})" title="Edit Entity">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-act btn-delete" onclick="confirmDeleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Quarantine / Delete Entity">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Modal Open & Reset
  function openModal(isEdit = false, userData = null) {
    clearFormErrors();
    playSciFiSound('click');

    if (isEdit && userData) {
      modalTitle.innerHTML = `<i class="fa-solid fa-user-pen"></i> MODIFY HUMANOID ENTITY #${userData.id}`;
      entityIdInput.value = userData.id;
      inputUsername.value = userData.username;
      inputFullName.value = userData.full_name;
      inputEmail.value = userData.email;
      inputBiometric.value = userData.biometric_id || '';
      inputRole.value = userData.role;
      inputStatus.value = userData.status;
    } else {
      modalTitle.innerHTML = `<i class="fa-solid fa-user-plus"></i> INITIALIZE NEW HUMANOID ENTITY`;
      entityForm.reset();
      entityIdInput.value = '';
    }

    entityModal.classList.add('active');
  }

  function closeModal() {
    entityModal.classList.remove('active');
  }

  function clearFormErrors() {
    errUsername.textContent = '';
    errFullName.textContent = '';
    errEmail.textContent = '';
  }

  // Open Edit Modal by fetching latest user data
  window.openEditModal = async function(id) {
    try {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        openModal(true, data.data);
      } else {
        showToast(data.message || 'Entity not found', 'error');
      }
    } catch (err) {
      showToast(`Error fetching entity details: ${err.message}`, 'error');
    }
  };

  // Confirm Delete User
  window.confirmDeleteUser = async function(id, username) {
    playSciFiSound('delete');
    if (confirm(`⚠️ Are you sure you want to permanently delete entity '${username}' (#${id}) from MySQL?`)) {
      try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          showToast(`Entity '${username}' deleted successfully from MySQL`, 'success');
          if (data.queryExecuted) {
            logSql(data.queryExecuted, `DELETE /api/users/${id}`);
          }
          fetchUsers();
        } else {
          showToast(data.message || 'Delete operation failed', 'error');
          logError(data.message);
        }
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
        logError(err.message);
      }
    }
  };

  // Form Submission Handler
  entityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const username = inputUsername.value.trim();
    const full_name = inputFullName.value.trim();
    const email = inputEmail.value.trim();
    const biometric_id = inputBiometric.value.trim();
    const role = inputRole.value;
    const status = inputStatus.value;
    const id = entityIdInput.value;

    let hasError = false;
    if (!username) { errUsername.textContent = 'Username is required.'; hasError = true; }
    if (!full_name) { errFullName.textContent = 'Full name is required.'; hasError = true; }
    if (!email) { errEmail.textContent = 'Email address is required.'; hasError = true; }

    if (hasError) {
      playSciFiSound('delete');
      return;
    }

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
        playSciFiSound('success');
        showToast(data.message || 'Entity saved successfully', 'success');
        if (data.queryExecuted) {
          logSql(data.queryExecuted, `${method} ${url}`);
        }
        closeModal();
        fetchUsers();
      } else {
        playSciFiSound('delete');
        showToast(data.message || 'Operation failed', 'error');
        logError(data.message);
      }
    } catch (err) {
      playSciFiSound('delete');
      showToast(`Network error: ${err.message}`, 'error');
      logError(err.message);
    }
  });

  // Seed Database Button Handler
  seedDbBtn.addEventListener('click', async () => {
    playSciFiSound('click');
    if (confirm('⚡ Seed sample humanoid records into MySQL database?')) {
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          playSciFiSound('success');
          showToast('Sample Humanoid Entities seeded into MySQL!', 'success');
          if (data.queryExecuted) logSql(data.queryExecuted, 'POST /api/seed');
          fetchUsers();
        } else {
          showToast(data.message || 'Seeding failed', 'error');
        }
      } catch (err) {
        showToast(`Seeding error: ${err.message}`, 'error');
      }
    }
  });

  // Event Listeners
  openAddModalBtn.addEventListener('click', () => openModal(false));
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  audioToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    sfxStateText.textContent = soundEnabled ? 'ON' : 'OFF';
    audioToggleBtn.style.borderColor = soundEnabled ? 'var(--neon-cyan)' : 'var(--text-muted)';
    if (soundEnabled) playSciFiSound('click');
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchUsers, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    fetchUsers();
  });

  roleFilter.addEventListener('change', () => {
    playSciFiSound('click');
    fetchUsers();
  });

  statusFilter.addEventListener('change', () => {
    playSciFiSound('click');
    fetchUsers();
  });

  refreshBtn.addEventListener('click', () => {
    playSciFiSound('click');
    fetchUsers();
  });

  clearLogsBtn.addEventListener('click', () => {
    sqlConsole.innerHTML = '<div class="log-entry system-log"><span class="log-time">[SYSTEM]</span> Console logs cleared. Listening for query events...</div>';
  });

  // Initial Load
  checkDbHealth();
  fetchUsers();
});

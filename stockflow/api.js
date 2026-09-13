(function () {
  const TOKEN_KEY = 'stockflow_auth_token';
  let saveChain = Promise.resolve();

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(value) { value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY); }

  async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (token()) headers.set('Authorization', `Bearer ${token()}`);
    const response = await fetch(url, { ...options, headers });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function login(email, password) {
    const payload = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(payload.token);
    return payload;
  }

  async function bootstrap() { return apiRequest('/api/bootstrap'); }
  function logout() { setToken(''); }
  function useToken(value) { setToken(value); }

  function saveWorkspace(workspace) {
    const snapshot = JSON.parse(JSON.stringify(workspace));
    saveChain = saveChain.then(async () => {
      const payload = await apiRequest('/api/workspace', { method: 'PUT', body: JSON.stringify(snapshot) });
      if (window.applyServerWorkspace) window.applyServerWorkspace(payload.workspace);
      return payload.workspace;
    }).catch(error => {
      console.error(error);
      if (window.showToast) window.showToast(error.message || 'Could not save changes.');
      throw error;
    });
    return saveChain;
  }

  async function recordTransaction(payload) {
    const response = await apiRequest('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
    if (window.applyServerWorkspace) window.applyServerWorkspace(response.workspace);
    return response;
  }

  async function listUsers() { return apiRequest('/api/users'); }
  async function createUser(payload) { return apiRequest('/api/users', { method: 'POST', body: JSON.stringify(payload) }); }
  async function updateUser(userId, payload) { return apiRequest(`/api/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
  async function changePassword(currentPassword, newPassword) { return apiRequest('/api/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); }
  async function resetWorkspace() { return apiRequest('/api/reset-demo', { method: 'POST' }); }
  async function cloudinaryUpload(file) { const form = new FormData(); form.append('file', file); return apiRequest('/api/cloudinary/upload', { method: 'POST', body: form, headers: {} }); }

  window.StockFlowAPI = { login, bootstrap, logout, saveWorkspace, recordTransaction, listUsers, createUser, updateUser, changePassword, resetWorkspace, cloudinaryUpload, token, useToken };
})();

const TOKEN_KEY = 'reach_admin_token';

export const getToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  const res = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const msg = data?.error || (data?.errors ? data.errors.join('; ') : `Request failed (${res.status})`);
    const err = new Error(msg);
    err.status = res.status;
    err.errors = data?.errors;
    throw err;
  }
  return data;
}

export const api = {
  formConfig: () => request('/api/form-config'),
  submitApplication: (formData) => request('/api/applications', { method: 'POST', body: formData }),
  login: (username, password) => request('/api/admin/login', { method: 'POST', json: { username, password } }),
  listApplications: (params) => request(`/api/admin/applications?${new URLSearchParams(params)}`),
  stats: () => request('/api/admin/applications/stats'),
  getApplication: (id) => request(`/api/admin/applications/${id}`),
  action: (id, action, note) => request(`/api/admin/applications/${id}/action`, { method: 'POST', json: { action, note } }),
  deleteApplication: (id) => request(`/api/admin/applications/${id}`, { method: 'DELETE' }),
  restoreApplication: (id) => request(`/api/admin/applications/${id}/restore`, { method: 'POST' }),
  purgeApplication: (id) => request(`/api/admin/applications/${id}/purge`, { method: 'DELETE' }),
  updateApplication: (id, data) => request(`/api/admin/applications/${id}`, { method: 'PUT', json: data }),
  // Payments
  listPayments: (params = {}) => request(`/api/admin/payments?${new URLSearchParams(params)}`),
  createPayment: (formData) => request('/api/admin/payments', { method: 'POST', body: formData }),
  updatePayment: (id, formData) => request(`/api/admin/payments/${id}`, { method: 'PUT', body: formData }),
  deletePayment: (id) => request(`/api/admin/payments/${id}`, { method: 'DELETE' }),
  docUrl: (id) => `/api/admin/documents/${id}/file`,
  // Users
  listUsers: () => request('/api/admin/users'),
  createUser: (u) => request('/api/admin/users', { method: 'POST', json: u }),
  updateUser: (id, u) => request(`/api/admin/users/${id}`, { method: 'PUT', json: u }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  // Settings
  homeContent: () => request('/api/home-content'),
  saveHomeContent: (content) => request('/api/admin/settings/home-content', { method: 'PUT', json: content }),
  getRegistration: () => request('/api/admin/settings/registration'),
  saveRegistration: (cfg) => request('/api/admin/settings/registration', { method: 'PUT', json: cfg }),
  getIdFormat: () => request('/api/admin/settings/membership-id'),
  saveIdFormat: (cfg) => request('/api/admin/settings/membership-id', { method: 'PUT', json: cfg }),
  uploadLogo: (formData) => request('/api/admin/settings/logo', { method: 'POST', body: formData }),
  resetLogo: () => request('/api/admin/settings/logo', { method: 'DELETE' }),
  getSmtp: () => request('/api/admin/settings/smtp'),
  saveSmtp: (cfg) => request('/api/admin/settings/smtp', { method: 'PUT', json: cfg }),
  testSmtp: (to) => request('/api/admin/settings/smtp/test', { method: 'POST', json: { to } }),
  // Form builder
  listFields: () => request('/api/admin/form/fields'),
  createField: (f) => request('/api/admin/form/fields', { method: 'POST', json: f }),
  updateField: (id, f) => request(`/api/admin/form/fields/${id}`, { method: 'PUT', json: f }),
  moveField: (id, direction) => request(`/api/admin/form/fields/${id}/move`, { method: 'POST', json: { direction } }),
  deleteField: (id) => request(`/api/admin/form/fields/${id}`, { method: 'DELETE' }),
  listOptions: () => request('/api/admin/form/options'),
  createOption: (o) => request('/api/admin/form/options', { method: 'POST', json: o }),
  updateOption: (id, value) => request(`/api/admin/form/options/${id}`, { method: 'PUT', json: { value } }),
  deleteOption: (id) => request(`/api/admin/form/options/${id}`, { method: 'DELETE' }),
  listPlans: () => request('/api/admin/form/plans'),
  createPlan: (p) => request('/api/admin/form/plans', { method: 'POST', json: p }),
  updatePlan: (id, p) => request(`/api/admin/form/plans/${id}`, { method: 'PUT', json: p }),
  deletePlan: (id) => request(`/api/admin/form/plans/${id}`, { method: 'DELETE' }),
};

export const getSession = () => {
  try { return JSON.parse(sessionStorage.getItem('reach_admin_session') || 'null'); } catch { return null; }
};
export const setSession = (s) => {
  try { s ? sessionStorage.setItem('reach_admin_session', JSON.stringify(s)) : sessionStorage.removeItem('reach_admin_session'); } catch { /* ignore */ }
};

export async function fetchDocBlob(docId) {
  const res = await fetch(api.docUrl(docId), { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not load document');
  return URL.createObjectURL(await res.blob());
}

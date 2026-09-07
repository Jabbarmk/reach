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
  paymentsDue: () => request('/api/admin/payments/due'),
  listPayments: (params = {}) => request(`/api/admin/payments?${new URLSearchParams(params)}`),
  createPayment: (formData) => request('/api/admin/payments', { method: 'POST', body: formData }),
  updatePayment: (id, formData) => request(`/api/admin/payments/${id}`, { method: 'PUT', body: formData }),
  deletePayment: (id) => request(`/api/admin/payments/${id}`, { method: 'DELETE' }),
  docUrl: (id) => `/api/admin/documents/${id}/file`,
  // Accounts (ledger)
  listLedgerCategories: (kind) => request(`/api/admin/ledger/categories${kind ? `?kind=${kind}` : ''}`),
  createLedgerCategory: (c) => request('/api/admin/ledger/categories', { method: 'POST', json: c }),
  updateLedgerCategory: (id, name) => request(`/api/admin/ledger/categories/${id}`, { method: 'PUT', json: { name } }),
  deleteLedgerCategory: (id) => request(`/api/admin/ledger/categories/${id}`, { method: 'DELETE' }),
  listLedgerEntries: (params = {}) => request(`/api/admin/ledger/entries?${new URLSearchParams(params)}`),
  createLedgerEntry: (e) => request('/api/admin/ledger/entries', { method: 'POST', json: e }),
  updateLedgerEntry: (id, e) => request(`/api/admin/ledger/entries/${id}`, { method: 'PUT', json: e }),
  deleteLedgerEntry: (id) => request(`/api/admin/ledger/entries/${id}`, { method: 'DELETE' }),
  ledgerSummary: (params = {}) => request(`/api/admin/ledger/reports/summary?${new URLSearchParams(params)}`),
  // Committee & Team
  committeeOptions: () => request('/api/admin/committee/options'),
  saveCommitteeOptions: (list, items) => request(`/api/admin/committee/options/${list}`, { method: 'PUT', json: { items } }),
  listCommitteeAssignments: (params = {}) => request(`/api/admin/committee/assignments?${new URLSearchParams(params)}`),
  createCommitteeAssignment: (a) => request('/api/admin/committee/assignments', { method: 'POST', json: a }),
  updateCommitteeAssignment: (id, a) => request(`/api/admin/committee/assignments/${id}`, { method: 'PUT', json: a }),
  deleteCommitteeAssignment: (id) => request(`/api/admin/committee/assignments/${id}`, { method: 'DELETE' }),
  // Receipts
  listReceipts: (params = {}) => request(`/api/admin/receipts?${new URLSearchParams(params)}`),
  receiptUrl: (paymentId) => `/api/admin/receipts/${paymentId}/pdf`,
  // Users
  listCollectors: () => request('/api/admin/users/collectors'),
  listUsers: () => request('/api/admin/users'),
  listRoles: () => request('/api/admin/users/roles'),
  createRole: (r) => request('/api/admin/users/roles', { method: 'POST', json: r }),
  updateRole: (name, r) => request(`/api/admin/users/roles/${name}`, { method: 'PUT', json: r }),
  deleteRole: (name) => request(`/api/admin/users/roles/${name}`, { method: 'DELETE' }),
  createUser: (u) => request('/api/admin/users', { method: 'POST', json: u }),
  updateUser: (id, u) => request(`/api/admin/users/${id}`, { method: 'PUT', json: u }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  // Settings
  homeContent: () => request('/api/home-content'),
  saveHomeContent: (content) => request('/api/admin/settings/home-content', { method: 'PUT', json: content }),
  memberCountries: () => request('/api/member-countries'),
  saveMemberCountries: (data) => request('/api/admin/settings/member-countries', { method: 'PUT', json: data }),
  // News & Events
  news: (limit) => request(`/api/news${limit ? `?limit=${limit}` : ''}`),
  newsImageUrl: (id) => `/api/news/${id}/image`,
  newsGalleryImageUrl: (id, imageId) => `/api/news/${id}/gallery/${imageId}`,
  listAdminNews: () => request('/api/admin/news'),
  createNews: (formData) => request('/api/admin/news', { method: 'POST', body: formData }),
  updateNews: (id, formData) => request(`/api/admin/news/${id}`, { method: 'PUT', body: formData }),
  deleteNews: (id) => request(`/api/admin/news/${id}`, { method: 'DELETE' }),
  getRegistration: () => request('/api/admin/settings/registration'),
  saveRegistration: (cfg) => request('/api/admin/settings/registration', { method: 'PUT', json: cfg }),
  getIdFormat: () => request('/api/admin/settings/membership-id'),
  saveIdFormat: (cfg) => request('/api/admin/settings/membership-id', { method: 'PUT', json: cfg }),
  getReferenceFormat: () => request('/api/admin/settings/reference-format'),
  saveReferenceFormat: (cfg) => request('/api/admin/settings/reference-format', { method: 'PUT', json: cfg }),
  getMembersDefaultViewSetting: () => request('/api/admin/settings/members-default-view'),
  saveMembersDefaultViewSetting: (cfg) => request('/api/admin/settings/members-default-view', { method: 'PUT', json: cfg }),
  getMembersDefaultView: () => request('/api/admin/members/default-view'),
  listDeclarations: () => request('/api/admin/settings/declarations'),
  createDeclaration: (text) => request('/api/admin/settings/declarations', { method: 'POST', json: { text } }),
  updateDeclaration: (id, text) => request(`/api/admin/settings/declarations/${id}`, { method: 'PUT', json: { text } }),
  deleteDeclaration: (id) => request(`/api/admin/settings/declarations/${id}`, { method: 'DELETE' }),
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

export async function fetchReceiptBlob(paymentId) {
  const res = await fetch(api.receiptUrl(paymentId), { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not load receipt');
  return URL.createObjectURL(await res.blob());
}

// Fetches an authenticated blob URL and triggers a browser download/save-as with the given filename.
export function downloadBlob(blobUrl, filename) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Exports rows to a CSV file (opens directly in Excel). columns: [{ label, value }], where
// value is either a row key or a (row) => value function. No server round-trip — works on
// whatever rows are currently loaded/filtered in the table.
export function exportCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cell = (col, row) => (typeof col.value === 'function' ? col.value(row) : row[col.value]);
  const lines = [
    columns.map((c) => esc(c.label)).join(','),
    ...(rows || []).map((r) => columns.map((c) => esc(cell(c, r))).join(',')),
  ];
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadBlob(url, filename);
  URL.revokeObjectURL(url);
}

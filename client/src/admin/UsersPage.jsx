import { useEffect, useState } from 'react';
import { api } from '../api.js';

const SCREEN_LABELS = {
  overview: 'Overview', members: 'Members', approvals: 'Approvals', payments: 'Payments',
  events: 'Events', settings: 'Settings', users: 'Users', form: 'Form Builder',
};
const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', accounts: 'Accounts' };

function UserModal({ user, roleDefaults, allScreens, onClose, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    password: '',
    role: user?.role || 'staff',
    is_active: user?.is_active ?? true,
    useDefault: user ? !user.has_override : true,
    screens: user?.screens || roleDefaults.staff,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setRole = (role) => {
    setForm((p) => ({ ...p, role, screens: p.useDefault ? roleDefaults[role] : p.screens }));
  };

  const toggleScreen = (s) => {
    setForm((p) => {
      const screens = p.screens.includes(s) ? p.screens.filter((x) => x !== s) : [...p.screens, s];
      return { ...p, screens, useDefault: false };
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        full_name: form.full_name,
        role: form.role,
        is_active: form.is_active,
        screens: form.useDefault ? roleDefaults[form.role] : form.screens,
      };
      if (form.password) payload.password = form.password;
      if (isNew) {
        payload.username = form.username;
        if (!form.password) throw new Error('Password is required for a new user');
        await api.createUser(payload);
      } else {
        await api.updateUser(user.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 520 }}>
        <div className="crop-head">
          <h3>{isNew ? 'Add User' : `Edit User — ${user.username}`}</h3>
          <p>Role sets default screen access; adjust the checkboxes for per-user overrides.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '62vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          <div className="grid2">
            <div className="field">
              <label>Username {isNew && <span className="req">*</span>}</label>
              <input type="text" value={form.username} disabled={!isNew} onChange={(e) => set('username', e.target.value)} />
            </div>
            <div className="field">
              <label>Full Name</label>
              <input type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
            </div>
            <div className="field">
              <label>{isNew ? 'Password' : 'New Password'} {isNew && <span className="req">*</span>}</label>
              <input type="password" value={form.password} placeholder={isNew ? 'Min 6 characters' : 'Leave blank to keep current'} onChange={(e) => set('password', e.target.value)} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="accounts">Accounts</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Screen Access</label>
            <label className="checkline" style={{ marginBottom: 8 }}>
              <input
                type="checkbox" checked={form.useDefault}
                onChange={(e) => set('useDefault', e.target.checked) || (e.target.checked && set('screens', roleDefaults[form.role]))}
              />
              Use role default ({(roleDefaults[form.role] || []).map((s) => SCREEN_LABELS[s]).join(', ')})
            </label>
            <div className="screen-grid">
              {allScreens.map((s) => {
                const active = form.useDefault ? roleDefaults[form.role].includes(s) : form.screens.includes(s);
                return (
                  <label key={s} className={`screen-chip ${active ? 'on' : ''}`}>
                    <input type="checkbox" checked={active} onChange={() => toggleScreen(s)} />
                    {SCREEN_LABELS[s]}
                  </label>
                );
              })}
            </div>
          </div>

          {!isNew && (
            <label className="checkline">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Account active (unchecked = user cannot sign in)
            </label>
          )}
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || (isNew && (!form.username || !form.password))}>
            {busy ? 'Saving…' : 'Save User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(undefined); // undefined = closed, null = new, object = edit

  const load = async () => {
    try { setData(await api.listUsers()); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await api.deleteUser(u.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Users</h1>
          <p>Manage system users, roles and screen access.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(null)}>+ Add User</button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr><th>Username</th><th>Full Name</th><th>Role</th><th>Screen Access</th><th>Status</th><th style={{ width: 140 }}>Actions</th></tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{u.username}</td>
                  <td>{u.full_name || '—'}</td>
                  <td><span className={`pill ${u.role === 'admin' ? 'blue' : u.role === 'staff' ? 'teal' : 'orange'}`}>{ROLE_LABELS[u.role]}</span></td>
                  <td style={{ maxWidth: 320 }}>
                    <span style={{ fontSize: 12.5 }}>
                      {u.screens.map((s) => SCREEN_LABELS[s]).join(', ')}
                      {u.has_override && <span className="pill grey" style={{ marginLeft: 6 }}>custom</span>}
                    </span>
                  </td>
                  <td>{u.is_active ? <span className="pill green">Active</span> : <span className="pill red">Disabled</span>}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => setModal(u)}>Edit</button>{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(u)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>

      {modal !== undefined && (
        <UserModal
          user={modal}
          roleDefaults={data?.roleDefaults || {}}
          allScreens={data?.allScreens || []}
          onClose={() => setModal(undefined)}
          onSaved={() => { setModal(undefined); load(); }}
        />
      )}
    </>
  );
}

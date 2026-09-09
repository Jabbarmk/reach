import { useEffect, useState } from 'react';
import { api } from '../api.js';

const SCREEN_LABELS = {
  overview: 'Overview', members: 'Members', approvals: 'Approvals', payments: 'Payments',
  events: 'News & Events', settings: 'Settings', users: 'Users', form: 'Form Builder', ledger: 'Accounts',
  committee: 'Committee & Team', reports: 'Reports',
};
const ROLE_TONES = ['blue', 'teal', 'orange', 'green', 'grey'];
const roleTone = (name) => ROLE_TONES[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % ROLE_TONES.length];

const NEW_ROLE = '__new__';

function UserModal({ user, roleDefaults, allScreens, roles, onClose, onSaved, onRoleCreated }) {
  const isNew = !user;
  const firstRole = user?.role || roles[0]?.name || '';
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    password: '',
    role: firstRole,
    is_active: user?.is_active ?? true,
    useDefault: user ? !user.has_override : true,
    screens: user?.screens || roleDefaults[firstRole] || [],
    newRoleName: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setRole = (role) => {
    if (role === NEW_ROLE) {
      setForm((p) => ({ ...p, role, screens: [], useDefault: false }));
      return;
    }
    setForm((p) => ({ ...p, role, screens: p.useDefault ? roleDefaults[role] : p.screens }));
  };

  const toggleScreen = (s) => {
    setForm((p) => {
      const screens = p.screens.includes(s) ? p.screens.filter((x) => x !== s) : [...p.screens, s];
      return { ...p, screens, useDefault: false };
    });
  };

  const isDuplicateRoleName = (name) => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return roles.some((r) => r.name === slug || r.label.trim().toLowerCase() === name.trim().toLowerCase());
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let role = form.role;
      let screens = form.useDefault ? roleDefaults[form.role] : form.screens;

      if (form.role === NEW_ROLE) {
        const name = form.newRoleName.trim();
        if (!name) throw new Error('Enter a name for the new role');
        if (isDuplicateRoleName(name)) throw new Error(`A role named "${name}" already exists — pick a different name`);
        if (!form.screens.length) throw new Error('Select at least one screen for the new role');
        setRoleBusy(true);
        const res = await api.createRole({ label: name, screens: form.screens });
        setRoleBusy(false);
        role = res.role.name;
        screens = res.role.screens;
        onRoleCreated(res.role);
      }

      const payload = { full_name: form.full_name, role, is_active: form.is_active, screens };
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
      setRoleBusy(false);
    }
  };

  const effectiveDefaults = form.role === NEW_ROLE ? form.screens : (roleDefaults[form.role] || []);

  const pwScore = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  })();
  const pwLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][pwScore];
  const pwTone = ['#dc2626', '#dc2626', '#f97316', '#0d9488', '#16a34a'][pwScore];

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 520 }}>
        <div className="crop-head">
          <h3>{isNew ? 'Add User' : `Edit User — ${user.username}`}</h3>
          <p>Role sets default screen access; adjust the checkboxes for per-user overrides.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '62vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}

          <div className="modal-section-title">Account Details</div>
          <div className="grid2">
            <div className="afield">
              <label>Username {isNew && <span className="req">*</span>}</label>
              <div className="a-inputwrap">
                <span className="a-ico">👤</span>
                <input
                  type="text" value={form.username} disabled={!isNew} autoComplete="username"
                  placeholder="e.g. jsmith" onChange={(e) => set('username', e.target.value)}
                />
              </div>
            </div>
            <div className="afield">
              <label>Full Name</label>
              <div className="a-inputwrap">
                <span className="a-ico">🪪</span>
                <input type="text" value={form.full_name} placeholder="e.g. John Smith" onChange={(e) => set('full_name', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="afield">
            <label>{isNew ? 'Password' : 'New Password'} {isNew && <span className="req">*</span>}</label>
            <div className="a-inputwrap">
              <span className="a-ico">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'} value={form.password} autoComplete="new-password"
                placeholder={isNew ? 'Minimum 6 characters' : 'Leave blank to keep current password'}
                onChange={(e) => set('password', e.target.value)}
              />
              <button
                type="button" className="a-eye" tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {form.password && (
              <div className="pw-strength">
                <div className="pw-bar"><span style={{ width: `${(pwScore / 4) * 100}%`, background: pwTone }} /></div>
                <span style={{ color: pwTone }}>{pwLabel}</span>
              </div>
            )}
          </div>

          <div className="modal-section-title">Role &amp; Access</div>
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
              <option value={NEW_ROLE}>+ Add New Role…</option>
            </select>
          </div>

          {form.role === NEW_ROLE && (
            <div className="field">
              <label>New Role Name <span className="req">*</span></label>
              <input
                type="text" value={form.newRoleName} placeholder="e.g. Volunteer Coordinator"
                onChange={(e) => set('newRoleName', e.target.value)}
              />
              <div className="hint">Pick the screens below — they become this role's default for future users too.</div>
            </div>
          )}

          <div className="field">
            <label>Screen Access</label>
            {form.role !== NEW_ROLE && (
              <label className="checkline" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox" checked={form.useDefault}
                  onChange={(e) => set('useDefault', e.target.checked) || (e.target.checked && set('screens', roleDefaults[form.role]))}
                />
                Use role default ({(roleDefaults[form.role] || []).map((s) => SCREEN_LABELS[s]).join(', ') || 'none'})
              </label>
            )}
            <div className="screen-grid">
              {allScreens.map((s) => {
                const active = form.useDefault ? effectiveDefaults.includes(s) : form.screens.includes(s);
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
            {roleBusy ? 'Creating role…' : busy ? 'Saving…' : 'Save User'}
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

  const roleLabel = (name) => data?.roles?.find((r) => r.name === name)?.label || name;

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
                  <td><span className={`pill ${roleTone(u.role)}`}>{roleLabel(u.role)}</span></td>
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
          roles={data?.roles || []}
          onClose={() => setModal(undefined)}
          onSaved={() => { setModal(undefined); load(); }}
          onRoleCreated={(role) => setData((p) => ({
            ...p,
            roles: [...(p.roles || []), role],
            roleDefaults: { ...(p.roleDefaults || {}), [role.name]: role.screens },
          }))}
        />
      )}
    </>
  );
}

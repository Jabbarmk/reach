import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api.js';

function LogoCard() {
  const [preview, setPreview] = useState(null); // local object URL before upload
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stamp] = useState(Date.now());

  const pick = (f) => {
    setError(null);
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) { setError('Logo must be a JPG or PNG image.'); return; }
    if (f.size > 2 * 1024 * 1024) { setError('Logo must be under 2 MB.'); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.uploadLogo(fd);
      window.location.reload(); // refresh every logo on the page
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const reset = async () => {
    if (!window.confirm('Restore the original REACH logo?')) return;
    setBusy(true);
    try { await api.resetLogo(); window.location.reload(); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Society Logo</h2>
      <p className="sub">Shown in the registration page header, admin dashboard, login screen and membership cards. Use a wide logo on a white background (JPG/PNG, max 2 MB).</p>
      {error && <div className="alert error">{error}</div>}
      <div className="logo-edit-row">
        <div className="logo-preview-box">
          <div className="lbl">{preview ? 'New logo (not saved yet)' : 'Current logo'}</div>
          <img src={preview || `/api/logo?t=${stamp}`} alt="Society logo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
            Choose new logo…
            <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {file && (
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Uploading…' : 'Save Logo'}
            </button>
          )}
          {file && (
            <button className="btn btn-ghost btn-sm" onClick={() => { URL.revokeObjectURL(preview); setPreview(null); setFile(null); }}>
              Cancel
            </button>
          )}
          {!file && (
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>
              Restore default logo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeContentCard() {
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setC(await api.homeContent()); } catch (err) { setError(err.message); }
    })();
  }, []);

  const set = (section, key, value) => {
    setC((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
    setSaved(false);
  };
  const setCard = (section, idx, key, value) => {
    setC((p) => {
      const cards = p[section].cards.map((card, i) => (i === idx ? { ...card, [key]: value } : card));
      return { ...p, [section]: { ...p[section], cards } };
    });
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try { setC(await api.saveHomeContent(c)); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // Plain render helpers (not components) so inputs keep focus while typing.
  const txt = (section, k, label, rows) => (
    <div className="field" key={`${section}.${k}`}>
      <label>{label}</label>
      {rows ? (
        <textarea rows={rows} value={c[section][k]} style={{ width: '100%', resize: 'vertical' }} onChange={(e) => set(section, k, e.target.value)} />
      ) : (
        <input type="text" value={c[section][k]} onChange={(e) => set(section, k, e.target.value)} />
      )}
    </div>
  );

  const cards = (section) => c[section].cards.map((card, i) => (
    <div key={i} className="hc-card-edit">
      <div className="hc-card-title">Card {i + 1}</div>
      <div className="grid2">
        <div className="field"><label>Icon (emoji)</label><input type="text" value={card.icon} maxLength={4} onChange={(e) => setCard(section, i, 'icon', e.target.value)} /></div>
        <div className="field"><label>Title</label><input type="text" value={card.title} onChange={(e) => setCard(section, i, 'title', e.target.value)} /></div>
      </div>
      <div className="field"><label>Text</label><textarea rows={2} value={card.text} style={{ width: '100%', resize: 'vertical' }} onChange={(e) => setCard(section, i, 'text', e.target.value)} /></div>
    </div>
  ));

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Home Page Content</h2>
      <p className="sub">Everything on the public home page is editable here — hero text, section wording, activity cards and contact details. Changes go live on save.</p>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert info">✓ Home page content saved and live.</div>}
      {!c ? <div className="empty-note"><span className="spinner lg" /></div> : (
        <>
          <details className="hc-section" open>
            <summary>Header / Logo</summary>
            <div className="field">
              <label>Logo size on the home page ({c.header.logo_size}px)</label>
              <div className="hc-logo-size-row">
                <input
                  type="range" min="40" max="400" step="5"
                  value={c.header.logo_size}
                  onChange={(e) => set('header', 'logo_size', Number(e.target.value))}
                />
                <input
                  type="number" min="40" max="400"
                  value={c.header.logo_size}
                  onChange={(e) => set('header', 'logo_size', Number(e.target.value) || 40)}
                  className="hc-logo-size-num"
                />
                <span className="hc-logo-size-px">px</span>
              </div>
              <div className="hint">Height of the REACH logo in the home page header. Shrinks automatically on small screens.</div>
              <div className="hc-logo-preview">
                <img src={`/api/logo`} alt="Logo preview" style={{ height: Math.min(c.header.logo_size, 140) }} />
              </div>
            </div>
          </details>

          <details className="hc-section" open>
            <summary>Hero (top banner)</summary>
            <div className="grid2">
              {txt('hero', 'title1', 'Headline — line 1')}
              {txt('hero', 'title2', 'Headline — line 2')}
            </div>
            {txt('hero', 'tagline', 'Tagline (line breaks allowed)', 2)}
            <div className="grid2">
              {txt('hero', 'cta_primary', 'Main button text')}
              {txt('hero', 'cta_secondary', 'Secondary link text')}
            </div>
          </details>

          <details className="hc-section">
            <summary>About section</summary>
            <div className="grid2">
              {txt('about', 'kicker', 'Small label')}
              {txt('about', 'title', 'Title')}
            </div>
            {txt('about', 'lead', 'Intro paragraph', 3)}
            {cards('about')}
          </details>

          <details className="hc-section">
            <summary>Membership section</summary>
            <div className="grid2">
              {txt('membership', 'kicker', 'Small label')}
              {txt('membership', 'title', 'Title')}
            </div>
            {txt('membership', 'lead', 'Intro paragraph', 2)}
            <div className="hint" style={{ marginBottom: 8 }}>The plan cards themselves come from Form Builder → Membership Plans.</div>
          </details>

          <details className="hc-section">
            <summary>Focus Areas section</summary>
            <div className="grid2">
              {txt('activities', 'kicker', 'Small label')}
              {txt('activities', 'title', 'Title')}
            </div>
            {txt('activities', 'lead', 'Intro paragraph', 2)}
            {cards('activities')}
          </details>

          <details className="hc-section">
            <summary>Contact details</summary>
            <div className="grid2">
              {txt('contact', 'kicker', 'Small label')}
              {txt('contact', 'title', 'Title')}
              {txt('contact', 'office_title', 'Office card title')}
              {txt('contact', 'phone', 'Phone number (optional)')}
            </div>
            {txt('contact', 'office', 'Office address (line breaks allowed)', 2)}
            <div className="grid2">
              {txt('contact', 'email', 'E-mail address')}
              {txt('contact', 'email_note', 'E-mail note')}
              {txt('contact', 'join_title', 'Join card title')}
              {txt('contact', 'join_text', 'Join card text')}
            </div>
          </details>

          <details className="hc-section">
            <summary>Footer</summary>
            {txt('footer', 'name', 'Society name (footer & copyright)')}
          </details>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save Home Page Content'}
            </button>
            <a className="btn btn-outline btn-sm" href="/" target="_blank" rel="noreferrer">Preview home page ↗</a>
          </div>
        </>
      )}
    </div>
  );
}

function RegistrationCard() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setCfg(await api.getRegistration()); } catch (err) { setError(err.message); }
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try { setCfg(await api.saveRegistration(cfg)); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Membership Registration</h2>
      <p className="sub">Open or close the public registration form. When closed, visitors see the message below instead of the form.</p>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert info">✓ Registration settings saved.</div>}
      {!cfg ? <div className="empty-note"><span className="spinner lg" /></div> : (
        <>
          <div className="reg-toggle-row">
            <button
              type="button"
              className={`switch ${cfg.open ? 'on' : ''}`}
              onClick={() => { setCfg({ ...cfg, open: !cfg.open }); setSaved(false); }}
              aria-label="Toggle registration"
            >
              <span className="knob" />
            </button>
            <div>
              <strong style={{ color: cfg.open ? 'var(--green-600)' : 'var(--red-600)' }}>
                Registration is {cfg.open ? 'OPEN' : 'CLOSED'}
              </strong>
              <div className="hint" style={{ marginTop: 2 }}>
                {cfg.open ? 'Applicants can submit new registrations.' : 'The form is hidden and submissions are blocked.'}
              </div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label>Closed Message (shown to visitors while registration is off)</label>
            <textarea
              rows={3} value={cfg.closed_message} style={{ width: '100%', resize: 'vertical' }}
              onChange={(e) => { setCfg({ ...cfg, closed_message: e.target.value }); setSaved(false); }}
            />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save Registration Settings'}
          </button>
        </>
      )}
    </div>
  );
}

function DeclarationsCard() {
  const [declarations, setDeclarations] = useState(null);
  const [newText, setNewText] = useState('');
  const [editing, setEditing] = useState(null); // {id, text}
  const [error, setError] = useState(null);

  const load = async () => {
    try { setDeclarations((await api.listDeclarations()).declarations); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newText.trim()) return;
    try { await api.createDeclaration(newText); setNewText(''); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const saveEdit = async () => {
    try { await api.updateDeclaration(editing.id, editing.text); setEditing(null); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (d) => {
    if (!window.confirm('Remove this declaration?')) return;
    try { await api.deleteDeclaration(d.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Declarations (സത്യപ്രസ്താവന)</h2>
      <p className="sub">Shown together as one declaration box on the final step of the registration form, with a single required checkbox. Add, edit or remove individual statements below.</p>
      {error && <div className="alert error">{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <textarea
          rows={2}
          style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--line)', borderRadius: 10, resize: 'vertical' }}
          placeholder="Add a new declaration statement…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={!newText.trim()} style={{ alignSelf: 'flex-start' }}>Add</button>
      </div>
      {!declarations && <div className="empty-note"><span className="spinner lg" /></div>}
      {declarations?.map((d) => (
        <div key={d.id} className="opt-row" style={{ alignItems: 'flex-start' }}>
          {editing?.id === d.id ? (
            <>
              <textarea
                autoFocus rows={3} value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                style={{ flex: 1, padding: '7px 11px', border: '1.5px solid var(--blue-600)', borderRadius: 8, resize: 'vertical' }}
              />
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, whiteSpace: 'pre-line' }}>{d.text}</span>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing({ id: d.id, text: d.text })}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(d)}>Delete</button>
            </>
          )}
        </div>
      ))}
      {declarations && !declarations.length && <div className="empty-note">No declarations yet — add the first one above.</div>}
    </div>
  );
}

function IdFormatCard() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setCfg(await api.getIdFormat()); } catch (err) { setError(err.message); }
    })();
  }, []);

  const set = (k, v) => { setCfg((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try { setCfg(await api.saveIdFormat(cfg)); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const preview = () => {
    if (!cfg) return '';
    const digits = Math.min(8, Math.max(2, Number(cfg.digits) || 4));
    const pad = String(7).padStart(digits, '0');
    if (cfg.mode === 'panchayath') return `KALP${pad}  (7th member, from Kalpetta Municipality)`;
    let p = cfg.pattern || 'REACH-{YEAR}-{SEQ}';
    if (!p.includes('{SEQ}')) p += '{SEQ}';
    return p.replaceAll('{YEAR}', String(new Date().getFullYear())).replaceAll('{SEQ}', pad) + '  (7th member)';
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Membership ID Format</h2>
      <p className="sub">How membership IDs are generated on approval. Existing IDs are never changed; one society-wide counter continues across both formats.</p>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert info">✓ ID format saved. New approvals will use it.</div>}
      {!cfg ? <div className="empty-note"><span className="spinner lg" /></div> : (
        <>
          <div className="choice-grid" style={{ marginBottom: 16 }}>
            <button type="button" className={`choice-card ${cfg.mode === 'pattern' ? 'selected' : ''}`} onClick={() => set('mode', 'pattern')}>
              <div className="emoji">🔤</div>
              <h3>Custom Pattern</h3>
              <p>Editable template, e.g. REACH-{'{YEAR}'}-{'{SEQ}'}</p>
            </button>
            <button type="button" className={`choice-card ${cfg.mode === 'panchayath' ? 'selected' : ''}`} onClick={() => set('mode', 'panchayath')}>
              <div className="emoji">🏛</div>
              <h3>Panchayath Formula</h3>
              <p>First 4 letters of panchayath + running member number</p>
            </button>
          </div>

          <div className="grid2">
            {cfg.mode === 'pattern' && (
              <div className="field">
                <label>Pattern <span className="req">*</span></label>
                <input
                  type="text" value={cfg.pattern}
                  onChange={(e) => set('pattern', e.target.value)}
                  placeholder="REACH-{YEAR}-{SEQ}"
                />
                <div className="hint">{'{YEAR}'} = approval year · {'{SEQ}'} = running number (required)</div>
              </div>
            )}
            <div className="field">
              <label>Number Digits</label>
              <input
                type="number" min="2" max="8" value={cfg.digits}
                onChange={(e) => set('digits', e.target.value)}
              />
              <div className="hint">Zero-padding, e.g. 4 → 0007</div>
            </div>
          </div>

          <div className="id-preview">
            <span className="lbl">Preview</span>
            <span className="val">{preview()}</span>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save ID Format'}
          </button>
        </>
      )}
    </div>
  );
}

function ReferenceFormatCard() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setCfg(await api.getReferenceFormat()); } catch (err) { setError(err.message); }
    })();
  }, []);

  const set = (k, v) => { setCfg((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try { setCfg(await api.saveReferenceFormat(cfg)); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const preview = () => {
    if (!cfg) return '';
    const digits = Math.min(8, Math.max(2, Number(cfg.digits) || 5));
    const pad = String(23).padStart(digits, '0');
    let p = cfg.pattern || 'REACH-APP-{YEAR}-{SEQ}';
    if (!p.includes('{SEQ}')) p += '{SEQ}';
    return p.replaceAll('{YEAR}', String(new Date().getFullYear())).replaceAll('{SEQ}', pad) + '  (23rd application ever submitted)';
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Application Reference Number Format</h2>
      <p className="sub">How the reference number is generated the moment someone submits the registration form. Existing reference numbers are never changed.</p>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert info">✓ Reference number format saved. New submissions will use it.</div>}
      {!cfg ? <div className="empty-note"><span className="spinner lg" /></div> : (
        <>
          <div className="grid2">
            <div className="field">
              <label>Pattern <span className="req">*</span></label>
              <input
                type="text" value={cfg.pattern}
                onChange={(e) => set('pattern', e.target.value)}
                placeholder="REACH-APP-{YEAR}-{SEQ}"
              />
              <div className="hint">{'{YEAR}'} = submission year · {'{SEQ}'} = running number (required)</div>
            </div>
            <div className="field">
              <label>Number Digits</label>
              <input
                type="number" min="2" max="8" value={cfg.digits}
                onChange={(e) => set('digits', e.target.value)}
              />
              <div className="hint">Zero-padding, e.g. 5 → 00023</div>
            </div>
          </div>

          <div className="id-preview">
            <span className="lbl">Preview</span>
            <span className="val">{preview()}</span>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save Reference Number Format'}
          </button>
        </>
      )}
    </div>
  );
}

const SCREEN_LABELS = {
  overview: 'Overview', members: 'Members', approvals: 'Approvals', payments: 'Payments',
  events: 'Events', settings: 'Settings', users: 'Users', form: 'Form Builder', ledger: 'Accounts',
};
const ALL_SCREENS = Object.keys(SCREEN_LABELS);

function RoleModal({ role, onClose, onSaved }) {
  const isNew = !role;
  const [label, setLabel] = useState(role?.label || '');
  const [screens, setScreens] = useState(role?.screens || []);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = (s) => setScreens((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const save = async () => {
    if (!label.trim()) { setError('Role name is required'); return; }
    setBusy(true);
    setError(null);
    try {
      if (isNew) await api.createRole({ label, screens });
      else await api.updateRole(role.name, { label, screens });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 460 }}>
        <div className="crop-head">
          <h3>{isNew ? 'Add Role' : `Edit Role — ${role.label}`}</h3>
          <p>Screens checked here become this role's default for every user assigned to it.</p>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Role Name <span className="req">*</span></label>
            <input type="text" value={label} placeholder="e.g. Volunteer Coordinator" onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="field">
            <label>Default Screens</label>
            <div className="screen-grid">
              {ALL_SCREENS.map((s) => (
                <label key={s} className={`screen-chip ${screens.includes(s) ? 'on' : ''}`}>
                  <input type="checkbox" checked={screens.includes(s)} onChange={() => toggle(s)} />
                  {SCREEN_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RolesCard() {
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(undefined); // undefined = closed, null = new, object = edit

  const load = async () => {
    try { setRoles((await api.listRoles()).roles); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (r) => {
    if (!window.confirm(`Delete the "${r.label}" role? This only works if no user currently has it.`)) return;
    try { await api.deleteRole(r.name); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>User Roles</h2>
      <p className="sub">Add, edit or delete the roles available when creating a user. Built-in roles (Admin, Staff, Accounts) can be edited but not deleted.</p>
      {error && <div className="alert error">{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>+ Add Role</button>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr><th>Role</th><th>Default Screens</th><th style={{ width: 150 }}>Actions</th></tr>
            </thead>
            <tbody>
              {roles?.map((r) => (
                <tr key={r.name} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 700, color: 'var(--blue-800)' }}>
                    {r.label} {r.is_system && <span className="pill grey" style={{ marginLeft: 6 }}>built-in</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{r.screens.map((s) => SCREEN_LABELS[s]).join(', ') || '—'}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => setModal(r)}>Edit</button>{' '}
                    {r.name !== 'admin' && <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!roles && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>
      {modal !== undefined && (
        <RoleModal role={modal} onClose={() => setModal(undefined)} onSaved={() => { setModal(undefined); load(); }} />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { session } = useOutletContext();
  const [smtp, setSmtp] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setSmtp({ ...(await api.getSmtp()), password: '' }); }
      catch (err) { setError(err.message); }
    })();
  }, []);

  const set = (k, v) => { setSmtp((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.saveSmtp(smtp);
      setSaved(true);
      if (smtp.password) setSmtp((p) => ({ ...p, password: '', has_password: true }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await api.testSmtp(testTo);
      setTestResult({ ok: true, message: res.message });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally { setTestBusy(false); }
  };

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Settings</h1>
          <p>Registration control, membership ID format, e-mail (SMTP) and account information.</p>
        </div>
      </div>

      <RegistrationCard />
      <DeclarationsCard />
      <LogoCard />
      <HomeContentCard />
      <IdFormatCard />
      <ReferenceFormatCard />
      <RolesCard />

      <div className="detail-grid">
        <div className="card">
          <h2 style={{ fontSize: 17, marginBottom: 4 }}>SMTP / E-mail Settings</h2>
          <p className="sub">When enabled, applicants automatically receive e-mails on submission, approval, rejection, correction requests and payment confirmation.</p>

          {error && <div className="alert error">{error}</div>}
          {saved && <div className="alert info">✓ SMTP settings saved.</div>}

          {!smtp ? <div className="empty-note"><span className="spinner lg" /></div> : (
            <>
              <label className="checkline" style={{ marginBottom: 16, fontWeight: 600 }}>
                <input type="checkbox" checked={smtp.enabled} onChange={(e) => set('enabled', e.target.checked)} />
                Enable automatic e-mails
              </label>
              <div className="grid2">
                <div className="field">
                  <label>SMTP Host <span className="req">*</span></label>
                  <input type="text" value={smtp.host} placeholder="e.g. smtp.gmail.com" onChange={(e) => set('host', e.target.value)} />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input type="number" value={smtp.port} placeholder="587" onChange={(e) => set('port', e.target.value)} />
                  <div className="hint">587 (STARTTLS) or 465 (SSL)</div>
                </div>
                <div className="field">
                  <label>Username</label>
                  <input type="text" value={smtp.username} autoComplete="off" onChange={(e) => set('username', e.target.value)} />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password" value={smtp.password} autoComplete="new-password"
                    placeholder={smtp.has_password ? '•••••• (saved — leave blank to keep)' : 'SMTP password / app password'}
                    onChange={(e) => set('password', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>From Name</label>
                  <input type="text" value={smtp.from_name} onChange={(e) => set('from_name', e.target.value)} />
                </div>
                <div className="field">
                  <label>From E-mail <span className="req">*</span></label>
                  <input type="email" value={smtp.from_email} placeholder="noreply@reach.org" onChange={(e) => set('from_email', e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save SMTP Settings'}
              </button>

              <div className="section-title" style={{ marginTop: 26 }}>Send Test E-mail</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="email" placeholder="Recipient e-mail address" value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  style={{ flex: 1, minWidth: 220, padding: '10px 13px', border: '1.5px solid var(--line)', borderRadius: 10 }}
                />
                <button className="btn btn-teal" onClick={test} disabled={testBusy || !testTo}>
                  {testBusy ? 'Sending…' : 'Send Test'}
                </button>
              </div>
              {testResult && (
                <div className={`alert ${testResult.ok ? 'info' : 'error'}`} style={{ marginTop: 12, marginBottom: 0 }}>
                  {testResult.ok ? '✓ ' : '⚠ '}{testResult.message}
                </div>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>Your Account</h2>
          <div className="review-block" style={{ marginBottom: 0 }}>
            <div className="rb-head"><h4>Signed in as</h4><span /></div>
            <div className="review-rows">
              <div className="review-row"><div className="k">Name</div><div className="v">{session?.full_name || session?.username}</div></div>
              <div className="review-row"><div className="k">Username</div><div className="v">{session?.username}</div></div>
              <div className="review-row"><div className="k">Role</div><div className="v" style={{ textTransform: 'capitalize' }}>{session?.role}</div></div>
              <div className="review-row"><div className="k">Session</div><div className="v">Signs out after 8 hours</div></div>
            </div>
          </div>
          <div className="alert info" style={{ marginTop: 14, marginBottom: 0 }}>
            User accounts, roles and passwords are managed on the <strong>Users</strong> screen.
          </div>
        </div>
      </div>
    </>
  );
}

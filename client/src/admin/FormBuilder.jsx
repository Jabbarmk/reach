import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STEP_LABELS = {
  personal: 'Step 2 — Personal Information',
  expat: 'Step 4A — Expat Details',
  retired: 'Step 4B — Retired / Returned Details',
  details: 'Step 4 — Common Details (both expat & retired)',
};
const TYPE_LABELS = { text: 'Text', number: 'Number', date: 'Date', select: 'Dropdown', yesno: 'Yes / No', phone: 'Phone', email: 'E-mail', upload: 'Upload', year: 'Year' };
const LIST_LABELS = { panchayath: 'Panchayath / Municipality', qualification: 'Qualification', blood_group: 'Blood Groups', country: 'Countries' };

/* ================= Fields tab ================= */

function FieldModal({ field, listKeys, onClose, onSaved }) {
  const isNew = !field;
  const [form, setForm] = useState({
    step: field?.step || 'personal',
    label: field?.label || '',
    field_type: field?.field_type || 'text',
    required: field ? Boolean(field.required) : false,
    options_key: field?.options_key || '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isCore = field?.is_core;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await api.createField(form);
      } else {
        const payload = { label: form.label, required: form.required };
        if (!isCore) { payload.field_type = form.field_type; payload.options_key = form.options_key || null; }
        await api.updateField(field.id, payload);
      }
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 480 }}>
        <div className="crop-head">
          <h3>{isNew ? 'Add Field' : `Edit Field${isCore ? ' (core)' : ''}`}</h3>
          {isCore && <p>Core fields keep their type and data mapping — you can rename them and change the required flag.</p>}
        </div>
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert error">{error}</div>}
          {isNew && (
            <div className="field">
              <label>Form Section</label>
              <select value={form.step} onChange={(e) => set('step', e.target.value)}>
                {Object.entries(STEP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Label <span className="req">*</span></label>
            <input type="text" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Nominee Name" />
          </div>
          {(isNew || !isCore) && (
            <div className="field">
              <label>Field Type</label>
              <select value={form.field_type} onChange={(e) => set('field_type', e.target.value)}>
                {['text', 'number', 'date', 'select', 'yesno'].map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          )}
          {(isNew || !isCore) && form.field_type === 'select' && (
            <div className="field">
              <label>Option List <span className="req">*</span></label>
              <input
                type="text" list="fb-listkeys" value={form.options_key}
                onChange={(e) => set('options_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="Pick an existing list or type a new list name"
              />
              <datalist id="fb-listkeys">
                {listKeys.map((k) => <option key={k} value={k}>{LIST_LABELS[k] || k}</option>)}
              </datalist>
              <div className="hint">A new name creates an empty list — add its options in the Option Lists tab.</div>
            </div>
          )}
          <label className="checkline">
            <input type="checkbox" checked={form.required} onChange={(e) => set('required', e.target.checked)} />
            Required (compulsory) field
          </label>
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !form.label.trim()}>
            {busy ? 'Saving…' : 'Save Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldsTab() {
  const [fields, setFields] = useState(null);
  const [listKeys, setListKeys] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(undefined);

  const load = async () => {
    try {
      const [f, o] = await Promise.all([api.listFields(), api.listOptions()]);
      setFields(f.fields);
      setListKeys([...new Set([...Object.keys(LIST_LABELS), ...o.listKeys, ...o.options.map((x) => x.list_key)])]);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const patch = async (f, payload) => {
    try { await api.updateField(f.id, payload); load(); } catch (err) { setError(err.message); }
  };
  const move = async (f, dir) => {
    try { await api.moveField(f.id, dir); load(); } catch (err) { setError(err.message); }
  };
  const remove = async (f) => {
    if (!window.confirm(`Delete field "${f.label}"?`)) return;
    try { await api.deleteField(f.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>+ Add Field</button>
      </div>
      {!fields && <div className="empty-note"><span className="spinner lg" /></div>}
      {fields && Object.keys(STEP_LABELS).map((step) => {
        const stepFields = fields.filter((f) => f.step === step);
        if (!stepFields.length) return null;
        return (
          <div key={step} className="fb-group">
            <div className="fb-group-title">{STEP_LABELS[step]}</div>
            {stepFields.map((f, i) => (
              <div key={f.id} className={`fb-row ${!f.visible ? 'hidden-field' : ''}`}>
                <div className="fb-move">
                  <button disabled={i === 0} onClick={() => move(f, 'up')} title="Move up">▲</button>
                  <button disabled={i === stepFields.length - 1} onClick={() => move(f, 'down')} title="Move down">▼</button>
                </div>
                <div className="fb-main">
                  <div className="fb-label">
                    {f.label}
                    {Boolean(f.is_core) && <span className="pill blue" style={{ marginLeft: 8 }}>core</span>}
                    {!f.visible && <span className="pill grey" style={{ marginLeft: 6 }}>hidden</span>}
                  </div>
                  <div className="fb-meta">
                    {TYPE_LABELS[f.field_type] || f.field_type}
                    {f.options_key && ` · list: ${LIST_LABELS[f.options_key] || f.options_key}`}
                  </div>
                </div>
                <label className="fb-toggle" title="Compulsory field">
                  <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => patch(f, { required: e.target.checked })} />
                  Required
                </label>
                <label className="fb-toggle" title="Show on the form">
                  <input
                    type="checkbox" checked={Boolean(f.visible)} disabled={Boolean(f.required)}
                    onChange={(e) => patch(f, { visible: e.target.checked })}
                  />
                  Visible
                </label>
                <button className="btn btn-outline btn-sm" onClick={() => setModal(f)}>Edit</button>
                {!f.is_core && <button className="btn btn-ghost btn-sm" onClick={() => remove(f)}>Delete</button>}
              </div>
            ))}
          </div>
        );
      })}
      {modal !== undefined && (
        <FieldModal field={modal} listKeys={listKeys} onClose={() => setModal(undefined)} onSaved={() => { setModal(undefined); load(); }} />
      )}
    </>
  );
}

/* ================= Options tab ================= */

function OptionsTab() {
  const [options, setOptions] = useState(null);
  const [listKey, setListKey] = useState('panchayath');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // {id, value}

  const load = async () => {
    try { setOptions((await api.listOptions()).options); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const listKeys = options ? [...new Set([...Object.keys(LIST_LABELS), ...options.map((o) => o.list_key)])] : Object.keys(LIST_LABELS);
  const entries = options?.filter((o) => o.list_key === listKey) || [];

  const add = async () => {
    if (!newValue.trim()) return;
    try { await api.createOption({ list_key: listKey, value: newValue }); setNewValue(''); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const saveEdit = async () => {
    try { await api.updateOption(editing.id, editing.value); setEditing(null); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (o) => {
    if (!window.confirm(`Remove "${o.value}" from the list?`)) return;
    try { await api.deleteOption(o.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="tab-row" style={{ flexWrap: 'wrap' }}>
        {listKeys.map((k) => (
          <button key={k} className={`tab ${k === listKey ? 'active' : ''}`} onClick={() => { setListKey(k); setError(null); }}>
            {LIST_LABELS[k] || k}
          </button>
        ))}
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--line)', borderRadius: 10 }}
            placeholder={`Add a new option to ${LIST_LABELS[listKey] || listKey}…`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!newValue.trim()}>Add</button>
        </div>
        {!options && <div className="empty-note"><span className="spinner lg" /></div>}
        {entries.map((o) => (
          <div key={o.id} className="opt-row">
            {editing?.id === o.id ? (
              <>
                <input
                  autoFocus value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  style={{ flex: 1, padding: '7px 11px', border: '1.5px solid var(--blue-600)', borderRadius: 8 }}
                />
                <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{o.value}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing({ id: o.id, value: o.value })}>Rename</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(o)}>Delete</button>
              </>
            )}
          </div>
        ))}
        {options && !entries.length && <div className="empty-note">This list is empty — add its first option above.</div>}
      </div>
    </>
  );
}

/* ================= Plans tab ================= */

function PlanModal({ plan, onClose, onSaved }) {
  const isNew = !plan;
  const [form, setForm] = useState({
    name: plan?.name || '',
    fee: plan?.fee ?? '',
    validity_type: plan?.validity_type || 'range',
    validity_start: plan?.validity_start || '',
    validity_end: plan?.validity_end || '',
    is_active: plan ? Boolean(plan.is_active) : true,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isNew) await api.createPlan(form);
      else await api.updatePlan(plan.id, form);
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 460 }}>
        <div className="crop-head"><h3>{isNew ? 'Add Membership Plan' : `Edit — ${plan.name}`}</h3></div>
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Plan Name <span className="req">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid2">
            <div className="field">
              <label>Fee (₹) <span className="req">*</span></label>
              <input type="number" min="0" value={form.fee} onChange={(e) => set('fee', e.target.value)} />
            </div>
            <div className="field">
              <label>Validity</label>
              <select value={form.validity_type} onChange={(e) => set('validity_type', e.target.value)}>
                <option value="range">Date range</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
          </div>
          {form.validity_type === 'range' && (
            <div className="grid2">
              <div className="field">
                <label>Valid From <span className="req">*</span></label>
                <input type="date" value={form.validity_start} onChange={(e) => set('validity_start', e.target.value)} />
              </div>
              <div className="field">
                <label>Valid To <span className="req">*</span></label>
                <input type="date" value={form.validity_end} onChange={(e) => set('validity_end', e.target.value)} />
              </div>
            </div>
          )}
          <label className="checkline">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Active (shown on the registration form)
          </label>
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !form.name.trim() || form.fee === ''}>
            {busy ? 'Saving…' : 'Save Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(undefined);

  const load = async () => {
    try { setPlans((await api.listPlans()).plans); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(`Delete plan "${p.name}"?`)) return;
    try { await api.deletePlan(p.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>+ Add Plan</button>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr><th>Plan</th><th>Fee</th><th>Validity</th><th>Status</th><th style={{ width: 150 }}>Actions</th></tr>
            </thead>
            <tbody>
              {plans?.map((p) => (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{p.name}</td>
                  <td>₹{Number(p.fee).toLocaleString('en-IN')}</td>
                  <td>{p.validity_type === 'lifetime' ? 'Lifetime' : `${p.validity_start} → ${p.validity_end}`}</td>
                  <td>{p.is_active ? <span className="pill green">Active</span> : <span className="pill grey">Disabled</span>}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}>Edit</button>{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!plans && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>
      {modal !== undefined && (
        <PlanModal plan={modal} onClose={() => setModal(undefined)} onSaved={() => { setModal(undefined); load(); }} />
      )}
    </>
  );
}

/* ================= Page ================= */

export default function FormBuilder() {
  const [tab, setTab] = useState('fields');
  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Form Builder</h1>
          <p>Customise the registration form — fields, dropdown option lists and membership plans.</p>
        </div>
      </div>
      <div className="tab-row">
        <button className={`tab ${tab === 'fields' ? 'active' : ''}`} onClick={() => setTab('fields')}>Form Fields</button>
        <button className={`tab ${tab === 'options' ? 'active' : ''}`} onClick={() => setTab('options')}>Option Lists</button>
        <button className={`tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>Membership Plans</button>
      </div>
      {tab === 'fields' && <FieldsTab />}
      {tab === 'options' && <OptionsTab />}
      {tab === 'plans' && <PlansTab />}
    </>
  );
}

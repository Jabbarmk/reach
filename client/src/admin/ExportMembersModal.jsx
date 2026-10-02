import { useEffect, useMemo, useState } from 'react';
import { api, downloadBlob } from '../api.js';

const STORE_KEY = 'reach_member_export_prefs';

const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
};
const savePrefs = (p) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

/** Pick which member fields to export and how to sort them; exports the rows currently listed. */
export default function ExportMembersModal({ rows, filenamePrefix = 'members', onClose }) {
  const [fields, setFields] = useState(null);
  const [selected, setSelected] = useState(null); // Set of field keys
  const [sort, setSort] = useState(() => loadPrefs().sort || 'membership_id');
  const [dir, setDir] = useState(() => loadPrefs().dir || 'asc');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { fields: list } = await api.memberExportFields();
        setFields(list);
        const saved = loadPrefs().selected;
        setSelected(new Set(Array.isArray(saved) ? saved.filter((k) => list.some((f) => f.key === k)) : list.map((f) => f.key)));
      } catch (err) { setError(err.message); }
    })();
  }, []);

  const groups = useMemo(() => {
    const out = [];
    (fields || []).forEach((f) => {
      let g = out.find((x) => x.name === f.group);
      if (!g) { g = { name: f.group, items: [] }; out.push(g); }
      g.items.push(f);
    });
    return out;
  }, [fields]);

  const toggle = (keys, on) => setSelected((prev) => {
    const next = new Set(prev);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    return next;
  });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Keep the catalogue's column order regardless of the order boxes were ticked.
      const chosen = fields.filter((f) => selected.has(f.key)).map((f) => f.key);
      const blob = await api.exportMembers({ ids: rows.map((r) => r.id), fields: chosen, sort, dir });
      const url = URL.createObjectURL(blob);
      downloadBlob(url, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      savePrefs({ selected: chosen, sort, dir });
      onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 620 }}>
        <div className="crop-head">
          <h3>Export Members to Excel</h3>
          <p>{rows.length} member(s) from the current list &middot; tick the fields to include and choose the order</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '58vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          {!fields ? (error ? null : <div className="empty-note"><span className="spinner lg" /></div>) : (
            <>
              <div className="grid2">
                <div className="field">
                  <label>Sort by</label>
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Order</label>
                  <select value={dir} onChange={(e) => setDir(e.target.value)}>
                    <option value="asc">Ascending (A → Z, 1 → 9, oldest first)</option>
                    <option value="desc">Descending (Z → A, 9 → 1, newest first)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 10px' }}>
                <strong style={{ flex: 1 }}>Fields ({selected.size} of {fields.length})</strong>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(fields.map((f) => f.key), true)}>Select all</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
              {groups.map((g) => {
                const allOn = g.items.every((f) => selected.has(f.key));
                return (
                  <div key={g.name} style={{ marginBottom: 12 }}>
                    <label className="checkline" style={{ fontWeight: 700, marginBottom: 4 }}>
                      <input type="checkbox" checked={allOn} onChange={(e) => toggle(g.items.map((f) => f.key), e.target.checked)} />
                      {g.name}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '2px 12px', paddingLeft: 22 }}>
                      {g.items.map((f) => (
                        <label key={f.key} className="checkline" style={{ fontSize: 13.5 }}>
                          <input type="checkbox" checked={selected.has(f.key)} onChange={(e) => toggle([f.key], e.target.checked)} />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={busy || !selected?.size || !rows.length}>
            {busy ? 'Preparing…' : '⬇ Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

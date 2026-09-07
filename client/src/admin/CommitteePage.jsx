import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, fetchMeetingAttachmentBlob } from '../api.js';
import { formatDate } from '../dateUtils.js';

function PageHead({ title, sub, children }) {
  return (
    <div className="ovr-head" style={{ marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        <p>{sub}</p>
      </div>
      {children}
    </div>
  );
}

const LOCAL_BODY_LEVELS = /panchayat|municipal/i;
const needsLocalBody = (level) => LOCAL_BODY_LEVELS.test(level || '');

/* ===== Member search-and-pick (typeahead against the applications list) ===== */
function MemberPicker({ picked, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await api.listApplications({ status: 'All', search: q })); }
      catch { setResults([]); }
      finally { setBusy(false); }
    }, 250);
  };

  const pick = (m) => {
    onPick(m);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="field" ref={wrapRef}>
      <label>Member <span className="req">*</span></label>
      <div className="ss-wrap">
        <input
          type="text"
          placeholder="Search by name, reference no or membership ID…"
          value={open ? query : (picked ? `${picked.name} — ${picked.membership_id || picked.reference_no}` : '')}
          onFocus={() => { setOpen(true); setQuery(''); setResults([]); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); search(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        />
        <span className="ss-caret">▾</span>
        {open && (
          <div className="ss-menu">
            {busy && <div className="ss-empty">Searching…</div>}
            {!busy && query.trim() && results.length === 0 && <div className="ss-empty">No match found</div>}
            {!busy && !query.trim() && <div className="ss-empty">Start typing a name…</div>}
            {!busy && results.map((m) => (
              <button
                type="button" key={m.id}
                className={`ss-option ${picked?.id === m.id ? 'selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              >
                <strong>{m.name}</strong>
                <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: 12.5 }}>
                  {m.membership_id || m.reference_no}{m.place ? ` · ${m.place}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Assign / edit modal ===== */
function AssignmentModal({ assignment, options, panchayaths, onClose, onSaved }) {
  const isEdit = !!assignment;
  const [member, setMember] = useState(isEdit ? {
    id: assignment.application_id, name: assignment.member_name,
    reference_no: assignment.reference_no, membership_id: assignment.membership_id,
  } : null);
  const [committeeLevel, setCommitteeLevel] = useState(assignment?.committee_level || '');
  const [localBody, setLocalBody] = useState(assignment?.local_body || '');
  const [wing, setWing] = useState(assignment?.wing || '');
  const [designation, setDesignation] = useState(assignment?.designation || '');
  const [notes, setNotes] = useState(assignment?.notes || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!member) return setError('Select a member.');
    if (!committeeLevel) return setError('Select a committee level.');
    if (needsLocalBody(committeeLevel) && !localBody) return setError('Select the panchayat/municipality.');
    if (!wing) return setError('Select the Executive Committee / Wing.');
    if (!designation) return setError('Select a designation.');
    setBusy(true);
    try {
      const payload = {
        application_id: member.id,
        committee_level: committeeLevel,
        local_body: needsLocalBody(committeeLevel) ? localBody : null,
        wing, designation, notes,
      };
      if (isEdit) await api.updateCommitteeAssignment(assignment.id, payload);
      else await api.createCommitteeAssignment(payload);
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 520 }}>
        <div className="crop-head">
          <h3>{isEdit ? 'Edit Assignment' : 'Assign Member to Committee'}</h3>
          <p>Committee level, wing and designation for one member.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          <MemberPicker picked={member} onPick={setMember} />

          <div className="field">
            <label>Committee Level <span className="req">*</span></label>
            <select value={committeeLevel} onChange={(e) => { setCommitteeLevel(e.target.value); setLocalBody(''); }}>
              <option value="">Select…</option>
              {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {needsLocalBody(committeeLevel) && (
            <div className="field">
              <label>Panchayath / Municipality <span className="req">*</span></label>
              <select value={localBody} onChange={(e) => setLocalBody(e.target.value)}>
                <option value="">Select…</option>
                {panchayaths.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label>Executive Committee / Wing <span className="req">*</span></label>
            <select value={wing} onChange={(e) => setWing(e.target.value)}>
              <option value="">Select…</option>
              {options.wings.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Designation <span className="req">*</span></label>
            <select value={designation} onChange={(e) => setDesignation(e.target.value)}>
              <option value="">Select…</option>
              {options.designations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={notes} style={{ width: '100%', resize: 'vertical' }} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Assign Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Assignments tab ===== */
function AssignmentsTab({ options, panchayaths }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [wingFilter, setWingFilter] = useState('');
  const [error, setError] = useState(null);
  const [modalFor, setModalFor] = useState(null); // null = closed, {} = new, {...row} = edit
  const [busyId, setBusyId] = useState(null);

  const filters = () => ({
    ...(search ? { search } : {}),
    ...(levelFilter ? { committee_level: levelFilter } : {}),
    ...(wingFilter ? { wing: wingFilter } : {}),
  });

  const load = async () => {
    setError(null);
    try { setRows(await api.listCommitteeAssignments(filters())); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [levelFilter, wingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.member_name} from ${row.committee_level} — ${row.designation}?`)) return;
    setBusyId(row.id);
    try { await api.deleteCommitteeAssignment(row.id); load(); }
    catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input
          placeholder="Search by member name, reference or membership ID…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={wingFilter} onChange={(e) => setWingFilter(e.target.value)}>
          <option value="">All Wings</option>
          {options.wings.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setModalFor({})}>+ Assign Member</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr>
                <th>Member</th><th>Committee Level</th><th>Panchayath/Municipality</th>
                <th>Wing</th><th>Designation</th><th>Notes</th><th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>
                    {r.member_name}<br />
                    <span style={{ fontWeight: 700, color: 'var(--blue-800)', fontSize: 12 }}>{r.membership_id || r.reference_no}</span>
                  </td>
                  <td>{r.committee_level}</td>
                  <td>{r.local_body || '—'}</td>
                  <td>{r.wing}</td>
                  <td><span className="pill blue">{r.designation}</span></td>
                  <td style={{ maxWidth: 180 }}>{r.notes || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setModalFor(r)} disabled={busyId === r.id}>✏️</button>
                      <button className="icon-btn danger" title="Remove" onClick={() => remove(r)} disabled={busyId === r.id}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 && <div className="empty-note">No committee assignments yet — click "+ Assign Member" to add one.</div>}
        {!rows && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>

      {modalFor && (
        <AssignmentModal
          assignment={modalFor.id ? modalFor : null}
          options={options}
          panchayaths={panchayaths}
          onClose={() => setModalFor(null)}
          onSaved={() => { setModalFor(null); load(); }}
        />
      )}
    </>
  );
}

/* ===== Manage Options tab (Levels / Wings / Designations) ===== */
function EditableOptionList({ title, hint, list, listKey, onSaved }) {
  const [items, setItems] = useState(list);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setItems(list); }, [list]);

  const update = (i, value) => { setItems((rows) => rows.map((r, idx) => (idx === i ? value : r))); setSaved(false); };
  const remove = (i) => { setItems((rows) => rows.filter((_, idx) => idx !== i)); setSaved(false); };
  const add = () => {
    setError(null);
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) return setError('That option already exists.');
    setItems((rows) => [...rows, v]);
    setDraft('');
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try { setItems((await api.saveCommitteeOptions(listKey, items)).items); setSaved(true); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>{title}</h2>
      <p className="sub">{hint}</p>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert info">✓ Saved.</div>}
      <div className="table-card" style={{ marginBottom: 16 }}>
        <div className="table-scroll">
          <table className="apps">
            <thead><tr><th>Option</th><th style={{ width: 50 }} /></tr></thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="text" value={row} onChange={(e) => update(i, e.target.value)}
                      style={{ width: '100%', padding: '6px 9px', border: '1.5px solid var(--line)', borderRadius: 8 }}
                    />
                  </td>
                  <td><button className="icon-btn danger" title="Remove" onClick={() => remove(i)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && <div className="empty-note">No options yet — add one below.</div>}
      </div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <input placeholder="New option…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-outline btn-sm" onClick={add}>+ Add</button>
      </div>
      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : `Save ${title}`}</button>
    </div>
  );
}

function OptionsTab({ options, onChanged }) {
  return (
    <>
      <EditableOptionList
        title="Committee Levels" listKey="levels" list={options.levels}
        hint="e.g. Central Committee, Panchayat Committee, Municipal Committee."
        onSaved={onChanged}
      />
      <EditableOptionList
        title="Executive Committee / Wings" listKey="wings" list={options.wings}
        hint="Central Executive, Advisory Board, and the sub-wing committees."
        onSaved={onChanged}
      />
      <EditableOptionList
        title="Designations" listKey="designations" list={options.designations}
        hint="President, General Secretary, Treasurer, and other office-bearer titles."
        onSaved={onChanged}
      />
    </>
  );
}

/* ===== Minutes of Meeting ===== */
const MEETING_TEXT_FIELDS = [
  ['agenda', 'Meeting Agenda'],
  ['discussed_points', 'Discussed Points'],
  ['last_meeting_updates', 'Last Meeting Updates'],
  ['new_decisions', 'New Decisions'],
];

function AttendancePicker({ members, present, absent, setPresent, setAbsent }) {
  if (!members) return <div className="hint">Select a Committee Level and Wing above to load its members.</div>;
  if (members.length === 0) return <div className="hint">No one is assigned to this committee yet — add assignments first.</div>;

  const setStatus = (id, status) => {
    setPresent((p) => (status === 'present' ? [...new Set([...p, id])] : p.filter((x) => x !== id)));
    setAbsent((a) => (status === 'absent' ? [...new Set([...a, id])] : a.filter((x) => x !== id)));
  };

  return (
    <div className="table-card" style={{ marginBottom: 4 }}>
      <div className="table-scroll" style={{ maxHeight: 260 }}>
        <table className="apps">
          <thead><tr><th>Member</th><th style={{ width: 190 }}>Attendance</th></tr></thead>
          <tbody>
            {members.map((m) => {
              const isPresent = present.includes(m.application_id);
              const isAbsent = absent.includes(m.application_id);
              return (
                <tr key={m.application_id}>
                  <td>{m.member_name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({m.designation})</span></td>
                  <td>
                    <div className="seg" role="group" aria-label={`Attendance for ${m.member_name}`}>
                      <button type="button" className={`seg-btn ${isPresent ? 'active' : ''}`} onClick={() => setStatus(m.application_id, 'present')}>Present</button>
                      <button type="button" className={`seg-btn ${isAbsent ? 'active' : ''}`} onClick={() => setStatus(m.application_id, 'absent')}>Absent</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MeetingFormModal({ meeting, options, panchayaths, onClose, onSaved }) {
  const isEdit = !!meeting;
  const [committeeLevel, setCommitteeLevel] = useState(meeting?.committee_level || '');
  const [localBody, setLocalBody] = useState(meeting?.local_body || '');
  const [wing, setWing] = useState(meeting?.wing || '');
  const [meetingDate, setMeetingDate] = useState(meeting?.meeting_date?.slice(0, 10) || '');
  const [meetingTime, setMeetingTime] = useState(meeting?.meeting_time?.slice(0, 5) || '');
  const [venue, setVenue] = useState(meeting?.venue || '');
  const [fields, setFields] = useState(Object.fromEntries(MEETING_TEXT_FIELDS.map(([k]) => [k, meeting?.[k] || ''])));
  const [preparedBy, setPreparedBy] = useState(meeting?.prepared_by || '');
  const [approvedBy, setApprovedBy] = useState(meeting?.approved_by || '');
  const [attachment, setAttachment] = useState(null);
  const [members, setMembers] = useState(null);
  const [present, setPresent] = useState(meeting?.attendance?.filter((a) => a.status === 'present').map((a) => a.application_id) || []);
  const [absent, setAbsent] = useState(meeting?.attendance?.filter((a) => a.status === 'absent').map((a) => a.application_id) || []);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!committeeLevel || !wing) { setMembers(null); return; }
    (async () => {
      try { setMembers(await api.listCommitteeAssignments({ committee_level: committeeLevel, wing })); }
      catch { setMembers([]); }
    })();
  }, [committeeLevel, wing]);

  const save = async () => {
    setError(null);
    if (!committeeLevel) return setError('Select a committee level.');
    if (needsLocalBody(committeeLevel) && !localBody) return setError('Select the panchayat/municipality.');
    if (!wing) return setError('Select the Executive Committee / Wing.');
    if (!meetingDate) return setError('Select the meeting date.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('committee_level', committeeLevel);
      fd.append('local_body', needsLocalBody(committeeLevel) ? localBody : '');
      fd.append('wing', wing);
      fd.append('meeting_date', meetingDate);
      fd.append('meeting_time', meetingTime);
      fd.append('venue', venue);
      MEETING_TEXT_FIELDS.forEach(([k]) => fd.append(k, fields[k]));
      fd.append('prepared_by', preparedBy);
      fd.append('approved_by', approvedBy);
      fd.append('participants', JSON.stringify(present));
      fd.append('absentees', JSON.stringify(absent));
      if (attachment) fd.append('attachment', attachment);

      if (isEdit) await api.updateMeeting(meeting.id, fd);
      else await api.createMeeting(fd);
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 640 }}>
        <div className="crop-head">
          <h3>{isEdit ? 'Edit Meeting Minutes' : 'New Meeting Minutes'}</h3>
          <p>Record the committee, agenda, attendance and decisions for this meeting.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '68vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}

          <div className="grid2">
            <div className="field">
              <label>Committee Level <span className="req">*</span></label>
              <select value={committeeLevel} onChange={(e) => { setCommitteeLevel(e.target.value); setLocalBody(''); }}>
                <option value="">Select…</option>
                {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {needsLocalBody(committeeLevel) && (
              <div className="field">
                <label>Panchayath / Municipality <span className="req">*</span></label>
                <select value={localBody} onChange={(e) => setLocalBody(e.target.value)}>
                  <option value="">Select…</option>
                  {panchayaths.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>Executive Committee / Wing <span className="req">*</span></label>
              <select value={wing} onChange={(e) => setWing(e.target.value)}>
                <option value="">Select…</option>
                {options.wings.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Meeting Date <span className="req">*</span></label>
              <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Meeting Time</label>
              <input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </div>
            <div className="field">
              <label>Venue</label>
              <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Panchayat Community Hall" />
            </div>
          </div>

          {MEETING_TEXT_FIELDS.map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <textarea
                rows={key === 'agenda' ? 2 : 3} value={fields[key]} style={{ width: '100%', resize: 'vertical' }}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          <div className="field">
            <label>Participated / Absent Members</label>
            <AttendancePicker members={members} present={present} absent={absent} setPresent={setPresent} setAbsent={setAbsent} />
          </div>

          <div className="grid2">
            <div className="field">
              <label>Prepared By</label>
              <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Name & designation" />
            </div>
            <div className="field">
              <label>Approved By</label>
              <input type="text" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Name & designation" />
            </div>
          </div>

          <div className="field">
            <label>Attachment (signed copy — PDF, JPG or PNG)</label>
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
            {isEdit && meeting.attachment_file && !attachment && <div className="hint">Current: {meeting.attachment_original_name} (choose a file to replace it)</div>}
          </div>
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Minutes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingDetailModal({ id, isAdmin, onClose, onEdit, onDeleted }) {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setM(await api.getMeeting(id)); } catch (err) { setError(err.message); }
    })();
  }, [id]);

  const viewAttachment = async () => {
    try { window.open(await fetchMeetingAttachmentBlob(id), '_blank'); }
    catch (err) { setError(err.message); }
  };

  const remove = async () => {
    if (!window.confirm('Delete these meeting minutes permanently?')) return;
    setBusy(true);
    try { await api.deleteMeeting(id); onDeleted(); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  const present = m?.attendance?.filter((a) => a.status === 'present') || [];
  const absent = m?.attendance?.filter((a) => a.status === 'absent') || [];

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 640 }}>
        <div className="crop-head">
          <h3>Meeting Minutes</h3>
          {m && <p>{m.committee_level}{m.local_body ? ` — ${m.local_body}` : ''} · {m.wing}</p>}
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '68vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          {!m ? <div className="empty-note"><span className="spinner lg" /></div> : (
            <>
              <div className="grid2" style={{ marginBottom: 14 }}>
                <div className="review-row"><div className="k">Date</div><div className="v">{formatDate(m.meeting_date, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
                {m.meeting_time && <div className="review-row"><div className="k">Time</div><div className="v">{m.meeting_time}</div></div>}
                {m.venue && <div className="review-row"><div className="k">Venue</div><div className="v">{m.venue}</div></div>}
              </div>
              {MEETING_TEXT_FIELDS.map(([key, label]) => m[key] && (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue-800)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{m[key]}</div>
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue-800)', marginBottom: 6 }}>
                  Participated ({present.length}) · Absent ({absent.length})
                </div>
                {present.length === 0 && absent.length === 0 ? <div className="hint">No attendance recorded.</div> : (
                  <div className="mg-pills" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    {present.map((a) => <span key={a.application_id} className="pill green">{a.name}</span>)}
                    {absent.map((a) => <span key={a.application_id} className="pill red">{a.name}</span>)}
                  </div>
                )}
              </div>
              <div className="grid2" style={{ marginBottom: 14 }}>
                {m.prepared_by && <div className="review-row"><div className="k">Prepared By</div><div className="v">{m.prepared_by}</div></div>}
                {m.approved_by && <div className="review-row"><div className="k">Approved By</div><div className="v">{m.approved_by}</div></div>}
              </div>
              {m.attachment_file && (
                <button className="btn btn-outline btn-sm" onClick={viewAttachment}>📄 View Attachment</button>
              )}
            </>
          )}
        </div>
        <div className="crop-actions">
          {isAdmin && m && (
            <>
              <button className="btn btn-outline btn-sm" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>🗑 Delete</button>
              <button className="btn btn-outline btn-sm" onClick={() => onEdit(m)}>✏️ Edit</button>
            </>
          )}
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function MeetingCard({ m, onOpen }) {
  return (
    <div className="member-card" style={{ textAlign: 'left', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => onOpen(m.id)}>
      <div style={{ fontWeight: 700, color: 'var(--blue-800)', fontSize: 13 }}>
        {formatDate(m.meeting_date, { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div className="mg-name" style={{ marginTop: 6 }}>{m.committee_level}{m.local_body ? ` — ${m.local_body}` : ''}</div>
      <div className="mg-meta">{m.wing}</div>
      {m.agenda && <div className="mg-meta" style={{ marginTop: 6, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.agenda}</div>}
      <div className="mg-pills" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
        <span className="pill green">{m.present} present</span>
        <span className="pill red">{m.absent} absent</span>
      </div>
    </div>
  );
}

function MeetingsTab({ isAdmin, options, panchayaths }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [wingFilter, setWingFilter] = useState('');
  const [error, setError] = useState(null);
  const [formFor, setFormFor] = useState(null); // null closed, {} new, {...meeting} edit
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    setError(null);
    try {
      setRows(await api.listMeetings({
        ...(search ? { search } : {}),
        ...(levelFilter ? { committee_level: levelFilter } : {}),
        ...(wingFilter ? { wing: wingFilter } : {}),
      }));
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [levelFilter, wingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input placeholder="Search agenda or venue…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={wingFilter} onChange={(e) => setWingFilter(e.target.value)}>
          <option value="">All Wings</option>
          {options.wings.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
        <span style={{ flex: 1 }} />
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setFormFor({})}>+ New Meeting</button>}
      </div>

      {!rows ? (
        <div className="empty-note"><span className="spinner lg" /></div>
      ) : rows.length === 0 ? (
        <div className="empty-note">No meeting minutes recorded yet{isAdmin ? ' — click "+ New Meeting" to add one.' : '.'}</div>
      ) : (
        <div className="member-grid">
          {rows.map((m) => <MeetingCard key={m.id} m={m} onOpen={setDetailId} />)}
        </div>
      )}

      {formFor && (
        <MeetingFormModal
          meeting={formFor.id ? formFor : null}
          options={options}
          panchayaths={panchayaths}
          onClose={() => setFormFor(null)}
          onSaved={() => { setFormFor(null); load(); }}
        />
      )}
      {detailId && (
        <MeetingDetailModal
          id={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onEdit={(m) => { setDetailId(null); setFormFor(m); }}
          onDeleted={() => { setDetailId(null); load(); }}
        />
      )}
    </>
  );
}

export default function CommitteePage() {
  const { session } = useOutletContext();
  const isAdmin = session?.role === 'admin';
  const [tab, setTab] = useState('assignments');
  const [options, setOptions] = useState(null);
  const [panchayaths, setPanchayaths] = useState([]);
  const [error, setError] = useState(null);

  const loadOptions = async () => {
    try { setOptions(await api.committeeOptions()); } catch (err) { setError(err.message); }
  };
  useEffect(() => {
    loadOptions();
    (async () => {
      try { setPanchayaths((await api.formConfig()).options?.panchayath || []); } catch { /* keep empty */ }
    })();
  }, []);

  return (
    <>
      <PageHead title="Committee & Team" sub="Assign members to committee levels, wings and designations." />
      <div className="tab-row">
        <button className={`tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>Assignments</button>
        <button className={`tab ${tab === 'meetings' ? 'active' : ''}`} onClick={() => setTab('meetings')}>Minutes of Meeting</button>
        {isAdmin && <button className={`tab ${tab === 'options' ? 'active' : ''}`} onClick={() => setTab('options')}>Manage Options</button>}
      </div>
      {error && <div className="alert error">{error}</div>}
      {!options ? (
        <div className="empty-note"><span className="spinner lg" /></div>
      ) : tab === 'assignments' ? (
        <AssignmentsTab options={options} panchayaths={panchayaths} />
      ) : tab === 'meetings' ? (
        <MeetingsTab isAdmin={isAdmin} options={options} panchayaths={panchayaths} />
      ) : (
        <OptionsTab options={options} onChanged={loadOptions} />
      )}
    </>
  );
}

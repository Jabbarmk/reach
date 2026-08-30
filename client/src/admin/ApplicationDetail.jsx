import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, fetchDocBlob, fetchReceiptBlob, downloadBlob, setToken } from '../api.js';
import MembershipCard from './MembershipCard.jsx';
import PaymentModal from './PaymentModal.jsx';

const Row = ({ k, v }) => (
  <div className="review-row"><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>
);

const statusPill = (s) => {
  const map = {
    'Pending Verification': 'orange', 'Correction Requested': 'red', 'Payment Pending': 'blue',
    Active: 'green', Approved: 'teal', Rejected: 'red',
  };
  return <span className={`pill ${map[s] || 'grey'}`}>{s}</span>;
};

const DOC_LABELS = { photo: 'Member Photo', aadhaar: 'Aadhaar Card', id_card_abroad: 'Foreign ID Card', payment_receipt: 'Payment Receipt' };

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshStats, session } = useOutletContext();
  const canApprove = session?.screens?.includes('approvals');
  const canPay = session?.screens?.includes('payments');
  const canDelete = session?.role === 'admin';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [viewer, setViewer] = useState(null); // {url, mime, label}
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [payModal, setPayModal] = useState(null); // 'approve' | 'record' | 'edit'

  const load = async () => {
    try {
      const res = await api.getApplication(id);
      setData(res);
      const photoDoc = res.documents.find((d) => d.doc_type === 'photo');
      if (photoDoc) {
        try { setPhotoUrl(await fetchDocBlob(photoDoc.id)); } catch { /* ignore */ }
      }
    } catch (err) {
      if (err.status === 401) { setToken(null); navigate('/admin/login'); return; }
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAction = async (action) => {
    if (action === 'reject' && !window.confirm('Reject this application?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.action(id, action, note || undefined);
      setData((prev) => ({ ...prev, application: res.application }));
      setNote('');
      const hist = await api.getApplication(id);
      setData(hist);
      refreshStats?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (doc) => {
    try {
      const url = await fetchDocBlob(doc.id);
      setViewer({ url, mime: doc.mime_type, label: DOC_LABELS[doc.doc_type] });
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data && !error) return <div className="empty-note"><span className="spinner lg" /></div>;
  if (error && !data) return <div className="alert error">{error}</div>;

  const app = data.application;
  const isPending = ['Pending Verification', 'Submitted', 'Correction Requested'].includes(app.status);

  return (
    <>
      <button className="btn btn-outline btn-sm no-print" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      {error && <div className="alert error no-print">{error}</div>}

      <div className="detail-grid">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {photoUrl
                ? <img src={photoUrl} alt="Member" className="photo-preview-lg" />
                : <div className="photo-preview-lg" style={{ background: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>👤</div>}
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 style={{ marginBottom: 2 }}>{app.name}</h2>
                <p className="sub" style={{ marginBottom: 10 }}>
                  {app.membership_id ? <strong>{app.membership_id} · </strong> : null}{app.reference_no}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {statusPill(app.status)}
                  {app.payment_status === 'Paid' ? <span className="pill green">Paid</span> : <span className="pill grey">Unpaid</span>}
                  <span className="pill blue">{app.membership_type === 'lifetime' ? 'Lifetime ₹2,000' : 'Two-Year ₹300'}</span>
                  {app.is_expat ? <span className="pill teal">Expat</span> : <span className="pill teal">Retired / Returned</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="review-block" style={{ background: '#fff' }}>
            <div className="rb-head"><h4>Personal Information</h4><span /></div>
            <div className="review-rows">
              <Row k="Father's Name" v={app.father_name} />
              <Row k="House Name" v={app.house_name} />
              <Row k="Place" v={app.place} />
              <Row k="Post Office" v={app.post_office} />
              <Row k="Panchayath/Municipality" v={app.panchayath} />
              <Row k="Blood Group" v={app.blood_group} />
              <Row k="Date of Birth" v={app.date_of_birth} />
              <Row k="Qualification" v={app.qualification} />
              <Row
                k="Aadhaar Number"
                v={
                  <span style={{ fontFamily: 'monospace' }}>
                    {showAadhaar ? app.aadhaar_number.replace(/(\d{4})(?=\d)/g, '$1 ') : app.aadhaar_masked}
                    <button className="btn btn-outline btn-sm" style={{ marginLeft: 10 }} onClick={() => setShowAadhaar(!showAadhaar)}>
                      {showAadhaar ? 'Hide' : 'Reveal'}
                    </button>
                  </span>
                }
              />
            </div>
          </div>

          <div className="review-block" style={{ background: '#fff' }}>
            <div className="rb-head"><h4>{app.is_expat ? 'Expat Details' : 'Retired / Returned Details'}</h4><span /></div>
            <div className="review-rows">
              {app.is_expat ? (
                <>
                  <Row k="Phone (Abroad)" v={app.phone_abroad} />
                  <Row k="Home Contact Number" v={app.home_contact_number} />
                  <Row k="ID Number (Abroad)" v={app.id_card_number_abroad_masked} />
                  <Row k="Working Country" v={app.working_country} />
                  <Row k="City" v={app.city} />
                </>
              ) : (
                <>
                  <Row k="Retired Year" v={app.retired_year} />
                  <Row k="Phone (India)" v={app.phone_india} />
                </>
              )}
              <Row k="WhatsApp" v={app.whatsapp_number} />
              <Row k="E-mail" v={app.email} />
              <Row k="Current Job" v={app.current_job} />
              <Row k="Years Abroad" v={app.years_abroad} />
              <Row k="Friend/Family" v={`${app.emergency_name} · ${app.emergency_phone}`} />
            </div>
          </div>

          {data.custom?.length > 0 && (
            <div className="review-block" style={{ background: '#fff' }}>
              <div className="rb-head"><h4>Additional Information</h4><span /></div>
              <div className="review-rows">
                {data.custom.map((c, i) => <Row key={i} k={c.label} v={c.value} />)}
              </div>
            </div>
          )}

          {(app.membership_id) && (
            <div className="card no-print" style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: 17 }}>Membership Card</h2>
              <p className="sub">Generated after approval{app.payment_status !== 'Paid' ? ' — payment still pending' : ''}.</p>
              <button className="btn btn-teal btn-sm" onClick={() => setShowCard(!showCard)}>
                {showCard ? 'Hide card' : 'Show membership card'}
              </button>
              {showCard && (
                <div style={{ marginTop: 16 }}>
                  <MembershipCard app={app} photoUrl={photoUrl} />
                  <div style={{ textAlign: 'center', marginTop: 12 }} className="no-print">
                    <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print card</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Documents</h2>
            {data.documents.length === 0 && <p className="sub">No documents uploaded.</p>}
            {data.documents.map((doc) => (
              <div className="doc-tile" key={doc.id}>
                <div className="ico">{doc.doc_type === 'photo' ? '📷' : '🪪'}</div>
                <div className="meta">
                  <div className="t">{DOC_LABELS[doc.doc_type]}</div>
                  <div className="s">
                    {doc.mime_type.includes('pdf') ? 'PDF' : 'Image'} · {Math.round(doc.size_bytes / 1024)} KB
                    {doc.ocr_status !== 'not_applicable' && ` · OCR: ${doc.ocr_status}`}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => openDoc(doc)}>View</button>
              </div>
            ))}
          </div>

          {data.payment && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Payment</h2>
              <div className="review-rows" style={{ padding: 0 }}>
                {data.payment.receipt_number && <div className="review-row"><div className="k">Receipt No.</div><div className="v" style={{ fontFamily: 'monospace' }}>{data.payment.receipt_number}</div></div>}
                <div className="review-row"><div className="k">Amount</div><div className="v">₹{Number(data.payment.amount).toLocaleString('en-IN')}</div></div>
                <div className="review-row"><div className="k">Method</div><div className="v">{data.payment.method}</div></div>
                <div className="review-row"><div className="k">Date</div><div className="v">{data.payment.paid_on}</div></div>
                <div className="review-row"><div className="k">Recorded by</div><div className="v">{data.payment.recorded_by}</div></div>
                {data.payment.note && <div className="review-row"><div className="k">Note</div><div className="v">{data.payment.note}</div></div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {data.payment.receipt_number && (
                  <>
                    <button className="btn btn-teal btn-sm"
                      onClick={async () => { const url = await fetchReceiptBlob(data.payment.id); window.open(url, '_blank'); }}>
                      🧾 View Receipt PDF
                    </button>
                    <button className="btn btn-outline btn-sm"
                      onClick={async () => { const url = await fetchReceiptBlob(data.payment.id); downloadBlob(url, `${data.payment.receipt_number}.pdf`); }}>
                      ⬇ Download
                    </button>
                  </>
                )}
                {data.payment.receipt_doc_id && (
                  <button className="btn btn-outline btn-sm"
                    onClick={() => {
                      const doc = data.documents.find((d) => d.id === data.payment.receipt_doc_id);
                      if (doc) openDoc(doc);
                    }}>
                    📄 View Uploaded Proof
                  </button>
                )}
                {session?.role === 'admin' && (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={() => setPayModal('edit')}>Edit</button>
                    <button className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        if (!window.confirm('Delete this payment record? The member becomes Unpaid again.')) return;
                        setBusy(true);
                        try { await api.deletePayment(data.payment.id); await load(); refreshStats?.(); }
                        catch (err) { setError(err.message); }
                        finally { setBusy(false); }
                      }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Actions</h2>
            <div className="field">
              <label>Note (optional)</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / remark for this action…" style={{ width: '100%', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isPending && canApprove && (
                <button className="btn btn-green" disabled={busy} onClick={() => setPayModal('approve')}>
                  ✓ Approve &amp; Generate Membership ID
                </button>
              )}
              {isPending && canApprove && (
                <button className="btn btn-outline" disabled={busy} onClick={() => doAction('request_correction')}>
                  ✎ Request Correction
                </button>
              )}
              {app.payment_status !== 'Paid' && !isPending && canPay && (
                <button className="btn btn-teal" disabled={busy} onClick={() => setPayModal('record')}>
                  ₹ Record Payment
                </button>
              )}
              {isPending && canApprove && (
                <button className="btn btn-danger" disabled={busy} onClick={() => doAction('reject')}>
                  ✕ Reject Application
                </button>
              )}
              {!canApprove && !canPay && <p className="sub" style={{ marginBottom: 0 }}>Your role has view-only access to applications.</p>}
            </div>
            {app.admin_note && <div className="alert info" style={{ marginTop: 12, marginBottom: 0 }}>Last note: {app.admin_note}</div>}
          </div>

          {canDelete && (
            <div className="card danger-zone" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, marginBottom: 6, color: 'var(--red-600)' }}>Danger Zone</h2>
              <p className="sub" style={{ marginBottom: 12 }}>
                Moves this member to Deleted Members, where they can be restored or permanently removed.
              </p>
              <button
                className="btn btn-danger btn-sm" disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Delete ${app.name}? The member will move to Deleted Members and can be restored.`)) return;
                  setBusy(true);
                  try {
                    await api.deleteApplication(app.id);
                    refreshStats?.();
                    navigate('/admin/members');
                  } catch (err) {
                    setError(err.message);
                    setBusy(false);
                  }
                }}
              >
                🗑 Delete Application
              </button>
            </div>
          )}

          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>History</h2>
            <ul className="timeline">
              {data.history.map((h, i) => (
                <li key={i}>
                  <div className="ta">{h.action}</div>
                  {h.detail && <div className="td">{h.detail}</div>}
                  <div className="tt">{new Date(h.created_at).toLocaleString('en-IN')} · {h.actor}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {payModal && (
        <PaymentModal
          mode={payModal}
          app={app}
          payment={payModal === 'edit' ? data.payment : null}
          onClose={() => setPayModal(null)}
          onDone={async () => { setPayModal(null); await load(); refreshStats?.(); }}
        />
      )}

      {viewer && (
        <div className="modal-overlay" onClick={() => { URL.revokeObjectURL(viewer.url); setViewer(null); }}>
          <div className="crop-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="crop-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{viewer.label}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => { URL.revokeObjectURL(viewer.url); setViewer(null); }}>Close</button>
            </div>
            <div style={{ maxHeight: '70vh', overflow: 'auto', padding: 12, textAlign: 'center' }}>
              {viewer.mime.includes('pdf')
                ? <iframe src={viewer.url} title="Document" style={{ width: '100%', height: '65vh', border: 'none' }} />
                : <img src={viewer.url} alt={viewer.label} style={{ maxWidth: '100%', borderRadius: 8 }} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

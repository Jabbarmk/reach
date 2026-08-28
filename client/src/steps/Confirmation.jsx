export default function Confirmation({ result, data }) {
  const planName = result.plan_name || result.membership_type;

  return (
    <div className="card print-zone">
      <div className="confirm-hero">
        <div className="tick">✓</div>
        <h2>Application Submitted Successfully</h2>
        <p className="sub" style={{ marginTop: 6 }}>
          Thank you, <strong>{data.name}</strong>. Your membership application has been received.
        </p>
      </div>

      <div className="refbox">
        <div className="lbl">Application Reference Number</div>
        <div className="val">{result.reference_no}</div>
      </div>

      <div className="review-block">
        <div className="rb-head"><h4>Application Summary</h4><span /></div>
        <div className="review-rows">
          <div className="review-row"><div className="k">Membership Type</div><div className="v">{planName}</div></div>
          <div className="review-row"><div className="k">Fee</div><div className="v">₹{result.membership_fee.toLocaleString('en-IN')}</div></div>
          <div className="review-row"><div className="k">Status</div><div className="v"><span className="pill orange">Pending Verification</span></div></div>
          <div className="review-row"><div className="k">Submitted On</div><div className="v">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
        </div>
      </div>

      <div className="alert info">
        Please keep your reference number safe. Our team will verify your application and documents;
        you will be contacted about payment and membership confirmation.
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }} className="no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print / Download Acknowledgement
        </button>
        <a className="btn btn-outline" href="/register">Start a New Application</a>
      </div>
    </div>
  );
}

import { useId, useRef, useState } from 'react';
import { canOcr } from '../ocr.js';

const MAX_MB = 5;
const ACCEPT = 'application/pdf,image/jpeg,image/png';

/**
 * Generic optional document upload (Aadhaar / foreign ID) with OCR states.
 * onExtract(file) -> Promise<{success, ...values}> ; parent applies values.
 */
export default function DocUpload({ label, doc, onChange, onExtract, ocrState, setOcrState, hint, required = false, error }) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState(null);

  const runOcr = async (file) => {
    if (!onExtract) return;
    if (!canOcr(file)) {
      setOcrState({ status: 'skipped', message: 'PDF uploaded — automatic reading works with images only. Please enter the details manually below.' });
      return;
    }
    setOcrState({ status: 'loading' });
    try {
      const result = await onExtract(file);
      if (result.success) {
        setOcrState({ status: 'success', message: 'Details read from the document — please review and correct if needed.' });
      } else {
        setOcrState({ status: 'failed', message: 'We could not read this document. Please upload a clearer copy or enter the details manually.' });
      }
    } catch {
      setOcrState({ status: 'failed', message: 'We could not read this document. Please upload a clearer copy or enter the details manually.' });
    }
  };

  const pickFile = (file) => {
    setLocalError(null);
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setLocalError('Allowed formats: PDF, JPG, PNG.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`File must be under ${MAX_MB} MB.`);
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    onChange({ file, previewUrl });
    runOcr(file);
  };

  const remove = () => {
    if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl);
    onChange(null);
    setOcrState?.({ status: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const sizeLabel = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required ? <span className="req">*</span> : <span className="opt">(optional)</span>}</label>
      {/* Same native <label> trigger as PhotoUpload — see the note there. */}
      <input ref={inputRef} id={inputId} type="file" accept={ACCEPT} className="file-input-hidden" onChange={(e) => pickFile(e.target.files?.[0])} />

      {doc ? (
        <div className="upload-preview">
          {doc.previewUrl
            ? <img src={doc.previewUrl} alt="Uploaded document" className="thumb" />
            : <div className="doc-ico">📄</div>}
          <div className="meta">
            <div className="fname">{doc.file.name}</div>
            <div className="fsize">{sizeLabel(doc.file.size)}</div>
          </div>
          <label htmlFor={inputId} className="btn btn-outline btn-sm" role="button">Replace</label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>Remove</button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`upload-zone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
        >
          <div className="ico">🪪</div>
          <div className="t1">Click to upload</div>
          <div className="t2">{hint || 'PDF, JPG or PNG, up to 5 MB'}</div>
        </label>
      )}

      {(localError || error) && <div className="err">{localError || error}</div>}

      {ocrState?.status === 'loading' && (
        <div className="ocr-banner loading"><span className="spinner" /> Reading document, please wait…</div>
      )}
      {ocrState?.status === 'success' && (
        <div className="ocr-banner success">✓ {ocrState.message}</div>
      )}
      {ocrState?.status === 'failed' && (
        <div className="ocr-banner error">
          <span>⚠ {ocrState.message}</span>
          <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => doc && runOcr(doc.file)}>
            Try again
          </button>
        </div>
      )}
      {ocrState?.status === 'skipped' && (
        <div className="ocr-banner error">ℹ {ocrState.message}</div>
      )}
    </div>
  );
}

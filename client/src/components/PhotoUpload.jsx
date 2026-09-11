import { useId, useRef, useState } from 'react';
import CropModal from './CropModal.jsx';

const MAX_MB = 5;

export default function PhotoUpload({ photo, onChange, error, label = '1. Photo', required = true }) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [rawSrc, setRawSrc] = useState(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState(null);

  const pickFile = (file) => {
    setLocalError(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setLocalError('Please choose a JPG or PNG image.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Image must be under ${MAX_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRawSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const onCropDone = (blob) => {
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    onChange({ file, previewUrl: URL.createObjectURL(blob) });
    setRawSrc(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = () => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required ? <span className="req">*</span> : <span className="opt">(optional)</span>}</label>
      {/* Visually hidden (not display:none) and opened via <label htmlFor>: some mobile / in-app
          browsers ignore a programmatic .click() on a hidden file input, but always honour a label. */}
      <input
        ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png" className="file-input-hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {photo ? (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={photo.previewUrl} alt="Selected member" className="photo-preview-lg" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor={inputId} className="btn btn-outline btn-sm" role="button">
              Replace photo
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`upload-zone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
        >
          <div className="ico">📷</div>
          <div className="t1">Click to upload your photo</div>
          <div className="t2">JPG or PNG, up to {MAX_MB} MB — you can crop it after selecting</div>
        </label>
      )}

      {(localError || error) && <div className="err">{localError || error}</div>}
      {rawSrc && (
        <CropModal imageSrc={rawSrc} onDone={onCropDone} onCancel={() => setRawSrc(null)} />
      )}
    </div>
  );
}

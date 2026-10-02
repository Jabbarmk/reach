import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';

// Draws the cropped region at `width` px wide (never upscaling past the source pixels).
// With `webp` set, re-encodes starting at high quality and steps down only until the file
// fits `targetBytes`, so the result is as small as possible without visible loss.
function getCroppedBlob(imageSrc, cropPixels, { aspect, width, webp, targetBytes }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const outW = Math.min(width, Math.round(cropPixels.width));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, outW, outH);
      const encode = (type, q) => new Promise((res) => canvas.toBlob(res, type, q));
      try {
        if (!webp) {
          const blob = await encode('image/jpeg', 0.92);
          return blob ? resolve(blob) : reject(new Error('Crop failed'));
        }
        let blob = null;
        for (const q of [0.9, 0.85, 0.8, 0.75]) {
          blob = await encode('image/webp', q);
          if (!blob || blob.type !== 'image/webp') return reject(new Error('This browser cannot create WebP images'));
          if (blob.size <= targetBytes) break;
        }
        resolve(blob);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = imageSrc;
  });
}

/**
 * Props beyond imageSrc/onDone/onCancel are optional; defaults give the original square JPEG photo crop.
 * Set `webp` for compressed WebP output (used by home page slider images).
 */
export default function CropModal({
  imageSrc, onDone, onCancel,
  aspect = 1, outputWidth = 600, webp = false, targetBytes = 350 * 1024,
  title = 'Adjust your photo', doneLabel = 'Use this photo',
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const onCropComplete = useCallback((_area, areaPixels) => setCropPixels(areaPixels), []);

  const apply = async () => {
    if (!cropPixels) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, cropPixels, { aspect, width: outputWidth, webp, targetBytes });
      onDone(blob);
    } catch (e) {
      if (webp) { setError(e.message); setWorking(false); } else onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={aspect < 1 ? undefined : { maxWidth: webp ? 640 : 480 }}>
        <div className="crop-head">
          <h3>{title}</h3>
          <p>Drag to reposition &middot; pinch or use the slider to zoom</p>
        </div>
        <div className="crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="crop-controls">
          <span className="zlabel">Zoom</span>
          <input
            type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
        {error && <div className="alert error" style={{ margin: '0 20px 12px' }}>{error}</div>}
        <div className="crop-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={working}>
            {working ? 'Processing…' : doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

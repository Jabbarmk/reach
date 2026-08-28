import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';

function getCroppedBlob(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 600; // output resolution
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, size, size
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))),
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = imageSrc;
  });
}

export default function CropModal({ imageSrc, onDone, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => setCropPixels(areaPixels), []);

  const apply = async () => {
    if (!cropPixels) return;
    setWorking(true);
    try {
      const blob = await getCroppedBlob(imageSrc, cropPixels);
      onDone(blob);
    } catch {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal">
        <div className="crop-head">
          <h3>Adjust your photo</h3>
          <p>Drag to reposition &middot; pinch or use the slider to zoom</p>
        </div>
        <div className="crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
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
        <div className="crop-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={working}>
            {working ? 'Cropping…' : 'Use this photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

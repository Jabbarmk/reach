import { useState } from 'react';
import { api } from '../api.js';

export default function NewsModal({ item, onClose, onDone }) {
  const [kind, setKind] = useState(item?.kind || 'news');
  const [tag, setTag] = useState(item?.tag || 'Announcement');
  const [title, setTitle] = useState(item?.title || '');
  const [body, setBody] = useState(item?.body || '');
  const [publishedOn, setPublishedOn] = useState(item?.published_on || new Date().toISOString().slice(0, 10));
  const [isPublished, setIsPublished] = useState(item ? !!item.is_published : true);
  const [cover, setCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]); // [{file, preview}]
  const [existingImages, setExistingImages] = useState(item?.images || []); // [{id}] not yet removed
  const [removedIds, setRemovedIds] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const pickCover = (f) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) { setError('Cover image must be a JPG or PNG.'); return; }
    if (f.size > 4 * 1024 * 1024) { setError('Cover image must be under 4 MB.'); return; }
    setError(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const pickGallery = (files) => {
    const list = Array.from(files || []);
    const bad = list.find((f) => !['image/jpeg', 'image/png'].includes(f.type) || f.size > 4 * 1024 * 1024);
    if (bad) { setError('Gallery images must be JPG or PNG, under 4 MB each.'); return; }
    setError(null);
    setGalleryFiles((prev) => [...prev, ...list.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removeNewGalleryFile = (i) => {
    setGalleryFiles((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const removeExistingImage = (id) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setRemovedIds((prev) => [...prev, id]);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!body.trim()) { setError('Body text is required.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('tag', tag.trim() || 'Announcement');
      fd.append('title', title.trim());
      fd.append('body', body.trim());
      fd.append('published_on', publishedOn);
      fd.append('is_published', String(isPublished));
      if (cover) fd.append('image', cover);
      galleryFiles.forEach((g) => fd.append('gallery', g.file));
      if (removedIds.length) fd.append('remove_images', JSON.stringify(removedIds));
      if (item) await api.updateNews(item.id, fd);
      else await api.createNews(fd);
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 560 }}>
        <div className="crop-head">
          <h3>{item ? 'Edit Item' : 'Add News / Event'}</h3>
          <p>Shown on the home page and the public News &amp; Events page.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}

          <div className="field">
            <label>Type</label>
            <div className="tab-row" style={{ marginBottom: 0 }}>
              <button type="button" className={`tab ${kind === 'news' ? 'active' : ''}`} onClick={() => setKind('news')}>📰 News</button>
              <button type="button" className={`tab ${kind === 'event' ? 'active' : ''}`} onClick={() => setKind('event')}>📅 Event</button>
            </div>
            {kind === 'event' && <div className="hint" style={{ marginTop: 6 }}>Events can have multiple gallery photos, viewable as a zoomable slideshow.</div>}
          </div>

          <div className="grid2">
            <div className="field">
              <label>Tag / category</label>
              <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Announcement" />
            </div>
            <div className="field">
              <label>Published date <span className="req">*</span></label>
              <input type="date" value={publishedOn} onChange={(e) => setPublishedOn(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Title <span className="req">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Body text <span className="req">*</span></label>
            <textarea rows={4} value={body} style={{ width: '100%', resize: 'vertical' }} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="field">
            <label>Cover image {item?.image_file ? <span className="opt">(uploaded — choose a file to replace)</span> : <span className="opt">(optional)</span>}</label>
            <input type="file" accept="image/jpeg,image/png" onChange={(e) => pickCover(e.target.files?.[0])} />
            <div className="hint">Used as the thumbnail everywhere this item is listed. JPG or PNG, up to 4 MB.</div>
            {(coverPreview || item?.image_file) && (
              <img
                src={coverPreview || api.newsImageUrl(item.id)}
                alt=""
                style={{ marginTop: 10, width: 160, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }}
              />
            )}
          </div>

          {kind === 'event' && (
            <div className="field">
              <label>Gallery images <span className="opt">(optional, multiple)</span></label>
              <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => { pickGallery(e.target.files); e.target.value = ''; }} />
              <div className="hint">Shown as a click-to-zoom slideshow on the public page. JPG or PNG, up to 4 MB each.</div>
              {(existingImages.length > 0 || galleryFiles.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                  {existingImages.map((img) => (
                    <div key={img.id} style={{ position: 'relative' }}>
                      <img
                        src={api.newsGalleryImageUrl(item.id, img.id)} alt=""
                        style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
                      />
                      <button type="button" className="icon-btn danger" onClick={() => removeExistingImage(img.id)}
                        style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, fontSize: 11, background: '#fff' }}>✕</button>
                    </div>
                  ))}
                  {galleryFiles.map((g, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={g.preview} alt="" style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                      <button type="button" className="icon-btn danger" onClick={() => removeNewGalleryFile(i)}
                        style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, fontSize: 11, background: '#fff' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="checkline">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            Published (visible on the public site)
          </label>
        </div>
        <div className="crop-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : item ? 'Save Changes' : '+ Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

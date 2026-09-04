import { useEffect, useState } from 'react';
import { api } from '../api.js';
import NewsModal from './NewsModal.jsx';

export default function NewsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | item object
  const [tab, setTab] = useState('all'); // all | news | event

  const load = async () => {
    try { setItems(await api.listAdminNews()); }
    catch (err) { setError(err.message); }
  };

  useEffect(() => { load(); }, []);

  const togglePublished = async (item) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append('kind', item.kind);
      fd.append('tag', item.tag);
      fd.append('title', item.title);
      fd.append('body', item.body);
      fd.append('published_on', item.published_on);
      fd.append('is_published', String(!item.is_published));
      await api.updateNews(item.id, fd);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setError(null);
    try { await api.deleteNews(item.id); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>News &amp; Events</h1>
          <p>Announcements shown on the home page and the public News &amp; Events page.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Add News Item</button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="tab-row">
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
        <button className={`tab ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>📰 News</button>
        <button className={`tab ${tab === 'event' ? 'active' : ''}`} onClick={() => setTab('event')}>📅 Events</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr>
                <th style={{ width: 76 }}>Image</th>
                <th>Title</th>
                <th style={{ width: 90 }}>Type</th>
                <th style={{ width: 140 }}>Tag</th>
                <th style={{ width: 120 }}>Date</th>
                <th style={{ width: 100 }}>Published</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {items?.filter((it) => tab === 'all' || it.kind === tab).map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.image_file
                      ? <img src={api.newsImageUrl(it.id)} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--line)' }} />
                      : <div style={{ width: 56, height: 40, borderRadius: 7, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{it.kind === 'event' ? '📅' : '📰'}</div>}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {it.title}
                    {it.kind === 'event' && it.images?.length > 0 && <span className="pill grey" style={{ marginLeft: 8 }}>{it.images.length} photos</span>}
                  </td>
                  <td><span className={`pill ${it.kind === 'event' ? 'orange' : 'blue'}`}>{it.kind === 'event' ? 'Event' : 'News'}</span></td>
                  <td><span className="pill blue">{it.tag}</span></td>
                  <td>{new Date(it.published_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <button type="button" className={`switch ${it.is_published ? 'on' : ''}`} onClick={() => togglePublished(it)} aria-label="Toggle published">
                      <span className="knob" />
                    </button>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setModal(it)}>✏️</button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(it)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items?.length === 0 && <div className="empty-note">No news items yet — click "+ Add News Item" to create one.</div>}
        {!items && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>

      {modal && (
        <NewsModal
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

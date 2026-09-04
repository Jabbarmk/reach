import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';

function Lightbox({ images, index, onClose, onNav }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNav(1);
      if (e.key === 'ArrowLeft') onNav(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNav]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      {images.length > 1 && (
        <button className="lightbox-arrow prev" onClick={(e) => { e.stopPropagation(); onNav(-1); }} aria-label="Previous">‹</button>
      )}
      <img src={images[index]} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button className="lightbox-arrow next" onClick={(e) => { e.stopPropagation(); onNav(1); }} aria-label="Next">›</button>
      )}
      {images.length > 1 && <div className="lightbox-count">{index + 1} / {images.length}</div>}
    </div>
  );
}

export default function NewsListPage() {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState('news');
  const [lightbox, setLightbox] = useState(null); // { images: [], index } | null

  useEffect(() => {
    (async () => {
      try { setItems(await api.news()); }
      catch { setItems([]); }
    })();
  }, []);

  const news = (items || []).filter((n) => n.kind !== 'event');
  const events = (items || []).filter((n) => n.kind === 'event');
  const visible = tab === 'news' ? news : events;

  const imagesFor = (n) => {
    const urls = [];
    if (n.image_file) urls.push(api.newsImageUrl(n.id));
    for (const img of n.images || []) urls.push(api.newsGalleryImageUrl(n.id, img.id));
    return urls;
  };

  const openLightbox = (n, startIndex = 0) => {
    const urls = imagesFor(n);
    if (urls.length) setLightbox({ images: urls, index: startIndex });
  };
  const navLightbox = (dir) => {
    setLightbox((lb) => (lb ? { ...lb, index: (lb.index + dir + lb.images.length) % lb.images.length } : lb));
  };

  return (
    <div className="newsx-page">
      <header className="hp-header static">
        <span className="hp-logo-chip">
          <Link to="/"><img src="/api/logo" alt="REACH Pravasi Welfare Society" /></Link>
        </span>
        <div className="hp-nav-group">
          <nav className="hp-nav">
            <Link className="hp-nav-link" to="/">Home</Link>
            <Link className="hp-nav-link active" to="/news">News &amp; Events</Link>
          </nav>
        </div>
      </header>

      <main className="newsx-main">
        <div className="newsx-hero">
          <span className="hp-kicker">Stay Informed</span>
          <h1>News &amp; Events</h1>
          <p>Announcements, membership campaigns and event photos from REACH Pravasi Welfare Society.</p>
        </div>

        <div className="tab-row" style={{ justifyContent: 'center', marginBottom: 30 }}>
          <button className={`tab ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>📰 News ({news.length})</button>
          <button className={`tab ${tab === 'event' ? 'active' : ''}`} onClick={() => setTab('event')}>📅 Events ({events.length})</button>
        </div>

        {!items ? (
          <div className="empty-note"><span className="spinner lg" /></div>
        ) : visible.length === 0 ? (
          <div className="empty-note">{tab === 'news' ? 'No news items published yet.' : 'No events published yet.'}</div>
        ) : tab === 'news' ? (
          <div className="newsx-list">
            {news.map((n) => (
              <article className="newsx-card" key={n.id}>
                {n.image_file && <img src={api.newsImageUrl(n.id)} alt="" loading="lazy" />}
                <div className="newsx-card-body">
                  <span className="hp-news-tag">{n.tag}</span>
                  <h2>{n.title}</h2>
                  <p>{n.body}</p>
                  <span className="hp-news-date">
                    {new Date(n.published_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="newsx-list">
            {events.map((n) => {
              const urls = imagesFor(n);
              return (
                <article className="newsx-card" key={n.id}>
                  {urls.length > 0 && (
                    <div className="newsx-gallery-thumb" onClick={() => openLightbox(n, 0)}>
                      <img src={urls[0]} alt="" loading="lazy" />
                      {urls.length > 1 && <span className="newsx-gallery-count">🔍 {urls.length} photos</span>}
                    </div>
                  )}
                  <div className="newsx-card-body">
                    <span className="hp-news-tag">{n.tag}</span>
                    <h2>{n.title}</h2>
                    <p>{n.body}</p>
                    <span className="hp-news-date">
                      {new Date(n.published_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    {urls.length > 1 && (
                      <div className="newsx-thumb-strip">
                        {urls.slice(0, 6).map((u, i) => (
                          <img key={i} src={u} alt="" onClick={() => openLightbox(n, i)} />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="newsx-footer">
        <Link to="/">← Back to Home</Link>
        <span>© {new Date().getFullYear()} REACH Pravasi Welfare Society</span>
      </footer>

      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} onNav={navLightbox} />
      )}
    </div>
  );
}

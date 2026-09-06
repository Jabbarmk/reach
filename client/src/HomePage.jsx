import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { planValidityText } from './formConfig.js';
import { formatDate } from './dateUtils.js';

const SECTIONS = ['home', 'about', 'membership', 'activities', 'contact'];

// `builtin: true` slides already ship with their own dark panel + watermark baked in,
// so the page-level overlay gradient and SVG watermark are suppressed while they're active.
const HERO_SLIDES = [
  { src: '/bgwayanad/bg1.png', builtin: true },
  { src: '/bgwayanad/bg2.png' },
  { src: '/bgwayanad/bg3.jpg' },
  { src: '/bgwayanad/bg4.jpg' },
];

// Portrait crops of the same theme, swapped in on small screens so the hero doesn't
// show an awkwardly zoomed sliver of a landscape image.
const HERO_SLIDES_MOBILE = [
  { src: '/bgwayanad/mobileslider1.png' },
  { src: '/bgwayanad/mobileslider2.png' },
  { src: '/bgwayanad/mobileslider3.png' },
];

// Matched by index to c.about.cards: Pravasi Protection & Welfare, Economic Empowerment, Social Unity.
const ABOUT_IMAGES = ['/bgwayanad/abt1.jpg', '/bgwayanad/abt2.jpg', '/bgwayanad/abt3.jpg'];

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ShieldCheckIcon = () => (
  <svg {...iconProps} width="21" height="21">
    <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const LifebuoyIcon = () => (
  <svg {...iconProps} width="21" height="21">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M5.5 5.5l3 3M18.5 5.5l-3 3M5.5 18.5l3-3M18.5 18.5l-3-3" />
  </svg>
);
const CommunityIcon = () => (
  <svg {...iconProps} width="21" height="21">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.3" />
    <path d="M15.5 12c2.2.4 3.5 1.8 3.5 4" />
  </svg>
);

const HIGHLIGHTS = [
  { icon: <ShieldCheckIcon />, text: '100% Transparent Governance' },
  { icon: <LifebuoyIcon />, text: 'Pravasi Welfare & Relief Fund' },
  { icon: <CommunityIcon />, text: 'Strong Ex-Pravasi Community' },
];

const BENEFITS = [
  { icon: '🆘', title: 'Emergency Relief Fund', text: 'ജോലി നഷ്ടപ്പെടുകയോ, ഗുരുതരമായ പ്രതിസന്ധികൾ നേരിടുകയോ ചെയ്യുമ്പോൾ മുൻഗണനാ അടിസ്ഥാനത്തിലുള്ള പിന്തുണ.' },
  { icon: '🌱', title: 'Rehabilitation Assistance', text: 'നാട്ടിൽ തിരിച്ചെത്തുന്നവർക്ക് സ്വയംതൊഴിൽ/സംരംഭകത്വ വഴികാട്ടലുകൾ.' },
  { icon: '🗳️', title: 'Democratic Rights', text: 'പഞ്ചായത്ത്/മുൻസിപ്പൽ സമിതികൾ മുതൽ സെൻട്രൽ കമ്മിറ്റി വരെ ജനാധിപത്യപരമായ പ്രാതിനിധ്യവും വോട്ടവകാശവും.' },
];


const FOOTER_LINKS = [
  { label: 'Home', id: 'home' },
  { label: 'About By-Law', disabled: true },
  { label: 'Executive Committee', disabled: true },
  { label: 'Focus Areas', id: 'activities' },
  { label: 'Membership', id: 'membership' },
  { label: 'Gallery', disabled: true },
  { label: 'Contact Us', id: 'contact' },
];

export default function HomePage() {
  const [active, setActive] = useState('home');
  const [scrolled, setScrolled] = useState(false);
  const [plans, setPlans] = useState([]);
  const [c, setC] = useState(null); // home content from settings table
  const [countries, setCountries] = useState([]);
  const [news, setNews] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(110);
  const heroSlides = isMobile ? HERO_SLIDES_MOBILE : HERO_SLIDES;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    (async () => {
      // Home content is the only thing the page truly can't render without — fetch it on its
      // own so a failure in an unrelated endpoint (countries, news, plans) can't blank the
      // whole homepage the way Promise.all's all-or-nothing rejection used to.
      try { setC(await api.homeContent()); } catch { setC(null); return; }
      const [cfg, memberCountries, newsItems] = await Promise.allSettled([
        api.formConfig(), api.memberCountries(), api.news(5),
      ]);
      if (cfg.status === 'fulfilled') setPlans(cfg.value.plans || []);
      if (memberCountries.status === 'fulfilled') setCountries((memberCountries.value.countries || []).filter((co) => co.visible));
      if (newsItems.status === 'fulfilled') setNews(newsItems.value || []);
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, []);

  // Auto-scrolling country marquee: a rAF loop nudges scrollLeft forward and wraps
  // seamlessly (the card list is duplicated), while still allowing native touch/drag
  // scrolling and the arrow buttons — any interaction pauses it, then it resumes.
  const marqueeRef = useRef(null);
  const marqueePausedRef = useRef(false);
  const marqueeResumeTimer = useRef(null);

  useEffect(() => {
    let raf;
    const step = () => {
      const el = marqueeRef.current;
      if (el && !marqueePausedRef.current) {
        el.scrollLeft += 0.6;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pauseMarquee = () => {
    marqueePausedRef.current = true;
    clearTimeout(marqueeResumeTimer.current);
  };
  const resumeMarqueeSoon = (delay = 2200) => {
    clearTimeout(marqueeResumeTimer.current);
    marqueeResumeTimer.current = setTimeout(() => { marqueePausedRef.current = false; }, delay);
  };
  const nudgeMarquee = (dir) => {
    const el = marqueeRef.current;
    if (!el) return;
    pauseMarquee();
    const card = el.querySelector('.hp-country-card');
    const step = card ? card.getBoundingClientRect().width + 22 : 220;
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
    resumeMarqueeSoon(3000);
  };

  useEffect(() => {
    const onScroll = () => {
      let current = 'home';
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id;
      }
      setActive(current);
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // Lets other pages (e.g. the News & Events nav) deep-link to a section via /#about etc.
  useEffect(() => {
    if (!c) return;
    const hash = window.location.hash?.slice(1);
    if (hash && SECTIONS.includes(hash)) {
      requestAnimationFrame(() => setTimeout(() => goTo(hash), 50));
    }
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the hero's top spacing in sync with the header's actual rendered height,
  // since the logo size (and therefore header height) is admin-editable.
  useEffect(() => {
    if (!headerRef.current) return;
    const measure = () => setHeaderH(headerRef.current.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, [c]);

  if (!c) {
    return <div className="hp" style={{ minHeight: '100vh' }} />;
  }

  const NavLinks = () => (
    <>
      {[['home', 'Home'], ['about', 'About'], ['activities', 'Focus Areas'], ['membership', 'Membership'], ['contact', 'Contact']].map(([id, label]) => (
        <button key={id} className={`hp-nav-link ${active === id ? 'active' : ''}`} onClick={() => goTo(id)}>{label}</button>
      ))}
      <Link className="hp-nav-link" to="/news" onClick={() => setMenuOpen(false)}>News & Events</Link>
    </>
  );

  const NavActions = () => (
    <div className="hp-nav-actions">
      <button className="hp-nav-btn member" disabled title="Member login is coming soon">Member Login</button>
      <Link className="hp-nav-btn admin" to="/admin">Admin Login</Link>
    </div>
  );

  const rootStyle = {
    '--hp-logo-size': `${c.header.logo_size}px`,
    '--hp-header-h': `${headerH}px`,
  };

  const countryLoop = countries.length ? [...countries, ...countries] : [];

  return (
    <div className="hp" style={rootStyle}>
      <header
        className={`hp-header ${scrolled ? 'scrolled' : ''}`}
        ref={headerRef}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
        }}
      >
        <span className="hp-header-spotlight" aria-hidden="true" />
        <span className="hp-logo-chip">
          <img src="/api/logo" alt={c.footer.name} onLoad={() => headerRef.current && setHeaderH(headerRef.current.offsetHeight)} />
        </span>
        <div className="hp-nav-group">
          <nav className="hp-nav">{NavLinks()}</nav>
        </div>
        <button className="hp-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
      </header>
      {menuOpen && (
        <div className="hp-mobile-menu">
          {NavLinks()}
          <NavActions />
        </div>
      )}
      <div className={`hp-corner-actions ${scrolled ? 'scrolled' : ''}`}>
        <NavActions />
      </div>

      <div className="hp-dots">
        {SECTIONS.map((id) => (
          <button
            key={id} aria-label={id}
            className={`hp-dot ${active === id ? 'on' : ''}`}
            onClick={() => goTo(id)}
          />
        ))}
      </div>

      {/* ===== Hero (slider) ===== */}
      <section className="hp-hero" id="home">
        <div className="hp-hero-slides">
          {heroSlides.map((slide, i) => (
            <div
              key={slide.src}
              className={`hp-hero-slide ${i === slideIdx % heroSlides.length ? 'active' : ''}`}
              style={{ backgroundImage: `url(${slide.src})` }}
            />
          ))}
        </div>
        {!heroSlides[slideIdx % heroSlides.length].builtin && (
          <>
            <div className="hp-hero-overlay" />
            <svg className="hp-hero-watermark" viewBox="0 0 200 180" aria-hidden="true">
              <path d="M60 130 C30 108 12 86 12 62 C12 42 27 28 45 28 C55 28 63 33 70 42 C77 33 85 28 95 28 C113 28 128 42 128 62 C128 86 110 108 80 130 L70 137Z" />
              <circle cx="150" cy="55" r="13" />
              <path d="M126 108 C126 88 137 76 150 76 C163 76 174 88 174 108" />
              <circle cx="112" cy="70" r="10" />
              <path d="M92 112 C92 96 101 86 112 86 C123 86 132 96 132 112" />
            </svg>
          </>
        )}
        <div className="hp-hero-glass">
          <h1>{c.hero.title1} <span className="pipe">|</span> {c.hero.title2}</h1>
          <p className="hp-subhead">{c.hero.tagline}</p>
          {c.hero.description && <p className="hp-desc" style={{ whiteSpace: 'pre-line' }}>{c.hero.description}</p>}
          <div className="hp-cta-row">
            <Link className="hp-cta" to="/register">{c.hero.cta_primary} <span className="arr">→</span></Link>
            <button className="hp-cta outline" onClick={() => goTo('activities')}>
              {c.hero.cta_secondary} <span className="arr">→</span>
            </button>
          </div>
          <div className="hp-highlights">
            {HIGHLIGHTS.map((h, i) => (
              <div className="hp-highlight-item" key={i}>
                <span className="hp-highlight-ico">{h.icon}</span>
                <span className="hp-highlight-text">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hp-hero-dots">
          {heroSlides.map((_, i) => (
            <button key={i} className={i === slideIdx % heroSlides.length ? 'on' : ''} aria-label={`Slide ${i + 1}`} onClick={() => setSlideIdx(i)} />
          ))}
        </div>
        <button className="hp-scroll-hint" onClick={() => goTo('about')} aria-label="Scroll down">
          <span className="mouse"><span className="wheel" /></span>
          <span className="chev">⌄</span>
        </button>
      </section>

      {/* ===== Member Countries marquee ===== */}
      {countries.length > 0 && (
      <section className="hp-countries">
        <div className="hp-countries-inner">
          <h2 className="center">Our Global Family</h2>
        </div>
        <div className="hp-marquee-outer">
          <button className="hp-marquee-arrow prev" aria-label="Scroll left" onClick={() => nudgeMarquee(-1)}>‹</button>
          <div
            className="hp-marquee-wrap"
            ref={marqueeRef}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') pauseMarquee(); }}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'mouse') return;
              clearTimeout(marqueeResumeTimer.current);
              marqueePausedRef.current = false;
            }}
            onPointerDown={pauseMarquee}
            onPointerUp={(e) => { if (e.pointerType !== 'mouse') resumeMarqueeSoon(); }}
          >
            <div className="hp-marquee-track">
              {countryLoop.map((co, i) => (
                <div className="hp-country-card" key={i}>
                  <img src={`https://flagcdn.com/w160/${co.code}.png`} alt={co.name} loading="lazy" />
                  <div className="cc-name">{co.name}</div>
                  {co.show_count && <div className="cc-count">{co.members.toLocaleString('en-IN')}+<span>Members</span></div>}
                </div>
              ))}
            </div>
          </div>
          <button className="hp-marquee-arrow next" aria-label="Scroll right" onClick={() => nudgeMarquee(1)}>›</button>
        </div>
      </section>
      )}

      {/* ===== About ===== */}
      <section className="hp-section" id="about">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.about.kicker}</span>
          <h2>{c.about.title}</h2>
          <p className="hp-lead" style={{ whiteSpace: 'pre-line' }}>{c.about.lead}</p>
          <div className="hp-cards3">
            {c.about.cards.map((card, i) => (
              <div className="hp-about-card" key={i}>
                <div className="hp-about-card-img">
                  <img src={ABOUT_IMAGES[i]} alt={card.title} loading="lazy" />
                </div>
                <div className="hp-about-card-body">
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Focus Areas ===== */}
      <section className="hp-section alt" id="activities">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.activities.kicker}</span>
          <h2>{c.activities.title}</h2>
          {c.activities.lead && <p className="hp-lead">{c.activities.lead}</p>}
          <div className="hp-cards3 cols4">
            {c.activities.cards.map((card, i) => (
              <div className="hp-card" key={i}>
                <div className="ico">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Membership plans ===== */}
      <section className="hp-section hp-membership" id="membership">
        <span className="hp-membership-blob a" aria-hidden="true" />
        <span className="hp-membership-blob b" aria-hidden="true" />
        <span className="hp-membership-dots" aria-hidden="true" />
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.membership.kicker}</span>
          <h2 className="hp-membership-title">{c.membership.title}</h2>
          <p className="hp-lead">{c.membership.lead}</p>
          <div className="hp-plans">
            {plans.map((p) => {
              const featured = p.code === 'lifetime';
              return (
                <div className={`hp-plan ${featured ? 'featured' : ''}`} key={p.code}>
                  {featured && <span className="hp-plan-badge">👑 Best Value</span>}
                  <div className="hp-plan-header">
                    <span className="hp-plan-icon">{featured ? '♾️' : '📅'}</span>
                  </div>
                  <div className="hp-plan-body">
                    <h3>{p.name}</h3>
                    <span className="hp-plan-divider" />
                    <div className="fee">₹{Number(p.fee).toLocaleString('en-IN')}</div>
                    <p>{planValidityText(p)}</p>
                    <Link className={`hp-cta sm ${featured ? 'dark' : ''}`} to="/register">Register Now <span className="arr">→</span></Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Why join REACH (membership benefits) ===== */}
      <section className="hp-section alt">
        <div className="hp-section-inner">
          <span className="hp-kicker">Membership Benefits</span>
          <h2>Why Join REACH?</h2>
          <div className="hp-cards3">
            {BENEFITS.map((b, i) => (
              <div className="hp-benefit-card" key={i}>
                <div className="ico">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
          <Link className="hp-cta" to="/register" style={{ marginTop: 34 }}>
            Apply for Membership <span className="arr">→</span>
          </Link>
        </div>
      </section>

      {/* ===== Leadership message ===== */}
      <section className="hp-quote-section">
        <div className="hp-quote-card">
          <span className="hp-kicker light">From the Leadership</span>
          <div className="hp-quote-divider"><span className="dot" /><span className="dot" /><span className="dot" /></div>
          <span className="hp-quote-mark" aria-hidden="true">"</span>
          <p className="hp-quote-text">
            "പ്രവാസികളുടെ കൂട്ടായ ശക്തിയെ നാടിന്റെ നന്മയ്ക്കായും, അവരുടെ കുടുംബങ്ങളുടെ സുരക്ഷിതത്വത്തിനായും
            മാറ്റിയെടുക്കുക എന്നതാണ് REACH-ന്റെ ലക്ഷ്യം. ഒരു പ്രവാസിയും ഒറ്റപ്പെടരുത് എന്ന ഉറച്ച ബോധ്യത്തോടെയാണ്
            നമ്മൾ മുന്നോട്ട് പോകുന്നത്."
          </p>
          <span className="hp-quote-rule" />
          <div className="hp-quote-attr">— Central Executive Committee, REACH Pravasi Welfare Society</div>
        </div>
      </section>

      {/* ===== News & Announcements ===== */}
      {news.length > 0 && (
      <section className="hp-section" id="news">
        <div className="hp-section-inner">
          <span className="hp-kicker">Latest Updates</span>
          <h2>News & Announcements</h2>
          <div className="hp-news-list">
            {news.map((n) => (
              <div className="hp-news-item" key={n.id}>
                {n.image_file && <img className="hp-news-img" src={api.newsImageUrl(n.id)} alt="" loading="lazy" />}
                <span className="hp-news-tag">{n.tag}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <span className="hp-news-date">{formatDate(n.published_on, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            ))}
          </div>
          <Link className="hp-cta" to="/news" style={{ marginTop: 28 }}>
            View All News &amp; Events <span className="arr">→</span>
          </Link>
        </div>
      </section>
      )}

      {/* ===== Contact ===== */}
      <section className="hp-section alt" id="contact">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.contact.kicker}</span>
          <h2>{c.contact.title}</h2>
          <div className="hp-contact">
            <div className="hp-card">
              <div className="ico">📍</div><h3>{c.contact.office_title}</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{c.contact.office}</p>
              {c.contact.phone && <p style={{ marginTop: 8 }}>📞 <a href={`tel:${c.contact.phone.replace(/\s/g, '')}`}>{c.contact.phone}</a></p>}
            </div>
            <div className="hp-card">
              <div className="ico">✉️</div><h3>Write to us</h3>
              <p><a href={`mailto:${c.contact.email}`}>{c.contact.email}</a><br />{c.contact.email_note}</p>
            </div>
            <div className="hp-card">
              <div className="ico">📝</div><h3>{c.contact.join_title}</h3>
              <p>{c.contact.join_text}</p>
              <Link className="hp-cta sm" to="/register">Start Registration <span className="arr">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="hp-footer2">
        <div className="hp-footer2-grid">
          <div>
            <span className="hp-logo-chip footer">
              <img src="/api/logo" alt={c.footer.name} />
            </span>
            <p className="hp-footer2-about">{c.footer.name} — standing with Sulthan Bathery's expatriates and returnees, together.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <div className="hp-footer2-links">
              {FOOTER_LINKS.map((l, i) => (
                l.disabled
                  ? <span className="disabled" key={i} title="Coming soon">{l.label}</span>
                  : <button key={i} onClick={() => goTo(l.id)}>{l.label}</button>
              ))}
            </div>
          </div>
          <div>
            <h4>Contact Info</h4>
            <p className="contact-line">📍 {c.contact.office}</p>
            <p className="contact-line">✉️ <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a></p>
            {c.contact.phone && <p className="contact-line">📞 <a href={`tel:${c.contact.phone.replace(/\s/g, '')}`}>{c.contact.phone}</a></p>}
          </div>
        </div>
        <div className="hp-footer2-bottom">
          <span>Reg No: — · © {new Date().getFullYear()} {c.footer.name}. All Rights Reserved.</span>
          <span className="links">
            <Link to="/register">Membership Registration</Link> · <Link to="/admin">Admin Login</Link> ·{' '}
            Powered by <a href="https://www.smartflix.ae" target="_blank" rel="noopener noreferrer">Smartflix.ae</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

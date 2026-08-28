import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { planValidityText } from './formConfig.js';

const SECTIONS = ['home', 'about', 'membership', 'activities', 'contact'];

export default function HomePage() {
  const [active, setActive] = useState('home');
  const [scrolled, setScrolled] = useState(false);
  const [plans, setPlans] = useState([]);
  const [c, setC] = useState(null); // home content from settings table
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(110);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, content] = await Promise.all([api.formConfig(), api.homeContent()]);
        setPlans(cfg.plans || []);
        setC(content);
      } catch {
        setC(null);
      }
    })();
  }, []);

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
      {[['home', 'Home'], ['about', 'About'], ['membership', 'Membership'], ['activities', 'Activities'], ['contact', 'Contact']].map(([id, label]) => (
        <button key={id} className={`hp-nav-link ${active === id ? 'active' : ''}`} onClick={() => goTo(id)}>{label}</button>
      ))}
      <Link className="hp-nav-link admin" to="/admin">Admin</Link>
    </>
  );

  const rootStyle = {
    '--hp-logo-size': `${c.header.logo_size}px`,
    '--hp-header-h': `${headerH}px`,
  };

  return (
    <div className="hp" style={rootStyle}>
      <header className={`hp-header ${scrolled ? 'scrolled' : ''}`} ref={headerRef}>
        <span className="hp-logo-chip">
          <img src="/api/logo" alt={c.footer.name} onLoad={() => headerRef.current && setHeaderH(headerRef.current.offsetHeight)} />
        </span>
        <nav className="hp-nav">{NavLinks()}</nav>
        <button className="hp-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
      </header>
      {menuOpen && <div className="hp-mobile-menu">{NavLinks()}</div>}

      <div className="hp-dots">
        {SECTIONS.map((id) => (
          <button
            key={id} aria-label={id}
            className={`hp-dot ${active === id ? 'on' : ''}`}
            onClick={() => goTo(id)}
          />
        ))}
      </div>

      {/* ===== Hero ===== */}
      <section className="hp-hero" id="home">
        <div className="hp-hero-glass">
          <h1>{c.hero.title1}<br />{c.hero.title2}</h1>
          <div className="hp-divider"><span className="line" /><span className="dot" /><span className="line long" /></div>
          <p className="hp-tag" style={{ whiteSpace: 'pre-line' }}>{c.hero.tagline}</p>
          <div className="hp-cta-row">
            <Link className="hp-cta" to="/register">{c.hero.cta_primary} <span className="arr">→</span></Link>
            <button className="hp-link-cta" onClick={() => goTo('about')}>
              {c.hero.cta_secondary} <span className="arr green">→</span>
            </button>
          </div>
        </div>
        <button className="hp-scroll-hint" onClick={() => goTo('about')} aria-label="Scroll down">
          <span className="mouse"><span className="wheel" /></span>
          <span className="chev">⌄</span>
        </button>
      </section>

      {/* ===== About ===== */}
      <section className="hp-section" id="about">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.about.kicker}</span>
          <h2>{c.about.title}</h2>
          <p className="hp-lead">{c.about.lead}</p>
          <div className="hp-cards3">
            {c.about.cards.map((card, i) => (
              <div className="hp-card" key={i}>
                <div className="ico">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Membership ===== */}
      <section className="hp-section alt" id="membership">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.membership.kicker}</span>
          <h2>{c.membership.title}</h2>
          <p className="hp-lead">{c.membership.lead}</p>
          <div className="hp-plans">
            {plans.map((p) => (
              <div className="hp-plan" key={p.code}>
                <h3>{p.name}</h3>
                <div className="fee">₹{Number(p.fee).toLocaleString('en-IN')}</div>
                <p>{planValidityText(p)}</p>
                <Link className="hp-cta sm" to="/register">Register Now <span className="arr">→</span></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Activities ===== */}
      <section className="hp-section" id="activities">
        <div className="hp-section-inner">
          <span className="hp-kicker">{c.activities.kicker}</span>
          <h2>{c.activities.title}</h2>
          <div className="hp-cards3">
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

      <footer className="hp-footer">
        <span>© {new Date().getFullYear()} {c.footer.name}</span>
        <span className="links">
          <Link to="/register">Membership Registration</Link> · <Link to="/admin">Admin Login</Link>
        </span>
      </footer>
    </div>
  );
}

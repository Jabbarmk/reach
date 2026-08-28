export const HOME_DEFAULTS = {
  header: {
    logo_size: 250,
  },
  hero: {
    title1: 'Together,',
    title2: 'We Reach Further',
    tagline: 'Returning and Expatriate Action for\nCommunity and Humanity',
    cta_primary: 'Become a Member',
    cta_secondary: 'Discover Our Mission',
  },
  about: {
    kicker: 'Our Mission',
    title: 'About REACH',
    lead: 'REACH — Returning and Expatriate Action for Community and Humanity — is the Pravasi Welfare Society of Wayanad, standing with expatriates working abroad and with those who have returned home.',
    cards: [
      { icon: '🤝', title: 'Welfare & Support', text: 'Practical help for pravasi families across every panchayath and municipality of Wayanad district.' },
      { icon: '✈️', title: 'For Expats Abroad', text: 'A lifeline of connection, emergency contact support and community for members working overseas.' },
      { icon: '🏡', title: 'For Returnees', text: 'Guidance and a strong community network for members who have returned and resettled in Kerala.' },
    ],
  },
  membership: {
    kicker: 'Join Us',
    title: 'Membership',
    lead: 'Choose the plan that suits you and complete the registration online in minutes.',
  },
  activities: {
    kicker: 'What We Do',
    title: 'Activities',
    cards: [
      { icon: '🩺', title: 'Health & Welfare Camps', text: 'Medical camps, blood-group directories and welfare drives for member families.' },
      { icon: '🎓', title: 'Guidance Programmes', text: 'Orientation for new expatriates and re-integration support for returnees.' },
      { icon: '🎉', title: 'Community Events', text: 'Annual gatherings, cultural programmes and family meets across Wayanad.' },
    ],
  },
  contact: {
    kicker: 'Get In Touch',
    title: 'Contact',
    office_title: 'Office',
    office: 'REACH Pravasi Welfare Society\nWayanad District, Kerala, India',
    phone: '',
    email: 'info@reach.org',
    email_note: 'We reply within 2 working days',
    join_title: 'New Membership',
    join_text: 'Ready to join the community?',
  },
  footer: {
    name: 'REACH Pravasi Welfare Society',
  },
};

// Stored content is merged over the defaults so newly added fields never break old saves.
export function mergeHomeContent(stored) {
  const out = JSON.parse(JSON.stringify(HOME_DEFAULTS));
  if (!stored || typeof stored !== 'object') return out;
  for (const section of Object.keys(out)) {
    const s = stored[section];
    if (!s || typeof s !== 'object') continue;
    for (const key of Object.keys(out[section])) {
      if (s[key] === undefined) continue;
      if (key === 'cards' && Array.isArray(s.cards)) {
        out[section].cards = out[section].cards.map((card, i) => ({ ...card, ...(s.cards[i] || {}) }));
      } else if (key === 'logo_size') {
        const n = Number(s[key]);
        if (Number.isFinite(n)) out[section][key] = Math.min(400, Math.max(40, Math.round(n)));
      } else if (typeof s[key] === 'string') {
        out[section][key] = String(s[key]).slice(0, 2000);
      }
    }
  }
  return out;
}

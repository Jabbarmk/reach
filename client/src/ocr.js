import Tesseract from 'tesseract.js';

// Client-side OCR. Only images are processed; PDFs are stored for admin review instead.
export const canOcr = (file) => file && /^image\//.test(file.type);

async function recognize(file) {
  const { data } = await Tesseract.recognize(file, 'eng');
  return data.text || '';
}

const NOISE = /government|india|aadhaar|aadhar|unique|identification|authority|uidai|male|female|dob|birth|year|address|father|husband|vid|issue|download|help|www|@/i;

export async function extractAadhaar(file) {
  const text = await recognize(file);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Aadhaar number: 12 digits, usually grouped 4-4-4. Ignore 16-digit VID.
  let number = null;
  const grouped = text.match(/(?<!\d)(\d{4})[\s-]+(\d{4})[\s-]+(\d{4})(?![\s-]*\d)/);
  if (grouped) number = grouped.slice(1, 4).join('');
  if (!number) {
    const plain = text.replace(/[\s-]/g, '').match(/(?<!\d)(\d{12})(?!\d)/);
    if (plain) number = plain[1];
  }

  // Name: the alphabetic line just above the DOB / Year-of-Birth line, else the
  // first clean alphabetic line that isn't boilerplate.
  let name = null;
  const dobIdx = lines.findIndex((l) => /dob|birth|جنم|\d{2}[/-]\d{2}[/-]\d{4}/i.test(l));
  const isNameLike = (l) =>
    /^[A-Za-z][A-Za-z .]{2,40}$/.test(l) && !NOISE.test(l) && l.split(/\s+/).length <= 5;
  if (dobIdx > 0) {
    for (let i = dobIdx - 1; i >= Math.max(0, dobIdx - 3); i--) {
      if (isNameLike(lines[i])) { name = lines[i]; break; }
    }
  }
  if (!name) name = lines.find(isNameLike) || null;

  return { name, number, success: Boolean(number || name) };
}

export async function extractIdNumber(file) {
  const text = await recognize(file);
  const tokens = text.split(/[\s,;:]+/).filter(Boolean);
  const candidates = tokens.filter((t) => {
    const clean = t.replace(/[^A-Za-z0-9]/g, '');
    if (clean.length < 6 || clean.length > 18) return false;
    if (!/\d{3,}/.test(clean)) return false;               // must contain a digit run
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(t)) return false; // not a date
    return true;
  });
  // Prefer the longest digit-heavy candidate.
  candidates.sort((a, b) => {
    const da = (a.match(/\d/g) || []).length;
    const db = (b.match(/\d/g) || []).length;
    return db - da || b.length - a.length;
  });
  const number = candidates[0] ? candidates[0].replace(/[^A-Za-z0-9-]/g, '') : null;
  return { number, success: Boolean(number) };
}

// Deterministic expense-request parser. Works without any LLM so the panel and
// the event trigger are instant and free; the Rovo agent adds natural language on top.

export const CATEGORIES = ['meals', 'travel', 'software', 'events', 'equipment', 'gifts', 'training', 'other'];

const CATEGORY_WORDS = {
  meals: ['lunch', 'dinner', 'breakfast', 'pizza', 'food', 'coffee', 'snacks', 'chai', 'meal', 'catering', 'biryani', 'drinks', 'restaurant'],
  travel: ['cab', 'uber', 'ola', 'taxi', 'flight', 'train', 'hotel', 'airbnb', 'travel', 'mileage', 'fuel', 'parking'],
  software: ['subscription', 'license', 'licence', 'saas', 'seat', 'figma', 'notion', 'miro', 'github', 'aws', 'openai', 'software', 'domain', 'hosting'],
  events: ['offsite', 'venue', 'team event', 'party', 'celebration', 'hackathon', 'meetup', 'workshop venue', 'team outing', 'bowling'],
  equipment: ['laptop', 'monitor', 'keyboard', 'mouse', 'headset', 'chair', 'desk', 'webcam', 'hardware', 'equipment'],
  gifts: ['gift', 'swag', 'voucher', 'gift card', 'flowers', 'farewell'],
  training: ['course', 'training', 'conference', 'ticket', 'certification', 'book', 'udemy'],
};

const SYMBOLS = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', 'A$': 'AUD', '¥': 'JPY' };
const CODES = { INR: 'INR', RS: 'INR', 'RS.': 'INR', RUPEES: 'INR', USD: 'USD', DOLLARS: 'USD', EUR: 'EUR', EUROS: 'EUR', GBP: 'GBP', AUD: 'AUD', JPY: 'JPY' };

function num(s) {
  let t = String(s).replace(/,/g, '').trim();
  let mult = 1;
  if (/k$/i.test(t)) { mult = 1000; t = t.slice(0, -1); }
  const n = Number(t);
  return Number.isFinite(n) ? n * mult : NaN;
}

/** Find the first money amount in text. Returns { amount, currency } or null. */
export function parseAmount(text, defaultCurrency = 'USD') {
  const s = String(text || '');
  // symbol before number: ₹4,500 / $120.50 / A$90
  let m = s.match(/(A\$|₹|\$|€|£|¥)\s?(\d[\d,]*(?:\.\d+)?k?)/i);
  if (m) return { amount: num(m[2]), currency: SYMBOLS[m[1].toUpperCase()] || SYMBOLS[m[1]] };
  // code before number: INR 4500 / Rs. 4,500 / USD 99
  m = s.match(/\b(INR|RS\.?|USD|EUR|GBP|AUD|JPY)\s?(\d[\d,]*(?:\.\d+)?k?)/i);
  if (m) return { amount: num(m[2]), currency: CODES[m[1].toUpperCase()] };
  // number before code/word: 4500 INR / 120 dollars / 4.5k rupees
  m = s.match(/(\d[\d,]*(?:\.\d+)?k?)\s?(INR|RS\.?|RUPEES|USD|DOLLARS|EUR|EUROS|GBP|AUD|JPY)\b/i);
  if (m) return { amount: num(m[1]), currency: CODES[m[2].toUpperCase()] };
  // labelled bare number: "amount: 450" / "cost 450" / "total 450"
  m = s.match(/\b(?:amount|cost|total|price|budget)\s*[:=-]?\s*(\d[\d,]*(?:\.\d+)?k?)/i);
  if (m) return { amount: num(m[1]), currency: defaultCurrency };
  return null;
}

export function guessCategory(text) {
  const s = ` ${String(text || '').toLowerCase()} `;
  const explicit = s.match(/\bcategory\s*[:=-]\s*([a-z]+)/);
  if (explicit && CATEGORIES.includes(explicit[1])) return explicit[1];
  let best = 'other';
  let bestHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    const hits = words.filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s)).length;
    if (hits > bestHits) { best = cat; bestHits = hits; }
  }
  return best;
}

export function guessVendor(text) {
  const s = String(text || '');
  let m = s.match(/\b(?:vendor|payee|merchant|supplier)\s*[:=-]\s*([^\n,.;]+)/i);
  if (m) return m[1].trim().slice(0, 60);
  m = s.match(/\b(?:from|at|via|with|to)\s+([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})/);
  if (m) return m[1].trim().slice(0, 60);
  return '';
}

const RISK_WORDS = [
  { re: /\bgift ?cards?\b|\bvouchers?\b/i, flag: 'Gift cards / vouchers are cash-like and hard to audit' },
  { re: /\bcash\b|\bwithdraw/i, flag: 'Cash request — needs a receipt trail' },
  { re: /\balcohol\b|\bbeer\b|\bwine\b|\bwhisk(e)?y\b|\bbar tab\b/i, flag: 'Alcohol is often outside company policy' },
  { re: /\bpersonal\b|\bfor me\b|\bmy (?:own|family)\b/i, flag: 'Wording suggests a personal expense' },
  { re: /\burgent(ly)?\b|\basap\b|\bwire\b/i, flag: 'Urgency / wire language is a common fraud signal' },
];

export function riskWords(text) {
  return RISK_WORDS.filter((r) => r.re.test(String(text || ''))).map((r) => r.flag);
}

/** Parse an expense request out of free text (issue summary + description + comment). */
export function parseExpense(text, defaultCurrency = 'USD') {
  const a = parseAmount(text, defaultCurrency);
  return {
    amount: a ? a.amount : null,
    currency: a ? a.currency : defaultCurrency,
    category: guessCategory(text),
    vendor: guessVendor(text),
    riskWords: riskWords(text),
  };
}

/** Flatten Atlassian Document Format (Jira v3 description/comment) to plain text. */
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  let out = node.text || '';
  if (node.content) out += node.content.map(adfToText).join('');
  if (['paragraph', 'heading', 'listItem', 'hardBreak'].includes(node.type)) out += '\n';
  return out;
}

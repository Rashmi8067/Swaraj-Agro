const DEFAULT_API_URL = 'https://api.solarrooftop.gov.in/VendorList/statewiseVendor';

function clean(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
function keyNorm(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function flattenObjects(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { for (const item of value) flattenObjects(item, out); return out; }
  out.push(value);
  for (const v of Object.values(value)) flattenObjects(v, out);
  return out;
}
function findValue(obj, aliases) {
  const aliasSet = new Set(aliases.map(keyNorm));
  for (const [k, v] of Object.entries(obj || {})) {
    if (aliasSet.has(keyNorm(k)) && (typeof v === 'string' || typeof v === 'number')) return clean(v);
  }
  return '';
}
function findVendorObject(json, vendorName) {
  const needle = clean(vendorName).toLowerCase();
  let best = null;
  for (const obj of flattenObjects(json)) {
    const values = Object.values(obj).filter(v => typeof v === 'string').map(v => clean(v).toLowerCase());
    if (values.some(v => v === needle || v.includes(needle))) { best = obj; break; }
  }
  return best;
}
function parseText(text, vendorName) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const idx = lower.indexOf(clean(vendorName).toLowerCase());
  if (idx < 0) return null;
  const chunk = raw.slice(Math.max(0, idx - 1200), Math.min(raw.length, idx + 5000));
  const pick = (patterns) => {
    for (const p of patterns) { const m = chunk.match(p); if (m) return clean(m[1]); }
    return '';
  };
  const installations = pick([/(?:no\.?\s*of\s*installations|number\s*of\s*installations|installations)[^0-9]{0,80}(\d[\d,]*)/i]);
  const capacity = pick([/(?:total\s*installed\s*capacity|installed\s*capacity|capacity)[^0-9]{0,80}([\d,.]+\s*kW[pP]?)/i]);
  const rating = pick([/(?:rating|vendor\s*rating)[^0-9]{0,80}([0-5](?:\.\d+)?\s*\/\s*5)/i]);
  const ratingCount = pick([/(?:ratings?|reviews?)[^0-9]{0,80}(\d[\d,]*)/i]);
  if (!installations && !capacity && !rating && !ratingCount) return null;
  return { installations, capacity, rating, ratingCount };
}
function extractMetrics(body, vendorName) {
  let json = null;
  try { json = typeof body === 'string' ? JSON.parse(body) : body; } catch (_) {}
  if (json) {
    const obj = findVendorObject(json, vendorName);
    if (obj) {
      const installations = findValue(obj, ['noOfInstallations','numberOfInstallations','installations','totalInstallations','installationCount']);
      const capacity = findValue(obj, ['totalInstalledCapacity','installedCapacity','capacity','totalCapacity']);
      const rating = findValue(obj, ['rating','vendorRating','averageRating']);
      const ratingCount = findValue(obj, ['ratingCount','ratingsCount','numberOfRatings','reviewCount','reviews']);
      if (installations || capacity || rating || ratingCount) return { installations, capacity, rating, ratingCount };
    }
  }
  return parseText(body, vendorName);
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { accept: 'application/json,text/html;q=0.9,*/*;q=0.8', ...(options.headers || {}) } });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally { clearTimeout(timer); }
}
async function syncVendor(current) {
  const vendor = current || {};
  const vendorName = vendor.name || 'DS Swaraj Agro';
  const state = vendor.state || 'Odisha';
  const district = vendor.district || 'Jajpur';
  const base = process.env.PMSG_VENDOR_API_URL || DEFAULT_API_URL;
  const qs = new URLSearchParams({ state, district, vendor: vendorName });
  const urls = [`${base}${base.includes('?') ? '&' : '?'}${qs.toString()}`, base];
  let lastError = 'Official vendor data endpoint did not return usable vendor metrics.';
  for (const url of urls) {
    try {
      const r = await fetchWithTimeout(url);
      if (!r.ok) { lastError = `Official endpoint returned HTTP ${r.status}.`; continue; }
      const metrics = extractMetrics(r.text, vendorName);
      if (!metrics) { lastError = 'Vendor was not found or metrics could not be parsed from the official response.'; continue; }
      const next = { ...vendor };
      if (metrics.installations) next.installations = metrics.installations.replace(/,/g, '');
      if (metrics.capacity) next.capacity = metrics.capacity;
      if (metrics.rating) next.rating = metrics.rating;
      if (metrics.ratingCount) next.ratingCount = metrics.ratingCount.replace(/,/g, '');
      if (next.installations || next.capacity || next.rating) {
        next.lastSyncedAt = new Date().toISOString();
        next.syncStatus = 'success';
        next.syncSource = url;
        return { ok: true, vendor: next };
      }
    } catch (e) {
      lastError = e.name === 'AbortError' ? 'Official vendor endpoint timed out.' : e.message;
    }
  }
  return { ok: false, error: lastError, vendor: { ...vendor, syncStatus: 'fallback', syncError: lastError } };
}
module.exports = { syncVendor, DEFAULT_API_URL };

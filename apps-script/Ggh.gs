/**
 * Green Gain Hub feed — ABM reads the market registry (plots offered for sale, buyers) from Green Gain Hub.
 *
 * Green Gain Hub owns that data (farmers and buyers edit it themselves). This system never copies it into its own
 * database: it asks Green Gain Hub server-to-server (POST {action:'abm_feed', key}) and caches the answer for 5 minutes.
 *
 * The key is made here by code, kept in this project's Script Properties (GGH_FEED_KEY), and only its SHA-256 hash is
 * written to the Green Gain Hub database (Config → abm_feed_key_sha256) — nobody copies a secret by hand, and the
 * Green Gain Hub sheet never holds the key itself. Run gghLink_() (part of setupSystem) again to rotate it.
 *
 * Script Properties (optional): GGH_API_URL (Green Gain Hub /exec), GGH_SPREADSHEET_ID (Green Gain Hub database).
 */
const GGH_API_DEFAULT = 'https://script.google.com/macros/s/AKfycbylUGpPc7g9ODTrt-sodEwAa4G3mx8yP-Rve4lqllPyHGxpZkiuLkNcprQ3p_pVB7WT/exec';
const GGH_DB_DEFAULT = '1TU2kC7kzJbb9JZzo4m7D3eOmcW8Ra_osic33rolE-Hw';
const GGH_SITE_URL = 'https://krit-pj.github.io/Green_Gain_Hub-KPP/';
const GGH_FEED_KEY_PROP = 'GGH_FEED_KEY';
const GGH_FEED_HASH_PARAM = 'abm_feed_key_sha256';
const GGH_FEED_CACHE = 'gghfeed:v1';
const GGH_FEED_FRESH_SECONDS = 300;
const GGH_FEED_STALE_SECONDS = 21600;   // used only when Green Gain Hub cannot be reached
const GGH_FEED_KINDS = ['farmers', 'buyers'];

let GGH_FEED_MEMO_ = null;   // one fetch per execution
let GGH_FEED_STATUS_ = null;

function gghProps_() { return PropertiesService.getScriptProperties(); }
function gghApiUrl_() { return String(gghProps_().getProperty('GGH_API_URL') || GGH_API_DEFAULT).trim(); }

function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Creates the feed key (once) and registers its hash in the Green Gain Hub database. */
function gghLink_() {
  const props = gghProps_();
  let key = props.getProperty(GGH_FEED_KEY_PROP);
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(GGH_FEED_KEY_PROP, key);
  }
  const ss = SpreadsheetApp.openById(String(props.getProperty('GGH_SPREADSHEET_ID') || GGH_DB_DEFAULT));
  const sh = ss.getSheetByName('Config');
  if (!sh) throw new Error('ไม่พบชีต Config ในฐานข้อมูล Green Gain Hub');
  const hash = sha256Hex_(key);
  const last = sh.getLastRow();
  const names = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  const i = names.indexOf(GGH_FEED_HASH_PARAM);
  const row = [GGH_FEED_HASH_PARAM, hash, 'sha256',
    'ABM (ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร) อ่านข้อมูลตลาดผ่าน feed — ค่า hash ของกุญแจ ไม่ใช่กุญแจ (ห้ามแก้ไข)'];
  if (i >= 0) {
    if (String(sh.getRange(i + 2, 2).getValue()) !== hash) sh.getRange(i + 2, 1, 1, 4).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  gghFeedClear_();
  return 'PASS: linked to Green Gain Hub (key hash registered in its Config sheet)';
}

/* ------------------------------ cache (chunked, CacheService ≤100 KB per value) ------------------------------ */
function gghCachePut_(name, text, seconds) {
  const cache = CacheService.getScriptCache();
  const size = 90000, parts = {};
  const n = Math.max(1, Math.ceil(text.length / size));
  for (let i = 0; i < n; i++) parts[name + ':' + i] = text.slice(i * size, (i + 1) * size);
  parts[name + ':n'] = String(n);
  try { cache.putAll(parts, seconds); } catch (err) { /* too large: skip */ }
}
function gghCacheGet_(name) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(name + ':n') || 0);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(name + ':' + i);
  const got = cache.getAll(keys);
  let text = '';
  for (let i = 0; i < n; i++) { if (got[keys[i]] === undefined || got[keys[i]] === null) return null; text += got[keys[i]]; }
  return text;
}
function gghFeedClear_() {
  GGH_FEED_MEMO_ = null;
  try { CacheService.getScriptCache().removeAll([GGH_FEED_CACHE + ':fresh:n', GGH_FEED_CACHE + ':stale:n']); } catch (err) { /* best effort */ }
}

/* ------------------------------ fetch ------------------------------ */
function gghFetchFeed_() {
  const key = gghProps_().getProperty(GGH_FEED_KEY_PROP);
  if (!key) throw new Error('ยังไม่ได้เชื่อมกับ Green Gain Hub (รัน setupSystem)');
  const res = UrlFetchApp.fetch(gghApiUrl_(), {
    method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'abm_feed', key: key })
  });
  if (res.getResponseCode() !== 200) throw new Error('Green Gain Hub HTTP ' + res.getResponseCode());
  let body;
  try { body = JSON.parse(res.getContentText()); } catch (e) { throw new Error('Green Gain Hub ตอบกลับไม่ถูกต้อง'); }
  if (!body || !body.ok || !body.data) throw new Error('Green Gain Hub: ' + (body && body.error || 'ไม่มีข้อมูล'));
  GGH_FEED_KINDS.forEach(function (k) {
    if (!body.data[k] || !Array.isArray(body.data[k].rows)) throw new Error('Green Gain Hub: ไม่มีข้อมูล ' + k);
  });
  return body.data;
}

/** { farmers:{headers, rows}, buyers:{headers, rows}, generatedAt, apiVersion } — fresh ≤5 min, stale ≤6 h on failure. */
function gghFeed_(force) {
  if (GGH_FEED_MEMO_ && !force) return GGH_FEED_MEMO_;
  if (!force) {
    const hit = gghCacheGet_(GGH_FEED_CACHE + ':fresh');
    if (hit) {
      GGH_FEED_MEMO_ = JSON.parse(hit);
      GGH_FEED_STATUS_ = { ok: true, generatedAt: GGH_FEED_MEMO_.generatedAt || '', stale: false };
      return GGH_FEED_MEMO_;
    }
  }
  try {
    const data = gghFetchFeed_();
    const text = JSON.stringify(data);
    gghCachePut_(GGH_FEED_CACHE + ':fresh', text, GGH_FEED_FRESH_SECONDS);
    gghCachePut_(GGH_FEED_CACHE + ':stale', text, GGH_FEED_STALE_SECONDS);
    GGH_FEED_MEMO_ = data;
    GGH_FEED_STATUS_ = { ok: true, generatedAt: data.generatedAt || '', stale: false };
    return data;
  } catch (err) {
    const stale = gghCacheGet_(GGH_FEED_CACHE + ':stale');
    const msg = cleanText_(err && err.message || err, 200);
    if (stale) {
      GGH_FEED_MEMO_ = JSON.parse(stale);
      GGH_FEED_STATUS_ = { ok: true, generatedAt: GGH_FEED_MEMO_.generatedAt || '', stale: true, error: msg };
      return GGH_FEED_MEMO_;
    }
    GGH_FEED_STATUS_ = { ok: false, generatedAt: '', stale: false, error: msg };
    throw err;
  }
}

const GGH_ISO_DATE_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
/** Rows of the Green Gain Hub sheet (without the header), in the same column order as its sheet; dates are Date objects.
    Returns [] when Green Gain Hub cannot be reached (gghFeedStatus_() says why) so officer pages keep working. */
function gghRows_(kind) {
  if (GGH_FEED_KINDS.indexOf(kind) < 0) throw new Error('Unknown Green Gain Hub data: ' + kind);
  let feed;
  try { feed = gghFeed_(false); } catch (err) { return []; }
  return (feed[kind].rows || []).map(function (r) {
    return r.map(function (v) { return typeof v === 'string' && GGH_ISO_DATE_.test(v) ? new Date(v) : v; });
  });
}

/** For the dashboard and reports: where the market numbers come from and whether they are current. */
function gghFeedStatus_() {
  if (!GGH_FEED_STATUS_) { try { gghFeed_(false); } catch (err) { /* status set */ } }
  const s = GGH_FEED_STATUS_ || { ok: false, error: 'ยังไม่ได้อ่านข้อมูล' };
  return { source: 'Green Gain Hub', url: GGH_SITE_URL, ok: !!s.ok, stale: !!s.stale, generatedAt: s.generatedAt || '', error: s.error || '' };
}

/** Run from the editor: confirms the feed works. */
function verifyGghFeed() {
  const d = gghFeed_(true);
  return 'PASS: Green Gain Hub feed ' + (d.apiVersion || '') + ' — ' + d.farmers.rows.length + ' plot row(s), ' +
    d.buyers.rows.length + ' buyer row(s)';
}

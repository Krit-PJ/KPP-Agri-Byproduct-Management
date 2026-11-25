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
 * 1.1.0: Green Gain Hub 2.8.0 shows a plot on its market until N days after harvest. Officers (Super/Mini Super Admin)
 * set N here (POST {action:'abm_config', key, hideAfterHarvestDays}); the feed says which Open plots are hidden today
 * (ids and reasons only), so the dashboard counts the same plots buyers see.
 *
 * 1.3.0: executive report (POST {action:'abm_report', key, province}) — Green Gain Hub 3.2.0.
 * 1.3.1: the Green Gain Hub PIN reset is removed (Green Gain Hub 3.3.0 signs in by phone number only).
 * 1.4.0: the feed is read per province (POST {action:'abm_feed', key, province}) — the dashboard, balance and residue pages
 *        stay on this office's province (62); the contact lists in reports may read another province (Super Admin).
 *        The market listing rule is set in Green Gain Hub 4.0.0 by its Super Admin; ABM only reads it.
 *
 * Script Properties (optional): GGH_API_URL (Green Gain Hub /exec), GGH_SPREADSHEET_ID (Green Gain Hub database).
 */
const GGH_API_DEFAULT = 'https://script.google.com/macros/s/AKfycbylUGpPc7g9ODTrt-sodEwAa4G3mx8yP-Rve4lqllPyHGxpZkiuLkNcprQ3p_pVB7WT/exec';
const GGH_DB_DEFAULT = '1TU2kC7kzJbb9JZzo4m7D3eOmcW8Ra_osic33rolE-Hw';
const GGH_SITE_URL = 'https://krit-pj.github.io/Green_Gain_Hub-KPP/';
const GGH_FEED_KEY_PROP = 'GGH_FEED_KEY';
const GGH_FEED_HASH_PARAM = 'abm_feed_key_sha256';
const GGH_FEED_CACHE = 'gghfeed:v2:';   // + province
const GGH_FEED_FRESH_SECONDS = 300;
const GGH_FEED_STALE_SECONDS = 21600;   // used only when Green Gain Hub cannot be reached
const GGH_FEED_KINDS = ['farmers', 'buyers'];

let GGH_FEED_MEMO_ = {};   // province → feed, one fetch per execution
let GGH_FEED_STATUS_ = null;
const GGH_HOME_PROVINCE = '62';   // this office's province (กำแพงเพชร)

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
    'ABM (ระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร) อ่านข้อมูลตลาดผ่าน feed — ค่า hash ของกุญแจ ไม่ใช่กุญแจ (ห้ามแก้ไข)'];
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
  const used = Object.keys(GGH_FEED_MEMO_).concat([GGH_HOME_PROVINCE]);
  GGH_FEED_MEMO_ = {};
  try { CacheService.getScriptCache().removeAll(used.map(function (p) { return GGH_FEED_CACHE + p + ':fresh:n'; })); } catch (err) { /* best effort */ }
}

/* ------------------------------ fetch ------------------------------ */
function gghFetchFeed_(province) {
  const key = gghProps_().getProperty(GGH_FEED_KEY_PROP);
  if (!key) throw new Error('ยังไม่ได้เชื่อมกับ Green Gain Hub (รัน setupSystem)');
  const res = UrlFetchApp.fetch(gghApiUrl_(), {
    method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'abm_feed', key: key, province: province || GGH_HOME_PROVINCE })
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
function gghFeed_(force, province) {
  const pv = gghProvinceCode_(province) && gghProvinceCode_(province) !== 'ALL' ? gghProvinceCode_(province) : GGH_HOME_PROVINCE;
  const name = GGH_FEED_CACHE + pv;
  if (GGH_FEED_MEMO_[pv] && !force) return GGH_FEED_MEMO_[pv];
  if (!force) {
    const hit = gghCacheGet_(name + ':fresh');
    if (hit) {
      GGH_FEED_MEMO_[pv] = JSON.parse(hit);
      GGH_FEED_STATUS_ = { ok: true, generatedAt: GGH_FEED_MEMO_[pv].generatedAt || '', stale: false };
      return GGH_FEED_MEMO_[pv];
    }
  }
  try {
    const data = gghFetchFeed_(pv);
    const text = JSON.stringify(data);
    gghCachePut_(name + ':fresh', text, GGH_FEED_FRESH_SECONDS);
    gghCachePut_(name + ':stale', text, GGH_FEED_STALE_SECONDS);
    GGH_FEED_MEMO_[pv] = data;
    GGH_FEED_STATUS_ = { ok: true, generatedAt: data.generatedAt || '', stale: false };
    return data;
  } catch (err) {
    const stale = gghCacheGet_(name + ':stale');
    const msg = cleanText_(err && err.message || err, 200);
    if (stale) {
      GGH_FEED_MEMO_[pv] = JSON.parse(stale);
      GGH_FEED_STATUS_ = { ok: true, generatedAt: GGH_FEED_MEMO_[pv].generatedAt || '', stale: true, error: msg };
      return GGH_FEED_MEMO_[pv];
    }
    GGH_FEED_STATUS_ = { ok: false, generatedAt: '', stale: false, error: msg };
    throw err;
  }
}

const GGH_ISO_DATE_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
/** Rows of the Green Gain Hub sheet (without the header), in the same column order as its sheet; dates are Date objects.
    Returns [] when Green Gain Hub cannot be reached (gghFeedStatus_() says why) so officer pages keep working. */
function gghRows_(kind, province) {
  if (GGH_FEED_KINDS.indexOf(kind) < 0) throw new Error('Unknown Green Gain Hub data: ' + kind);
  let feed;
  try { feed = gghFeed_(false, province); } catch (err) { return []; }
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

/* ------------------------------ 1.1.0: market listing rule (how long a plot stays on the market after harvest) ------------------------------ */
function gghPost_(body) {
  const key = gghProps_().getProperty(GGH_FEED_KEY_PROP);
  if (!key) throw new Error('ยังไม่ได้เชื่อมกับ Green Gain Hub (รัน setupSystem)');
  body.key = key;
  const res = UrlFetchApp.fetch(gghApiUrl_(), { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify(body) });
  if (res.getResponseCode() !== 200) throw new Error('Green Gain Hub HTTP ' + res.getResponseCode());
  let out;
  try { out = JSON.parse(res.getContentText()); } catch (e) { throw new Error('Green Gain Hub ตอบกลับไม่ถูกต้อง'); }
  if (!out || !out.ok || !out.data) throw new Error('Green Gain Hub: ' + (out && out.error || 'ไม่มีข้อมูล'));
  return out.data;
}

/** { hideAfterHarvestDays, startDate, listedPlots, hiddenPlots, hidden:[{id, reason}] } read now from Green Gain Hub.
    1.4.0: read-only here — Green Gain Hub 4.0.0's Super Admin sets it. */
function gghMarketRuleGet_() {
  return { status: 'success', rule: gghPost_({ action: 'abm_config' }) };
}


/** From the cached feed: { id: reason } of Open plots that buyers do not see today. Empty if Green Gain Hub is older than 2.8.0. */
function gghHiddenPlots_(province) {
  const out = {};
  try {
    const m = gghFeed_(false, province).market;
    ((m && m.hidden) || []).forEach(function (h) { out[String(h.id)] = h.reason || 'hidden'; });
  } catch (err) { /* feed down: nothing known */ }
  return out;
}
function gghListingRule_() {
  try { const m = gghFeed_(false).market; return m ? { hideAfterHarvestDays: m.hideAfterHarvestDays, startDate: m.startDate || '' } : null; } catch (err) { return null; }
}

/** 1.2.0: is this phone a Green Gain Hub farmer/buyer account? (GGH 2.9.0 feed: SHA-256 of user phones; older GGH → false) */
function gghIsMarketPhone_(phone) {
  const p = normalizePhone_(phone);
  if (!/^0\d{9}$/.test(p)) return false;
  let feed = null;
  try { feed = gghFeed_(false); } catch (err) { return false; }
  const list = feed && feed.marketPhones;
  if (!Array.isArray(list)) return false;
  const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
  if (list.indexOf(h) >= 0) return true;
  // a farmer who registered a minute ago may not be in the cached copy yet: read once more
  try { const fresh = gghFeed_(true); return Array.isArray(fresh.marketPhones) && fresh.marketPhones.indexOf(h) >= 0; } catch (err) { return false; }
}

/* ------------------------------ 1.3.0: executive report (Green Gain Hub 3.2.0) ------------------------------ */
const GGH_REPORT_CACHE = 'gghreport:v1:';
const GGH_REPORT_SECONDS = 300;
let GGH_REPORT_MEMO_ = {};

/** 'ALL' or a two-digit province code; anything else → ''. */
function gghProvinceCode_(v) {
  const t = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  if (t === 'ALL') return 'ALL';
  return /^\d{2}$/.test(t) ? t : '';
}

/** 1.4.0: Thai name of a province code (from the Green Gain Hub feed / report; this office's name for 62). */
let GGH_PROVINCE_NAMES_ = {};   // names the officer's page sent with the request (display only)
function gghProvinceName_(code) {
  if (code === GGH_HOME_PROVINCE) return provinceName_();
  if (GGH_PROVINCE_NAMES_[code]) return GGH_PROVINCE_NAMES_[code];
  try { const f = GGH_FEED_MEMO_[code]; if (f && f.provinceName) return f.provinceName; } catch (e) { /* none */ }
  try { const r = GGH_REPORT_MEMO_[code]; if (r && r.scope && r.scope.name) return r.scope.name; } catch (e) { /* none */ }
  return 'รหัส ' + code;
}

/** Executive numbers from Green Gain Hub (abm_report): one province by district, or every province. Cached 5 minutes. */
function gghExecReport_(province, force) {
  const code = gghProvinceCode_(province) || '62';
  if (!force && GGH_REPORT_MEMO_[code]) return GGH_REPORT_MEMO_[code];
  if (!force) {
    const hit = gghCacheGet_(GGH_REPORT_CACHE + code);
    if (hit) return (GGH_REPORT_MEMO_[code] = JSON.parse(hit));
  }
  const data = gghPost_({ action: 'abm_report', province: code });
  if (!data || !data.summary || !Array.isArray(data.areas)) throw new Error('Green Gain Hub ยังไม่รองรับรายงานผู้บริหาร (ต้องเป็นรุ่น 3.2.0 ขึ้นไป)');
  gghCachePut_(GGH_REPORT_CACHE + code, JSON.stringify(data), GGH_REPORT_SECONDS);
  return (GGH_REPORT_MEMO_[code] = data);
}

/** 1.3.0 — run from the editor: confirms the executive report (Green Gain Hub 3.2.0 abm_report) works. Numbers only, no names. */
function verifyGghReport() {
  const d = gghExecReport_('62', true), x = d.summary;
  return 'PASS: Green Gain Hub report ' + (d.apiVersion || '') + ' ' + d.scope.name + ' — ' + x.plots + ' plot(s), ' + x.areaRai + ' rai, ' +
    x.farmers + ' farmer(s), ' + x.buyers + ' buyer(s), sales ' + x.salesCount + ' (' + x.salesBaht + ' baht), ' + d.areas.length + ' district(s)';
}

/** Run from the editor: confirms the feed works. */
function verifyGghFeed() {
  const d = gghFeed_(true);
  return 'PASS: Green Gain Hub feed ' + (d.apiVersion || '') + ' — ' + d.farmers.rows.length + ' plot row(s), ' +
    d.buyers.rows.length + ' buyer row(s)';
}

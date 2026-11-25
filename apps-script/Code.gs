/**
 * ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร (Agri By-product Management, ABM) 1.0.0 — จังหวัดกำแพงเพชร
 * แยกจาก Green Gain Hub 2.5.0 (19 พ.ย. 2569): ระบบนี้เป็นของเจ้าหน้าที่และผู้บริหาร
 *   - บันทึกการจัดการวัสดุเหลือใช้ทางการเกษตร ภาพ เป้าหมายรายอำเภอ ก๊าซเรือนกระจก มูลค่า รายงาน
 *   - Dashboard ผู้บริหาร (สาธารณะ ข้อมูลรวมเท่านั้น)
 * Green Gain Hub (ตลาดสำหรับเกษตรกรและผู้รับซื้อ) เป็นเจ้าของข้อมูลแปลงประกาศขายและผู้รับซื้อ
 * ระบบนี้อ่านผ่าน feed ของ Green Gain Hub ฝั่ง Server (Ggh.gs) — ไม่คัดลอกมาเก็บซ้ำ
 *
 * Files: Code.gs (this: public API, summary, Smart Agri, helpers), Ggh.gs (Green Gain Hub feed),
 *        Districts.gs (boundaries), Admin.gs (Super / Mini Super / Admin, doPost), Staff.gs (officer self-registration),
 *        Sso.gs (officer sign-in through the central identity), Crops.gs (crop area import + crop summary),
 *        Counter.gs (visit counter), Reports.gs (reports), Ghg.gs (GHG Calculation Engine v1.0),
 *        Residue.gs (records, targets, GHG avoided, value), Balance.gs (registry harvest × market × records).
 *
 * Endpoints (same /exec URL):
 *   ?api=v1&endpoint=summary[&key=]   Public, aggregate-only dashboard data (JSON or JSONP)
 *   ?api=v1&endpoint=crop&crop=&season=&district=   Public sub-district crop breakdown
 *   ?api=v1&endpoint=residue[&fy=2570] Public residue management + GHG avoided (district × crop × method sums)
 *   ?api=v1&endpoint=balance[&fy=2570] Public residue balance ①–⑥ per district × crop (aggregate only)
 *   ?api=v1&endpoint=hit | visits     Visit counter (count once per session | read)
 *   ?api=v1&endpoint=health           Public version check
 *   POST {method,args,token}          Officer / admin API (Admin.gs)
 */
const APP_VERSION = '1.3.1';
const APP_FEATURE = 'ABM_SPLIT';
const APP_NAME = 'ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร';
// Database: "Agri By-product Management KPP — Database (v1.0.0)" in Drive folder "10. Agri By-product Management".
// Script Property SPREADSHEET_ID overrides this value when set.
const DEFAULT_SPREADSHEET_ID = '1wTzRcRx3sCoUZD9ykFgl17WOGVw9BtVkVwqtAftyVU4';
const SUMMARY_CACHE_SECONDS = 300;
const SUMMARY_CACHE_KEY = 'summary:v1:' + APP_VERSION;
// KPP Smart Agri-Materials (รายงานการจัดการวัสดุเหลือใช้ทางการเกษตรรายอำเภอ) — อ่านผ่าน Data API v1 ฝั่ง Server
// API Key เก็บใน Script Property SMART_AGRI_API_KEY เท่านั้น (ตั้งได้ที่หน้า ตั้งค่า → การเชื่อมต่อระบบอื่น)
const SMART_AGRI_DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxoo4VuAomjDPaDPXgEF6y0CFVxBfor-4OmIi3bQVik7FCgAx_7XghYmeav7BHDbpLcaw/exec';
const SMART_AGRI_CACHE_KEY = 'smartagri:v1:' + APP_VERSION;
const SMART_AGRI_ITEMS = 'agri';
const DEFAULT_SESSION_TTL_SECONDS = 21600; // 6 hours
const MATERIAL_TYPES = ['ฟางข้าว', 'ใบอ้อย', 'เหง้ามันสำปะหลัง', 'อื่นๆ'];
const CROP_MATERIAL_MAP = {
  'ข้าวนาปี': 'ฟางข้าว',
  'ข้าวนาปรัง': 'ฟางข้าว',
  'อ้อยโรงงาน': 'ใบอ้อย',
  'มันสำปะหลัง': 'เหง้ามันสำปะหลัง'
};

/** Public JSON / JSONP API used by the dashboard (index.html). Officer pages use POST (Admin.gs). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(p.callback || '') ? p.callback : '';
  if (!p.api) p.api = 'v1', p.endpoint = p.endpoint || 'health';
  return publicApiResponse_(p, callback);
}

/** Public, non-sensitive deployment check. */
function getApiInfoServer() {
  return { status: 'success', success: true, apiVersion: APP_VERSION, feature: APP_FEATURE, system: 'ABM' };
}

/* ------------------------------------------------------------------------- *
 * Public API v1 — aggregate-only. Never returns names, phone numbers,
 * record IDs or plot coordinates, so it is safe for the public dashboard.
 * ------------------------------------------------------------------------- */

function publicApiResponse_(p, callback) {
  let payload;
  try {
    if (String(p.api) !== 'v1') throw new Error('Unsupported API version');
    requireSummaryKey_(p.key);
    const endpoint = String(p.endpoint || 'summary');
    const ok = function (data) { return { ok: true, api: 'v1', endpoint: endpoint, apiVersion: APP_VERSION, data: data }; };
    if (endpoint === 'summary') {
      const data = getPublicSummary_(p.refresh === '1');
      data.reports = getSmartAgriReports_(p.refresh === '1');
      data.crops = getCropSummary_(p.refresh === '1');
      data.province = provinceName_();
      payload = ok(data);
    } else if (endpoint === 'hit') {
      payload = ok(recordVisit_());
    } else if (endpoint === 'visits') {
      payload = ok(visitCounts_(false));
    } else if (endpoint === 'residue') {
      payload = ok(getResiduePublic_(p));
    } else if (endpoint === 'balance') {
      payload = ok(getResidueBalancePublic_(p));
    } else if (endpoint === 'crop') {
      payload = ok(getCropDetail_(p));
    } else if (endpoint === 'health') {
      payload = { ok: true, api: 'v1', endpoint: endpoint, apiVersion: APP_VERSION, feature: APP_FEATURE, system: 'ABM',
        generatedAt: new Date().toISOString() };
    } else {
      throw new Error('Unknown endpoint');
    }
  } catch (err) {
    payload = { ok: false, api: 'v1', error: publicError_(err) };
  }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const body = callback ? callback + '(' + json + ');' : json;
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

/**
 * Optional gate. When Script Property SUMMARY_API_KEY is empty (default) the
 * summary is open. A key used by a public web page is visible to anyone, so it
 * only limits casual reuse; the real protection is that the summary is aggregate-only.
 */
function requireSummaryKey_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('SUMMARY_API_KEY');
  if (expected && String(key || '') !== String(expected)) throw new Error('Invalid API key');
}

function getPublicSummary_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get(SUMMARY_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  }
  const summary = buildPublicSummary_(new Date());
  try { cache.put(SUMMARY_CACHE_KEY, JSON.stringify(summary), SUMMARY_CACHE_SECONDS); } catch (err) { /* >100KB: skip cache */ }
  return summary;
}

function buildPublicSummary_(now) {
  const farmers = gghRows_('farmers').filter(function (r) {
    return String(r[11] || '').trim().toLowerCase() === 'open';
  });
  // 1.1.0: market numbers count the plots buyers see on Green Gain Hub (shown until N days after harvest);
  // the harvest calendar (harvestByMonth, upcoming) still uses every Open plot.
  const hiddenIds = gghHiddenPlots_();
  let hiddenPlots = 0;
  const buyers = gghRows_('buyers').filter(function (r) {
    return String(r[11] || '').trim().toLowerCase() === 'active';
  });
  const refs = researchRefs_();
  const districts = districtList_();
  const byDistrict = {};
  districts.forEach(function (d) { byDistrict[d.code] = emptyDistrictStat_(d); });
  const outside = emptyDistrictStat_({ code: 'OTHER', name: 'นอกเขต/ไม่ระบุพิกัด' });
  const byMaterial = {};
  const byCrop = {};
  const owners = {};
  const today = startOfDay_(now);
  const months = harvestMonthWindow_(today, 6, 6);
  const monthIndex = {};
  months.forEach(function (m, i) { monthIndex[m.month] = i; });
  const upcoming = { days30: { plots: 0, areaRai: 0 }, days60: { plots: 0, areaRai: 0 } };
  let totalArea = 0;
  let withCoordinates = 0;

  buyers.forEach(function (r) {
    const material = resolvedMaterial_(r[13], r[14], r[7]) || 'ไม่ระบุ';
    const capacity = leadingNumber_(r[10]);
    const price = maybeNumber_(r[9]);
    const district = hasCoordinates_(r[5], r[6]) ? districtForPoint_(Number(r[5]), Number(r[6]), districts) : null;
    const target = district ? byDistrict[district.code] : outside;
    target.buyers++;
    target.capacityTonPerDay += capacity;
    const m = materialStat_(byMaterial, material);
    m.buyers++;
    m.capacityTonPerDay += capacity;
    if (price !== '' && price > 0) { m.priceSum += price; m.priceCount++; }
  });

  farmers.forEach(function (r) {
    const area = parseAreaRai_(r[8]);
    const harvestAt = toDate_(r[7]);
    if (harvestAt) {
      const hk = Utilities.formatDate(harvestAt, Session.getScriptTimeZone(), 'yyyy-MM');
      if (hk in monthIndex) { months[monthIndex[hk]].plots++; months[monthIndex[hk]].areaRai += area; }
      const days = Math.round((startOfDay_(harvestAt).getTime() - today.getTime()) / 86400000);
      if (days >= 0 && days <= 30) { upcoming.days30.plots++; upcoming.days30.areaRai += area; }
      if (days >= 0 && days <= 60) { upcoming.days60.plots++; upcoming.days60.areaRai += area; }
    }
    if (hiddenIds[text_(r[0])]) { hiddenPlots++; return; }
    const material = resolvedMaterial_(r[13], r[14], r[5]) || 'ไม่ระบุ';
    const crop = text_(r[5]) || 'ไม่ระบุ';
    const owner = normalizePhone_(r[12]) || normalizePhone_(r[4]);
    if (owner) owners[owner] = true;
    totalArea += area;
    let district = null;
    if (hasCoordinates_(r[9], r[10])) {
      withCoordinates++;
      district = districtForPoint_(Number(r[9]), Number(r[10]), districts);
    }
    const target = district ? byDistrict[district.code] : outside;
    target.plots++;
    target.areaRai += area;
    if (owner) target.owners[owner] = true;
    target.materials[material] = (target.materials[material] || 0) + area;

    const m = materialStat_(byMaterial, material);
    m.plots++;
    m.areaRai += area;
    const c = byCrop[crop] || (byCrop[crop] = { crop: crop, material: material, plots: 0, areaRai: 0 });
    c.plots++;
    c.areaRai += area;
  });

  const materialList = Object.keys(byMaterial).map(function (k) {
    const m = byMaterial[k];
    const ref = refs[k] || null;
    const avgPrice = m.priceCount ? m.priceSum / m.priceCount : null;
    return {
      material: k,
      plots: m.plots,
      areaRai: round_(m.areaRai, 2),
      buyers: m.buyers,
      capacityTonPerDay: round_(m.capacityTonPerDay, 1),
      avgBuyerPriceBahtPerRai: avgPrice === null ? null : round_(avgPrice, 2),
      potentialValueBaht: avgPrice === null ? null : Math.round(m.areaRai * avgPrice),
      bioRateTonPerRai: ref && ref.bioRate !== null ? ref.bioRate : null,
      residueTon: ref && ref.bioRate !== null ? round_(m.areaRai * ref.bioRate, 1) : null
    };
  }).sort(function (a, b) { return b.areaRai - a.areaRai || b.buyers - a.buyers; });

  const valueKnown = materialList.filter(function (m) { return m.potentialValueBaht !== null; });
  const residueKnown = materialList.filter(function (m) { return m.residueTon !== null; });
  const allBuyerPrices = buyers.map(function (r) { return maybeNumber_(r[9]); }).filter(function (v) { return v !== '' && v > 0; });

  const districtList = districts.map(function (d) { return finalizeDistrictStat_(byDistrict[d.code], refs); });
  if (outside.plots || outside.buyers) districtList.push(finalizeDistrictStat_(outside, refs));

  return {
    generatedAt: now.toISOString(),
    province: provinceName_(),
    market: gghFeedStatus_(),
    listing: gghListingRule_(),
    cacheSeconds: SUMMARY_CACHE_SECONDS,
    totals: {
      farmerPlots: farmers.length - hiddenPlots,
      hiddenPlots: hiddenPlots,
      farmers: Object.keys(owners).length,
      plotsWithCoordinates: withCoordinates,
      areaRai: round_(totalArea, 2),
      buyers: buyers.length,
      capacityTonPerDay: round_(buyers.reduce(function (s, r) { return s + leadingNumber_(r[10]); }, 0), 1),
      avgBuyerPriceBahtPerRai: allBuyerPrices.length ? round_(allBuyerPrices.reduce(function (s, v) { return s + v; }, 0) / allBuyerPrices.length, 2) : null,
      potentialValueBaht: valueKnown.length ? valueKnown.reduce(function (s, m) { return s + m.potentialValueBaht; }, 0) : null,
      residueTon: residueKnown.length ? round_(residueKnown.reduce(function (s, m) { return s + m.residueTon; }, 0), 1) : null,
      districtsCovered: districtList.filter(function (d) { return d.code !== 'OTHER' && (d.plots || d.buyers); }).length,
      districtsTotal: districts.length
    },
    upcomingHarvest: {
      days30: { plots: upcoming.days30.plots, areaRai: round_(upcoming.days30.areaRai, 2) },
      days60: { plots: upcoming.days60.plots, areaRai: round_(upcoming.days60.areaRai, 2) }
    },
    byDistrict: districtList,
    byMaterial: materialList,
    byCrop: Object.keys(byCrop).map(function (k) {
      return { crop: k, material: byCrop[k].material, plots: byCrop[k].plots, areaRai: round_(byCrop[k].areaRai, 2) };
    }).sort(function (a, b) { return b.areaRai - a.areaRai; }),
    harvestByMonth: months.map(function (m) { return { month: m.month, plots: m.plots, areaRai: round_(m.areaRai, 2), isCurrent: m.isCurrent }; }),
    goals: activeGoals_(),
    notes: {
      area: 'พื้นที่แปลง (ไร่) แปลงจากรูปแบบ ไร่-งาน-ตร.ว. ของแบบฟอร์ม',
      price: 'ราคารับซื้อเป็นค่าเฉลี่ยที่ผู้รับซื้อสถานะ Active ระบุ (บาท/ไร่)',
      residue: residueKnown.length ? 'ปริมาณวัสดุเหลือใช้ทางการเกษตรประมาณจาก BioRate (ตัน/ไร่) ในชีต Research_Refs'
        : 'ยังไม่ได้กำหนด BioRate (ตัน/ไร่) ในชีต Research_Refs จึงยังไม่ประมาณปริมาณวัสดุเหลือใช้ทางการเกษตร',
      privacy: 'ข้อมูลสรุปเชิงสถิติเท่านั้น ไม่มีชื่อ เบอร์โทร หรือพิกัดรายแปลง',
      source: 'แปลงประกาศขายและผู้รับซื้อจาก Green Gain Hub (อ่านผ่าน feed ทุก 5 นาที)'
    }
  };
}

function emptyDistrictStat_(d) {
  return { code: d.code, name: d.name, plots: 0, areaRai: 0, buyers: 0, capacityTonPerDay: 0, owners: {}, materials: {} };
}

function finalizeDistrictStat_(d, refs) {
  let residue = 0;
  let residueKnown = false;
  const materials = Object.keys(d.materials).map(function (k) {
    const ref = refs[k];
    if (ref && ref.bioRate !== null) { residue += d.materials[k] * ref.bioRate; residueKnown = true; }
    return { material: k, areaRai: round_(d.materials[k], 2) };
  }).sort(function (a, b) { return b.areaRai - a.areaRai; });
  return {
    code: d.code, name: d.name, plots: d.plots, farmers: Object.keys(d.owners).length,
    areaRai: round_(d.areaRai, 2), buyers: d.buyers, capacityTonPerDay: round_(d.capacityTonPerDay, 1),
    residueTon: residueKnown ? round_(residue, 1) : null, materials: materials
  };
}

function materialStat_(map, material) {
  return map[material] || (map[material] = { plots: 0, areaRai: 0, buyers: 0, capacityTonPerDay: 0, priceSum: 0, priceCount: 0 });
}

/** Research_Refs: Type = ชนิดวัสดุเหลือใช้ทางการเกษตร, BioRate = ตัน/ไร่ (optional). */
function researchRefs_() {
  const out = {};
  try {
    const sh = spreadsheet_().getSheetByName('Research_Refs');
    if (!sh || sh.getLastRow() < 2) return out;
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    const iType = head.indexOf('Type');
    const iRate = head.indexOf('BioRate');
    if (iType < 0) return out;
    dataRows_(sh).forEach(function (r) {
      const type = text_(r[iType]);
      if (!type) return;
      const rate = iRate >= 0 ? Number(r[iRate]) : NaN;
      out[type] = { bioRate: isFinite(rate) && rate > 0 && String(r[iRate]).trim() !== '' ? rate : null };
    });
  } catch (err) { /* optional sheet */ }
  return out;
}

/** Goals: ID, Icon, Title, Description, SortOrder, Active — shown on the landing page when present. */
function activeGoals_() {
  try {
    const sh = spreadsheet_().getSheetByName('Goals');
    if (!sh || sh.getLastRow() < 2) return [];
    return dataRows_(sh).filter(function (r) {
      const active = String(r[5]).trim().toLowerCase();
      return text_(r[2]) && (active === 'true' || active === 'yes' || active === '1' || r[5] === true);
    }).map(function (r) {
      return { icon: cleanText_(r[1], 40), title: cleanText_(r[2], 120), description: cleanText_(r[3], 400), sortOrder: Number(r[4]) || 0 };
    }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }).slice(0, 8);
  } catch (err) {
    return [];
  }
}

/** "20 ไร่ 1 งาน 25 ตร.ว." → 20.3125 rai. A bare number is read as rai. */
function parseAreaRai_(value) {
  if (typeof value === 'number') return isFinite(value) && value > 0 ? value : 0;
  const s = String(value || '').replace(/,/g, '');
  const rai = s.match(/([\d.]+)\s*ไร่/);
  const ngan = s.match(/([\d.]+)\s*งาน/);
  const wa = s.match(/([\d.]+)\s*(?:ตร\.?\s*ว|ตารางวา)/);
  if (rai || ngan || wa) {
    return (rai ? Number(rai[1]) : 0) + (ngan ? Number(ngan[1]) / 4 : 0) + (wa ? Number(wa[1]) / 400 : 0);
  }
  const n = Number(s.trim());
  return isFinite(n) && n > 0 ? n : 0;
}

/** "20 ตัน/วัน" → 20 */
function leadingNumber_(value) {
  if (typeof value === 'number') return isFinite(value) && value > 0 ? value : 0;
  const m = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function harvestMonthWindow_(today, before, after) {
  const out = [];
  const tz = Session.getScriptTimeZone();
  for (let i = -before; i <= after; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    out.push({ month: Utilities.formatDate(d, tz, 'yyyy-MM'), plots: 0, areaRai: 0, isCurrent: i === 0 });
  }
  return out;
}

function startOfDay_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function round_(n, digits) {
  const f = Math.pow(10, digits || 0);
  return Math.round((Number(n) || 0) * f) / f;
}

/** District list from Districts.gs; empty when that file is not installed. */
function districtList_() {
  if (typeof KPP_DISTRICTS === 'undefined' || !KPP_DISTRICTS.features) return [];
  return KPP_DISTRICTS.features.map(function (f) {
    return { code: f.properties.code, name: f.properties.name, geometry: f.geometry };
  });
}

function districtForPoint_(lat, lng, districts) {
  for (let i = 0; i < districts.length; i++) {
    if (pointInGeometry_(lng, lat, districts[i].geometry)) return districts[i];
  }
  return null;
}

function pointInGeometry_(x, y, geometry) {
  if (!geometry) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(function (rings) {
    if (!pointInRing_(x, y, rings[0])) return false;
    for (let h = 1; h < rings.length; h++) if (pointInRing_(x, y, rings[h])) return false;
    return true;
  });
}

function pointInRing_(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------------- *
 * KPP Smart Agri-Materials reports (read-only proxy).
 * Calls the external Data API v1 server-side so the API key never reaches
 * the browser. Failures return { ok:false } and never break the summary.
 * ------------------------------------------------------------------------- */

function getSmartAgriReports_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const hit = cache.get(SMART_AGRI_CACHE_KEY);
    if (hit) return JSON.parse(hit);
  }
  const reports = fetchSmartAgriReports_();
  // Cache failures briefly so a broken upstream is retried soon without hammering it.
  try { cache.put(SMART_AGRI_CACHE_KEY, JSON.stringify(reports), reports.ok ? SUMMARY_CACHE_SECONDS : 60); } catch (err) { /* too large */ }
  return reports;
}

function fetchSmartAgriReports_() {
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty('SMART_AGRI_API_KEY') || '').trim();
  const base = String(props.getProperty('SMART_AGRI_API_URL') || SMART_AGRI_DEFAULT_URL).trim();
  const source = { name: 'KPP Smart Agri-Materials', office: '', title: '' };
  if (!key) return { ok: false, configured: false, source: source, error: 'ยังไม่ได้ตั้งค่า SMART_AGRI_API_KEY ใน Script Properties' };
  try {
    const url = function (endpoint) {
      return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'api=v1&endpoint=' + endpoint +
        '&items=' + SMART_AGRI_ITEMS + '&key=' + encodeURIComponent(key);
    };
    const responses = UrlFetchApp.fetchAll(['summary', 'districts', 'timeseries', 'meta'].map(function (endpoint) {
      return { url: url(endpoint), muteHttpExceptions: true, followRedirects: true };
    }));
    const bodies = responses.map(function (res) {
      if (res.getResponseCode() !== 200) throw new Error('Smart Agri API HTTP ' + res.getResponseCode());
      const body = JSON.parse(res.getContentText());
      if (!body || body.ok === false) throw new Error('Smart Agri API: ' + (body && (body.error || body.code) || 'error'));
      return body;
    });
    return normalizeSmartAgri_(bodies[0], bodies[1], bodies[2], bodies[3]);
  } catch (err) {
    return { ok: false, configured: true, source: source, error: cleanText_(err && err.message || err, 200) };
  }
}

/** Reshape the external API into the compact, district-keyed form used by the dashboard. */
function normalizeSmartAgri_(summaryBody, districtsBody, seriesBody, metaBody) {
  const s = summaryBody.data || {};
  const d = (districtsBody && districtsBody.data) || {};
  const ts = (seriesBody && seriesBody.data) || {};
  const meta = (metaBody && metaBody.data) || {};
  const items = (s.items || []).map(function (it) {
    return { id: text_(it.id), code: text_(it.code), label: text_(it.label), unit: text_(it.unit),
      week: numOrNull_(it.week), cumulative: numOrNull_(it.cumulative), districtsYes: Number(it.districts_reporting_yes) || 0 };
  });
  const byDistrict = (d.districts || []).map(function (x) {
    const values = {};
    Object.keys(x.items || {}).forEach(function (id) {
      values[id] = { week: numOrNull_(x.items[id].week), cumulative: numOrNull_(x.items[id].cumulative) };
    });
    return { code: text_(x.amp_code), sourceCode: text_(x.code), name: text_(x.name), status: text_(x.status) || 'none',
      counted: !!x.counted, late: !!x.late, items: values };
  });
  const series = (ts.series || []).map(function (r) {
    const values = {};
    Object.keys(r.values || {}).forEach(function (id) {
      values[id] = { week: numOrNull_(r.values[id].week), cumulative: numOrNull_(r.values[id].cumulative) };
    });
    return { round: Number(r.round) || 0, label: text_(r.label), start: text_(r.start), end: text_(r.end), reported: Number(r.reported) || 0, values: values };
  });
  const round = s.round || {};
  return {
    ok: true,
    configured: true,
    source: { name: text_(meta.site) || 'KPP Smart Agri-Materials', office: text_(meta.office), title: text_(meta.title), season: text_(meta.season) },
    generatedAt: text_(summaryBody.generated_at),
    round: { round: Number(round.round) || 0, label: text_(round.label), start: text_(round.start), end: text_(round.end), due: text_(round.due) },
    districtsTotal: Number(s.districts_total) || byDistrict.length,
    reportedCount: s.reported ? Number(s.reported.count) || 0 : 0,
    statusCounts: s.status_counts || {},
    items: items,
    byDistrict: byDistrict,
    series: series
  };
}

function numOrNull_(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/** Run from the editor after setting SMART_AGRI_API_KEY to confirm the connection. */
function verifySmartAgriConnection() {
  CacheService.getScriptCache().remove(SMART_AGRI_CACHE_KEY);
  const r = fetchSmartAgriReports_();
  if (!r.ok) return (r.configured ? 'FAIL: ' : 'INFO: ') + r.error;
  return 'PASS: Smart Agri-Materials — round ' + r.round.round + ' (' + r.round.label + '), ' + r.reportedCount + '/' +
    r.districtsTotal + ' district(s) reported, ' + r.items.length + ' indicator(s)';
}

/** Saves change the dashboard immediately instead of waiting for the cache to expire. */
function invalidateSummary_() {
  try { CacheService.getScriptCache().remove(SUMMARY_CACHE_KEY); } catch (err) { /* best effort */ }
}

/** Run from the editor after deployment to preview the public summary. */
function verifyPublicSummary() {
  const s = buildPublicSummary_(new Date());
  return 'PASS: summary ' + APP_VERSION + ' — ' + s.totals.farmerPlots + ' plot(s), ' + s.totals.areaRai + ' rai, ' +
    s.totals.buyers + ' buyer(s), ' + s.totals.districtsCovered + '/' + s.totals.districtsTotal + ' district(s) covered';
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function sheet_(kind) {
  if (kind !== 'settings') throw new Error('ชีต ' + kind + ' อยู่ที่ Green Gain Hub (อ่านผ่าน gghRows_)');
  const name = PropertiesService.getScriptProperties().getProperty('SETTINGS_SHEET') || 'Config';
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต ' + name);
  return sh;
}

function dataRows_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function findIdRow_(sh, id) {
  const values = dataRows_(sh);
  for (let i = 0; i < values.length; i++) {
    if (text_(values[i][0]) === id) return i + 2;
  }
  return 0;
}

function setting_(key, fallback) {
  try {
    const sh = sheet_('settings');
    if (sh.getLastRow() < 2) return fallback;
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    const found = rows.find(function (r) { return String(r[0]).trim() === key; });
    return found ? found[1] : fallback;
  } catch (err) {
    return fallback;
  }
}

function sessionTtlSeconds_() {
  const seconds = Number(setting_('SESSION_TTL_SECONDS', DEFAULT_SESSION_TTL_SECONDS));
  return isFinite(seconds) && seconds >= 300 && seconds <= 21600 ? Math.floor(seconds) : DEFAULT_SESSION_TTL_SECONDS;
}

function validateMaterial_(type, other) {
  type = cleanText_(type, 80);
  other = cleanText_(other, 150);
  // Backward-compatible: an old free-text material becomes “อื่นๆ”.
  if (MATERIAL_TYPES.indexOf(type) < 0 && type) { other = type; type = 'อื่นๆ'; }
  if (MATERIAL_TYPES.indexOf(type) < 0) throw new Error('กรุณาเลือกชนิดวัสดุเหลือใช้ทางการเกษตร');
  if (type === 'อื่นๆ' && !other) throw new Error('กรุณาระบุชนิดวัสดุเหลือใช้ทางการเกษตรอื่นๆ');
  if (type !== 'อื่นๆ') other = '';
  return { type: type, other: other, resolved: type === 'อื่นๆ' ? other : type };
}

/**
 * Known crops always determine their residue type on the server. This prevents
 * stale Frontends or edited requests from saving an inconsistent combination.
 * "อื่นๆ" remains available for crops that are not in the fixed crop list.
 */
function farmerMaterialForCrop_(crop, requestedType, requestedOther) {
  const automaticType = CROP_MATERIAL_MAP[cleanText_(crop, 150)];
  return automaticType
    ? { type: automaticType, other: '', resolved: automaticType }
    : validateMaterial_(requestedType, requestedOther);
}

function resolvedMaterial_(type, other, fallback) {
  type = text_(type);
  other = text_(other);
  return type === 'อื่นๆ' ? (other || text_(fallback)) : (type || text_(fallback));
}

function parseDate_(value, label) {
  if (value === '' || value === null || value === undefined) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(label + 'ไม่ถูกต้อง');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    throw new Error(label + 'ไม่ถูกต้อง');
  }
  return d;
}

function toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (!v) return null;
  const value = String(v).trim();
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  let year, month, day;
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  }
  if (year > 2400) year -= 543;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function numberInRange_(v, min, max, label) {
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) throw new Error(label + 'ไม่ถูกต้อง');
  return n;
}

function nonNegative_(v, label) {
  const n = Number(v);
  if (!isFinite(n) || n < 0) throw new Error(label + 'ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  return n;
}

function maybeNumber_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isFinite(n) ? n : '';
}

function hasCoordinates_(lat, lng) {
  if (lat === '' || lat === null || lat === undefined || lng === '' || lng === null || lng === undefined) return false;
  const a = Number(lat), b = Number(lng);
  return isFinite(a) && isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180;
}

function requireFields_(row, fields) {
  fields.forEach(function (f) { if (row[f[0]] === '') throw new Error('กรุณากรอก' + f[1]); });
}

function normalizeRole_(v) {
  const role = String(v || '').trim().toLowerCase();
  if (role !== 'farmer' && role !== 'buyer') throw new Error('บทบาทไม่ถูกต้อง');
  return role;
}

function normalizePhone_(v) {
  const digits = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  // A numeric Sheet cell may drop the leading zero from a Thai mobile number.
  return /^\d{9}$/.test(digits) ? '0' + digits : digits;
}

function displayPhone_(v) {
  const phone = normalizePhone_(v);
  return /^0\d{9}$/.test(phone) ? phone : text_(v);
}

function normalizeContactPhone_(v) {
  const phone = normalizePhone_(v);
  if (!/^0\d{9}$/.test(phone)) throw new Error('หมายเลขโทรศัพท์ต้องมี 10 หลัก');
  return phone;
}

function newId_() {
  return String(new Date().getTime()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function cleanText_(v, max) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, max || 500);
}

function text_(v) { return cleanText_(v, 500); }

function dateInput_(v) {
  const d = toDate_(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function dateTime_(v) {
  const d = toDate_(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : text_(v);
}

function publicError_(err) {
  const msg = String(err && err.message || err || 'เกิดข้อผิดพลาด');
  if (msg === 'SESSION_EXPIRED') return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
  if (msg === 'ADMIN_SESSION_EXPIRED') return 'ADMIN_SESSION_EXPIRED';
  return cleanText_(msg, 300) || 'เกิดข้อผิดพลาด';
}

/* ------------------------------------------------------------------------- *
 * Setup — run once from the editor after pasting the code (and after each upgrade).
 * ------------------------------------------------------------------------- */
function setupSystem() {
  const lines = [];
  const step = function (label, fn) {
    try { lines.push(String(fn())); } catch (err) { lines.push('FAIL: ' + label + ' — ' + (err && err.message || err)); }
  };
  step('settings', ensureSettingsSheet_);
  step('admins', ensureAdminSchema_);
  step('crops', ensureCropSchema_);
  step('super admin', ensureSuperAdmin_);
  step('visits', ensureVisitSchema_);
  step('ghg', ensureGhgSchema_);
  step('residue', ensureResidueSchema_);
  step('ggh link', gghLink_);
  invalidateCropSummary_();
  invalidateSummary_();
  step('ggh feed', verifyGghFeed);
  step('summary', verifyPublicSummary);
  step('smart agri', verifySmartAgriConnection);
  const out = lines.join('\n');
  console.log(out);
  return out;
}

/** Config sheet (Parameter, Value, Unit, Description) — created when the database is new. */
function ensureSettingsSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName('Config');
  if (!sh) {
    sh = ss.insertSheet('Config');
    sh.getRange(1, 1, 1, 4).setValues([['Parameter', 'Value', 'Unit', 'Description']]);
    sh.setFrozenRows(1);
  }
  return 'PASS: Config sheet is ready';
}

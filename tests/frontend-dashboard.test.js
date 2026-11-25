/* ABM 1.0.0 frontend: the homepage is the executive dashboard (from Green Gain Hub 2.5.0 #performance) with the officer
   sign-in popup; the officer pages (admin.html) are unchanged apart from the name and the Green Gain Hub feed card. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(value, message) { if (!value) throw new Error(message); }
const front = path.join(__dirname, '..', 'frontend');
const read = (f) => fs.readFileSync(path.join(front, f), 'utf8');
const html = read('index.html');
const js = read('assets/dashboard.js');
const css = read('assets/dashboard.css');
const admin = read('admin.html');
const adminJs = read('assets/admin.js');
const adminCss = read('assets/admin.css');
const sso = read('assets/sso-client.js');
const staffAuth = read('assets/staff-auth.js');
const config = read('assets/config.js');
const geo = JSON.parse(read('assets/kpp-districts.geojson'));
[['dashboard.js', js], ['admin.js', adminJs], ['sso-client.js', sso], ['staff-auth.js', staffAuth], ['config.js', config]].forEach(([n, s]) => new vm.Script(s, { filename: n }));
const inline = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
new vm.Script(inline, { filename: 'index.html inline' });

/* ---------- homepage = dashboard + officer popup; no farmer/buyer app here ---------- */
assert(/<div id="dashPage" class="ggh-landing" data-tab="overview">/.test(html) && !html.includes('id="loginPage"'), 'dashboard is the visible homepage');
['id="marketPage"', 'id="hubAuth"', 'id="mainApp"', 'id="loginPhone"', 'pdpaCheck', 'data-role="farmer"', 'data-role="buyer"', 'market.js', 'api-client.js', 'sweetalert2', 'registerServer', 'ssoLoginServer']
  .forEach((x) => assert(!html.includes(x), 'farmer/buyer app must stay in Green Gain Hub: ' + x));
assert((html.match(/<dialog class="ggh-dialog"/g) || []).length === 1 && html.includes('id="staffAuth"') && html.includes('data-door="staff"'), 'one dialog: officers');
assert(html.includes('admin.html#admin') && !/type="password"/.test(html), 'Super/Mini link; the officer popup has no password field');
assert(/abm-brand-title[^>]*>ระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร</.test(html) && html.includes('Agri By-product Management') && /<title>ระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร/.test(html), 'system name (1.5.0)');
assert(/abm-brand-title[^>]*>ระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร</.test(admin) && admin.includes('class="abm-topbar adm-top"') && admin.includes('id="admHome"') && html.includes('<header class="abm-topbar">'), '1.5.0: one top bar on both pages, home button on the officer page');
assert(!/เศษวัสดุ/.test(html + admin + js + adminJs), 'wording: วัสดุเหลือใช้ทางการเกษตร (not เศษวัสดุ)');
assert(/class="abm-topbtn" data-ggh-link[^>]*>[\s\S]*?ตลาด Green Gain Hub/.test(html) && /abm-topnav[\s\S]*data-door="staff"/.test(html) && /<footer[\s\S]*data-ggh-link/.test(html) && inline.includes('ABM_CONFIG.GGH_URL'), 'links to the Green Gain Hub market (URL from config)');
assert(/#staff/.test(inline) && /staff-register/.test(inline) && !/sell: \['register'/.test(inline), 'shareable #staff links only');
['id="dashMap"', 'id="dashKpis"', 'id="dashHarvest"', 'id="dashMaterials"', 'id="dashTable"', 'id="dashDistrict"', 'id="dashDistrictSel"', 'role="tablist"',
  'data-tab="overview"', 'data-tab="crops"', 'data-tab="market"', 'id="dashCropMonths"', 'id="dashCropStack"', 'id="dashAsOf"', 'id="resCropIcons"', 'id="resMethods"', 'id="resFy"',
  'id="resBalance"', 'id="sarWrap"', 'id="resMethodNote"', 'id="visitCounter"'].forEach((s) => assert(html.includes(s), 'dashboard markup missing: ' + s));
assert(html.includes('assets/dashboard.js?v=1.5.0') && html.includes('assets/dashboard.css?v=1.5.0') && html.indexOf('assets/config.js') < html.indexOf('assets/dashboard.js'), 'assets 1.5.0, config first');
assert(!html.includes('ggh-hero') && !html.includes('ggh-goal"') && html.indexOf('ggh-resmethods-top') > html.indexOf('ggh-kpis-wrap') && html.indexOf('ggh-resmethods-top') < html.indexOf('ggh-mapcard'), '1.5.0: no hero card, types row between the figures and the map');
assert(js.includes('state.resMethod') && js.includes('function balanceScope()') && js.includes('function targetPct(code)') && js.includes('คิดเป็นมูลค่า') && js.includes('ปริมาณชีวมวลที่จัดการได้'), '1.5.0: type cards filter the page; the balance bar follows the filters');
const KPP = 'https://krit-pj.github.io/TH-Agri-Risk-Maps-Burning/js/kpp-id.js';
[html, admin].forEach((h, i) => assert(h.indexOf(KPP) > 0 && h.indexOf(KPP) < h.indexOf('assets/sso-client.js') && h.indexOf('assets/sso-client.js') < h.indexOf('assets/staff-auth.js'), 'kpp-id.js → sso-client.js → staff-auth.js order in ' + (i ? 'admin' : 'index')));
assert(css.includes('.abm-topbar { position: sticky') && css.includes('.abm-topbar-in { max-width: 84rem'), 'sticky top bar, page width');
assert(html.includes('<option value="">ทุกอำเภอ</option>') && js.includes(`'<option value="">ทุกอำเภอ</option>'`), 'ทุกอำเภอ');
console.log('PASS: ABM homepage — executive dashboard + officer popup, no market app, links to Green Gain Hub');

/* ---------- dashboard script ---------- */
assert(js.includes("api: 'v1', endpoint: 'summary'") && js.includes("endpoint: 'crop'") && js.includes("endpoint: 'residue'") && js.includes("endpoint: 'balance'"), 'dashboard endpoints');
assert(!/getMatchingDataServer|\.phone\b|\.lat\b|\.lng\b/.test(js), 'dashboard must not touch personal or plot-level data');
assert(!js.includes('marketPage') && !js.includes('#performance') && js.includes("$('dashPage')"), 'no Green Gain Hub page routing left');
assert(js.includes('marketFreshness') && js.includes('summary.market'), 'market tab says when Green Gain Hub data is unavailable or stale');
assert(js.includes("const TABS = ['overview', 'crops', 'market']") && js.includes("if (tab === 'reports') { tab = 'overview'"), 'three tabs; old #reports links land on ผลการจัดการ');
assert(js.includes("'abm_visit_counted'") && js.includes("counted ? 'visits' : 'hit'") && js.includes("'abm_summary_v1_6'") && js.includes("'abm_residue_v2'"), 'own storage keys (shared github.io origin with Green Gain Hub)');
assert(!/tCO₂e|tCO2e/.test(html + js + admin + adminJs) && js.includes('ตันคาร์บอนไดออกไซด์เทียบเท่า'), 'Thai GHG unit');
const pctSrc = js.match(/function pctText\(p\) \{[\s\S]*?\n  \}/)[0];
const fmtSrc = js.match(/function fmt\(n, digits\) \{[\s\S]*?\n  \}/)[0];
const pctText = new Function(fmtSrc + pctSrc + 'return pctText;')();
assert(pctText(35 / 70500 * 100) === '0.05%' && pctText(0) === '0%' && pctText(5.26) === '5.3%' && pctText(42.4) === '42%' && pctText(null) === '–', 'pctText');
assert(geo.features.length === 11 && geo.features.every((f) => f.properties.code.startsWith('62')) && /CC BY 4\.0/.test(geo.attribution) && /CC BY 4\.0/.test(js), '11 districts with attribution');
assert(css.includes('prefers-reduced-motion'), 'reduced-motion rule');
console.log('PASS: dashboard — aggregate endpoints only, market freshness, own storage keys, Thai units');

/* ---------- officer pages (unchanged features) ---------- */
assert(/id="fileInput"[^>]*disabled/.test(admin) && admin.indexOf('assets/config.js') < admin.indexOf('assets/admin.js') && admin.includes('assets/crop-import.js'), 'crop import page');
assert(adminJs.includes("method: 'POST'") && !/localStorage/.test(adminJs) && /noindex/.test(admin), 'POST API, token not in localStorage, noindex');
assert(admin.includes('data-panel="reports"') && admin.includes('id="reportPrint"') && admin.includes('id="reportXlsx"') && admin.includes('id="reportCsv"') && adminJs.includes("'\\ufeff'") && adminJs.includes('ABM_report_'), 'reports');
assert(admin.includes('id="recForm"') && admin.includes('capture="environment"') && admin.includes('name="confirmed"') && admin.includes('id="recGpsBtn"') && admin.includes('id="recBuyer"') && admin.includes('name="soldTonnes"'), 'recording form');
assert(admin.includes('value="mini"') && admin.includes('id="adminDistrict"') && admin.includes('id="reportTypes"') && admin.includes('id="staffLoginForm"') && admin.includes('id="staffRegForm"'), 'roles, report types, officer sign-in');
assert(adminJs.includes("record: 'บันทึกวัสดุเหลือใช้ทางการเกษตร', records: 'สรุปผลการส่งเสริม'") && adminJs.includes("reports: 'ออกรายงาน'") && admin.includes('id="recReview"') && (admin.match(/class="adm-step-n"/g) || []).length === 4, '1.5.0: menu names, four-step form with a review box');
assert(/admin: \[\{ key: 'record'[\s\S]*?\{ key: 'account'/.test(adminJs) && (adminJs.match(/\{ key: '(overview|data|reports|users|settings)', label/g) || []).length === 5, 'Admin 4 items, Mini/Super 5 groups');
assert(adminJs.includes('const headLabel') && adminCss.includes('.adm-th-unit') && /sections\.some\(\(x\) => x\.landscape\) \? 'landscape' : 'portrait'/.test(adminJs), 'print: two-line headers, one orientation');
assert(admin.includes('id="gghTestBtn"') && adminJs.includes("call('gghTestServer')") && adminJs.includes('s.ggh.linked'), 'settings: Green Gain Hub feed status and test');
assert(/<title>สำหรับเจ้าหน้าที่ · ระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร/.test(admin) && admin.includes('https://krit-pj.github.io/Green_Gain_Hub-KPP/'), 'officer page name and market link');
console.log('PASS: officer pages — records, reports, roles, print, Green Gain Hub feed card');

/* ---------- SSO (officers, aud ABM) and config ---------- */
assert(sso.includes("const AUD = 'ABM'") && !sso.includes("'GGH'") && sso.includes('ticketFrom') && sso.includes('function warm()') && !/market\(/.test(sso), 'officer-only SSO client for ABM');
assert(/S\.staff\(p, call\)/.test(staffAuth) && /ssoAuto/.test(staffAuth) && /S\.registerTicket\(input\)/.test(staffAuth) && staffAuth.includes("'abm_admin_token'") && staffAuth.includes("'abm_sso_prev'"), 'officer sign-in/registration through SSO; own session keys');
assert(/showSsoPrev/.test(adminJs) && /ABM_SSO\.logout\(\)/.test(adminJs) && /ssoAuto\(\)/.test(adminJs) && adminJs.includes("'abm_admin_token'"), 'officer pages: previous sign-in notice, logout everywhere, auto sign-in');
const cfg = {}; new vm.Script(config).runInNewContext({ window: cfg });
assert(cfg.ABM_CONFIG && cfg.ABM_CONFIG.GGH_URL === 'https://krit-pj.github.io/Green_Gain_Hub-KPP/' && cfg.ABM_CONFIG.SPREADSHEET_ID === '1wTzRcRx3sCoUZD9ykFgl17WOGVw9BtVkVwqtAftyVU4' && cfg.ABM_CONFIG.BUILD_VERSION === '1.5.0', 'config');
assert(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.ABM_CONFIG.SHEETS_API_URL) && !cfg.ABM_CONFIG.SHEETS_API_URL.includes('AKfycbylUG') && !cfg.ABM_CONFIG.SHEETS_API_URL.includes('AKfycbxoo4'), 'config points at the ABM web app (not Green Gain Hub or Smart Agri): ' + cfg.ABM_CONFIG.SHEETS_API_URL);
console.log('PASS: SSO for officers (aud ABM) and config');

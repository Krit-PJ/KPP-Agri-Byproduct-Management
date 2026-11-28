/* ABM 1.8.0 biomass per rai = อัตราชีวมวลต่อผลผลิต × ผลผลิตเฉลี่ย (สกว., province FY 2570 document), GHG from the same biomass,
   one-time switch with history, spreadsheet import (preview → apply) and restore of an earlier set. */
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const env = load({ migrateBiomass: true, sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' } });
const { post, sheets, props } = env;
const ok = (r, m) => { assert(r.ok, m + ': ' + r.error); return r.result; };
const bad = (r, re, m) => { n++; assert(!r.ok && re.test(r.error), m + ': ' + JSON.stringify(r)); };
console.log = () => {};
env.api.setupSystem();
const T = ok(post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]), 'super').token;

/* 1. the one-time switch runs on the first read: สกว. values, residue mode, history kept */
let s = ok(post('ghgSettingsServer', [], T), 'settings');
const c = Object.fromEntries(s.crops.map((x) => [x.key, x]));
check(c.rice.biomassMethod === 'rpr' && c.rice.rpr === 1.522 && c.rice.yieldTRai === 0.613 && near(c.rice.residueTRai, 0.933), 'rice 1.522 × 0.613 = 0.933: ' + JSON.stringify(c.rice));
check(near(c.sugarcane.residueTRai, 1.4911) && c.sugarcane.residueName === 'ยอดและใบอ้อย', 'cane 0.153 × 9.746 = 1.491');
check(near(c.maize.residueTRai, 1.0234), 'maize 1.245 × 0.822 = 1.023');
check(c.cassava.biomassMethod === 'fixed' && c.cassava.residueTRai === null && c.rice.dmf === 1, 'cassava untouched, dry share 1.0');
check(s.params.DEFAULT_MODE === 'residue' && s.params.PARAM_VERSION === 2 && /สกว\./.test(c.rice.residueReference), 'GHG from the same biomass (residue mode), new set');
check(props.GHG_BIOMASS_V180 && s.history.length === 1 && s.history[0].action === 'ghg_biomass_v180', 'one history row with the values before');
check(sheets.admin_log.rows.some((r) => r[4] === 'ghg_biomass_v180'), 'switch written to admin_log');
ok(post('ghgSettingsServer', [], T), 'settings again');
check(ok(post('ghgSettingsServer', [], T), 'x').history.length === 1, 'the switch runs once');

/* 2. a record: biomass and GHG from the same base */
env.officer({ name: 'วิชัย เกษตรอำเภอ', phone: '0833333333', officeType: 'district', district: '6204', province: 'กำแพงเพชร' });
const D = ok(post('staffLoginServer', [{ phone: '0833333333' }]), 'officer').token;
const photo = [{ name: 'a.jpg', mime: 'image/jpeg', data: '/9j/4AAQ' }];
const rec = ok(post('residueSaveServer', [{ date: '2026-11-10', photos: photo, confirmed: true, subdistrict: '620403', crop: 'rice', method: 'อัดฟางก้อน', area: 35 }], D), 'record').record;
const ef = 2.7 * 28 + 0.07 * 265;
check(near(rec.tonnes, 35 * 0.933, 0.01) && near(rec.value, 35 * 0.933 * 800, 0.5), 'tonnes 32.66 and value 26,124: ' + JSON.stringify([rec.tonnes, rec.value]));
check(near(rec.ghg, 35 * 933 * 0.8 * ef / 1e6, 1e-3), 'GHG = 35 × 933 kg × Cf 0.8 × 94.15 / 1e6 = 2.46: ' + rec.ghg);

/* 3. edit one crop: dry share and method */
const rice = s.crops.find((x) => x.key === 'rice');
const base = { key: 'rice', name: 'ข้าว', consumedTHa: rice.consumedTHa, cf: 0.8, residueName: 'ฟางข้าว', residueReference: 'ทดสอบ', reference: rice.reference, active: true, sortOrder: 1 };
bad(post('ghgCropSaveServer', [{ ...base, biomassMethod: 'rpr', rpr: 1.5 }], T), /ทั้งอัตรา/, 'rpr needs both numbers');
bad(post('ghgCropSaveServer', [{ ...base, biomassMethod: 'rpr', rpr: 1.5, yieldTRai: 0.6, dmf: 1.4 }], T), /0–1/, 'dry share 0–1');
s = ok(post('ghgCropSaveServer', [{ ...base, biomassMethod: 'rpr', rpr: 1.5, yieldTRai: 0.6, dmf: 0.85 }], T), 'save rice').settings;
const r2 = s.crops.find((x) => x.key === 'rice');
check(near(r2.residueTRai, 0.9) && r2.dmf === 0.85 && s.history.length === 2, 'saved 1.5 × 0.6 = 0.9, DMF 0.85, history kept');
const smp = s.sample100.find((x) => x.key === 'rice');
check(near(smp.residue, 100 * 900 * 0.85 * 0.8 * ef / 1e6, 1e-3) && smp.biomass100 === 90, 'sample 100 rai uses the dry share');

/* 4. import: preview → apply; the attached file's labels map to crops */
const rows = [{ label: 'ฟางข้าว', rpr: 1.522, yieldTRai: 0.613 }, { label: 'ยอดและใบอ้อย', rpr: '0.153', yieldTRai: '9.746' }, { label: 'ต้น ยอด ใบ ข้าวโพด', rpr: 1.245, yieldTRai: 0.822 }, { label: 'ทุเรียน', rpr: 1, yieldTRai: 1 }];
bad(post('ghgImportServer', [{ rows: rows.slice(0, 1) }], D), /Mini Super Admin/, 'officers cannot import');
const pv = ok(post('ghgImportServer', [{ rows, reference: 'สกว. (ไฟล์ทดสอบ)' }], T), 'preview');
check(pv.status === 'preview' && pv.ready === 3 && pv.rows.map((x) => x.key).join() === 'rice,sugarcane,maize,' && /ไม่รู้จัก/.test(pv.rows[3].error), 'labels mapped, unknown flagged: ' + JSON.stringify(pv.rows.map((x) => [x.label, x.key, x.error])));
check(near(pv.rows[0].before, 0.9) && near(pv.rows[0].residueTRai, 0.933), 'preview shows before and after');
check(ok(post('ghgSettingsServer', [], T), 'x').history.length === 2, 'preview changes nothing');
const ap = ok(post('ghgImportServer', [{ rows, reference: 'สกว. (ไฟล์ทดสอบ)', apply: true, fileName: 'เป้าหมาย 2570.xlsx' }], T), 'apply');
check(/3 ชนิดพืช/.test(ap.message) && near(ap.settings.crops.find((x) => x.key === 'rice').residueTRai, 0.933) && ap.settings.history.length === 3, 'applied as one change with one history row');
bad(post('ghgImportServer', [{ rows: [rows[0], rows[0]], reference: 'x', apply: true }], T), /ซ้ำ/, 'duplicate crop refused');

/* 5. restore an earlier set */
const before = ap.settings.history.find((h) => h.action === 'ghg_crop_save').version;
const rs = ok(post('ghgRestoreServer', [{ version: before }], T), 'restore');
const rr = rs.settings.crops.find((x) => x.key === 'rice');
check(near(rr.residueTRai, 0.933) && rr.dmf === 1, 'restored the values kept before the rice edit (0.933, DMF 1)');
check(rs.settings.history[0].action === 'ghg_restore' && rs.settings.params.PARAM_VERSION > s.params.PARAM_VERSION, 'restore keeps the current set first and raises the set number');
bad(post('ghgRestoreServer', [{ version: 999 }], T), /ไม่พบ/, 'unknown set');
console.info(`PASS: ${n} checks — biomass สกว. (อัตรา × ผลผลิต), GHG from the same biomass, import, history, restore`);

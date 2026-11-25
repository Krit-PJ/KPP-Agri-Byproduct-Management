/* ABM 1.3.0: executive report from Green Gain Hub (abm_report). 1.3.1: the Green Gain Hub PIN reset is removed.
   Facts are labelled apart from estimates; costs are not collected; no names or phones; Super Admin alone picks the province. */
const fs = require('fs'), path = require('path');
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };
const env = load({ sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' } });
const { post, sheets, feed } = env;
const log = console.log; console.log = () => {}; env.api.setupSystem(); console.log = log;

const T = post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]).result.token;
const D = env.officer({ name: 'สมชาย ใจดี', phone: '0812345678', officeType: 'district', district: '6204', province: 'กำแพงเพชร' }).result.token;
check(post('adminSaveServer', [{ username: 'mini1', name: 'มินิ หนึ่ง', role: 'mini', password: 'Mini12345' }], T).ok, 'mini created');
const M = post('adminLoginServer', [{ username: 'mini1', password: 'Mini12345' }]).result.token;

const NOTES = { facts: 'F', estimates: 'E', costs: 'ระบบไม่เก็บต้นทุน', sales: 'S' };
feed.report = (body) => {
  const all = body.province === 'ALL';
  return {
    apiVersion: '3.2.0', generatedAt: '2026-11-25T03:00:00.000Z',
    scope: { code: body.province, name: all ? 'ทุกจังหวัด' : body.province === '62' ? 'กำแพงเพชร' : 'เชียงใหม่', by: all ? 'province' : 'district' },
    listing: { hideAfterHarvestDays: 20 },
    summary: { usersFarmers: 9, usersBuyers: 3, farmers: 7, plots: 16, areaRai: 284, ton: 170.4, buyers: 3, capacityTonPerDay: 40, potentialBaht: 85200,
      salesCount: 2, salesFarmers: 2, salesTon: 12.5, salesBaht: 15000, salesAreaRai: 30, provincesActive: all ? 2 : null },
    areas: [{ code: '6201', name: 'เมืองกำแพงเพชร', farmers: 4, plots: 10, areaRai: 200, ton: 120, buyers: 2, capacityTonPerDay: 30, potentialBaht: 60000, salesCount: 2, salesFarmers: 2, salesTon: 12.5, salesBaht: 15000, salesAreaRai: 30 },
      { code: '6204', name: 'ขาณุวรลักษบุรี', farmers: 3, plots: 6, areaRai: 84, ton: 50.4, buyers: 1, capacityTonPerDay: 10, potentialBaht: 25200, salesCount: 0, salesFarmers: 0, salesTon: 0, salesBaht: 0, salesAreaRai: 0 }],
    materials: [{ code: 'straw', name: 'ฟางข้าว', plots: 16, areaRai: 284, ton: 170.4, buyers: 3, avgPriceBahtPerRai: 300, potentialBaht: 85200, salesTon: 12.5, salesBaht: 15000 },
      { code: 'cob', name: 'ซังข้าวโพด', plots: 0, areaRai: 0, ton: 0, buyers: 0, avgPriceBahtPerRai: null, potentialBaht: 0, salesTon: 0, salesBaht: 0 }],
    harvest: [{ month: 'done', plots: 2, areaRai: 20, ton: 12 }, { month: '2026-12', plots: 14, areaRai: 264, ton: 158.4 }],
    sales: [{ date: '2026-11-20', area: 'เมืองกำแพงเพชร', material: 'ฟางข้าว', areaRai: 20, ton: 10, baht: 12000, bahtPerTon: 1200 }],
    notes: NOTES
  };
};

/* catalog: the executive type is offered to every officer; only Super Admin may choose the province */
let c = post('reportCatalogServer', [], T).result;
check(c.types.some((t) => t.key === 'executive' && t.sections.join() === 'ggh.summary,ggh.areas,ggh.materials,ggh.harvest,ggh.sales'), 'executive type listed');
check(c.ggh.provinceChoice === true && c.ggh.province === '62', 'Super Admin may choose the province');
c = post('reportCatalogServer', [], D).result;
check(c.types.some((t) => t.key === 'executive') && c.ggh.provinceChoice === false, 'district recorder: executive report, Kamphaeng Phet only');

const SECTIONS = ['ggh.summary', 'ggh.areas', 'ggh.materials', 'ggh.harvest', 'ggh.sales'];
let r = post('reportDataServer', [{ sections: SECTIONS }], T);
check(r.ok && feed.posts.at(-1).action === 'abm_report' && feed.posts.at(-1).province === '62' && feed.posts.at(-1).key === 'test-feed-key', 'default province 62 sent with the feed key');
const sec = (k) => r.result.sections.find((x) => x.key === k);
const sum = sec('ggh.summary');
check(sum.rows.find((x) => /รายได้จากการขายจริง/.test(x.item)).value === 15000 && sum.rows.find((x) => /รายได้จากการขายจริง/.test(x.item)).kind === 'ข้อมูลจริง', 'real income labelled as fact');
check(sum.rows.find((x) => /มูลค่าที่เป็นไปได้/.test(x.item)).kind === 'ประมาณการ' && sum.rows.find((x) => /ชีวมวล/.test(x.item)).kind === 'ประมาณการ', 'potential value and biomass labelled as estimates');
check(sum.notes.some((x) => /ไม่เก็บต้นทุน/.test(x)), 'note: costs are not collected');
check(!sum.rows.some((x) => /จังหวัดที่มีการใช้งาน/.test(x.item)), 'one province: no provinces-active row');
const areas = sec('ggh.areas');
check(areas.columns[0].label === 'อำเภอ' && areas.rows.length === 2 && areas.totals.area === 284 && areas.totals.farmers === 7 && areas.totals.salesBaht === 15000, 'by district with totals (distinct farmers)');
check(sec('ggh.materials').rows.find((x) => x.material === 'ซังข้าวโพด').price === '', 'no offer price → blank, not 0');
check(sec('ggh.harvest').rows[0].month.indexOf('เลยวันเก็บเกี่ยว') === 0 && sec('ggh.harvest').rows[1].month === 'ธ.ค. 2569', 'harvest months in Thai');
const sales = sec('ggh.sales');
check(sales.rows.length === 1 && sales.totals.baht === 15000, 'real sales listed');
check(!JSON.stringify(r.result.sections).match(/0\d{2}-?\d{3}-?\d{4}|08\d{8}/), 'no phone numbers anywhere');
check(r.result.ggh && r.result.ggh.scope.name === 'กำแพงเพชร', 'report says which province');
check(sheets.admin_log.rows.some((x) => x[4] === 'report_view' && /ggh\.summary/.test(x[5]) && /GGH กำแพงเพชร/.test(x[5])), 'view logged with the province');

/* province choice: Super Admin may pick ALL or another province; others are always 62 */
r = post('reportDataServer', [{ sections: SECTIONS, gghProvince: 'ALL' }], T);
check(r.ok && feed.posts.at(-1).province === 'ALL' && r.result.sections[1].columns[0].label === 'จังหวัด', 'Super Admin: all provinces, by province');
check(r.result.sections[0].rows.some((x) => /จังหวัดที่มีการใช้งาน/.test(x.item)), 'all provinces: provinces-active row');
r = post('reportDataServer', [{ sections: ['ggh.summary'], gghProvince: '50' }], T);
check(r.ok && feed.posts.at(-1).province === '50', 'Super Admin: another province');
check(!post('reportDataServer', [{ sections: ['ggh.summary'], gghProvince: 'x1' }], T).ok, 'bad province refused');
r = post('reportDataServer', [{ sections: ['ggh.summary'], gghProvince: 'ALL' }], M);
check(r.ok && r.result.ggh.scope.code === '62', 'Mini Super Admin: always 62');
r = post('reportDataServer', [{ sections: SECTIONS, gghProvince: '50' }], D);
check(r.ok && r.result.ggh.scope.code === '62', 'district recorder: always 62');

/* cached: a second report within 5 minutes does not ask Green Gain Hub again */
const before = feed.posts.length;
check(post('reportDataServer', [{ sections: ['ggh.summary'] }], T).ok && feed.posts.length === before, 'cached for 5 minutes');

/* Green Gain Hub older than 3.2.0 / unreachable → the section says why, other sections still work */
const keep = feed.report; feed.report = null;
r = post('reportDataServer', [{ sections: ['ggh.summary', 'visits.monthly'], gghProvince: '10' }], T);
check(r.ok && /ยังอ่านข้อมูลจาก Green Gain Hub ไม่ได้/.test(r.result.sections[0].rows[0].message) && r.result.sections[1].key === 'visits.monthly', 'GGH unavailable → note, report still built');
feed.report = keep;

/* 1.3.1: the Green Gain Hub PIN reset is gone (Green Gain Hub 3.3.0 signs in by phone number only) */
check(!post('gghPinResetServer', [{ phone: '0891234567' }], T).ok, 'no PIN reset RPC, even for Super Admin');
check(!fs.readFileSync(path.join(__dirname, '..', 'frontend', 'admin.html'), 'utf8').includes('gghPinForm'), 'no PIN reset form');

console.log(`exec-report.test.js: ${n} checks passed`);

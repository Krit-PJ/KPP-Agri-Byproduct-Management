/* ABM 1.1.0 → 1.4.0: how long a plot stays on the Green Gain Hub market after harvest — read from Green Gain Hub, set there (4.0.0). */
const fs = require('fs'), path = require('path');
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };
const env = load({ sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' } });
const { post, sheets, api, feed } = env;
const log = console.log; console.log = () => {}; api.setupSystem(); console.log = log;

const T = post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]).result.token;
const D = env.officer({ name: 'สมชาย ใจดี', phone: '0812345678', officeType: 'district', district: '6204', province: 'กำแพงเพชร' }).result.token;

/* read the current rule from Green Gain Hub */
let r = post('gghMarketRuleServer', [], T);
check(r.ok && r.result.rule.hideAfterHarvestDays === 20 && feed.posts.at(-1).action === 'abm_config' && feed.posts.at(-1).hideAfterHarvestDays === undefined, 'read the rule (no change sent)');

/* 1.4.0: set in Green Gain Hub 4.0.0 by its Super Admin — ABM only shows it */
check(post('adminSaveServer', [{ username: 'mini1', name: 'มินิ หนึ่ง', role: 'mini', password: 'Mini12345' }], T).ok, 'mini created');
const M = post('adminLoginServer', [{ username: 'mini1', password: 'Mini12345' }]).result.token;
check(post('gghMarketRuleServer', [], M).ok, 'Mini Super Admin can read the rule');
check(!post('gghMarketRuleServer', [], D).ok, 'Admin (recorder) cannot read it here');
const before = feed.posts.length;
check(!post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: 10 }], T).ok && feed.posts.length === before, 'no save method — not even Super Admin (nothing sent to Green Gain Hub)');
const front = path.join(__dirname, '..', 'frontend');
const html = fs.readFileSync(path.join(front, 'admin.html'), 'utf8'), js = fs.readFileSync(path.join(front, 'assets', 'admin.js'), 'utf8');
check(html.includes('data-panel="market"') && html.includes('id="gghRuleStatus"') && !html.includes('name="hideAfterHarvestDays"') && html.includes('Green_Gain_Hub-KPP/admin.html'), 'read-only panel that points to Green Gain Hub');
check(!js.includes("call('gghMarketRuleSaveServer'") && js.includes("call('gghMarketRuleServer')"), 'page only reads the rule');
console.log('PASS: ' + n + ' checks — ABM 1.4.0 Green Gain Hub market listing rule shown read-only (set in Green Gain Hub 4.0.0)');

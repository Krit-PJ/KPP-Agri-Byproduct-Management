/* ABM 1.1.0: Super / Mini Super Admin set how long a plot stays on the Green Gain Hub market after harvest.
   The value is sent to Green Gain Hub (its Config); every change is in admin_log; Admin (recorders) cannot change it. */
const fs = require('fs'), path = require('path');
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };
const env = load({ sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' } });
const { post, sheets, api, feed } = env;
const log = console.log; console.log = () => {}; api.setupSystem(); console.log = log;

const T = post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]).result.token;
const D = post('staffRegisterServer', [{ name: 'สมชาย ใจดี', phone: '0812345678', officeType: 'district', district: '6204', province: 'กำแพงเพชร' }]).result.token;

/* read the current rule from Green Gain Hub */
let r = post('gghMarketRuleServer', [], T);
check(r.ok && r.result.rule.hideAfterHarvestDays === 20 && feed.posts.at(-1).action === 'abm_config' && feed.posts.at(-1).hideAfterHarvestDays === undefined, 'read the rule (no change sent)');

/* only Super / Mini Super Admin may change it */
check(!post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: 10 }], D).ok, 'Admin (recorder) cannot change it');
check(!post('gghMarketRuleServer', [], D).ok, 'Admin (recorder) cannot read it here');
[-1, 366, 2.5, '', null, 'abc'].forEach((v) => check(!post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: v }], T).ok, 'invalid value refused: ' + v));
const sent = feed.posts.length;

r = post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: 30 }], T);
check(r.ok && r.result.rule.hideAfterHarvestDays === 30, 'saved: ' + JSON.stringify(r));
const last = feed.posts.at(-1);
check(feed.posts.length === sent + 1 && last.hideAfterHarvestDays === 30 && last.by === 'krit' && last.key === 'test-feed-key', 'sent to Green Gain Hub with the feed key and who changed it');
check(sheets.admin_log.rows.some((x) => x[4] === 'ggh_market_rule' && /30 วันหลังวันเก็บเกี่ยว/.test(x[5]) && x[1] === 'krit'), 'change written to admin_log');
r = post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: 0 }], T);
check(r.ok && sheets.admin_log.rows.some((x) => x[4] === 'ggh_market_rule' && /แสดงทุกแปลง/.test(x[5])), '0 = show every plot');

/* Green Gain Hub refuses (wrong key) → the officer sees why */
env.props.GGH_FEED_KEY = 'wrong';
check(/Green Gain Hub/.test(post('gghMarketRuleSaveServer', [{ hideAfterHarvestDays: 20 }], T).error || ''), 'refusal shown');
env.props.GGH_FEED_KEY = 'test-feed-key';

/* the officer page: its own settings tab, open to Super and Mini Super Admin */
const front = path.join(__dirname, '..', 'frontend');
const html = fs.readFileSync(path.join(front, 'admin.html'), 'utf8'), js = fs.readFileSync(path.join(front, 'assets', 'admin.js'), 'utf8');
check(html.includes('data-panel="market"') && html.includes('id="gghRuleForm"') && /name="hideAfterHarvestDays" type="number" min="0" max="365"/.test(html), 'form in its own tab');
check(js.includes("views: ['targets', 'ghg', 'crops', 'market', 'api']") && js.includes("market: () => loadGghRule()") && js.includes("call('gghMarketRuleSaveServer'"), 'tab in ตั้งค่า for Super and Mini (api stays Super only)');
console.log('PASS: ' + n + ' checks — ABM 1.1.0 Green Gain Hub market listing rule (Super/Mini, validated, sent with the feed key, audited)');

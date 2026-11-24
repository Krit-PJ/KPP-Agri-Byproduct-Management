/* ABM 1.0.0 backend: setup, the Green Gain Hub link (only a hash is written there), officer-only API, no market sheets here. */
const crypto = require('crypto');
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }

// Fresh project: no feed key yet — setupSystem makes one and registers its hash in Green Gain Hub's Config.
const env = load({ unlinked: true, sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' }, expose: ['sheet_', 'gghRows_', 'getApiInfoServer'] });
const { api, props, sheets, post, get } = env;
console.log = () => {};
env.feed.key = '__not yet__';
const out = api.setupSystem();
const key = props.GGH_FEED_KEY;
assert(/^[0-9a-f]{64}$/.test(key), 'feed key made by code (64 hex): ' + key);
const row = sheets.Config.rows.find((r) => r[0] === 'abm_feed_key_sha256');
assert(row && row[1] === crypto.createHash('sha256').update(key).digest('hex') && row[2] === 'sha256', 'Green Gain Hub Config holds the SHA-256 of the key: ' + JSON.stringify(row));
assert(!sheets.Config.rows.some((r) => r.includes(key)), 'the key itself is never written to a sheet');
assert(/PASS: linked to Green Gain Hub/.test(out) && /PASS: ghg_params/.test(out) && /PASS: residue_records/.test(out) && /PASS: Config sheet is ready/.test(out), 'setup lines: ' + out);
assert(/FAIL: ggh feed/.test(out), 'setup reports the feed honestly while Green Gain Hub does not know the key yet');
const again = api.setupSystem();
assert(props.GGH_FEED_KEY === key && sheets.Config.rows.filter((r) => r[0] === 'abm_feed_key_sha256').length === 1, 'running setup again keeps one key and one hash row');
env.feed.key = key;   // Green Gain Hub now accepts it (it compares the hash)
env.marketChanged();
assert(/PASS: Green Gain Hub feed/.test(api.setupSystem()), 'feed passes once Green Gain Hub accepts the key');

// Market sheets are not in this database
let threw = '';
try { api.sheet_('farmers'); } catch (e) { threw = e.message; }
assert(/Green Gain Hub/.test(threw), 'sheet_ refuses market sheets: ' + threw);
assert(api.getApiInfoServer().system === 'ABM' && api.getApiInfoServer().apiVersion === '1.3.0', 'api info');

// Officer API only; public API aggregate only
['loginServer', 'registerServer', 'saveDataServer', 'getMatchingDataServer', 'ssoLoginServer'].forEach((m) => assert(/Method not allowed/.test(post(m, [{}]).error), 'no market method: ' + m));
const h = get({});
assert(h.ok && h.endpoint === 'health' && h.system === 'ABM', 'bare GET answers health');
const T = post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]).result.token;
const st = post('settingsGetServer', [], T).result;
assert(st.ggh && st.ggh.linked && /AKfycbylUG/.test(st.ggh.url) && !JSON.stringify(st).includes(key), 'settings show the link, never the key');
assert(/^PASS/.test(post('gghTestServer', [], T).result.result), 'feed test from the settings page');
console.info('PASS: ABM backend — setup, Green Gain Hub link (hash only), officer-only API, settings');

/* ABM 1.0.0: moving officer data from the Green Gain Hub database — copy once, then add only new rows; never overwrite. */
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
const RR = ['Record_ID', 'Record_Date', 'Fiscal_Year'];
const ggh = {
  Config: new Sheet('Config', [HEADERS.Config, ['visit_count', 41, 'ครั้ง', '']]),
  admins: new Sheet('admins', [['Username', 'Name', 'Role', 'Status'], ['krit', 'Super Admin', 'super', 'active'], ['p0841157666', 'Kitti', 'admin', 'active']]),
  residue_records: new Sheet('residue_records', [RR, ['RR1', '2026-11-17', 2570], ['RR2', '2026-11-17', 2570]]),
  residue_targets: new Sheet('residue_targets', [['Fiscal_Year', 'District'], [2570, '6201']]),
  admin_log: new Sheet('admin_log', [['At', 'User'], ['t1', 'krit']]),
  farmers: new Sheet('farmers', [HEADERS.farmers]), users: new Sheet('users', [HEADERS.users])
};
ggh.residue_records.frozen = 1;
const env = load({ gghSheets: ggh, sheets: { Sheet1: new Sheet('Sheet1', []) }, expose: ['migrateFromGreenGainHub', 'verifyMigration'] });
const { api, sheets } = env;
console.log = () => {};
let out = api.migrateFromGreenGainHub();
assert(/COPIED: admins — 2 row/.test(out) && /COPIED: residue_records — 2 row/.test(out) && /SKIP: ghg_params/.test(out), 'first run copies what exists: ' + out);
assert(sheets.residue_records && sheets.residue_records.name === 'residue_records' && sheets.residue_records.rows.length === 3 && sheets.residue_records.getFrozenRows() === 1, 'copied under the original name with the frozen header');
assert(!sheets.Sheet1, 'the empty default sheet is removed');
assert(sheets.farmers.rows.length === 1 && sheets.users.rows.length === 1 && sheets.Config.rows.length === 1, 'market sheets, users and Config are not moved');
// officers keep recording in Green Gain Hub until it switches over → second run adds only the new rows
ggh.residue_records.rows.push(['RR3', '2026-11-19', 2570]);
ggh.admins.rows.push(['p0899999999', 'ใหม่', 'admin', 'active']);
ggh.admin_log.rows.push(['t2', 'x']);
sheets.residue_records.rows[1][2] = 'edited here';
out = api.migrateFromGreenGainHub();
assert(/ADDED: residue_records — 1 new row/.test(out) && /ADDED: admins — 1 new row/.test(out) && /KEPT: admin_log/.test(out) && /KEPT: residue_targets/.test(out), 'second run adds only new rows: ' + out);
assert(sheets.residue_records.rows.length === 4 && sheets.residue_records.rows[1][2] === 'edited here', 'nothing here is overwritten');
assert(/SAME: residue_records — 0 new/.test(api.migrateFromGreenGainHub()), 'third run changes nothing');
assert(/PASS: residue_records 3\/3/.test(api.verifyMigration()) && /PASS: admins 3\/3/.test(api.verifyMigration()), 'verifyMigration counts');
assert(ggh.residue_records.rows.length === 4 && ggh.admins.rows.length === 4, 'Green Gain Hub keeps its copy untouched');
console.info('PASS: migration from Green Gain Hub — copy once, add new rows only, never overwrite, Green Gain Hub untouched');

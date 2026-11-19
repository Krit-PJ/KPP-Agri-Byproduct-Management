/**
 * ABM 1.0.0 — one-time move of the officer data from the Green Gain Hub database (19 Nov 2026).
 *
 * Run migrateFromGreenGainHub() from the editor BEFORE setupSystem() the first time, and once more right before Green Gain Hub
 * 2.6.0 switches its officer pages off (it only adds what is new, so running it again is safe).
 *   - a sheet that is not here yet is copied whole (values, formats, frozen header) and renamed to its original name
 *   - a sheet that is here already: rows whose key (column A) is not here yet are appended — nothing is overwritten or deleted
 * Green Gain Hub keeps its copy untouched as an archive; plots, buyers, users and the visit counter stay there.
 */
const MIGRATE_SHEETS = ['admins', 'admin_log', 'residue_records', 'residue_methods', 'residue_targets', 'ghg_params', 'ghg_crops',
  'crop_types', 'crop_imports', 'crop_stats', 'Goals', 'Research_Refs'];
// Sheets whose column A is not a unique key: append nothing to them on a second run (copied whole the first time only).
const MIGRATE_COPY_ONCE = ['admin_log', 'residue_targets', 'crop_stats'];

function migrateFromGreenGainHub() {
  const src = SpreadsheetApp.openById(String(PropertiesService.getScriptProperties().getProperty('GGH_SPREADSHEET_ID') || GGH_DB_DEFAULT));
  const dst = spreadsheet_();
  if (src.getId() === dst.getId()) throw new Error('ฐานข้อมูลปลายทางต้องเป็น Sheet ของ ABM ไม่ใช่ของ Green Gain Hub');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const out = [];
  try {
    MIGRATE_SHEETS.forEach(function (name) {
      const s = src.getSheetByName(name);
      if (!s) { out.push('SKIP: ' + name + ' (not in Green Gain Hub)'); return; }
      const d = dst.getSheetByName(name);
      if (!d) {
        const c = s.copyTo(dst);
        c.setName(name);
        if (s.getFrozenRows()) c.setFrozenRows(s.getFrozenRows());
        out.push('COPIED: ' + name + ' — ' + Math.max(0, s.getLastRow() - 1) + ' row(s)');
        return;
      }
      if (MIGRATE_COPY_ONCE.indexOf(name) >= 0) { out.push('KEPT: ' + name + ' (already here)'); return; }
      const have = {};
      dataRows_(d).forEach(function (r) { have[String(r[0])] = true; });
      const add = dataRows_(s).filter(function (r) { return String(r[0]) !== '' && !have[String(r[0])]; });
      if (add.length) {
        d.getRange(d.getLastRow() + 1, 1, add.length, s.getLastColumn()).setValues(add);
      }
      out.push((add.length ? 'ADDED: ' : 'SAME: ') + name + ' — ' + add.length + ' new row(s); ' + Math.max(0, d.getLastRow() - 1) + ' here, ' +
        Math.max(0, s.getLastRow() - 1) + ' in Green Gain Hub');
    });
    // The default empty first sheet of a new spreadsheet ("Sheet1" / "แผ่น1") is removed once real sheets exist.
    dst.getSheets().forEach(function (sh) {
      if (/^(Sheet1|แผ่น1|ชีต1)$/.test(sh.getName()) && sh.getLastRow() === 0 && dst.getSheets().length > 1) dst.deleteSheet(sh);
    });
  } finally {
    lock.releaseLock();
  }
  const text = out.join('\n');
  console.log(text);
  return text;
}

/** Counts in both databases, for the cut-over check (run from the editor). */
function verifyMigration() {
  const src = SpreadsheetApp.openById(String(PropertiesService.getScriptProperties().getProperty('GGH_SPREADSHEET_ID') || GGH_DB_DEFAULT));
  const dst = spreadsheet_();
  const lines = MIGRATE_SHEETS.map(function (name) {
    const a = src.getSheetByName(name), b = dst.getSheetByName(name);
    const na = a ? Math.max(0, a.getLastRow() - 1) : 0, nb = b ? Math.max(0, b.getLastRow() - 1) : -1;
    return (nb >= na ? 'PASS: ' : 'FAIL: ') + name + ' ' + nb + '/' + na;
  });
  return lines.join('\n');
}

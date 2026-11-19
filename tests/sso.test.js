/* ABM 1.0.0 central identity (SSO) for officers: ticket for ABM only, existing-officer provisioning, Mini/Super unchanged, SSO_MODE.
   Agri-Risk is replaced by a small in-test identity service with the same id_redeem / id_register contract.
   (Farmer/buyer SSO stays in Green Gain Hub and is tested there.) */
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };

/* ---- stand-in for Agri-Risk Identity.gs ---- */
const idp = { people: {}, tickets: {}, used: new Set(), calls: [] };
const issue = (phone, aud) => { const t = 't' + Math.random().toString(36).slice(2) + '.sig'; idp.tickets[t] = { phone, aud, exp: Date.now() + 120e3 }; return t; };
const urlFetch = { fetch: (url, opts) => {
  const b = JSON.parse(opts.payload); idp.calls.push(b.action);
  let out;
  if (b.action === 'id_redeem') {
    const t = idp.tickets[b.ticket];
    if (!t) out = { ok: false, error: 'ตั๋วไม่ถูกต้อง' };
    else if (idp.used.has(b.ticket)) out = { ok: false, error: 'ตั๋วนี้ถูกใช้แล้ว' };
    else if (t.aud !== b.aud) out = { ok: false, error: 'ตั๋วนี้ไม่ได้ออกให้ระบบนี้' };
    else { idp.used.add(b.ticket); const p = idp.people[t.phone]; out = p.status === 'active' ? { ok: true, person: p } : { ok: false, error: 'บัญชีถูกระงับหรือไม่พบตัวตน' }; }
  } else if (b.action === 'id_register') {
    if (idp.people[b.phone]) out = { ok: false, error: 'หมายเลขนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ' };
    else { idp.people[b.phone] = { phone: b.phone, fullName: b.fullName, position: b.position, affiliation: b.affiliation, provinceCode: b.provinceCode, districtName: b.districtName || '', status: 'active', consent: b.consent, system: b.system }; out = { ok: true, token: 'x' }; }
  } else out = { ok: false, error: 'unknown' };
  return { getContentText: () => JSON.stringify(out), getResponseCode: () => 200 };
} };

const env = load({ urlFetch, sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345' } });
const { post, sheets, api, props } = env;
console.log = () => {};
api.setupSystem();
const ok = (r, m) => { assert(r.ok, m + ': ' + r.error); return r.result; };
const bad = (r, re, m) => { n++; assert(!r.ok && re.test(r.error), m + ': ' + JSON.stringify(r)); };

ok(post('staffRegisterServer', [{ name: 'วิชัย เกษตรอำเภอ', phone: '0833333333', officeType: 'district', district: '6204', province: 'กำแพงเพชร' }]), 'officer');

/* 1. first sign-in of an existing officer: identity created from the officer record, nobody registers twice */
let r = post('ssoProvisionServer', [{ phone: '083-333-3333' }]);
check(r.ok && r.result.status === 'provisioned', 'existing officer provisioned: ' + JSON.stringify(r));
const po = idp.people['0833333333'];
check(po.affiliation === 'สำนักงานเกษตรอำเภอขาณุวรลักษบุรี' && po.districtName === 'ขาณุวรลักษบุรี' && po.position === 'เจ้าหน้าที่' && po.system === 'ABM', 'identity carries the office and system ABM: ' + JSON.stringify(po));
check(post('ssoProvisionServer', [{ phone: '0833333333' }]).result.status === 'exists', 'second provision says exists');
check(post('ssoProvisionServer', [{ phone: '0899999999' }]).result.status === 'none', 'unknown numbers are never sent to Agri-Risk');
check(idp.calls.filter((a) => a === 'id_register').length === 2, 'only officer numbers reached Agri-Risk');

/* 2. officer signs in with a ticket for ABM */
r = post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]);
check(r.ok && r.result.role === 'admin' && r.result.district === '6204' && /^[0-9a-f]{64}$/.test(r.result.token), 'officer signs in with a ticket: ' + JSON.stringify(r));
check(sheets.admin_log.rows.some((x) => /ตัวตนกลาง \(SSO\)/.test(x.join(' '))), 'SSO sign-in written to admin_log');
const t1 = issue('0833333333', 'ABM'); post('ssoStaffLoginServer', [{ ticket: t1 }]);
bad(post('ssoStaffLoginServer', [{ ticket: t1 }]), /ถูกใช้แล้ว/, 'ticket used once');
bad(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'GGH') }]), /ไม่ได้ออกให้ระบบนี้/, 'a ticket for Green Gain Hub is refused here');
bad(post('ssoStaffLoginServer', [{ ticket: 'not a ticket' }]), /ไม่ถูกต้อง/, 'malformed ticket refused before calling Agri-Risk');

/* 3. identity from another system (e.g. a farmer in Green Gain Hub) but no officer account → need_register */
idp.people['0855555555'] = { phone: '0855555555', fullName: 'ใหม่ ยังไม่ลงทะเบียน', status: 'active' };
r = post('ssoStaffLoginServer', [{ ticket: issue('0855555555', 'ABM') }]);
check(r.ok && r.result.status === 'need_register' && !r.result.token && r.result.name === 'ใหม่ ยังไม่ลงทะเบียน', 'need_register: ' + JSON.stringify(r));

/* 4. Mini / Super keep username + password and cannot use SSO */
const T = ok(post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]), 'super password login unchanged').token;
ok(post('adminSaveServer', [{ username: 'mini1', name: 'มินิ หนึ่ง', role: 'mini', password: 'Mini12345', phone: '0866666666' }], T), 'mini created');
idp.people['0866666666'] = { phone: '0866666666', fullName: 'มินิ หนึ่ง', status: 'active' };
bad(post('ssoStaffLoginServer', [{ ticket: issue('0866666666', 'ABM') }]), /ชื่อผู้ใช้และรหัสผ่าน/, 'Mini cannot sign in through SSO');
check(post('ssoProvisionServer', [{ phone: '0866666666' }]).result.status === 'none', 'Mini/Super are never provisioned into the shared identity');
ok(post('adminLoginServer', [{ username: 'mini1', password: 'Mini12345' }]), 'mini password login unchanged');

/* 5. suspended in Agri-Risk ("not me") → refused here at once */
idp.people['0833333333'].status = 'suspended';
bad(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]), /ระงับ/, 'suspended identity refused');
idp.people['0833333333'].status = 'active';

/* 6. SSO_MODE */
check(post('staffLoginServer', [{ phone: '0833333333' }]).ok, 'optional: old officer phone sign-in still works');
props.SSO_MODE = 'required';
bad(post('staffLoginServer', [{ phone: '0833333333' }]), /ตัวตนกลาง/, 'required: old officer sign-in closed');
check(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]).ok, 'required: SSO officer sign-in works');
ok(post('adminLoginServer', [{ username: 'krit', password: 'Super12345' }]), 'required: Super password still works');
props.SSO_MODE = 'off';
bad(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]), /ปิดใช้งาน/, 'off: SSO closed');
check(post('staffLoginServer', [{ phone: '0833333333' }]).ok, 'off: old sign-in works');
check(post('ssoProvisionServer', [{ phone: '0833333333' }]).result.status === 'off', 'off: nothing sent to Agri-Risk');
const h = JSON.parse((api.doGet({ parameter: { api: 'v1', endpoint: 'health' } }), env.out().body));
check(h.feature === 'ABM_SPLIT' && h.system === 'ABM' && h.apiVersion === '1.0.0', 'health shows ABM 1.0.0');
bad(post('ssoLoginServer', [{ ticket: issue('0833333333', 'ABM') }]), /Method not allowed/, 'no farmer/buyer SSO method in ABM');

console.info('PASS: ' + n + ' checks — ABM 1.0.0 officer central identity (SSO, aud ABM)');

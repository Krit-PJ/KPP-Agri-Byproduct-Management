/* ABM 1.0.0 central identity (SSO) for officers: ticket for ABM only, existing-officer provisioning, Mini/Super unchanged, SSO_MODE.
   Agri-Risk is replaced by a small in-test identity service with the same id_redeem / id_register contract.
   (Farmer/buyer SSO stays in Green Gain Hub and is tested there.) */
const { load, Sheet, HEADERS } = require('./helpers/gas-mock');
function assert(v, m) { if (!v) throw new Error(m); }
let n = 0; const check = (v, m) => { n++; assert(v, m); };

/* ---- stand-in for Agri-Risk Identity.gs ---- */
const idp = { people: {}, tickets: {}, used: new Set(), calls: [] };
const marketUsers = [];
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
  } else if (b.action === 'abm_feed') {
    // Green Gain Hub feed (2.9.0): SHA-256 of farmer/buyer phones
    out = { ok: true, data: { apiVersion: '2.9.0', farmers: { headers: HEADERS.farmers, rows: [] }, buyers: { headers: HEADERS.buyers, rows: [] },
      marketPhones: marketUsers.map((ph) => require('crypto').createHash('sha256').update(ph, 'utf8').digest('hex')) } };
  } else out = { ok: false, error: 'unknown' };
  return { getContentText: () => JSON.stringify(out), getResponseCode: () => 200 };
} };

// 1.2.0: SSO_MODE optional for sections 1–6 (as before); section 7 covers the new default (required)
const env = load({ urlFetch, sheets: { Config: new Sheet('Config', [HEADERS.Config]) }, props: { SUPER_ADMIN_USERNAME: 'krit', SUPER_ADMIN_PASSWORD: 'Super12345', SSO_MODE: 'optional' } });
const { post, sheets, api, props } = env;
console.log = () => {};
api.setupSystem();
const ok = (r, m) => { assert(r.ok, m + ': ' + r.error); return r.result; };
const bad = (r, re, m) => { n++; assert(!r.ok && re.test(r.error), m + ': ' + JSON.stringify(r)); };

props.SSO_MODE = 'off';   // an officer registered before 1.2.0 (no identity yet), approved
ok(env.officer({ name: 'วิชัย เกษตรอำเภอ', phone: '0833333333', officeType: 'district', district: '6204', province: 'กำแพงเพชร' }), 'officer');
props.SSO_MODE = 'optional';

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

/* 2b. 1.7.0 remembered device: one call instead of three, signed, expires, voided by "sign out everywhere" and by suspension */
r = post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]);
check(r.ok && !r.result.device, 'no device key unless the officer asks to be remembered');
r = post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM'), remember: true }]);
const dev = r.result.device, uname = r.result.username;
check(/^v1\|[a-z0-9._-]+\|\d+\|\d+\|[A-Za-z0-9_-]+$/.test(dev) && r.result.deviceDays === 30, 'device key issued: ' + dev);
check(!JSON.stringify(props).includes(dev.split('|')[4]) && /^[0-9a-f]{64}$/.test(props.ABM_DEVICE_SECRET), 'secret stays in Script Properties, signature is not stored');
const before = idp.calls.length;
r = post('deviceResumeServer', [{ device: dev }]);
check(r.ok && /^[0-9a-f]{64}$/.test(r.result.token) && r.result.role === 'admin' && idp.calls.length === before, 'resume: one ABM call, no Agri-Risk round trip');
const tampered = dev.replace('|' + uname + '|', '|krit|');
bad(post('deviceResumeServer', [{ device: tampered }]), /DEVICE_EXPIRED/, 'a key edited to another account is refused');
const p5 = dev.split('|'); p5[2] = String(Date.now() - 1000);
bad(post('deviceResumeServer', [{ device: p5.join('|') }]), /DEVICE_EXPIRED/, 'changed expiry breaks the signature');
bad(post('deviceResumeServer', [{ device: 'junk' }]), /DEVICE_EXPIRED/, 'junk refused');
ok(post('deviceForgetAllServer', [], r.result.token), 'sign out everywhere');
bad(post('deviceResumeServer', [{ device: dev }]), /DEVICE_EXPIRED/, 'old keys void after sign out everywhere');
const dev2 = ok(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM'), remember: true }]), 'sign in again').device;
const row = sheets.admins.rows.find((x) => x[0] === uname); row[3] = 'disabled';
bad(post('deviceResumeServer', [{ device: dev2 }]), /ระงับ/, 'a suspended account cannot resume');
row[3] = 'active';
check(post('deviceResumeServer', [{ device: dev2 }]).ok, 'resume works again once active');

/* 3. identity from another officer system, no officer account here → need_register */
idp.people['0855555555'] = { phone: '0855555555', fullName: 'ใหม่ ยังไม่ลงทะเบียน', status: 'active', scope: 'all' };
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
check(h.feature === 'ABM_SPLIT' && h.system === 'ABM' && h.apiVersion === '1.8.0', 'health shows ABM 1.4.0');
bad(post('ssoLoginServer', [{ ticket: issue('0833333333', 'ABM') }]), /Method not allowed/, 'no farmer/buyer SSO method in ABM');

/* 7. 1.2.0: SSO required by default · farmers/buyers use Green Gain Hub only · officer registration proves the phone and waits for approval */
delete props.SSO_MODE;
bad(post('staffLoginServer', [{ phone: '0833333333' }]), /ตัวตนกลาง/, 'default is required: old phone sign-in closed');
const reg = { name: 'มานี ใหม่ใจ', phone: '0877777777', officeType: 'district', district: '6204', province: 'กำแพงเพชร' };
bad(post('staffRegisterServer', [reg]), /SSO_REQUIRED/, 'registering without a ticket is refused (nobody can register someone else\'s number)');
// a farmer registered through Green Gain Hub (identity scope market)
idp.people['0811111111'] = { phone: '0811111111', fullName: 'ชาวนา ขยัน', status: 'active', scope: 'market' };
r = post('ssoStaffLoginServer', [{ ticket: issue('0811111111', 'ABM') }]);
check(r.ok && r.result.status === 'market_user' && /Green Gain Hub/.test(r.result.message) && !r.result.token, 'farmer identity → Green Gain Hub only: ' + JSON.stringify(r));
bad(post('staffRegisterServer', [{ ...reg, phone: '0811111111', ticket: issue('0811111111', 'ABM') }]), /^MARKET_ACCOUNT:/, 'farmer cannot register as an officer');
// a Green Gain Hub user whose identity says nothing (made before 3.12.4): the GGH feed knows the phone
marketUsers.push('0822222222'); env.marketChanged();
idp.people['0822222222'] = { phone: '0822222222', fullName: 'ผู้รับซื้อ เก่า', status: 'active', scope: 'all' };
bad(post('staffRegisterServer', [{ ...reg, phone: '0822222222', ticket: issue('0822222222', 'ABM') }]), /^MARKET_ACCOUNT:/, 'GGH user (from the feed) cannot register as an officer');
check(post('ssoStaffLoginServer', [{ ticket: issue('0822222222', 'ABM') }]).result.status === 'market_user', 'and is pointed to Green Gain Hub');
// someone else's number
idp.people['0877777777'] = { phone: '0877777777', fullName: 'มานี ใหม่ใจ', status: 'active', scope: 'all' };
idp.people['0800000000'] = { phone: '0800000000', fullName: 'คนอื่น', status: 'active', scope: 'all' };
bad(post('staffRegisterServer', [{ ...reg, ticket: issue('0800000000', 'ABM') }]), /ไม่ตรงกับตัวตน/, 'phone must match the verified identity');
// a real officer: registered, waits, approved, signs in
r = post('staffRegisterServer', [{ ...reg, ticket: issue('0877777777', 'ABM') }]);
check(r.ok && r.result.status === 'pending' && !r.result.token, 'officer registration waits for approval: ' + JSON.stringify(r));
check(sheets.admins.rows.some((x) => x[10] === '0877777777' && x[3] === 'pending' && x[15] === 'self'), 'stored as pending');
check(sheets.admin_log.rows.some((x) => x[4] === 'staff_register' && /รออนุมัติ/.test(x[5]) && /ตัวตนกลาง/.test(x[5])), 'registration logged');
bad(post('ssoStaffLoginServer', [{ ticket: issue('0877777777', 'ABM') }]), /รอผู้ดูแลระบบ/, 'pending: cannot sign in yet');
const list = ok(post('adminsListServer', [], T), 'list');
const me = list.find((a) => a.phone === '0877777777');
check(me.status === 'pending', 'shown as pending to Mini/Super');
ok(post('adminSaveServer', [{ username: me.username, name: me.name, phone: me.phone, role: 'admin', status: 'active', officeType: 'district', district: '6204' }], T), 'approve');
r = post('ssoStaffLoginServer', [{ ticket: issue('0877777777', 'ABM') }]);
check(r.ok && r.result.token && r.result.district === '6204', 'approved officer signs in');
// officer first: an existing officer whose identity was made in Green Gain Hub still gets in
idp.people['0833333333'].scope = 'market';
check(post('ssoStaffLoginServer', [{ ticket: issue('0833333333', 'ABM') }]).result.token, 'existing officer account wins over the market scope');
const fr = require('fs').readFileSync(require('path').join(__dirname, '..', 'frontend', 'assets', 'staff-auth.js'), 'utf8');
check(fr.includes('S.registerTicket(input)') && fr.includes("result.status === 'market_user'"), 'pages: registration sends a ticket; farmers are pointed to Green Gain Hub');

console.info('PASS: ' + n + ' checks — ABM officer central identity (SSO, aud ABM) · 1.2.0 SSO required, GGH users refused, approval');

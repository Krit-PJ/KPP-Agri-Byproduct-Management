/* ABM 1.0.0 (from Green Gain Hub 2.2.0) — admin page (Super Admin / Mini Super Admin / Admin = district recorder). */
(function () {
  'use strict';

  const cfg = window.ABM_CONFIG || {};
  const API = cfg.SHEETS_API_URL || '';
  const TOKEN_KEY = 'abm_admin_token';
  const SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  const fmt = (n, d = 0) => (n === null || n === undefined || !isFinite(n) ? '–' : new Intl.NumberFormat('th-TH', { maximumFractionDigits: d }).format(n));
  const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthLabel = (ym) => { const y = Math.floor(ym / 100), m = ym % 100; return `${TH_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`; };
  const STATUS_TH = { active: 'ใช้งาน', replaced: 'ถูกแทนที่', deleted: 'ลบแล้ว', disabled: 'ระงับ', pending: 'รออนุมัติ' };
  const ACTION_TH = { login: 'เข้าสู่ระบบ', crop_import: 'นำเข้าข้อมูลเพาะปลูก', crop_import_delete: 'ลบชุดข้อมูล', crop_type_save: 'บันทึกชนิดพืช',
    settings_save: 'แก้ไขการเชื่อมต่อ API', report_view: 'ดูรายงาน', report_export: 'ส่งออกรายงาน', admin_create: 'เพิ่มผู้ดูแล', admin_update: 'แก้ไขผู้ดูแล', password_change: 'เปลี่ยนรหัสผ่าน',
    password_reset: 'ตั้งรหัสผ่านใหม่ให้ผู้ดูแล', super_bootstrap: 'สร้าง Super Admin', cache_clear: 'อัปเดตหน้าแรก',
    staff_register: 'ลงทะเบียนเจ้าหน้าที่', residue_create: 'บันทึกการจัดการวัสดุเหลือใช้ทางการเกษตร', residue_update: 'แก้ไขการจัดการวัสดุเหลือใช้ทางการเกษตร', residue_delete: 'ลบการจัดการวัสดุเหลือใช้ทางการเกษตร',
    ghg_params_save: 'แก้ไขค่าคำนวณก๊าซเรือนกระจก', ghg_crop_save: 'แก้ไขค่าตามชนิดพืช', residue_price_save: 'แก้ไขราคากลาง', residue_targets_save: 'แก้ไขเป้าหมาย', residue_method_save: 'แก้ไขประเภทการจัดการ', site_save: 'แก้ไขชื่อจังหวัด/หน่วยงาน' };
  const ROLE_TH = { super: 'Super Admin', mini: 'Mini Super Admin', admin: 'Admin' };
  const level = (role) => ({ admin: 1, mini: 2, super: 3 })[role] || 0;
  // District-office Admin is limited to one district; provincial-office Admin, Mini and Super may choose.
  const districtScoped = () => !!(state.me && state.me.role === 'admin' && state.me.scope !== 'province');
  const fmtBaht = (n) => (n === null || n === undefined ? '–' : fmt(n, Math.abs(n) < 100 ? 2 : 0));
  // 2.2.0 menus by task: Admin 4 items; Mini Super Admin / Super Admin 5 groups with sub-tabs.
  const UNIT = 'ตันคาร์บอนไดออกไซด์เทียบเท่า';
  const VIEW_LABEL = { overview: 'ภาพรวม', record: 'บันทึกวัสดุเหลือใช้ทางการเกษตร', records: 'สรุปผลการส่งเสริม', import: 'นำเข้าข้อมูลเพาะปลูก', history: 'ข้อมูลเพาะปลูกที่นำเข้าแล้ว',
    reports: 'พิมพ์รายงาน', admins: 'เจ้าหน้าที่และผู้ดูแล', log: 'ประวัติการใช้งาน', targets: 'เป้าหมายและวิธีจัดการ', ghg: 'สูตรคำนวณชีวมวลและก๊าซเรือนกระจก',
    crops: 'ชนิดพืชในทะเบียน', market: 'ตลาด Green Gain Hub', api: 'เชื่อมต่อระบบอื่น', account: 'บัญชีของฉัน' };
  const MENU = {
    admin: [{ key: 'record', views: ['record'] }, { key: 'records', views: ['records'] }, { key: 'reports', views: ['reports'] }, { key: 'account', views: ['account'] }],
    mini: [
      { key: 'overview', label: 'ภาพรวม', views: ['overview'] },
      { key: 'data', label: 'ข้อมูลการจัดการ', views: ['records', 'record', 'import', 'history'] },
      { key: 'reports', label: 'พิมพ์รายงาน', views: ['reports'] },
      { key: 'users', label: 'ผู้ใช้งาน', views: ['admins', 'log'] },
      { key: 'settings', label: 'ตั้งค่า', views: ['targets', 'ghg', 'crops', 'market', 'api'] }
    ]
  };
  // Advanced settings (other-system API) are shown to Super Admin only.
  const SUPER_ONLY_VIEWS = ['api'];
  const menuFor = () => {
    const m = MENU[level(state.me.role) >= 2 ? 'mini' : 'admin'];
    return m.map((g) => Object.assign({}, g, { views: g.views.filter((v) => state.me.role === 'super' || !SUPER_ONLY_VIEWS.includes(v)) }));
  };

  const state = { token: sessionStorage.getItem(TOKEN_KEY) || '', me: null, types: [], crop: '', file: null, parsed: null, check: null };

  /* ---------------- API ---------------- */
  async function call(method, ...args) {
    if (!API) throw new Error('ยังไม่ได้ตั้งค่า SHEETS_API_URL ใน assets/config.js');
    const res = await fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ method, args, token: state.token }) });
    if (!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (HTTP ' + res.status + ')');
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'ADMIN_SESSION_EXPIRED') { signOut('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'); throw new Error('เซสชันหมดอายุ'); }
      throw new Error(data.error || 'เกิดข้อผิดพลาด');
    }
    return data.result;
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function setResult(id, msg, ok) {
    const el = $(id); el.textContent = msg || ''; el.className = 'adm-result' + (msg ? (ok ? ' is-ok' : ' is-error') : '');
  }
  async function busy(btn, label, fn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }

  // 1.5.0: the market link in the top bar follows ABM_CONFIG.GGH_URL, as on the homepage.
  (function marketLink() { const u = window.ABM_CONFIG && window.ABM_CONFIG.GGH_URL; const a = document.getElementById('admGgh'); if (u && a) a.href = u; })();

  /* ---------------- auth ---------------- */
  function signOut(msg) {
    state.token = ''; state.me = null; sessionStorage.removeItem(TOKEN_KEY);
    if (typeof rep !== 'undefined') { rep.catalog = null; rep.data = null; }
    if (typeof res !== 'undefined') { res.meta = null; res.editing = null; res.photos = []; }
    $('viewApp').classList.add('hidden'); $('admUser').classList.add('hidden'); $('viewLogin').classList.remove('hidden');
    $('loginError').textContent = msg || '';
  }

  async function enterApp(me) {
    state.me = me;
    $('viewLogin').classList.add('hidden'); $('viewApp').classList.remove('hidden'); $('admUser').classList.remove('hidden');
    $('admUserName').textContent = me.name;
    $('admUserRole').textContent = me.roleLabel || ROLE_TH[me.role] || me.role;
    const office = me.role === 'admin' ? (me.officeLabel || (me.districtName ? 'อ.' + me.districtName : '')) : '';
    $('admUserDistrict').hidden = !office;
    $('admUserDistrict').textContent = office;
    if (me.province) $('admProvince').textContent = 'จังหวัด' + me.province;
    $('admNav').innerHTML = menuFor().map((g) => `<button type="button" data-top="${esc(g.key)}" data-first="${esc(g.views[0])}">${esc(g.label || VIEW_LABEL[g.views[0]])}</button>`).join('');
    $('admNav').querySelectorAll('[data-top]').forEach((b) => b.addEventListener('click', () => show(b.dataset.first)));
    $('admAccountBtn').classList.toggle('hidden', level(me.role) < 2);
    document.querySelectorAll('[data-role="mini"]').forEach((b) => b.classList.toggle('hidden', level(me.role) < 2));
    show(level(me.role) >= 2 ? 'overview' : 'record');
    if (level(me.role) >= 2) await loadCropTypes();
  }

  /* ---------- officer sign-in by phone / self-registration (2.1.0) ---------- */
  const reg = { meta: null };
  function loginTab(tab) {
    document.querySelectorAll('[data-ltab]').forEach((b) => { const on = b.dataset.ltab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll('[data-lpanel]').forEach((f) => f.classList.toggle('hidden', f.dataset.lpanel !== tab));
    if (tab === 'register') window.ABM_STAFF.prepareRegister($('staffRegForm'), 'regProvinces').catch((err) => { $('regError').textContent = err.message; });
    const first = document.querySelector(`[data-lpanel="${tab}"] input`); if (first) first.focus();
  }
  document.querySelectorAll('[data-ltab]').forEach((b, i, all) => {
    b.addEventListener('click', () => loginTab(b.dataset.ltab));
    b.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); const n = all[(i + d + all.length) % all.length]; loginTab(n.dataset.ltab); n.focus(); });
  });
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => loginTab(b.dataset.goto)));
  // Registration fields, checks and phone sign-in come from assets/staff-auth.js (shared with the homepage popup).
  const digits = window.ABM_STAFF.digits;
  $('staffLoginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = digits($('staffPhone').value);
    if (!/^0\d{9}$/.test(phone)) { $('staffLoginError').textContent = 'กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก'; return; }
    busy($('staffLoginBtn'), 'กำลังตรวจสอบ…', async () => {
      try {
        const r = await window.ABM_STAFF.login(phone, { remember: !!($('staffRemember') && $('staffRemember').checked) });
        state.token = r.token; $('staffLoginError').textContent = '';
        await enterApp(r);
        showSsoPrev(popSsoPrev());
      } catch (err) {
        // A farmer/buyer number typed here: point to the homepage box instead of "not found".
        if (/^MARKET_ACCOUNT:/.test(err.message)) {
          $('staffLoginError').innerHTML = esc(err.message.replace(/^MARKET_ACCOUNT:\s*/, '')) + ' <a href="https://krit-pj.github.io/Green_Gain_Hub-KPP/">ไปที่ Green Gain Hub</a>';
        } else $('staffLoginError').textContent = err.message;
      }
    });
  });
  $('staffRegForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const { input, missing } = window.ABM_STAFF.readRegister(e.target);
    if (missing.length) { $('regError').textContent = 'กรุณากรอก: ' + missing.join(', '); return; }
    busy($('regBtn'), 'กำลังลงทะเบียน…', async () => {
      try {
        const r = await window.ABM_STAFF.register(input);
        $('regError').textContent = '';
        if (r && r.token) { state.token = r.token; await enterApp(r); toast(r.message); return; }
        // 1.2.0: the account waits for approval — no session yet
        $('regError').innerHTML = '<strong>' + esc(r.message) + '</strong>'; e.target.reset();
      } catch (err) {
        const m = String(err.message || '');
        if (/^MARKET_ACCOUNT:/.test(m)) $('regError').innerHTML = esc(m.replace(/^MARKET_ACCOUNT:\s*/, '')) + ' <a href="https://krit-pj.github.io/Green_Gain_Hub-KPP/">ไปที่ Green Gain Hub</a>';
        else $('regError').textContent = m.replace(/^SSO_REQUIRED:\s*/, '');
      }
    });
  });

  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = $('loginUsername').value.trim().toLowerCase(), password = $('loginPassword').value;
    if (!username || !password) { $('loginError').textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'; return; }
    busy($('loginBtn'), 'กำลังตรวจสอบ…', async () => {
      try {
        const r = await call('adminLoginServer', { username, password });
        state.token = r.token; sessionStorage.setItem(TOKEN_KEY, r.token);
        $('loginPassword').value = ''; $('loginError').textContent = '';
        await enterApp(r);
      } catch (err) { $('loginError').textContent = err.message; }
    });
  });
  // 2.4.0: signing out here also signs out of Agri-Risk Map / Smart Agri on this device (shared identity)
  // 1.7.0: signing out on this device also forgets it (the remembered key is removed)
  $('admLogout').addEventListener('click', async () => { try { await call('adminLogoutServer'); } catch (e) { /* ignore */ } if (window.ABM_SSO) window.ABM_SSO.logout(); window.ABM_STAFF.forgetDevice(); signOut(); });
  function popSsoPrev() { try { const v = sessionStorage.getItem('abm_sso_prev'); sessionStorage.removeItem('abm_sso_prev'); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  /** "Previous sign-in" notice with a "not me" button, at the top of the officer pages. */
  function showSsoPrev(prev) {
    if (!prev || !window.KPP_ID) return;
    let box = $('admSsoPrev');
    if (!box) { box = document.createElement('div'); box.id = 'admSsoPrev'; box.style.margin = '0 0 1rem'; $('viewApp').prepend(box); }
    box.innerHTML = window.KPP_ID.prevHtml(prev);
    window.KPP_ID.bindPrev(box, (suspended) => { if (suspended) setTimeout(() => signOut('ระงับหมายเลขนี้แล้ว กรุณาติดต่อผู้ดูแลระบบ'), 2500); else box.remove(); });
  }

  /* ---------------- navigation ---------------- */
  const loaders = { overview: loadOverview, record: loadRecordView, records: loadRecords, ghg: loadGhg, targets: () => loadTargets(), history: loadHistory, crops: loadCropTypesTable,
    reports: loadReportCatalog, market: () => loadGghRule(), api: loadApi, admins: loadAdmins, log: loadLog, account: loadAccount };
  function show(view) {
    if (!state.me) return;
    const menu = menuFor();
    const group = menu.find((g) => g.views.includes(view)) || (view === 'account' ? null : menu[0]);
    if (group && !group.views.includes(view)) view = group.views[0];
    $('admNav').querySelectorAll('[data-top]').forEach((b) => { if (group && b.dataset.top === group.key) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const sub = $('admSubnav');
    const tabs = group && group.views.length > 1 ? group.views : [];
    sub.classList.toggle('hidden', !tabs.length);
    sub.innerHTML = tabs.map((v) => `<button type="button" data-view="${esc(v)}" ${v === view ? 'aria-current="page"' : ''}>${esc(VIEW_LABEL[v])}</button>`).join('');
    sub.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
    document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== view));
    blurIn(document.querySelector(`[data-panel="${view}"]`));
    if (loaders[view]) loaders[view]().catch((err) => toast(err.message));
  }
  $('admAccountBtn').addEventListener('click', () => show('account'));

  /* 1.7.0 motion like the clip (same as the homepage): a view blurs in when chosen, figures count up to their value.
     Only on the officer's action, ~0.5 s, never with "reduce motion". */
  const REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function blurIn(el) { if (!el || REDUCED.matches) return; el.classList.remove('ggh-in'); void el.offsetWidth; el.classList.add('ggh-in'); }
  function countUp(root) {
    if (!root || REDUCED.matches) return;
    root.querySelectorAll('.adm-sumtile b, [data-count]').forEach((el) => {
      const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!node) return;
      const text = node.nodeValue.trim(), m = text.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/); if (!m) return;
      const to = Number(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length; if (!isFinite(to) || !to) return;
      const t0 = performance.now(), dur = 520; let done = false;
      const show = (v) => { node.nodeValue = m[1] + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3]; };
      const finish = () => { done = true; node.nodeValue = text; };
      const step = (now) => { if (done) return; const k = Math.min(1, (now - t0) / dur); show(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); else finish(); };
      show(0); requestAnimationFrame(step); setTimeout(() => { if (!done) finish(); }, dur + 80);
    });
  }

  /* ---------------- import wizard ---------------- */
  async function loadCropTypes() {
    state.types = await call('cropTypesListServer');
    const box = $('cropChoices');
    const active = state.types.filter((t) => t.active);
    box.innerHTML = active.map((t) => `<button type="button" role="radio" aria-checked="${t.crop === state.crop}" data-crop="${esc(t.crop)}">${esc(t.crop)}<small>${esc(t.material)}</small></button>`).join('')
      || '<p class="adm-muted">ยังไม่มีชนิดพืชที่เปิดใช้งาน เพิ่มได้ที่เมนู "ชนิดพืช"</p>';
    box.querySelectorAll('[data-crop]').forEach((b) => b.addEventListener('click', () => chooseCrop(b.dataset.crop)));
  }

  function chooseCrop(crop) {
    state.crop = crop;
    $('cropChoices').querySelectorAll('[data-crop]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.crop === crop)));
    $('step1').classList.add('is-done');
    $('step2').classList.remove('is-locked');
    $('fileInput').disabled = false;
    $('dropText').textContent = `ลากไฟล์รายงาน ${crop} มาวาง หรือคลิกเพื่อเลือกไฟล์`;
    if (state.parsed) runCheck();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve();
      const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('โหลดตัวอ่านไฟล์ Excel ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'));
      document.head.appendChild(s);
    });
  }

  async function readFile(file) {
    if (!state.crop) { toast('กรุณาเลือกชนิดพืชก่อน'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 10 MB'); return; }
    state.file = file; state.parsed = null; state.check = null;
    $('step3').classList.remove('is-locked');
    $('previewBox').innerHTML = '<p class="adm-muted">กำลังอ่านไฟล์…</p>';
    setResult('commitResult', '');
    try {
      await loadScript(SHEETJS);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      state.parsed = window.ABM_CROP_IMPORT.parse(aoa);
      state.season = state.parsed.suggestedSeason;
      $('step2').classList.add('is-done');
      $('dropText').textContent = `ไฟล์: ${file.name} (เลือกไฟล์อื่นได้)`;
      await runCheck();
    } catch (err) {
      $('previewBox').innerHTML = `<div class="adm-note is-error">${esc(err.message)}</div>`;
    }
  }

  async function runCheck() {
    const p = state.parsed;
    state.check = null;
    lockCommit();
    renderPreview(null, null);
    if (!p.ok) return;
    try {
      state.check = await call('cropImportCheckServer', payload());
      renderPreview(state.check, null);
      $('step3').classList.add('is-done');
      $('step4').classList.remove('is-locked');
      $('commitBtn').disabled = false;
      $('commitBtn').textContent = `นำเข้าข้อมูล ${state.crop} ปี ${state.season}` + (state.check.replaces.length ? ' (แทนที่ชุดเดิม)' : '');
    } catch (err) {
      renderPreview(null, err.message);
    }
  }

  function payload() {
    return { crop: state.crop, season: state.season, monthType: 'harvest', fileName: state.file ? state.file.name : '',
      rows: state.parsed.rows.map((r) => ({ line: r.line, code: r.code, name: r.name, period: r.period, households: r.households, plots: r.plots, area: r.area })) };
  }

  function lockCommit() {
    $('step4').classList.add('is-locked'); $('step3').classList.remove('is-done');
    $('commitBtn').disabled = true; $('commitBtn').textContent = 'นำเข้าข้อมูล';
  }

  function renderPreview(check, serverError) {
    const p = state.parsed;
    if (!p) return;
    const max = Math.max(1, ...p.byPeriod.map((x) => x.areaRai));
    const months = p.byPeriod.map((x) => `<div class="adm-month"><span>${monthLabel(Number(x.period))}</span><i style="width:${(x.areaRai / max * 100).toFixed(1)}%"></i><span>${fmt(x.areaRai, 2)} ไร่</span></div>`).join('');
    const issues = p.errors.length
      ? `<div class="adm-note is-error"><strong>นำเข้าไม่ได้ ไฟล์มีปัญหา</strong><ul>${p.errors.slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
    const warns = (check ? check.warnings : p.warnings).length
      ? `<div class="adm-note"><ul>${(check ? check.warnings : p.warnings).slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
    const replace = check && check.replaces.length
      ? `<div class="adm-note"><strong>จะแทนที่ข้อมูลชุดเดิม</strong> ${check.replaces.map((r) => `${esc(r.fileName || r.importId)} (${fmt(r.totalRai, 2)} ไร่ นำเข้าเมื่อ ${esc(r.importedAt)})`).join(', ')}</div>`
      : (check ? '<div class="adm-note is-ok">ตรวจสอบผ่าน ผลรวมตำบล อำเภอ และจังหวัดตรงกันทุกเดือน ยังไม่มีข้อมูลชุดเดิมของพืชและปีนี้</div>' : '');
    const server = serverError ? `<div class="adm-note is-error"><strong>เซิร์ฟเวอร์ไม่รับข้อมูล</strong> ${esc(serverError)}</div>` : '';
    $('previewBox').innerHTML = `
      ${p.title ? `<p class="adm-muted">แหล่งข้อมูล: ${esc(p.title)}</p>` : ''}
      <div class="adm-stats">
        <div class="adm-stat"><b>${fmt(p.totalRai, 2)}</b><span>ไร่ พื้นที่ปลูกทั้งหมด</span></div>
        <div class="adm-stat"><b>${p.periods.length}</b><span>เดือน (${p.periods.length ? monthLabel(p.periods[0]) + ' – ' + monthLabel(p.periods[p.periods.length - 1]) : '–'})</span></div>
        <div class="adm-stat"><b>${p.districts}</b><span>อำเภอ</span></div>
        <div class="adm-stat"><b>${p.subdistricts}</b><span>ตำบล</span></div>
        <div class="adm-stat"><b>${fmt(p.rows.length)}</b><span>แถวข้อมูล</span></div>
      </div>
      <div class="adm-fields">
        <label>ชนิดพืช<span class="adm-fixed">${esc(state.crop)}</span></label>
        <label>ปีการผลิต<input id="seasonInput" value="${esc(state.season)}" pattern="\\d{4}(/\\d{2})?" maxlength="7" inputmode="numeric"></label>
        <label>ข้อมูลแยกตาม<span class="adm-fixed">เดือนที่คาดว่าจะเก็บเกี่ยว</span></label>
      </div>
      <div><h3>พื้นที่เก็บเกี่ยวรายเดือน</h3><div class="adm-months">${months}</div></div>
      ${issues}${server}${warns}${replace}`;
    const season = $('seasonInput');
    if (season) season.addEventListener('change', () => {
      const v = season.value.trim();
      if (!/^\d{4}(\/\d{2})?$/.test(v)) { toast('ปีการผลิตต้องเป็นรูปแบบ 2569 หรือ 2569/70'); season.value = state.season; return; }
      state.season = v; runCheck();
    });
  }

  const drop = $('dropZone');
  $('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (state.crop) drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });
  drop.addEventListener('click', (e) => { if (!state.crop) { e.preventDefault(); toast('กรุณาเลือกชนิดพืชก่อน'); } });

  $('commitBtn').addEventListener('click', () => {
    if (!state.check) return;
    const msg = `ยืนยันนำเข้า ${state.crop} ปี ${state.season} จำนวน ${fmt(state.parsed.totalRai, 2)} ไร่` + (state.check.replaces.length ? '\nข้อมูลชุดเดิมของพืชและปีนี้จะถูกแทนที่' : '');
    if (!window.confirm(msg)) return;
    busy($('commitBtn'), 'กำลังนำเข้า…', async () => {
      try {
        const r = await call('cropImportCommitServer', payload());
        setResult('commitResult', r.message + ' หน้าแรกอัปเดตแล้ว', true);
        $('step4').classList.add('is-done');
        state.check = null;
        $('commitBtn').disabled = true;
        toast('นำเข้าข้อมูลสำเร็จ');
      } catch (err) { setResult('commitResult', err.message, false); }
    }).then(() => { $('commitBtn').disabled = !state.check; });
  });

  $('resetBtn').addEventListener('click', () => {
    Object.assign(state, { crop: '', file: null, parsed: null, check: null });
    ['step1', 'step2', 'step3', 'step4'].forEach((id, i) => { $(id).classList.remove('is-done'); $(id).classList.toggle('is-locked', i > 0); });
    $('fileInput').disabled = true; $('previewBox').innerHTML = ''; setResult('commitResult', '');
    $('dropText').textContent = 'เลือกชนิดพืชก่อน แล้วลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์';
    $('commitBtn').disabled = true; $('commitBtn').textContent = 'นำเข้าข้อมูล';
    loadCropTypes().catch((err) => toast(err.message));
  });

  /* ---------------- history ---------------- */
  async function loadHistory() {
    const list = await call('cropImportsListServer');
    $('histBody').innerHTML = list.map((x) => `<tr>
      <td>${esc(x.crop)}</td><td>${esc(x.season)}</td><td class="num">${fmt(x.totalRai, 2)}</td><td>${esc(rangeLabel(x.periods))}</td>
      <td><span class="adm-badge ${esc(x.status)}">${esc(STATUS_TH[x.status] || x.status)}</span></td>
      <td>${esc(x.importedAt)}</td><td>${esc(x.importedBy)}</td>
      <td>${x.status === 'active' ? `<button type="button" class="danger" data-del="${esc(x.importId)}">ลบชุดนี้</button>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="8" class="adm-muted">ยังไม่มีการนำเข้าข้อมูล</td></tr>';
    $('histBody').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('ลบชุดข้อมูลนี้ออกจากหน้าแรก? (ข้อมูลยังเก็บเป็นประวัติ)')) return;
      try { toast((await call('cropImportDeleteServer', { importId: b.dataset.del })).message); loadHistory(); } catch (err) { toast(err.message); }
    }));
  }
  function rangeLabel(p) {
    const m = String(p || '').match(/^(\d{6})-(\d{6})$/);
    return m ? `${monthLabel(Number(m[1]))} – ${monthLabel(Number(m[2]))}` : p;
  }
  $('cacheBtn').addEventListener('click', async () => { try { toast((await call('cacheClearServer')).message); } catch (err) { toast(err.message); } });

  /* ---------------- crop types ---------------- */
  async function loadCropTypesTable() {
    state.types = await call('cropTypesListServer');
    $('cropTypesBody').innerHTML = state.types.map((t) => `<tr><td>${esc(t.crop)}</td><td>${esc(t.material)}</td><td class="num">${t.sortOrder}</td>
      <td><span class="adm-badge ${t.active ? 'active' : 'disabled'}">${t.active ? 'เปิดใช้งาน' : 'ปิด'}</span></td>
      <td><button type="button" data-edit="${esc(t.crop)}">แก้ไข</button></td></tr>`).join('');
    $('cropTypesBody').querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const t = state.types.find((x) => x.crop === b.dataset.edit); const f = $('cropTypeForm');
      f.crop.value = t.crop; f.material.value = t.material; f.sortOrder.value = t.sortOrder; f.active.checked = t.active; f.material.focus();
    }));
  }
  $('cropTypeForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try {
      await call('cropTypeSaveServer', { crop: f.crop.value, material: f.material.value, sortOrder: Number(f.sortOrder.value), active: f.active.checked });
      toast('บันทึกชนิดพืชแล้ว'); f.reset(); f.active.checked = true; loadCropTypesTable(); loadCropTypes();
    } catch (err) { toast(err.message); }
  });

  /* ---------------- API links (super) ---------------- */
  async function loadApi() {
    const s = await call('settingsGetServer');
    $('apiStatus').innerHTML = `<h3>สถานะ</h3><dl class="adm-kv">
      <dt>ABM API</dt><dd>รุ่น ${esc(s.apiVersion)}</dd>
      <dt>Green Gain Hub (ข้อมูลตลาด)</dt><dd>${s.ggh && s.ggh.linked ? 'เชื่อมแล้ว' : '<strong>ยังไม่ได้เชื่อม (รัน setupSystem)</strong>'}${s.ggh ? ` · <a href="${esc(s.ggh.site)}" target="_blank" rel="noopener">เปิดตลาด</a>` : ''}</dd>
      <dt>ฐานข้อมูล</dt><dd><a href="https://docs.google.com/spreadsheets/d/${esc(s.spreadsheetId)}/edit" target="_blank" rel="noopener">Google Sheet</a></dd>
      <dt>Smart Agri URL</dt><dd>${esc(s.smartAgri.url)}${s.smartAgri.urlIsDefault ? ' (ค่าเริ่มต้น)' : ''}</dd>
      <dt>Smart Agri API Key</dt><dd>${s.smartAgri.keySet ? 'บันทึกไว้แล้ว (' + esc(s.smartAgri.keyHint) + ')' : '<strong>ยังไม่ได้ตั้งค่า</strong>'}</dd></dl>`;
    $('apiForm').smartAgriUrl.value = s.smartAgri.url;
    $('apiEndpoints').innerHTML = s.publicEndpoints.map((p) => `<li><code>${esc(API + p)}</code></li>`).join('');
  }
  $('apiForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const input = { smartAgriUrl: f.smartAgriUrl.value.trim() };
    if (f.smartAgriKey.value.trim()) input.smartAgriKey = f.smartAgriKey.value.trim();
    if (f.clearSmartAgriKey.checked) input.clearSmartAgriKey = true;
    try {
      const r = await call('settingsSaveServer', input);
      f.smartAgriKey.value = ''; f.clearSmartAgriKey.checked = false;
      setResult('apiResult', 'บันทึกแล้ว: ' + (r.changed.join(', ') || 'ไม่มีการเปลี่ยนแปลง'), true); loadApi();
    } catch (err) { setResult('apiResult', err.message, false); }
  });
  $('apiTestBtn').addEventListener('click', () => busy($('apiTestBtn'), 'กำลังทดสอบ…', async () => {
    try { const r = await call('smartAgriTestServer'); setResult('apiResult', r.result, /^PASS/.test(r.result)); } catch (err) { setResult('apiResult', err.message, false); }
  }));
  $('gghTestBtn').addEventListener('click', () => busy($('gghTestBtn'), 'กำลังทดสอบ…', async () => {
    try { const r = await call('gghTestServer'); setResult('gghResult', r.result, /^PASS/.test(r.result)); } catch (err) { setResult('gghResult', err.message, false); }
  }));

  /* 1.1.0: how long a plot stays on the Green Gain Hub market after harvest — 1.4.0: shown only (set in Green Gain Hub) */
  const thaiDay = (iso) => { const d = new Date(String(iso || '') + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); };
  function showGghRule(rule) {
    const noDate = (rule.hidden || []).filter((h) => h.reason === 'no_harvest').length;
    $('gghRuleStatus').innerHTML = `<dl class="adm-kv">
      <dt>ค่าปัจจุบัน</dt><dd>${rule.hideAfterHarvestDays ? `แสดงถึง <strong>${esc(rule.hideAfterHarvestDays)} วัน</strong> หลังวันเก็บเกี่ยว` : '<strong>แสดงทุกแปลง</strong> (ไม่ซ่อน)'}</dd>
      ${rule.hideAfterHarvestDays && rule.startDate ? `<dt>เริ่มใช้กฎ</dt><dd>${esc(thaiDay(rule.startDate))} (แปลงที่ประกาศไว้ก่อนวันนี้ นับวันจากวันเริ่มใช้กฎ)</dd>` : ''}
      <dt>แปลงที่ผู้รับซื้อเห็นวันนี้</dt><dd>${esc(rule.listedPlots)} แปลง</dd>
      <dt>แปลงที่ซ่อน</dt><dd>${esc(rule.hiddenPlots)} แปลง${noDate ? ` (ไม่มีวันเก็บเกี่ยว ${esc(noDate)} แปลง)` : ''}</dd></dl>`;
  }
  async function loadGghRule() {
    // 1.4.0: read-only — Green Gain Hub's Super Admin sets the rule in Green Gain Hub
    try { const r = await call('gghMarketRuleServer'); showGghRule(r.rule); }
    catch (err) { $('gghRuleStatus').innerHTML = `<p class="adm-muted">อ่านค่าจาก Green Gain Hub ไม่ได้: ${esc(err.message)}</p>`; }
  }
  $('gghRuleForm').addEventListener('submit', (e) => e.preventDefault());

  /* ---------------- admins (super) ---------------- */
  async function loadAdmins() {
    const [list, meta] = await Promise.all([call('adminsListServer'), loadResidueMeta()]);
    const dname = (c) => (meta.districts.find((d) => d.code === c) || {}).name || '';
    const canTouch = (a) => a.role !== 'super' || state.me.role === 'super';
    const sel = $('adminDistrict');
    if (!sel.options.length) sel.innerHTML = '<option value="">เลือกอำเภอ</option>' + meta.districts.map((d) => `<option value="${esc(d.code)}">${esc(d.name)}</option>`).join('');
    if (!$('adminGroup').options.length) {
      const st = await call('staffMetaServer');
      $('adminGroup').innerHTML = '<option value="">เลือกกลุ่ม</option>' + st.groups.map((g) => `<option>${esc(g)}</option>`).join('');
    }
    const officeOf = (a) => (a.role !== 'admin' ? 'ทุกอำเภอ' : a.officeType === 'province' ? 'สนง.เกษตรจังหวัด' + (a.group ? ' · ' + a.group : '') : 'สนง.เกษตรอำเภอ' + (dname(a.district) || '<ไม่ได้กำหนด>'));
    const superOpt = $('adminRole').querySelector('option[value="super"]');
    if (superOpt) superOpt.hidden = superOpt.disabled = state.me.role !== 'super';
    syncAdminRole();
    // 1.2.0: self-registrations wait for approval — shown first with อนุมัติ / ไม่อนุมัติ
    list.sort((x, y) => (y.status === 'pending') - (x.status === 'pending'));
    const pend = list.filter((a) => a.status === 'pending').length;
    $('adminsPending').classList.toggle('hidden', !pend);
    $('adminsPending').innerHTML = pend ? `<strong>มีคำขอลงทะเบียนรออนุมัติ ${pend} รายการ</strong> — ตรวจชื่อ เบอร์ และสังกัดว่าเป็นเจ้าหน้าที่จริงก่อนกด "อนุมัติ"` : '';
    $('adminsBody').innerHTML = list.map((a) => `<tr${a.status === 'pending' ? ' class="adm-row-pending"' : ''}><td>${esc(a.name)}</td><td>${esc(a.username)}</td><td>${esc(a.phone || '–')}</td><td>${esc(ROLE_TH[a.role] || a.role)}</td>
      <td>${esc(officeOf(a))}${a.registeredVia === 'self' ? '<br><span class="adm-badge">ลงทะเบียนเอง</span>' : ''}</td>
      <td><span class="adm-badge ${esc(a.status)}">${esc(STATUS_TH[a.status] || a.status)}</span></td><td>${esc(a.lastLogin || '–')}</td>
      <td>${a.status === 'pending' ? `<button type="button" class="adm-btn-primary" data-approve="${esc(a.username)}">อนุมัติ</button><button type="button" data-reject="${esc(a.username)}">ไม่อนุมัติ</button>`
        : canTouch(a) ? `<button type="button" data-edit-admin="${esc(a.username)}">แก้ไข</button><button type="button" data-reset="${esc(a.username)}">ตั้งรหัสผ่านใหม่</button>` : '<span class="adm-muted">เฉพาะ Super Admin</span>'}</td></tr>`).join('');
    const decide = async (username, status) => {
      const a = list.find((x) => x.username === username);
      if (status === 'disabled' && !window.confirm('ไม่อนุมัติ ' + a.name + ' ? (บัญชีจะเป็นสถานะ "ระงับ" แก้ไขภายหลังได้)')) return;
      try {
        await call('adminSaveServer', { username: a.username, name: a.name, phone: a.phone, role: 'admin', status, officeType: a.officeType, group: a.group, district: a.district });
        toast(status === 'active' ? 'อนุมัติแล้ว ' + a.name + ' เข้าสู่ระบบด้วยหมายเลขโทรศัพท์ได้' : 'ไม่อนุมัติ ' + a.name);
        loadAdmins();
      } catch (err) { toast(err.message); }
    };
    $('adminsBody').querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.approve, 'active')));
    $('adminsBody').querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.reject, 'disabled')));
    $('adminsBody').querySelectorAll('[data-edit-admin]').forEach((b) => b.addEventListener('click', () => {
      const a = list.find((x) => x.username === b.dataset.editAdmin); const f = $('adminForm');
      f.name.value = a.name; f.username.value = a.username; f.username.readOnly = true; f.phone.value = a.phone || ''; f.role.value = a.role; f.status.value = a.status;
      f.district.value = a.district || ''; f.officeType.value = a.officeType === 'province' ? 'province' : 'district'; f.group.value = a.group || ''; syncAdminRole();
      $('adminPwLabel').classList.add('hidden'); $('adminFormTitle').textContent = 'แก้ไขผู้ดูแล ' + a.name; f.name.focus();
    }));
    $('adminsBody').querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
      const pw = window.prompt('รหัสผ่านใหม่สำหรับ ' + b.dataset.reset + ' (อย่างน้อย 8 ตัว)');
      if (!pw) return;
      try { toast((await call('adminResetPasswordServer', { username: b.dataset.reset, password: pw })).message); } catch (err) { toast(err.message); }
    }));
  }
  function syncAdminRole() {
    const isAdm = $('adminRole').value === 'admin', prov = $('adminOffice').value === 'province';
    $('adminOfficeWrap').classList.toggle('hidden', !isAdm);
    $('adminGroupWrap').classList.toggle('hidden', !isAdm || !prov);
    $('adminDistrictWrap').classList.toggle('hidden', !isAdm || prov);
  }
  $('adminRole').addEventListener('change', syncAdminRole);
  $('adminOffice').addEventListener('change', syncAdminRole);
  function resetAdminForm() {
    const f = $('adminForm'); f.reset(); f.username.readOnly = false; syncAdminRole(); $('adminPwLabel').classList.remove('hidden'); $('adminFormTitle').textContent = 'เพิ่มผู้ดูแล'; setResult('adminResult', '');
  }
  $('adminFormReset').addEventListener('click', resetAdminForm);
  $('adminForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const input = { name: f.name.value, username: f.username.value.trim().toLowerCase(), phone: f.phone.value.replace(/\D/g, ''), role: f.role.value, status: f.status.value, district: f.district.value, officeType: f.officeType.value, group: f.group.value };
    if (!f.username.readOnly) input.password = f.password.value;
    try { const r = await call('adminSaveServer', input); resetAdminForm(); setResult('adminResult', r.message, true); loadAdmins(); }
    catch (err) { setResult('adminResult', err.message, false); }
  });

  /* ---------------- log (super) ---------------- */
  async function loadLog() {
    const list = await call('adminLogServer');
    $('logBody').innerHTML = list.map((l) => `<tr><td>${esc(l.time)}</td><td>${esc(l.name)}<br><span class="adm-muted">${esc(l.username)}</span></td>
      <td>${esc(ACTION_TH[l.action] || l.action)}</td><td>${esc(l.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="adm-muted">ยังไม่มีบันทึก</td></tr>';
  }

  /* ---------------- account ---------------- */
  async function loadAccount() {
    const me = state.me;
    const phoneOnly = me.hasPassword === false;
    $('accInfo').innerHTML = `<dl class="adm-kv"><dt>ชื่อ</dt><dd>${esc(me.name)}</dd><dt>บทบาท</dt><dd>${esc(me.roleLabel || ROLE_TH[me.role] || me.role)}</dd>
      ${me.officeLabel ? `<dt>หน่วยงาน</dt><dd>${esc(me.officeLabel)}</dd>` : ''}<dt>การเข้าสู่ระบบ</dt><dd>${phoneOnly ? 'หมายเลขโทรศัพท์ที่ลงทะเบียน' : 'ชื่อผู้ใช้และรหัสผ่าน'}</dd></dl>
      ${phoneOnly ? '<p class="adm-muted">ถ้าเปลี่ยนหมายเลขโทรศัพท์หรือย้ายหน่วยงาน กรุณาแจ้งผู้ดูแลระบบของจังหวัด</p>' : ''}`;
    $('pwForm').classList.toggle('hidden', phoneOnly);
    const officer = me.role === 'admin';
    $('accDevices').classList.toggle('hidden', !officer);
    if (officer) $('accDeviceText').textContent = window.ABM_STAFF.hasDevice()
      ? 'เครื่องนี้จดจำไว้ 30 วัน เปิดหน้าเจ้าหน้าที่ได้โดยไม่ต้องกรอกเบอร์ ถ้าทำเครื่องหาย หรือเคยติ๊กจดจำไว้บนเครื่องที่ใช้ร่วมกัน ให้กดปุ่มด้านล่าง'
      : 'เครื่องนี้ไม่ได้จดจำไว้ ถ้าเคยติ๊ก "จดจำเครื่องนี้" บนเครื่องอื่น กดปุ่มด้านล่างเพื่อให้เครื่องเหล่านั้นต้องเข้าสู่ระบบใหม่';
  }
  $('accForgetAll').addEventListener('click', async () => {
    try { const r = await call('deviceForgetAllServer'); window.ABM_STAFF.forgetDevice(); setResult('accDeviceResult', r.message, true); loadAccount(); }
    catch (err) { setResult('accDeviceResult', err.message, false); }
  });
  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.next.value !== f.confirm.value) { setResult('pwResult', 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', false); return; }
    try { const r = await call('adminChangePasswordServer', { current: f.current.value, next: f.next.value }); f.reset(); setResult('pwResult', r.message, true); }
    catch (err) { setResult('pwResult', err.message, false); }
  });

  /* ---------------- reports ---------------- */
  const rep = { catalog: null, data: null, request: null, type: '' };
  const CONTACT_SECTIONS = ['market.plots', 'market.buyers'];

  async function loadReportCatalog() {
    if (rep.catalog) return;
    rep.catalog = await call('reportCatalogServer');
    const c = rep.catalog;
    $('reportCrop').innerHTML = c.crops.length ? c.crops.map((x) => `<option value="${esc(x.key)}">${esc(x.crop)} ปี ${esc(x.season)}</option>`).join('') : '<option value="">ยังไม่มีข้อมูลเพาะปลูก</option>';
    $('reportCropFields').classList.toggle('hidden', !c.crops.length && level(state.me.role) < 2);
    fillAsOf();
    $('reportFy').innerHTML = c.fiscalYears.map((y) => `<option value="${y}" ${y === c.fy ? 'selected' : ''}>${y}${y === c.fy ? ' (ปีปัจจุบัน)' : ''}</option>`).join('');
    $('reportDistrict').innerHTML = (c.district ? '' : `<option value="">ทั้งจังหวัด${esc(c.province)}</option>`) +
      c.districts.map((d) => `<option value="${esc(d.code)}">อำเภอ${esc(d.name)}</option>`).join('');
    $('reportDistrict').disabled = !!c.district;
    $('reportSections').innerHTML = c.groups.map((g) => `<fieldset class="adm-section-group"><legend>${esc(g.title)}</legend>` +
      g.sections.map((x) => `<label class="adm-check ${x.allowed ? '' : 'is-disabled'}"><input type="checkbox" name="section" value="${esc(x.key)}" ${x.allowed ? '' : 'disabled'}>` +
        `${esc(x.title)}${x.superOnly ? ' <span class="adm-badge disabled">Mini/Super Admin</span>' : ''}</label>`).join('') + '</fieldset>').join('');
    $('reportSections').addEventListener('change', () => { rep.type = ''; markType(); syncReportForm(); syncReportTitle(); });
    // 2.2.0: four report types instead of a long list (the list stays under "ปรับแต่ง").
    // 1.5.0: the one-page executive summary comes first and is chosen by default; the longer types sit under "รายงานอื่น".
    const typeBtn = (t) => `<button type="button" role="radio" aria-checked="false" data-rtype="${esc(t.key)}" class="${t.primary ? 'is-primary' : ''}">
      <b>${esc(t.title)}</b><span>${esc(t.desc)}</span></button>`;
    const types = c.types || [], main = types.filter((t) => t.primary), rest = types.filter((t) => !t.primary);
    $('reportTypes').innerHTML = main.map(typeBtn).join('') + (rest.length ? `<p class="adm-rtypes-more">รายงานอื่น</p>` + rest.map(typeBtn).join('') : '');
    $('reportTypes').querySelectorAll('[data-rtype]').forEach((b) => b.addEventListener('click', () => chooseType(b.dataset.rtype)));
    fillGghProvinces();
    const first = (c.types || []).find((t) => t.primary);
    chooseType(first ? first.key : c.district ? 'district' : (c.types.find((t) => t.key === 'province') ? 'province' : 'district'));
  }
  // 1.3.0: Green Gain Hub covers 77 provinces — Super Admin picks one (or all); others report Kamphaeng Phet only
  async function fillGghProvinces() {
    const sel = $('reportGghProvince'), g = rep.catalog.ggh || { provinceChoice: false, province: '62' };
    sel.innerHTML = '<option value="62">กำแพงเพชร</option>';
    sel.disabled = !g.provinceChoice;
    if (!g.provinceChoice) return;
    let list = [];
    try {
      const r = await fetch('/Green_Gain_Hub-KPP/geo/provinces.json', { cache: 'force-cache' });
      if (r.ok) list = ((await r.json()).provinces || []).map((p) => ({ code: String(p.code), name: String(p.name) }));
    } catch (err) { list = []; }
    list = list.filter((p) => /^\d{2}$/.test(p.code) && p.code !== '62').sort((a, b) => a.name.localeCompare(b.name, 'th'));
    sel.innerHTML = '<option value="62">กำแพงเพชร</option><option value="ALL">ทุกจังหวัด (สรุปรายจังหวัด)</option>' +
      list.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');
    sel.value = g.province || '62';
  }
  function markType() { $('reportTypes').querySelectorAll('[data-rtype]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.rtype === rep.type))); }
  function chooseType(key) {
    const t = (rep.catalog.types || []).find((x) => x.key === key); if (!t) return;
    rep.type = key; markType();
    document.querySelectorAll('#reportSections input[name="section"]').forEach((i) => { i.checked = !i.disabled && t.sections.includes(i.value); });
    if (t.scope === 'province' && !rep.catalog.district) $('reportDistrict').value = '';
    if (t.scope === 'district' && !rep.catalog.district && !$('reportDistrict').value && rep.catalog.districts.length) {
      $('reportDistrict').value = rep.catalog.districts[0].code;
      toast('รายงานอำเภอ: เลือกอำเภอที่ต้องการได้ที่ช่อง "พื้นที่"');
    }
    syncReportForm(); syncReportTitle();
  }
  function fillAsOf() {
    const c = rep.catalog.crops.find((x) => x.key === $('reportCrop').value);
    const sel = $('reportAsOf');
    if (!c) { sel.innerHTML = ''; return; }
    const add = (ym, n) => { const y = Math.floor(ym / 100), m = ym % 100 - 1 + n; return (y + Math.floor(m / 12)) * 100 + ((m % 12) + 12) % 12 + 1; };
    const opts = [];
    for (let ym = add(c.firstMonth, -1); ym <= c.lastMonth; ym = add(ym, 1)) opts.push(ym);
    if (!opts.includes(c.asOfMonth)) opts.push(c.asOfMonth);
    opts.sort((a, b) => a - b);
    sel.innerHTML = opts.map((ym) => `<option value="${ym}" ${ym === c.asOfMonth ? 'selected' : ''}>${monthLabel(ym)}${ym === c.asOfMonth ? ' (เดือนที่ผ่านมา)' : ''}</option>`).join('');
  }
  function chosenSections() { return [...document.querySelectorAll('#reportSections input[name="section"]:checked')].map((i) => i.value); }
  function syncReportForm() {
    const keys = chosenSections();
    $('reportCropFields').querySelectorAll('select[name="cropKey"], select[name="asOf"]').forEach((el) => { el.disabled = !keys.some((k) => k.startsWith('crops.')); });
    $('reportFy').disabled = !keys.some((k) => k.startsWith('residue.'));
    $('reportDistrict').disabled = !!(rep.catalog && rep.catalog.district) || !keys.some((k) => k.startsWith('residue.'));
    $('reportUnmaskWrap').classList.toggle('hidden', !(state.me && level(state.me.role) >= 2 && keys.some((k) => CONTACT_SECTIONS.includes(k))));
    $('reportBuild').disabled = !keys.length;
    $('reportPicked').textContent = `(เลือกไว้ ${keys.length} ส่วน)`;
    $('reportCropFields').classList.toggle('hidden', !keys.some((k) => k.startsWith('crops.')));
    // 1.4.0: the province also applies to the contact lists of plots / buyer points (Super Admin)
    $('reportGghFields').classList.toggle('hidden', !keys.some((k) => k.startsWith('ggh.') || k === 'market.plots' || k === 'market.buyers'));
  }
  function syncReportTitle() {
    const c = rep.catalog; if (!c) return;
    const sel = $('reportDistrict'), d = c.districts.find((x) => x.code === sel.value);
    const t = (c.types || []).find((x) => x.key === rep.type);
    if (t && t.key === 'executive') {
      const ps = $('reportGghProvince'), v = ps.value;
      $('reportTitle').value = v === 'ALL' ? 'รายงานผู้บริหาร ตลาดวัสดุเหลือใช้ทางการเกษตร Green Gain Hub ทุกจังหวัด'
        : `รายงานผู้บริหาร ตลาดวัสดุเหลือใช้ทางการเกษตร Green Gain Hub จังหวัด${(ps.selectedOptions[0] || {}).textContent || c.province}`;
      return;
    }
    const what = t && t.key === 'summary' ? 'สรุปผู้บริหาร การใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร' : t && t.key === 'ghg' ? 'ภาคผนวกการคำนวณก๊าซเรือนกระจกจากการจัดการวัสดุเหลือใช้ทางการเกษตร' : t && t.key === 'register' ? 'ทะเบียนรายการบันทึกการจัดการวัสดุเหลือใช้ทางการเกษตร' : 'รายงานการจัดการวัสดุเหลือใช้ทางการเกษตร';
    $('reportTitle').value = `${what}${d ? ' อำเภอ' + d.name : ''} จังหวัด${c.province}`;
  }
  $('reportDistrict').addEventListener('change', syncReportTitle);
  $('reportGghProvince').addEventListener('change', syncReportTitle);
  $('reportCrop').addEventListener('change', fillAsOf);

  $('reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const input = { title: f.title.value.trim(), sections: chosenSections(), cropKey: f.cropKey.value, asOf: Number(f.asOf.value) || undefined,
      fy: Number($('reportFy').value) || undefined, district: $('reportDistrict').value, gghProvince: $('reportGghProvince').value || '62', gghProvinceName: ($('reportGghProvince').selectedOptions[0] || {}).textContent || '',
      unmaskPhones: !!(f.unmaskPhones && f.unmaskPhones.checked && !$('reportUnmaskWrap').classList.contains('hidden')) };
    busy($('reportBuild'), 'กำลังสร้างรายงาน…', async () => {
      try {
        rep.data = await call('reportDataServer', input);
        rep.request = input;
        if (rep.data.sections.some((x) => x.map)) await loadGeo().catch(() => null);
        renderReport(rep.data);
        setResult('reportResult', `สร้างรายงานแล้ว ${rep.data.sections.length} ส่วน`, true);
        $('reportActions').classList.remove('hidden');
        $('reportDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { setResult('reportResult', err.message, false); }
    });
  });

  const numDigits = (v) => { const x = Math.abs(v); return x && x < 0.01 ? 6 : x && x < 1 ? 4 : 2; };
  const cellText = (v, type) => (v === null || v === undefined || v === '' ? '' : type === 'number' && typeof v === 'number' ? fmt(v, numDigits(v)) : String(v));
  // printHide columns stay on screen and in Excel/CSV but are left out of the printed page.
  const cls = (c) => [c.type === 'number' ? 'num' : '', c.printHide ? 'print-hide' : ''].join(' ').trim();
  // 2.4.3: "ชื่อคอลัมน์ (หน่วย)" → name on the first line, unit on the second, so long headers do not widen the table.
  const headLabel = (s) => { const m = String(s == null ? '' : s).match(/^(.+?)\s*(\([^()]+\))$/); return m ? `${esc(m[1])}<span class="adm-th-unit">${esc(m[2])}</span>` : esc(s); };
  function renderReport(d) {
    const doc = $('reportDoc');
    doc.classList.remove('hidden');
    // When the first section is wide, the title block shares its landscape page (no half-empty first page).
    doc.classList.toggle('first-wide', !!(d.sections[0] && d.sections[0].landscape));
    doc.innerHTML = `<header class="adm-report-head">
        <p class="adm-report-office">${esc(d.office)}</p>
        <h1>${esc(d.title)}</h1>
        ${d.residue ? `<p>${esc(residueScope(d.residue))}</p>` : ''}
        ${d.crop ? `<p>${esc(d.crop.crop)} ปีการผลิต ${esc(d.crop.season)} ข้อมูล ณ สิ้น${esc(monthLabel(d.crop.asOf))}</p>` : ''}
        <p class="adm-muted">จัดทำเมื่อ ${esc(d.generatedAt)} โดย ${esc(d.generatedBy)}${d.sections.some((x) => CONTACT_SECTIONS.includes(x.key)) ? (d.phonesMasked ? ' · ปิดบังเบอร์โทร' : ' · แสดงเบอร์โทรเต็ม') : ''}</p>
      </header>` + d.sections.map((sec) => `<section class="adm-report-sec${sec.landscape ? ' is-landscape' : ''}">
        <h2>${esc(sec.group)}: ${esc(sec.title)}</h2>
        ${sec.subtitle ? `<p class="adm-muted">${esc(sec.subtitle)}</p>` : ''}
        ${sec.kpis ? `<div class="adm-report-kpis">${sec.kpis.map((k) => `<div><span>${esc(k.label)}</span><b>${esc(cellText(k.value, 'number'))}</b><small>${esc(k.unit || '')}</small></div>`).join('')}</div>` : ''}
        ${sec.map ? mapSvg(sec.map) : ''}
        <div class="adm-report-tablewrap"><table class="${sec.columns.filter((c) => !c.printHide).length > 9 ? 'is-wide' : ''}"><thead><tr>${sec.columns.map((c) => `<th class="${cls(c)}" scope="col">${headLabel(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${sec.rows.length ? sec.rows.map((r) => `<tr>${sec.columns.map((c) => `<td class="${cls(c)}">${esc(cellText(r[c.key], c.type))}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${sec.columns.length}" class="adm-muted">ไม่มีข้อมูล</td></tr>`}</tbody>
        ${sec.totals ? `<tfoot><tr>${sec.columns.map((c) => `<td class="${cls(c)}">${esc(cellText(sec.totals[c.key], c.type))}</td>`).join('')}</tr></tfoot>` : ''}
        </table></div>
        ${(sec.notes || []).map((n) => `<p class="adm-report-note">${esc(n)}</p>`).join('')}
      </section>`).join('');
    // the report is a print document: its numbers do not animate
  }

  function stamp() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
  function logExport(format) { call('reportExportLogServer', { format, sections: rep.request.sections, unmaskPhones: rep.request.unmaskPhones }).catch(() => {}); }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('reportPrint').addEventListener('click', () => {
    if (!rep.data) return;
    let style = $('reportPageStyle');
    if (!style) { style = document.createElement('style'); style.id = 'reportPageStyle'; document.head.appendChild(style); }
    // 2.4.3: one orientation for the whole report. Chrome lays the whole document out at one width, so mixing
    // portrait and landscape pages cut wide tables at the page edge. auto = landscape when any section is wide.
    const pick = $('reportForm').orientation.value;
    const o = pick === 'auto' ? (rep.data.sections.some((x) => x.landscape) ? 'landscape' : 'portrait') : pick;
    const mm = o === 'landscape' ? 10 : 12;
    style.textContent = `@page { size: A4 ${o}; margin: ${mm}mm; } @page wide { size: A4 ${o}; margin: ${mm}mm; }`;
    document.body.classList.toggle('print-all-landscape', o === 'landscape');
    document.body.classList.add('is-printing-report');
    logExport('print');
    setTimeout(() => { window.print(); document.body.classList.remove('is-printing-report'); }, 50);
  });

  $('reportCsv').addEventListener('click', () => {
    if (!rep.data) return;
    const q = (v) => { const t = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const lines = [[rep.data.title], [rep.data.office], ['จัดทำเมื่อ', rep.data.generatedAt, 'โดย', rep.data.generatedBy]];
    if (rep.data.crop) lines.push([rep.data.crop.crop, 'ปีการผลิต ' + rep.data.crop.season, 'ข้อมูล ณ สิ้น' + monthLabel(rep.data.crop.asOf)]);
    if (rep.data.residue) lines.push([residueScope(rep.data.residue)]);
    rep.data.sections.forEach((sec) => {
      lines.push([], [sec.group + ': ' + sec.title]);
      if (sec.subtitle) lines.push([sec.subtitle]);
      (sec.kpis || []).forEach((k) => lines.push([k.label, k.value, k.unit || '']));
      lines.push(sec.columns.map((c) => c.label));
      sec.rows.forEach((r) => lines.push(sec.columns.map((c) => r[c.key])));
      if (sec.totals) lines.push(sec.columns.map((c) => sec.totals[c.key]));
      (sec.notes || []).forEach((n) => lines.push([n]));
    });
    // BOM so Excel opens Thai text as UTF-8.
    download(new Blob(['\ufeff' + lines.map((l) => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `ABM_report_${stamp()}.csv`);
    logExport('csv');
  });

  $('reportXlsx').addEventListener('click', () => busy($('reportXlsx'), 'กำลังสร้างไฟล์…', async () => {
    if (!rep.data) return;
    try {
      await loadScript(SHEETJS);
      const wb = XLSX.utils.book_new();
      const cover = [[rep.data.title], [rep.data.office], ['จัดทำเมื่อ', rep.data.generatedAt], ['โดย', rep.data.generatedBy]];
      if (rep.data.crop) cover.push(['พืช', rep.data.crop.crop + ' ปีการผลิต ' + rep.data.crop.season], ['ข้อมูล ณ สิ้น', monthLabel(rep.data.crop.asOf)]);
      if (rep.data.residue) cover.push(['ขอบเขต', residueScope(rep.data.residue)]);
      cover.push([], ['ส่วนของรายงาน']);
      rep.data.sections.forEach((sec, i) => cover.push([`${i + 1}. ${sec.group}: ${sec.title}`]));
      const cws = XLSX.utils.aoa_to_sheet(cover); cws['!cols'] = [{ wch: 28 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, cws, 'สรุป');
      const used = new Set(['สรุป']);
      rep.data.sections.forEach((sec, i) => {
        const aoa = [[sec.group + ': ' + sec.title]];
        if (sec.subtitle) aoa.push([sec.subtitle]);
        (sec.kpis || []).forEach((k) => aoa.push([k.label, k.value, k.unit || '']));
        if (sec.kpis) aoa.push([]);
        aoa.push(sec.columns.map((c) => c.label));
        sec.rows.forEach((r) => aoa.push(sec.columns.map((c) => r[c.key] === undefined ? '' : r[c.key])));
        if (sec.totals) aoa.push(sec.columns.map((c) => sec.totals[c.key] === undefined ? '' : sec.totals[c.key]));
        (sec.notes || []).forEach((n) => aoa.push([n]));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = sec.columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.label.length + 2)) }));
        let name = `${i + 1} ${sec.title}`.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim();
        while (used.has(name)) name = name.slice(0, 28) + ' ' + i;
        used.add(name);
        XLSX.utils.book_append_sheet(wb, ws, name);
      });
      XLSX.writeFile(wb, `ABM_report_${stamp()}.xlsx`);
      logExport('xlsx');
    } catch (err) { toast(err.message); }
  }));

  /* ================= 2.0.0: residue management, GHG, targets ================= */
  const GEO_URL = 'assets/kpp-districts.geojson?v=1.5.0';
  const fmtG = (n) => fmt(n, n !== null && Math.abs(n) < 10 ? 3 : 2);
  function residueScope(r) {
    return `ปีงบประมาณ ${r.fy} (${r.fyRange}) · ${r.district ? 'อำเภอ' + r.districtName : 'ทั้งจังหวัด'} · ชุดค่า ${r.params}`;
  }

  /* ---------- district map for reports (SVG, prints without map tiles) ---------- */
  let geo = null;
  async function loadGeo() {
    if (geo) return geo;
    const r = await fetch(GEO_URL); if (!r.ok) throw new Error('โหลดขอบเขตอำเภอไม่สำเร็จ');
    geo = await r.json(); return geo;
  }
  function mapSvg(m) {
    if (!geo) return '<p class="adm-muted">โหลดแผนที่ไม่สำเร็จ แสดงเฉพาะตาราง</p>';
    const pts = [];
    geo.features.forEach((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach((poly) => poly[0].forEach((p) => pts.push(p))));
    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    const W = 520, scale = W / ((maxX - minX) * kx), H = Math.round((maxY - minY) * scale);
    const xy = (p) => `${((p[0] - minX) * kx * scale).toFixed(1)},${((maxY - p[1]) * scale).toFixed(1)}`;
    const vals = Object.values(m.values).map(Number);
    const max = Math.max(0, ...vals);
    const ramp = ['#e3efe4', '#b9dcbe', '#86c290', '#4f9f5c', '#1f6b31'];
    const color = (v) => (!v || !max ? '#eceeea' : ramp[Math.min(4, Math.floor((v / max) * 5 - 1e-9))]);
    const paths = geo.features.map((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const d = polys.map((poly) => poly.map((ring) => 'M' + ring.map(xy).join('L') + 'Z').join('')).join('');
      const v = Number(m.values[f.properties.code]) || 0;
      return `<path d="${d}" fill="${color(v)}" stroke="#fff" stroke-width="1.2"><title>อ.${esc(f.properties.name)}: ${fmtG(v)} ${esc(m.unit)}</title></path>`;
    }).join('');
    const labels = geo.features.map((f) => {
      const [x, y] = xy([f.properties.lon, f.properties.lat]).split(',');
      const v = Number(m.values[f.properties.code]) || 0;
      const dark = max && v / max > 0.6;
      return `<text x="${x}" y="${y}" text-anchor="middle" class="${dark ? 'on-dark' : ''}">${esc(f.properties.name)}<tspan x="${x}" dy="1.15em">${v ? fmtG(v) : '–'}</tspan></text>`;
    }).join('');
    const legend = max ? ramp.map((c, i) => `<span><i style="background:${c}"></i>${fmtG(max * i / 5)}–${fmtG(max * (i + 1) / 5)}</span>`).join('') : '<span>ยังไม่มีข้อมูล</span>';
    return `<figure class="adm-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="แผนที่ ${esc(m.unit)} รายอำเภอ">${paths}${labels}</svg>
      <figcaption><b>${esc(m.unit)}</b> ${legend}</figcaption></figure>`;
  }

  /* ---------- reference data ---------- */
  const res = { meta: null, editing: null, photos: [], gps: null, gpsTried: false, crop: '', method: '', list: [] };
  async function loadResidueMeta(force) {
    if (!res.meta || force) res.meta = await call('residueMetaServer');
    return res.meta;
  }
  const subsOf = (district) => (res.meta ? res.meta.subdistricts.filter((t) => !district || t.district === district) : []);

  /* ---------- record form ---------- */
  async function loadRecordView() {
    const m = await loadResidueMeta();
    const f = $('recForm');
    const isAdmin = districtScoped();
    f.date.max = m.today;
    if (!f.date.value) f.date.value = m.today;
    $('recDistrictWrap').classList.toggle('hidden', isAdmin);
    if (!isAdmin && $('recDistrict').options.length !== m.districts.length + 1) {
      $('recDistrict').innerHTML = '<option value="">เลือกอำเภอ</option>' + m.districts.map((d) => `<option value="${esc(d.code)}">${esc(d.name)}</option>`).join('');
    }
    if (!$('recSubdistrict').options.length) fillRecSubs();
    $('recScope').textContent = isAdmin ? `อำเภอ${m.districtName} จังหวัด${m.province} · บันทึกได้เฉพาะตำบลในอำเภอที่ลงทะเบียน` : `จังหวัด${m.province} (บันทึกได้ทุกอำเภอ${state.me.role === 'admin' ? ' แก้ไขได้เฉพาะรายการของตนเอง' : ''})`;
    $('recRecorder').textContent = state.me.name;
    requestAnimationFrame(renderReview);
    fillBuyers();
    renderRecChips();
    if (!res.gpsTried) { res.gpsTried = true; getGps(); }
  }
  function fillRecSubs(keep) {
    const district = districtScoped() ? state.me.district : $('recDistrict').value;
    const subs = subsOf(district);
    $('recSubdistrict').innerHTML = (district ? '<option value="">เลือกตำบล</option>' : '<option value="">เลือกอำเภอก่อน</option>') +
      subs.map((t) => `<option value="${esc(t.code)}">${esc(t.name)}</option>`).join('');
    if (keep && subs.some((t) => t.code === keep)) $('recSubdistrict').value = keep;
  }
  $('recDistrict').addEventListener('change', () => { fillRecSubs(); fillBuyers(); });
  /* Buyers of the chosen district first, then the rest of the province (name and residue only). */
  function fillBuyers(keep) {
    const m = res.meta; if (!m) return;
    const sel = $('recBuyer'), cur = keep !== undefined ? keep : sel.value;
    const d = districtScoped() ? state.me.district : $('recDistrict').value;
    const opt = (b) => `<option value="${esc(b.id)}">${esc(b.name)}${b.material ? ' · ' + esc(b.material) : ''}${b.districtName ? ' (อ.' + esc(b.districtName) + ')' : ''}</option>`;
    const near = (m.buyers || []).filter((b) => d && b.district === d), rest = (m.buyers || []).filter((b) => !(d && b.district === d));
    sel.innerHTML = '<option value="">ไม่ระบุ / ไม่ได้ขายผ่านระบบ</option>' +
      (near.length ? `<optgroup label="ในอำเภอนี้">${near.map(opt).join('')}</optgroup>` : '') +
      (rest.length ? `<optgroup label="${near.length ? 'อำเภออื่น' : 'ผู้รับซื้อในจังหวัด'}">${rest.map(opt).join('')}</optgroup>` : '');
    if (!(m.buyers || []).length) sel.innerHTML = '<option value="">ยังไม่มีผู้รับซื้อที่เปิดรับซื้อในระบบ</option>';
    sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  }
  function renderRecChips() {
    const m = res.meta; if (!m) return;
    $('recCrops').innerHTML = m.crops.map((c) => `<button type="button" role="radio" aria-checked="${c.key === res.crop}" data-crop="${esc(c.key)}">${esc(c.name)}<small>${esc(c.residueName || '')}</small></button>`).join('');
    $('recMethods').innerHTML = m.methods.map((x) => {
      const off = x.cropKey && res.crop && x.cropKey !== res.crop;
      const only = x.cropKey ? (m.crops.find((c) => c.key === x.cropKey) || {}).name : '';
      return `<button type="button" role="radio" aria-checked="${x.method === res.method}" data-method="${esc(x.method)}" ${off ? 'disabled' : ''} title="${only ? 'ใช้กับ' + esc(only) + 'เท่านั้น' : ''}">${esc(x.method)}${only ? `<small>${esc(only)}</small>` : ''}</button>`;
    }).join('');
    $('recCrops').querySelectorAll('[data-crop]').forEach((b) => b.addEventListener('click', () => {
      res.crop = b.dataset.crop;
      const mm = m.methods.find((x) => x.method === res.method);
      if (mm && mm.cropKey && mm.cropKey !== res.crop) res.method = '';
      renderRecChips();
    }));
    $('recMethods').querySelectorAll('[data-method]').forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      res.method = b.dataset.method;
      const mm = m.methods.find((x) => x.method === res.method);
      if (mm && mm.cropKey && !res.crop) res.crop = mm.cropKey;
      renderRecChips();
    }));
    $('recCropOtherWrap').classList.toggle('hidden', res.crop !== 'other');
    const mm = m.methods.find((x) => x.method === res.method);
    $('recMethodOtherWrap').classList.toggle('hidden', !(mm && mm.needsDetail));
    estimate();
  }

  /* Live estimate with the same parameter set the server uses. */
  function estimate() {
    const m = res.meta, f = $('recForm'), el = $('recEstimate');
    const area = Number(f.area.value), crop = m && m.crops.find((c) => c.key === res.crop);
    if (!crop || !(area > 0)) { el.textContent = ''; return; }
    const ef = m.params.combinedEf;
    const mb = Number(f.mb.value) || (Number(f.fresh.value) && Number(f.dmf.value) ? Number(f.fresh.value) * Number(f.dmf.value) : 0);
    const cf = f.cf.value !== '' ? Number(f.cf.value) : crop.cf;
    let burned = null, tons = crop.residueTRai !== null ? area * crop.residueTRai : null, how = '';
    if (mb) { burned = cf !== null ? mb * cf : null; tons = area * mb / 1000; how = 'ค่าจากพื้นที่จริง'; }
    else if (m.params.mode === 'residue' && crop.residueTRai !== null && crop.cf !== null) { burned = crop.residueTRai * 1000 * crop.cf; how = 'วัสดุเหลือใช้ทางการเกษตรต่อไร่ × Cf'; }
    else if (crop.hasStandard) { burned = crop.consumedKgRai; how = 'IPCC Standard'; }
    const ghg = burned === null ? null : area * burned * ef / 1e6;
    const mm = m.methods.find((x) => x.method === res.method);
    const counted = mm ? mm.countValue !== false : true;
    const sold = f.soldTonnes.value !== '' ? Number(f.soldTonnes.value) : null;
    const basis = sold !== null ? sold : tons;
    const value = basis !== null && crop.priceBahtKg !== null && res.method ? (counted ? basis * 1000 * crop.priceBahtKg : 0) : null;
    el.innerHTML = `ประมาณการ: ${tons !== null ? `วัสดุเหลือใช้ทางการเกษตร ≈ <b>${fmt(tons, 2)}</b> ตัน · ` : ''}` +
      (value !== null ? (counted ? `มูลค่า ≈ <b>${fmtBaht(value)}</b> บาท <span class="adm-muted">(${sold !== null ? 'จากปริมาณที่ขายจริง ' : ''}${fmt(crop.priceBahtKg, 2)} บาท/กก.${crop.useGlobalPrice ? ' ราคากลาง' : ''})</span> · ` : '<span class="adm-muted">ประเภทนี้ไม่นับมูลค่า</span> · ') : '') +
      (ghg !== null ? `ก๊าซเรือนกระจกที่ลดได้ ≈ <b>${fmtG(ghg)}</b> ${UNIT} <span class="adm-muted">(${how})</span>`
        : `<span class="adm-muted">${esc(crop.name)}ยังไม่มีค่ามาตรฐาน จะคำนวณก๊าซเรือนกระจกเมื่อกรอกชีวมวลจากพื้นที่จริงพร้อมแหล่งอ้างอิง</span>`);
  }
  ['area', 'mb', 'fresh', 'dmf', 'cf', 'soldTonnes'].forEach((n) => $('recForm')[n].addEventListener('input', estimate));

  /* 1.5.0: the review box beside the form repeats what will be saved, so the officer checks it in one look before pressing save. */
  const SAVE_LABEL = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> บันทึกข้อมูล';
  function renderReview() {
    const f = $('recForm'), box = $('recReview'); if (!f || !box) return;
    const m = res.meta, opt = (sel) => (sel && sel.selectedIndex >= 0 && sel.value ? sel.options[sel.selectedIndex].text : '');
    const crop = m && m.crops.find((c) => c.key === res.crop);
    const cropName = res.crop === 'other' && f.cropOther.value.trim() ? f.cropOther.value.trim() : (crop ? crop.name : '');
    const method = res.method ? res.method + (f.methodOther.value.trim() ? ': ' + f.methodOther.value.trim() : '') : '';
    const area = Number(f.area.value);
    const dateText = f.date.value ? new Date(f.date.value + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const place = [opt(f.subdistrict) && 'ต.' + opt(f.subdistrict), (opt(f.district) || (m && m.districtName)) && 'อ.' + (opt(f.district) || m.districtName)].filter(Boolean).join(' ');
    const row = (k, v, need) => `<div class="${v ? '' : need ? 'is-missing' : 'is-empty'}"><dt>${k}</dt><dd>${v ? esc(v) : need ? 'ยังไม่ได้กรอก' : '–'}</dd></div>`;
    box.innerHTML = row('วันที่', dateText, true) + row('สถานที่', place && opt(f.subdistrict) ? place : '', true) + row('ชนิดพืช', cropName, true) +
      row('วิธีจัดการ', method, true) + row('พื้นที่', area > 0 ? fmt(area, 2) + ' ไร่' : '', true) +
      row('ภาพถ่าย', res.photos.length ? res.photos.length + ' ภาพ' : '', true) + row('พิกัด', res.gps ? 'มี' : '', false);
  }
  ['input', 'change', 'click'].forEach((ev) => $('recForm').addEventListener(ev, () => requestAnimationFrame(renderReview)));

  /* GPS: requested automatically once, retry by button; optional. */
  function getGps() {
    const t = $('recGps');
    if (!navigator.geolocation) { t.textContent = 'อุปกรณ์นี้ไม่รองรับการดึงพิกัด (ไม่บังคับ)'; return; }
    t.textContent = 'กำลังดึงพิกัด…';
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = +p.coords.latitude.toFixed(6), lng = +p.coords.longitude.toFixed(6);
      if (lat < 15.5 || lat > 17.2 || lng < 98.8 || lng > 100.3) { res.gps = null; t.textContent = `พิกัดปัจจุบัน (${lat}, ${lng}) อยู่นอกจังหวัด จึงไม่บันทึก`; }
      else { res.gps = { lat, lng }; t.textContent = `${lat}, ${lng} (แม่นยำ ±${Math.round(p.coords.accuracy)} ม.)`; }
      $('recGpsClear').classList.toggle('hidden', !res.gps);
    }, (err) => {
      res.gps = null;
      t.textContent = err.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง (ไม่บังคับ)' : 'ดึงพิกัดไม่สำเร็จ ลองใหม่ได้ (ไม่บังคับ)';
      $('recGpsClear').classList.add('hidden');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  $('recGpsBtn').addEventListener('click', getGps);
  $('recGpsClear').addEventListener('click', () => { res.gps = null; $('recGps').textContent = 'ไม่บันทึกพิกัด'; $('recGpsClear').classList.add('hidden'); });

  /* Photos are re-encoded in the browser: ≤1600 px JPEG, which also drops EXIF (location) data. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        let max = 1600, q = 0.82, out = '';
        for (let i = 0; i < 4; i++) {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 1500000) break;
          max = Math.round(max * 0.8); q -= 0.08;
        }
        URL.revokeObjectURL(url); resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์ภาพไม่ได้: ' + file.name)); };
      img.src = url;
    });
  }
  $('recPhotoInput').addEventListener('change', async (e) => {
    const max = (res.meta && res.meta.maxPhotos) || 3;
    const files = [...e.target.files].filter((f) => /^image\//.test(f.type));
    e.target.value = '';
    for (const file of files) {
      if (res.photos.length >= max) { toast(`แนบได้ไม่เกิน ${max} ภาพ`); break; }
      try { const data = await shrink(file); res.photos.push({ kind: 'new', data, url: data }); } catch (err) { toast(err.message); }
    }
    renderPhotos();
  });
  function renderPhotos() {
    $('recPhotos').innerHTML = res.photos.map((p, i) => `<figure>${p.url ? `<img src="${p.url}" alt="ภาพที่ ${i + 1}">` : `<span class="adm-photo-wait">ภาพเดิม ${i + 1}</span>`}
      <button type="button" data-rm="${i}" aria-label="ลบภาพที่ ${i + 1}">×</button></figure>`).join('');
    $('recPhotos').querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { res.photos.splice(Number(b.dataset.rm), 1); renderPhotos(); }));
    renderReview();
  }

  function resetRecForm(keepPlace) {
    const f = $('recForm');
    const keep = { date: f.date.value, district: f.district.value, sub: f.subdistrict.value };
    f.reset(); res.photos = []; res.method = ''; res.editing = null;
    if (keepPlace) { f.date.value = keep.date; f.district.value = keep.district; fillRecSubs(keep.sub); } else { res.crop = ''; f.date.value = res.meta ? res.meta.today : ''; fillRecSubs(); }
    $('recCustomWrap').open = false; $('recSaleWrap').open = false; fillBuyers(''); $('recCancelEdit').classList.add('hidden'); $('recTitle').textContent = 'บันทึกวัสดุเหลือใช้ทางการเกษตร';
    $('recSave').innerHTML = SAVE_LABEL;
    renderPhotos(); renderRecChips(); renderReview();
  }
  $('recCancelEdit').addEventListener('click', () => { resetRecForm(false); show('records'); });

  $('recForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, m = res.meta;
    const miss = [];
    if (!f.date.value) miss.push('วันที่');
    if (!districtScoped() && !f.district.value) miss.push('อำเภอ');
    if (!f.subdistrict.value) miss.push('ตำบล');
    if (!res.crop) miss.push('ชนิดพืช');
    if (!res.method) miss.push('ประเภทการจัดการ');
    if (!(Number(f.area.value) > 0)) miss.push('พื้นที่ (ไร่)');
    if (!res.photos.length) miss.push('ภาพถ่าย');
    if (miss.length) { setResult('recResult', 'กรุณากรอก: ' + miss.join(', '), false); return; }
    if (!f.confirmed.checked) { setResult('recResult', 'กรุณาติ๊กยืนยันว่าตรวจสอบข้อมูลแล้ว', false); return; }
    const custom = { mb: f.mb.value, fresh: f.fresh.value, dmf: f.dmf.value, cf: f.cf.value, reference: f.reference.value.trim() };
    const input = {
      id: res.editing || undefined, date: f.date.value, district: f.district.value, subdistrict: f.subdistrict.value, crop: res.crop, cropOther: f.cropOther.value.trim(),
      method: res.method, methodOther: f.methodOther.value.trim(), area: Number(f.area.value), lat: res.gps ? res.gps.lat : '', lng: res.gps ? res.gps.lng : '',
      photos: res.photos.filter((p) => p.kind === 'new').map((p, i) => ({ name: 'photo' + (i + 1) + '.jpg', mime: 'image/jpeg', data: p.data })),
      keepPhotos: res.photos.filter((p) => p.kind === 'keep').map((p) => p.index),
      custom: custom.mb || custom.fresh ? custom : null, note: f.note.value.trim(), confirmed: true,
      buyerId: f.buyerId.value, soldTonnes: f.soldTonnes.value
    };
    const editing = !!res.editing;
    busy($('recSave'), 'กำลังบันทึก…', async () => {
      try {
        const r = await call('residueSaveServer', input);
        const w = r.warnings && r.warnings.length ? `<div class="adm-note"><strong>โปรดตรวจสอบ</strong><ul>${r.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
        const g = (r.record.ghg !== null ? ` ก๊าซเรือนกระจกที่ลดได้ ${fmtG(r.record.ghg)} ${UNIT}` : '') + (r.record.value ? ` มูลค่า ${fmtBaht(r.record.value)} บาท` : '');
        $('recResult').className = 'adm-result is-ok';
        $('recResult').innerHTML = `${esc(r.message)}${esc(g)}${w}`;
        toast(r.message);
        resetRecForm(true);
        if (editing) show('records');
        res.list = [];
      } catch (err) { setResult('recResult', err.message, false); }
    });
    void m;
  });

  function editRecord(r) {
    show('record');
    const f = $('recForm');
    res.editing = r.id; res.crop = r.crop; res.method = r.method;
    f.date.value = r.date;
    if (!districtScoped()) f.district.value = r.district;
    fillRecSubs(r.subdistrict);
    f.cropOther.value = r.cropOther || ''; f.methodOther.value = r.methodOther || ''; f.area.value = r.area; f.note.value = r.note || '';
    f.mb.value = r.biomassMode === 'custom' && r.mb !== null ? r.mb : ''; f.fresh.value = r.biomassMode === 'custom' && r.fresh !== null ? r.fresh : '';
    f.dmf.value = r.biomassMode === 'custom' && r.dmf !== null ? r.dmf : ''; f.cf.value = r.biomassMode === 'custom' && r.cf !== null ? r.cf : '';
    f.reference.value = r.reference || ''; $('recCustomWrap').open = r.biomassMode === 'custom';
    fillBuyers(r.buyerId || ''); f.soldTonnes.value = r.soldTonnes === null || r.soldTonnes === undefined ? '' : r.soldTonnes;
    $('recSaleWrap').open = !!(r.buyerId || f.soldTonnes.value !== '');
    res.gps = r.lat !== null ? { lat: r.lat, lng: r.lng } : null;
    $('recGps').textContent = res.gps ? `${r.lat}, ${r.lng} (พิกัดเดิม)` : 'ไม่มีพิกัด'; $('recGpsClear').classList.toggle('hidden', !res.gps);
    res.photos = Array.from({ length: r.photoCount }, (_, i) => ({ kind: 'keep', index: i, url: '' }));
    renderPhotos(); renderRecChips();
    res.photos.forEach((p) => call('residuePhotoServer', { id: r.id, index: p.index }).then((x) => { p.url = `data:${x.mime};base64,${x.data}`; renderPhotos(); }).catch(() => {}));
    $('recTitle').textContent = 'แก้ไขข้อมูลวันที่ ' + r.date; $('recSave').innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> บันทึกการแก้ไข';
    $('recCancelEdit').classList.remove('hidden'); f.confirmed.checked = false; setResult('recResult', '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- record list ---------- */
  async function loadRecords() {
    const m = await loadResidueMeta();
    const fl = $('recsFilter');
    if (!$('recsFy').options.length) {
      $('recsFy').innerHTML = m.fiscalYears.map((y) => `<option value="${y}" ${y === m.fy ? 'selected' : ''}>${y}</option>`).join('');
      $('recsDistrictWrap').classList.toggle('hidden', districtScoped());
      $('recsDistrict').innerHTML = '<option value="">ทุกอำเภอ</option>' + m.districts.map((d) => `<option value="${esc(d.code)}">${esc(d.name)}</option>`).join('');
      $('recsCrop').innerHTML = '<option value="">ทุกชนิด</option>' + m.crops.map((c) => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('');
      $('recsMethod').innerHTML = '<option value="">ทุกประเภท</option>' + m.methods.map((x) => `<option>${esc(x.method)}</option>`).join('');
      fillRecsSubs();
    }
    const input = { fy: Number(fl.fy.value), district: fl.district.value, subdistrict: fl.subdistrict.value, crop: fl.crop.value, method: fl.method.value, mine: fl.mine.checked };
    $('recsSum').textContent = 'กำลังโหลด…';
    if (state.me.role === 'admin') loadMiniBalance(input.fy).catch(() => $('recsBalance').classList.add('hidden'));
    const r = await call('residueListServer', input);
    res.list = r.records;
    const t = r.totals;
    $('recsSum').innerHTML = recsSummary(t, r.records, r.truncated); countUp($('recsSum'));
    $('recsList').innerHTML = r.records.map((x) => `<article class="adm-rec-card">
        <header><b>${fmt(x.area, 2)} ไร่</b><span>${esc(x.method)}${x.methodOther ? ': ' + esc(x.methodOther) : ''}</span><span class="adm-badge">${esc(x.cropName)}</span></header>
        <p>${esc(x.date)} · ต.${esc(x.subdistrictName)} อ.${esc(x.districtName)}</p>
        <p>${x.ghg !== null ? `ก๊าซเรือนกระจกที่ลดได้ <b>${fmtG(x.ghg)}</b> ${UNIT}` : `<span class="adm-muted">ยังไม่คำนวณก๊าซเรือนกระจก (ไม่มีค่ามาตรฐาน)</span>`}${x.tonnes !== null ? ` · วัสดุเหลือใช้ทางการเกษตร ${fmt(x.tonnes, 2)} ตัน` : ''}${x.value ? ` · มูลค่า ${fmtBaht(x.value)} บาท${x.valueBasis === 'sold' ? ' (จากปริมาณขายจริง)' : ''}` : ''}${x.dataStatus === 'Measured' ? ' · <span class="adm-badge active">ค่าจากพื้นที่จริง</span>' : ''}</p>
        ${x.buyerName || x.soldTonnes !== null ? `<p>ขายให้ ${esc(x.buyerName || 'ผู้รับซื้อนอกระบบ')}${x.soldTonnes !== null ? ` · ${fmt(x.soldTonnes, 2)} ตัน` : ''}</p>` : ''}
        <p class="adm-muted">บันทึกโดย ${esc(x.recorderName)}${x.lat !== null ? ` · <a href="https://www.google.com/maps?q=${x.lat},${x.lng}" target="_blank" rel="noopener">พิกัด</a>` : ''}${x.note ? ' · ' + esc(x.note) : ''}</p>
        <footer>${x.photoCount ? `<button type="button" data-photo="${esc(x.id)}">ภาพ (${x.photoCount})</button>` : ''}
          ${x.canEdit ? `<button type="button" data-edit="${esc(x.id)}">แก้ไข</button><button type="button" class="danger" data-del="${esc(x.id)}">ลบ</button>` : ''}</footer>
      </article>`).join('') || '<p class="adm-muted">ยังไม่มีรายการตามเงื่อนไขนี้</p>';
    $('recsList').querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editRecord(res.list.find((x) => x.id === b.dataset.edit))));
    $('recsList').querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhotos(res.list.find((x) => x.id === b.dataset.photo))));
    $('recsList').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const x = res.list.find((y) => y.id === b.dataset.del);
      if (!window.confirm(`ลบรายการ ${x.date} ต.${x.subdistrictName} ${x.method} ${x.area} ไร่?\nรายการจะไม่นับในยอดรวม (เก็บไว้ในประวัติ)`)) return;
      try { toast((await call('residueDeleteServer', { id: x.id })).message); loadRecords(); } catch (err) { toast(err.message); }
    }));
  }
  /* 1.5.0 สรุปผลการส่งเสริม: the totals as tiles, then the area by management type and by crop, before the list itself. */
  function recsSummary(t, list, truncated) {
    const tile = (label, value, unit, est) => `<div class="adm-sumtile"><span class="adm-sumtile-label">${label}${est ? ' <span class="adm-est">ประมาณการ</span>' : ''}</span><b>${value}</b><small>${unit}</small></div>`;
    const group = (key) => {
      const g = {};
      list.forEach((x) => { const k = x[key] || 'ไม่ระบุ'; (g[k] = g[k] || { a: 0, n: 0 }); g[k].a += Number(x.area) || 0; g[k].n++; });
      return Object.entries(g).sort((a, b) => b[1].a - a[1].a);
    };
    const bars = (title, rows) => {
      if (!rows.length) return '';
      const max = Math.max(...rows.map((r) => r[1].a));
      return `<div class="adm-sumbars"><h4>${title}</h4><ul>${rows.map(([k, v]) => `<li><span class="adm-sumbars-name">${esc(k)}</span>
        <span class="adm-sumbars-track" aria-hidden="true"><i style="width:${max ? (v.a / max * 100).toFixed(1) : 0}%"></i></span>
        <span class="adm-sumbars-val">${fmt(v.a, 2)} ไร่ <small>${fmt(v.n)} รายการ</small></span></li>`).join('')}</ul></div>`;
    };
    return `<div class="adm-sumtiles">${tile('จำนวนรายการ', fmt(t.records), 'รายการ')}${tile('พื้นที่ที่จัดการ', fmt(t.area, 2), 'ไร่')}${tile('ปริมาณชีวมวล', fmt(t.tonnes, 2), 'ตัน', true)}${tile('คิดเป็นมูลค่า', fmtBaht(t.value), 'บาท', true)}${tile('ลดก๊าซเรือนกระจก', fmtG(t.ghg), UNIT, true)}</div>` +
      (list.length ? `<div class="adm-sumgrid">${bars('แยกตามวิธีจัดการ', group('method'))}${bars('แยกตามชนิดพืช', group('cropName'))}</div>` : '') +
      (truncated ? '<p class="adm-muted">ตัวเลขรวมคิดจากทุกรายการ ส่วนการแยกประเภทและรายการด้านล่างแสดง 500 รายการล่าสุด</p>' : '');
  }
  function fillRecsSubs() {
    const d = districtScoped() ? state.me.district : $('recsDistrict').value;
    $('recsSubdistrict').innerHTML = '<option value="">ทุกตำบล</option>' + subsOf(d).map((t) => `<option value="${esc(t.code)}">${esc(t.name)}</option>`).join('');
  }
  $('recsFilter').addEventListener('change', (e) => { if (e.target.name === 'district') fillRecsSubs(); loadRecords().catch((err) => toast(err.message)); });
  async function openPhotos(x) {
    const dlg = $('photoDialog'), body = $('photoBody');
    body.innerHTML = `<p>${esc(x.date)} ต.${esc(x.subdistrictName)} · ${esc(x.method)} ${fmt(x.area, 2)} ไร่</p><p class="adm-muted">กำลังโหลดภาพ…</p>`;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    const imgs = [];
    for (let i = 0; i < x.photoCount; i++) {
      try { const p = await call('residuePhotoServer', { id: x.id, index: i }); imgs.push(`<img src="data:${p.mime};base64,${p.data}" alt="ภาพที่ ${i + 1}">`); } catch (err) { imgs.push(`<p class="adm-muted">${esc(err.message)}</p>`); }
    }
    body.innerHTML = `<p>${esc(x.date)} ต.${esc(x.subdistrictName)} · ${esc(x.method)} ${fmt(x.area, 2)} ไร่</p>` + imgs.join('');
  }

  /* ---------- 2.2.0 overview: residue balance ①–⑥ ---------- */
  const FLAG_TH = { need_buyer: 'มีแปลงประกาศขาย แต่ยังไม่มีผู้รับซื้อในอำเภอ', low_managed: 'จัดการได้น้อยเมื่อเทียบกับพื้นที่เก็บเกี่ยว' };
  const pctText = (v) => (v === null || v === undefined ? '–' : fmt(v, 1) + '%');
  async function loadOverview() {
    const m = await loadResidueMeta();
    const fl = $('ovFilter');
    if (!$('ovFy').options.length) {
      $('ovFy').innerHTML = m.fiscalYears.map((y) => `<option value="${y}" ${y === m.fy ? 'selected' : ''}>${y}${y === m.fy ? ' (ปีปัจจุบัน)' : ''}</option>`).join('');
      $('ovDistrict').innerHTML = `<option value="">ทั้งจังหวัด${esc(m.province)}</option>` + m.districts.map((d) => `<option value="${esc(d.code)}">อำเภอ${esc(d.name)}</option>`).join('');
    }
    $('ovFlow').innerHTML = '<p class="adm-muted">กำลังคำนวณ…</p>';
    const b = await call('residueBalanceServer', { fy: Number(fl.fy.value), district: fl.district.value });
    const t = b.totals;
    $('ovScope').textContent = `ปีงบประมาณ ${b.fy} (${b.fyRange}) · ${b.district ? 'อำเภอ' + b.districtName : 'ทั้งจังหวัด' + m.province}`;
    const step = (n, label, main, unit, note, tone) => `<div class="adm-ov-step${tone ? ' is-' + tone : ''}"><span class="adm-ov-n" aria-hidden="true">${n}</span>
      <p>${esc(label)}</p><b>${main}</b><span>${esc(unit)}</span>${note ? `<small>${note}</small>` : ''}</div>`;
    $('ovFlow').innerHTML =
      step('①', 'เก็บเกี่ยวในปีงบประมาณ', fmt(t.harvestedRai, 0), 'ไร่', t.potentialTon ? `วัสดุเหลือใช้ทางการเกษตร ≈ ${fmt(t.potentialTon, 0)} ตัน` : 'ยังไม่มีข้อมูลทะเบียน') +
      step('②', 'นำออกจากแปลงได้', t.removableTon ? fmt(t.removableTon, 0) : '–', 'ตัน', 'ส่วนที่เหลือควรไถกลบหรือคลุมดิน') +
      step('③', 'ประกาศขายในตลาด', fmt(t.listedRai, 0), 'ไร่', `${fmt(t.listedPlots)} แปลง`) +
      step('④', 'ผู้รับซื้อที่เปิดรับซื้อ', fmt(t.buyers), 'ราย', t.capacityTonPerDay ? `รวม ${fmt(t.capacityTonPerDay, 1)} ตัน/วัน` : '') +
      step('⑤', 'จัดการแล้ว (บันทึก)', fmt(t.managedRai, 0), 'ไร่', `${pctText(t.managedPct)} ของพื้นที่เก็บเกี่ยว · ผ่านผู้รับซื้อในระบบ ${pctText(t.linkedPct)}`, 'good') +
      step('⑥', 'ยังไม่มีบันทึกการจัดการ', fmt(t.atRiskRai, 0), 'ไร่', 'เสี่ยงถูกเผา ควรติดตาม', t.atRiskRai > 0 ? 'warn' : '');
    // Buyer gaps first (each one is a concrete task), then the five largest areas without a record.
    const needBuyer = b.byDistrict.filter((d) => d.flags.includes('need_buyer')).sort((x, y) => y.listedRai - x.listedRai);
    const low = b.byDistrict.filter((d) => d.flags.includes('low_managed')).sort((x, y) => y.atRiskRai - x.atRiskRai);
    const todo = needBuyer.map((d) => `<li><b>อ.${esc(d.name)}</b> มีแปลงประกาศขาย ${fmt(d.listedRai, 0)} ไร่ แต่ยังไม่มีผู้รับซื้อวัสดุเหลือใช้ทางการเกษตรชนิดนั้นในอำเภอ: ช่วยหาผู้รับซื้อหรือจุดรวบรวม</li>`)
      .concat(low.slice(0, 5).map((d) => `<li><b>อ.${esc(d.name)}</b> ยังไม่มีบันทึก ${fmt(d.atRiskRai, 0)} ไร่ (จัดการแล้ว ${pctText(d.managedPct)} ของพื้นที่เก็บเกี่ยว): ติดตามพื้นที่ที่เก็บเกี่ยวแล้ว</li>`));
    const more = low.length > 5 ? `<p class="adm-muted">และอีก ${low.length - 5} อำเภอที่จัดการได้ต่ำกว่า ${b.lowShare}% ดูในตารางรายอำเภอ</p>` : '';
    $('ovTodo').innerHTML = `<h3>สิ่งที่ควรติดตาม</h3>` + (todo.length ? `<ul class="adm-bullets">${todo.join('')}</ul>${more}` : '<p class="adm-muted">ยังไม่พบจุดที่ต้องติดตามจากข้อมูลปัจจุบัน</p>');
    const max = Math.max(1, ...b.months.map((x) => Math.max(x.harvestedRai, x.managedRai)));
    $('ovMonths').innerHTML = b.months.map((x) => `<div class="adm-ov-month" title="${esc(monthLabel(x.month))}: เก็บเกี่ยว ${fmt(x.harvestedRai, 0)} ไร่, จัดการแล้ว ${fmt(x.managedRai, 0)} ไร่">
      <div class="adm-ov-bars"><i class="is-h" style="height:${(x.harvestedRai / max * 100).toFixed(1)}%"></i><i class="is-m" style="height:${(x.managedRai / max * 100).toFixed(1)}%"></i></div>
      <span>${esc(monthLabel(x.month))}</span></div>`).join('');
    const rows = b.byDistrict.filter((d) => !b.district || d.district === b.district);
    $('ovBody').innerHTML = rows.map((d) => `<tr><td>${esc(d.name)}</td><td class="num">${fmt(d.harvestedRai, 0)}</td><td class="num">${fmt(d.managedRai, 2)}</td>
      <td class="num">${pctText(d.managedPct)}</td><td class="num">${fmt(d.atRiskRai, 0)}</td><td class="num">${fmt(d.listedRai, 0)}</td><td class="num">${fmt(d.buyers)}</td>
      <td>${d.flags.map((f) => `<span class="adm-badge ${f === 'need_buyer' ? 'warn' : 'disabled'}">${esc(f === 'need_buyer' ? 'ยังไม่มีผู้รับซื้อ' : 'จัดการน้อย')}</span>`).join(' ') || '–'}</td></tr>`).join('');
    $('ovFoot').innerHTML = rows.length > 1 ? `<tr><td>รวม</td><td class="num">${fmt(t.harvestedRai, 0)}</td><td class="num">${fmt(t.managedRai, 2)}</td><td class="num">${pctText(t.managedPct)}</td>
      <td class="num">${fmt(t.atRiskRai, 0)}</td><td class="num">${fmt(t.listedRai, 0)}</td><td class="num">${fmt(t.buyers)}</td><td></td></tr>` : '';
    $('ovHow').innerHTML = [
      `① พื้นที่เก็บเกี่ยวจากข้อมูลทะเบียนเกษตรกรที่นำเข้า (เดือนที่คาดว่าจะเก็บเกี่ยวใน ${esc(b.fyRange)}) × อัตราวัสดุเหลือใช้ทางการเกษตรต่อไร่ของพืช${b.sources.registry.length ? ': ' + esc(b.sources.registry.join(', ')) : ' (ยังไม่มีข้อมูลนำเข้า)'}`,
      '② = ① × สัดส่วนที่นำออกจากแปลงได้โดยไม่กระทบดิน (ตั้งค่าได้ในเมนูตั้งค่า > ราคาและค่าคำนวณ) การไถกลบนับเป็นการจัดการด้วย',
      '③ แปลงสถานะพร้อมขายในตลาดวัสดุเหลือใช้ทางการเกษตร ที่คาดว่าจะเก็บเกี่ยวในปีงบประมาณนี้',
      '④ ผู้รับซื้อที่เปิดรับซื้อวัสดุเหลือใช้ทางการเกษตรชนิดนั้นในอำเภอ (กำลังรับซื้อตามที่ผู้รับซื้อกรอก)',
      '⑤ จากการบันทึกของเจ้าหน้าที่เท่านั้น ไม่นำยอดจากตลาดมาบวกซ้ำ',
      '⑥ = ① − ⑤ (ไร่) ไม่ต่ำกว่า 0 เป็นพื้นที่ที่ยังไม่มีบันทึกการจัดการ ไม่ได้แปลว่าถูกเผาแล้ว'
    ].map((x) => `<li>${x}</li>`).join('');
  }
  $('ovFilter').addEventListener('change', () => loadOverview().catch((err) => toast(err.message)));

  /* District officer: a compact balance card above the record list. */
  async function loadMiniBalance(fy) {
    const b = await call('residueBalanceServer', { fy });
    const t = b.totals, box = $('recsBalance');
    if (!t.harvestedRai && !t.managedRai) { box.classList.add('hidden'); return; }
    const flags = (b.byDistrict[0] || { flags: [] }).flags;
    box.classList.remove('hidden');
    box.innerHTML = `<h3>อำเภอ${esc(b.districtName || '')} ปีงบประมาณ ${b.fy}</h3>
      <p>เก็บเกี่ยว <b>${fmt(t.harvestedRai, 0)}</b> ไร่ · จัดการแล้ว <b>${fmt(t.managedRai, 2)}</b> ไร่ (${pctText(t.managedPct)}) · ยังไม่มีบันทึก <b>${fmt(t.atRiskRai, 0)}</b> ไร่ · ประกาศขาย ${fmt(t.listedRai, 0)} ไร่ · ผู้รับซื้อ ${fmt(t.buyers)} ราย</p>
      ${flags.length ? `<p class="adm-muted">${flags.map((f) => esc(FLAG_TH[f])).join(' · ')}</p>` : ''}`;
  }

  /* ---------- 1.8.0 formula values: biomass and GHG ---------- */
  const ghg = { s: null, exCrop: '', imp: null };
  const BIOMASS_UNIT = 'ตัน/ไร่';
  async function loadGhg() {
    ghg.s = await call('ghgSettingsServer');
    renderGhg();
  }
  const nz = (v) => v === null || v === undefined || v === '';
  const efOf = (p) => Number(p.EF_CH4) * Number(p.GWP_CH4) + Number(p.EF_N2O) * Number(p.GWP_N2O);
  function biomassText(c) {
    if (c.biomassMethod === 'rpr' && !nz(c.rpr) && !nz(c.yieldTRai)) return `${fmt(c.rpr, 3)} × ${fmt(c.yieldTRai, 3)}`;
    return nz(c.residueTRai) ? 'กำหนดเป็นตัน/ไร่' : 'ยังไม่กำหนด';
  }
  function renderGhg() {
    const s = ghg.s, p = s.params, f = $('ghgForm');
    $('ghgVersionLine').textContent = `ชุดค่าที่ ${p.PARAM_VERSION} · แก้ไขเมื่อ ${p.UPDATED_AT || '–'} โดย ${p.UPDATED_BY || '–'}`;
    $('ghgStatus').innerHTML = `<dl class="adm-kv"><dt>ชุดค่า</dt><dd>${esc(s.label.label)}</dd>
      <dt>EF รวม</dt><dd>(${p.EF_CH4} × ${p.GWP_CH4}) + (${p.EF_N2O} × ${p.GWP_N2O}) = <b>${fmt(s.label.combinedEf, 4)}</b> กรัมคาร์บอนไดออกไซด์เทียบเท่า ต่อ กก. ชีวมวลแห้งที่เผาไหม้</dd>
      <dt>ก๊าซเรือนกระจกคิดจาก</dt><dd>${p.DEFAULT_MODE === 'standard' ? 'ค่ามาตรฐาน IPCC Table 2.4' : 'ชีวมวลต่อไร่ของระบบ × สัดส่วนน้ำหนักแห้ง × Cf'}</dd></dl>`;
    ['GWP_SET', 'GWP_CH4', 'GWP_N2O', 'EF_CH4', 'EF_N2O', 'HA_TO_RAI', 'REF_EF', 'REF_GWP'].forEach((k) => { f[k].value = p[k]; });
    f.querySelectorAll('[name="DEFAULT_MODE"]').forEach((r) => { r.checked = r.value === p.DEFAULT_MODE; });
    syncGwp();
    const pr = s.price || {}, pf = $('priceForm');
    pf.price.value = pr.price ?? ''; pf.reference.value = pr.reference || '';
    const users = s.crops.filter((c) => c.useGlobalPrice !== false).map((c) => c.name);
    $('priceStatus').textContent = `ชุดราคาที่ ${pr.version || 1} แก้ไขเมื่อ ${pr.updatedAt || '–'} โดย ${pr.updatedBy || '–'} · ใช้กับ ${users.length ? users.join(', ') : 'ยังไม่มีพืชที่ใช้ราคากลาง'}`;
    $('ghgCropsBody').innerHTML = s.crops.map((c) => {
      const smp = s.sample100.find((x) => x.key === c.key) || {};
      const g100 = p.DEFAULT_MODE === 'standard' ? smp.standard : smp.residue;
      return `<tr class="${c.active ? '' : 'is-off'}"><td><b>${esc(c.name)}</b><br><span class="adm-muted">${esc(c.residueName || c.key)}</span></td>
        <td>${c.biomassMethod === 'rpr' ? '<span class="adm-chip">อัตรา × ผลผลิต</span><br>' : ''}<span class="adm-muted">${esc(biomassText(c))}</span></td>
        <td class="num"><b>${nz(c.residueTRai) ? '–' : fmt(c.residueTRai, 3)}</b></td>
        <td class="num">${nz(c.dmf) ? '1' : fmt(c.dmf, 2)}</td><td class="num">${nz(c.cf) ? '–' : c.cf}</td>
        <td class="num">${nz(smp.biomass100) ? '–' : fmt(smp.biomass100, 1)}</td>
        <td class="num">${nz(g100) ? '–' : fmt(g100, 3)}${p.DEFAULT_MODE !== 'standard' && !nz(smp.standard) ? `<br><span class="adm-muted">IPCC ${fmt(smp.standard, 3)}</span>` : ''}</td>
        <td class="num">${nz(c.priceBahtKg) ? '–' : fmt(c.priceBahtKg, 2)}</td>
        <td class="num">${nz(c.removablePct) ? '–' : fmt(c.removablePct, 1)}</td>
        <td class="adm-ref">${esc(c.residueReference || c.reference || '–')}</td>
        <td><span class="adm-badge ${c.active ? 'active' : 'disabled'}">${c.active ? 'ใช้งาน' : 'ปิด'}</span></td>
        <td><button type="button" class="adm-btn" data-edit-crop="${esc(c.key)}">แก้ไข</button></td></tr>`;
    }).join('');
    $('ghgCropsBody').querySelectorAll('[data-edit-crop]').forEach((b) => b.addEventListener('click', () => editCrop(b.dataset.editCrop)));
    $('ghgBoundary').innerHTML = s.boundary.map((x) => `<li>${esc(x)}</li>`).join('');
    renderGhgHistory();
    renderFormula();
  }

  /* worked example: the formula with this crop's numbers, as each step is computed */
  function renderFormula() {
    const s = ghg.s, p = s.params;
    const usable = s.crops.filter((c) => c.active && !nz(c.residueTRai));
    if (!usable.some((c) => c.key === ghg.exCrop)) ghg.exCrop = (usable[0] || {}).key || '';
    $('ghgExampleCrops').innerHTML = usable.map((c) => `<button type="button" class="ggh-pill" role="radio" aria-checked="${c.key === ghg.exCrop}" data-ex="${esc(c.key)}"><span class="ggh-pill-name">${esc(c.name)}</span></button>`).join('');
    $('ghgExampleCrops').querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { ghg.exCrop = b.dataset.ex; renderFormula(); }));
    const c = usable.find((x) => x.key === ghg.exCrop), area = Math.max(0, Number($('ghgExampleArea').value) || 0), ef = efOf(p);
    if (!c) { $('ghgFormula').innerHTML = '<li>ยังไม่มีพืชที่กำหนดชีวมวลต่อไร่</li>'; return; }
    const per = Number(c.residueTRai), dmf = nz(c.dmf) ? 1 : Number(c.dmf), cf = nz(c.cf) ? null : Number(c.cf);
    const tonnes = area * per, burntKg = tonnes * 1000 * dmf * (cf || 0), ghgT = burntKg * ef / 1e6;
    const steps = [
      [`ชีวมวลต่อไร่ (${esc(c.residueName || c.name)})`, c.biomassMethod === 'rpr' && !nz(c.rpr) ? `อัตราชีวมวลต่อผลผลิต ${fmt(c.rpr, 3)} × ผลผลิตเฉลี่ย ${fmt(c.yieldTRai, 3)} ตัน/ไร่` : 'กำหนดเป็นตัน/ไร่', `${fmt(per, 3)} ${BIOMASS_UNIT}`],
      ['ปริมาณชีวมวลที่จัดการได้', `${fmt(area, 2)} ไร่ × ${fmt(per, 3)} ${BIOMASS_UNIT}`, `${fmt(tonnes, 2)} ตัน`]
    ];
    if (p.DEFAULT_MODE === 'standard') {
      const kgRai = nz(c.consumedKgRai) ? null : Number(c.consumedKgRai);
      steps.push(['ชีวมวลแห้งที่ถูกเผาไหม้ (IPCC Table 2.4)', kgRai === null ? 'พืชนี้ไม่มีค่ามาตรฐาน' : `${fmt(area, 2)} ไร่ × ${fmt(kgRai, 1)} กก./ไร่`, kgRai === null ? '–' : `${fmt(area * kgRai / 1000, 2)} ตัน`]);
      steps.push(['ก๊าซเรือนกระจกที่ลดได้', kgRai === null ? '–' : `${fmt(area * kgRai, 0)} กก. × EF รวม ${fmt(ef, 2)} ÷ 1,000,000`, kgRai === null ? '–' : `<b data-count>${fmt(area * kgRai * ef / 1e6, 3)}</b> ตันคาร์บอนไดออกไซด์เทียบเท่า`]);
    } else {
      steps.push(['ชีวมวลแห้งที่จะถูกเผาไหม้ถ้าเผา', `${fmt(tonnes, 2)} ตัน × สัดส่วนน้ำหนักแห้ง ${fmt(dmf, 2)} × Cf ${cf === null ? '–' : fmt(cf, 2)}`, cf === null ? 'ยังไม่กำหนด Cf' : `${fmt(burntKg / 1000, 2)} ตัน`]);
      steps.push(['ก๊าซเรือนกระจกที่ลดได้', `${fmt(burntKg, 0)} กก. × EF รวม ${fmt(ef, 2)} ÷ 1,000,000`, cf === null ? '–' : `<b data-count>${fmt(ghgT, 3)}</b> ตันคาร์บอนไดออกไซด์เทียบเท่า`]);
    }
    $('ghgFormula').innerHTML = steps.map(([k, how, v]) => `<li><span class="adm-formula-k">${k}</span><span class="adm-formula-how">${how}</span><span class="adm-formula-v">${v}</span></li>`).join('');
    $('ghgFormulaNote').textContent = `EF รวม = (EF_CH₄ ${p.EF_CH4} × GWP ${p.GWP_CH4}) + (EF_N₂O ${p.EF_N2O} × GWP ${p.GWP_N2O}) กรัมคาร์บอนไดออกไซด์เทียบเท่าต่อ กก. ชีวมวลแห้ง · ${s.label.label}`;
    countUp($('ghgFormula'));
  }
  $('ghgExampleArea').addEventListener('input', () => { if (ghg.s) renderFormula(); });

  /* crop form: shown only while adding or editing */
  function cropForm(open) { $('ghgCropForm').classList.toggle('hidden', !open); $('ghgCropAdd').classList.toggle('hidden', open); }
  function editCrop(key) {
    const c = ghg.s.crops.find((x) => x.key === key), f = $('ghgCropForm');
    ['key', 'name', 'consumedTHa', 'cf', 'residueName', 'sortOrder', 'reference', 'residueReference', 'removablePct', 'removableReference', 'rpr', 'yieldTRai', 'dmf'].forEach((k) => { f[k].value = nz(c[k]) ? '' : c[k]; });
    f.residueTRai.value = nz(c.fixedTRai) ? (nz(c.residueTRai) ? '' : c.residueTRai) : c.fixedTRai;
    f.querySelectorAll('[name="biomassMethod"]').forEach((r) => { r.checked = r.value === (c.biomassMethod || 'fixed'); });
    f.priceBahtKg.value = nz(c.ownPriceBahtKg) ? '' : c.ownPriceBahtKg; f.priceReference.value = c.ownPriceReference || '';
    f.useGlobalPrice.checked = c.useGlobalPrice !== false; syncOwnPrice(); syncBiomass();
    f.active.checked = c.active; f.key.readOnly = true; $('ghgCropTitle').textContent = 'แก้ไขค่าพืช ' + c.name;
    cropForm(true); blurIn(f); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); f.rpr.focus({ preventScroll: true });
  }
  function syncBiomass() {
    const f = $('ghgCropForm'), m = (f.querySelector('[name="biomassMethod"]:checked') || {}).value || 'rpr';
    f.querySelectorAll('[data-biomass]').forEach((el) => el.classList.toggle('hidden', el.dataset.biomass !== m));
    f.querySelectorAll('.adm-radio-pill').forEach((l) => l.setAttribute('aria-checked', String(l.querySelector('input').checked)));
    const per = m === 'rpr' ? Number(f.rpr.value) * Number(f.yieldTRai.value) : Number(f.residueTRai.value);
    const dmf = Number(f.dmf.value) || 1, cf = Number(f.cf.value), ef = ghg.s ? efOf(ghg.s.params) : 0;
    $('ghgCropLive').innerHTML = per > 0 ? `ชีวมวล <b>${fmt(per, 3)}</b> ตัน/ไร่ · 100 ไร่ = ${fmt(per * 100, 1)} ตัน${cf > 0 ? ` · ก๊าซเรือนกระจกที่ลดได้ ${fmt(per * 100 * 1000 * dmf * cf * ef / 1e6, 3)} ตันคาร์บอนไดออกไซด์เทียบเท่า` : ''}` : 'กรอกค่าเพื่อดูผล';
  }
  $('ghgCropForm').addEventListener('input', syncBiomass);
  $('ghgCropForm').addEventListener('change', syncBiomass);
  $('ghgCropAdd').addEventListener('click', () => { resetCropForm(); cropForm(true); $('ghgCropForm').key.focus(); });
  $('ghgCropForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const method = (f.querySelector('[name="biomassMethod"]:checked') || {}).value || 'fixed';
    const input = { key: f.key.value.trim().toLowerCase(), name: f.name.value, consumedTHa: f.consumedTHa.value, cf: f.cf.value, residueName: f.residueName.value, residueTRai: f.residueTRai.value,
      biomassMethod: method, rpr: f.rpr.value, yieldTRai: f.yieldTRai.value, dmf: f.dmf.value,
      sortOrder: Number(f.sortOrder.value), reference: f.reference.value, residueReference: f.residueReference.value, active: f.active.checked,
      useGlobalPrice: f.useGlobalPrice.checked, priceBahtKg: f.priceBahtKg.value, priceReference: f.priceReference.value,
      removablePct: f.removablePct.value, removableReference: f.removableReference.value };
    if (!window.confirm(`บันทึกค่าพืช ${input.name}? ตัวเลขชีวมวล มูลค่า และก๊าซเรือนกระจกของทุกรายการที่เป็นพืชนี้ (รวมรายการเดิม) จะคำนวณใหม่ ค่าเดิมเก็บไว้ในประวัติ`)) return;
    try { const r = await call('ghgCropSaveServer', input); ghg.s = r.settings; renderGhg(); toast(r.message); resetCropForm(); res.meta = null; } catch (err) { toast(err.message); }
  });
  function resetCropForm() {
    const f = $('ghgCropForm'); f.reset(); f.key.readOnly = false; f.active.checked = true; f.useGlobalPrice.checked = true; f.dmf.value = 1;
    syncOwnPrice(); syncBiomass(); $('ghgCropTitle').textContent = 'เพิ่มชนิดพืช'; cropForm(false);
  }

  /* history and restore */
  function renderGhgHistory() {
    const h = ghg.s.history || [];
    const label = { ghg_biomass_v180: 'ค่าก่อนปรับเป็น สกว. (ระบบ 1.8.0)', ghg_params_save: 'ก่อนแก้ค่าคงที่', ghg_crop_save: 'ก่อนแก้ค่าพืช', ghg_import: 'ก่อนนำเข้า', ghg_restore: 'ก่อนย้อนกลับ' };
    $('ghgHistoryBody').innerHTML = h.length ? h.map((x) => `<tr><td class="num">${x.version}</td><td>${esc(x.time)}</td><td>${esc(x.by)}</td>
      <td>${esc(label[x.action] || x.action)}<br><span class="adm-muted">${esc(x.note)}</span></td>
      <td><button type="button" class="adm-btn" data-restore="${x.version}">ใช้ค่าชุดนี้</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="adm-muted">ยังไม่มีประวัติ</td></tr>';
    $('ghgHistoryBody').querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.restore;
      if (!window.confirm(`ย้อนกลับไปใช้ค่าที่เก็บไว้ลำดับที่ ${v}? ค่าปัจจุบันจะถูกเก็บไว้ในประวัติก่อน และตัวเลขทุกรายการจะคำนวณใหม่`)) return;
      busy(b, 'กำลังย้อนกลับ…', async () => {
        try { const r = await call('ghgRestoreServer', { version: Number(v) }); ghg.s = r.settings; renderGhg(); setResult('ghgHistoryResult', r.message, true); res.meta = null; }
        catch (err) { setResult('ghgHistoryResult', err.message, false); }
      });
    }));
  }

  /* import from Excel: the province document (อัตราชีวมวลต่อผลผลิต / ผลผลิตเฉลี่ย) or this system's own download */
  function parseBiomassSheet(aoa) {
    const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
    const numOf = (v) => { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; };
    let source = '';
    aoa.forEach((r) => r.forEach((v, i) => { if (/^ที่มา/.test(txt(v)) && txt(r[i + 1])) source = txt(r[i + 1]); }));
    const find = (r, re) => r.findIndex((v) => re.test(txt(v)));
    for (let h = 0; h < Math.min(aoa.length, 40); h++) {
      const r = aoa[h];
      const iRpr = find(r, /ต่อตันผลผลิต|ต่อผลผลิต|ตัน\/ตัน/), iYield = find(r, /ผลผลิตเฉลี่ย/), iFixed = find(r, /^ชีวมวล \(ตัน\/ไร่\)|ปริมาณชีวมวล/);
      if (iRpr < 0 && iFixed < 0) continue;
      const iKey = find(r, /^รหัสพืช/), iName = find(r, /^ชื่อวัสดุ|^วัสดุ|^พืช$/), iDmf = find(r, /น้ำหนักแห้ง/), iCf = find(r, /^Cf|เผาไหม้/i), iRef = find(r, /อ้างอิง|^ที่มา/);
      const iLabel = iName >= 0 ? iName : Math.max(0, (iRpr >= 0 ? iRpr : iFixed) - 1);
      const rows = [];
      for (let k = h + 1; k < aoa.length; k++) {
        const x = aoa[k], label = txt(x[iLabel]), rpr = iRpr >= 0 ? numOf(x[iRpr]) : null, y = iYield >= 0 ? numOf(x[iYield]) : null, fixed = iFixed >= 0 ? numOf(x[iFixed]) : null;
        if (!label && rpr === null && fixed === null) { if (rows.length) break; continue; }
        if (rpr === null && fixed === null) continue;   // a crop without values (e.g. not set yet) is skipped, not the end of the table
        rows.push({ key: iKey >= 0 ? txt(x[iKey]) : '', label, rpr, yieldTRai: y, residueTRai: rpr !== null && y !== null ? null : fixed,
          dmf: iDmf >= 0 ? numOf(x[iDmf]) : null, cf: iCf >= 0 ? numOf(x[iCf]) : null, reference: iRef >= 0 ? txt(x[iRef]) : '' });
      }
      if (rows.length) return { rows, source };
    }
    return { rows: [], source };
  }
  $('ghgImportBtn').addEventListener('click', () => $('ghgImportFile').click());
  $('ghgImportFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const panel = $('ghgImportPanel');
    panel.classList.remove('hidden'); panel.innerHTML = '<p class="adm-muted">กำลังอ่านไฟล์…</p>';
    try {
      await loadScript(SHEETJS);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      let parsed = { rows: [], source: '' };
      for (const n of wb.SheetNames) { parsed = parseBiomassSheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })); if (parsed.rows.length) break; }
      if (!parsed.rows.length) throw new Error('ไม่พบตารางชีวมวลในไฟล์ ต้องมีหัวคอลัมน์ "ตันชีวมวลต่อตันผลผลิต" และ "ผลผลิตเฉลี่ย ตันต่อไร่" (หรือใช้ไฟล์จากปุ่มดาวน์โหลดค่าปัจจุบัน)');
      const reference = (parsed.source ? parsed.source + ' ' : '') + '(นำเข้าจากไฟล์ ' + file.name + ')';
      const pv = await call('ghgImportServer', { rows: parsed.rows, reference });
      ghg.imp = { rows: parsed.rows, reference, fileName: file.name, preview: pv };
      renderImport();
    } catch (err) { panel.innerHTML = `<p class="adm-result is-error">${esc(err.message)}</p>`; }
  });
  function renderImport() {
    const imp = ghg.imp, pv = imp.preview, panel = $('ghgImportPanel');
    const change = (a, b) => (nz(a) || !a ? '' : `${b >= a ? '+' : ''}${fmt((b - a) / a * 100, 0)}%`);
    panel.innerHTML = `<h3>ตรวจค่าก่อนนำเข้า <span class="adm-muted">${esc(imp.fileName)}</span></h3>
      <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>ในไฟล์</th><th>พืชในระบบ</th><th class="num">ค่าเดิม (ตัน/ไร่)</th><th>ค่าใหม่</th><th class="num">ชีวมวล (ตัน/ไร่)</th><th class="num">เปลี่ยน</th><th>สถานะ</th></tr></thead><tbody>
      ${pv.rows.map((r) => `<tr class="${r.error ? 'is-off' : ''}"><td>${esc(r.label)}</td><td>${esc(r.name || '–')}</td><td class="num">${nz(r.before) ? '–' : fmt(r.before, 3)}</td>
        <td>${r.method === 'rpr' ? `${fmt(r.rpr, 3)} × ${fmt(r.yieldTRai, 3)}` : r.method === 'fixed' ? 'กำหนดเป็นตัน/ไร่' : '–'}</td>
        <td class="num"><b>${nz(r.residueTRai) ? '–' : fmt(r.residueTRai, 3)}</b></td><td class="num">${r.error ? '' : change(r.before, r.residueTRai)}</td>
        <td>${r.error ? `<span class="adm-badge deleted">${esc(r.error)}</span>` : '<span class="adm-badge active">นำเข้าได้</span>'}</td></tr>`).join('')}</tbody></table></div>
      <label>แหล่งอ้างอิงที่จะบันทึก<input id="ghgImportRef" maxlength="200" value="${esc(imp.reference)}"></label>
      <p class="adm-muted">นำเข้าเฉพาะวิธีคิดชีวมวล (อัตรา × ผลผลิต หรือตัน/ไร่) ค่าอื่นของพืชคงเดิม ตัวเลขทุกรายการจะคำนวณใหม่ ค่าเดิมเก็บไว้ในประวัติและย้อนกลับได้</p>
      <div class="adm-confirm"><button type="button" class="adm-btn adm-btn-primary" id="ghgImportApply" ${pv.ready ? '' : 'disabled'}>ยืนยันนำเข้า ${pv.ready} ชนิดพืช</button><button type="button" class="adm-btn" id="ghgImportCancel">ยกเลิก</button></div>
      <p class="adm-result" id="ghgImportResult" role="status"></p>`;
    blurIn(panel);
    $('ghgImportCancel').addEventListener('click', () => { ghg.imp = null; panel.classList.add('hidden'); panel.innerHTML = ''; });
    $('ghgImportApply').addEventListener('click', () => busy($('ghgImportApply'), 'กำลังนำเข้า…', async () => {
      try {
        const r = await call('ghgImportServer', { rows: imp.rows, reference: $('ghgImportRef').value.trim(), apply: true, fileName: imp.fileName });
        ghg.s = r.settings; ghg.imp = null; renderGhg(); res.meta = null;
        panel.innerHTML = `<p class="adm-result is-ok">${esc(r.message)}</p>`;
      } catch (err) { setResult('ghgImportResult', err.message, false); }
    }));
  }
  $('ghgExportBtn').addEventListener('click', () => busy($('ghgExportBtn'), 'กำลังสร้างไฟล์…', async () => {
    try {
      await loadScript(SHEETJS);
      const s = ghg.s, p = s.params;
      const head = ['รหัสพืช', 'พืช', 'ชื่อวัสดุเหลือใช้ทางการเกษตร', 'วิธีคิดชีวมวล', 'ตันชีวมวลต่อตันผลผลิต', 'ผลผลิตเฉลี่ย ตันต่อไร่', 'ชีวมวล (ตัน/ไร่)', 'สัดส่วนน้ำหนักแห้ง', 'Cf', 'แหล่งอ้างอิง'];
      const rows = s.crops.map((c) => [c.key, c.name, c.residueName || '', c.biomassMethod === 'rpr' ? 'อัตรา × ผลผลิต' : 'ตัน/ไร่', nz(c.rpr) ? '' : c.rpr, nz(c.yieldTRai) ? '' : c.yieldTRai,
        nz(c.residueTRai) ? '' : c.residueTRai, nz(c.dmf) ? 1 : c.dmf, nz(c.cf) ? '' : c.cf, c.residueReference || '']);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([head].concat(rows)); ws['!cols'] = head.map((h, i) => ({ wch: i === 9 ? 60 : Math.max(10, h.length + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, 'ชีวมวล');
      const cs = XLSX.utils.aoa_to_sheet([['ค่า', 'ค่าที่ใช้', 'หน่วย'], ['ชุดค่าที่', p.PARAM_VERSION, ''], ['ก๊าซเรือนกระจกคิดจาก', p.DEFAULT_MODE === 'standard' ? 'IPCC Table 2.4' : 'ชีวมวลของระบบ × สัดส่วนน้ำหนักแห้ง × Cf', ''],
        ['EF_CH4', p.EF_CH4, 'g/kg'], ['EF_N2O', p.EF_N2O, 'g/kg'], ['GWP_CH4', p.GWP_CH4, ''], ['GWP_N2O', p.GWP_N2O, ''], ['ชุด GWP', p.GWP_SET, ''], ['ราคากลาง', (s.price || {}).price, 'บาท/กก.']]);
      cs['!cols'] = [{ wch: 24 }, { wch: 48 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, cs, 'ค่าคงที่');
      XLSX.writeFile(wb, `ABM-สูตรชีวมวล-ชุดที่${p.PARAM_VERSION}.xlsx`);
      toast('ดาวน์โหลดแล้ว แก้ค่าในไฟล์แล้วนำเข้ากลับได้');
    } catch (err) { toast(err.message); }
  }));
  function syncGwp() {
    const f = $('ghgForm'), set = ghg.s && ghg.s.gwpSets[f.GWP_SET.value];
    if (set) { f.GWP_CH4.value = set.GWP_CH4; f.GWP_N2O.value = set.GWP_N2O; f.REF_GWP.value = set.ref; }
    f.GWP_CH4.readOnly = f.GWP_N2O.readOnly = f.REF_GWP.readOnly = !!set;
  }
  $('ghgForm').GWP_SET.addEventListener('change', syncGwp);
  $('ghgForm').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target;
    const input = { GWP_SET: f.GWP_SET.value, GWP_CH4: Number(f.GWP_CH4.value), GWP_N2O: Number(f.GWP_N2O.value), EF_CH4: Number(f.EF_CH4.value), EF_N2O: Number(f.EF_N2O.value),
      HA_TO_RAI: Number(f.HA_TO_RAI.value), REF_EF: f.REF_EF.value, REF_GWP: f.REF_GWP.value, DEFAULT_MODE: (f.querySelector('[name="DEFAULT_MODE"]:checked') || {}).value };
    if (!window.confirm('บันทึกเป็นชุดค่าใหม่? ผลคำนวณ GHG ทุกรายการและหน้าแรกจะเปลี่ยนตามชุดค่านี้')) return;
    busy(f.querySelector('[type="submit"]'), 'กำลังบันทึก…', async () => {
      try { const r = await call('ghgParamsSaveServer', input); ghg.s = r.settings; renderGhg(); setResult('ghgResult', r.message, true); res.meta = null; }
      catch (err) { setResult('ghgResult', err.message, false); }
    });
  });
  $('ghgValidateBtn').addEventListener('click', () => busy($('ghgValidateBtn'), 'กำลังทดสอบ…', async () => {
    try {
      const r = await call('ghgValidationServer');
      $('ghgValidation').innerHTML = `<p class="adm-result ${r.passed === r.total ? 'is-ok' : 'is-error'}">ผลทดสอบ ${r.passed}/${r.total} PASS (คำนวณจริงด้วยค่าเริ่มต้น IPCC 2006 + AR5)</p>
        <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>กรณีทดสอบ</th><th>ค่าที่คาดหวัง</th><th>ผลคำนวณ</th><th>ผล</th></tr></thead><tbody>` +
        r.cases.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.expected)}</td><td>${esc(typeof c.actual === 'object' ? JSON.stringify(c.actual) : c.actual)}</td><td><span class="adm-badge ${c.pass ? 'active' : 'deleted'}">${c.pass ? 'PASS' : 'FAIL'}</span></td></tr>`).join('') +
        '</tbody></table></div>';
    } catch (err) { toast(err.message); }
  }));
  function syncOwnPrice() {
    const f = $('ghgCropForm'), own = !f.useGlobalPrice.checked;
    $('ghgOwnPrice').classList.toggle('is-off', !own);
    f.priceBahtKg.disabled = f.priceReference.disabled = !own;
  }
  $('ghgCropForm').useGlobalPrice.addEventListener('change', syncOwnPrice);
  $('priceForm').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target;
    const input = { price: Number(f.price.value), reference: f.reference.value.trim() };
    const n = ghg.s ? ghg.s.crops.filter((c) => c.useGlobalPrice !== false).length : 0;
    if (!window.confirm(`เปลี่ยนราคากลางเป็น ${input.price} บาท/กก.? มูลค่าของ ${n} ชนิดพืชที่ใช้ราคากลางจะเปลี่ยนทันที ทั้งรายการเดิมและหน้าแรก`)) return;
    busy(f.querySelector('[type="submit"]'), 'กำลังบันทึก…', async () => {
      try { const r = await call('residuePriceSaveServer', input); ghg.s = r.settings; renderGhg(); setResult('priceResult', r.message, true); res.meta = null; }
      catch (err) { setResult('priceResult', err.message, false); }
    });
  });

  $('ghgCropReset').addEventListener('click', resetCropForm);

  /* ---------- targets, management types, province ---------- */
  const tg = { s: null };
  async function loadTargets(fy) {
    tg.s = await call('residueSettingsServer', { fy: fy || Number($('tgFy').value) || undefined });
    const s = tg.s;
    const years = [...new Set(s.fiscalYears.concat([s.fy, Math.max(...s.fiscalYears) + 1]))].sort((a, b) => b - a);
    $('tgFy').innerHTML = years.map((y) => `<option value="${y}" ${y === s.fy ? 'selected' : ''}>${y}</option>`).join('');
    const methods = s.methods.filter((m) => m.active);
    $('tgHead').innerHTML = `<tr><th>อำเภอ</th><th class="num">นวส. (คน)</th><th class="num">เป้ารวม (ไร่)</th>${methods.map((m) => `<th class="num">${esc(m.method)}</th>`).join('')}</tr>`;
    $('tgBody').innerHTML = s.targets.rows.map((d) => `<tr data-district="${esc(d.district)}"><td>${esc(d.name)}</td>
      <td><input type="number" min="0" step="1" name="officers" value="${d.officers ?? ''}" aria-label="นวส. ${esc(d.name)}"></td>
      <td><input type="number" min="0" step="any" name="total" value="${d.total ?? ''}" aria-label="เป้ารวม ${esc(d.name)}"></td>
      ${methods.map((m) => `<td><input type="number" min="0" step="any" data-method="${esc(m.method)}" value="${d.byMethod[m.method] ?? ''}" aria-label="${esc(m.method)} ${esc(d.name)}"></td>`).join('')}</tr>`).join('');
    sumTargets();
    $('mtCrop').innerHTML = '<option value="">ทุกชนิด</option>' + s.crops.map((c) => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('');
    $('mtBody').innerHTML = s.methods.map((m) => `<tr><td>${esc(m.method)}</td><td>${esc((s.crops.find((c) => c.key === m.cropKey) || {}).name || 'ทุกชนิด')}</td>
      <td>${m.needsDetail ? 'ใช่' : '–'}</td><td>${m.countValue ? 'นับ' : '<span class="adm-muted">ไม่นับ</span>'}</td><td class="num">${m.sortOrder}</td><td><span class="adm-badge ${m.active ? 'active' : 'disabled'}">${m.active ? 'ใช้งาน' : 'ปิด'}</span></td>
      <td><button type="button" data-edit-method="${esc(m.method)}">แก้ไข</button></td></tr>`).join('');
    $('mtBody').querySelectorAll('[data-edit-method]').forEach((b) => b.addEventListener('click', () => {
      const m = s.methods.find((x) => x.method === b.dataset.editMethod), f = $('mtForm');
      f.method.value = m.method; f.cropKey.value = m.cropKey; f.sortOrder.value = m.sortOrder; f.needsDetail.checked = m.needsDetail; f.active.checked = m.active; f.countValue.checked = m.countValue; f.method.focus();
    }));
    $('siteForm').province.value = s.province; $('siteForm').office.value = s.office; $('siteForm').groups.value = (s.groups || []).join('\n');
  }
  function sumTargets() {
    const cols = [...$('tgBody').querySelectorAll('tr:first-child input')].map((i) => i.name || i.dataset.method);
    const sums = cols.map((c) => [...$('tgBody').querySelectorAll('input')].filter((i) => (i.name || i.dataset.method) === c).reduce((a, i) => a + (Number(i.value) || 0), 0));
    $('tgFoot').innerHTML = `<tr><td>รวมทั้งจังหวัด</td>${sums.map((v) => `<td class="num">${v ? fmt(v, 2) : '–'}</td>`).join('')}</tr>`;
  }
  $('tgBody').addEventListener('input', sumTargets);
  $('tgFy').addEventListener('change', () => loadTargets(Number($('tgFy').value)).catch((err) => toast(err.message)));
  $('tgForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const rows = [...$('tgBody').querySelectorAll('tr')].map((tr) => {
      const byMethod = {};
      tr.querySelectorAll('[data-method]').forEach((i) => { if (i.value !== '') byMethod[i.dataset.method] = Number(i.value); });
      return { district: tr.dataset.district, officers: tr.querySelector('[name="officers"]').value, total: tr.querySelector('[name="total"]').value, byMethod };
    });
    busy(e.target.querySelector('[type="submit"]'), 'กำลังบันทึก…', async () => {
      try { const r = await call('residueTargetsSaveServer', { fy: Number($('tgFy').value), rows }); setResult('tgResult', r.message, true); } catch (err) { setResult('tgResult', err.message, false); }
    });
  });
  $('mtForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try {
      await call('residueMethodSaveServer', { method: f.method.value, cropKey: f.cropKey.value, needsDetail: f.needsDetail.checked, active: f.active.checked, sortOrder: Number(f.sortOrder.value), countValue: f.countValue.checked });
      toast('บันทึกประเภทแล้ว'); f.reset(); f.active.checked = true; f.countValue.checked = true; res.meta = null; loadTargets(Number($('tgFy').value));
    } catch (err) { toast(err.message); }
  });
  $('siteForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try { const r = await call('siteSaveServer', { province: f.province.value, office: f.office.value, groups: f.groups.value.split('\n').map((x) => x.trim()).filter(Boolean) }); reg.meta = null; setResult('siteResult', r.message, true); $('admProvince').textContent = 'จังหวัด' + f.province.value.replace(/^จังหวัด/, ''); res.meta = null; rep.catalog = null; }
    catch (err) { setResult('siteResult', err.message, false); }
  });

  /* ---------------- start ---------------- */
  // admin.html#admin (from the homepage officer popup) opens the username/password tab; #register the officer form.
  if (!state.token && location.hash === '#admin') loginTab('admin');
  else if (!state.token && location.hash === '#register') loginTab('register');
  if (state.token) {
    call('adminMeServer').then(async (r) => { await enterApp(r); showSsoPrev(popSsoPrev()); }).catch(() => signOut());
  } else {
    // 2.4.2: wake the servers while the officer types the phone number
    const ph = document.getElementById('staffPhone');
    if (ph && window.ABM_SSO && window.ABM_SSO.warm) ['focus', 'pointerdown'].forEach((ev) => ph.addEventListener(ev, () => window.ABM_SSO.warm(), { passive: true }));
  }
  if (!state.token && window.ABM_STAFF.hasDevice()) {
    // 1.7.0: remembered device → one call opens the officer pages; if the key is refused, fall back to the usual sign-in
    $('viewLogin').classList.add('is-resuming');
    window.ABM_STAFF.resume()
      .then((r) => { if (r && r.token) { state.token = r.token; return enterApp(r); } })
      .catch((err) => { const m = String(err.message || ''); $('staffLoginError').textContent = /[ก-๙]/.test(m) && !/DEVICE_EXPIRED/.test(m) ? m : 'การจดจำเครื่องหมดอายุหรือใช้ไม่ได้ กรุณาเข้าสู่ระบบอีกครั้ง'; })
      .finally(() => $('viewLogin').classList.remove('is-resuming'));
  } else if (!state.token && window.ABM_STAFF.ssoAuto) {
    // 2.4.0: already signed in on Agri-Risk Map / Smart Agri / GGH on this device → open the officer pages directly
    window.ABM_STAFF.ssoAuto().then((r) => { if (r && r.token) { state.token = r.token; enterApp(r); } });
  }
})();

/* ABM 1.0.0 (from Green Gain Hub 2.4.2) — officer sign-in through the central identity (SSO) shared with
   Agri-Risk Map, Green Gain Hub and Smart Agri.
   Uses KPP_ID (https://krit-pj.github.io/TH-Agri-Risk-Maps-Burning/js/kpp-id.js): phone → identity → one-use ticket for ABM →
   this system's Apps Script redeems it and opens its own officer session. Officers who registered before get an identity
   created from their record on first sign-in (ssoProvisionServer), so nobody registers twice.
   If the central identity is unreachable or switched off, callers fall back to the old phone sign-in (SSO_MODE optional). */
(function () {
  'use strict';
  const AUD = 'ABM';
  const available = () => !!(window.KPP_ID && window.KPP_ID.login);
  /** Errors where the old sign-in should be used instead (identity service off / unreachable). */
  function fallback(err) {
    const m = String(err && err.message || '');
    return !available() || /ปิดใช้งาน|เชื่อมต่อระบบตัวตนกลาง|ไม่รู้จักระบบปลายทาง|Failed to fetch|NetworkError|Load failed/i.test(m);
  }
  /** Central identity for a phone; creates it from the officer record the first time. */
  async function identity(phone, provision, remember) {
    try { return await window.KPP_ID.login(phone, { system: AUD, remember: !!remember, aud: AUD }); }
    catch (err) {
      if (err.code !== 'not_found') throw err;
      const p = await provision(phone);
      if (p && (p.status === 'provisioned' || p.status === 'exists')) return window.KPP_ID.login(phone, { system: AUD, remember: !!remember, aud: AUD });
      const e = new Error('ไม่พบหมายเลขโทรศัพท์นี้ในระบบ กรุณาลงทะเบียน'); e.code = 'not_found'; throw e;
    }
  }
  /** The ticket comes back with the sign-in answer (one Agri-Risk call less); older kpp-id.js → ask for one. */
  const ticketOf = (id) => (window.KPP_ID.ticketFrom ? window.KPP_ID.ticketFrom(id, AUD) : window.KPP_ID.ticket(AUD));
  /** Wake the Apps Script projects while the person is typing (cold starts are the slowest part). */
  let warmed = 0;
  function warm() {
    if (Date.now() - warmed < 300000) return; warmed = Date.now();
    try { if (window.KPP_ID && window.KPP_ID.warm) window.KPP_ID.warm(); } catch (e) { /* ignore */ }
    try { const u = window.ABM_CONFIG && window.ABM_CONFIG.SHEETS_API_URL; if (u) fetch(u + (u.includes('?') ? '&' : '?') + 'api=v1&endpoint=health', { cache: 'no-store' }).catch(() => {}); } catch (e) { /* ignore */ }
  }
  /** Officer: call = ABM_STAFF.call (POST officer API). */
  async function staff(phone, call, remember) {
    const id = await identity(phone, (p) => call('ssoProvisionServer', { phone: p }), false);
    const t = await ticketOf(id);
    const result = await call('ssoStaffLoginServer', { ticket: t.ticket, remember: !!remember });
    return { id, result };
  }
  /** 1.2.0: a one-use ticket for registering an officer — signs in to the central identity, or creates it (position เจ้าหน้าที่). */
  async function registerTicket(input) {
    if (!available()) throw new Error('ไม่สามารถเชื่อมต่อระบบตัวตนกลางได้ กรุณาโหลดหน้าเว็บใหม่แล้วลองอีกครั้ง');
    let id;
    try { id = await window.KPP_ID.login(input.phone, { system: AUD, aud: AUD }); }
    catch (err) {
      if (err.code !== 'not_found') throw err;
      id = await window.KPP_ID.register({ phone: input.phone, fullName: input.name, position: 'เจ้าหน้าที่', affiliation: input.officeLabel || '',
        provinceCode: '62', districtName: input.districtName || '', consent: true }, { system: AUD, aud: AUD });
    }
    return (await ticketOf(id)).ticket;
  }
  /** After a new officer registration: give the person the shared identity too (best effort, never blocks). */
  async function attach(phone, provision) {
    if (!available()) return null;
    try { await provision(phone); return await window.KPP_ID.login(phone, { system: AUD, remember: false }); } catch (e) { return null; }
  }
  /** Silent sign-in when this browser already holds an identity (signed in on another connected system earlier). */
  async function autoTicket(flag) {
    if (!available()) return null;
    const cur = window.KPP_ID.current(); if (!cur) return null;
    try { if (sessionStorage.getItem(flag) === String(cur.at)) return null; sessionStorage.setItem(flag, String(cur.at)); } catch (e) { /* ignore */ }
    try { return (await window.KPP_ID.ticket(AUD)).ticket; } catch (e) { return null; }
  }
  /** "Previous sign-in" notice with a "not me" button, as a banner at the top of `container`. onSuspended runs after "not me". */
  function showPrev(prev, onSuspended, container) {
    if (!prev || !available() || !container) return;
    let box = document.getElementById('abmSsoPrev');
    if (!box) { box = document.createElement('div'); box.id = 'abmSsoPrev'; box.style.margin = '0 0 1rem'; container.prepend(box); }
    box.innerHTML = window.KPP_ID.prevHtml(prev);
    window.KPP_ID.bindPrev(box, (suspended) => { if (suspended) { if (onSuspended) onSuspended(); } else box.remove(); });
  }
  function logout() { if (available()) window.KPP_ID.logout(); }
  window.ABM_SSO = { available, fallback, staff, attach, autoTicket, showPrev, logout, warm, registerTicket };
})();

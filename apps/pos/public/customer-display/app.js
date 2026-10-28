// Customer-facing display surface for Toko360, separate from the POS till.
//
// Unlike the kiosk, this screen is not driven by a scanner: it mirrors the
// cashier's in-progress transaction in real time. The POS till publishes the
// current cart (items + totals) over a same-origin BroadcastChannel (and, as a
// fallback, a localStorage key + storage event), and this page subscribes and
// renders it. It never performs a mutation and never talks to the API.
(function () {
  'use strict';

  var CHANNEL = 'toko360.customerDisplay';
  var STORAGE_KEY = 'toko360.customerDisplay';
  var RESET_MS = 30000;

  var $ = function (id) { return document.getElementById(id); };

  var resetTimer = null;
  var lastPayload = null;

  function money(value) {
    var number = Number(value);
    if (!isFinite(number)) return String(value == null ? '' : value);
    return 'Rp ' + number.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  }

  function setStatus(state, text) {
    var el = $('status');
    if (!el) return;
    el.className = state;
    el.textContent = text;
  }

  function clearItems() {
    var list = $('d-items');
    if (list) list.innerHTML = '';
  }

  function showIdle() {
    var idle = $('idle');
    var panel = $('display-panel');
    if (idle) idle.style.display = 'block';
    if (panel) panel.className = '';
    clearItems();
    var total = $('d-total');
    if (total) total.textContent = 'Rp 0';
    var meta = $('d-meta');
    if (meta) meta.textContent = '';
    var cust = $('d-customer');
    if (cust) cust.textContent = '';
    var title = $('d-title');
    if (title) title.textContent = 'Total belanja';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderItems(items) {
    var list = $('d-items');
    if (!list) return;
    if (!Array.isArray(items) || items.length === 0) { list.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var name = escapeHtml(it.name || it.productName || '');
      var qty = escapeHtml((it.quantity != null ? it.quantity : '') + (it.unit ? ' ' + it.unit : ''));
      var price = money(it.lineTotal != null ? it.lineTotal : (Number(it.price || it.unitPrice || 0) * Number(it.quantity || 0)));
      html += '<li><span class="name">' + name + '</span><span class="qty">' + qty + '</span><span class="price">' + escapeHtml(price) + '</span></li>';
    }
    list.innerHTML = html;
  }

  function showTransaction(payload) {
    payload = payload || {};
    var idle = $('idle');
    var panel = $('display-panel');
    if (idle) idle.style.display = 'none';
    if (panel) panel.className = 'on';
    var cust = $('d-customer');
    if (cust) cust.textContent = payload.customer ? ('Pelanggan: ' + payload.customer) : '';
    var title = $('d-title');
    if (title) title.textContent = payload.title || 'Total belanja';
    renderItems(payload.items);
    var total = $('d-total');
    if (total) total.textContent = money(payload.total);
    var meta = $('d-meta');
    if (meta) {
      var parts = [];
      if (payload.subtotal != null) parts.push('Subtotal ' + money(payload.subtotal));
      if (payload.discount) parts.push('Diskon ' + money(payload.discount));
      if (payload.tax) parts.push('Pajak ' + money(payload.tax));
      if (payload.serviceFee) parts.push('Biaya layanan ' + money(payload.serviceFee));
      if (payload.status) parts.push(String(payload.status).toUpperCase());
      meta.textContent = parts.join(' · ');
    }
    armReset();
  }

  function armReset() {
    if (resetTimer) { try { clearTimeout(resetTimer); } catch (e) {} }
    resetTimer = setTimeout(function () { showIdle(); }, RESET_MS);
  }

  function applyUpdate(payload) {
    if (!payload || typeof payload !== 'object') return;
    lastPayload = payload;
    if (payload.type === 'idle' || payload.idle === true || !Array.isArray(payload.items) || payload.items.length === 0) {
      // A paid/completed transaction still shows the final total briefly, then resets.
      if (payload.type === 'paid' || payload.status === 'paid' || payload.status === 'completed') {
        showTransaction(payload);
        if (resetTimer) { try { clearTimeout(resetTimer); } catch (e) {} }
        resetTimer = setTimeout(function () { showIdle(); }, 8000);
        return;
      }
      showIdle();
      return;
    }
    showTransaction(payload);
  }

  // Expose a direct entry point so the POS (or a test harness) can push a state
  // without depending on a particular transport.
  function publish(payload) {
    applyUpdate(payload);
  }
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.__toko360CustomerDisplayUpdate = publish;
      globalThis.renderCustomerDisplay = publish;
      globalThis.updateCustomerDisplay = publish;
    }
  } catch (e) { /* noop */ }

  function onMessageEvent(event) {
    var data = event && (event.data != null ? event.data : event);
    if (data && typeof data === 'object') {
      if (data.type === 'toko360.customerDisplay' && data.payload) applyUpdate(data.payload);
      else if (data.channel === CHANNEL || data.source === 'toko360.pos') applyUpdate(data.payload || data);
      else if (Array.isArray(data.items) || data.total != null || data.idle === true) applyUpdate(data);
    }
  }

  function onStorageEvent(event) {
    if (!event || (event.key && event.key !== STORAGE_KEY)) return;
    var raw = null;
    try { raw = (event.newValue != null ? event.newValue : localStorage.getItem(STORAGE_KEY)); } catch (e) { raw = null; }
    if (!raw) { showIdle(); return; }
    try { applyUpdate(JSON.parse(raw)); } catch (e) { /* noop */ }
  }

  function subscribe() {
    // BroadcastChannel (preferred, cross-tab same origin)
    try {
      if (typeof BroadcastChannel === 'function') {
        var bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = function (e) { applyUpdate(e && e.data); };
      }
    } catch (e) { /* noop */ }
    // window / document message events
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('message', onMessageEvent);
      }
    } catch (e) { /* noop */ }
    try {
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('message', onMessageEvent);
        document.addEventListener('storage', onStorageEvent);
      }
    } catch (e) { /* noop */ }
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', onStorageEvent);
      }
    } catch (e) { /* noop */ }
  }

  function boot() {
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    var branch = null;
    if (params) branch = params.get('branch');
    try {
      if (branch) { var b = $('branch'); if (b) b.textContent = 'Cabang ' + branch; }
      else {
        var stored = null;
        try { stored = localStorage.getItem('toko360.kioskBranch'); } catch (e) { stored = null; }
        if (stored) { var b2 = $('branch'); if (b2) b2.textContent = 'Cabang ' + stored.slice(0, 8); }
      }
    } catch (e) { /* noop */ }

    // Customer display is read-only and needs no device key; it is always "ready"
    // once the page has loaded. A missing transport only means "no transaction".
    setStatus('up', 'SIAP');
    showIdle();
    subscribe();

    // Pick up any transaction already published before this screen opened.
    try {
      var existing = localStorage.getItem(STORAGE_KEY);
      if (existing) applyUpdate(JSON.parse(existing));
    } catch (e) { /* noop */ }
  }

  // Allow installing a branch/api override the same way other device screens do,
  // without requiring a device key.
  try {
    var qBranch = new URLSearchParams(location.search).get('branch');
    if (qBranch) { try { localStorage.setItem('toko360.kioskBranch', qBranch); } catch (e) {} }
  } catch (e) { /* noop */ }

  boot();
})();

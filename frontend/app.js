/* WINBD-PRO frontend core
 * This file provides every global function that index.html's onclick/onsubmit
 * handlers call directly: show(), openModal(), closeModal(), login(),
 * register(), logout(), changePassword(), saveProfile(), payment(),
 * plus the api()/$()/toast() helpers that auth-gate.js and provider-lobby.js
 * both expect to already exist on window.
 */

// ---------- Backend configuration ----------
// The frontend is served by the same Render backend in production.
// Use same-origin API calls so frontend/backend can never drift apart.
const API_BASE = (window.__WINBD_API_BASE__ || '').replace(/\/$/, '');

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Toast ----------
(function injectToastStyle() {
  const style = document.createElement('style');
  style.textContent = `
    #toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);
      background:#0a2e2a;color:#e9fffb;border:1px solid #2a8c81;padding:10px 18px;
      border-radius:10px;font-size:14px;opacity:0;pointer-events:none;
      transition:opacity .25s ease,transform .25s ease;z-index:9999;max-width:90vw;text-align:center}
    #toast.show{opacity:1;transform:translate(-50%,0)}
  `;
  document.head.appendChild(style);
})();

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---------- Session state ----------
let accessToken = localStorage.getItem('winbd_access') || null;
let refreshToken = localStorage.getItem('winbd_refresh') || null;
let currentUser = null;

function setSession(data) {
  if (data?.accessToken) {
    accessToken = data.accessToken;
    localStorage.setItem('winbd_access', accessToken);
  }
  if (data?.refreshToken) {
    refreshToken = data.refreshToken;
    localStorage.setItem('winbd_refresh', refreshToken);
  }
  if (data?.user) currentUser = data.user;
}

function clearSession() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem('winbd_access');
  localStorage.removeItem('winbd_refresh');
}

// ---------- API wrapper (used by app.js, auth-gate.js, provider-lobby.js) ----------
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(apiUrl(path), { ...opts, headers });

  // Transparently refresh an expired access token once, then retry.
  if (res.status === 401 && refreshToken && !opts._retried) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${accessToken}` };
      res = await fetch(apiUrl(path), { ...opts, headers: retryHeaders, _retried: true });
    }
  }
  return res;
}

async function tryRefreshToken() {
  try {
    const r = await fetch(apiUrl('/api/bt/v1/user/refreshToken'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.data?.accessToken) {
      clearSession();
      return false;
    }
    setSession(d.data);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

// ---------- Page navigation ----------
function show(id) {
  document.querySelectorAll('.page').forEach((p) => {
    p.hidden = p.id !== id;
  });
  document.body.classList.remove('sidebar-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'profile') loadProfile();
  if (id === 'wallet') loadWallet();
  if (id === 'history') loadHistory();
}

// ---------- Modal ----------
function closeModal() {
  const modal = $('modal');
  if (modal) modal.hidden = true;
  const body = $('modalBody');
  if (body) body.innerHTML = '';
}

function openModal(type) {
  const modal = $('modal');
  const body = $('modalBody');
  if (!modal || !body) return;

  if (type === 'login') {
    body.innerHTML = `
      <h2>লগইন</h2>
      <form class="forms" onsubmit="login(event)">
        <input id="loginUsername" placeholder="ইউজারনেম" required autocomplete="username">
        <input id="loginPassword" type="password" placeholder="পাসওয়ার্ড" required autocomplete="current-password">
        <button class="primary">লগইন</button>
      </form>
    `;
  } else if (type === 'register') {
    body.innerHTML = `
      <h2>রেজিস্টার</h2>
      <form class="forms" onsubmit="register(event)">
        <input id="regUsername" placeholder="ইউজারনেম" required minlength="3" autocomplete="username">
        <input id="regPassword" type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৮ ক্যারেক্টার)" required minlength="8" autocomplete="new-password">
        <input id="regPhone" placeholder="ফোন নম্বর (ঐচ্ছিক)">
        <input id="regEmail" type="email" placeholder="ইমেইল (ঐচ্ছিক)">
        <button class="primary">রেজিস্টার</button>
      </form>
    `;
  }
  modal.hidden = false;
}

// ---------- Auth actions ----------
async function login(e) {
  e.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  try {
    const r = await api('/api/bt/v2_1/user/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    const d = await r.json().catch(() => ({}));

    if (!r.ok || !d?.data?.accessToken) {
      console.error('Login did not return a usable session. Full response:', {
        status: r.status,
        ok: r.ok,
        body: d
      });
      toast(d?.message || 'লগইন ব্যর্থ হয়েছে (সার্ভার থেকে সঠিক রেসপন্স আসেনি)');
      return;
    }

    setSession(d.data);
    closeModal();
    updateNav();
    if (typeof syncHeaderActions === 'function') syncHeaderActions();
    toast('সফলভাবে লগইন হয়েছে');
    if (typeof window.load === 'function') window.load();
  } catch (err) {
    console.error('login error:', err);
    toast('Backend-এ সংযোগ করা যাচ্ছে না');
  }
}

async function register(e) {
  e.preventDefault();
  const payload = {
    username: $('regUsername').value.trim(),
    password: $('regPassword').value,
    phone: $('regPhone')?.value.trim() || undefined,
    email: $('regEmail')?.value.trim() || undefined
  };
  try {
    const r = await api('/api/bt/v2_1/user/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.data?.accessToken) {
      console.error('Register did not return a usable session. Full response:', {
        status: r.status,
        ok: r.ok,
        body: d
      });
      toast(d?.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে (সার্ভার থেকে সঠিক রেসপন্স আসেনি)');
      return;
    }
    setSession(d.data);
    closeModal();
    updateNav();
    if (typeof syncHeaderActions === 'function') syncHeaderActions();
    toast('অ্যাকাউন্ট তৈরি হয়েছে');
  } catch (err) {
    console.error('register error:', err);
    toast('Backend-এ সংযোগ করা যাচ্ছে না');
  }
}

async function logout() {
  try {
    await api('/api/bt/v1/user/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  } catch (err) {
    console.warn('logout request failed:', err);
  }
  clearSession();
  updateNav();
  show('home');
  toast('লগআউট হয়েছে');
}

function updateNav() {
  const logged = Boolean(accessToken);
  const loginBtn = $('loginBtn');
  const registerBtn = $('registerBtn');
  const logoutBtn = $('logout');
  if (loginBtn) loginBtn.hidden = logged;
  if (registerBtn) registerBtn.hidden = logged;
  if (logoutBtn) logoutBtn.hidden = !logged;
}

async function validateSession() {
  if (!accessToken) {
    updateNav();
    return;
  }
  try {
    const r = await api('/api/bt/v1/user/getProfile');
    if (!r.ok) {
      clearSession();
    } else {
      const d = await r.json();
      currentUser = d.data;
    }
  } catch (err) {
    console.warn('validateSession network error:', err);
  }
  updateNav();
}

async function health() {
  const el = $('health');
  if (!el) return;
  try {
    const r = await fetch(apiUrl('/api/bt/health'));
    const d = await r.json();
    el.textContent = d?.status === '000000' ? 'সিস্টেম সচল ✅' : 'সিস্টেম সমস্যা';
  } catch (err) {
    el.textContent = 'Backend সংযোগ করা যাচ্ছে না';
  }
}

// ---------- Profile / Wallet / History ----------
async function loadProfile() {
  const el = $('profileData');
  if (!el) return;
  if (!accessToken) {
    el.textContent = 'প্রোফাইল দেখতে আগে লগইন করুন।';
    return;
  }
  try {
    const r = await api('/api/bt/v1/user/getProfile');
    const d = await r.json();
    if (!r.ok) {
      el.textContent = d.message || 'প্রোফাইল লোড করা যায়নি';
      return;
    }
    const u = d.data;
    el.innerHTML = `
      <p><b>ইউজারনেম:</b> ${escapeHtml(u.username)}</p>
      <p><b>নাম:</b> ${escapeHtml(u.fullName || '-')}</p>
      <p><b>ইমেইল:</b> ${escapeHtml(u.email || '-')}</p>
      <p><b>ফোন:</b> ${escapeHtml(u.phone || '-')}</p>
      <p><b>স্ট্যাটাস:</b> ${escapeHtml(u.status)}</p>
    `;
    if ($('editName')) $('editName').value = u.fullName || '';
    if ($('editEmail')) $('editEmail').value = u.email || '';
    if ($('editPhone')) $('editPhone').value = u.phone || '';
  } catch (err) {
    el.textContent = 'Backend-এ সংযোগ করা যাচ্ছে না';
  }
}

async function loadWallet() {
  const el = $('walletData');
  if (!el) return;
  if (!accessToken) {
    el.textContent = 'ওয়ালেট দেখতে আগে লগইন করুন।';
    return;
  }
  try {
    const r = await api('/api/bt/v1/user/getBalance');
    const d = await r.json();
    if (!r.ok) {
      el.textContent = d.message || 'ব্যালেন্স লোড করা যায়নি';
      return;
    }
    const b = d.data || {};
    el.innerHTML = `
      <p><b>ব্যালেন্স:</b> ৳${Number(b.balance || 0).toFixed(2)}</p>
      <p><b>লকড ব্যালেন্স:</b> ৳${Number(b.locked_balance || 0).toFixed(2)}</p>
    `;
  } catch (err) {
    el.textContent = 'Backend-এ সংযোগ করা যাচ্ছে না';
  }
}

async function loadHistory() {
  const el = $('historyData');
  if (!el) return;
  if (!accessToken) {
    el.textContent = 'হিস্টোরি দেখতে আগে লগইন করুন।';
    return;
  }
  try {
    const r = await api('/api/bt/v1/payment/history');
    const d = await r.json();
    if (!r.ok) {
      el.textContent = d.message || 'হিস্টোরি লোড করা যায়নি';
      return;
    }
    const rows = d.data || [];
    el.innerHTML = rows.length
      ? `<table class="history-table"><tr><th>ধরন</th><th>পরিমাণ</th><th>মেথড</th><th>স্ট্যাটাস</th><th>তারিখ</th></tr>${rows
          .map(
            (x) => `<tr><td>${escapeHtml(x.direction)}</td><td>৳${Number(x.amount || 0).toFixed(2)}</td><td>${escapeHtml(x.method)}</td><td>${escapeHtml(x.status)}</td><td>${escapeHtml(x.created_at || x.createdAt || '')}</td></tr>`
          )
          .join('')}</table>`
      : '<p>কোনো পেমেন্ট হিস্টোরি নেই।';
  } catch (err) {
    el.textContent = 'Backend-এ সংযোগ করা যাচ্ছে না';
  }
}

async function saveProfile(e) {
  if (e) e.preventDefault();
  try {
    const r = await api('/api/bt/v1/user/saveProfile', {
      method: 'POST',
      body: JSON.stringify({
        fullName: $('editName')?.value || '',
        email: $('editEmail')?.value || '',
        phone: $('editPhone')?.value || ''
      })
    });
    const d = await r.json();
    if (!r.ok) return toast(d.message || 'প্রোফাইল আপডেট করা যায়নি');
    currentUser = d.data;
    toast('প্রোফাইল আপডেট হয়েছে');
    loadProfile();
  } catch (err) {
    toast('Backend-এ সংযোগ করা যাচ্ছে না');
  }
}

async function changePassword(e) {
  if (e) e.preventDefault();
  try {
    const oldPassword = $('oldPassword')?.value || '';
    const newPassword = $('newPassword')?.value || '';
    const r = await api('/api/bt/v1/user/changePassword', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const d = await r.json();
    if (!r.ok) return toast(d.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি');
    if ($('oldPassword')) $('oldPassword').value = '';
    if ($('newPassword')) $('newPassword').value = '';
    toast('পাসওয়ার্ড পরিবর্তন হয়েছে');
  } catch (err) {
    toast('Backend-এ সংযোগ করা যাচ্ছে না');
  }
}

async function payment(e) {
  if (e) e.preventDefault();
  if (!accessToken) return openModal('login');
  const amount = Number($('depositAmount')?.value || 0);
  const method = $('depositMethod')?.value || 'sslcommerz';
  try {
    const r = await api('/api/bt/v1/payment/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, method })
    });
    const d = await r.json();
    if (!r.ok) return toast(d.message || 'পেমেন্ট শুরু করা যায়নি');
    const url = d?.data?.nextAction?.url;
    if (url) window.location.href = url;
    else toast('পেমেন্ট গেটওয়ে URL পাওয়া যায়নি');
  } catch (err) {
    toast('Backend-এ সংযোগ করা যাচ্ছে না');
  }
}

window.api = api;
window.apiUrl = apiUrl;
window.openModal = openModal;
window.closeModal = closeModal;
window.login = login;
window.register = register;
window.logout = logout;
window.changePassword = changePassword;
window.saveProfile = saveProfile;
window.payment = payment;
window.show = show;
window.validateSession = validateSession;
window.health = health;
window.loadProfile = loadProfile;
window.loadWallet = loadWallet;
window.loadHistory = loadHistory;

window.addEventListener('DOMContentLoaded', () => {
  updateNav();
  validateSession();
  health();
});

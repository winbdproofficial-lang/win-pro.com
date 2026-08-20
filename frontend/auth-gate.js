(() => {
  const originalShow = window.show;
  const originalOpenModal = window.openModal;
  const originalRegister = window.register;
  const originalCloseModal = window.closeModal;

  const protectedPages = new Set(['games','wallet','profile','history','promotions','support']);
  const guestHiddenPages = new Set(['wallet','profile','history','promotions','support']);

  function isLoggedIn(){
    return Boolean(localStorage.getItem('winbd_access'));
  }

  function authMessage(page){
    const labels={games:'গেমস',wallet:'ওয়ালেট',profile:'প্রোফাইল',history:'হিস্টোরি',promotions:'বোনাস',support:'সাপোর্ট'};
    return `“${labels[page]||'এই অপশন'}” ব্যবহার করতে আগে লগইন করুন। নতুন অ্যাকাউন্ট না থাকলে রেজিস্টার করুন।`;
  }

  window.show = function(id){
    if(protectedPages.has(id) && !isLoggedIn()){
      originalOpenModal('login');
      setTimeout(() => {
        const msg=document.createElement('div');
        msg.className='auth-gate-msg';
        msg.textContent=authMessage(id);
        const body=document.getElementById('modalBody');
        if(body && !body.querySelector('.auth-gate-msg')) body.prepend(msg);
      },0);
      return;
    }
    return originalShow(id);
  };

  window.openModal = function(type){
    originalOpenModal(type);
    setTimeout(() => {
      const body=document.getElementById('modalBody');
      if(!body || body.querySelector('.auth-switch')) return;
      const wrap=document.createElement('div');
      wrap.className='auth-switch';
      wrap.innerHTML= type==='login'
        ? '<p class="muted">অ্যাকাউন্ট নেই? <button type="button" class="link-btn" onclick="openModal(\'register\')">এখানে রেজিস্টার করুন</button></p>'
        : '<p class="muted">আগে থেকেই অ্যাকাউন্ট আছে? <button type="button" class="link-btn" onclick="openModal(\'login\')">লগইন করুন</button></p>';
      body.appendChild(wrap);
    },0);
  };

  window.register = async function(e){
    await originalRegister(e);
    if(isLoggedIn()){
      syncHeaderActions();
      setTimeout(() => openOnboarding(), 150);
    }
  };

  function syncProtectedVisibility(logged){
    const nav=document.querySelector('.topbar nav');
    if(nav){
      nav.querySelectorAll('button').forEach(btn=>{
        const match=(btn.getAttribute('onclick')||'').match(/show\('([^']+)'\)/);
        const page=match?.[1];
        if(page && guestHiddenPages.has(page)) btn.hidden=!logged;
      });
    }

    document.querySelectorAll('[onclick*="show(\'wallet\')"]').forEach(btn=>{
      if(btn.closest('.topbar nav')) return;
      btn.classList.toggle('guest-hidden-wallet',!logged);
    });
  }

  function syncHeaderActions(){
    const top=document.querySelector('.top-actions');
    if(!top) return;
    const logged=isLoggedIn();
    const login=document.getElementById('loginBtn');
    const register=document.getElementById('registerBtn');

    if(login) login.hidden=logged;
    if(register) register.hidden=logged;

    let account=document.getElementById('authAccountActions');
    if(!account){
      account=document.createElement('div');
      account.id='authAccountActions';
      account.className='account-actions auth-account-actions';
      account.innerHTML=`
        <button type="button" class="deposit-mini" id="headerDepositBtn">＋ ডিপোজিট</button>
        <button type="button" class="withdraw-mini" id="headerWithdrawBtn">↗ উইথড্র</button>
        <button type="button" class="profile-mini" id="headerProfileBtn" aria-label="প্রোফাইল">👤</button>
      `;
      top.appendChild(account);
      account.querySelector('#headerDepositBtn').onclick=()=>{ show('wallet'); setTimeout(()=>document.getElementById('depAmount')?.focus(),120); };
      account.querySelector('#headerWithdrawBtn').onclick=()=>{ show('wallet'); setTimeout(()=>document.getElementById('wdAmount')?.focus(),120); };
      account.querySelector('#headerProfileBtn').onclick=()=>openProfileSheet();
    }
    account.hidden=!logged;
    account.style.display=logged?'flex':'none';

    syncProtectedVisibility(logged);
    top.classList.toggle('is-authenticated',logged);
  }

  function openOnboarding(){
    const modal=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!modal||!body) return;
    body.innerHTML=`
      <div class="onboarding-card">
        <h2>অ্যাকাউন্ট সেটআপ সম্পূর্ণ করুন</h2>
        <p class="muted">আপনার প্রোফাইলের তথ্য পূরণ করুন। ফোন/ইমেইল যাচাইয়ের জন্য OTP বা verification link ব্যবহার করুন—কোনো Gmail password কখনও দেবেন না।</p>
        <form onsubmit="completeOnboarding(event)">
          <input id="onboardName" placeholder="পূর্ণ নাম" required>
          <input id="onboardEmail" type="email" placeholder="ইমেইল" required>
          <input id="onboardPhone" placeholder="মোবাইল নম্বর" required>
          <input id="onboardDob" type="date" required>
          <button class="primary">তথ্য সংরক্ষণ করুন</button>
          <div id="onboardMsg"></div>
        </form>
        <div class="verify-list">
          <div><b>📱 মোবাইল যাচাই</b><span>OTP provider configure হলে চালু হবে</span><button type="button" onclick="toast('মোবাইল OTP provider এখনো configure করা হয়নি')">OTP যাচাই</button></div>
          <div><b>✉️ ইমেইল যাচাই</b><span>Verification link/OTP ব্যবহার করুন</span><button type="button" onclick="toast('ইমেইল verification provider এখনো configure করা হয়নি')">ইমেইল যাচাই</button></div>
        </div>
      </div>`;
    modal.hidden=false;
  }

  window.completeOnboarding = async function(e){
    e.preventDefault();
    const msg=document.getElementById('onboardMsg');
    try{
      const r=await window.api('/api/bt/v1/user/saveProfile',{method:'POST',body:JSON.stringify({
        fullName:document.getElementById('onboardName').value,
        email:document.getElementById('onboardEmail').value,
        phone:document.getElementById('onboardPhone').value
      })});
      const d=await r.json();
      if(!r.ok){msg.textContent=d.message||'তথ্য সংরক্ষণ করা যায়নি';return;}
      localStorage.setItem('winbd_dob',document.getElementById('onboardDob').value);
      originalCloseModal();
      if(window.toast) toast('প্রোফাইল তথ্য সংরক্ষণ হয়েছে');
      if(window.updateNav) updateNav();
      syncHeaderActions();
    }catch(err){msg.textContent='Backend-এ সংযোগ করা যাচ্ছে না';}
  };

  const style=document.createElement('style');
  style.textContent=`
    .auth-gate-msg{padding:10px 12px;margin:8px 0 14px;border:1px solid #2a8c81;border-radius:9px;background:#063f3a;color:#dffcf7}
    .auth-switch{text-align:center;margin-top:10px}
    .link-btn{background:none;border:0;color:#34dfc0;text-decoration:underline;cursor:pointer;padding:0;font:inherit}
    .onboarding-card{max-width:620px}
    .onboarding-card form{display:grid;gap:10px}
    .verify-list{display:grid;gap:10px;margin-top:18px}
    .verify-list>div{display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding:12px;border:1px solid #dce7e5;border-radius:10px;background:#f8fbfa}
    .verify-list span{font-size:12px;color:#63736f}
    .verify-list button{grid-column:2;grid-row:1/3}
    .auth-account-actions{gap:8px!important;align-items:center!important}
    .auth-account-actions button{white-space:nowrap!important}
    .auth-account-actions[hidden]{display:none!important}
    .guest-hidden-wallet{display:none!important}
    .topbar nav button[hidden]{display:none!important}
    .modal{overflow:hidden!important}
    .modal-card{width:min(980px,calc(100vw - 32px))!important;max-width:980px!important;box-sizing:border-box!important;overflow:auto!important;overflow-x:hidden!important}
    .profile-sheet{width:100%!important;max-width:900px!important;box-sizing:border-box!important;min-width:0!important}
    .profile-main{min-width:0!important;overflow:hidden!important}
    .profile-main .secure{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    @media(max-width:900px){.profile-sheet{grid-template-columns:1fr!important}.profile-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}.profile-main .secure{grid-template-columns:1fr!important}}
    @media(max-width:600px){.auth-account-actions{gap:4px!important}.auth-account-actions button{padding:8px 8px!important;font-size:12px!important}.auth-account-actions .profile-mini{width:36px!important;height:36px!important}.modal-card{width:calc(100vw - 20px)!important}}
  `;
  document.head.appendChild(style);

  syncHeaderActions();
  setTimeout(syncHeaderActions,100);
  setTimeout(syncHeaderActions,500);
  setInterval(syncHeaderActions,1000);
})();

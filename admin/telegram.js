(() => {
  const originalGo = window.go;
  const nav = document.querySelector('.sidebar nav');
  if (!nav) return;
  const btn = document.createElement('button');
  btn.className = 'nav';
  btn.dataset.page = 'telegram';
  btn.textContent = '✈ Telegram News';
  nav.appendChild(btn);

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  async function telegramPage(){
    document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page==='telegram'));
    const title=document.getElementById('pageTitle');
    const content=document.getElementById('content');
    if(title) title.textContent='Telegram News';
    content.innerHTML='<div class="card section"><div class="section-head"><div><h3>Telegram Channel</h3><p class="muted">Admin panel থেকে সরাসরি <b>@winprofficial</b> channel-এ news/message পাঠান।</p></div><span id="tgStatus">Checking…</span></div><form id="tgForm" style="display:grid;gap:12px;max-width:760px"><input id="tgTitle" maxlength="200" placeholder="News title (optional)"><textarea id="tgMessage" maxlength="4000" rows="9" placeholder="আপনার message/news লিখুন…" required></textarea><div style="display:flex;gap:10px;align-items:center"><button class="primary" type="submit">✈ Send to Telegram</button><button type="button" id="tgClear">Clear</button></div><div id="tgMsg"></div></form></div>';
    const r=await api('/api/admin/v1/telegram/status');
    const d=await r.json().catch(()=>({}));
    const status=document.getElementById('tgStatus');
    if(status) status.textContent=r.ok&&d.data?.configured?`Connected: ${esc(d.data.channel)}`:'Bot token not configured';
    document.getElementById('tgClear').onclick=()=>{document.getElementById('tgTitle').value='';document.getElementById('tgMessage').value='';};
    document.getElementById('tgForm').onsubmit=async e=>{
      e.preventDefault();
      const msg=document.getElementById('tgMsg');
      msg.textContent='Sending…';
      const rr=await api('/api/admin/v1/telegram/send',{method:'POST',body:JSON.stringify({title:document.getElementById('tgTitle').value,message:document.getElementById('tgMessage').value})});
      const dd=await rr.json().catch(()=>({}));
      msg.textContent=rr.ok?`Sent successfully. Telegram message ID: ${dd.data?.messageId||'—'}`:(dd.message||'Send failed');
      if(rr.ok){document.getElementById('tgTitle').value='';document.getElementById('tgMessage').value='';}
    };
  }

  window.go = function(page){
    if(page==='telegram') return telegramPage();
    return originalGo(page);
  };
  btn.onclick=()=>window.go('telegram');
})();

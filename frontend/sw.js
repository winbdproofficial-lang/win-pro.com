const CACHE='winbd-pro-shell-v6';
const SHELL=['/','/index.html','/style.css','/app.js','/auth-gate.js','/manifest.webmanifest','/demo-game.html'];
const DEMO_GAMES=[
 {provider:'Demo JILI',name:'Super Ace Demo',icon:'👑'},
 {provider:'Demo JILI',name:'Fortune Gems Demo',icon:'💎'},
 {provider:'Demo Slots',name:'Fiery Sevens Demo',icon:'7️⃣'},
 {provider:'Demo Slots',name:'Lucky Fruits Demo',icon:'🍒'},
 {provider:'Demo Arcade',name:'Fruit Party Demo',icon:'🍉'},
 {provider:'Demo Table',name:'Sic Bo Demo',icon:'🎲'},
 {provider:'Demo Crash',name:'Crash Demo',icon:'💥'},
 {provider:'Demo Live',name:'Roulette Demo',icon:'🎡'}
];
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith('winbd-pro-shell-')&&k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  if(url.pathname==='/api/bt/v1/provider/games' && event.request.method==='GET'){
    event.respondWith(Promise.resolve(json({success:true,data:{provider:'WINBD Demo Provider',games:DEMO_GAMES}})));
    return;
  }

  if(url.pathname==='/api/bt/v1/provider/launch' && event.request.method==='POST'){
    event.respondWith((async()=>{
      let body={};
      try{body=await event.request.clone().json();}catch{}
      const provider=String(body.provider||'Demo Provider');
      const gameId=String(body.gameId||'Demo Game');
      const session=crypto.randomUUID();
      const target=`/demo-game.html?provider=${encodeURIComponent(provider)}&game=${encodeURIComponent(gameId)}&session=${encodeURIComponent(session)}`;
      return json({success:true,data:{mode:'demo',provider,gameId,url:target,message:'Demo provider launch'}});
    })());
    return;
  }

  if(event.request.method!=='GET') return;
  // Keep API/database responses live; never serve them from the PWA cache.
  if(url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('/index.html')))
  );
});

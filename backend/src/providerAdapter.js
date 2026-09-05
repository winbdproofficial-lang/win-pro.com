'use strict';

const crypto = require('crypto');
const required = (name) => process.env[name] || '';
const VENDORS = {
  pragmatic: { vendorCode: 'Pragmatic', agentId: required('WINBD_PRAGMATIC_AGENT_ID'), apiToken: required('WINBD_PRAGMATIC_API_TOKEN'), secretKey: required('WINBD_PRAGMATIC_SECRET_KEY'), baseUrl: required('WINBD_PRAGMATIC_ENDPOINT') },
  pgsoft: { vendorCode: 'PGSoft', agentId: required('WINBD_PGSOFT_AGENT_ID'), apiToken: required('WINBD_PGSOFT_API_TOKEN'), secretKey: required('WINBD_PGSOFT_SECRET_KEY'), baseUrl: required('WINBD_PGSOFT_ENDPOINT') },
  amatic: { vendorCode: 'Amatic', agentId: required('WINBD_AMATIC_AGENT_ID'), apiToken: required('WINBD_AMATIC_API_TOKEN'), secretKey: required('WINBD_AMATIC_SECRET_KEY'), baseUrl: required('WINBD_AMATIC_ENDPOINT') },
  amusnet: { vendorCode: 'Amusnet', agentId: required('WINBD_AMUSNET_AGENT_ID'), apiToken: required('WINBD_AMUSNET_API_TOKEN'), secretKey: required('WINBD_AMUSNET_SECRET_KEY'), baseUrl: required('WINBD_AMUSNET_ENDPOINT') },
};
const CALLBACK_URL = process.env.PROVIDER_CALLBACK_URL || `${process.env.PUBLIC_API_URL || ''}/api/callback`;
function sign(secretKey, message) { return crypto.createHmac('sha256', secretKey || '').update(message).digest('hex').toUpperCase(); }
function isGitSlotPark(baseUrl) { return /gitslotpark\.com/i.test(String(baseUrl || '')); }
class ProviderAdapter {
  constructor() { this.vendors = VENDORS; this.callbackUrl = CALLBACK_URL; for (const [key, v] of Object.entries(this.vendors)) { const missing = ['agentId','apiToken','secretKey','baseUrl'].filter((field) => !v[field]); if (missing.length) console.warn(`[providerAdapter] ${key} not configured — missing ${missing.join(', ')}`); } }
  status() { const out = {}; for (const [key,v] of Object.entries(this.vendors)) out[key]={baseUrl:v.baseUrl,apiStyle:isGitSlotPark(v.baseUrl)?'gitslotpark':'legacy',hasAgentId:Boolean(v.agentId),hasApiToken:Boolean(v.apiToken),hasSecretKey:Boolean(v.secretKey)}; return {name:'winbd',enabled:true,vendors:out}; }
  async listGames() {
    const all=[];
    await Promise.all(Object.entries(this.vendors).map(async([key,v])=>{
      const gitSlotPark=isGitSlotPark(v.baseUrl);
      if(!v.apiToken||!v.baseUrl||(!gitSlotPark&&!v.agentId))return;
      try{
        let response;
        const base=v.baseUrl.replace(/\/$/,'');
        if(gitSlotPark){
          response=await fetch(`${base}/gamelist`,{method:'GET',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${v.apiToken}`}});
        }else{
          const payload={agentID:v.agentId,apiToken:v.apiToken};
          payload.sign=sign(v.secretKey,v.agentId);
          response=await fetch(`${base}/gamelist`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
        }
        if(!response.ok){console.error(`[providerAdapter] ${key} gamelist HTTP ${response.status}`);return;}
        const data=await response.json();
        const errorCode=Number(data.error??data.errorCode??data.code??0);
        if(errorCode!==0){console.error(`[providerAdapter] ${key} gamelist provider code ${errorCode}:`,data.message||'unknown error');return;}
        const list=Array.isArray(data)?data:Array.isArray(data.games)?data.games:Array.isArray(data.data)?data.data:Array.isArray(data.list)?data.list:Array.isArray(data.result)?data.result:[];
        for(const g of list){
          const gameCode=g.gameCode??g.game_code??g.gameId??g.gameid??g.code??g.id;
          if(gameCode===undefined||gameCode===null||gameCode==='')continue;
          const rawVendor=g.vendorCode??g.vendor_code??g.vendorid??g.provider??g.vendor??v.vendorCode;
          const rawVendorKey=String(rawVendor).toLowerCase().replace(/[^a-z]/g,'');
          const vendorCode=['pgsoft','pgsoftgames','pg'].includes(rawVendorKey)?'PGSoft':['amusnet','egtinteractive'].includes(rawVendorKey)?'Amusnet':v.vendorCode;
          all.push({gameCode,vendorCode,name:g.gameName??g.game_name??g.name??String(gameCode),image:g.image??g.icon??g.thumbnail??g.iconurl??g.iconurl1??g.iconurl2??g.imageUrl??g.image_url??'',gameTypeId:g.category??g.type??g.gameTypeId??'Slots',hasTrialPlay:Boolean(g.demo??g.hasTrialPlay??g.has_trial_play??false)});
        }
      }catch(err){console.error(`[providerAdapter] ${key} listGames error:`,err.message);}
    }));
    return {games:all};
  }
  async launchGame({gameId,vendorCode,userId,returnUrl,trial}={}) { if(gameId===undefined||gameId===null||gameId==='')throw new Error('gameId is required');const v=this.resolveVendor(vendorCode);if(!v||!v.agentId||!v.apiToken||!v.baseUrl)throw new Error(`Unknown or unconfigured vendor: ${vendorCode}`);const base=v.baseUrl.replace(/\/$/,'');const effectiveUserId=trial?'guest':String(userId||'guest');let response;if(isGitSlotPark(v.baseUrl)){const numericGameId=Number(gameId);if(!Number.isInteger(numericGameId))throw new Error(`Invalid GitSlotPark game id: ${gameId}`);const safeUserId=effectiveUserId.replace(/[^A-Za-z0-9]/g,'').slice(0,48);if(safeUserId.length<4)throw new Error('Provider user ID must contain at least 4 alphanumeric characters');response=await fetch(`${base}/userAuth`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${v.apiToken}`},body:JSON.stringify({agentID:v.agentId,userID:safeUserId,lang:'en',gameid:numericGameId,isaffiliate:false,lobbyUrl:returnUrl||this.callbackUrl})});}else{const payload={agentID:v.agentId,apiToken:v.apiToken,userID:effectiveUserId,gameCode:gameId,lang:'en',homeUrl:returnUrl||this.callbackUrl,trial:Boolean(trial)};payload.sign=sign(v.secretKey,`${v.agentId}${effectiveUserId}${gameId}`);response=await fetch(`${base}/userAuth`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});}if(!response.ok)throw new Error(`Provider API error: ${response.status}`);const data=await response.json();const errorCode=Number(data.error??data.errorCode??data.code??0);if(errorCode!==0)throw new Error(data.message||`Launch error code ${errorCode}`);const gameUrl=data.url||data.gameUrl||data.launchUrl||data.data?.url;if(!gameUrl)throw new Error('Provider response did not include a game URL');return {url:gameUrl}; }
  resolveVendor(vendorCode) { if(!vendorCode)return null;const lower=String(vendorCode).toLowerCase();return Object.values(this.vendors).find(v=>v.vendorCode.toLowerCase()===lower)||this.vendors[lower]||null; }
  resolveVendorByAgent(agentId) { if(!agentId)return null;return Object.values(this.vendors).find(v=>v.agentId && String(v.agentId)===String(agentId))||null; }
  verifyCallback(vendorCode,message,signature) { const v=this.resolveVendor(vendorCode);if(!v||!v.secretKey)return false;const expected=sign(v.secretKey,message);const a=Buffer.from(expected);const b=Buffer.from(String(signature||'').toUpperCase());return a.length===b.length&&crypto.timingSafeEqual(a,b); }
}
module.exports=ProviderAdapter;

'use strict';

const crypto = require('crypto');

const required = (name) => process.env[name] || '';

const VENDORS = {
  pragmatic: {
    vendorCode: 'Pragmatic',
    agentId: required('WINBD_PRAGMATIC_AGENT_ID'),
    apiToken: required('WINBD_PRAGMATIC_API_TOKEN'),
    secretKey: required('WINBD_PRAGMATIC_SECRET_KEY'),
    baseUrl: required('WINBD_PRAGMATIC_ENDPOINT'),
  },
  pgsoft: {
    vendorCode: 'PGSoft',
    agentId: required('WINBD_PGSOFT_AGENT_ID'),
    apiToken: required('WINBD_PGSOFT_API_TOKEN'),
    secretKey: required('WINBD_PGSOFT_SECRET_KEY'),
    baseUrl: required('WINBD_PGSOFT_ENDPOINT'),
  },
  amatic: {
    vendorCode: 'Amatic',
    agentId: required('WINBD_AMATIC_AGENT_ID'),
    apiToken: required('WINBD_AMATIC_API_TOKEN'),
    secretKey: required('WINBD_AMATIC_SECRET_KEY'),
    baseUrl: required('WINBD_AMATIC_ENDPOINT'),
  },
  amusnet: {
    vendorCode: 'Amusnet',
    agentId: required('WINBD_AMUSNET_AGENT_ID'),
    apiToken: required('WINBD_AMUSNET_API_TOKEN'),
    secretKey: required('WINBD_AMUSNET_SECRET_KEY'),
    baseUrl: required('WINBD_AMUSNET_ENDPOINT'),
  },
};

const CALLBACK_URL = process.env.PROVIDER_CALLBACK_URL || `${process.env.PUBLIC_API_URL || ''}/api/callback`;

function sign(secretKey, message) {
  return crypto.createHmac('sha256', secretKey || '').update(message).digest('hex').toUpperCase();
}

class ProviderAdapter {
  constructor() {
    this.vendors = VENDORS;
    this.callbackUrl = CALLBACK_URL;
    for (const [key, v] of Object.entries(this.vendors)) {
      const missing = ['agentId', 'apiToken', 'secretKey', 'baseUrl'].filter((field) => !v[field]);
      if (missing.length) console.warn(`[providerAdapter] ${key} not configured — missing ${missing.join(', ')}`);
    }
  }

  status() {
    const out = {};
    for (const [key, v] of Object.entries(this.vendors)) {
      out[key] = { baseUrl: v.baseUrl, hasAgentId: Boolean(v.agentId), hasApiToken: Boolean(v.apiToken), hasSecretKey: Boolean(v.secretKey) };
    }
    return { name: 'winbd', enabled: true, vendors: out };
  }

  async listGames() {
    const all = [];
    await Promise.all(Object.entries(this.vendors).map(async ([key, v]) => {
      if (!v.agentId || !v.apiToken || !v.secretKey || !v.baseUrl) return;
      try {
        const payload = { agentID: v.agentId, apiToken: v.apiToken };
        payload.sign = sign(v.secretKey, `${v.agentId}`);
        const response = await fetch(`${v.baseUrl.replace(/\/$/, '')}/gamelist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { console.error(`[providerAdapter] ${key} gamelist failed:`, response.status); return; }
        const data = await response.json();
        const errorCode = Number(data.error ?? data.errorCode ?? 0);
        if (errorCode !== 0) { console.error(`[providerAdapter] ${key} gamelist error code:`, errorCode, data.message); return; }
        const list = data.games || data.data || data.list || [];
        for (const g of list) all.push({ gameCode: g.gameCode || g.code || g.gameId, vendorCode: v.vendorCode, name: g.gameName || g.name, image: g.image || g.icon || g.thumbnail || '', gameTypeId: g.category || g.type || 'Slots', hasTrialPlay: Boolean(g.demo ?? g.hasTrialPlay ?? false) });
      } catch (err) { console.error(`[providerAdapter] ${key} listGames error:`, err.message); }
    }));
    return { games: all };
  }

  async launchGame({ gameId, vendorCode, userId, returnUrl, trial } = {}) {
    if (!gameId) throw new Error('gameId is required');
    const v = this.resolveVendor(vendorCode);
    if (!v || !v.agentId || !v.apiToken || !v.secretKey || !v.baseUrl) throw new Error(`Unknown or unconfigured vendor: ${vendorCode}`);
    const effectiveUserId = trial ? 'guest' : String(userId || 'guest');
    const payload = { agentID: v.agentId, apiToken: v.apiToken, userID: effectiveUserId, gameCode: gameId, lang: 'en', homeUrl: returnUrl || this.callbackUrl, trial: Boolean(trial) };
    payload.sign = sign(v.secretKey, `${v.agentId}${effectiveUserId}${gameId}`);
    const response = await fetch(`${v.baseUrl.replace(/\/$/, '')}/userAuth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Provider API error: ${response.status}`);
    const data = await response.json();
    const errorCode = Number(data.error ?? data.errorCode ?? 0);
    if (errorCode !== 0) throw new Error(data.message || `Launch error code ${errorCode}`);
    const gameUrl = data.url || data.gameUrl || data.launchUrl || data.data?.url;
    if (!gameUrl) throw new Error('Provider response did not include a game URL');
    return { url: gameUrl };
  }

  resolveVendor(vendorCode) {
    if (!vendorCode) return null;
    const lower = String(vendorCode).toLowerCase();
    return Object.values(this.vendors).find((v) => v.vendorCode.toLowerCase() === lower) || this.vendors[lower] || null;
  }

  verifyCallback(vendorCode, message, signature) {
    const v = this.resolveVendor(vendorCode);
    if (!v || !v.secretKey) return false;
    const expected = sign(v.secretKey, message);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || '').toUpperCase());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

module.exports = ProviderAdapter;

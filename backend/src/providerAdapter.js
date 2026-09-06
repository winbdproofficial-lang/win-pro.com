'use strict';

const crypto = require('crypto');

const env = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return String(value);
  }
  return '';
};

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw.replace(/\/$/, '') : `https://${raw}`.replace(/\/$/, '');
};

const VENDORS = {
  pragmatic: {
    vendorCode: 'Pragmatic',
    agentId: env('WINBD_PRAGMATIC_AGENT_ID', 'PRAGMATIC_AGENT_ID'),
    apiToken: env('WINBD_PRAGMATIC_API_TOKEN', 'PRAGMATIC_API_TOKEN'),
    secretKey: env('WINBD_PRAGMATIC_SECRET_KEY', 'PRAGMATIC_SECRET_KEY'),
    baseUrl: normalizeBaseUrl(env('WINBD_PRAGMATIC_ENDPOINT', 'PRAGMATIC_API_ENDPOINT')),
  },
  pgsoft: {
    vendorCode: 'PGSoft',
    agentId: env('WINBD_PGSOFT_AGENT_ID', 'PGSOFT_AGENT_ID'),
    apiToken: env('WINBD_PGSOFT_API_TOKEN', 'PGSOFT_API_TOKEN'),
    secretKey: env('WINBD_PGSOFT_SECRET_KEY', 'PGSOFT_SECRET_KEY'),
    baseUrl: normalizeBaseUrl(env('WINBD_PGSOFT_ENDPOINT', 'PGSOFT_API_ENDPOINT')),
  },
  amatic: {
    vendorCode: 'Amatic',
    agentId: env('WINBD_AMATIC_AGENT_ID', 'AMATIC_AGENT_ID'),
    apiToken: env('WINBD_AMATIC_API_TOKEN', 'AMATIC_API_TOKEN'),
    secretKey: env('WINBD_AMATIC_SECRET_KEY', 'AMATIC_SECRET_KEY'),
    baseUrl: normalizeBaseUrl(env('WINBD_AMATIC_ENDPOINT', 'AMATIC_API_ENDPOINT')),
  },
  amusnet: {
    vendorCode: 'Amusnet',
    agentId: env('WINBD_AMUSNET_AGENT_ID', 'AMUSNET_AGENT_ID'),
    apiToken: env('WINBD_AMUSNET_API_TOKEN', 'AMUSNET_API_TOKEN'),
    secretKey: env('WINBD_AMUSNET_SECRET_KEY', 'AMUSNET_SECRET_KEY'),
    baseUrl: normalizeBaseUrl(env('WINBD_AMUSNET_ENDPOINT', 'AMUSNET_API_ENDPOINT')),
  },
};

const CALLBACK_URL = env('PROVIDER_CALLBACK_URL', 'PRAGMATIC_CALLBACK_URL') || `${process.env.PUBLIC_API_URL || ''}/api/callback`;

function sign(secretKey, message) {
  return crypto.createHmac('sha256', secretKey || '').update(message).digest('hex').toUpperCase();
}

function isBearerGetApi(baseUrl) {
  return /gitslotpark\.com|loginxgamesapi\.com/i.test(String(baseUrl || ''));
}

function canonicalVendor(rawVendor, fallback) {
  const key = String(rawVendor || '').toLowerCase().replace(/[^a-z]/g, '');
  if (['pgsoft', 'pgsoftgames', 'pg'].includes(key)) return 'PGSoft';
  if (['pragmatic', 'pragmaticplay', 'pp'].includes(key)) return 'Pragmatic';
  if (['amusnet', 'egtinteractive'].includes(key)) return 'Amusnet';
  if (['amatic', 'amaticindustries'].includes(key)) return 'Amatic';
  return fallback;
}

class ProviderAdapter {
  constructor() {
    this.vendors = VENDORS;
    this.callbackUrl = CALLBACK_URL;
    for (const [key, v] of Object.entries(this.vendors)) {
      const missing = ['agentId', 'apiToken', 'baseUrl'].filter((field) => !v[field]);
      if (missing.length) console.warn(`[providerAdapter] ${key} not configured — missing ${missing.join(', ')}`);
    }
  }

  status() {
    const out = {};
    for (const [key, v] of Object.entries(this.vendors)) {
      out[key] = {
        baseUrl: v.baseUrl,
        apiStyle: isBearerGetApi(v.baseUrl) ? 'bearer' : 'legacy',
        hasAgentId: Boolean(v.agentId),
        hasApiToken: Boolean(v.apiToken),
        hasSecretKey: Boolean(v.secretKey),
      };
    }
    return { name: 'winbd', enabled: true, vendors: out };
  }

  async listGames() {
    const all = [];
    await Promise.all(Object.entries(this.vendors).map(async ([key, v]) => {
      if (!v.apiToken || !v.baseUrl || (!v.agentId && !isBearerGetApi(v.baseUrl))) return;
      try {
        const base = v.baseUrl;
        let response;

        // GitSlotPark and the loginxgamesapi gateway expose gamelist as GET + Bearer.
        if (isBearerGetApi(base)) {
          response = await fetch(`${base}/gamelist`, {
            method: 'GET',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${v.apiToken}` },
          });
        } else {
          const payload = { agentID: v.agentId, apiToken: v.apiToken, sign: sign(v.secretKey, v.agentId) };
          response = await fetch(`${base}/gamelist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        if (!response.ok) {
          console.error(`[providerAdapter] ${key} gamelist HTTP ${response.status}`);
          return;
        }

        const data = await response.json();
        const errorCode = Number(data?.error ?? data?.errorCode ?? data?.code ?? 0);
        if (errorCode !== 0) {
          console.error(`[providerAdapter] ${key} gamelist provider code ${errorCode}:`, data?.message || 'unknown error');
          return;
        }

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.games) ? data.games
          : Array.isArray(data.data) ? data.data
          : Array.isArray(data.list) ? data.list
          : Array.isArray(data.result) ? data.result
          : [];

        for (const g of list) {
          const gameCode = g.gameCode ?? g.game_code ?? g.gameId ?? g.gameid ?? g.code ?? g.id;
          if (gameCode === undefined || gameCode === null || gameCode === '') continue;
          const vendorCode = canonicalVendor(
            g.vendorCode ?? g.vendor_code ?? g.vendorId ?? g.vendor_id ?? g.vendorid ?? g.provider ?? g.vendor,
            v.vendorCode,
          );
          all.push({
            gameCode,
            vendorCode,
            name: g.gameName ?? g.game_name ?? g.name ?? String(gameCode),
            image: g.image ?? g.icon ?? g.thumbnail ?? g.iconurl ?? g.iconurl1 ?? g.iconurl2 ?? g.iconurl3 ?? g.imageUrl ?? g.image_url ?? '',
            gameTypeId: g.category ?? g.type ?? g.gameTypeId ?? g.game_type_id ?? 'Slots',
            extraData: g.extraData ?? g.extra_data ?? null,
            hasTrialPlay: Boolean(g.demo ?? g.hasTrialPlay ?? g.has_trial_play ?? false),
          });
        }
      } catch (err) {
        console.error(`[providerAdapter] ${key} listGames error:`, err.message);
      }
    }));

    const seen = new Set();
    const games = all.filter((game) => {
      const key = `${game.vendorCode}:${game.gameCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { games };
  }

  async launchGame({ gameId, vendorCode, userId, returnUrl, trial } = {}) {
    if (gameId === undefined || gameId === null || gameId === '') throw new Error('gameId is required');
    const v = this.resolveVendor(vendorCode);
    if (!v || !v.agentId || !v.apiToken || !v.baseUrl) throw new Error(`Unknown or unconfigured vendor: ${vendorCode}`);
    const base = v.baseUrl;
    const effectiveUserId = trial ? 'guest' : String(userId || 'guest');
    let response;

    if (isBearerGetApi(base)) {
      const numericGameId = Number(gameId);
      if (!Number.isInteger(numericGameId)) throw new Error(`Invalid game id: ${gameId}`);
      const safeUserId = effectiveUserId.replace(/[^A-Za-z0-9]/g, '').slice(0, 48);
      if (safeUserId.length < 4) throw new Error('Provider user ID must contain at least 4 alphanumeric characters');
      response = await fetch(`${base}/userAuth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${v.apiToken}` },
        body: JSON.stringify({ agentID: v.agentId, userID: safeUserId, lang: 'en', gameid: numericGameId, isaffiliate: false, lobbyUrl: returnUrl || this.callbackUrl }),
      });
    } else {
      const payload = {
        agentID: v.agentId,
        apiToken: v.apiToken,
        userID: effectiveUserId,
        gameCode: gameId,
        lang: 'en',
        homeUrl: returnUrl || this.callbackUrl,
        trial: Boolean(trial),
      };
      payload.sign = sign(v.secretKey, `${v.agentId}${effectiveUserId}${gameId}`);
      response = await fetch(`${base}/userAuth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) throw new Error(`Provider API error: ${response.status}`);
    const data = await response.json();
    const errorCode = Number(data?.error ?? data?.errorCode ?? data?.code ?? 0);
    if (errorCode !== 0) throw new Error(data?.message || `Launch error code ${errorCode}`);
    const gameUrl = data?.url || data?.gameUrl || data?.launchUrl || data?.data?.url;
    if (!gameUrl) throw new Error('Provider response did not include a game URL');
    return { url: gameUrl };
  }

  resolveVendor(vendorCode) {
    if (!vendorCode) return null;
    const lower = String(vendorCode).toLowerCase();
    return Object.values(this.vendors).find((v) => v.vendorCode.toLowerCase() === lower) || this.vendors[lower] || null;
  }

  resolveVendorByAgent(agentId) {
    if (!agentId) return null;
    return Object.values(this.vendors).find((v) => v.agentId && String(v.agentId) === String(agentId)) || null;
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

'use strict';

const crypto = require('crypto');

/**
 * Provider Adapter for WinBD Gaming Platform — PRODUCTION CONFIGURATION.
 * 
 * SECURITY: All credentials are read ONLY from environment variables.
 * 
 * Provider configuration is OPTIONAL. If credentials are not provided,
 * those vendors will be skipped gracefully (their games won't appear,
 * but the application continues running).
 * 
 * Optional environment variables per vendor:
 * - WINBD_PRAGMATIC_AGENT_ID, WINBD_PRAGMATIC_API_TOKEN, WINBD_PRAGMATIC_SECRET_KEY
 * - WINBD_PGSOFT_AGENT_ID, WINBD_PGSOFT_API_TOKEN, WINBD_PGSOFT_SECRET_KEY
 * - WINBD_AMATIC_AGENT_ID, WINBD_AMATIC_API_TOKEN, WINBD_AMATIC_SECRET_KEY
 * - WINBD_AMUSNET_AGENT_ID, WINBD_AMUSNET_API_TOKEN, WINBD_AMUSNET_SECRET_KEY
 */

const VENDORS = {
  pragmatic: {
    vendorCode: 'Pragmatic',
    agentId: process.env.WINBD_PRAGMATIC_AGENT_ID,
    apiToken: process.env.WINBD_PRAGMATIC_API_TOKEN,
    secretKey: process.env.WINBD_PRAGMATIC_SECRET_KEY,
    baseUrl: process.env.WINBD_PRAGMATIC_ENDPOINT || 'https://ptapi.loginxgamesapi.com',
  },
  pgsoft: {
    vendorCode: 'PGSoft',
    agentId: process.env.WINBD_PGSOFT_AGENT_ID,
    apiToken: process.env.WINBD_PGSOFT_API_TOKEN,
    secretKey: process.env.WINBD_PGSOFT_SECRET_KEY,
    baseUrl: process.env.WINBD_PGSOFT_ENDPOINT || 'https://ggapi.loginxgamesapi.com',
  },
  amatic: {
    vendorCode: 'Amatic',
    agentId: process.env.WINBD_AMATIC_AGENT_ID,
    apiToken: process.env.WINBD_AMATIC_API_TOKEN,
    secretKey: process.env.WINBD_AMATIC_SECRET_KEY,
    baseUrl: process.env.WINBD_AMATIC_ENDPOINT || 'https://amapi.loginxgamesapi.com',
  },
  amusnet: {
    vendorCode: 'Amusnet',
    agentId: process.env.WINBD_AMUSNET_AGENT_ID,
    apiToken: process.env.WINBD_AMUSNET_API_TOKEN,
    secretKey: process.env.WINBD_AMUSNET_SECRET_KEY,
    baseUrl: process.env.WINBD_AMUSNET_ENDPOINT || 'https://apiang.gitamus.net',
  },
};

const CALLBACK_URL = process.env.PROVIDER_CALLBACK_URL || 'https://win-proo-server.onrender.com/api/bt/v1/provider/callback';

function sign(secretKey, message) {
  return crypto.createHmac('sha256', secretKey || '').update(message).digest('hex').toUpperCase();
}

class ProviderAdapter {
  constructor() {
    this.vendors = VENDORS;
    this.callbackUrl = CALLBACK_URL;
    
    // Log configuration status
    for (const [key, v] of Object.entries(this.vendors)) {
      const configured = Boolean(v.agentId && v.apiToken && v.secretKey);
      if (configured) {
        console.log(`[providerAdapter] ${key} ✓ configured`);
      } else {
        console.log(`[providerAdapter] ${key} ⚠ not configured (skipped)`);
      }
    }
  }

  status() {
    const out = {};
    for (const [key, v] of Object.entries(this.vendors)) {
      out[key] = {
        baseUrl: v.baseUrl,
        configured: Boolean(v.agentId && v.apiToken && v.secretKey),
        hasAgentId: Boolean(v.agentId),
        hasApiToken: Boolean(v.apiToken),
        hasSecretKey: Boolean(v.secretKey),
      };
    }
    return { name: 'winbd', enabled: true, vendors: out };
  }

  /**
   * Fetches the game list from EVERY configured vendor and merges them.
   * Returns { games: [...] } — normalizeCatalogue() in providerRoutes.js
   * expects each item to carry gameCode / vendorCode / name / image at least.
   */
  async listGames() {
    const all = [];

    await Promise.all(
      Object.entries(this.vendors).map(async ([key, v]) => {
        if (!v.agentId || !v.apiToken || !v.baseUrl) return;

        try {
          const payload = {
            agentID: v.agentId,
            apiToken: v.apiToken,
          };
          payload.sign = sign(v.secretKey, `${v.agentId}`);

          const response = await fetch(`${v.baseUrl}/gamelist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error(`[providerAdapter] ${key} gamelist failed:`, response.status, body);
            return;
          }

          const data = await response.json();
          const errorCode = Number(data.error ?? data.errorCode ?? 0);
          if (errorCode !== 0) {
            console.error(`[providerAdapter] ${key} gamelist error code:`, errorCode, data.message);
            return;
          }

          const list = data.games || data.data || data.list || [];
          for (const g of list) {
            all.push({
              gameCode: g.gameCode || g.code || g.gameId,
              vendorCode: v.vendorCode,
              name: g.gameName || g.name,
              image: g.image || g.icon || g.thumbnail || '',
              gameTypeId: g.category || g.type || 'Slots',
              hasTrialPlay: Boolean(g.demo ?? g.hasTrialPlay ?? false),
            });
          }
        } catch (err) {
          console.error(`[providerAdapter] ${key} listGames error:`, err.message);
        }
      })
    );

    return { games: all };
  }

  /**
   * Launches a real (or trial) game for a specific vendor.
   * `vendorCode` must match one of the VENDORS entries (case-insensitive).
   */
  async launchGame({ gameId, vendorCode, userId, returnUrl, trial } = {}) {
    if (!gameId) throw new Error('gameId is required');
    const v = this.resolveVendor(vendorCode);
    if (!v) throw new Error(`Unknown or unconfigured vendor: ${vendorCode}`);
    if (!v.agentId || !v.apiToken) throw new Error(`Vendor ${vendorCode} is not configured`);

    const effectiveUserId = trial ? 'guest' : String(userId || 'guest');

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

    const response = await fetch(`${v.baseUrl}/userAuth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[providerAdapter] launchGame failed:', response.status, body);
      throw new Error(`Provider API error: ${response.status}`);
    }

    const data = await response.json();
    const errorCode = Number(data.error ?? data.errorCode ?? 0);
    if (errorCode !== 0) {
      throw new Error(data.message || `Launch error code ${errorCode}`);
    }

    const gameUrl = data.url || data.gameUrl || data.launchUrl || data.data?.url;
    if (!gameUrl) throw new Error('Provider response did not include a game URL');

    return { url: gameUrl };
  }

  resolveVendor(vendorCode) {
    if (!vendorCode) return null;
    const lower = String(vendorCode).toLowerCase();
    return (
      Object.values(this.vendors).find(
        (v) => v.vendorCode.toLowerCase() === lower
      ) || this.vendors[lower] || null
    );
  }

  /**
   * Verifies a callback's HMAC sign. `vendorCode` picks which vendor's
   * secretKey to check against.
   */
  verifyCallback(vendorCode, message, signature) {
    const v = this.resolveVendor(vendorCode);
    if (!v || !v.secretKey) {
      console.warn(`[providerAdapter] No secretKey for ${vendorCode}, rejecting callback`);
      return false;
    }
    const expected = sign(v.secretKey, message);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || '').toUpperCase());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

module.exports = ProviderAdapter;

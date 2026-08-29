'use strict';

const crypto = require('crypto');

/**
 * Provider Adapter for WinBD Gaming Platform.
 * Talks to the real "loginxgamesapi" / gitamus aggregator — one integration
 * per vendor, sharing the same agentID but a different apiendpoint + apitoken
 * + secretkey each.
 *
 * NO mock/demo data anywhere — if a vendor isn't configured or a call fails,
 * that vendor's games are simply skipped instead of showing fake games.
 */

const VENDORS = {
  pragmatic: {
    vendorCode: 'Pragmatic',
    agentId: process.env.WINBD_PRAGMATIC_AGENT_ID || 'stagingWinBDBDT',
    apiToken: process.env.WINBD_PRAGMATIC_API_TOKEN || '9326505b55ee47a6b958673ee8b1ed34',
    secretKey: process.env.WINBD_PRAGMATIC_SECRET_KEY || '39078552a79849c887a4f5c00324d025',
    baseUrl: process.env.WINBD_PRAGMATIC_ENDPOINT || 'https://ptapi.loginxgamesapi.com',
  },
  pgsoft: {
    vendorCode: 'PGSoft',
    agentId: process.env.WINBD_PGSOFT_AGENT_ID || 'stagingWinBDBDT',
    apiToken: process.env.WINBD_PGSOFT_API_TOKEN || '901a1505b53f4797916f603c8f99543c',
    secretKey: process.env.WINBD_PGSOFT_SECRET_KEY || '96c81b879a6c4d5496db43db04541eff',
    baseUrl: process.env.WINBD_PGSOFT_ENDPOINT || 'https://ggapi.loginxgamesapi.com',
  },
  amatic: {
    vendorCode: 'Amatic',
    agentId: process.env.WINBD_AMATIC_AGENT_ID || 'stagingWinBDBDT',
    apiToken: process.env.WINBD_AMATIC_API_TOKEN || '7ff46497a6de491bbb88955a50fc661c',
    secretKey: process.env.WINBD_AMATIC_SECRET_KEY || '0e7e109dda2a4cf3934206f33cf46a84',
    baseUrl: process.env.WINBD_AMATIC_ENDPOINT || 'https://amapi.loginxgamesapi.com',
  },
  amusnet: {
    vendorCode: 'Amusnet',
    agentId: process.env.WINBD_AMUSNET_AGENT_ID || 'stagingWinBDBDT',
    apiToken: process.env.WINBD_AMUSNET_API_TOKEN || 'dd2db47a4eb146db9d983f50f04ae8bb',
    secretKey: process.env.WINBD_AMUSNET_SECRET_KEY || '840ce08cd21a4358bf7f573d7b672818',
    baseUrl: process.env.WINBD_AMUSNET_ENDPOINT || 'https://apiang.gitamus.net',
  },
};

const CALLBACK_URL = process.env.PROVIDER_CALLBACK_URL || 'https://win-pro-com-lgmh.onrender.com/api/callback';

// NOTE: no hardcoded fallback key here anymore — if a vendor's secretKey is
// somehow empty, signing with '' will just produce a sign the provider
// rejects (which is correct/safe behavior, not silently using another
// vendor's key).
function sign(secretKey, message) {
  return crypto.createHmac('sha256', secretKey || '').update(message).digest('hex').toUpperCase();
}

class ProviderAdapter {
  constructor() {
    this.vendors = VENDORS;
    this.callbackUrl = CALLBACK_URL;

    for (const [key, v] of Object.entries(this.vendors)) {
      const configured = Boolean(v.agentId && v.apiToken && v.baseUrl);
      if (!configured) {
        console.warn(`[providerAdapter] ${key} NOT configured — missing agentId/apiToken/baseUrl`);
      }
      if (!v.secretKey) {
        console.warn(`[providerAdapter] ${key} has no secretKey yet — signed requests will be rejected until it's set`);
      }
    }
  }

  status() {
    const out = {};
    for (const [key, v] of Object.entries(this.vendors)) {
      out[key] = {
        baseUrl: v.baseUrl,
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
   *
   * NOTE: path "/gamelist" and field names below are based on the general
   * GitSlotPark-style seamless wallet spec (agentID + sign). Confirm the
   * exact path/params against your Postman collection per vendor and adjust
   * if a vendor 400s.
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
   *
   * NOTE: path "/userAuth" and field names are placeholders pending your
   * Postman collection's exact "Game Launch" request — adjust per vendor if needed.
   */
  async launchGame({ gameId, vendorCode, userId, returnUrl, trial } = {}) {
    if (!gameId) throw new Error('gameId is required');
    const v = this.resolveVendor(vendorCode);
    if (!v) throw new Error(`Unknown or unconfigured vendor: ${vendorCode}`);

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

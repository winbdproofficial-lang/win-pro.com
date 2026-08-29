'use strict';

/**
 * Provider Adapter for WinBD Gaming Platform
 * Talks to the real game provider API.
 * NO mock/demo data anywhere — if the provider isn't configured or a call
 * fails, this returns an empty/error result and providerRoutes.js will show
 * "coming soon" on the frontend instead of fake games.
 */
class ProviderAdapter {
  constructor() {
    this.agentId = process.env.WINBD_PROVIDER_AGENT_ID || '';
    this.apiToken = process.env.WINBD_PROVIDER_ACCESS_TOKEN || '';
    this.baseUrl = (process.env.WINBD_PROVIDER_BASE_URL || '').replace(/\/+$/, '');
    this.secretKey = process.env.WINBD_PROVIDER_SECRET_KEY || '';
    this.callbackUrl = process.env.PROVIDER_CALLBACK_URL || '';

    this.isConfigured = Boolean(this.agentId && this.apiToken && this.baseUrl);

    if (!this.isConfigured) {
      console.warn('[providerAdapter] NOT configured — missing env vars:', {
        WINBD_PROVIDER_AGENT_ID: Boolean(this.agentId),
        WINBD_PROVIDER_ACCESS_TOKEN: Boolean(this.apiToken),
        WINBD_PROVIDER_BASE_URL: Boolean(this.baseUrl),
      });
    } else {
      console.log('[providerAdapter] Configured with baseUrl:', this.baseUrl);
    }
  }

  /**
   * Used by GET /status (debug endpoint)
   */
  status() {
    return {
      name: 'winbd',
      enabled: true,
      baseUrl: this.baseUrl || null,
      configured: this.isConfigured,
      hasAgentId: Boolean(this.agentId),
      hasApiToken: Boolean(this.apiToken),
      hasSecretKey: Boolean(this.secretKey),
    };
  }

  /**
   * Used by GET /getWebsiteCategory (real game catalogue).
   * Returns { games: [...] } on success.
   * Returns { error: true, games: [] } on any failure — never fake games.
   *
   * NOTE: endpoint path below (/api/games) is a PLACEHOLDER. Once the real
   * provider API docs / agent panel are available, update:
   *   - the path (may not be /api/games)
   *   - the auth header format (Bearer token vs custom header vs signed request)
   *   - the response field names used below (raw.games vs raw.data vs raw.list)
   */
  async listGames() {
    if (!this.isConfigured) {
      return { error: true, reason: 'not_configured', games: [] };
    }

    try {
      const url = `${this.baseUrl}/api/games`; // TODO: confirm real path with provider docs
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'X-Agent-ID': this.agentId,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error('[providerAdapter] listGames failed:', response.status, response.statusText, body);
        return { error: true, reason: `http_${response.status}`, games: [] };
      }

      const data = await response.json();
      const games = data.games || data.data || data.list || [];
      return { games };
    } catch (err) {
      console.error('[providerAdapter] listGames error:', err.message);
      return { error: true, reason: err.message, games: [] };
    }
  }

  /**
   * Used by POST /getGameUrl and /getTrailGameUrl.
   * Accepts a single options object (matches how providerRoutes.js calls it).
   * Returns { url: '...' } on success. Throws on failure (routes.js catches it).
   *
   * NOTE: endpoint path (/api/launch) and payload field names are PLACEHOLDERS
   * until the real provider API docs are confirmed.
   */
  async launchGame({ gameId, vendorCode, gameTypeId, extraData, userId, returnUrl, trial } = {}) {
    if (!this.isConfigured) {
      throw new Error('Provider not configured. Missing required environment variables.');
    }
    if (!gameId) {
      throw new Error('gameId is required');
    }

    try {
      const url = `${this.baseUrl}/api/launch`; // TODO: confirm real path with provider docs
      const payload = {
        agentId: this.agentId,
        gameCode: gameId,
        vendorCode,
        gameTypeId,
        extraData,
        userId: trial ? 'guest' : String(userId || 'guest'),
        trial: Boolean(trial),
        returnUrl: returnUrl || this.callbackUrl,
        timestamp: Date.now(),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'X-Agent-ID': this.agentId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error('[providerAdapter] launchGame failed:', response.status, response.statusText, body);
        throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const gameUrl = data.url || data.gameUrl || data.launchUrl;
      if (!gameUrl) {
        throw new Error('Provider response did not include a game URL');
      }
      return { url: gameUrl };
    } catch (err) {
      console.error('[providerAdapter] launchGame error:', err.message, { gameId, userId });
      throw err;
    }
  }

  /**
   * Verify provider webhook/callback signature (used later once real
   * callbacks arrive). Safe no-op until PROVIDER_SECRET_KEY is real-checked.
   */
  verifyCallback(payload, signature) {
    if (!this.secretKey) {
      console.warn('[providerAdapter] No secret key configured, skipping signature verification');
      return true;
    }
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', this.secretKey).update(JSON.stringify(payload)).digest('hex');
    return expected === signature;
  }
}

module.exports = ProviderAdapter;

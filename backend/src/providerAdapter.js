'use strict';
const https = require('https');
const http = require('http');

class ProviderAdapter {
  constructor(config = {}) {
    this.name = config.name || 'PGSoft';
    this.baseUrl = config.baseUrl || process.env.WINBD_PROVIDER_BASE_URL || process.env.PROVIDER_API_ENDPOINT || 'https://ggapi.loginxgamesapi.com';
    this.agentId = config.agentId || process.env.WINBD_PROVIDER_AGENT_ID || process.env.PROVIDER_AGENT_ID;
    this.apiToken = config.apiToken || process.env.WINBD_PROVIDER_ACCESS_TOKEN || process.env.PROVIDER_API_TOKEN;
    this.secretKey = config.secretKey || process.env.WINBD_PROVIDER_SECRET_KEY || process.env.PROVIDER_SECRET_KEY;
    this.enabled = Boolean(config.enabled ?? true);
  }

  status() {
    return {
      name: this.name,
      enabled: this.enabled,
      baseUrl: this.baseUrl,
      configured: Boolean(this.baseUrl && this.agentId && this.apiToken),
      // never expose the actual secret values, just whether they're set
      hasAgentId: Boolean(this.agentId),
      hasApiToken: Boolean(this.apiToken),
      hasSecretKey: Boolean(this.secretKey)
    };
  }

  _makeRequest(url, data) {
    return new Promise((resolve, reject) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        return reject(new Error(`Invalid provider URL: ${url}`));
      }
      const postData = JSON.stringify(data);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 15000
      };
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Provider responded with HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ rawBody: body });
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Provider request timed out'));
      });
      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  async listGames() {
    if (!this.baseUrl || !this.agentId || !this.apiToken) {
      return {
        provider: this.name,
        games: [],
        error: 'Provider not configured: missing baseUrl, agentId, or apiToken env vars'
      };
    }
    try {
      const data = await this._makeRequest(`${this.baseUrl}/api/games`, {
        agentId: this.agentId,
        apiToken: this.apiToken
      });
      if (data.error || data.errorMessage) {
        return { provider: this.name, games: [], error: data.error || data.errorMessage };
      }
      return { provider: this.name, games: data.games || data.data || [] };
    } catch (error) {
      console.error('[providerAdapter] listGames failed:', error.message);
      return { provider: this.name, games: [], error: error.message };
    }
  }

  async launchGame({ gameId, vendorCode, gameTypeId, extraData, userId, trial, returnUrl }) {
    if (!gameId) throw new Error('gameId is required');
    if (!this.baseUrl || !this.agentId || !this.apiToken) {
      throw new Error('Provider not configured: missing baseUrl, agentId, or apiToken env vars');
    }
    try {
      const data = await this._makeRequest(`${this.baseUrl}/api/launch`, {
        agentId: this.agentId,
        apiToken: this.apiToken,
        secretKey: this.secretKey,
        gameId,
        vendorCode,
        gameTypeId,
        extraData,
        trial: Boolean(trial),
        userId: userId || 'guest',
        returnUrl: returnUrl || 'https://win-pro-com-lgmh.onrender.com'
      });
      const gameUrl = data && (data.url || data.gameUrl);
      if (gameUrl) {
        return { success: true, url: gameUrl, gameUrl, data: { url: gameUrl } };
      }
      throw new Error((data && (data.message || data.error)) || 'Provider did not return a game URL');
    } catch (error) {
      throw new Error(`Provider Launch Error: ${error.message}`);
    }
  }
}

module.exports = ProviderAdapter;

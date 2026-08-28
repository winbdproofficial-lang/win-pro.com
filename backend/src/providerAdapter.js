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
    return { name: this.name, enabled: this.enabled, configured: Boolean(this.baseUrl && this.agentId && this.apiToken) };
  }

  _makeRequest(url, data) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
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
        }
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ rawBody: body });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  async listGames() {
    try {
      const data = await this._makeRequest(`${this.baseUrl}/api/games`, {
        agentId: this.agentId,
        apiToken: this.apiToken
      });
      return { provider: this.name, games: data.games || [] };
    } catch (error) {
      return { provider: this.name, games: [], error: error.message };
    }
  }

  async launchGame({ gameId, userId, returnUrl }) {
    if (!gameId) throw new Error('gameId is required');

    try {
      const data = await this._makeRequest(`${this.baseUrl}/api/launch`, {
        agentId: this.agentId,
        apiToken: this.apiToken,
        secretKey: this.secretKey,
        gameId,
        userId: userId || 'guest',
        returnUrl: returnUrl || 'https://win-pro-com-lgmh.onrender.com'
      });

      if (data && (data.url || data.gameUrl)) {
        const gameUrl = data.url || data.gameUrl;
        return { success: true, url: gameUrl, gameUrl, data: { url: gameUrl } };
      }

      throw new Error(data.message || 'Failed to get game URL');
    } catch (error) {
      throw new Error(`Provider Launch Error: ${error.message}`);
    }
  }
}

module.exports = ProviderAdapter;

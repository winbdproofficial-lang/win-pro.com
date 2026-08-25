'use strict';

const axios = require('axios');

class ProviderAdapter {
  constructor(config = {}) {
    this.name = config.name || 'PGSoft';
    this.baseUrl = config.baseUrl || process.env.PROVIDER_API_ENDPOINT || 'https://ggapi.loginxgamesapi.com';
    this.agentId = config.agentId || process.env.PROVIDER_AGENT_ID;
    this.apiToken = config.apiToken || process.env.PROVIDER_API_TOKEN;
    this.secretKey = config.secretKey || process.env.PROVIDER_SECRET_KEY;
    this.enabled = Boolean(config.enabled ?? true);
  }

  status() {
    return { name: this.name, enabled: this.enabled, configured: Boolean(this.baseUrl && this.apiToken) };
  }

  async listGames() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/games`, {
        agentId: this.agentId,
        apiToken: this.apiToken
      });
      return { provider: this.name, games: response.data.games || [] };
    } catch (error) {
      return { provider: this.name, games: [], error: error.message };
    }
  }

  async launchGame({ gameId, userId, returnUrl }) {
    if (!gameId) throw new Error('gameId is required');

    try {
      const response = await axios.post(`${this.baseUrl}/api/launch`, {
        agentId: this.agentId,
        apiToken: this.apiToken,
        secretKey: this.secretKey,
        gameId: gameId,
        userId: userId || 'guest',
        returnUrl: returnUrl || 'https://win-pro-com-lgmh.onrender.com'
      });

      if (response.data && (response.data.url || response.data.gameUrl)) {
        const gameUrl = response.data.url || response.data.gameUrl;
        return { success: true, url: gameUrl, gameUrl: gameUrl, data: { url: gameUrl } };
      }

      throw new Error(response.data.message || 'Failed to get game URL');
    } catch (error) {
      throw new Error(`Provider Launch Error: ${error.message}`);
    }
  }
}

module.exports = ProviderAdapter;

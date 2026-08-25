'use strict';

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
      const response = await fetch(`${this.baseUrl}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.agentId,
          apiToken: this.apiToken
        })
      });
      const data = await response.json();
      return { provider: this.name, games: data.games || [] };
    } catch (error) {
      return { provider: this.name, games: [], error: error.message };
    }
  }

  async launchGame({ gameId, userId, returnUrl }) {
    if (!gameId) throw new Error('gameId is required');

    try {
      const response = await fetch(`${this.baseUrl}/api/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.agentId,
          apiToken: this.apiToken,
          secretKey: this.secretKey,
          gameId: gameId,
          userId: userId || 'guest',
          returnUrl: returnUrl || 'https://win-pro-com-lgmh.onrender.com'
        })
      });

      const data = await response.json();

      if (data && (data.url || data.gameUrl)) {
        const gameUrl = data.url || data.gameUrl;
        return { success: true, url: gameUrl, gameUrl: gameUrl, data: { url: gameUrl } };
      }

      throw new Error(data.message || 'Failed to get game URL');
    } catch (error) {
      throw new Error(`Provider Launch Error: ${error.message}`);
    }
  }
}

module.exports = ProviderAdapter;

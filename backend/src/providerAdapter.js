/**
 * Provider Adapter for WinBD Gaming Platform
 * Handles communication with the gaming provider API
 */

class ProviderAdapter {
  constructor() {
    // Load configuration from environment variables
    this.agentId = process.env.WINBD_PROVIDER_AGENT_ID;
    this.apiToken = process.env.WINBD_PROVIDER_ACCESS_TOKEN;
    this.baseUrl = process.env.WINBD_PROVIDER_BASE_URL;
    this.secretKey = process.env.WINBD_PROVIDER_SECRET_KEY;
    this.callbackUrl = process.env.PROVIDER_CALLBACK_URL;

    // Validate configuration
    this.isConfigured = !!(this.agentId && this.apiToken && this.baseUrl);

    if (!this.isConfigured) {
      console.warn(
        '[providerAdapter] WARNING: Provider not fully configured. Missing env vars:',
        {
          WINBD_PROVIDER_AGENT_ID: !!this.agentId,
          WINBD_PROVIDER_ACCESS_TOKEN: !!this.apiToken,
          WINBD_PROVIDER_BASE_URL: !!this.baseUrl,
        }
      );
    } else {
      console.log('[providerAdapter] Provider initialized with:', {
        agentId: this.agentId,
        baseUrl: this.baseUrl,
        callbackUrl: this.callbackUrl,
      });
    }
  }

  /**
   * Get status of provider configuration
   */
  getStatus() {
    return {
      name: 'winbd',
      enabled: true,
      configured: this.isConfigured,
      hasAgentId: !!this.agentId,
      hasApiToken: !!this.apiToken,
      hasSecretKey: !!this.secretKey,
      baseUrl: this.baseUrl ? 'configured' : 'missing',
    };
  }

  /**
   * Fetch available games from provider
   */
  async getGames() {
    if (!this.isConfigured) {
      throw new Error('Provider not configured. Missing required environment variables.');
    }

    try {
      const url = `${this.baseUrl}/api/games`;
      console.log('[providerAdapter] Fetching games from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'X-Agent-ID': this.agentId,
        },
        timeout: 10000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[providerAdapter] Games fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Provider API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[providerAdapter] Successfully fetched', data.games?.length || 0, 'games');
      return data;
    } catch (error) {
      console.error('[providerAdapter] Error fetching games:', error.message);
      throw error;
    }
  }

  /**
   * Launch a specific game for a user
   */
  async launchGame(gameId, userId, userName) {
    if (!this.isConfigured) {
      throw new Error('Provider not configured. Missing required environment variables.');
    }

    if (!gameId || !userId) {
      throw new Error('gameId and userId are required');
    }

    try {
      const url = `${this.baseUrl}/api/launch`;
      const payload = {
        gameId,
        agentId: this.agentId,
        userId: userId.toString(),
        userName: userName || `user_${userId}`,
        returnUrl: this.callbackUrl,
        timestamp: Date.now(),
      };

      console.log('[providerAdapter] Launching game:', { gameId, userId, url });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'X-Agent-ID': this.agentId,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[providerAdapter] Game launch failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          gameId,
          userId,
        });
        throw new Error(`Provider API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[providerAdapter] Game launched successfully:', { gameId, launchUrl: !!data.launchUrl });
      return data;
    } catch (error) {
      console.error('[providerAdapter] Error launching game:', {
        error: error.message,
        gameId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Verify provider webhook/callback signature
   */
  verifyCallback(payload, signature) {
    if (!this.secretKey) {
      console.warn('[providerAdapter] Secret key not configured, skipping signature verification');
      return true;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    return expectedSignature === signature;
  }
}

module.exports = new ProviderAdapter();

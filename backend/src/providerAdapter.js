'use strict';

/**
 * Provider-neutral game catalogue/launch contract.
 * Keep provider credentials and signed requests server-side.
 * This adapter intentionally does not implement wagering, settlement, or
 * real-money game play; a licensed provider's official SDK/API can implement
 * these methods later without changing the frontend contract.
 */
class ProviderAdapter {
  constructor(config = {}) {
    this.name = config.name || 'provider-placeholder';
    this.baseUrl = config.baseUrl || '';
    this.enabled = Boolean(config.enabled);
  }

  status() {
    return { name: this.name, enabled: this.enabled, configured: Boolean(this.baseUrl) };
  }

  async listGames() {
    return { provider: this.name, games: [] };
  }

  async launchGame({ gameId, userId, returnUrl }) {
    if (!gameId) throw new Error('gameId is required');
    return {
      provider: this.name,
      gameId,
      userId,
      returnUrl: returnUrl || null,
      status: 'not_configured',
      message: 'Configure the licensed provider official API before launch.'
    };
  }

  async gameHistory() {
    return { provider: this.name, items: [] };
  }
}

module.exports = { ProviderAdapter };

'use strict';

const express = require('express');
const ProviderAdapter = require('./providerAdapter');

function setupProviderRoutes(app, { authRequired } = {}) {
  const router = express.Router();
  const adapter = new ProviderAdapter();

  // 1. Get Game Catalogue
  router.get('/games', async (req, res) => {
    try {
      const result = await adapter.listGames();
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Launch Game
  const launchMiddleware = authRequired || ((req, res, next) => next());

  router.post('/launch', launchMiddleware, async (req, res) => {
    try {
      const { gameId, returnUrl } = req.body;
      const userId = req.user ? req.user.id : req.body.userId;

      const launchResult = await adapter.launchGame({ gameId, userId, returnUrl });

      return res.json({
        success: true,
        status: '000000',
        url: launchResult.url,
        gameUrl: launchResult.gameUrl,
        data: launchResult
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Callbacks
  router.post('/callback', async (req, res) => {
    return res.json({ status: '000000', message: 'Success' });
  });

  if (app && typeof app.use === 'function') {
    app.use('/api/provider', router);
    app.use('/api/callback', router);
  }

  return router;
}

// Export both default and direct function reference to prevent any import errors
module.exports = setupProviderRoutes;
module.exports.setupProviderRoutes = setupProviderRoutes;
module.exports.default = setupProviderRoutes;

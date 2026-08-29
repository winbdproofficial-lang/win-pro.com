'use strict';
const express = require('express');
const ProviderAdapter = require('./providerAdapter');

function setupProviderRoutes(app, options = {}) {
  const router = express.Router();
  const adapter = new ProviderAdapter();
  const authRequired = typeof options === 'function' ? options : options.authRequired;
  const launchMiddleware = typeof authRequired === 'function' ? authRequired : ((req, res, next) => next());

  // ---- helper: normalize a raw provider game object into the shape the
  // frontend's flat() function expects: { displayName, content:{...}, customizeData:{...} }
  function normalizeGame(raw, categoryHint) {
    const gameCode = raw.gameCode || raw.game_code || raw.code || raw.id;
    const vendorCode = raw.vendorCode || raw.vendor_code || raw.provider || raw.vendor || 'PGSoft';
    if (!gameCode) return null;
    return {
      displayName: raw.name || raw.gameName || raw.game_name || raw.displayName || gameCode,
      content: {
        gameCode,
        vendorCode,
        vendorId: raw.vendorId || raw.vendor_id || null,
        gameTypeId: raw.gameTypeId || raw.game_type_id || raw.type || categoryHint || 'Slots',
        extraData: raw.extraData || raw.extra_data || null,
        hasTrialPlay: Boolean(raw.hasTrialPlay ?? raw.has_trial_play ?? raw.demo ?? false)
      },
      customizeData: {
        lightIcon: raw.image || raw.icon || raw.thumbnail || raw.imageUrl || raw.image_url || ''
      }
    };
  }

  function normalizeCatalogue(result) {
    const rawGames = Array.isArray(result?.games) ? result.games : Array.isArray(result) ? result : [];
    return rawGames.map((g) => normalizeGame(g, result?.category)).filter(Boolean);
  }

  // 1. Game catalogue -- this is the path the frontend (provider-lobby.js) actually calls
  router.get('/getWebsiteCategory', async (req, res) => {
    try {
      const result = await adapter.listGames();
      const data = normalizeCatalogue(result);
      return res.json({
        success: true,
        providerAvailable: !result.error && data.length > 0,
        data
      });
    } catch (err) {
      console.error('[provider] getWebsiteCategory failed:', err);
      return res.json({ success: true, providerAvailable: false, data: [] });
    }
  });

  // 2. Launch a real game
  router.post('/getGameUrl', launchMiddleware, async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      const userId = req.user ? req.user.id : req.body.userId;
      const launchResult = await adapter.launchGame({
        gameId: gameCode,
        vendorCode,
        gameTypeId,
        extraData,
        userId,
        returnUrl: req.body.returnUrl
      });
      return res.json({ success: true, status: '000000', data: { gameUrl: launchResult.url } });
    } catch (err) {
      console.error('[provider] getGameUrl failed:', err);
      return res.status(502).json({ success: false, message: err.message || 'Game service is temporarily unavailable' });
    }
  });

  // 3. Launch a trial/demo game
  router.post('/getTrailGameUrl', async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      const launchResult = await adapter.launchGame({
        gameId: gameCode,
        vendorCode,
        gameTypeId,
        extraData,
        userId: 'guest',
        trial: true,
        returnUrl: req.body.returnUrl
      });
      return res.json({ success: true, status: '000000', data: { gameUrl: launchResult.url } });
    } catch (err) {
      console.error('[provider] getTrailGameUrl failed:', err);
      return res.status(502).json({ success: false, message: err.message || 'Trial launch failed' });
    }
  });

  // 4. Provider callback / webhook
  router.post('/callback', async (req, res) => {
    return res.json({ status: '000000', message: 'Success' });
  });

  // Debug helper -- hit this yourself in the browser to see exactly what the
  // provider returned and whether env vars are actually configured.
  router.get('/status', (req, res) => {
    res.json({ success: true, data: adapter.status() });
  });

  if (app && typeof app.use === 'function') {
    // New: the paths the frontend actually calls
    app.use('/api/bt/v1/provider', router);
    // Keep old mounts too, in case anything else depends on them
    app.use('/api/provider', router);
    app.use('/api/callback', router);
  }
  return router;
}

module.exports = setupProviderRoutes;
module.exports.setupProviderRoutes = setupProviderRoutes;
module.exports.default = setupProviderRoutes;

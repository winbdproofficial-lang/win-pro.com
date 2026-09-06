'use strict';
const express = require('express');
const ProviderAdapter = require('./providerAdapter');

function setupProviderRoutes(app, options = {}) {
  const router = express.Router();
  const adapter = new ProviderAdapter();
  const authRequired = typeof options === 'function' ? options : options.authRequired;
  const launchMiddleware = typeof authRequired === 'function' ? authRequired : ((req, res, next) => next());

  function normalizeGame(raw, categoryHint) {
    const gameCode = raw.gameCode ?? raw.game_code ?? raw.gameId ?? raw.gameid ?? raw.code ?? raw.id;
    const vendorCode = raw.vendorCode || raw.vendor_code || raw.vendorId || raw.vendor_id || raw.provider || raw.vendor || 'PGSoft';
    if (gameCode === undefined || gameCode === null || gameCode === '') return null;
    return {
      displayName: raw.name || raw.gameName || raw.game_name || raw.displayName || String(gameCode),
      content: {
        gameCode,
        vendorCode,
        vendorId: raw.vendorId || raw.vendor_id || raw.vendorid || null,
        gameTypeId: raw.gameTypeId || raw.game_type_id || raw.type || categoryHint || 'Slots',
        extraData: raw.extraData || raw.extra_data || null,
        hasTrialPlay: Boolean(raw.hasTrialPlay ?? raw.has_trial_play ?? raw.demo ?? false)
      },
      customizeData: {
        lightIcon: raw.image || raw.icon || raw.thumbnail || raw.imageUrl || raw.image_url || raw.iconurl || raw.iconurl1 || raw.iconurl2 || ''
      }
    };
  }

  function normalizeCatalogue(result) {
    const rawGames = Array.isArray(result?.games) ? result.games : Array.isArray(result) ? result : [];
    return rawGames.map((g) => normalizeGame(g, result?.category)).filter(Boolean);
  }

  router.get('/getWebsiteCategory', async (req, res) => {
    try {
      const result = await adapter.listGames();
      const data = normalizeCatalogue(result);
      return res.json({ success: true, providerAvailable: data.length > 0, data });
    } catch (err) {
      console.error('[provider] getWebsiteCategory failed:', err);
      return res.json({ success: true, providerAvailable: false, data: [] });
    }
  });

  router.post('/getGameUrl', launchMiddleware, async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      // GitSlotPark requires an alphanumeric userID (4–48 chars). JWT already
      // contains the stable username, so prefer it over the internal UUID.
      const userId = req.user?.username || req.user?.sub || req.body.userId;
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

  router.post('/getTrailGameUrl', async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      const launchResult = await adapter.launchGame({
        gameId: gameCode,
        vendorCode,
        gameTypeId,
        extraData,
        userId: req.user?.username || req.body.userId || 'guest',
        trial: true,
        returnUrl: req.body.returnUrl
      });
      return res.json({ success: true, status: '000000', data: { gameUrl: launchResult.url } });
    } catch (err) {
      console.error('[provider] getTrailGameUrl failed:', err);
      return res.status(502).json({ success: false, message: err.message || 'Trial launch failed' });
    }
  });

  router.post('/callback', async (req, res) => {
    return res.json({ status: '000000', message: 'Success' });
  });

  router.get('/status', (req, res) => {
    res.json({ success: true, data: adapter.status() });
  });

  if (app && typeof app.use === 'function') {
    app.use('/api/bt/v1/provider', router);
    app.use('/api/provider', router);
    app.use('/api/callback', router);
  }
  return router;
}

module.exports = setupProviderRoutes;
module.exports.setupProviderRoutes = setupProviderRoutes;
module.exports.default = setupProviderRoutes;

'use strict';

/**
 * WINBD provider gateway.
 * Provider credentials stay server-side and are optional at boot so the site
 * can remain live while provider credentials are being reissued.
 */
function providerRoutes(app, { authRequired }) {
  const baseUrl = (process.env.WINBD_PROVIDER_BASE_URL || 'https://betjili365.vip').replace(/\/+$/, '');
  const hasProviderToken = () => Boolean(String(process.env.WINBD_PROVIDER_ACCESS_TOKEN || '').trim());

  async function callProvider(path, { method = 'GET', body, requireProviderToken = false } = {}) {
    const headers = { Accept: 'application/json' };
    const token = process.env.WINBD_PROVIDER_ACCESS_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (requireProviderToken && !token) {
      const err = new Error('Provider launch is temporarily unavailable');
      err.statusCode = 503;
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!response.ok) {
      const err = new Error(data?.message || `Provider HTTP ${response.status}`);
      err.statusCode = response.status;
      err.provider = data;
      throw err;
    }
    return data;
  }

  const forward = (handler, fallback) => async (req, res) => {
    try {
      // Catalogue calls are intentionally soft-fail: the main site must not
      // go down merely because provider credentials are temporarily missing.
      if (!hasProviderToken()) return res.json(fallback());
      return res.json(await handler(req));
    } catch (err) {
      console.error('Provider catalogue error:', err);
      return res.json(fallback(err));
    }
  };

  const emptyCatalogue = (error) => ({
    success: true,
    data: [],
    providerConfigured: false,
    providerAvailable: false,
    message: error ? 'Game service is temporarily unavailable' : 'Game service is being configured'
  });

  app.get('/api/bt/v1/provider/getVendors', forward(req => {
    const qs = req.query?.gameTypes ? `?gameTypes=${encodeURIComponent(req.query.gameTypes)}` : '';
    return callProvider(`/api/bt/v1/provider/getVendors${qs}`);
  }, emptyCatalogue));

  app.get('/api/bt/v1/provider/getWebsiteCategory', forward(() =>
    callProvider('/api/bt/v1/provider/getWebsiteCategory')
  , emptyCatalogue));

  app.get('/api/bt/v1/provider/getJackpotInfo', forward(() =>
    callProvider('/api/bt/v1/provider/getJackpotInfo')
  , () => ({ success: true, data: { jackpot: 0 }, providerConfigured: false })));

  app.post('/api/bt/v1/provider/getGameListByCategory', forward(req =>
    callProvider('/api/bt/v1/provider/getGameListByCategory', { method: 'POST', body: req.body || {} })
  , emptyCatalogue));

  app.post('/api/bt/v1/provider/getGameListByKeyWord', forward(req =>
    callProvider('/api/bt/v1/provider/getGameListByKeyWord', { method: 'POST', body: req.body || {} })
  , emptyCatalogue));

  app.post('/api/bt/v1/provider/getRecommendGameList', forward(req =>
    callProvider('/api/bt/v1/provider/getRecommendGameList', { method: 'POST', body: req.body || {} })
  , emptyCatalogue));

  // Launch endpoints remain protected. Missing provider credentials are
  // returned as a normal JSON state rather than an unhandled server error.
  const launch = (path, requireToken = true) => async (req, res) => {
    try {
      if (authRequired) {
        return authRequired(req, res, async () => {
          const body = req.body || {};
          if (body.gameTypeId === undefined || !body.vendorCode || !body.gameCode) {
            return res.status(400).json({ success: false, message: 'gameTypeId, vendorCode and gameCode are required' });
          }
          if (requireToken && !hasProviderToken()) {
            return res.json({
              success: true,
              data: null,
              providerConfigured: false,
              launchReady: false,
              status: 'not_configured',
              message: 'Game service is temporarily unavailable. Please try again later.'
            });
          }
          const result = await callProvider(path, { method: 'POST', body: {
            gameTypeId: body.gameTypeId,
            vendorCode: body.vendorCode,
            gameCode: body.gameCode,
            extraData: body.extraData ?? null,
            gameImagePath: body.gameImagePath,
            loaderImgStyle: body.loaderImgStyle,
            vendorName: body.vendorName,
            hasTrialPlay: body.hasTrialPlay,
            isDesktop: body.isDesktop !== false
          }, requireProviderToken: requireToken });
          return res.json(result);
        });
      }
      return res.status(503).json({ success: false, message: 'Local authentication is not configured' });
    } catch (err) {
      console.error('Provider launch error:', err);
      return res.status(Number(err.statusCode || 502)).json({ success: false, message: err.message || 'Provider launch failed', provider: err.provider || undefined });
    }
  };

  app.post('/api/bt/v1/provider/getGameUrl', launch('/api/bt/v1/provider/getGameUrl', true));
  app.post('/api/bt/v1/provider/getTrailGameUrl', launch('/api/bt/v1/provider/getTrailGameUrl', true));

  app.get('/api/bt/v1/provider/status', (req, res) => res.json({
    success: true,
    data: {
      baseUrl,
      providerTokenConfigured: hasProviderToken(),
      launchReady: hasProviderToken()
    }
  }));
}

module.exports = { providerRoutes };

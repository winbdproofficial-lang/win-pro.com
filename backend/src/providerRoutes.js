'use strict';

/**
 * WINBD provider gateway.
 * The provider credential is kept server-side in WINBD_PROVIDER_ACCESS_TOKEN.
 * Never expose that credential to the browser.
 */
function providerRoutes(app, { authRequired }) {
  const baseUrl = (process.env.WINBD_PROVIDER_BASE_URL || 'https://betjili365.vip').replace(/\/+$/, '');

  async function callProvider(path, { method = 'GET', body, requireProviderToken = false } = {}) {
    const headers = { Accept: 'application/json' };
    const token = process.env.WINBD_PROVIDER_ACCESS_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (requireProviderToken && !token) {
      const err = new Error('WINBD_PROVIDER_ACCESS_TOKEN is not configured on the server');
      err.statusCode = 503;
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

  const forward = (handler) => async (req, res) => {
    try { res.json(await handler(req)); }
    catch (err) {
      console.error('Provider API error:', err);
      res.status(Number(err.statusCode || 502)).json({
        success: false,
        message: err.message || 'Provider API request failed',
        provider: err.provider || undefined
      });
    }
  };

  // Public catalogue endpoints.
  app.get('/api/bt/v1/provider/getVendors', forward(req => {
    const qs = req.query?.gameTypes ? `?gameTypes=${encodeURIComponent(req.query.gameTypes)}` : '';
    return callProvider(`/api/bt/v1/provider/getVendors${qs}`);
  }));

  app.get('/api/bt/v1/provider/getWebsiteCategory', forward(() =>
    callProvider('/api/bt/v1/provider/getWebsiteCategory')
  ));

  app.get('/api/bt/v1/provider/getJackpotInfo', forward(() =>
    callProvider('/api/bt/v1/provider/getJackpotInfo')
  ));

  app.post('/api/bt/v1/provider/getGameListByCategory', forward(req =>
    callProvider('/api/bt/v1/provider/getGameListByCategory', { method: 'POST', body: req.body || {} })
  ));

  app.post('/api/bt/v1/provider/getGameListByKeyWord', forward(req =>
    callProvider('/api/bt/v1/provider/getGameListByKeyWord', { method: 'POST', body: req.body || {} })
  ));

  app.post('/api/bt/v1/provider/getRecommendGameList', forward(req =>
    callProvider('/api/bt/v1/provider/getRecommendGameList', { method: 'POST', body: req.body || {} })
  ));

  // Launch endpoints require the local WINBD account and the provider credential.
  const launch = (path, requireToken = true) => async (req, res) => {
    try {
      if (authRequired) {
        // Reuse the existing WINBD auth middleware before contacting the provider.
        return authRequired(req, res, async () => {
          const body = req.body || {};
          if (body.gameTypeId === undefined || !body.vendorCode || !body.gameCode) {
            return res.status(400).json({ success: false, message: 'gameTypeId, vendorCode and gameCode are required' });
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
  app.post('/api/bt/v1/provider/getTrailGameUrl', launch('/api/bt/v1/provider/getTrailGameUrl', false));

  app.get('/api/bt/v1/provider/status', (req, res) => res.json({
    success: true,
    data: {
      baseUrl,
      providerTokenConfigured: Boolean(process.env.WINBD_PROVIDER_ACCESS_TOKEN),
      launchReady: Boolean(process.env.WINBD_PROVIDER_ACCESS_TOKEN)
    }
  }));
}

module.exports = { providerRoutes };

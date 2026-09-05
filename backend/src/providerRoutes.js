'use strict';
const express = require('express');
const ProviderAdapter = require('./providerAdapter');

function setupProviderRoutes(app, options = {}) {
  const router = express.Router();
  const adapter = new ProviderAdapter();
  const authRequired = typeof options === 'function' ? options : options.authRequired;
  const launchMiddleware = typeof authRequired === 'function' ? authRequired : ((req, res, next) => next());
  const db = options.pool || options.db || null;

  function normalizeGame(raw, categoryHint) {
    const gameCode = raw.gameCode ?? raw.game_code ?? raw.gameId ?? raw.gameid ?? raw.code ?? raw.id;
    let vendorCode = raw.vendorCode || raw.vendor_code || raw.vendorId || raw.vendor_id || raw.vendorid || raw.provider || raw.vendor || 'PGSoft';
    const vl = String(vendorCode).toLowerCase().replace(/[^a-z]/g, '');
    if (vl === 'pgsoft' || vl === 'pgsoftgames' || vl === 'pg') vendorCode = 'PGSoft';
    if (vl === 'amusnet' || vl === 'egtinteractive') vendorCode = 'Amusnet';
    if (gameCode === undefined || gameCode === null || gameCode === '') return null;
    return {
      displayName: raw.name || raw.gameName || raw.game_name || raw.displayName || String(gameCode),
      content: { gameCode, vendorCode, vendorId: raw.vendorId || raw.vendor_id || raw.vendorid || null, gameTypeId: raw.gameTypeId || raw.game_type_id || raw.type || categoryHint || 'Slots', extraData: raw.extraData || raw.extra_data || null, hasTrialPlay: Boolean(raw.hasTrialPlay ?? raw.has_trial_play ?? raw.demo ?? false) },
      customizeData: { lightIcon: raw.image || raw.icon || raw.thumbnail || raw.imageUrl || raw.image_url || raw.iconurl || raw.iconurl1 || raw.iconurl2 || '' }
    };
  }
  function normalizeCatalogue(result) {
    const rawGames = Array.isArray(result?.games) ? result.games : Array.isArray(result) ? result : [];
    return rawGames.map((g) => normalizeGame(g, result?.category)).filter(Boolean);
  }

  router.get('/getWebsiteCategory', async (req, res) => {
    try { const result = await adapter.listGames(); const data = normalizeCatalogue(result); return res.json({ success: true, providerAvailable: data.length > 0, data }); }
    catch (err) { console.error('[provider] getWebsiteCategory failed:', err); return res.json({ success: true, providerAvailable: false, data: [] }); }
  });

  router.post('/getGameUrl', launchMiddleware, async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      const userId = req.user?.username || req.user?.sub || req.body.userId;
      const launchResult = await adapter.launchGame({ gameId: gameCode, vendorCode, gameTypeId, extraData, userId, returnUrl: req.body.returnUrl });
      return res.json({ success: true, status: '000000', data: { gameUrl: launchResult.url } });
    } catch (err) { console.error('[provider] getGameUrl failed:', err); return res.status(502).json({ success: false, message: err.message || 'Game service is temporarily unavailable' }); }
  });

  router.post('/getTrailGameUrl', async (req, res) => {
    try {
      const { gameCode, vendorCode, gameTypeId, extraData } = req.body || {};
      const launchResult = await adapter.launchGame({ gameId: gameCode, vendorCode, gameTypeId, extraData, userId: req.user?.username || req.body.userId || 'guest', trial: true, returnUrl: req.body.returnUrl });
      return res.json({ success: true, status: '000000', data: { gameUrl: launchResult.url } });
    } catch (err) { console.error('[provider] getTrailGameUrl failed:', err); return res.status(502).json({ success: false, message: err.message || 'Trial launch failed' }); }
  });

  async function callback(req, res) {
    if (!db) return res.status(503).json({ code: 1, message: 'Database is not configured' });
    const body = req.body || {};
    const op = String(req.path || '').replace(/^\//, '').toLowerCase();
    const agentID = String(body.agentID || '');
    const userID = String(body.userID || body.userid || '');
    const gameID = body.gameID ?? body.gameid;
    const provider = adapter.resolveVendorByAgent ? adapter.resolveVendorByAgent(agentID) : (agentID && adapter.resolveVendor('PGSoft'));
    if (!provider) return res.json({ code: 4, message: 'Invalid Agent' });
    const providerCode = provider.vendorCode;
    const v = adapter.resolveVendor(providerCode);
    if (!v || !v.secretKey) return res.json({ code: 4, message: 'Provider is not configured' });
    let message = '';
    if (op === 'getbalance') message = `${agentID}${userID}${gameID}`;
    else if (op === 'withdraw') message = `${agentID}${userID}${Number(body.amount).toFixed(2)}${body.transactionID}${body.roundID}${gameID}`;
    else if (op === 'deposit') message = `${agentID}${userID}${Number(body.amount).toFixed(2)}${body.refTransactionID}${body.transactionID}${body.roundID}${gameID}`;
    else if (op === 'betwin') message = `${agentID}${userID}${Number(body.betAmount).toFixed(2)}${Number(body.winAmount).toFixed(2)}${body.transactionID}${body.roundID}${gameID}`;
    else if (op === 'rollbacktransaction') message = `${agentID}${userID}${body.refTransactionID}${gameID}`;
    else return res.json({ code: 2, message: 'Unsupported callback operation' });
    if (!adapter.verifyCallback(providerCode, message, body.sign)) return res.json({ code: 3, message: 'Invalid Sign' });
    try {
      const uq = await db.query('SELECT id FROM users WHERE username=$1 LIMIT 1', [userID]);
      if (!uq.rows[0]) return res.json({ code: 5, message: 'User ID not found' });
      const userUuid = uq.rows[0].id;
      if (op === 'getbalance') {
        const q = await db.query('SELECT balance FROM wallets WHERE user_id=$1', [userUuid]);
        return res.json({ code: 0, message: '', balance: Number(q.rows[0]?.balance || 0) });
      }
      const txid = op === 'rollbacktransaction' ? String(body.refTransactionID) : String(body.transactionID || '');
      if (!txid) return res.json({ code: 2, message: 'transactionID is required' });
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        if (op === 'rollbacktransaction') {
          const rq = await client.query('SELECT * FROM provider_transactions WHERE provider=$1 AND transaction_id=$2 FOR UPDATE', [providerCode, txid]);
          if (!rq.rows[0]) { await client.query('ROLLBACK'); return res.json({ code: 8, message: 'Could not find reference transaction id' }); }
          const t = rq.rows[0];
          if (t.rolled_back) { await client.query('ROLLBACK'); return res.json({ code: 9, message: 'Transaction is already rolled back' }); }
          const w = await client.query('UPDATE wallets SET balance=balance-$2, updated_at=now() WHERE user_id=$1 RETURNING balance', [userUuid, t.delta]);
          const bal = Number(w.rows[0]?.balance || 0);
          await client.query('UPDATE provider_transactions SET rolled_back=true WHERE id=$1', [t.id]);
          await client.query('INSERT INTO wallet_ledger(user_id,type,amount,balance_after,reference,note) VALUES($1,$2,$3,$4,$5,$6)', [userUuid, 'provider_rollback', -Number(t.delta), bal, txid, `${providerCode} rollback`]);
          await client.query('COMMIT');
          return res.json({ code: 0, message: '', balance: bal });
        }
        const existing = await client.query('SELECT * FROM provider_transactions WHERE provider=$1 AND transaction_id=$2 FOR UPDATE', [providerCode, txid]);
        if (existing.rows[0]) { const t=existing.rows[0]; await client.query('ROLLBACK'); return res.json({ code: 11, message: 'Duplicate transaction', platformTransactionID: t.id, balance: Number(t.balance_after) }); }
        const w0 = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [userUuid]);
        if (!w0.rows[0]) { await client.query('ROLLBACK'); return res.json({ code: 5, message: 'User ID not found' }); }
        const before = Number(w0.rows[0].balance);
        let delta = 0;
        if (op === 'withdraw') delta = -Number(body.amount || 0);
        if (op === 'deposit') delta = Number(body.amount || 0);
        if (op === 'betwin') delta = Number(body.winAmount || 0) - Number(body.betAmount || 0);
        const after = before + delta;
        if (after < 0) { await client.query('ROLLBACK'); return res.json({ code: 6, message: 'Insufficient funds', balance: before }); }
        const w = await client.query('UPDATE wallets SET balance=$2, updated_at=now() WHERE user_id=$1 RETURNING balance', [userUuid, after]);
        const bal = Number(w.rows[0].balance);
        const opName = op === 'betwin' ? 'BetWin' : op[0].toUpperCase()+op.slice(1);
        const ins = await client.query('INSERT INTO provider_transactions(provider,transaction_id,ref_transaction_id,user_id,operation,delta,balance_before,balance_after,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [providerCode,txid,body.refTransactionID||null,userUuid,opName,delta,before,bal,body]);
        await client.query('INSERT INTO wallet_ledger(user_id,type,amount,balance_after,reference,note) VALUES($1,$2,$3,$4,$5,$6)', [userUuid, `provider_${op}`, delta, bal, txid, `${providerCode} ${opName}`]);
        await client.query('COMMIT');
        return res.json({ code: 0, message: '', platformTransactionID: ins.rows[0].id, balance: bal });
      } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} throw e; } finally { client.release(); }
    } catch (e) { console.error('[provider] callback failed:', e); return res.json({ code: 1, message: 'General error' }); }
  }

  for (const p of ['GetBalance','Withdraw','Deposit','BetWin','RollbackTransaction']) router.post(`/${p}`, callback);
  router.post('/callback', callback);
  router.get('/status', (req, res) => res.json({ success: true, data: adapter.status() }));
  if (app && typeof app.use === 'function') { app.use('/api/bt/v1/provider', router); app.use('/api/provider', router); app.use('/api/callback', router); }
  return router;
}
module.exports = setupProviderRoutes;
module.exports.setupProviderRoutes = setupProviderRoutes;
module.exports.default = setupProviderRoutes;

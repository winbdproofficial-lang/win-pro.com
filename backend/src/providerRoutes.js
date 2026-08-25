const express = require('express');
const { pool } = require('./db');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // 1. Demo catalogue
    const getCatalogue = async (req, res) => {
        const mockGames = [
            { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
            { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' }
        ];
        return res.json({ success: true, games: mockGames, data: mockGames });
    };

    // 2. Demo game launcher
    const launchGame = async (req, res) => {
        const realDemoUrl = 'https://demo.jilibet.com/';
        return res.json({
            success: true,
            status: '000000',
            url: realDemoUrl,
            gameUrl: realDemoUrl,
            data: { url: realDemoUrl, gameUrl: realDemoUrl }
        });
    };

    router.post('/wallet/update', authRequired, async (req, res) => {
        return res.json({ success: true, newBalance: 0 });
    });

    router.get('/catalogue', getCatalogue);
    router.post('/catalogue', getCatalogue);
    router.get('/launch', launchGame);
    router.post('/launch', launchGame);

    // ------------------------------------------------------------------
    // Seamless wallet callback endpoints.
    // These are server-to-server endpoints for the provider to call.
    // They intentionally accept common field aliases because the final
    // provider contract/signature rules are supplied during onboarding.
    // ------------------------------------------------------------------
    const value = (body, names, fallback = undefined) => {
        for (const name of names) {
            if (body?.[name] !== undefined && body?.[name] !== null && body?.[name] !== '') return body[name];
        }
        return fallback;
    };

    const resolveUser = async (rawUserId) => {
        const userId = String(rawUserId || '').trim();
        if (!userId) return null;
        const q = await pool.query(
            'SELECT u.id,u.username,u.currency,w.balance FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.id::text=$1 OR lower(u.username)=lower($1) LIMIT 1',
            [userId]
        );
        return q.rows[0] || null;
    };

    const callbackError = (res, message, status = 400) =>
        res.status(status).json({ code: 1, message, balance: 0 });

    const callbackBalance = async (req, res) => {
        try {
            const user = await resolveUser(value(req.body, ['userid', 'userId', 'username']));
            if (!user) return callbackError(res, 'User not found', 404);
            return res.json({ code: 0, message: '', balance: Number(user.balance) });
        } catch (e) {
            console.error('Seamless GetBalance callback error:', e);
            return callbackError(res, 'Internal server error', 500);
        }
    };

    const walletChange = async (req, res, direction, operation) => {
        const body = req.body || {};
        const user = await resolveUser(value(body, ['userid', 'userId', 'username']));
        if (!user) return callbackError(res, 'User not found', 404);

        const reference = String(value(body, ['transactionId', 'transactionID', 'transaction_id', 'reference', 'roundId', 'roundID', 'betId', 'id'], `${operation}-${Date.now()}`));
        const operationReference = `${operation}:${reference}`;
        const existing = await pool.query('SELECT balance_after FROM wallet_ledger WHERE reference=$1 LIMIT 1', [operationReference]);
        if (existing.rows[0]) return res.json({ code: 0, message: '', balance: Number(existing.rows[0].balance_after) });

        let amount = Number(value(body, ['amount', 'betAmount', 'winAmount', 'withdrawAmount', 'depositAmount'], 0));
        if (!Number.isFinite(amount) || amount <= 0) return callbackError(res, 'Invalid amount');
        if (direction === 'debit') amount = -amount;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const locked = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
            if (!locked.rows[0]) throw new Error('Wallet not found');
            const current = Number(locked.rows[0].balance);
            const next = current + amount;
            if (next < 0) {
                await client.query('ROLLBACK');
                return callbackError(res, 'Insufficient balance', 402);
            }
            await client.query('UPDATE wallets SET balance=$2,updated_at=now() WHERE user_id=$1', [user.id, next]);
            await client.query(
                'INSERT INTO wallet_ledger(user_id,type,amount,balance_after,reference,note) VALUES($1,$2,$3,$4,$5,$6)',
                [user.id, operation, amount, next, operationReference, `Seamless ${operation} callback`]
            );
            await client.query('COMMIT');
            return res.json({ code: 0, message: '', balance: next });
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            console.error(`Seamless ${operation} callback error:`, e);
            return callbackError(res, 'Internal server error', 500);
        } finally {
            client.release();
        }
    };

    const betWin = async (req, res) => {
        const body = req.body || {};
        const bet = Number(value(body, ['betAmount', 'bet_amount'], 0));
        const win = Number(value(body, ['winAmount', 'win_amount'], 0));
        if (bet > 0 || win > 0) {
            // Combined BetWin callback: debit the bet, then credit the win atomically.
            const user = await resolveUser(value(body, ['userid', 'userId', 'username']));
            if (!user) return callbackError(res, 'User not found', 404);
            const reference = String(value(body, ['transactionId', 'transactionID', 'transaction_id', 'reference', 'roundId', 'roundID', 'id'], `betwin-${Date.now()}`));
            const operationReference = `betwin:${reference}`;
            const existing = await pool.query('SELECT balance_after FROM wallet_ledger WHERE reference=$1 LIMIT 1', [operationReference]);
            if (existing.rows[0]) return res.json({ code: 0, message: '', balance: Number(existing.rows[0].balance_after) });

            const net = win - bet;
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const locked = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
                if (!locked.rows[0]) throw new Error('Wallet not found');
                const next = Number(locked.rows[0].balance) + net;
                if (next < 0) {
                    await client.query('ROLLBACK');
                    return callbackError(res, 'Insufficient balance', 402);
                }
                await client.query('UPDATE wallets SET balance=$2,updated_at=now() WHERE user_id=$1', [user.id, next]);
                await client.query(
                    'INSERT INTO wallet_ledger(user_id,type,amount,balance_after,reference,note) VALUES($1,$2,$3,$4,$5,$6)',
                    [user.id, 'betwin', net, next, operationReference, `Seamless BetWin callback; bet=${bet}; win=${win}`]
                );
                await client.query('COMMIT');
                return res.json({ code: 0, message: '', balance: next });
            } catch (e) {
                await client.query('ROLLBACK').catch(() => {});
                console.error('Seamless BetWin callback error:', e);
                return callbackError(res, 'Internal server error', 500);
            } finally {
                client.release();
            }
        }

        // Some providers send a single amount plus a type/action.
        const action = String(value(body, ['type', 'action', 'transactionType'], '')).toLowerCase();
        const isDebit = ['bet', 'debit', 'withdraw', 'withdrawal'].includes(action);
        const isCredit = ['win', 'credit', 'deposit'].includes(action);
        if (isDebit) return walletChange(req, res, 'debit', 'betwin');
        if (isCredit) return walletChange(req, res, 'credit', 'betwin');
        return callbackError(res, 'betAmount/winAmount or transaction type is required');
    };

    const rollback = async (req, res) => {
        try {
            const body = req.body || {};
            const user = await resolveUser(value(body, ['userid', 'userId', 'username']));
            if (!user) return callbackError(res, 'User not found', 404);
            const original = String(value(body, ['transactionId', 'transactionID', 'transaction_id', 'reference', 'roundId', 'roundID', 'id'], '')).trim();
            if (!original) return callbackError(res, 'transactionId is required');
            const rollbackRef = `rollback:${original}`;
            const already = await pool.query('SELECT balance_after FROM wallet_ledger WHERE reference=$1 LIMIT 1', [rollbackRef]);
            if (already.rows[0]) return res.json({ code: 0, message: '', balance: Number(already.rows[0].balance_after) });

            const q = await pool.query(
                'SELECT amount FROM wallet_ledger WHERE user_id=$1 AND (reference=$2 OR reference=$3) ORDER BY created_at DESC LIMIT 1',
                [user.id, original, `betwin:${original}`]
            );
            if (!q.rows[0]) return callbackError(res, 'Original transaction not found', 404);
            const reverse = -Number(q.rows[0].amount);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const locked = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
                const next = Number(locked.rows[0].balance) + reverse;
                if (next < 0) {
                    await client.query('ROLLBACK');
                    return callbackError(res, 'Rollback would make balance negative', 409);
                }
                await client.query('UPDATE wallets SET balance=$2,updated_at=now() WHERE user_id=$1', [user.id, next]);
                await client.query(
                    'INSERT INTO wallet_ledger(user_id,type,amount,balance_after,reference,note) VALUES($1,$2,$3,$4,$5,$6)',
                    [user.id, 'rollback', reverse, next, rollbackRef, `Seamless RollbackTransaction callback for ${original}`]
                );
                await client.query('COMMIT');
                return res.json({ code: 0, message: '', balance: next });
            } catch (e) {
                await client.query('ROLLBACK').catch(() => {});
                console.error('Seamless RollbackTransaction callback error:', e);
                return callbackError(res, 'Internal server error', 500);
            } finally {
                client.release();
            }
        } catch (e) {
            console.error('Seamless RollbackTransaction callback error:', e);
            return callbackError(res, 'Internal server error', 500);
        }
    };

    // Callback paths requested in the Seamless API onboarding flow.
    const callback = express.Router();
    callback.post('/GetBalance', callbackBalance);
    callback.post('/BetWin', betWin);
    callback.post('/Withdraw', (req, res) => walletChange(req, res, 'debit', 'withdraw'));
    callback.post('/Deposit', (req, res) => walletChange(req, res, 'credit', 'deposit'));
    callback.post('/RollbackTransaction', rollback);
    app.use('/api/callback', callback);
    app.use('/api/bt/v1/callback', callback);

    app.use('/api/provider', router);
    app.use('/api/bt/v1/provider', router);
    app.use('/api/bt/v1/game', router);
}

module.exports = { providerRoutes: setupProviderRoutes };

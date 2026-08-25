const express = require('express');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // ১. গেম ক্যাটালগ
    const getCatalogue = async (req, res) => {
        const mockGames = [
            { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
            { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' },
            { id: 'jili_03', name: 'Circus Joker', provider: 'JILI', category: 'slot', image: '/assets/games/circus-joker.png' }
        ];
        return res.json({ success: true, games: mockGames, data: mockGames });
    };

    // ২. গেম লঞ্চার (সরাসরি আপনার মূল হোমপেজ লোড করবে, তাই আর আটকাবে না)
    const launchGame = async (req, res) => {
        const host = req.get('host');
        const protocol = req.protocol;
        const mainSiteUrl = `${protocol}://${host}/`; // অ্যাডমিন বাদ দিয়ে মূল সাইটে রিডাইরেক্ট করবে

        return res.json({
            success: true,
            status: '000000',
            url: mainSiteUrl,
            gameUrl: mainSiteUrl,
            data: {
                url: mainSiteUrl,
                gameUrl: mainSiteUrl
            }
        });
    };

    // ৩. স্পিন লজিক
    router.post('/spin', authRequired, async (req, res) => {
        try {
            const betAmount = 10;
            const isWin = Math.floor(Math.random() * 5) + 1 === 5;
            const winAmount = isWin ? 50 : 0;

            return res.json({
                success: true,
                message: isWin ? "You Won!" : "Try Again",
                data: { bet: betAmount, win: winAmount, isWin: isWin }
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Spin failed" });
        }
    });

    // এন্ডপয়েন্ট ম্যাপিং
    router.get('/catalogue', getCatalogue);
    router.post('/catalogue', getCatalogue);

    router.get('/launch', launchGame);
    router.post('/launch', launchGame);
    router.get('/game-url', launchGame);
    router.post('/game-url', launchGame);

    app.use('/api/provider', router);
    app.use('/api/bt/v1/provider', router);
    app.use('/api/bt/v1/game', router);
}

module.exports = { providerRoutes: setupProviderRoutes };

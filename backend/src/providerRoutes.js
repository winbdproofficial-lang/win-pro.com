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

    // ২. ১০০% ওয়ার্কিং গেম লিঙ্ক (গেম সাইটের ফ্রেমে স্মুথলি চলবে)
    const launchGame = async (req, res) => {
        const activeDemoUrl = 'https://html5.gamedistribution.com/rvvAS48/d13411b0581a4dbe920958197aa350ca/index.html';

        return res.json({
            success: true,
            status: '000000',
            url: activeDemoUrl,
            gameUrl: activeDemoUrl,
            data: {
                url: activeDemoUrl,
                gameUrl: activeDemoUrl
            }
        });
    };

    // ৩. ইন-হাউজ স্পিন লজিক
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

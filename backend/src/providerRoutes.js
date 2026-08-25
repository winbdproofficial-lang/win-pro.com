const express = require('express');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // ১. গেম ক্যাটালগ রাউট
    const getCatalogue = async (req, res) => {
        const mockGames = [
            { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
            { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' },
            { id: 'jili_03', name: 'Circus Joker', provider: 'JILI', category: 'slot', image: '/assets/games/circus-joker.png' }
        ];
        return res.json({ success: true, games: mockGames, data: mockGames });
    };
// ২. গেম লঞ্চ রাউট (আপনার দেওয়া লিংক সহ)
    const launchGame = async (req, res) => {
        const demoUrl = 'https://betjili365.vip/bd/en';
        
        return res.json({
            success: true,
            status: '000000',
            url: demoUrl,
            gameUrl: demoUrl,
            data: {
                url: demoUrl,
                gameUrl: demoUrl
            }
        });
    };

    // এন্ডপয়েন্ট হ্যান্ডলিং (GET এবং POST উভয় রাউটের জন্য)
    router.get('/catalogue', getCatalogue);
    router.post('/catalogue', getCatalogue);

    router.get('/launch', launchGame);
    router.post('/launch', launchGame);
    router.get('/game-url', launchGame);
    router.post('/game-url', launchGame);

    // অ্যাপ্লিকেশনে রাউট মাউন্ট করা
    app.use('/api/provider', router);
    app.use('/api/bt/v1/provider', router);
    app.use('/api/bt/v1/game', router); // অতিরিক্ত কমন পাথ
}

module.exports = { providerRoutes: setupProviderRoutes };

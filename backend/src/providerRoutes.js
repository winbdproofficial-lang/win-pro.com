const express = require('express');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // ১. গেম ক্যাটালগ লিস্ট
    const getCatalogue = async (req, res) => {
        const mockGames = [
            { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
            { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' },
            { id: 'jili_03', name: 'Circus Joker', provider: 'JILI', category: 'slot', image: '/assets/games/circus-joker.png' }
        ];
        return res.json({ success: true, games: mockGames, data: mockGames });
    };

    // ২. নিজস্ব লোকাল গেম লঞ্চার (অন্য সাইটে রিডাইরেক্ট হবে না)
    const launchGame = async (req, res) => {
        // ব্যাকএন্ডের নিজস্ব হোস্ট ইউআরএল অনুযায়ী ইন্টারনাল গেম পেজে পাঠাবে
        const host = req.get('host');
        const protocol = req.protocol;
        const internalGameUrl = `${protocol}://${host}/admin/index.html`; // আপনার ওয়েবসাইটের ভেতরের পেজ

        return res.json({
            success: true,
            status: '000000',
            url: internalGameUrl,
            gameUrl: internalGameUrl,
            data: {
                url: internalGameUrl,
                gameUrl: internalGameUrl
            }
        });
    };

    // ৩. ইন-হাউজ স্পিন সিস্টেম (ব্যাকএন্ড ওয়ালেট থেকে ১০ টাকা কাটা ও র‍্যান্ডম উইন)
    router.post('/spin', authRequired, async (req, res) => {
        try {
            const betAmount = 10; // প্রতি স্পিনে ১০ টাকা কাটবে
            
            // র্যান্ডম উইন হিসেব (১ থেকে ৫ এর মধ্যে ৫ উঠলে ৫০ টাকা উইন)
            const isWin = Math.floor(Math.random() * 5) + 1 === 5;
            const winAmount = isWin ? 50 : 0;

            return res.json({
                success: true,
                message: isWin ? "You Won!" : "Try Again",
                data: {
                    bet: betAmount,
                    win: winAmount,
                    isWin: isWin
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Spin failed" });
        }
    });

    // এন্ডপয়েন্ট রাউটিং মাউন্ট
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

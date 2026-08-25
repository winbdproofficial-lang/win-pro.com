const express = require('express');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // ১. গেম ক্যাটালগ রাউট (API কল ফেইল করলে ডামি ডাটা পাঠাবে)
    router.get('/catalogue', async (req, res) => {
        try {
            // যদি আসল API না থাকে তবে ফলব্যাক মক ডাটা পাঠাবে
            throw new Error("Using Mock Fallback Mode");
        } catch (error) {
            console.log("Provider API failed or disabled. Using Mock Fallback Games.");
            
            const mockGames = [
                { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
                { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' },
                { id: 'jili_03', name: 'Circus Joker', provider: 'JILI', category: 'slot', image: '/assets/games/circus-joker.png' }
            ];

            return res.json({ success: true, games: mockGames });
        }
    });

    // ২. গেম লঞ্চ রাউট (গেমে ক্লিক করলে ডেমো ইউআরএল পাঠাবে)
    router.post('/launch', async (req, res) => {
        try {
            return res.json({
                success: true,
                url: 'https://demo.jiligaming.com/' // ডেমো গেম লিংক
            });
        } catch (error) {
            return res.json({
                success: false,
                message: "Unable to launch game in mock mode"
            });
        }
    });

    // এক্সপ্রেস অ্যাপে রাউট মাউন্ট করা
    app.use('/api/provider', router);
    app.use('/api/bt/v1/provider', router); // সেফটির জন্য অল্টারনেটিভ এন্ডপয়েন্ট
}

module.exports = { providerRoutes: setupProviderRoutes };

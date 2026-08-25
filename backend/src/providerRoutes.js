const express = require('express');
const router = express.Router();
const axios = require('axios'); // অথবা আপনার ব্যবহৃত HTTP ক্লায়েন্ট

// ১. গেম ক্যাটালগ রাউট (API কল ফেইল করলে ডামি ডাটা পাঠাবে)
router.get('/catalogue', async (req, res) => {
    try {
        // এখানে আপনার আসল প্রোভাইডার API কলটি রাখার চেষ্টা করা হবে
        // const response = await axios.get('PROVIDER_API_URL', { headers: ... });
        // return res.json({ success: true, games: response.data });
        
        // যদি টোকেন না থাকে বা API না চলে তবে ক্যাচ ব্লকে যাবে
        throw new Error("Using Mock Fallback Mode");

    } catch (error) {
        console.log("Provider API failed or disabled. Using Mock Fallback Games.");
        
        // মক/ডামি গেম ডাটা রেসপন্স
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
        const { gameId } = req.body;

        // আসল প্রোভাইডার লজিক ব্যর্থ হলে মক URL রিটার্ন করবে
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

module.exports = router;

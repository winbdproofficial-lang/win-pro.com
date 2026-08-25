const express = require('express');

function setupProviderRoutes(app, { authRequired }) {
    const router = express.Router();

    // ১. ক্যাটালগ
    const getCatalogue = async (req, res) => {
        const mockGames = [
            { id: 'jili_01', name: 'Super Ace', provider: 'JILI', category: 'slot', image: '/assets/games/super-ace.png' },
            { id: 'jili_02', name: 'Fortune Gems', provider: 'JILI', category: 'slot', image: '/assets/games/fortune-gems.png' },
            { id: 'jili_03', name: 'Circus Joker', provider: 'JILI', category: 'slot', image: '/assets/games/circus-joker.png' }
        ];
        return res.json({ success: true, games: mockGames, data: mockGames });
    };

    // ২. গেম প্লেয়ার ভিউপয়েন্ট (HTML5 ইন্টারফেস)
    const renderGamePlayer = (req, res) => {
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>JILI Slot Game</title>
            <style>
                body { margin: 0; padding: 0; background: #0a1912; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
                .slot-container { background: #112a20; border: 2px solid #00ffaa; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 0 20px rgba(0,255,170,0.3); width: 85%; max-width: 350px; }
                .reels { display: flex; justify-content: space-around; background: #000; padding: 15px; border-radius: 8px; font-size: 3rem; margin: 20px 0; border: 1px solid #333; }
                .btn-spin { background: #00ffaa; color: #000; border: none; padding: 12px 30px; font-size: 1.2rem; font-weight: bold; border-radius: 25px; cursor: pointer; transition: 0.2s; width: 100%; }
                .btn-spin:active { transform: scale(0.95); }
                .status { margin-top: 15px; font-size: 1rem; color: #ffcc00; min-height: 20px; }
            </style>
        </head>
        <body>
            <div class="slot-container">
                <h2 style="margin:0; color:#00ffaa;">SUPER ACE</h2>
                <p style="font-size:0.8rem; opacity:0.8;">JILI Provider Demo</p>
                <div class="reels">
                    <span id="r1">👑</span>
                    <span id="r2">💎</span>
                    <span id="r3">🔔</span>
                </div>
                <button class="btn-spin" onclick="spin()">SPIN (10 BDT)</button>
                <div class="status" id="status">Press Spin to Play!</div>
            </div>

            <script>
                const symbols = ['👑', '💎', '🔔', '7️⃣', '💰'];
                function spin() {
                    const status = document.getElementById('status');
                    status.innerText = "Spinning...";
                    
                    let count = 0;
                    const interval = setInterval(() => {
                        document.getElementById('r1').innerText = symbols[Math.floor(Math.random()*symbols.length)];
                        document.getElementById('r2').innerText = symbols[Math.floor(Math.random()*symbols.length)];
                        document.getElementById('r3').innerText = symbols[Math.floor(Math.random()*symbols.length)];
                        count++;
                        if(count > 10) {
                            clearInterval(interval);
                            const s1 = symbols[Math.floor(Math.random()*symbols.length)];
                            const s2 = symbols[Math.floor(Math.random()*symbols.length)];
                            const s3 = symbols[Math.floor(Math.random()*symbols.length)];
                            
                            document.getElementById('r1').innerText = s1;
                            document.getElementById('r2').innerText = s2;
                            document.getElementById('r3').innerText = s3;

                            if(s1 === s2 && s2 === s3) {
                                status.innerText = "🎉 BIG WIN! +100 BDT";
                            } else {
                                status.innerText = "Try Again!";
                            }
                        }
                    }, 100);
                }
            </script>
        </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.send(htmlContent);
    };

    // ৩. লঞ্চ রাউট (ব্যাকএন্ড গেম প্লেয়ার URL পাঠাবে)
    const launchGame = async (req, res) => {
        const host = req.get('host');
        const protocol = req.protocol;
        const gameUrl = `${protocol}://${host}/api/provider/player`;

        return res.json({
            success: true,
            status: '000000',
            url: gameUrl,
            gameUrl: gameUrl,
            data: {
                url: gameUrl,
                gameUrl: gameUrl
            }
        });
    };

    // এন্ডপয়েন্ট ম্যাপিং
    router.get('/player', renderGamePlayer); // ইন্টারনাল HTML5 গেম রেন্ডার করবে
    
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

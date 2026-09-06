(() => {
  const $ = (id) => document.getElementById(id);
  let games = [];
  let vendor = 'all';
  let category = 'all';
  let keyword = '';

  const apiJson = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = localStorage.getItem('winbd_access');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Game service request failed');
    return data;
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const gameMatches = (game) => {
    const q = keyword.trim().toLowerCase();
    return (
      (vendor === 'all' || game.vendorCode === vendor) &&
      (category === 'all' || game.category === category) &&
      (!q || `${game.name} ${game.vendorCode} ${game.category}`.toLowerCase().includes(q))
    );
  };

  const card = (game) => {
    const image = game.image || '';
    const action = game.fallback ? `window.winbdPreviewGame(${JSON.stringify(game)})` : `window.winbdLaunchGame(${JSON.stringify(game)})`;
    const buttonText = game.fallback ? 'API যুক্ত হলে খেলুন' : 'এখন খেলুন';
    return `
      <article class="game-tile${game.fallback ? ' game-preview' : ''}">
        <div class="tile-art game-provider">
          ${image ? `<img src="${esc(image)}" alt="${esc(game.name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-failed')">` : '<span>🎮</span>'}
          <span class="game-badge">${game.fallback ? 'PREVIEW' : 'LIVE'}</span>
          <button class="favorite-btn" type="button" aria-label="Favorite">♡</button>
        </div>
        <span class="provider-label">${esc(game.vendorCode)}</span>
        <h3 title="${esc(game.name)}">${esc(game.name)}</h3>
        <p>${esc(game.category)}</p>
        <button class="primary game-action" onclick='${action}'>${buttonText}</button>
        ${game.hasTrialPlay && !game.fallback ? `<button class="ghost game-action" onclick='window.winbdLaunchTrial(${JSON.stringify(game)})'>ট্রায়াল</button>` : ''}
      </article>`;
  };

  function render() {
    const list = games.filter(gameMatches);
    if ($('gameGrid')) {
      $('gameGrid').innerHTML = list.length
        ? list.map(card).join('')
        : '<div class="card"><h3>কোনো গেম পাওয়া যায়নি</h3><p>অন্য provider, category বা search চেষ্টা করুন।</p></div>';
    }
    if ($('homeGameGrid')) {
      $('homeGameGrid').innerHTML = list.slice(0, 10).map(card).join('');
    }
    const heading = document.querySelector('#games .section-head h2');
    if (heading) heading.innerHTML = `গেম ক্যাটাগরি <span class="game-count">(${list.length})</span>`;
    const count = $('gameResultCount');
    if (count) count.textContent = `${list.length} games`;
  }

  function renderRails() {
    const providerRail = $('providerRail');
    if (providerRail) {
      const vendors = ['all', ...new Set(games.map((game) => game.vendorCode).filter(Boolean))];
      providerRail.innerHTML = vendors.map((value) => `
        <button class="${value === vendor ? 'active' : ''}" onclick='winbdSetVendor(${JSON.stringify(value)})'>
          ${value === 'all' ? 'সব Provider' : esc(value)}
        </button>`).join('');
    }

    const categoryRail = $('providerCategories');
    if (categoryRail) {
      const categories = ['all', ...new Set(games.map((game) => game.category).filter(Boolean))];
      categoryRail.innerHTML = categories.slice(0, 32).map((value) => `
        <button class="${value === category ? 'active' : ''}" onclick='winbdSetCategory(${JSON.stringify(value)})'>
          ${value === 'all' ? 'সব Category' : esc(value)}
        </button>`).join('');
    }
  }

  async function load() {
    try {
      const data = await apiJson('/api/bt/v1/provider/getWebsiteCategory');
      games = Array.isArray(data.data) ? data.data : [];
      renderRails();
      render();
      const health = $('health');
      if (health) health.textContent = data.providerAvailable ? `Provider Connected · ${games.length} games` : `Preview catalogue · ${games.length} games`;
      const status = $('gameServiceStatus');
      if (status) {
        status.textContent = data.providerAvailable
          ? `Provider catalogue live · ${games.length} games`
          : `Preview catalogue ready · ${games.length} games · API পরে বসালেই live games আসবে`;
      }
    } catch (error) {
      console.warn(error);
      games = [];
      renderRails();
      render();
      const health = $('health');
      if (health) health.textContent = 'Game service unavailable';
      const status = $('gameServiceStatus');
      if (status) status.textContent = 'Game service সাময়িকভাবে unavailable';
    }
  }

  async function launch(game, trial = false) {
    if (game.fallback) {
      window.winbdPreviewGame(game);
      return;
    }
    if (!localStorage.getItem('winbd_access')) {
      openModal('login');
      toast('গেম চালাতে আগে লগইন করুন');
      return;
    }
    try {
      const data = await apiJson(trial ? '/api/bt/v1/provider/getTrailGameUrl' : '/api/bt/v1/provider/getGameUrl', {
        method: 'POST',
        body: JSON.stringify({
          gameTypeId: game.gameTypeId,
          vendorCode: game.vendorCode,
          gameCode: game.gameCode,
          extraData: game.extraData,
          gameImagePath: game.image,
          vendorName: game.vendorCode,
          hasTrialPlay: game.hasTrialPlay,
          isDesktop: window.innerWidth > 768,
          returnUrl: location.origin + location.pathname,
          source: game.source || 'provider',
        }),
      });
      const result = data.data || data;
      if (result?.gameUrl) {
        const popup = window.open(result.gameUrl, '_blank', 'noopener,noreferrer');
        if (!popup) location.href = result.gameUrl;
      } else if (result?.htmlData) {
        const blob = new Blob([result.htmlData], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
      } else {
        toast(data.message || 'Game service is temporarily unavailable.');
      }
    } catch (error) {
      toast(error.message || 'Game service is temporarily unavailable');
    }
  }

  window.winbdPreviewGame = (game) => {
    toast(`${game.name}: preview card ready — Provider API configure হলে এখান থেকেই real launch হবে`);
  };
  window.winbdSetVendor = (value) => { vendor = value; renderRails(); render(); };
  window.winbdSetCategory = (value) => { category = value; renderRails(); render(); };
  window.winbdLaunchGame = (game) => launch(game, false);
  window.winbdLaunchTrial = (game) => launch(game, true);
  window.renderGames = () => render();
  window.renderHomeGames = () => render();
  window.setGameFilter = (value) => {
    const values = games.map((game) => game.vendorCode);
    if (values.includes(value)) {
      vendor = value;
      category = 'all';
      keyword = '';
    } else if (value === 'all') {
      vendor = 'all';
      category = 'all';
      keyword = '';
    } else if (value === 'Super Ace') {
      vendor = 'all';
      category = 'all';
      keyword = 'Super Ace';
    } else {
      vendor = 'all';
      category = value;
      keyword = '';
    }
    show('games');
    renderRails();
    render();
  };

  const originalSearch = $('gameSearch');
  if (originalSearch) {
    originalSearch.addEventListener('input', () => {
      keyword = originalSearch.value || '';
      render();
    });
  }

  window.loadProviderGames = load;
  load();
})();

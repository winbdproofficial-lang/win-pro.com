let GAMES = [];
let providerLoaded = false;

async function syncProviderGames() {
  try {
    const r = await api('/api/bt/v1/provider/games', {
      method: 'GET',
      cache: 'no-store'
    });

    const d = await r.json();

    if (!r.ok) {
      throw new Error(d?.message || 'Provider API failed');
    }

    const games = Array.isArray(d?.data?.games)
      ? d.data.games
      : [];

    GAMES = games
      .map(game => ({
        id: game.gameId || game.id || game.code,
        provider:
          game.provider ||
          game.providerName ||
          'Provider',
        name:
          game.name ||
          game.gameName ||
          game.title ||
          'Game',
        category:
          game.category ||
          game.categoryName ||
          'Other',
        image:
          game.image ||
          game.imageUrl ||
          game.thumbnail ||
          '',
      }))
      .filter(game => game.id && game.name);

    providerLoaded = true;

    renderProviderRail();
    renderGames();
    renderHomeGames();

  } catch (error) {
    console.error('Provider catalogue error:', error);

    providerLoaded = false;

    const grid = $('gameGrid');

    if (grid) {
      grid.innerHTML = `
        <div class="card">
          <h3>Provider catalogue unavailable</h3>
          <p>Provider API connection check করুন।</p>
          <button class="primary"
                  onclick="syncProviderGames()">
            আবার চেষ্টা করুন
          </button>
        </div>
      `;
    }
  }
}

function renderProviderRail() {
  const section =
    document.querySelector('#games .section-head');

  if (!section) return;

  let rail = $('providerRail');

  if (!rail) {
    rail = document.createElement('div');
    rail.id = 'providerRail';
    rail.className = 'provider-rail';
    section.after(rail);
  }

  const providers = [
    'all',
    ...new Set(
      GAMES.map(game => game.provider)
    )
  ];

  rail.innerHTML = providers.map(provider => `
    <button
      data-provider="${escapeHtml(provider)}"
      onclick="setProviderRail(
        ${JSON.stringify(provider)}
      )">
      ${escapeHtml(
        provider === 'all'
          ? 'সব'
          : provider
      )}
    </button>
  `).join('');
}

function setProviderRail(provider) {
  document
    .querySelectorAll('#providerRail button')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.provider === provider
      );
    });

  const filter = $('gameFilter');

  if (filter) {
    filter.value =
      provider === 'all'
        ? 'all'
        : provider;
  }

  renderGames();
}

function renderGames() {
  const grid = $('gameGrid');

  if (!grid) return;

  if (!providerLoaded) {
    grid.innerHTML = `
      <div class="card">
        <h3>Provider games loading...</h3>
      </div>
    `;
    return;
  }

  const query =
    ($('gameSearch')?.value || '')
      .trim()
      .toLowerCase();

  const filter =
    $('gameFilter')?.value || 'all';

  const games = GAMES.filter(game => {

    const providerMatch =
      filter === 'all' ||
      game.provider === filter ||
      game.category === filter;

    const searchText =
      `${game.provider} ${game.name} ${game.category}`
        .toLowerCase();

    return providerMatch &&
           searchText.includes(query);
  });

  grid.innerHTML = games.length
    ? gameCards(games)
    : `
      <div class="card">
        <h3>কোনো গেম পাওয়া যায়নি</h3>
      </div>
    `;
}

function renderHomeGames() {
  const grid = $('homeGameGrid');

  if (!grid) return;

  if (!providerLoaded) {
    grid.innerHTML = `
      <div class="card">
        <h3>Provider games loading...</h3>
      </div>
    `;
    return;
  }

  grid.innerHTML =
    gameCards(GAMES.slice(0, 10));
}

function gameCards(games) {
  return games.map(game => {

    const image = game.image
      ? `
        <img
          src="${escapeHtml(game.image)}"
          alt="${escapeHtml(game.name)}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
      `
      : `<span>🎮</span>`;

    return `
      <article class="game-tile">

        <div class="tile-art game-provider">
          ${image}
        </div>

        <span class="provider-label">
          ${escapeHtml(game.provider)}
        </span>

        <h3>
          ${escapeHtml(game.name)}
        </h3>

        <p>
          ${escapeHtml(game.category)}
        </p>

        <button
          class="primary"
          onclick="launchGameById(
            ${JSON.stringify(game.provider)},
            ${JSON.stringify(game.id)},
            ${JSON.stringify(game.name)}
          )">
          এখন খেলুন
        </button>

      </article>
    `;
  }).join('');
}

async function launchGameById(
  provider,
  gameId,
  gameName
) {
  if (!accessToken) {
    openModal('login');
    toast('গেম চালাতে আগে লগইন করুন');
    return;
  }

  try {
    toast(`${gameName} চালু হচ্ছে...`);

    const r = await api(
      '/api/bt/v1/provider/launch',
      {
        method: 'POST',
        body: JSON.stringify({
          provider,
          gameId,
          returnUrl: location.href
        })
      }
    );

    const d = await r.json();

    if (!r.ok) {
      console.error(
        'Provider launch failed:',
        d
      );

      toast(
        d?.message ||
        'গেম চালু করা যায়নি'
      );

      return;
    }

    const url =
      d?.data?.url ||
      d?.data?.launchUrl ||
      d?.url ||
      d?.launchUrl;

    if (!url) {
      console.error(
        'Invalid provider response:',
        d
      );

      toast(
        'Provider launch URL পাওয়া যায়নি'
      );

      return;
    }

    location.href = url;

  } catch (error) {
    console.error(
      'Provider launch error:',
      error
    );

    toast(
      'Provider server-এর সাথে যোগাযোগ করা যাচ্ছে না'
    );
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

installUi();
updateNav();
validateSession();
health();

renderGames();
renderHomeGames();

syncProviderGames();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch(console.error);
}

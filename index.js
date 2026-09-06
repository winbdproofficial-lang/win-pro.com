import "../css/style.css";

const gameImages = [
  require("../assets/games/game-1.jpg"),
  require("../assets/games/game-2.jpg"),
];

const names = [
  "Super Ace","Super Elements 2","FlyX","Super Elements","Magic Ace",
  "Fortune Gems 3","Mighty Seven","Wild Bounty Showdown","Mighty Mania",
  "Fruit Party","Lucky Coins","Dragon Gold","Golden Treasure","Fancy Fruits",
  "Royal Ace","Fire Blaze","Ocean King","Fancy Sevens","Candy Win","Lucky Tiger",
  "Treasure Hunt","Hot Fruits","Fancy 7","Mega Fortune"
];
const vendors = ["AWCV2_JILI","JILI","JILI","JILI","JILI","JILI"];
const categories = ["গরম খেলা","প্রিয়","স্লট","লাইভ","স্পোর্টস","ই-স্পোর্টস","পোকার","ক্যাশ","লটারি"];

const games = names.map((name, i) => ({
  id: i + 1,
  name,
  vendor: vendors[i % vendors.length],
  category: categories[i % categories.length],
  image: gameImages[i % gameImages.length],
  hot: i < 8,
}));

const categoriesEl = document.getElementById("categories");
const gridEl = document.getElementById("game-grid");
const searchEl = document.getElementById("game-search");
const titleEl = document.getElementById("section-title");
const countEl = document.getElementById("result-count");
const modal = document.getElementById("demo-modal");
const modalTitle = document.getElementById("modal-title");

let selectedCategory = categories[0];

function renderCategories() {
  categoriesEl.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = `cat ${category === selectedCategory ? "active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      selectedCategory = category;
      renderCategories();
      renderGames();
    });
    categoriesEl.appendChild(button);
  });
}

function openDemo(game) {
  modalTitle.textContent = `${game.name} — Demo Mode`;
  modal.hidden = false;
}

function closeDemo() {
  modal.hidden = true;
}

function renderGames() {
  const term = searchEl.value.trim().toLowerCase();
  const filtered = games.filter((game) => {
    const categoryMatch =
      selectedCategory === "গরম খেলা" || game.category === selectedCategory;
    const searchMatch =
      !term ||
      game.name.toLowerCase().includes(term) ||
      game.vendor.toLowerCase().includes(term);
    return categoryMatch && searchMatch;
  });

  titleEl.textContent =
    selectedCategory === "গরম খেলা" ? "🔥 গরম খেলা" : selectedCategory;
  countEl.textContent = `${filtered.length} games`;
  gridEl.innerHTML = "";

  if (!filtered.length) {
    gridEl.innerHTML =
      '<div class="empty">কোনো game পাওয়া যায়নি। অন্য category বা search চেষ্টা করুন।</div>';
    return;
  }

  filtered.forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-image">
        <img src="${game.image}" alt="${game.name}" loading="lazy" />
        ${game.hot ? '<span class="badge">HOT</span>' : ""}
        <button class="favorite" type="button" aria-label="Favorite">♡</button>
      </div>
      <div class="game-body">
        <div class="game-name">${game.name}</div>
        <div class="game-vendor">${game.vendor}</div>
        <button class="demo-btn" type="button">DEMO PLAY</button>
      </div>
    `;
    card.addEventListener("click", () => openDemo(game));
    gridEl.appendChild(card);
  });
}

searchEl.addEventListener("input", renderGames);
document.getElementById("modal-close").addEventListener("click", closeDemo);
document.getElementById("modal-ok").addEventListener("click", closeDemo);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeDemo();
});

const sideMenu = document.getElementById("side-menu");
["🔥 গরম খেলা","👥 বন্ধুদের আমন্ত্রণ","🎁 অফার","🎰 স্লট","⚙ পুরস্কার কেন্দ্র","🎯 মিশন","🎮 ই-স্পোর্টস","💎 তিয়াজাপ"].forEach((label) => {
  const button = document.createElement("button");
  button.textContent = label;
  sideMenu.appendChild(button);
});

renderCategories();
renderGames();

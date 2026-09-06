'use strict';

/**
 * Local catalogue shown when no provider credentials/catalogue are available.
 * These entries are presentation-only placeholders. Once a real provider
 * returns games, providerRoutes.js automatically returns the live catalogue.
 */
const names = [
  ['Super Ace', 'HOT GAME', 'PGSoft', 'SUPER_ACE', 'Slots', 1],
  ['Wild Athena Rising 2048', 'HOT GAME', 'PGSoft', 'WILD_ATHENA_2048', 'Slots', 2],
  ['FlyX', 'HOT GAME', 'JILI', 'FLYX', 'Arcade', 3],
  ['Super Elements', 'HOT GAME', 'JILI', 'SUPER_ELEMENTS', 'Slots', 4],
  ['Magic Ace Wild Lock', 'HOT GAME', 'JILI', 'MAGIC_ACE_WILD_LOCK', 'Slots', 5],
  ['Aviator', 'Crash', 'SPRIBE', 'AVIATOR', 'Crash', 6],
  ['Wild Bounty Showdown', 'Slots', 'JILI', 'WILD_BOUNTY_SHOWDOWN', 'Slots', 7],
  ['Pirate Legends', 'Slots', 'JILI', 'PIRATE_LEGENDS', 'Slots', 8],
  ['Mighty Sevens', 'Slots', 'PGSoft', 'MIGHTY_SEVENS', 'Slots', 9],
  ['Fortune Gems 3', 'Slots', 'PGSoft', 'FORTUNE_GEMS_3', 'Slots', 10],
  ['Crystal Cash', 'Slots', 'JILI', 'CRYSTAL_CASH', 'Slots', 11],
  ['Dragon Treasure', 'Slots', 'PGSoft', 'DRAGON_TREASURE', 'Slots', 12],
  ['Jungle Coins', 'Slots', 'JILI', 'JUNGLE_COINS', 'Slots', 13],
  ['Neon Roulette', 'Live Casino', 'EVOLUTION', 'NEON_ROULETTE', 'Live Casino', 14],
  ['Fishing War', 'Fishing', 'JILI', 'FISHING_WAR', 'Fishing', 15],
  ['Goal Stars', 'Sports', 'SPORTS', 'GOAL_STARS', 'Sports', 16],
  ['Lucky Tiger', 'HOT GAME', 'JILI', 'LUCKY_TIGER', 'Slots', 17],
  ['Fancy Sevens', 'HOT GAME', 'PGSoft', 'FANCY_SEVENS', 'Slots', 18],
];

const localGameCatalog = names.map(([name, category, vendorCode, gameCode, gameTypeId, imageNo]) => ({
  name,
  category,
  vendorCode,
  vendorId: null,
  gameCode,
  gameTypeId,
  extraData: null,
  hasTrialPlay: false,
  image: `/games/game-${imageNo}.jpg`,
  fallback: true,
  source: 'local-catalog',
}));

module.exports = localGameCatalog;

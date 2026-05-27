/**
 * src/constants/achievements.js
 *
 * Achievement definitions with unlock conditions and rewards.
 */

export const ACHIEVEMENTS = [
  // Getting Started
  {
    id: 'first_clear',
    name: 'First Blood',
    description: 'Clear your first line',
    icon: '🎯',
    category: 'beginner',
    condition: (stats) => stats.totalClears >= 1,
    reward: { powerUp: 'BOMB', count: 1 },
  },
  {
    id: 'first_win',
    name: 'Victory!',
    description: 'Complete your first level',
    icon: '🏆',
    category: 'beginner',
    condition: (stats, level) => level >= 1,
    reward: { powerUp: 'TIME_FREEZE', count: 1 },
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    category: 'progression',
    condition: (stats, level) => level >= 5,
    reward: { powerUp: 'UNDO', count: 1 },
  },
  {
    id: 'level_10',
    name: 'Dedicated Player',
    description: 'Reach level 10',
    icon: '🌟',
    category: 'progression',
    condition: (stats, level) => level >= 10,
    reward: { powerUp: 'BOMB', count: 2 },
  },
  {
    id: 'level_18',
    name: 'Master',
    description: 'Complete all handcrafted levels',
    icon: '👑',
    category: 'progression',
    condition: (stats, level) => level >= 18,
    reward: { powerUp: 'COLOR_CLEAR', count: 1 },
  },

  // Combo Masters
  {
    id: 'combo_2',
    name: 'Double Trouble',
    description: 'Achieve a 2x combo',
    icon: '🔥',
    category: 'combo',
    condition: (stats) => stats.bestCombo >= 2,
    reward: { powerUp: 'BOMB', count: 1 },
  },
  {
    id: 'combo_3',
    name: 'Hat Trick',
    description: 'Achieve a 3x combo',
    icon: '💥',
    category: 'combo',
    condition: (stats) => stats.bestCombo >= 3,
    reward: { powerUp: 'TIME_FREEZE', count: 1 },
  },
  {
    id: 'combo_4',
    name: 'Sugar Rush',
    description: 'Achieve a 4x combo',
    icon: '🍭',
    category: 'combo',
    condition: (stats) => stats.bestCombo >= 4,
    reward: { powerUp: 'BOMB', count: 2 },
  },

  // Score Milestones
  {
    id: 'score_5000',
    name: 'Getting Serious',
    description: 'Score 5,000 points in a single game',
    icon: '💎',
    category: 'score',
    condition: (stats) => stats.bestScore >= 5000,
    reward: { powerUp: 'UNDO', count: 1 },
  },
  {
    id: 'score_10000',
    name: 'High Scorer',
    description: 'Score 10,000 points in a single game',
    icon: '💠',
    category: 'score',
    condition: (stats) => stats.bestScore >= 10000,
    reward: { powerUp: 'BOMB', count: 2 },
  },
  {
    id: 'score_25000',
    name: 'Legend',
    description: 'Score 25,000 points in a single game',
    icon: '🏅',
    category: 'score',
    condition: (stats) => stats.bestScore >= 25000,
    reward: { powerUp: 'COLOR_CLEAR', count: 1 },
  },

  // Dedication
  {
    id: 'games_10',
    name: 'Getting Hooked',
    description: 'Play 10 games',
    icon: '🎮',
    category: 'dedication',
    condition: (stats) => stats.totalGames >= 10,
    reward: { powerUp: 'TIME_FREEZE', count: 1 },
  },
  {
    id: 'games_50',
    name: 'Addicted',
    description: 'Play 50 games',
    icon: '🎲',
    category: 'dedication',
    condition: (stats) => stats.totalGames >= 50,
    reward: { powerUp: 'BOMB', count: 3 },
  },
  {
    id: 'games_100',
    name: 'Centurion',
    description: 'Play 100 games',
    icon: '💯',
    category: 'dedication',
    condition: (stats) => stats.totalGames >= 100,
    reward: { powerUp: 'COLOR_CLEAR', count: 2 },
  },

  // Streaks
  {
    id: 'streak_3',
    name: 'On Fire',
    description: '3-day login streak',
    icon: '🔥',
    category: 'streak',
    condition: (stats, level, streak) => streak >= 3,
    reward: { powerUp: 'UNDO', count: 1 },
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: '7-day login streak',
    icon: '⚡',
    category: 'streak',
    condition: (stats, level, streak) => streak >= 7,
    reward: { powerUp: 'BOMB', count: 2 },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day login streak',
    icon: '🌈',
    category: 'streak',
    condition: (stats, level, streak) => streak >= 30,
    reward: { powerUp: 'COLOR_CLEAR', count: 3 },
  },

  // Clears
  {
    id: 'clears_50',
    name: 'Line Crusher',
    description: 'Clear 50 lines total',
    icon: '💫',
    category: 'clears',
    condition: (stats) => stats.totalClears >= 50,
    reward: { powerUp: 'TIME_FREEZE', count: 2 },
  },
  {
    id: 'clears_200',
    name: 'Clear Master',
    description: 'Clear 200 lines total',
    icon: '✨',
    category: 'clears',
    condition: (stats) => stats.totalClears >= 200,
    reward: { powerUp: 'BOMB', count: 3 },
  },
];

export const ACHIEVEMENT_CATEGORIES = {
  beginner: 'Getting Started',
  progression: 'Progression',
  combo: 'Combo Master',
  score: 'High Scores',
  dedication: 'Dedication',
  streak: 'Streaks',
  clears: 'Line Clears',
};

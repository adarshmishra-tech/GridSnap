/**
 * src/constants/powerUps.js
 *
 * Power-up definitions and configuration.
 * Each power-up has: id, name, icon, description, maxStack, earnRate
 */

export const POWER_UP_TYPES = {
  BOMB: 'BOMB',
  TIME_FREEZE: 'TIME_FREEZE',
  UNDO: 'UNDO',
  COLOR_CLEAR: 'COLOR_CLEAR',
};

export const POWER_UPS = {
  [POWER_UP_TYPES.BOMB]: {
    id: POWER_UP_TYPES.BOMB,
    name: 'Bomb',
    icon: '💣',
    description: 'Clears a 3×3 area on placement',
    maxStack: 3,
    earnRate: 0.15, // 15% chance to earn after a clear
    color: '#FF4444',
  },
  [POWER_UP_TYPES.TIME_FREEZE]: {
    id: POWER_UP_TYPES.TIME_FREEZE,
    name: 'Time Freeze',
    icon: '❄️',
    description: 'Pauses timer for 5 seconds',
    maxStack: 2,
    earnRate: 0.10, // 10% chance
    color: '#4488FF',
  },
  [POWER_UP_TYPES.UNDO]: {
    id: POWER_UP_TYPES.UNDO,
    name: 'Undo',
    icon: '↩️',
    description: 'Reverse your last move',
    maxStack: 2,
    earnRate: 0.12, // 12% chance
    color: '#FFAA00',
  },
  [POWER_UP_TYPES.COLOR_CLEAR]: {
    id: POWER_UP_TYPES.COLOR_CLEAR,
    name: 'Color Clear',
    icon: '🎨',
    description: 'Removes all cells of one color',
    maxStack: 1,
    earnRate: 0.05, // 5% chance (rare)
    color: '#FF44FF',
  },
};

// Power-up earn configuration
export const POWER_UP_EARN_CONFIG = {
  clearLines: 0.15,      // Base chance per line clear
  combo: 0.10,           // Additional chance per combo level
  levelComplete: 1.0,    // Guaranteed 1 power-up on level complete
  milestone: 0.25,       // Chance at score milestones (every 5000 pts)
};

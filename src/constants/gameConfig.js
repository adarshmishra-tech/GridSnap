/**
 * src/constants/gameConfig.js
 *
 * Central configuration — imported by App.js, useGameEngine, useAnimations,
 * GameBoard, and DraggableBlock.
 *
 * CELL_SIZE: size of each grid cell in logical pixels.
 * Scale it slightly for large phones/tablets via the same SCALE factor used
 * in App.js so the board never overflows on any device.
 */

import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Responsive cell size: broader board with stronger visual presence.
// Also considers screen height to prevent overlapping with banner ads on shorter devices.
const baseCellSize = Math.min(Math.round((SW / 390) * 32), 36);
const heightScale = SH < 720 ? (SH / 720) : 1;
export const CELL_SIZE = Math.floor(baseCellSize * heightScale);

// Board is always 10×10
export const GRID_SIZE = 10;

// ─── Colour palette ───────────────────────────────────────────────────────────
export const COLORS = {
  // UI accent (progress bar, goal text, win colour)
  accent: '#2CF6C8',

  // Cell colours — one per shape family
  // Using vivid but accessible colours that look great on dark background
  red:    '#FF4757',
  orange: '#FF8C00',
  yellow: '#FFD93D',
  green:  '#6BCB77',
  teal:   '#2CF6C8',
  blue:   '#3A86FF',
  purple: '#9B59B6',
  pink:   '#FF6B9D',
  cyan:   '#00D2FF',
  lime:   '#B8E986',

  // Grid UI
  cellBg:   '#233046',   // empty cell background (brighter for visibility)
  cellBorder:'#4C658E',  // empty cell border (stronger grid lines)
  gridBg:   '#0D1420',   // board background (slightly darker to pop cells)
  flash:    '#FFFFFF',   // cleared-line flash colour
};

// Ordered palette used by shapes to cycle through colours predictably
export const SHAPE_COLORS = [
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
  COLORS.orange,
];
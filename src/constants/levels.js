// ─── levels.js — full level configuration engine ─────────────────────────────
//
// Each level can define:
//   targetScore   — points needed to advance
//   timeLimit     — seconds on the clock (default 120)
//   moveLimit     — max pieces placed before game over (null = unlimited)
//   initialGrid   — pre-filled obstacle pattern (null = empty)
//   modifiers     — special rules active this level (see MODIFIERS below)
//   description   — shown on level-start card
//   tip           — one-line strategy hint shown below description

// ─── Obstacle grid builder helpers ───────────────────────────────────────────

const E = null;   // empty cell shorthand
const X = '#2A3A56'; // obstacle cell color (cleaner, premium board contrast)

/** Build a full 10×10 grid from a sparse list of [r, c] occupied coords */
const sparseGrid = (coords, color = X) => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  coords.forEach(([r, c]) => { g[r][c] = color; });
  return g;
};

/** Fill an entire row */
const fillRow = (g, r, color = X) => { g[r] = g[r].map(() => color); return g; };

/** Fill an entire column */
const fillCol = (g, c, color = X) => { g.forEach(row => { row[c] = color; }); return g; };

/** Fill a rectangular block */
const fillRect = (g, r1, c1, r2, c2, color = X) => {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) g[r][c] = color;
  return g;
};

/** Clone a base grid */
const clone = g => g.map(row => [...row]);

// ─── Pre-built obstacle patterns ─────────────────────────────────────────────

const EMPTY = null; // no pre-fill

// Horizontal walls across middle rows
const WALLS_H = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  for (let c = 0; c < 8; c++) g[3][c] = X;
  for (let c = 2; c < 10; c++) g[6][c] = X;
  return g;
})();

// Vertical pillars
const PILLARS = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  [2, 5, 8].forEach(c => {
    for (let r = 1; r < 9; r += 2) g[r][c] = X;
  });
  return g;
})();

// Checkerboard center
const CHECKER = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  for (let r = 3; r <= 6; r++)
    for (let c = 3; c <= 6; c++)
      if ((r + c) % 2 === 0) g[r][c] = X;
  return g;
})();

// Cross / plus shape in the center
const CROSS = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  for (let i = 0; i < 10; i++) { g[4][i] = X; g[i][4] = X; }
  // Leave a gap in the middle so it's passable
  g[4][4] = E;
  return g;
})();

// Ring / frame
const RING = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  for (let i = 2; i <= 7; i++) {
    g[2][i] = X; g[7][i] = X;
    g[i][2] = X; g[i][7] = X;
  }
  return g;
})();

// Diagonal slash
const DIAGONAL = (() => {
  const g = Array.from({ length: 10 }, () => Array(10).fill(E));
  for (let i = 0; i < 10; i++) g[i][i] = X;
  return g;
})();

// Two corner blocks
const CORNERS = sparseGrid([
  [0,0],[0,1],[1,0],
  [0,8],[0,9],[1,9],
  [8,0],[9,0],[9,1],
  [8,9],[9,8],[9,9],
]);

// Dense random-looking scatter (seeded for reproducibility)
const SCATTER = sparseGrid([
  [1,2],[1,7],[2,4],[2,9],
  [3,1],[3,6],[4,3],[4,8],
  [5,0],[5,5],[6,2],[6,7],
  [7,4],[7,9],[8,1],[8,6],
  [9,3],[9,8],
]);

// ─── Modifiers ────────────────────────────────────────────────────────────────
// Modifiers are string keys read by App.js to activate special rules.
// Define what each means here so App.js can switch on them.

export const MODIFIER = {
  DOUBLE_POINTS:  'DOUBLE_POINTS',   // all score × 2
  SPEED_DECAY:    'SPEED_DECAY',     // timer ticks 1.5× faster
  FROZEN_TRAY:    'FROZEN_TRAY',     // tray doesn't refresh mid-batch
  BOMB_CELLS:     'BOMB_CELLS',      // random cells become bombs (clear row on touch)
  MIRROR:         'MIRROR',          // every piece is mirrored before display
  TINY_ONLY:      'TINY_ONLY',       // only 1-3 cell shapes offered
  BIG_ONLY:       'BIG_ONLY',        // only 4+ cell shapes offered
  SCORE_DECAY:    'SCORE_DECAY',     // score drains 1pt/sec
};

// ─── Level definitions ────────────────────────────────────────────────────────

export const LEVELS = [
  // ── Tutorial band (1-3) ────────────────────────────────────────────────────
  {
    id:          1,
    targetScore: 650,
    timeLimit:   90,
    moveLimit:   null,
    initialGrid: EMPTY,
    modifiers:   [],
    minClears:   2,
    description: 'Welcome to GridSnap!',
    tip:         'Fill a full row or column to clear it.',
  },
  {
    id:          2,
    targetScore: 1100,
    timeLimit:   85,
    moveLimit:   null,
    initialGrid: EMPTY,
    modifiers:   [],
    minClears:   3,
    description: 'Pick up the pace.',
    tip:         'Plan 2 pieces ahead — combos score ×1.5.',
  },
  {
    id:          3,
    targetScore: 1650,
    timeLimit:   80,
    moveLimit:   null,
    initialGrid: CORNERS,
    modifiers:   [],
    minClears:   4,
    description: 'Corners blocked!',
    tip:         'Work toward the middle — corners are locked.',
  },

  // ── Rising difficulty (4-7) ────────────────────────────────────────────────
  {
    id:          4,
    targetScore: 2400,
    timeLimit:   75,
    moveLimit:   null,
    initialGrid: WALLS_H,
    modifiers:   [],
    minClears:   5,
    description: 'Wall breaker.',
    tip:         'Clear the walls to open up the board.',
  },
  {
    id:          5,
    targetScore: 3200,
    timeLimit:   70,
    moveLimit:   null,
    initialGrid: PILLARS,
    modifiers:   [],
    minClears:   6,
    description: 'Navigate the pillars.',
    tip:         'Thin shapes fit the gaps — use vertical I-blocks.',
  },
  {
    id:          6,
    targetScore: 4200,
    timeLimit:   65,
    moveLimit:   35,
    initialGrid: EMPTY,
    modifiers:   [],
    minClears:   7,
    description: '35 moves only. Make them count.',
    tip:         'Every placement matters — go for multi-clears.',
  },
  {
    id:          7,
    targetScore: 5200,
    timeLimit:   60,
    moveLimit:   null,
    initialGrid: CHECKER,
    modifiers:   [],
    minClears:   8,
    description: 'The checkerboard.',
    tip:         'Fill the gaps between obstacles first.',
  },

  // ── Modifiers introduced (8-12) ───────────────────────────────────────────
  {
    id:          8,
    targetScore: 5500,
    timeLimit:   95,   // Slightly more forgiving
    moveLimit:   null,
    initialGrid: RING,
    modifiers:   [MODIFIER.DOUBLE_POINTS],
    minClears:   8,
    description: 'Double score — trapped inside the ring.',
    tip:         'Clear the ring walls for massive combo points.',
  },
  {
    id:          9,
    targetScore: 6000,
    timeLimit:   85,   // More forgiving with speed decay
    moveLimit:   null,
    initialGrid: CROSS,
    modifiers:   [MODIFIER.SPEED_DECAY],
    minClears:   9,
    description: 'The cross. Clock ticks faster.',
    tip:         'Work one quadrant at a time.',
  },
  {
    id:          10,
    targetScore: 7000,
    timeLimit:   95,   // More time for double points
    moveLimit:   30,   // Increased from 25
    initialGrid: DIAGONAL,
    modifiers:   [MODIFIER.DOUBLE_POINTS],
    minClears:   10,
    description: 'Diagonal slash — 30 moves, double score.',
    tip:         'Clear along the diagonal for chain combos.',
  },
  {
    id:          11,
    targetScore: 8000,
    timeLimit:   85,   // More forgiving for tiny pieces
    moveLimit:   null,
    initialGrid: SCATTER,
    modifiers:   [MODIFIER.TINY_ONLY],
    minClears:   11,
    description: 'Small pieces, scattered chaos.',
    tip:         'Tiny pieces = more precision. Fill gaps methodically.',
  },
  {
    id:          12,
    targetScore: 9500,
    timeLimit:   80,   // Balanced for big pieces
    moveLimit:   null,
    initialGrid: EMPTY,
    modifiers:   [MODIFIER.BIG_ONLY, MODIFIER.DOUBLE_POINTS],
    minClears:   12,
    description: 'Big blocks only — but double points!',
    tip:         'Large shapes score huge on clears. Be patient.',
  },

  // ── Expert gauntlet (13-18) ───────────────────────────────────────────────
  {
    id:          13,
    targetScore: 11000,
    timeLimit:   75,   // Slightly more forgiving
    moveLimit:   null,
    initialGrid: WALLS_H,
    modifiers:   [MODIFIER.SPEED_DECAY],
    minClears:   13,
    description: 'Walls + speed decay. Survive.',
    tip:         'Prioritise row clears — they free the most space.',
  },
  {
    id:          14,
    targetScore: 13000,
    timeLimit:   80,   // More forgiving with score decay
    moveLimit:   25,   // Increased from 20
    initialGrid: RING,
    modifiers:   [MODIFIER.DOUBLE_POINTS, MODIFIER.SCORE_DECAY],
    minClears:   14,
    description: 'Score decays. 25 moves. Double points.',
    tip:         'Score fast — every second you wait costs points.',
  },
  {
    id:          15,
    targetScore: 15000,
    timeLimit:   70,   // Balanced for tiny pieces
    moveLimit:   null,
    initialGrid: PILLARS,
    modifiers:   [MODIFIER.SPEED_DECAY, MODIFIER.TINY_ONLY],
    minClears:   15,
    description: 'Pillars + tiny pieces + fast clock.',
    tip:         'Inch pieces into the gaps. Precision over speed.',
  },
  {
    id:          16,
    targetScore: 18000,
    timeLimit:   75,   // More forgiving for big shapes
    moveLimit:   null,
    initialGrid: CROSS,
    modifiers:   [MODIFIER.DOUBLE_POINTS, MODIFIER.BIG_ONLY],
    minClears:   16,
    description: 'Big shapes, cross board, double score.',
    tip:         'Big shapes can straddle the cross arms — use that.',
  },
  {
    id:          17,
    targetScore: 22000,
    timeLimit:   65,   // Slightly more forgiving
    moveLimit:   null,
    initialGrid: CHECKER,
    modifiers:   [MODIFIER.SPEED_DECAY, MODIFIER.SCORE_DECAY],
    minClears:   17,
    description: 'Everything is fighting you.',
    tip:         'Chain clears are your only lifeline.',
  },
  {
    id:          18,
    targetScore: 28000,
    timeLimit:   65,   // More forgiving for final level
    moveLimit:   20,   // Increased from 15
    initialGrid: SCATTER,
    modifiers:   [MODIFIER.DOUBLE_POINTS, MODIFIER.SPEED_DECAY, MODIFIER.BIG_ONLY],
    minClears:   18,
    description: 'The final test. 20 moves. Prove it.',
    tip:         'Each move must clear at least one line. No wasted drops.',
  },
];

// ─── Dynamic level generator for levels beyond 18 ────────────────────────────
// Returns a procedurally scaled level so the game never ends.

const OBSTACLE_POOL = [EMPTY, CORNERS, WALLS_H, PILLARS, CHECKER, CROSS, RING, DIAGONAL, SCATTER];
const MODIFIER_POOL = [
  [],
  [MODIFIER.DOUBLE_POINTS],
  [MODIFIER.SPEED_DECAY],
  [MODIFIER.SCORE_DECAY],
  [MODIFIER.DOUBLE_POINTS, MODIFIER.SPEED_DECAY],
  [MODIFIER.DOUBLE_POINTS, MODIFIER.SCORE_DECAY],
  [MODIFIER.BIG_ONLY, MODIFIER.DOUBLE_POINTS],
  [MODIFIER.TINY_ONLY, MODIFIER.SPEED_DECAY],
];

export const generateLevel = (id) => {
  if (id <= LEVELS.length) return LEVELS[id - 1];

  const excess = id - LEVELS.length;
  const last = LEVELS[LEVELS.length - 1];

  // Smoother progression for procedural levels
  const targetScore = Math.round(
    last.targetScore + excess * 4200 + Math.pow(excess, 1.2) * 200  // Reduced scaling
  );
  const timeLimit = Math.max(
    45,  // Higher minimum time
    Math.round(last.timeLimit - excess * 1.2 - Math.sqrt(excess) * 0.8)  // Gentler reduction
  );
  const moveLimit = excess >= 8 ? Math.max(12, 25 - Math.floor((excess - 8) * 0.4)) : null;  // More generous

  const obstacleIdx = (id - 1) % OBSTACLE_POOL.length;
  const modIdx      = (id - 1) % MODIFIER_POOL.length;
  const extraMods = excess % 6 === 0 ? [MODIFIER.SCORE_DECAY] : [];  // Less frequent score decay

  return {
    id,
    targetScore,
    timeLimit,
    moveLimit,
    initialGrid: OBSTACLE_POOL[obstacleIdx],
    modifiers:   [...MODIFIER_POOL[modIdx], ...extraMods],
    minClears:   Math.min(25, 18 + excess),  // Progressive clear requirements
    description: `Level ${id}`,
    tip:         'Stay calm. Chain clears. Keep climbing.',
  };
};

// ─── Convenience exports ──────────────────────────────────────────────────────

/** Total number of hand-crafted levels */
export const LEVEL_COUNT = LEVELS.length;

/** Get level config by id — falls back to procedural generation */
export const getLevel = (id) => generateLevel(id);

/** True if id has a hand-crafted definition */
export const isHandcraftedLevel = (id) => id >= 1 && id <= LEVEL_COUNT;
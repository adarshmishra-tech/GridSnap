/**
 * src/constants/shapes.js
 *
 * Shape library and smart shape selection.
 *
 * Shape object: { id, color, layout: [[dr, dc], ...] }
 *   - id:     unique string (used as React key and for filtering placed pieces)
 *   - color:  hex string from SHAPE_COLORS
 *   - layout: array of [row-offset, col-offset] from the top-left of the bounding box
 *
 * getSmartShapes(grid, level):
 *   Returns a batch of 3 shapes; template weights blend easy→hard with `level`
 *   so difficulty rises smoothly each level. Ensures a placeable first piece.
 */

import { SHAPE_COLORS } from './gameConfig';
import { canPlaceShape } from '../utils/gridLogic';

// ─── Shape templates ──────────────────────────────────────────────────────────
// Each entry: { name, layout: [[dr, dc], ...], weight: { easy, medium, hard } }
// Higher weight = more likely to appear at that difficulty.

const SHAPE_TEMPLATES = [
  // ── 1-cell ──
  {
    name: 'dot',
    layout: [[0, 0]],
    weight: { easy: 5, medium: 2, hard: 0 },
  },

  // ── 2-cell ──
  {
    name: 'domino_h',
    layout: [[0, 0], [0, 1]],
    weight: { easy: 6, medium: 3, hard: 1 },
  },
  {
    name: 'domino_v',
    layout: [[0, 0], [1, 0]],
    weight: { easy: 6, medium: 3, hard: 1 },
  },

  // ── 3-cell ──
  {
    name: 'trio_h',
    layout: [[0, 0], [0, 1], [0, 2]],
    weight: { easy: 7, medium: 5, hard: 2 },
  },
  {
    name: 'trio_v',
    layout: [[0, 0], [1, 0], [2, 0]],
    weight: { easy: 7, medium: 5, hard: 2 },
  },
  {
    name: 'trio_L',
    layout: [[0, 0], [1, 0], [1, 1]],
    weight: { easy: 5, medium: 5, hard: 3 },
  },
  {
    name: 'trio_J',
    layout: [[0, 1], [1, 1], [1, 0]],
    weight: { easy: 5, medium: 5, hard: 3 },
  },

  // ── 2×2 square ──
  {
    name: 'sq2',
    layout: [[0, 0], [0, 1], [1, 0], [1, 1]],
    weight: { easy: 8, medium: 7, hard: 5 },
  },

  // ── 4-cell line ──
  {
    name: 'line4_h',
    layout: [[0, 0], [0, 1], [0, 2], [0, 3]],
    weight: { easy: 4, medium: 6, hard: 7 },
  },
  {
    name: 'line4_v',
    layout: [[0, 0], [1, 0], [2, 0], [3, 0]],
    weight: { easy: 4, medium: 6, hard: 7 },
  },

  // ── L shapes ──
  {
    name: 'L',
    layout: [[0, 0], [1, 0], [2, 0], [2, 1]],
    weight: { easy: 2, medium: 6, hard: 8 },
  },
  {
    name: 'L_mirror',
    layout: [[0, 1], [1, 1], [2, 1], [2, 0]],
    weight: { easy: 2, medium: 6, hard: 8 },
  },
  {
    name: 'L_rot90',
    layout: [[0, 0], [0, 1], [0, 2], [1, 0]],
    weight: { easy: 2, medium: 6, hard: 8 },
  },
  {
    name: 'L_rot270',
    layout: [[0, 0], [0, 1], [0, 2], [1, 2]],
    weight: { easy: 2, medium: 6, hard: 8 },
  },

  // ── T shape ──
  {
    name: 'T',
    layout: [[0, 0], [0, 1], [0, 2], [1, 1]],
    weight: { easy: 1, medium: 5, hard: 8 },
  },
  {
    name: 'T_rot90',
    layout: [[0, 0], [1, 0], [2, 0], [1, 1]],
    weight: { easy: 1, medium: 5, hard: 8 },
  },
  {
    name: 'T_rot180',
    layout: [[0, 1], [1, 0], [1, 1], [1, 2]],
    weight: { easy: 1, medium: 5, hard: 8 },
  },
  {
    name: 'T_rot270',
    layout: [[0, 0], [0, 1], [1, 0], [2, 0]],
    weight: { easy: 1, medium: 5, hard: 8 },
  },

  // ── S / Z shapes ──
  {
    name: 'S',
    layout: [[0, 1], [0, 2], [1, 0], [1, 1]],
    weight: { easy: 0, medium: 4, hard: 7 },
  },
  {
    name: 'S_v',
    layout: [[0, 0], [1, 0], [1, 1], [2, 1]],
    weight: { easy: 0, medium: 4, hard: 7 },
  },
  {
    name: 'Z',
    layout: [[0, 0], [0, 1], [1, 1], [1, 2]],
    weight: { easy: 0, medium: 4, hard: 7 },
  },
  {
    name: 'Z_v',
    layout: [[0, 1], [1, 0], [1, 1], [2, 0]],
    weight: { easy: 0, medium: 4, hard: 7 },
  },

  // ── 3×3 square ──
  {
    name: 'sq3',
    layout: [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
    weight: { easy: 0, medium: 2, hard: 5 },
  },

  // ── 5-cell line ──
  {
    name: 'line5_h',
    layout: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    weight: { easy: 0, medium: 2, hard: 6 },
  },
  {
    name: 'line5_v',
    layout: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    weight: { easy: 0, medium: 2, hard: 6 },
  },

  // ── Cross / plus ──
  {
    name: 'plus',
    layout: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
    weight: { easy: 0, medium: 3, hard: 6 },
  },

  // ── Corner ──
  {
    name: 'corner_br',
    layout: [[0, 0], [0, 1], [1, 0]],
    weight: { easy: 5, medium: 4, hard: 2 },
  },
  {
    name: 'corner_bl',
    layout: [[0, 0], [0, 1], [1, 1]],
    weight: { easy: 5, medium: 4, hard: 2 },
  },
  {
    name: 'corner_tr',
    layout: [[0, 0], [1, 0], [1, 1]],
    weight: { easy: 5, medium: 4, hard: 2 },
  },
  {
    name: 'corner_tl',
    layout: [[0, 1], [1, 0], [1, 1]],
    weight: { easy: 5, medium: 4, hard: 2 },
  },

  // ── 2×3 rectangle ──
  {
    name: 'rect2x3',
    layout: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
    weight: { easy: 0, medium: 3, hard: 5 },
  },
  {
    name: 'rect3x2',
    layout: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]],
    weight: { easy: 0, medium: 3, hard: 5 },
  },
];

// ─── Weighted random pick ─────────────────────────────────────────────────────
let _colorIndex = 0;

function weightedPick(pool) {
  const total = pool.reduce((s, t) => s + t.w, 0);
  if (total === 0) return pool[Math.floor(Math.random() * pool.length)].t;
  let rand = Math.random() * total;
  for (const { t, w } of pool) {
    rand -= w;
    if (rand <= 0) return t;
  }
  return pool[pool.length - 1].t;
}

// ─── Board density calculation ───────────────────────────────────────────────
function getBoardDensity(grid) {
  let occupied = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (grid[r][c]) occupied++;
    }
  }
  return occupied / 100; // 10x10 grid
}

/** Per-level curve: level 1 → easy weights; past ~50 → approaches hard weights. */
function blendedWeight(template, level, difficultyOverride = null) {
  const L = Math.max(1, level);
  const t = Math.min(1, (L - 1) / 50);
  
  if (difficultyOverride) {
    const weights = template.weight[difficultyOverride];
    return weights !== undefined ? weights : template.weight.easy;
  }
  
  return (1 - t) * template.weight.easy + t * template.weight.hard;
}

function nextColor() {
  const c = SHAPE_COLORS[_colorIndex % SHAPE_COLORS.length];
  _colorIndex++;
  return c;
}

function templateToShape(template) {
  return {
    id:     `${template.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name:   template.name,
    color:  nextColor(),
    layout: template.layout,
  };
}

function templateCanFit(grid, template) {
  const probe = { layout: template.layout };
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (canPlaceShape(grid, probe, r, c)) return true;
    }
  }
  return false;
}

function templateCanClearImmediately(grid, template) {
  const probe = { layout: template.layout };

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!canPlaceShape(grid, probe, r, c)) continue;

      // Track only touched rows/cols for fast clear checks.
      const touchedRows = new Set();
      const touchedCols = new Set();
      const placedKeys = new Set();

      template.layout.forEach(([dr, dc]) => {
        const rr = r + dr;
        const cc = c + dc;
        touchedRows.add(rr);
        touchedCols.add(cc);
        placedKeys.add(`${rr}_${cc}`);
      });

      for (const rr of touchedRows) {
        let full = true;
        for (let cc = 0; cc < 10; cc++) {
          if (!grid[rr][cc] && !placedKeys.has(`${rr}_${cc}`)) {
            full = false;
            break;
          }
        }
        if (full) return true;
      }

      for (const cc of touchedCols) {
        let full = true;
        for (let rr = 0; rr < 10; rr++) {
          if (!grid[rr][cc] && !placedKeys.has(`${rr}_${cc}`)) {
            full = false;
            break;
          }
        }
        if (full) return true;
      }
    }
  }
  return false;
}

function getTemplateBestImmediateClear(grid, template) {
  const probe = { layout: template.layout };
  let best = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!canPlaceShape(grid, probe, r, c)) continue;

      const touchedRows = new Set();
      const touchedCols = new Set();
      const placedKeys = new Set();

      template.layout.forEach(([dr, dc]) => {
        const rr = r + dr;
        const cc = c + dc;
        touchedRows.add(rr);
        touchedCols.add(cc);
        placedKeys.add(`${rr}_${cc}`);
      });

      let clears = 0;
      for (const rr of touchedRows) {
        let full = true;
        for (let cc = 0; cc < 10; cc++) {
          if (!grid[rr][cc] && !placedKeys.has(`${rr}_${cc}`)) {
            full = false;
            break;
          }
        }
        if (full) clears++;
      }

      for (const cc of touchedCols) {
        let full = true;
        for (let rr = 0; rr < 10; rr++) {
          if (!grid[rr][cc] && !placedKeys.has(`${rr}_${cc}`)) {
            full = false;
            break;
          }
        }
        if (full) clears++;
      }

      if (clears > best) best = clears;
    }
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// getSmartShapes
//
// Returns exactly 3 shapes with enhanced logic:
//   1. Guarantees at least one shape is placeable
//   2. Avoids frustrating combinations (all large shapes when board is dense)
//   3. Ensures at least one "useful" shape per batch
//   4. Scales difficulty more intelligently based on board state
// ─────────────────────────────────────────────────────────────────────────────
export function getSmartShapes(grid, level, _difficultyLegacy = 'easy') {
  const L = Math.max(1, level);
  const boardDensity = getBoardDensity(grid);
  const isPressureBoard = boardDensity >= 0.45;
  const isCriticalBoard = boardDensity >= 0.62;
  
  // Adjust difficulty based on board state
  const adjustedDifficulty = boardDensity > 0.7 ? 'easy' :
                          boardDensity > 0.4 ? 'medium' : 'hard';

  const pool = SHAPE_TEMPLATES
    .map((t) => ({ t, w: blendedWeight(t, L, adjustedDifficulty) }))
    .filter(({ w }) => w > 0.04);

  // Keep only templates that can actually be placed on the current board.
  // This ensures every draggable piece in the tray is board-appropriate.
  const placeableNames = new Set(
    SHAPE_TEMPLATES
      .filter((t) => templateCanFit(grid, t))
      .map((t) => t.name)
  );

  const placeablePool = pool.filter(({ t }) => placeableNames.has(t.name));
  const clearableTemplates = SHAPE_TEMPLATES
    .filter((t) => placeableNames.has(t.name) && templateCanClearImmediately(grid, t));
  const clearableNames = new Set(clearableTemplates.map((t) => t.name));
  const clearScoreByName = new Map(
    clearableTemplates.map((t) => [t.name, getTemplateBestImmediateClear(grid, t)])
  );

  // Fallback pool with smaller shapes when board is dense
  const fallbackPool = SHAPE_TEMPLATES
    .filter(t => {
      const size = t.layout.length;
      return boardDensity > 0.6 ? size <= 3 : size <= 4;
    })
    .filter((t) => placeableNames.has(t.name))
    .map((t) => ({ t, w: Math.max(0.2, blendedWeight(t, L)) }));

  const BATCH = 3;
  const shapes = [];
  const usedNames = new Set();

  const sourcePool = placeablePool.length ? placeablePool : pool;
  const usefulPool = fallbackPool.length ? fallbackPool : sourcePool;
  const compactPool = sourcePool.filter(({ t }) => {
    const size = t.layout.length;
    return isCriticalBoard ? size <= 3 : size <= 4;
  });

  const pickFromPool = (candidatePool) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const template = weightedPick(candidatePool);
      if (usedNames.has(template.name)) continue;
      const shape = templateToShape(template);
      usedNames.add(template.name);
      return shape;
    }
    const template = weightedPick(candidatePool);
    return templateToShape(template);
  };

  // Helper: pick a board-placeable shape.
  const pick = (preferUseful = false) => {
    const candidatePool = preferUseful ? usefulPool : sourcePool;
    for (let attempt = 0; attempt < 40; attempt++) {
      const template = weightedPick(candidatePool);
      if (usedNames.has(template.name)) continue;

      const shape = templateToShape(template);
      usedNames.add(template.name);
      return shape;
    }

    // If unique options are exhausted, allow duplicates but still from placeable templates.
    for (let attempt = 0; attempt < 20; attempt++) {
      const template = weightedPick(candidatePool);
      return templateToShape(template);
    }

    // Ultimate fallback: 1-cell dot
    const dot = SHAPE_TEMPLATES.find(t => t.name === 'dot');
    return templateToShape(dot);
  };

  // Every shape is now guaranteed to come from placeable templates.
  shapes.push(isPressureBoard && compactPool.length ? pickFromPool(compactPool) : pick());

  // Second shape: prioritize useful shapes when board is getting full
  const needUseful = boardDensity > 0.45;
  shapes.push(pick(needUseful));

  // Third shape: variety
  shapes.push(isPressureBoard && compactPool.length ? pickFromPool(compactPool) : pick());

  // Pressure safety net: keep at least 2 compact/easy-to-place pieces in tray.
  if (isPressureBoard && compactPool.length > 0) {
    const compactNames = new Set(compactPool.map(({ t }) => t.name));
    let compactCount = shapes.reduce((acc, s) => acc + (compactNames.has(s.name) ? 1 : 0), 0);
    for (let i = 0; i < shapes.length && compactCount < 2; i++) {
      if (compactNames.has(shapes[i].name)) continue;
      const replacementTemplate = weightedPick(compactPool);
      shapes[i] = templateToShape(replacementTemplate);
      compactCount++;
    }
  }

  // If the board has any immediate-clear options, force at least one tray shape
  // to be an immediate-clear piece for more consistent "crush" moments.
  if (clearableTemplates.length > 0) {
    const hasImmediateClearShape = shapes.some((shape) => clearableNames.has(shape.name));

    if (!hasImmediateClearShape) {
      // Choose the strongest immediate-clear template (max lines cleared);
      // tie-break toward smaller shapes for easier player execution.
      let bestTemplate = clearableTemplates[0];
      let bestClearCount = clearScoreByName.get(bestTemplate.name) ?? 0;
      for (let i = 1; i < clearableTemplates.length; i++) {
        const t = clearableTemplates[i];
        const clearCount = clearScoreByName.get(t.name) ?? 0;
        if (
          clearCount > bestClearCount ||
          (clearCount === bestClearCount && t.layout.length < bestTemplate.layout.length)
        ) {
          bestTemplate = t;
          bestClearCount = clearCount;
        }
      }

      const replaceAt = boardDensity > 0.5 ? 2 : 1;
      shapes[replaceAt] = templateToShape(bestTemplate);
    }
  }

  // If a 2+ line clear is possible, ensure the tray includes a shape capable of it.
  // Apply this last so no later balancing rule can override it.
  const megaTemplates = clearableTemplates.filter(
    (t) => (clearScoreByName.get(t.name) ?? 0) >= 2
  );
  if (megaTemplates.length > 0) {
    const hasMegaShape = shapes.some((shape) => {
      return (clearScoreByName.get(shape.name) ?? 0) >= 2;
    });

    if (!hasMegaShape) {
      let bestMega = megaTemplates[0];
      let bestMegaCount = clearScoreByName.get(bestMega.name) ?? 0;
      for (let i = 1; i < megaTemplates.length; i++) {
        const t = megaTemplates[i];
        const clearCount = clearScoreByName.get(t.name) ?? 0;
        if (
          clearCount > bestMegaCount ||
          (clearCount === bestMegaCount && t.layout.length < bestMega.layout.length)
        ) {
          bestMega = t;
          bestMegaCount = clearCount;
        }
      }
      shapes[2] = templateToShape(bestMega);
    }
  }

  return shapes;
}
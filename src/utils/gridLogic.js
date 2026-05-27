import { GRID_SIZE } from '../constants/gameConfig';

// ─────────────────────────────────────────────────────────────────────────────
// createEmptyGrid
// Returns a brand-new 10×10 grid filled with null.
// ─────────────────────────────────────────────────────────────────────────────
export function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

// ─────────────────────────────────────────────────────────────────────────────
// canPlaceShape
// Returns true if `shape` can be placed with its top-left at (startRow, startCol)
// without going out of bounds or overlapping an occupied cell.
// ─────────────────────────────────────────────────────────────────────────────
export function canPlaceShape(grid, shape, startRow, startCol) {
  for (const [dr, dc] of shape.layout) {
    const r = startRow + dr;
    const c = startCol + dc;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkAndClearLines (Optimized)
// Optimized version with single-pass counting and early termination.
// ─────────────────────────────────────────────────────────────────────────────
export function checkAndClearLines(grid) {
  const rowFillCounts = Array(GRID_SIZE).fill(0);
  const colFillCounts = Array(GRID_SIZE).fill(0);
  const clearedRows = [];
  const clearedCols = [];

  // Single pass: count filled cells and identify complete lines
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== null) {
        rowFillCounts[r]++;
        colFillCounts[c]++;
      }
    }
    // Row can be decided after scanning this row.
    if (rowFillCounts[r] === GRID_SIZE) clearedRows.push(r);
  }

  // Columns can only be decided after scanning every row.
  for (let c = 0; c < GRID_SIZE; c++) {
    if (colFillCounts[c] === GRID_SIZE) clearedCols.push(c);
  }

  const clearedCount = clearedRows.length + clearedCols.length;

  if (clearedCount === 0) {
    return { newGrid: grid, clearedCount: 0, clearedRows: [], clearedCols: [] };
  }

  // Build cleared grid more efficiently
  const rowSet = new Set(clearedRows);
  const colSet = new Set(clearedCols);

  const newGrid = grid.map((row, r) => {
    const isRowCleared = rowSet.has(r);
    return row.map((cell, c) => (isRowCleared || colSet.has(c)) ? null : cell);
  });

  return { newGrid, clearedCount, clearedRows, clearedCols };
}

// ─────────────────────────────────────────────────────────────────────────────
// hasAnyValidMove
// True if at least one of `shapes` can be placed on `grid` somewhere.
// ─────────────────────────────────────────────────────────────────────────────
export function hasAnyValidMove(grid, shapes) {
  if (!shapes || shapes.length === 0) return false;
  for (const shape of shapes) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (canPlaceShape(grid, shape, r, c)) return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// isBoardFull — legacy name: “no legal move left” (grid may still have holes).
// Prefer hasAnyValidMove / !hasAnyValidMove for new code.
// ─────────────────────────────────────────────────────────────────────────────
export function isBoardFull(grid, shapes) {
  return !hasAnyValidMove(grid, shapes);
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMoveQuality
// Evaluates the strategic quality of a move that doesn't clear lines.
// Returns a score (0-4) based on setup potential and board positioning.
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateMoveQuality(grid, shape, row, col) {
  let score = 0;
  const tempGrid = grid.map(r => [...r]);
  
  // Place the shape temporarily
  shape.layout.forEach(([dr, dc]) => {
    tempGrid[row + dr][col + dc] = shape.color;
  });
  
  // Count near-complete lines (7+ cells filled)
  const nearCompleteRows = [];
  const nearCompleteCols = [];
  
  for (let i = 0; i < GRID_SIZE; i++) {
    let rowFill = 0;
    let colFill = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      if (tempGrid[i][j]) rowFill++;
      if (tempGrid[j][i]) colFill++;
    }
    if (rowFill >= 7) nearCompleteRows.push(i);
    if (colFill >= 7) nearCompleteCols.push(i);
  }
  
  // Bonus for creating near-complete lines
  score += (nearCompleteRows.length + nearCompleteCols.length) * 0.5;
  
  // Bonus for placing in dense areas (efficiency)
  const densityScore = getLocalDensity(tempGrid, row, col, shape.layout);
  score += densityScore * 0.3;
  
  // Penalty for isolated placements
  const isolationPenalty = getIsolationPenalty(tempGrid, row, col, shape.layout);
  score -= isolationPenalty * 0.4;
  
  return Math.max(0, Math.min(4, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// getLocalDensity
// Calculates the density of occupied cells around the placement area.
// ─────────────────────────────────────────────────────────────────────────────
function getLocalDensity(grid, row, col, layout) {
  let nearbyCells = 0;
  let totalChecked = 0;
  
  layout.forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    
    // Check 3x3 area around each placed cell
    for (let dr2 = -1; dr2 <= 1; dr2++) {
      for (let dc2 = -1; dc2 <= 1; dc2++) {
        const nr = r + dr2;
        const nc = c + dc2;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          totalChecked++;
          if (grid[nr][nc]) nearbyCells++;
        }
      }
    }
  });
  
  return totalChecked > 0 ? nearbyCells / totalChecked : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// getIsolationPenalty
// Calculates how isolated a placement is from other pieces.
// ─────────────────────────────────────────────────────────────────────────────
function getIsolationPenalty(grid, row, col, layout) {
  let hasNeighbor = false;
  
  layout.forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    
    // Check adjacent cells (not diagonal)
    const adjacent = [
      [r-1, c], [r+1, c], [r, c-1], [r, c+1]
    ];
    
    for (const [nr, nc] of adjacent) {
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && grid[nr][nc]) {
        hasNeighbor = true;
        break;
      }
    }
  });
  
  return hasNeighbor ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// getBestMove
// Finds the best possible move for a shape based on strategic value.
// Returns { row, col, score } or null if no move exists.
// ─────────────────────────────────────────────────────────────────────────────
export function getBestMove(grid, shape) {
  let bestMove = null;
  let bestScore = -1;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!canPlaceShape(grid, shape, r, c)) continue;
      
      const score = evaluateMoveQuality(grid, shape, r, c);
      if (score > bestScore) {
        bestScore = score;
        bestMove = { row: r, col: c, score };
      }
    }
  }
  
  return bestMove;
}

// ─────────────────────────────────────────────────────────────────────────────
// hasGoodMove
// Checks if there's at least one quality move (score >= 2) available.
// ─────────────────────────────────────────────────────────────────────────────
export function hasGoodMove(grid, shapes) {
  if (!shapes || shapes.length === 0) return false;
  
  for (const shape of shapes) {
    const bestMove = getBestMove(grid, shape);
    if (bestMove && bestMove.score >= 2) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// getNearCompleteLines
// Returns arrays of rows and columns that are close to being filled (7+ cells).
// Useful for highlighting potential clears and providing hints.
// ─────────────────────────────────────────────────────────────────────────────
export function getNearCompleteLines(grid) {
  const nearCompleteRows = [];
  const nearCompleteCols = [];
  
  for (let i = 0; i < GRID_SIZE; i++) {
    let rowFill = 0;
    let colFill = 0;
    
    for (let j = 0; j < GRID_SIZE; j++) {
      if (grid[i][j]) rowFill++;
      if (grid[j][i]) colFill++;
    }
    
    if (rowFill >= 7) nearCompleteRows.push({ index: i, count: rowFill });
    if (colFill >= 7) nearCompleteCols.push({ index: i, count: colFill });
  }
  
  return { rows: nearCompleteRows, cols: nearCompleteCols };
}
/**
 * src/hooks/useGameEngine.js
 *
 * Upgrades in this version:
 *   1. onDangerChange(active, intensity) — fires when timeLeft crosses 20 / 10
 *   2. onGhostChange({ r, c, shape } | null) — fires during drag for ghost preview
 *   3. hasValidMove(grid, shapes) — exported util for board-full guard
 *   4. Progressive difficulty: time decreases by 2s/level (floor 60), target scales
 *   5. Tick sound managed here: startTick / stopTick called on danger transitions
 *   6. Drag preview: onDragMove(shape, absX, absY) returns best grid position
 */

import { useRef, useCallback, useEffect } from 'react';
import { AppState, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import { getSmartShapes }                      from '../constants/shapes';
import { getLevel }                            from '../constants/levels';
import { checkAndClearLines, canPlaceShape,
         createEmptyGrid, isBoardFull }        from '../utils/gridLogic';
import { playSound, startTick, stopTick }      from '../utils/audioManager';
import { CELL_SIZE, COLORS }                   from '../constants/gameConfig';
import { POWER_UPS, POWER_UP_EARN_CONFIG }     from '../constants/powerUps';
import { ACHIEVEMENTS }                        from '../constants/achievements';

// ─── Exported constants ───────────────────────────────────────────────────────
export const COMBO_LABELS = ['', 'SWEET!', 'TASTY ×2!', 'DELICIOUS ×3!', 'SUGAR RUSH!'];

export const getDifficultyConfig = (lvl) => {
  // Fairness pass: slower ramp and later hard-mode entry.
  const base = lvl <= 6 ? 105 : lvl <= 18 ? 90 : 78;  // Reduced from 138/122/108
  const timerDuration = Math.max(base - Math.floor((lvl - 1) * 1.2), 60);  // Increased reduction from 0.8 to 1.2
  const difficulty    = lvl <= 5 ? 'easy' : lvl <= 12 ? 'medium' : 'hard';  // Earlier medium/hard
  return { timerDuration, difficulty };
};

// Progressive target: increased scaling for more challenge
const TARGET_EASE_FACTOR = 0.85;  // Increased from 0.78 (harder)
export const getTargetScore = (lvl) =>
  Math.round((500 + lvl * 500 + Math.floor(lvl / 5) * 250) * TARGET_EASE_FACTOR);  // Increased from 420/420/180

// ─── Private ─────────────────────────────────────────────────────────────────
const PIECE_PTS  = 16;
const LINE_PTS   = 420;
const COMBO_MULT = [1, 1.6, 2.2, 2.8, 3.4];
const CLEAR_BONUS_MULT = { 2: 1.35, 3: 1.7, 4: 2.05 };
const CLEAR_TIME_BONUS = { 2: 3, 3: 5, 4: 7 };
const FLASH_MS   = 140;
const HAPTIC_MS  = 200;
const DANGER_1   = 20;   // seconds — start tick + glow
const DANGER_2   = 10;   // seconds — faster tick + stronger shake
const SNAP_LOCAL_PAD = 4;

const countOccupied = (grid) =>
  grid.reduce((acc, row) => acc + row.filter(Boolean).length, 0);

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Fever mode helper ───────────────────────────────────────────────────────
const tryActivateFeverMode = (clearedCount, combo, feverModeRef, feverTimeoutRef, cbRef) => {
  // Don't activate if already in fever mode
  if (feverModeRef.current) return;

  // 20% chance on 2+ line clears or 3+ combos
  const shouldTrigger = (clearedCount >= 2 || combo >= 3) && Math.random() < 0.20;
  
  if (shouldTrigger) {
    feverModeRef.current = true;
    cbRef.current.onFeverModeChange(true);
    
    // Fever mode lasts 10 seconds
    if (feverTimeoutRef.current) clearTimeout(feverTimeoutRef.current);
    feverTimeoutRef.current = setTimeout(() => {
      feverModeRef.current = false;
      cbRef.current.onFeverModeChange(false);
    }, 10000);
  }
};

// ─── Achievement checker ─────────────────────────────────────────────────────
const checkAchievements = (stats, level, streak, unlockedAchievements, cbRef) => {
  ACHIEVEMENTS.forEach(achievement => {
    // Skip if already unlocked
    if (unlockedAchievements.includes(achievement.id)) return;
    
    // Check condition
    try {
      if (achievement.condition(stats, level, streak)) {
        cbRef.current.onAchievement({
          id: achievement.id,
          name: achievement.name,
          icon: achievement.icon,
          reward: achievement.reward,
        });
      }
    } catch (_) {}
  });
};

const hasClearOpportunity = (grid, shapes) => {
  if (!shapes?.length) return false;
  for (const shape of shapes) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!canPlaceShape(grid, shape, r, c)) continue;
        const testGrid = grid.map(row => [...row]);
        shape.layout.forEach(([dr, dc]) => {
          testGrid[r + dr][c + dc] = shape.color;
        });
        const { clearedCount } = checkAndClearLines(testGrid);
        if (clearedCount > 0) return true;
      }
    }
  }
  return false;
};

const getBatchClearPotential = (grid, shapes) => {
  if (!grid || !shapes?.length) return 0;
  let best = 0;
  for (const shape of shapes) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!canPlaceShape(grid, shape, r, c)) continue;
        const testGrid = grid.map(row => [...row]);
        shape.layout.forEach(([dr, dc]) => {
          testGrid[r + dr][c + dc] = shape.color;
        });
        const { clearedCount } = checkAndClearLines(testGrid);
        if (clearedCount > best) best = clearedCount;
      }
    }
  }
  return best;
};

const getBestRescueBatch = (grid, level) => {
  let bestBatch = null;
  let bestScore = -1;

  // Probe many candidate "easy" batches and pick the one that gives
  // the strongest immediate clear potential on the current board.
  for (let i = 0; i < 48; i++) {
    const batch = getSmartShapes(grid, level, 'easy');
    if (!hasValidMove(grid, batch)) continue;
    const clearPotential = getBatchClearPotential(grid, batch);
    const score = clearPotential * 10 + (hasClearOpportunity(grid, batch) ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestBatch = batch;
      if (clearPotential >= 2) break; // Great rescue batch found.
    }
  }

  if (bestBatch) return bestBatch;

  // Safety fallback if all scoring probes fail.
  let fallback = getSmartShapes(grid, level, 'easy');
  for (let i = 0; i < 20 && !hasValidMove(grid, fallback); i++) {
    fallback = getSmartShapes(grid, level, 'easy');
  }
  return fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// hasValidMove — exported for board-full guard and shape validation
// ─────────────────────────────────────────────────────────────────────────────
export function hasValidMove(grid, shapes) {
  for (const shape of shapes) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (canPlaceShape(grid, shape, r, c)) return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
export function useGameEngine({
  soundEnabled,
  vibEnabled,
  onGridChange,
  onShapesChange,
  onScoreChange,
  onTimerChange,
  onComboChange,
  onFlashChange,
  onPressureChange,
  onPauseChange,
  onGameEnd,
  onBoardPressureAnim,
  onScorePop,
  onComboAnim,
  onBoardPulse,
  onPlaceJuice,
  onDangerChange,   // NEW: (active: bool, intensity: 0.5|1.0) => void
  onGhostChange,    // NEW: ({ r, c, shape } | null) => void
  onFloatingScore,  // NEW: ({ value, boost }) => void
  onParticles,      // NEW: ({ x, y, color, count }) => void
  onFeverModeChange,// NEW: (active: bool) => void
  onPowerUpEarn,    // NEW: ({ type, count }) => void
  onAchievement,    // NEW: ({ id, name, icon }) => void
}) {
  // ── Engine lock ───────────────────────────────────────────────────────────
  const lockRef = useRef({ gameEnded: false, paused: false, animating: false });

  // ── Game data refs ────────────────────────────────────────────────────────
  const gridRef         = useRef(createEmptyGrid());
  const shapesRef       = useRef([]);
  const scoreRef        = useRef(0);
  const levelRef        = useRef(1);
  const targetRef       = useRef(500);
  const comboRef        = useRef(0);
  const lastHapticRef   = useRef(0);
  const timerRef        = useRef(null);
  const timerStopRef    = useRef(null);
  const clearTimeoutRef = useRef(null);
  const timeLeftRef     = useRef(0);
  const lastEndReasonRef = useRef('');
  const boardLayoutRef  = useRef(null);
  const boardMeasureRef = useRef(null);
  const dangerStateRef  = useRef(0);   // 0=normal, 1=danger, 2=critical
  const bonusGraceRef   = useRef(false);
  const rescueUsedRef   = useRef(false);
  const rescueCountRef  = useRef(0);
  const lastGhostKeyRef = useRef(null);
  const noClearStreakRef = useRef(0);
  const feverModeRef = useRef(false);
  const feverTimeoutRef = useRef(null);
  const boardCenterRef = useRef({ x: SW / 2, y: SH * 0.45 });
  const lastGridRef = useRef(null); // For undo power-up

  // ── Stable fn refs ───────────────────────────────────────────────────────
  const togglePauseRef = useRef(null);
  const handleEndRef   = useRef(null);
  const startTimerRef  = useRef(null);
  const addTimeRef     = useRef(null);
  const runTimerLoopRef = useRef(null);
  const consumeTimeoutBonusRef = useRef(null);

  // ── Callback ref (always current) ─────────────────────────────────────────
  const cbRef = useRef({});
  cbRef.current = {
    onGridChange, onShapesChange, onScoreChange, onTimerChange,
    onComboChange, onFlashChange, onPressureChange, onPauseChange,
    onGameEnd, onBoardPressureAnim, onScorePop, onComboAnim, onBoardPulse,
    onPlaceJuice:   onPlaceJuice   ?? (() => {}),
    onDangerChange: onDangerChange ?? (() => {}),
    onGhostChange:  onGhostChange  ?? (() => {}),
    onFloatingScore: onFloatingScore ?? (() => {}),
    onParticles: onParticles ?? (() => {}),
    onFeverModeChange: onFeverModeChange ?? (() => {}),
    onPowerUpEarn: onPowerUpEarn ?? (() => {}),
    onAchievement: onAchievement ?? (() => {}),
  };

  // ── Sound/haptic refs ─────────────────────────────────────────────────────
  const vibRef   = useRef(vibEnabled);
  const soundRef = useRef(soundEnabled);
  useEffect(() => { vibRef.current   = vibEnabled;   }, [vibEnabled]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  // Keep danger tick behavior in sync when user toggles sound mid-game.
  useEffect(() => {
    if (lockRef.current.gameEnded || lockRef.current.paused) return;
    if (!soundEnabled) {
      stopTick().catch(() => {});
      return;
    }
    const t = timeLeftRef.current;
    if (t <= 0) return;
    if (t <= DANGER_2) {
      startTick('fast').catch(() => {});
    } else if (t <= DANGER_1) {
      startTick('normal').catch(() => {});
    }
  }, [soundEnabled]);

  const safeHaptic = useCallback((type, style) => {
    if (!vibRef.current) return;
    const now = Date.now();
    if (now - lastHapticRef.current < HAPTIC_MS) return;
    lastHapticRef.current = now;
    try {
      if (type === 'notification') Haptics.notificationAsync(style);
      else                         Haptics.impactAsync(style);
    } catch (_) {}
  }, []);

  const safeSound = useCallback((key, delay = 0) => {
    if (!soundRef.current) return;
    try { playSound(key, delay); } catch (_) {}
  }, []);

  // ── Danger state management ───────────────────────────────────────────────
  const updateDangerState = useCallback((timeLeft) => {
    if (lockRef.current.gameEnded) return;

    if (timeLeft <= DANGER_2 && dangerStateRef.current !== 2) {
      dangerStateRef.current = 2;
      cbRef.current.onDangerChange(true, 1.0);
      if (soundRef.current) startTick('fast').catch(() => {});
    } else if (timeLeft > DANGER_2 && timeLeft <= DANGER_1 && dangerStateRef.current !== 1) {
      dangerStateRef.current = 1;
      cbRef.current.onDangerChange(true, 0.5);
      if (soundRef.current) startTick('normal').catch(() => {});
    } else if (timeLeft > DANGER_1 && dangerStateRef.current !== 0) {
      dangerStateRef.current = 0;
      cbRef.current.onDangerChange(false, 0);
      stopTick().catch(() => {});
    }
  }, []);

  // ── handleEnd ────────────────────────────────────────────────────────────
  handleEndRef.current = (win, reason) => {
    if (lockRef.current.gameEnded) return;
    lockRef.current.gameEnded = true;
    lockRef.current.animating = true;
    lastEndReasonRef.current = reason;
    lastGhostKeyRef.current = null;

    clearInterval(timerRef.current);
    try { timerStopRef.current?.(); } catch (_) {}

    // Stop danger mode
    dangerStateRef.current = 0;
    cbRef.current.onDangerChange(false, 0);
    cbRef.current.onGhostChange(null);
    stopTick().catch(() => {});

    // Stop fever mode on game end
    if (feverTimeoutRef.current) {
      clearTimeout(feverTimeoutRef.current);
      feverTimeoutRef.current = null;
    }
    feverModeRef.current = false;
    cbRef.current.onFeverModeChange(false);

    if (win) {
      safeSound('WIN');
      safeHaptic('notification', Haptics.NotificationFeedbackType.Success);
    } else {
      safeSound('LOSE');
      safeHaptic('notification', Haptics.NotificationFeedbackType.Error);
    }

    cbRef.current.onGameEnd({ win, reason, score: scoreRef.current, level: levelRef.current });
  };

  // ── startTimer ───────────────────────────────────────────────────────────
  runTimerLoopRef.current = () => {
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (lockRef.current.gameEnded) { clearInterval(timerRef.current); return; }
      if (lockRef.current.paused)    { return; }

      const next = Math.max(0, timeLeftRef.current - 1);
      timeLeftRef.current = next;
      cbRef.current.onTimerChange(next);
      // After timeout-revive bonus, keep visuals calm until critical zone.
      if (bonusGraceRef.current && next > DANGER_2) {
        if (dangerStateRef.current !== 0) {
          dangerStateRef.current = 0;
          cbRef.current.onDangerChange(false, 0);
          stopTick().catch(() => {});
        }
      } else {
        bonusGraceRef.current = false;
        updateDangerState(next);
      }

      if (next <= 0) {
        clearInterval(timerRef.current);
        if (!lockRef.current.gameEnded) {
          const win = scoreRef.current >= targetRef.current;
          handleEndRef.current(win, win ? 'target_reached' : 'time_up');
        }
      }
    }, 1000);
  };

  startTimerRef.current = (duration) => {
    bonusGraceRef.current = false;
    timeLeftRef.current = duration;
    cbRef.current.onTimerChange(duration);
    updateDangerState(duration);
    runTimerLoopRef.current();
  };

  // ── addTime ────────────────────────────────────────────────────────────────
  addTimeRef.current = (seconds) => {
    if (lockRef.current.gameEnded) return timeLeftRef.current;
    const extra = Math.max(0, Number(seconds) || 0);
    if (extra <= 0) return timeLeftRef.current;

    const updated = timeLeftRef.current + extra;
    timeLeftRef.current = updated;
    cbRef.current.onTimerChange(updated);
    updateDangerState(updated);
    return updated;
  };

  // ── consumeTimeoutBonus ───────────────────────────────────────────────────
  consumeTimeoutBonusRef.current = (seconds) => {
    const lock = lockRef.current;
    if (!lock.gameEnded) return null;
    if (lastEndReasonRef.current !== 'time_up') return null;

    const extra = Math.max(0, Number(seconds) || 0);
    if (extra <= 0) return null;

    const updated = Math.max(0, timeLeftRef.current) + extra;
    const baseGrid = gridRef.current;

    // Bonus claim fairness: keep the same board, but offer a "rescue" tray
    // tuned to create immediate playable/clear opportunities.
    const bonusBatch = getBestRescueBatch(baseGrid, levelRef.current);
    if (hasValidMove(baseGrid, bonusBatch)) {
      shapesRef.current = bonusBatch;
      cbRef.current.onShapesChange(bonusBatch);
    }

    lock.gameEnded = false;
    lock.animating = false;
    lock.paused = false;
    lastEndReasonRef.current = '';
    bonusGraceRef.current = true;

    cbRef.current.onPauseChange(false);
    dangerStateRef.current = 0;
    cbRef.current.onDangerChange(false, 0);
    stopTick().catch(() => {});
    timeLeftRef.current = updated;
    cbRef.current.onTimerChange(updated);
    clearInterval(timerRef.current);
    runTimerLoopRef.current();
    return updated;
  };

  // ── executeMove (ref, breaks circular dep) ────────────────────────────────
  const executeMoveRef = useRef(null);
  executeMoveRef.current = (shape, r, c) => {
    const lock = lockRef.current;
    if (lock.gameEnded || lock.paused || lock.animating) return;

    lock.animating = true;

    // Save grid state for undo power-up
    lastGridRef.current = gridRef.current.map(row => [...row]);

    // Clear ghost immediately on drop
    cbRef.current.onGhostChange(null);
    cbRef.current.onPlaceJuice();
    lastGhostKeyRef.current = null;

    // Optimised clone — only touched rows
    const touchedRows = new Set(shape.layout.map(([dr]) => r + dr));
    const midGrid = gridRef.current.map((row, ri) =>
      touchedRows.has(ri) ? [...row] : row
    );
    shape.layout.forEach(([dr, dc]) => { midGrid[r + dr][c + dc] = shape.color; });

    const { newGrid, clearedCount, clearedRows, clearedCols } = checkAndClearLines(midGrid);

    const newCombo = clearedCount >= 2 ? comboRef.current + 1 : 0;
    comboRef.current = newCombo;

    const mult     = COMBO_MULT[Math.min(newCombo, COMBO_MULT.length - 1)];
    const clearBoost = CLEAR_BONUS_MULT[clearedCount] ?? 1;
    const linePts  = clearedCount * LINE_PTS * mult * clearBoost;
    const newScore = scoreRef.current + Math.round(shape.layout.length * PIECE_PTS + linePts);

    const remaining = shapesRef.current.filter(s => s.id !== shape.id);
    
    // ── Pre-update UI for zero-latency feel ──
    cbRef.current.onGridChange(midGrid);
    cbRef.current.onComboChange(newCombo);

    // Heavy batch generation logic wrapped to prevent blocking the UI thread
    const generateNextBatch = () => {
      const { difficulty } = getDifficultyConfig(levelRef.current);
      const tryRescueBatch = (baseGrid, emergencyMode = false) => {
        const lowTime = timeLeftRef.current <= DANGER_1;
        const maxRescues = emergencyMode || lowTime ? 6 : levelRef.current >= 10 ? 4 : 3;
        if (rescueCountRef.current >= maxRescues) return null;
        let rescue = getSmartShapes(baseGrid, levelRef.current, 'easy');
        for (let i = 0; i < 18 && !hasValidMove(baseGrid, rescue); i++) {
          rescue = getSmartShapes(baseGrid, levelRef.current, 'easy');
        }
        if (!hasValidMove(baseGrid, rescue)) return null;
        for (let i = 0; i < 16 && !hasClearOpportunity(baseGrid, rescue); i++) {
          rescue = getSmartShapes(baseGrid, levelRef.current, 'easy');
          if (!hasValidMove(baseGrid, rescue)) continue;
        }
        rescueUsedRef.current = true;
        rescueCountRef.current += 1;
        return rescue;
      };

      let nextBatch;
      if (remaining.length === 0) {
        nextBatch = getSmartShapes(newGrid, levelRef.current, difficulty);
        for (let attempt = 0; attempt < 8 && !hasValidMove(newGrid, nextBatch); attempt++) {
          nextBatch = getSmartShapes(newGrid, levelRef.current, difficulty);
        }
        const occupiedRatio = countOccupied(newGrid) / 100;
        const assistMode = occupiedRatio >= 0.65 || timeLeftRef.current <= DANGER_1 + 4;
        if (assistMode && !hasClearOpportunity(newGrid, nextBatch)) {
          for (let attempt = 0; attempt < 14; attempt++) {
            const assistBatch = getSmartShapes(newGrid, levelRef.current, 'easy');
            if (!hasValidMove(newGrid, assistBatch)) continue;
            nextBatch = assistBatch;
            if (hasClearOpportunity(newGrid, nextBatch)) break;
          }
        }
      } else {
        nextBatch = remaining;
      }

      if (noClearStreakRef.current >= 2) {
        const baseGrid = clearedCount > 0 ? newGrid : midGrid;
        for (let attempt = 0; attempt < 18; attempt++) {
          const candyBatch = getSmartShapes(baseGrid, levelRef.current, 'easy');
          if (!hasValidMove(baseGrid, candyBatch)) continue;
          nextBatch = candyBatch;
          if (hasClearOpportunity(baseGrid, nextBatch)) break;
        }
      }
      return { nextBatch, tryRescueBatch };
    };

    if (clearedCount > 0) {
      noClearStreakRef.current = 0;
      // cbRef.current.onGridChange(midGrid); // Already called above
      cbRef.current.onFlashChange({ rows: clearedRows, cols: clearedCols, origin: { r, c } });
      safeSound('CLEAR', 30);
      cbRef.current.onBoardPulse(clearedCount >= 3 ? 1.8 : clearedCount === 2 ? 1.4 : 1);
      
      // ... particles and haptics (fast) ...

      // Spawn particles at board center with actual block colors
      const clearedColors = new Set();
      clearedRows.forEach(r => {
        gridRef.current[r].forEach(cell => {
          if (cell) clearedColors.add(cell);
        });
      });
      clearedCols.forEach(c => {
        gridRef.current.forEach(row => {
          if (row[c]) clearedColors.add(row[c]);
        });
      });
      
      // Spawn multiple particle bursts for juicier effect
      const particleBursts = [];
      clearedColors.forEach((color, idx) => {
        particleBursts.push({
          x: boardCenterRef.current.x + (Math.random() - 0.5) * 50,
          y: boardCenterRef.current.y + (Math.random() - 0.5) * 50,
          color: color,
          count: clearedCount,
          delay: idx * 80,
        });
      });
      
      // Also spawn accent particles for extra flair
      particleBursts.push({
        x: boardCenterRef.current.x,
        y: boardCenterRef.current.y,
        color: COLORS.accent,
        count: clearedCount,
        delay: 50,
      });

      cbRef.current.onParticles(particleBursts);

      if (newCombo >= 2) {
        cbRef.current.onComboAnim(newCombo);
        safeHaptic('notification', Haptics.NotificationFeedbackType.Success);
      } else {
        safeHaptic('impact', Haptics.ImpactFeedbackStyle.Heavy);
      }

      // Try to activate fever mode
      tryActivateFeverMode(clearedCount, newCombo, feverModeRef, feverTimeoutRef, cbRef);

      // Try to earn power-ups
      const powerUpChance = POWER_UP_EARN_CONFIG.clearLines + (newCombo * POWER_UP_EARN_CONFIG.combo);
      if (Math.random() < powerUpChance) {
        const powerUpTypes = Object.keys(POWER_UPS);
        const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        cbRef.current.onPowerUpEarn({ type: randomType, count: 1 });
      }

      clearTimeoutRef.current = setTimeout(() => {
        if (lockRef.current.gameEnded) { lockRef.current.animating = false; return; }

        // Heavy calculation happens after the flash starts to not block the drop
        const { nextBatch, tryRescueBatch } = generateNextBatch();

        gridRef.current   = newGrid;
        // Apply fever mode multiplier
        const feverMult = feverModeRef.current ? 3 : 1;
        scoreRef.current  = newScore * feverMult;
        shapesRef.current = nextBatch;

        cbRef.current.onGridChange(newGrid);
        cbRef.current.onFlashChange(null);
        cbRef.current.onScoreChange(newScore * feverMult);
        cbRef.current.onShapesChange(nextBatch);
        cbRef.current.onScorePop();
        cbRef.current.onFloatingScore({
          value: Math.max(20, Math.round(shape.layout.length * PIECE_PTS + linePts) * feverMult),
          boost: newCombo >= 2 || clearedCount >= 2,
          label:
            clearedCount >= 3
              ? 'SUPER CRUSH!'
              : clearedCount === 2
                ? 'MEGA CLEAR!'
                : 'SWEET!',
        });

        const ratio = countOccupied(newGrid) / 100;
        cbRef.current.onPressureChange(ratio);
        cbRef.current.onBoardPressureAnim(ratio);

        const timeBonus = CLEAR_TIME_BONUS[clearedCount] ?? 0;
        if (timeBonus > 0) addTimeRef.current(timeBonus);

        lockRef.current.animating = false;

        if (!lockRef.current.gameEnded) {
          if (newScore >= targetRef.current) {
            handleEndRef.current(true, 'target_reached');
          } else if (isBoardFull(newGrid, nextBatch)) {
            const rescueBatch = tryRescueBatch(newGrid, timeLeftRef.current <= DANGER_1);
            if (rescueBatch) {
              shapesRef.current = rescueBatch;
              cbRef.current.onShapesChange(rescueBatch);
              safeSound('PLACE');
              safeHaptic('impact', Haptics.ImpactFeedbackStyle.Medium);
            } else {
              handleEndRef.current(false, 'board_full');
            }
          }
        }
      }, FLASH_MS);

    } else {
      noClearStreakRef.current += 1;
      
      // Heavy calculation for next batch
      const { nextBatch, tryRescueBatch } = generateNextBatch();

      gridRef.current   = midGrid;
      scoreRef.current  = newScore;
      shapesRef.current = nextBatch;

      cbRef.current.onGridChange(midGrid);
      cbRef.current.onFlashChange(null);
      cbRef.current.onScoreChange(newScore);
      cbRef.current.onShapesChange(nextBatch);
      cbRef.current.onScorePop();
      cbRef.current.onFloatingScore({
        value: Math.max(10, Math.round(shape.layout.length * PIECE_PTS + linePts)),
        boost: false,
        label: '',
      });
      safeSound('PLACE');
      safeHaptic('impact', Haptics.ImpactFeedbackStyle.Light);

      const ratio = countOccupied(midGrid) / 100;
      cbRef.current.onPressureChange(ratio);
      cbRef.current.onBoardPressureAnim(ratio);

      lockRef.current.animating = false;

      if (!lockRef.current.gameEnded) {
        if (newScore >= targetRef.current) {
          handleEndRef.current(true, 'target_reached');
        } else if (isBoardFull(midGrid, nextBatch)) {
          const rescueBatch = tryRescueBatch(midGrid, timeLeftRef.current <= DANGER_1);
          if (rescueBatch) {
            shapesRef.current = rescueBatch;
            cbRef.current.onShapesChange(rescueBatch);
            safeSound('PLACE');
            safeHaptic('impact', Haptics.ImpactFeedbackStyle.Medium);
          } else {
            handleEndRef.current(false, 'board_full');
          }
        }
      }
    }
  };

  // ── Helper: compute best snap position for a drag (used by ghost + onDrop) ─
  const findBestSnap = useCallback((shape, absX, absY) => {
    if (!boardLayoutRef.current) return null;

    const { x: pageX, y: pageY } = boardLayoutRef.current;
    
    // Convert absolute screen coordinates to grid-relative column/row
    const rawCol = (absX - pageX) / CELL_SIZE;
    const rawRow = (absY - pageY) / CELL_SIZE;

    // Compute shape center offset to align finger with shape's visual center
    const shapeCols = shape.layout.map(([, c]) => c);
    const shapeRows = shape.layout.map(([dr]) => dr);
    const centerX   = (Math.min(...shapeCols) + Math.max(...shapeCols)) / 2;
    const centerY   = (Math.min(...shapeRows) + Math.max(...shapeRows)) / 2;

    const g = gridRef.current;
    let bestR = -1, bestC = -1, bestDist = Infinity;

    // Search range: only look in a tight window around the finger.
    // Full-board fallbacks are removed to prevent "glitchy" distant snaps.
    // Search range: look in a slightly broader window for "magnetic" feel
    const idealRow = Math.round(rawRow - centerY);
    const idealCol = Math.round(rawCol - centerX);
    
    const rowMin = Math.max(0, idealRow - 3);
    const rowMax = Math.min(9, idealRow + 3);
    const colMin = Math.max(0, idealCol - 3);
    const colMax = Math.min(9, idealCol + 3);

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        if (!canPlaceShape(g, shape, row, col)) continue;
        // Euclidean distance for circular snap feel
        const d = Math.hypot(rawCol - (col + centerX), rawRow - (row + centerY));
        if (d < bestDist) {
          bestDist = d;
          bestR = row;
          bestC = col;
        }
      }
    }

    // Distance threshold: if finger is too far from any valid cell, return null.
    // 2.2 cells for a stronger "magnetic" pull.
    if (bestR === -1 || bestDist > 2.2) return null;
    return { r: bestR, c: bestC };
  }, []);

  // Removed redundant findBestDrop helper.

  // ── onDragMove — called from DraggableBlock during drag for ghost preview ──
  const onDragMove = useCallback((shape, absX, absY) => {
    const lock = lockRef.current;
    if (lock.gameEnded || lock.paused || lock.animating) {
      if (lastGhostKeyRef.current !== null) {
        lastGhostKeyRef.current = null;
        cbRef.current.onGhostChange(null);
      }
      return;
    }
    const snap = findBestSnap(shape, absX, absY);
    
    // Throttle ghost update to avoid redundant re-renders
    const nextKey = snap ? `${snap.r}_${snap.c}_${shape.id}` : null;
    if (lastGhostKeyRef.current === nextKey) return;
    lastGhostKeyRef.current = nextKey;
    
    cbRef.current.onGhostChange(snap ? { r: snap.r, c: snap.c, shape } : null);
  }, [findBestSnap]);

  // ── onDrop ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((shape, absX, absY, triggerShake) => {
    const lock = lockRef.current;
    if (lock.gameEnded || lock.paused || lock.animating) return;
    
    // Lock immediately to prevent race conditions
    lock.animating = true;

    cbRef.current.onGhostChange(null);
    lastGhostKeyRef.current = null;

    // Fast-path: always use cached layout. App.js ensures this is updated via onLayout.
    if (!boardLayoutRef.current) {
      lock.animating = false;
      return;
    }

    const best = findBestSnap(shape, absX, absY);
    if (!best) {
      triggerShake();
      safeHaptic('impact', Haptics.ImpactFeedbackStyle.Medium);
      lock.animating = false;
    } else {
      // executeMoveRef will handle the 'animating' flag during the move
      lock.animating = false;
      executeMoveRef.current(shape, best.r, best.c);
    }
  }, [findBestSnap]);

  // ── togglePause ───────────────────────────────────────────────────────────
  const togglePause = useCallback((onPauseAnim, onResumeAnim) => {
    if (lockRef.current.gameEnded) return;
    const nowPaused = !lockRef.current.paused;
    lockRef.current.paused = nowPaused;
    cbRef.current.onPauseChange(nowPaused);
    if (nowPaused) {
      try { timerStopRef.current?.(); } catch (_) {}
      stopTick().catch(() => {});
      onPauseAnim?.();
    } else {
      // Resume: restart tick if still in danger
      const t = timeLeftRef.current;
      if (t <= DANGER_2) {
        if (soundRef.current) startTick('fast').catch(() => {});
      } else if (t <= DANGER_1) {
        if (soundRef.current) startTick('normal').catch(() => {});
      }
      onResumeAnim?.(t);
    }
  }, []);

  useEffect(() => { togglePauseRef.current = togglePause; }, [togglePause]);

  // ── AppState ──────────────────────────────────────────────────────────────
  const appBgRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = appBgRef.current === 'active';
      appBgRef.current = next;
      if (wasActive && next !== 'active') {
        if (!lockRef.current.gameEnded && !lockRef.current.paused) {
          lockRef.current.paused = true;
          cbRef.current.onPauseChange(true);
          try { timerStopRef.current?.(); } catch (_) {}
          stopTick().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Full teardown to avoid memory leaks across app reloads/navigation.
  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    try { timerStopRef.current?.(); } catch (_) {}
    stopTick().catch(() => {});
  }, []);

  // ── startLevel ────────────────────────────────────────────────────────────
  const startLevel = useCallback((lvl, setupTimerAnim) => {
    clearInterval(timerRef.current);
    try { timerStopRef.current?.(); } catch (_) {}
    stopTick().catch(() => {});
    if (feverTimeoutRef.current) {
      clearTimeout(feverTimeoutRef.current);
      feverTimeoutRef.current = null;
    }
    feverModeRef.current = false;

    const levelCfg = getLevel(lvl);
    const rawTarget = levelCfg?.targetScore ?? getTargetScore(lvl);
    const target = Math.round(rawTarget * TARGET_EASE_FACTOR);
    const { difficulty } = getDifficultyConfig(lvl);
    const timerDuration = levelCfg?.timeLimit ?? getDifficultyConfig(lvl).timerDuration;
    
    // Keep board clean at level start as requested - remove any default obstacles.
    const initialGrid = createEmptyGrid();

    // Generate shapes, guarantee at least one valid move
    let shapes = getSmartShapes(initialGrid, lvl, difficulty);
    for (let i = 0; i < 5 && !hasValidMove(initialGrid, shapes); i++) {
      shapes = getSmartShapes(initialGrid, lvl, difficulty);
    }
    if (!hasClearOpportunity(initialGrid, shapes)) {
      for (let i = 0; i < 16; i++) {
        const assistBatch = getSmartShapes(initialGrid, lvl, 'easy');
        if (!hasValidMove(initialGrid, assistBatch)) continue;
        shapes = assistBatch;
        if (hasClearOpportunity(initialGrid, shapes)) break;
      }
    }

    lockRef.current        = { gameEnded: false, paused: false, animating: false };
    gridRef.current        = initialGrid;
    shapesRef.current      = shapes;
    scoreRef.current       = 0;
    levelRef.current       = lvl;
    targetRef.current      = target;
    comboRef.current       = 0;
    noClearStreakRef.current = 0;
    dangerStateRef.current = 0;
    bonusGraceRef.current = false;
    lastEndReasonRef.current = '';
    rescueUsedRef.current  = false;
    rescueCountRef.current = 0;
    lastGhostKeyRef.current = null;
    // FIX: Do NOT clear boardLayoutRef here. If the layout hasn't changed (e.g. level transition),
    // onLayout won't fire and we'll lose the coordinates, breaking drag and drop.
    // boardLayoutRef.current = null; 

    if (setupTimerAnim) {
      timerStopRef.current = setupTimerAnim(timerDuration);
    }

    startTimerRef.current(timerDuration);
    return { initialGrid, shapes, target, timerDuration };
  }, []);

  const cacheLayout = useCallback((x, y) => {
    boardLayoutRef.current = { x, y };
  }, []);

  // ── Power-up: Undo last move ─────────────────────────────────────────────
  const undoLastMove = useCallback(() => {
    if (!lastGridRef.current || lockRef.current.gameEnded || lockRef.current.animating) {
      return false;
    }
    
    gridRef.current = lastGridRef.current;
    cbRef.current.onGridChange(lastGridRef.current);
    lastGridRef.current = null;
    return true;
  }, []);

  // ── Power-up: Time Freeze (add 5 seconds) ────────────────────────────────
  const activateTimeFreeze = useCallback(() => {
    if (lockRef.current.gameEnded) return false;
    return addTimeRef.current(5);
  }, []);

  // ── Power-up: Bomb (clear 3x3 area at position) ──────────────────────────
  const activateBomb = useCallback((row, col) => {
    if (lockRef.current.gameEnded || lockRef.current.animating) return false;
    
    const grid = gridRef.current;
    const newGrid = grid.map(r => [...r]);
    
    // Clear 3x3 area centered on row, col
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
          newGrid[r][c] = null;
        }
      }
    }
    
    gridRef.current = newGrid;
    cbRef.current.onGridChange(newGrid);
    return true;
  }, []);

  // ── Power-up: Color Clear (remove all cells of specific color) ───────────
  const activateColorClear = useCallback((color) => {
    if (lockRef.current.gameEnded || lockRef.current.animating) return false;
    
    const grid = gridRef.current;
    const newGrid = grid.map(row => 
      row.map(cell => cell === color ? null : cell)
    );
    
    gridRef.current = newGrid;
    cbRef.current.onGridChange(newGrid);
    return true;
  }, []);

  return {
    startLevel,
    addTime: (seconds) => addTimeRef.current(seconds),
    consumeTimeoutBonus: (seconds) => consumeTimeoutBonusRef.current(seconds),
    togglePause,
    togglePauseRef,
    onDrop,
    onDragMove,      // NEW — for ghost preview
    cacheLayout,
    boardMeasureRef,
    isGameEnded:  () => lockRef.current.gameEnded,
    isPausedNow:  () => lockRef.current.paused,
    // Power-ups
    undoLastMove,
    activateTimeFreeze,
    activateBomb,
    activateColorClear,
  };
}
/**
 * src/components/GameBoard.js
 *
 * Upgrades in this version:
 *   1. Candy Crush–style CRUSH animation: each cleared cell scales 1→1.25→0
 *      and fades out with a staggered ripple delay (index * 30ms)
 *   2. Ghost preview: semi-transparent green overlay on cells where the
 *      dragged piece would land
 *   3. Improved cell visuals: stronger border, subtle inner glow via shadow,
 *      rounded corners, slightly larger
 *
 * Driver rules (never broken):
 *   - Cell crush: scale + opacity → useNativeDriver: true
 *   - Ghost overlay: backgroundColor interpolation → useNativeDriver: false
 *   - Flash: backgroundColor → useNativeDriver: false
 *   These values are NEVER shared across driver types.
 */

import React, { useEffect, useRef, useMemo, memo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS, CELL_SIZE, GRID_SIZE } from '../constants/gameConfig';

// ─── Animation timing ─────────────────────────────────────────────────────────
const RIPPLE_DELAY_MS  = 18;    // Per unit of distance from origin
const CRUSH_SCALE_MS   = 70;    // Faster anticipation
const CRUSH_FADE_MS    = 130;   // Quicker decay
const GHOST_OPACITY    = 0.38;  // ghost preview alpha

// ─────────────────────────────────────────────────────────────────────────────
// CrushCell — animates a single cell that belongs to a cleared line
// Ultra-juicy Candy Crush-style with burst effect and color-matched glow
// ─────────────────────────────────────────────────────────────────────────────
const CrushCell = memo(function CrushCell({ color, delay, cellStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(1);
    opacity.setValue(1);
    rotate.setValue(0);

    const randomRotate = (Math.random() - 0.5) * 45;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        // Main crush: burst then vanish
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.65, duration: CRUSH_SCALE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.01, duration: CRUSH_FADE_MS,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotate, {
          toValue: randomRotate,
          duration: CRUSH_SCALE_MS + CRUSH_FADE_MS,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(CRUSH_SCALE_MS / 2),
          Animated.timing(opacity, {
            toValue: 0, duration: CRUSH_FADE_MS,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [delay, opacity, scale, rotate]);

  return (
    <View style={styles.crushWrap}>
      <Animated.View
        style={[
          cellStyle,
          { 
            backgroundColor: color, 
            borderWidth: 1, 
            borderColor: 'rgba(255,255,255,0.8)',
            // Move shadow/glow into the main cell to save layers
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 10,
            elevation: 10,
          },
          {
            transform: [
              { scale },
              { rotate: rotate.interpolate({
                  inputRange: [-180, 180],
                  outputRange: ['-180deg', '180deg']
                })
              }
            ],
            opacity
          },
        ]}
      />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GhostCell — semi-transparent green overlay for placement preview
// (Native driver — opacity only)
// ─────────────────────────────────────────────────────────────────────────────
const GhostCell = memo(function GhostCell({ cellStyle }) {
  const pulseAnim = useRef(new Animated.Value(GHOST_OPACITY)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: GHOST_OPACITY * 1.5,
          duration: 400, useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: GHOST_OPACITY,
          duration: 400, useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[cellStyle, styles.ghostCellContainer]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { 
            backgroundColor: '#00E5A0',
            opacity: pulseAnim 
          }
        ]}
      />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GameBoard
// ─────────────────────────────────────────────────────────────────────────────
function GameBoard({ grid, flashCells, ghost }) {
  // flashCells: null | { rows: [], cols: [] }
  // ghost: null | { r: number, c: number, shape: { layout: [[dr,dc],...] } }

  // Pre-compute ghost cell set for O(1) lookup
  const ghostCells = useMemo(() => {
    // Never show ghost while crush flash is active.
    if (!ghost || flashCells) return null;
    const set = new Set();
    ghost.shape.layout.forEach(([dr, dc]) => {
      set.add(`${ghost.r + dr}_${ghost.c + dc}`);
    });
    return set;
  }, [ghost, flashCells]);

  // Pre-compute crush cells: { key: delay } — cells in cleared rows/cols
  // with ripple delay based on distance from the drop origin
  const crushMap = useMemo(() => {
    if (!flashCells) return null;
    const map = {};
    const { rows, cols, origin } = flashCells;
    
    // If no origin (e.g. from a power-up), use center of board or simple index
    const originR = origin ? origin.r : 5;
    const originC = origin ? origin.c : 5;

    // Helper to add cell with distance-based delay
    const addCell = (r, c) => {
      const key = `${r}_${c}`;
      // Calculate Manhattan distance from origin
      const dist = Math.abs(r - originR) + Math.abs(c - originC);
      map[key] = dist * RIPPLE_DELAY_MS;
    };

    rows.forEach(r => {
      for (let c = 0; c < GRID_SIZE; c++) {
        addCell(r, c);
      }
    });

    cols.forEach(col => {
      for (let r = 0; r < GRID_SIZE; r++) {
        addCell(r, col);
      }
    });
    
    return map;
  }, [flashCells]);

  return (
    <View style={styles.board}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const key = `${r}_${c}`;
            const isObstacleCell = cell === '#555' || cell === '#2A3A56';
            const isAltEmpty = (r + c) % 2 === 0;

            const cellBase = [
              styles.cell,
              cell
                ? isObstacleCell
                  ? styles.obstacleCell
                  : [styles.filledCell, { backgroundColor: cell }]
                : [styles.emptyCell, isAltEmpty && styles.emptyCellAlt],
            ];

            // 1. Crush animation — highest priority
            if (crushMap && key in crushMap) {
              return (
                <CrushCell
                  key={`crush_${key}`}
                  color={cell || COLORS.accent}
                  delay={crushMap[key]}
                  cellStyle={cellBase}
                />
              );
            }

            // 2. Ghost preview
            if (ghostCells && ghostCells.has(key)) {
              return (
                <GhostCell
                  key={`ghost_${key}`}
                  cellStyle={[styles.cell, styles.ghostCell]}
                />
              );
            }

            // 3. Normal cell
            return <View key={key} style={cellBase} />;
          })}
        </View>
      ))}
    </View>
  );
}

export default memo(GameBoard);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  board: {
    width:           CELL_SIZE * GRID_SIZE + 2, // +2 for borders
    height:          CELL_SIZE * GRID_SIZE + 2, // +2 for borders
    backgroundColor: '#0A111D',
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     '#24314A',
    overflow:        'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    // Keep each tile's total footprint exactly CELL_SIZE with 0.5 margins
    // so the 10x10 grid fits the board container without edge gaps.
    width:        CELL_SIZE - 1,
    height:       CELL_SIZE - 1,
    margin:       0.5,
    borderRadius: 5,
  },
  emptyCell: {
    backgroundColor: '#1A2740',
    borderWidth:     1,
    borderColor:     '#33496E',
  },
  emptyCellAlt: {
    backgroundColor: '#1E2D48',
    borderColor: '#39517A',
  },
  filledCell: {
    // Subtle inner glow via shadow (iOS) / elevation (Android)
    shadowColor:   '#fff',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius:  3,
    elevation:     2,
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.22)',
  },
  obstacleCell: {
    backgroundColor: '#2A3A56',
    borderWidth: 1,
    borderColor: '#415779',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  ghostCell: {
    // Overrides for ghost cell look
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  ghostCellContainer: {
     overflow: 'hidden',
     borderRadius: CELL_SIZE * 0.25,
   },
  crushWrap: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
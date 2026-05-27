/**
 * src/components/DraggableBlock.js
 *
 * Upgrades in this version:
 *   1. Ghost preview: calls props.onDragMove(shape, absX, absY) during drag
 *      so GameBoard can show green placement overlay in real time
 *   2. Pick-up scale feedback: piece scales 1→1.12 on lift, snaps back on drop
 *   3. Bigger, glowing cells with stronger border and shadow
 *   4. Clears ghost on drag-end regardless of drop success
 *
 * Driver rules (unchanged):
 *   translateX / translateY / opacity / scale → useNativeDriver: true
 *   No JS-driver animations in this file.
 */

import React, { useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import {
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { CELL_SIZE } from '../constants/gameConfig';

// ── Cell sizes ────────────────────────────────────────────────────────────────
const TRAY_CELL = Math.round(CELL_SIZE * 0.72);   // base tray size
const DRAG_CELL = Math.round(CELL_SIZE * 1.02);   // slightly larger while dragging

// ─────────────────────────────────────────────────────────────────────────────
function DraggableBlock({ shape, onDrop, onDragMove, disabled }) {
  const translateX   = useRef(new Animated.Value(0)).current;
  const translateY   = useRef(new Animated.Value(0)).current;
  const dragOpacity  = useRef(new Animated.Value(0)).current;
  const trayOpacity  = useRef(new Animated.Value(1)).current;
  const dragScale    = useRef(new Animated.Value(1)).current;  // pick-up scale feedback
  const scaleX       = useRef(new Animated.Value(1)).current;
  const scaleY       = useRef(new Animated.Value(1)).current;
  const tilt         = useRef(new Animated.Value(0)).current;

  const trayRef    = useRef(null);
  const dragging   = useRef(false);
  const rafRef     = useRef(null);

  // If gameplay is interrupted (timeout modal, pause, win/lose) while dragging,
  // force-reset the floating clone so no "stuck block" remains on screen.
  useEffect(() => {
    if (!disabled) return;
    dragging.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onDragMove?.(shape, -9999, -9999);
    translateX.stopAnimation();
    translateY.stopAnimation();
    dragOpacity.stopAnimation();
    trayOpacity.stopAnimation();
    dragScale.stopAnimation();
    scaleX.stopAnimation();
    scaleY.stopAnimation();
    tilt.stopAnimation();
    translateX.setValue(0);
    translateY.setValue(0);
    dragOpacity.setValue(0);
    trayOpacity.setValue(1);
    dragScale.setValue(1);
    scaleX.setValue(1);
    scaleY.setValue(1);
    tilt.setValue(0);
  }, [disabled, onDragMove, shape, translateX, translateY, dragOpacity, trayOpacity, dragScale]);

  // ── Shape bounding box ────────────────────────────────────────────────────
  const rows   = shape.layout.map(([r]) => r);
  const cols   = shape.layout.map(([, c]) => c);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const spanRows = maxRow - minRow + 1;
  const spanCols = maxCol - minCol + 1;
  // Auto-fit preview so large shapes never overlap neighboring placeholders.
  const trayFootprint = Math.max(spanRows, spanCols) * TRAY_CELL;
  const trayFitScale = Math.min(1, (CELL_SIZE * 3.35) / trayFootprint);

  // ── Gesture event — ultra-fast response on all RNGH versions ──────────────
  const onGestureEvent = useMemo(() => Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    {
      useNativeDriver: true,
      listener: (e) => {
        if (disabled) return;
        const { absoluteX, absoluteY, velocityX } = e.nativeEvent;
        
        // Dynamic tilt based on horizontal velocity (capped)
        if (Math.abs(velocityX) > 30) {
          const targetTilt = Math.max(-12, Math.min(12, velocityX / 100));
          Animated.spring(tilt, {
            toValue: targetTilt,
            friction: 8,
            tension: 80,
            useNativeDriver: true,
          }).start();
        }

        if (!dragging.current) return;
        onDragMove?.(shape, absoluteX, absoluteY);
      },
    }
  ), [disabled, onDragMove, shape, translateX, translateY, tilt]);

  // ── State changes — BEGAN / END / CANCELLED / FAILED ─────────────────────
  const onHandlerStateChange = useCallback((e) => {
    if (disabled) return;

    const { state, absoluteX, absoluteY } = e.nativeEvent;

    if (state === State.BEGAN) {
      dragging.current = true;

      // Ultra-fast scale up clone, dim tray ghost + Squish/Stretch juice
      Animated.parallel([
        Animated.timing(dragOpacity, { toValue: 1,    duration: 40,  useNativeDriver: true }),
        Animated.timing(trayOpacity, { toValue: 0.15,  duration: 40,  useNativeDriver: true }),
        Animated.spring(dragScale,   { toValue: 1.15, friction: 4, tension: 300, useNativeDriver: true }),
        // Squish: stretch Y, compress X
        Animated.sequence([
          Animated.timing(scaleY, { toValue: 1.25, duration: 80, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scaleX, { toValue: 0.85, duration: 80, useNativeDriver: true }),
          Animated.spring(scaleX, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        ]),
      ]).start();
    }

    if (state === State.END) {
      dragging.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clear ghost
      onDragMove?.(shape, -9999, -9999);

      // INSTANT hide on drop for snappy feel. 
      // If the drop is successful, the block appears on the grid immediately.
      // If it fails, it simply "teleports" back to the tray, which feels faster.
      dragOpacity.setValue(0);
      trayOpacity.setValue(1);
      dragScale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      scaleX.setValue(1);
      scaleY.setValue(1);
      tilt.setValue(0);

      onDrop(shape, absoluteX, absoluteY);
      return;
    }

    if (state === State.CANCELLED || state === State.FAILED) {
      dragging.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clear ghost
      onDragMove?.(shape, -9999, -9999);

      // Ultra-fast snap back for failures
      Animated.parallel([
        Animated.timing(dragOpacity, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.timing(trayOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.spring(dragScale,   { toValue: 1, friction: 4, tension: 320, useNativeDriver: true }),
        Animated.spring(translateX,  { toValue: 0, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.spring(translateY,  { toValue: 0, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.spring(scaleX,      { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.spring(scaleY,      { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.spring(tilt,        { toValue: 0, friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [shape, onDrop, onDragMove, disabled,
      translateX, translateY, dragOpacity, trayOpacity, dragScale]);

  // ── Render single cell block ──────────────────────────────────────────────
  const renderBlock = useCallback((cellSize, glowing) => ([dr, dc]) => (
    <View
      key={`${dr}_${dc}`}
      style={{
        position:        'absolute',
        width:           cellSize,
        height:          cellSize,
        borderRadius:    cellSize * 0.32,
        backgroundColor: shape.color,
        top:             (dr - minRow) * cellSize,
        left:            (dc - minCol) * cellSize,
        // Enhanced glow and shadow for juicier look
        borderWidth:     glowing ? 1.2 : 0.5,
        borderColor:     glowing ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)',
        shadowColor:     shape.color,
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   glowing ? 0.85 : 0.15,
        shadowRadius:    glowing ? 10  : 2,
        elevation:       glowing ? 8   : 1,
      }}
    />
  ), [shape.color, minRow, minCol]);

  const traySize = useMemo(() => ({ width: spanCols * TRAY_CELL, height: spanRows * TRAY_CELL }), [spanCols, spanRows]);
  const dragSize = useMemo(() => ({ width: spanCols * DRAG_CELL, height: spanRows * DRAG_CELL }), [spanCols, spanRows]);

  return (
    <View style={styles.wrapper}>
      <PanGestureHandler
        onGestureEvent={disabled ? undefined : onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!disabled}
        minDist={1}
      >
        {/* Tray piece — dims while dragging */}
        <Animated.View
          ref={trayRef}
          style={[styles.piece, traySize, { opacity: trayOpacity, transform: [{ scale: trayFitScale }] }]}
        >
          {shape.layout.map(renderBlock(TRAY_CELL, false))}
        </Animated.View>
      </PanGestureHandler>

      {/* Floating drag clone — follows finger */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dragClone,
          dragSize,
          {
            opacity:   dragOpacity,
            transform: [
              { translateX },
              { translateY },
              { scale: dragScale },
              { scaleX },
              { scaleY },
              { rotate: tilt.interpolate({
                  inputRange: [-30, 30],
                  outputRange: ['-30deg', '30deg']
                })
              },
            ],
          },
        ]}
      >
        {shape.layout.map(renderBlock(DRAG_CELL, true))}
      </Animated.View>
    </View>
  );
}

export default memo(DraggableBlock);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    minHeight: DRAG_CELL * 2.7,
    minWidth: DRAG_CELL * 2.5,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  piece: {
    position: 'relative',
    padding: 2,
  },
  dragClone: {
    position:  'absolute',
    zIndex:    999,
    elevation: 24,
  },
});
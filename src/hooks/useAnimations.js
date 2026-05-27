/**
 * src/hooks/useAnimations.js
 *
 * DRIVER RULE (never violate):
 *   Native driver (true)  → transform / opacity only
 *   JS driver    (false)  → width / backgroundColor / borderColor only
 *   One Animated.Value is NEVER shared across both types.
 *
 * New in this version:
 *   dangerShake      — stronger continuous shake in danger mode (native, translateX)
 *   dangerGlow       — red pulsing border in danger mode (JS, borderColor)
 *   dangerPulse      — board scale throb in danger mode (native, scale)
 *   triggerDangerMode(active, intensity) — starts/stops danger animations
 */

import { useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import { getDifficultyConfig } from './useGameEngine';

// ── Timing constants ─────────────────────────────────────────────────────────
const SHAKE_DURATION        = 38;
const DANGER_SHAKE_DURATION = 28;   // faster than normal shake
const MODAL_SPRING          = { friction: 5, tension: 180, useNativeDriver: true };
const SCORE_POP_SPRING      = { friction: 4, tension: 300, useNativeDriver: true };

// ─────────────────────────────────────────────────────────────────────────────
export function useAnimations() {

  // ── Native-driver values (transform / opacity ONLY) ───────────────────────
  const shakeAnim     = useRef(new Animated.Value(0)).current;  // translateX (drop shake)
  const modalPopAnim  = useRef(new Animated.Value(0)).current;  // scale
  const scorePopAnim  = useRef(new Animated.Value(1)).current;  // scale
  const comboOpacity  = useRef(new Animated.Value(0)).current;  // opacity
  const comboScale    = useRef(new Animated.Value(0.5)).current;// scale
  const boardPulse    = useRef(new Animated.Value(1)).current;  // scale (clear pulse)
  const consentFade   = useRef(new Animated.Value(0)).current;  // opacity
  const dangerPulse   = useRef(new Animated.Value(1)).current;  // scale (danger throb)
  const dangerShakeX  = useRef(new Animated.Value(0)).current;  // translateX (danger)
  const placeAnim     = useRef(new Animated.Value(1)).current;  // scale (place bump)
  const successPop    = useRef(new Animated.Value(0)).current;  // scale (success pop)

  // ── JS-driver values (width ONLY) ────────────────────────────────────────
  const timerBarAnim  = useRef(new Animated.Value(1)).current;  // width %

  // ── Native-driver values (transform / opacity ONLY) ───────────────────────
  const pressureGlow  = useRef(new Animated.Value(0)).current;  // opacity (pressure)
  const dangerGlow    = useRef(new Animated.Value(0)).current;  // opacity (danger)

  // Track whether danger loop is running so we can stop it
  const dangerLoopRef = useRef(null);
  const dangerPulseLoopRef = useRef(null);
  const dangerShakeLoopRef = useRef(null);

  // ── Derived interpolations ────────────────────────────────────────────────
  const timerColor = timerBarAnim.interpolate({
    inputRange:  [0, 0.2, 1],
    outputRange: ['#FF3D00', '#FF9F00', '#00E5A0'],
  });

  // Pressure border: orange → red as board fills
  const pressureBorderColor = pressureGlow.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(255,159,0,0.6)', 'rgba(255,61,0,0.9)'],
  });

  // Danger border: red pulse, intensity scales with how close to 0
  // dangerGlow goes 0→1 on loop; App blends both borders via a View wrapper
  const dangerBorderColor = dangerGlow.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: ['rgba(255,30,0,0.0)', 'rgba(255,30,0,0.7)', 'rgba(255,30,0,1.0)'],
  });

  // ── resetAll ─────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    // Stop danger loops first
    dangerLoopRef.current?.stop();
    dangerPulseLoopRef.current?.stop();
    dangerShakeLoopRef.current?.stop();
    dangerLoopRef.current      = null;
    dangerPulseLoopRef.current = null;
    dangerShakeLoopRef.current = null;

    [shakeAnim, modalPopAnim, scorePopAnim, comboOpacity, comboScale,
     boardPulse, pressureGlow, timerBarAnim, dangerGlow, dangerPulse,
     dangerShakeX, consentFade, placeAnim, successPop].forEach(a => a.stopAnimation());

    shakeAnim.setValue(0);
    modalPopAnim.setValue(0);
    scorePopAnim.setValue(1);
    comboOpacity.setValue(0);
    comboScale.setValue(0.5);
    boardPulse.setValue(1);
    pressureGlow.setValue(0);
    dangerGlow.setValue(0);
    dangerPulse.setValue(1);
    dangerShakeX.setValue(0);
    consentFade.setValue(0);
    placeAnim.setValue(1);
    successPop.setValue(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer bar ─────────────────────────────────────────────────────────────
  const setupTimerAnim = useCallback((duration) => {
    timerBarAnim.stopAnimation();
    timerBarAnim.setValue(1);
    const anim = Animated.timing(timerBarAnim, {
      toValue: 0, duration: duration * 1000,
      easing: Easing.linear, useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [timerBarAnim]);

  const restartTimerAnim = useCallback((remainingSeconds, level) => {
    timerBarAnim.stopAnimation();
    const total    = getDifficultyConfig(level).timerDuration;
    const fraction = remainingSeconds / total;
    timerBarAnim.setValue(fraction);
    const anim = Animated.timing(timerBarAnim, {
      toValue: 0, duration: remainingSeconds * 1000,
      easing: Easing.linear, useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [timerBarAnim]);

  // ── Score pop ────────────────────────────────────────────────────────────
  const triggerScorePop = useCallback(() => {
    scorePopAnim.stopAnimation();
    scorePopAnim.setValue(1.35);
    Animated.spring(scorePopAnim, { toValue: 1, ...SCORE_POP_SPRING }).start();
  }, [scorePopAnim]);

  // ── Combo ────────────────────────────────────────────────────────────────
  const triggerComboAnim = useCallback(() => {
    comboOpacity.stopAnimation();
    comboScale.stopAnimation();
    comboOpacity.setValue(1);
    comboScale.setValue(0.35);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(comboScale,   { toValue: 1.18, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.spring(comboScale,   { toValue: 1, friction: 5, tension: 230, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(680),
        Animated.timing(comboOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, [comboOpacity, comboScale]);

  // ── Drop shake (normal — native) ─────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  9, duration: SHAKE_DURATION, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: SHAKE_DURATION, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  5, duration: SHAKE_DURATION, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: SHAKE_DURATION, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: SHAKE_DURATION, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Clear board pulse ────────────────────────────────────────────────────
  const triggerBoardPulse = useCallback((intensity = 1) => {
    const up = Math.min(1.06, 1 + 0.03 * intensity);
    const down = Math.max(0.975, 1 - 0.015 * intensity);
    boardPulse.stopAnimation();
    Animated.sequence([
      Animated.timing(boardPulse, { toValue: up, duration: 68, useNativeDriver: true }),
      Animated.timing(boardPulse, { toValue: down, duration: 92, useNativeDriver: true }),
      Animated.timing(boardPulse, { toValue: 1,     duration: 120, useNativeDriver: true }),
    ]).start();
  }, [boardPulse]);

  // ── Juicy Clear (Intense board pulse + shake) ────────────────────────────
  const triggerJuicyClear = useCallback((intensity = 1) => {
    // Stop place bump if it's running, clear takes priority
    placeAnim.stopAnimation();
    placeAnim.setValue(1);

    // Intense board pulse
    const up = Math.min(1.12, 1 + 0.06 * intensity);
    const down = Math.max(0.95, 1 - 0.03 * intensity);
    boardPulse.stopAnimation();
    Animated.sequence([
      Animated.timing(boardPulse, { toValue: up, duration: 50, useNativeDriver: true }),
      Animated.timing(boardPulse, { toValue: down, duration: 70, useNativeDriver: true }),
      Animated.timing(boardPulse, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    // Intense shake
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    const amt = 12 * intensity;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  amt, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -amt, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  amt * 0.7, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -amt * 0.7, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 30, useNativeDriver: true }),
    ]).start();
  }, [boardPulse, shakeAnim, placeAnim]);

  // ── Place Juice (Bump effect when block lands) ──────────────────────────
  const triggerPlaceJuice = useCallback(() => {
    // We don't check boardPulse._value directly as it's unreliable.
    // Instead, triggerJuicyClear will handle stopping this if a clear occurs.
    placeAnim.stopAnimation();
    placeAnim.setValue(1);
    Animated.sequence([
      Animated.timing(placeAnim, { toValue: 1.05, duration: 35, useNativeDriver: true }),
      Animated.timing(placeAnim, { toValue: 0.97, duration: 45, useNativeDriver: true }),
      Animated.timing(placeAnim, { toValue: 1,    duration: 60, useNativeDriver: true }),
    ]).start();
  }, [placeAnim]);

  // ── Success Pop (Explosive scale for specific elements) ──────────────────
  const triggerSuccessPop = useCallback(() => {
    successPop.stopAnimation();
    successPop.setValue(0);
    Animated.sequence([
      Animated.timing(successPop, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(successPop, { toValue: 1,   duration: 150, useNativeDriver: true }),
    ]).start();
  }, [successPop]);

  // ── Pressure glow (Native driver — opacity) ──────────────────────────────
  const triggerPressureAnim = useCallback((ratio) => {
    pressureGlow.stopAnimation();
    if (ratio >= 0.9) {
      Animated.sequence([
        Animated.timing(pressureGlow, { toValue: 1,   duration: 200, useNativeDriver: true }),
        Animated.timing(pressureGlow, { toValue: 0.4, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (ratio >= 0.8) {
      Animated.timing(pressureGlow, { toValue: 0.5, duration: 400, useNativeDriver: true }).start();
    } else {
      Animated.timing(pressureGlow, { toValue: 0,   duration: 600, useNativeDriver: true }).start();
    }
  }, [pressureGlow]);

  // ── DANGER MODE animations ────────────────────────────────────────────────
  // intensity: 0–1 (0.5 = ≤20s, 1.0 = ≤10s)
  // Danger mode uses THREE separate animated values — all correctly typed:
  //   dangerGlow   → JS driver (borderColor)
  //   dangerPulse  → native driver (scale)
  //   dangerShakeX → native driver (translateX)
  const triggerDangerMode = useCallback((active, intensity = 0.5) => {
    if (!active) {
      // Stop all danger loops
      dangerLoopRef.current?.stop();
      dangerPulseLoopRef.current?.stop();
      dangerShakeLoopRef.current?.stop();
      dangerLoopRef.current      = null;
      dangerPulseLoopRef.current = null;
      dangerShakeLoopRef.current = null;

      // Animate back to neutral
      Animated.timing(dangerGlow,   { toValue: 0, duration: 400, useNativeDriver: true }).start();
      Animated.timing(dangerPulse,  { toValue: 1, duration: 300, useNativeDriver: true  }).start();
      Animated.timing(dangerShakeX, { toValue: 0, duration: 200, useNativeDriver: true  }).start();
      return;
    }

    // ── Danger glow loop (Native driver — opacity) ─────────────────────────
    const glowSpeed  = intensity >= 1 ? 250 : 400;
    const glowPeak   = intensity >= 1 ? 1.0 : 0.75;

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dangerGlow, { toValue: glowPeak, duration: glowSpeed,  useNativeDriver: true }),
        Animated.timing(dangerGlow, { toValue: 0.2,      duration: glowSpeed,  useNativeDriver: true }),
      ])
    );
    dangerLoopRef.current?.stop();
    dangerLoopRef.current = glowLoop;
    glowLoop.start();

    // ── Danger scale throb (native driver — scale) ────────────────────────
    const pulseAmount = intensity >= 1 ? 1.012 : 1.006;
    const pulseSpeed  = intensity >= 1 ? 180 : 280;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dangerPulse, { toValue: pulseAmount, duration: pulseSpeed, useNativeDriver: true }),
        Animated.timing(dangerPulse, { toValue: 1,           duration: pulseSpeed, useNativeDriver: true }),
      ])
    );
    dangerPulseLoopRef.current?.stop();
    dangerPulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    // ── Danger micro-shake (native driver — translateX) ───────────────────
    // Only runs at full intensity (≤10s) — subtle left-right tremble
    if (intensity >= 1) {
      const shakeAmt  = 3;
      const shakeSpd  = DANGER_SHAKE_DURATION;
      const shakeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dangerShakeX, { toValue:  shakeAmt, duration: shakeSpd, useNativeDriver: true }),
          Animated.timing(dangerShakeX, { toValue: -shakeAmt, duration: shakeSpd, useNativeDriver: true }),
          Animated.timing(dangerShakeX, { toValue:  0,        duration: shakeSpd, useNativeDriver: true }),
        ])
      );
      dangerShakeLoopRef.current?.stop();
      dangerShakeLoopRef.current = shakeLoop;
      shakeLoop.start();
    } else {
      // Stop micro-shake if downgrading from fast → normal
      dangerShakeLoopRef.current?.stop();
      dangerShakeLoopRef.current = null;
      Animated.timing(dangerShakeX, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Modal pop ────────────────────────────────────────────────────────────
  const triggerModalPop = useCallback(() => {
    modalPopAnim.stopAnimation();
    Animated.spring(modalPopAnim, { toValue: 1, ...MODAL_SPRING }).start();
  }, [modalPopAnim]);

  // ── Consent fade ─────────────────────────────────────────────────────────
  const fadeInConsent = useCallback(() => {
    consentFade.stopAnimation();
    consentFade.setValue(0);
    Animated.timing(consentFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [consentFade]);

  return {
    // Values
    shakeAnim, modalPopAnim, scorePopAnim, comboOpacity, comboScale,
    timerBarAnim, boardPulse, pressureGlow, consentFade,
    dangerGlow, dangerPulse, dangerShakeX, placeAnim, successPop,
    // Interpolations
    timerColor, pressureBorderColor, dangerBorderColor,
    // Actions
    resetAll,
    setupTimerAnim,
    restartTimerAnim,
    triggerScorePop,
    triggerComboAnim,
    triggerShake,
    triggerBoardPulse,
    triggerJuicyClear,
    triggerPlaceJuice,
    triggerSuccessPop,
    triggerPressureAnim,
    triggerDangerMode,
    triggerModalPop,
    fadeInConsent,
  };
}
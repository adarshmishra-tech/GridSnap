/**
 * src/components/SplashScreen.js
 *
 * Animated splash screen shown at app launch.
 * Calls props.onFinish() after the animation completes.
 *
 * Animation sequence:
 *   1. Logo fades in + scales up  (600ms)
 *   2. Tagline fades in           (400ms, overlapping)
 *   3. Hold                       (600ms)
 *   4. Everything fades out       (400ms)
 *   5. onFinish() called
 *
 * All animations use useNativeDriver: true (opacity + scale only).
 */

import React, { useEffect, useRef, memo } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/gameConfig';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(SW / 390, 1.4);
const rs    = (n) => Math.round(n * SCALE);

function SplashScreen({ onFinish }) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.78)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.7)).current;
  const shimmerX = useRef(new Animated.Value(-rs(240))).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const particles = useRef(
    Array.from({ length: 10 }, (_, i) => ({
      x: new Animated.Value((i % 5) * rs(70) - rs(120)),
      y: new Animated.Value(rs(180) + Math.floor(i / 5) * rs(90)),
      o: new Animated.Value(0.12 + (i % 3) * 0.08),
    }))
  ).current;

  useEffect(() => {
    const particleLoops = particles.map((p, i) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.parallel([
            Animated.timing(p.y, { toValue: -rs(190), duration: 2800 + i * 180, useNativeDriver: true }),
            Animated.timing(p.o, { toValue: 0.02, duration: 2800 + i * 180, useNativeDriver: true }),
          ]),
          Animated.timing(p.y, { toValue: rs(200), duration: 0, useNativeDriver: true }),
          Animated.timing(p.o, { toValue: 0.16, duration: 0, useNativeDriver: true }),
        ])
      )
    ));
    particleLoops.forEach((l) => l.start());

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.68, duration: 900, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    Animated.sequence([
      Animated.timing(bgOpacity, {
        toValue: 1, duration: 420, useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 560, useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1, friction: 6, tension: 150, useNativeDriver: true,
        }),
      ]),
      Animated.timing(tagOpacity, {
        toValue: 1, duration: 420, useNativeDriver: true,
      }),
      Animated.timing(shimmerX, {
        toValue: rs(240), duration: 600, useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 360, useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish?.();
    });
    return () => {
      glowLoop.stop();
      particleLoops.forEach((l) => l.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.safeRoot} edges={['top', 'right', 'left', 'bottom']}>
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <LinearGradient colors={['#020305', '#070A14', '#04060B']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[styles.particle, {
            opacity: p.o,
            transform: [{ translateX: p.x }, { translateY: p.y }],
          }]}
        />
      ))}

      <Animated.View style={{
        opacity:   logoOpacity,
        transform: [{ scale: logoScale }],
        alignItems: 'center',
      }}>
        <Animated.View style={[styles.logoGlow, { opacity: glowPulse, transform: [{ scale: glowPulse }] }]} />
        {/* Logo mark — simple geometric grid icon */}
        <View style={styles.logoMark}>
          {[0, 1, 2].map(row => (
            <View key={row} style={styles.markRow}>
              {[0, 1, 2].map(col => (
                <View
                  key={col}
                  style={[
                    styles.markCell,
                    // Accent colour for a diagonal pattern
                    (row + col) % 2 === 0 && { backgroundColor: COLORS.accent },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.logoText}>
          GRID<Text style={{ color: COLORS.accent }}>SNAP</Text>
        </Text>
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]} />
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        PLACE · SNAP · CLEAR
      </Animated.Text>
    </Animated.View>
    </SafeAreaView>
  );
}

export default memo(SplashScreen);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: '#020204',
  },
  container: {
    flex:            1,
    backgroundColor: '#020204',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             rs(24),
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    width: rs(5),
    height: rs(5),
    borderRadius: rs(3),
    backgroundColor: COLORS.accent,
  },
  logoGlow: {
    position: 'absolute',
    width: rs(220),
    height: rs(220),
    borderRadius: rs(110),
    backgroundColor: 'rgba(0,229,160,0.16)',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  logoMark: {
    marginBottom: rs(20),
  },
  markRow: {
    flexDirection: 'row',
  },
  markCell: {
    width:           rs(18),
    height:          rs(18),
    margin:          rs(2),
    borderRadius:    rs(3),
    backgroundColor: '#1C1C1C',
  },
  logoText: {
    color:       '#FFF',
    fontSize:    rs(58),
    fontWeight:  '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(255,255,255,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  shimmer: {
    position: 'absolute',
    top: rs(84),
    width: rs(88),
    height: rs(14),
    borderRadius: rs(7),
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tagline: {
    color:         '#5D677A',
    fontSize:      rs(12),
    letterSpacing: 6,
    fontWeight:    '600',
    position:      'absolute',
    bottom:        rs(80),
  },
});
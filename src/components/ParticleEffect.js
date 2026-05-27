/**
 * src/components/ParticleEffect.js
 *
 * ULTRA-OPTIMIZED particle system using single Animated.Value per particle.
 * GPU-accelerated spring animations for smooth 60fps performance.
 */

import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, Easing } from 'react-native';

// ─── Particle configuration ──────────────────────────────────────────────────
const PARTICLE_COUNT = 12;  // Reduced from 24 for better performance
const BURST_DURATION = 600;  // Quicker burst

// ─────────────────────────────────────────────────────────────────────────────
const Particle = memo(function Particle({ index, originX, originY, color }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Random burst direction with more spread
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 1.2;
    const distance = 60 + Math.random() * 120;  // Increased range
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance - 60;  // More upward bias

    const randomRotation = (Math.random() - 0.5) * 720; // Multiple spins

    Animated.parallel([
      Animated.sequence([
        Animated.spring(translateX, {
          toValue: targetX,
          friction: 4,  // Bouncier
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(translateY, {
          toValue: targetY + 140,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotate, {
        toValue: randomRotation,
        duration: BURST_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),  // Hold at full opacity slightly longer
        Animated.timing(opacity, {
          toValue: 0,
          duration: BURST_DURATION * 0.7,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 2.5,  // Even bigger initial burst
          friction: 3,
          tension: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0,
          duration: BURST_DURATION * 0.6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [index, originX, originY, color, translateX, translateY, opacity, scale, rotate]);

  const size = 4 + Math.random() * 8;  // More varied sizes
  const borderRadius = Math.random() > 0.4 ? size / 2 : size * 0.15;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: originX,
        top: originY,
        width: size,
        height: size,
        borderRadius: borderRadius,
        backgroundColor: color,
        opacity,
        transform: [
          { translateX },
          { translateY },
          { scale },
          { rotate: rotate.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg']
            })
          }
        ],
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 10,
      }}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
function ParticleEffect({ active, x, y, color, onComplete }) {
  if (!active) return null;

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => i);

  // Auto-cleanup after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, BURST_DURATION + 200);
    return () => clearTimeout(timer);
  }, [active, onComplete]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {particles.map((i) => (
        <Particle
          key={`${active}-${i}`}
          index={i}
          originX={x}
          originY={y}
          color={color}
        />
      ))}
    </View>
  );
}

export default memo(ParticleEffect);

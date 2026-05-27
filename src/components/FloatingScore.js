import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants/gameConfig';

export default function FloatingScore({ value, x, y, boost = false, label = '', onComplete }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    finishedRef.current = false;
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(boost ? 700 : 520),
        Animated.timing(opacity, { toValue: 0, duration: boost ? 760 : 620, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.spring(scale, { toValue: boost ? 1.1 : 1.04, friction: 5, tension: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 190, useNativeDriver: true }),
      ]),
      // Juicy jitter
      Animated.sequence([
        Animated.timing(translateX, { toValue: (Math.random() - 0.5) * 20, duration: 100, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: (Math.random() - 0.5) * 10, duration: 100, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
      Animated.timing(translateY, {
        toValue: boost ? -140 : -110,
        duration: boost ? 1600 : 1300,
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished && !finishedRef.current) {
        finishedRef.current = true;
        onCompleteRef.current?.();
      }
    });
    return () => {
      anim.stop();
    };
  }, [boost, opacity, scale, translateY]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          left: x,
          top: y,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      <Animated.Text style={[styles.txt, boost && styles.boostTxt]}>
        +{Number(value || 0).toLocaleString()}
      </Animated.Text>
      <Animated.Text style={[styles.label, boost && styles.boostLabel]}>
        {label || (boost ? 'CRUSH!' : 'NICE!')}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    minWidth: 140,
    alignItems: 'center',
    backgroundColor: 'rgba(7,12,20,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(150,190,240,0.72)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 999,
    elevation: 999,
  },
  txt: {
    color: COLORS.accent,
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(44,246,200,0.75)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
    includeFontPadding: false,
  },
  boostTxt: {
    color: '#FFE082',
    textShadowColor: 'rgba(255,208,0,0.78)',
    fontSize: 40,
  },
  label: {
    marginTop: 2,
    color: '#D9E6FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  boostLabel: {
    color: '#FFF1A8',
  },
});
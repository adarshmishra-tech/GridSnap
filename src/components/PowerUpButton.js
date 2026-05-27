/**
 * src/components/PowerUpButton.js
 * 
 * Reusable power-up button component for the header.
 * Shows icon, count, and handles tap to activate.
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { POWER_UPS } from '../constants/powerUps';

function PowerUpButton({ type, count, onPress, disabled }) {
  const powerUp = POWER_UPS[type];
  if (!powerUp || count <= 0) return null;

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={() => onPress(type)}
      activeOpacity={0.6}
      disabled={disabled || count <= 0}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.icon}>{powerUp.icon}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default memo(PowerUpButton);

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 30, 50, 0.9)',
    borderWidth: 1.5,
    borderColor: '#2A3A56',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
});

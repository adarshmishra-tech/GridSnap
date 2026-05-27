/**
 * src/components/NotificationConsent.js
 *
 * Beautiful, Play Store-compliant notification permission dialog
 * that explains the value before asking for permission.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import {
  enableNotifications,
  disableNotifications,
  isNotificationEnabled,
} from '../utils/notificationManager';

const { width: SW } = Dimensions.get('window');
const rs = (n) => Math.round(n * Math.min(SW / 390, 1.4));

// ─── Engaging benefit messages ───────────────────────────────────────────────
const BENEFITS = [
  {
    icon: '🔥',
    title: 'Daily Challenges',
    description: 'New puzzles every day',
  },
  {
    icon: '⚡',
    title: 'Streak Protection',
    description: 'Never lose your progress',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
function NotificationConsent({ visible, onClose, onEnabled }) {
  const [isLoading, setIsLoading] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleEnable = async () => {
    setIsLoading(true);

    try {
      const result = await enableNotifications({
        dailyReminder: true,
        dailyHour: 18, // 6 PM
        dailyMinute: 0,
        streakReminder: true,
        streakHour: 20, // 8 PM
        streakMinute: 0,
        reengagement: true,
        reengagementHours: 24,
      });

      if (result.success) {
        onEnabled?.();
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
      onClose?.();
    }
  };

  const handleSkip = async () => {
    await disableNotifications();
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleSkip}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🔔</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Stay in the Game!</Text>
          <Text style={styles.subtitle}>
            Get reminders to play and maintain your streak
          </Text>

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            {BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                <View style={styles.benefitTextContainer}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>
                    {benefit.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              🔒 Turn off anytime in settings
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleEnable}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'ENABLING...' : 'ENABLE'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSkip}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>NOT NOW</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

export default NotificationConsent;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#121A2A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A3650',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A2538',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: '#8FA1BF',
    fontSize: 14,
    fontWeight: '700',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A2538',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2CF6C8',
    shadowColor: '#2CF6C8',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#8FA1BF',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  benefitsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1420',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  benefitDescription: {
    color: '#5C6E8D',
    fontSize: 11,
    lineHeight: 14,
  },
  privacyNote: {
    alignItems: 'center',
    padding: 8,
    marginBottom: 16,
  },
  privacyText: {
    color: '#4A5A74',
    fontSize: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#2CF6C8',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#2CF6C8',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#5C6E8D',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

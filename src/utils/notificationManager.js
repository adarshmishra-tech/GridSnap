/**
 * src/utils/notificationManager.js
 *
 * Play Store-compliant notification system with engaging messages
 * to encourage players to return and play GridSnap.
 * 
 * Features:
 *   - Permission-first approach (asks user consent)
 *   - Scheduled local notifications with best timing
 *   - Engaging, motivational messages
 *   - Customizable notification frequency
 *   - Respects user preferences
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// ─── Notification Configuration ───────────────────────────────────────────────
const NOTIFICATION_PREFS_KEY = '@gridsnap_notification_prefs';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Engaging Notification Messages ──────────────────────────────────────────
// Categorized by time of day and player motivation psychology
const NOTIFICATION_MESSAGES = {
  // Short absence (2-6 hours) - Casual reminder
  shortAbsence: [
    {
      title: "🎮 Your Grid is Calling!",
      body: "One quick round to beat your best? The blocks are ready to snap!",
    },
    {
      title: "⚡ Quick Puzzle Rush?",
      body: "You were on a roll! Come back and clear just one more board.",
    },
    {
      title: "🧩 Missing that Snap?",
      body: "Nothing beats a perfect clear. Come get your fix of satisfying puzzles!",
    },
  ],

  // Medium absence (6-12 hours) - Motivational
  mediumAbsence: [
    {
      title: "🔥 You're a Natural!",
      body: "The leaderboard is waiting. Come show everyone how it's done!",
    },
    {
      title: "🎯 New High Score Incoming?",
      body: "We've got a feeling your next game is going to be legendary. Try now!",
    },
    {
      title: "✨ Pure Satisfaction Awaits",
      body: "The board is clear and the blocks are fresh. Come experience the ultimate snap!",
    },
    {
      title: "💪 Ready to Crush it?",
      body: "Your skills are sharp. Don't let them go to waste! Jump back in.",
    },
  ],

  // Long absence (12-24 hours) - Urgency + FOMO
  longAbsence: [
    {
      title: "🚨 STREAK AT RISK!",
      body: "Don't let your hard work vanish! Play now to protect your daily streak.",
    },
    {
      title: "⏰ The Clock is Ticking!",
      body: "Your daily rewards are waiting to be claimed. Don't miss out on free power-ups!",
    },
    {
      title: "🏆 Legend in the Making",
      body: "You're so close to the next big milestone. One more game to claim your glory!",
    },
    {
      title: "😱 They're Passing You!",
      body: "Other players are climbing the ranks. Take back your spot on top!",
    },
  ],

  // Very long absence (24+ hours) - Come back messaging
  veryLongAbsence: [
    {
      title: "🎁 WELCOME BACK GIFT!",
      body: "We've missed your skills! Come back now for a special return bonus.",
    },
    {
      title: "👋 We Miss Your Snaps!",
      body: "The grid hasn't been the same without you. Ready for a fresh start?",
    },
    {
      title: "💫 Massive Updates Await!",
      body: "New levels and challenges have been added. Come see what's new!",
    },
    {
      title: "🌟 Reclaim Your Throne",
      body: "The blocks are waiting for their master. Come back and show them who's boss!",
    },
  ],

  // Morning motivation (6 AM - 12 PM)
  morning: [
    {
      title: "🌅 Morning Victory?",
      body: "Start your day with a perfect line clear. The ultimate morning boost!",
    },
    {
      title: "☀️ Wake Up & Snap!",
      body: "Your brain is fresh and the grid is waiting. Can you set a new record?",
    },
    {
      title: "🎯 Coffee & GridSnap",
      body: "The perfect morning pair. Sharpen your mind with a quick round!",
    },
    {
      title: "⚡ Rise, Shine, and Crush!",
      body: "New day, new goals. Let's make today your highest scoring day yet!",
    },
  ],

  // Afternoon engagement (12 PM - 5 PM)
  afternoon: [
    {
      title: "🔥 Mid-Day Power Play!",
      body: "Break time is GridSnap time. One quick game for a mental recharge!",
    },
    {
      title: "🎮 Quick Win Needed?",
      body: "3 minutes to glory. Challenge yourself and feel the satisfaction!",
    },
    {
      title: "💪 The 2 PM Rush",
      body: "Beat the afternoon slump with some high-speed block snapping!",
    },
    {
      title: "🧩 Perfect Break Time",
      body: "Satisfying clears, huge combos. You know you want to!",
    },
  ],

  // Evening wind-down (5 PM - 10 PM)
  evening: [
    {
      title: "🌟 Evening Glory!",
      body: "Unwind with the most satisfying puzzles on the Play Store. You earned it!",
    },
    {
      title: "🏆 One More Round?",
      body: "The night is young and the combos are calling. Just one more game!",
    },
    {
      title: "🎯 Finish the Day Strong",
      body: "Can you beat one more level before calling it a night? We bet you can!",
    },
    {
      title: "✨ Relaxing Snaps",
      body: "Clear your mind by clearing some lines. The ultimate evening zen.",
    },
  ],

  // Late night (10 PM - 6 AM) - Less frequent, gentle
  night: [
    {
      title: "🌙 Late Night Legend?",
      body: "The best scores happen at night. One quick game before you dream?",
    },
    {
      title: "😴 The Perfect Wind-down",
      body: "Quiet night, satisfying snaps. End your day with a win.",
    },
  ],

  // Streak reminders (for daily engagement)
  streak: [
    {
      title: "🔥 PROTECT YOUR STREAK!",
      body: "You've worked too hard to lose it now! Play 1 game to keep it alive.",
    },
    {
      title: "⚡ STREAK IMMUNITY!",
      body: "Play now to lock in your daily streak and earn bonus rewards!",
    },
    {
      title: "🎖️ THE STREAK CONTINUES",
      body: "You're on fire! Keep the momentum going and become a GridSnap Legend.",
    },
  ],

  // Achievement-based motivation
  achievement: [
    {
      title: "🏅 SO CLOSE TO GLORY!",
      body: "You're 90% of the way to your next achievement. Finish it now!",
    },
    {
      title: "🎯 Trophy Hunter",
      body: "A new reward is waiting for you. Come and claim what's yours!",
    },
  ],

  // General motivation (fallback)
  general: [
    {
      title: "🎮 GridSnap is Calling!",
      body: "The most satisfying block puzzle awaits. Ready to snap?",
    },
    {
      title: "🧩 Snap, Clear, Win!",
      body: "Simple, addictive, and purely satisfying. Come play now!",
    },
    {
      title: "💫 Your Daily Fix",
      body: "Get your dose of satisfying line clears and huge combos!",
    },
    {
      title: "🚀 To the Moon!",
      body: "Your high score is waiting for a boost. Let's go!",
    },
    {
      title: "✨ Pure Satisfaction",
      body: "Nothing beats that feeling of a 4-line clear. Come experience it!",
    },
    {
      title: "🎪 The Ultimate Challenge",
      body: "Think you're the best? Prove it on the grid right now!",
    },
  ],
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get time-appropriate notification message
 */
const getTimeAppropriateMessage = () => {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
    return getRandomMessage(NOTIFICATION_MESSAGES.morning);
  } else if (hour >= 12 && hour < 17) {
    return getRandomMessage(NOTIFICATION_MESSAGES.afternoon);
  } else if (hour >= 17 && hour < 22) {
    return getRandomMessage(NOTIFICATION_MESSAGES.evening);
  } else {
    return getRandomMessage(NOTIFICATION_MESSAGES.night);
  }
};

/**
 * Get absence-based notification message (SMART - like modern apps)
 */
const getAbsenceBasedMessage = (hoursSinceLastPlay) => {
  if (hoursSinceLastPlay < 2) {
    return null; // Don't notify if played recently
  } else if (hoursSinceLastPlay < 6) {
    return getRandomMessage(NOTIFICATION_MESSAGES.shortAbsence);
  } else if (hoursSinceLastPlay < 12) {
    return getRandomMessage(NOTIFICATION_MESSAGES.mediumAbsence);
  } else if (hoursSinceLastPlay < 24) {
    return getRandomMessage(NOTIFICATION_MESSAGES.longAbsence);
  } else {
    return getRandomMessage(NOTIFICATION_MESSAGES.veryLongAbsence);
  }
};

/**
 * Get random message from array
 */
const getRandomMessage = (messages) => {
  return messages[Math.floor(Math.random() * messages.length)];
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Request notification permission from user
 * MUST be called before scheduling any notifications
 * Returns: { granted: boolean, status: string }
 */
export const requestNotificationPermission = async () => {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      console.log('Notifications not supported on simulator/emulator');
      return { granted: false, status: 'unsupported' };
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return { granted: false, status: finalStatus };
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('gridsnap-high-priority', {
        name: 'GridSnap Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700', // Gold light for rewards/streaks
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('gridsnap-default', {
        name: 'GridSnap Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#2CF6C8', // Cyan for general reminders
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });
    }

    console.log('Notification permission granted');
    return { granted: true, status: finalStatus };
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return { granted: false, status: 'error', error };
  }
};

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification status:', error);
    return false;
  }
};

/**
 * Schedule a daily reminder notification
 * Best for encouraging daily play habits
 */
export const scheduleDailyReminder = async (hour = 18, minute = 0) => {
  try {
    const hasPermission = await areNotificationsEnabled();
    if (!hasPermission) {
      console.log('Cannot schedule: notifications not enabled');
      return { success: false, reason: 'no_permission' };
    }

    // Cancel existing daily reminder
    await cancelDailyReminder();

    const message = getTimeAppropriateMessage();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 200, 100, 200],
        badge: 1,
        color: '#2CF6C8',
        categoryIdentifier: 'gridsnap-reminder',
        data: { type: 'daily_reminder' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
        channelId: 'gridsnap-default',
      },
    });

    console.log('Daily reminder scheduled:', notificationId);
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return { success: false, reason: 'error', error };
  }
};

/**
 * Cancel daily reminder
 */
export const cancelDailyReminder = async () => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const dailyReminders = scheduledNotifications.filter(
      (n) => n.content.data?.type === 'daily_reminder'
    );

    for (const reminder of dailyReminders) {
      await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }

    console.log('Daily reminders cancelled');
    return { success: true };
  } catch (error) {
    console.error('Error cancelling daily reminder:', error);
    return { success: false, error };
  }
};

/**
 * Schedule a smart re-engagement notification based on last play time
 * This is the KEY function that makes notifications work like modern apps
 */
export const scheduleSmartReengagement = async (lastPlayTimestamp) => {
  try {
    const hasPermission = await areNotificationsEnabled();
    if (!hasPermission) {
      return { success: false, reason: 'no_permission' };
    }

    const now = Date.now();
    const hoursSinceLastPlay = (now - lastPlayTimestamp) / (1000 * 60 * 60);

    // Don't notify if played in last 2 hours
    if (hoursSinceLastPlay < 2) {
      return { success: false, reason: 'played_recently' };
    }

    // Get appropriate message based on absence duration
    const message = getAbsenceBasedMessage(hoursSinceLastPlay);
    if (!message) {
      return { success: false, reason: 'no_message' };
    }

    // Schedule notification for 1 hour from now (or immediately if overdue)
    const delayHours = Math.max(0, 1 - hoursSinceLastPlay);
    const delaySeconds = delayHours * 60 * 60;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        data: { type: 'smart_reengagement' },
      },
      trigger: {
        seconds: Math.max(3600, delaySeconds), // At least 1 hour
        repeats: false,
      },
    });

    console.log('Smart re-engagement scheduled:', notificationId);
    return { success: true, notificationId, hoursSinceLastPlay };
  } catch (error) {
    console.error('Error scheduling smart re-engagement:', error);
    return { success: false, error };
  }
};

/**
 * Schedule a notification after X hours (for re-engagement)
 * Great for bringing back players who haven't played in a while
 */
export const scheduleReengagementNotification = async (hours = 24) => {
  try {
    const hasPermission = await areNotificationsEnabled();
    if (!hasPermission) {
      return { success: false, reason: 'no_permission' };
    }

    const message = getRandomMessage(NOTIFICATION_MESSAGES.general);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        data: { type: 'reengagement' },
      },
      trigger: {
        seconds: hours * 60 * 60,
        repeats: false,
      },
    });

    console.log('Re-engagement notification scheduled:', notificationId);
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error scheduling re-engagement notification:', error);
    return { success: false, error };
  }
};

/**
 * Schedule streak reminder (urgent, high priority)
 */
export const scheduleStreakReminder = async (hour = 20, minute = 0) => {
  try {
    const hasPermission = await areNotificationsEnabled();
    if (!hasPermission) {
      return { success: false, reason: 'no_permission' };
    }

    await cancelStreakReminder();

    const message = getRandomMessage(NOTIFICATION_MESSAGES.streak);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        badge: 1,
        color: '#FFD700', // Gold color in notification shade
        data: { type: 'streak_reminder' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
        channelId: 'gridsnap-high-priority',
      },
    });

    console.log('Streak reminder scheduled:', notificationId);
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error scheduling streak reminder:', error);
    return { success: false, error };
  }
};

/**
 * Cancel streak reminder
 */
export const cancelStreakReminder = async () => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const streakReminders = scheduledNotifications.filter(
      (n) => n.content.data?.type === 'streak_reminder'
    );

    for (const reminder of streakReminders) {
      await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }

    return { success: true };
  } catch (error) {
    console.error('Error cancelling streak reminder:', error);
    return { success: false, error };
  }
};

/**
 * Send immediate notification (for in-app events)
 */
export const sendImmediateNotification = async (title, body) => {
  try {
    const hasPermission = await areNotificationsEnabled();
    if (!hasPermission) {
      return { success: false, reason: 'no_permission' };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'immediate' },
      },
      trigger: null, // Send immediately
    });

    return { success: true, notificationId };
  } catch (error) {
    console.error('Error sending immediate notification:', error);
    return { success: false, error };
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
    return { success: true };
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
    return { success: false, error };
  }
};

/**
 * Save user notification preferences
 */
export const saveNotificationPrefs = async (prefs) => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    return { success: true };
  } catch (error) {
    console.error('Error saving notification prefs:', error);
    return { success: false, error };
  }
};

/**
 * Load user notification preferences
 */
export const loadNotificationPrefs = async () => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const prefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    return prefs ? JSON.parse(prefs) : null;
  } catch (error) {
    console.error('Error loading notification prefs:', error);
    return null;
  }
};

/**
 * Setup all notifications with user consent
 * This is the main function to call when user enables notifications
 */
export const enableNotifications = async (settings = {}) => {
  const {
    dailyReminder = true,
    dailyHour = 18,
    dailyMinute = 0,
    streakReminder = true,
    streakHour = 20,
    streakMinute = 0,
    reengagement = true,
    reengagementHours = 24,
  } = settings;

  // Step 1: Request permission
  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return { success: false, reason: 'permission_denied' };
  }

  // Step 2: Schedule notifications based on settings
  const results = [];

  if (dailyReminder) {
    const result = await scheduleDailyReminder(dailyHour, dailyMinute);
    results.push({ type: 'daily', ...result });
  }

  if (streakReminder) {
    const result = await scheduleStreakReminder(streakHour, streakMinute);
    results.push({ type: 'streak', ...result });
  }

  if (reengagement) {
    const result = await scheduleReengagementNotification(reengagementHours);
    results.push({ type: 'reengagement', ...result });
  }

  // Step 3: Save preferences
  await saveNotificationPrefs({
    enabled: true,
    dailyReminder,
    dailyHour,
    dailyMinute,
    streakReminder,
    streakHour,
    streakMinute,
    reengagement,
    reengagementHours,
  });

  const allSuccess = results.every((r) => r.success);
  return { success: allSuccess, results };
};

/**
 * Disable all notifications
 */
export const disableNotifications = async () => {
  await cancelAllNotifications();
  await saveNotificationPrefs({ enabled: false });
  return { success: true };
};

/**
 * Check if notifications are currently enabled by user
 */
export const isNotificationEnabled = async () => {
  const prefs = await loadNotificationPrefs();
  return prefs?.enabled === true;
};

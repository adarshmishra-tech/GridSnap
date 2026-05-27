/**
 * src/hooks/useStorage.js
 *
 * All AsyncStorage reads/writes. Never crashes — all errors silently swallowed.
 * Consent routing lives ONLY in loadConsent (called from handleSplashFinish).
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setMuted } from '../utils/audioManager';

const K = {
  level:   '@gs_lvl',
  best:    '@gs_best',
  sound:   '@gs_sound',
  vib:     '@gs_vib',
  privacy: '@gs_privacy',
  streak:  '@gs_streak',
  lastPlay:'@gs_last_play',
  powerups: '@gs_powerups',
  achievements: '@gs_achievements',
  leaderboards: '@gs_leaderboards',
  stats: '@gs_stats',
  completedLevels: '@gs_completed_levels_count',
  lossCount: '@gs_loss_count',
};

export function useStorage() {
  const [maxLevel,     setMaxLevel]     = useState(1);
  const [bestScore,    setBestScore]    = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibEnabled,   setVibEnabled]   = useState(true);
  const [dailyStreak,  setDailyStreak]  = useState(1);
  const [powerUps,     setPowerUps]     = useState({ BOMB: 0, TIME_FREEZE: 0, UNDO: 0, COLOR_CLEAR: 0 });
  const [achievements, setAchievements] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [stats,        setStats]        = useState({ totalGames: 0, totalClears: 0, bestCombo: 0, totalScore: 0 });
  const [completedLevelsCount, setCompletedLevelsCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);

  // ── Load game settings (NOT consent) ─────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const [lvl, best, sound, vib, streak, powerupsRaw, achievementsRaw, leaderboardsRaw, statsRaw, completedCount, losses] = await Promise.all([
        AsyncStorage.getItem(K.level),
        AsyncStorage.getItem(K.best),
        AsyncStorage.getItem(K.sound),
        AsyncStorage.getItem(K.vib),
        AsyncStorage.getItem(K.streak),
        AsyncStorage.getItem(K.powerups),
        AsyncStorage.getItem(K.achievements),
        AsyncStorage.getItem(K.leaderboards),
        AsyncStorage.getItem(K.stats),
        AsyncStorage.getItem(K.completedLevels),
        AsyncStorage.getItem(K.lossCount),
      ]);
      if (lvl)  setMaxLevel(parseInt(lvl, 10));
      if (best) setBestScore(parseInt(best, 10));
      if (sound !== null) {
        const on = sound === 'true';
        setSoundEnabled(on);
        setMuted(!on);
      }
      if (vib !== null) setVibEnabled(vib === 'true');
      if (streak) setDailyStreak(Math.max(1, parseInt(streak, 10) || 1));
      if (powerupsRaw) {
        try { setPowerUps(JSON.parse(powerupsRaw)); } catch (_) {}
      }
      if (achievementsRaw) {
        try { setAchievements(JSON.parse(achievementsRaw)); } catch (_) {}
      }
      if (leaderboardsRaw) {
        try { setLeaderboards(JSON.parse(leaderboardsRaw)); } catch (_) {}
      }
      if (statsRaw) {
        try { setStats(JSON.parse(statsRaw)); } catch (_) {}
      }
      if (completedCount) setCompletedLevelsCount(parseInt(completedCount, 10));
      if (losses) setLossCount(parseInt(losses, 10));
    } catch (_) {}
  }, []);

  // ── Consent — single source of truth ─────────────────────────────────────
  const loadConsent = useCallback(async () => {
    try {
      const v = await AsyncStorage.getItem(K.privacy);
      return v === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const saveConsent = useCallback(async () => {
    try { await AsyncStorage.setItem(K.privacy, 'true'); } catch (_) {}
  }, []);

  // ── Progress ──────────────────────────────────────────────────────────────
  const saveProgress = useCallback(async (lvl, score) => {
    try {
      const ops = [AsyncStorage.setItem(K.level, String(lvl))];
      setBestScore(prev => {
        if (score > prev) {
          ops.push(AsyncStorage.setItem(K.best, String(score)));
          return score;
        }
        return prev;
      });
      await Promise.all(ops);
    } catch (_) {}
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────
  const _saveSettings = useCallback(async (sound, vib) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(K.sound, String(sound)),
        AsyncStorage.setItem(K.vib,   String(vib)),
      ]);
    } catch (_) {}
  }, []);

  const toggleSound = useCallback((currentVib) => {
    setSoundEnabled(prev => {
      const next = !prev;
      setMuted(!next);
      _saveSettings(next, currentVib);
      return next;
    });
  }, [_saveSettings]);

  const toggleVibration = useCallback((currentSound) => {
    setVibEnabled(prev => {
      const next = !prev;
      _saveSettings(currentSound, next);
      return next;
    });
  }, [_saveSettings]);

  const markSessionPlayed = useCallback(async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    try {
      const [last, streakRaw] = await Promise.all([
        AsyncStorage.getItem(K.lastPlay),
        AsyncStorage.getItem(K.streak),
      ]);
      const current = Math.max(1, parseInt(streakRaw || '1', 10) || 1);

      if (last === today) {
        setDailyStreak(current);
        return current;
      }

      const next = last === yesterday ? current + 1 : 1;
      setDailyStreak(next);
      await Promise.all([
        AsyncStorage.setItem(K.lastPlay, today),
        AsyncStorage.setItem(K.streak, String(next)),
      ]);
      return next;
    } catch (_) {
      return 1;
    }
  }, []);

  // ── Power-ups ─────────────────────────────────────────────────────────────
  const addPowerUp = useCallback(async (type, count = 1) => {
    setPowerUps(prev => {
      const current = prev[type] || 0;
      const next = { ...prev, [type]: current + count };
      AsyncStorage.setItem(K.powerups, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const usePowerUp = useCallback(async (type) => {
    setPowerUps(prev => {
      const current = prev[type] || 0;
      if (current <= 0) return prev;
      const next = { ...prev, [type]: current - 1 };
      AsyncStorage.setItem(K.powerups, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return true;
  }, []);

  // ── Achievements ──────────────────────────────────────────────────────────
  const unlockAchievement = useCallback(async (id) => {
    setAchievements(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      AsyncStorage.setItem(K.achievements, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const hasAchievement = useCallback((id) => {
    return achievements.includes(id);
  }, [achievements]);

  // ── Leaderboards ──────────────────────────────────────────────────────────
  const updateLeaderboard = useCallback(async (level, score) => {
    setLeaderboards(prev => {
      const current = prev[level] || 0;
      if (score <= current) return prev;
      const next = { ...prev, [level]: score };
      AsyncStorage.setItem(K.leaderboards, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getLeaderboardScore = useCallback((level) => {
    return leaderboards[level] || 0;
  }, [leaderboards]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const updateStats = useCallback(async (updates) => {
    setStats(prev => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(K.stats, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const incrementCompletedLevels = useCallback(async () => {
    try {
      const next = completedLevelsCount + 1;
      setCompletedLevelsCount(next);
      await AsyncStorage.setItem(K.completedLevels, String(next));
      return next;
    } catch (_) {
      return completedLevelsCount;
    }
  }, [completedLevelsCount]);

  const incrementLossCount = useCallback(async () => {
    try {
      const next = lossCount + 1;
      setLossCount(next);
      await AsyncStorage.setItem(K.lossCount, String(next));
      return next;
    } catch (_) {
      return lossCount;
    }
  }, [lossCount]);

  return {
    maxLevel,
    setMaxLevel,
    bestScore,
    soundEnabled,
    vibEnabled,
    dailyStreak,
    powerUps,
    achievements,
    leaderboards,
    stats,
    loadSettings,
    loadConsent,
    saveConsent,
    saveProgress,
    toggleSound,
    toggleVibration,
    markSessionPlayed,
    addPowerUp,
    usePowerUp,
    unlockAchievement,
    hasAchievement,
    updateLeaderboard,
    getLeaderboardScore,
    updateStats,
    incrementCompletedLevels,
    completedLevelsCount,
    incrementLossCount,
    lossCount,
  };
}

export default useStorage;
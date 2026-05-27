/**
 * App.js — GridSnap  (Premium Layout Fix)
 *
 * FIXES IN THIS VERSION:
 *   ① Board + tray pushed UP — flex layout changed to flex-start + controlled
 *     gaps; large paddingBottom creates clean breathing room above home bar.
 *   ② Tray slot overlap ELIMINATED — each slot has explicit maxWidth so three
 *     slots never bleed into each other; overflow:'visible' only on tray root.
 *   ③ Draggable block previews LARGER — tray height 130, slot area 110, giving
 *     pieces more room so nothing clips or overlaps its neighbour.
 *   ④ 15-second one-time bonus — intercept in onTimerChange is unchanged and
 *     correct; bonusAvailableRef resets on every startLevel call.
 *   ⑤ Premium aesthetics — refined glow layers, tighter typography spacing,
 *     richer border/shadow treatments throughout.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, Modal, Alert,
  TouchableOpacity, StatusBar, Animated, Linking,
  Dimensions, Platform, BackHandler, ScrollView, AppState
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, CELL_SIZE, GRID_SIZE } from './src/constants/gameConfig';
import { initSounds, releaseSounds } from './src/utils/audioManager';
import { useGameEngine, COMBO_LABELS } from './src/hooks/useGameEngine';
import { useStorage }                from './src/hooks/useStorage';
import { useAnimations }             from './src/hooks/useAnimations';
import { isNotificationEnabled, scheduleSmartReengagement } from './src/utils/notificationManager';
import {
  showInterstitialAd,
  showRewardedAd,
  preloadInterstitial,
  preloadRewarded,
  initializeAds,
  showAppOpenAd
} from './src/utils/adManager';

import GameBoard      from './src/components/GameBoard';
import DraggableBlock from './src/components/DraggableBlock';
import SplashScreen   from './src/components/SplashScreen';
import FloatingScore  from './src/components/FloatingScore';
import ParticleEffect  from './src/components/ParticleEffect';
import PowerUpButton   from './src/components/PowerUpButton';
import NotificationConsent from './src/components/NotificationConsent';
import BannerAdComponent from './src/components/BannerAd';

// ─── Responsive scaling ───────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const SCALE = Math.min(SW / 390, 1.4);
const rs    = (n) => Math.round(n * SCALE);

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIVACY_URL  = 'https://adarshmishra-tech.github.io/GridSnap/';
const PRIVACY_TEXT =
  'GridSnap stores your progress (level, best score) and preferences ' +
  '(sound, vibration) locally on your device. We do not collect, sell, or ' +
  'share personal data. By tapping "ACCEPT & PLAY", you agree to the Privacy ' +
  'Policy and Terms of Use.';

const BONUS_SECONDS = 15;
const INTERSTITIAL_COOLDOWN_MS = 90 * 1000; // only one interstitial per 90 seconds
const INTERSTITIAL_SESSION_WINDOW_MS = 60 * 60 * 1000; // session window for cap
const MAX_INTERSTITIALS_PER_SESSION = 6; // max interstitials per session/hour

// ─── Tray geometry (computed once) ───────────────────────────────────────────
// Total tray width, matching s.tray below.
const TRAY_WIDTH      = Math.min(SW * 0.95, 360);
// Horizontal padding inside tray (left + right).
const TRAY_PAD_H      = 12;
// Gap between slots.
const SLOT_GAP        = 6;
// Number of piece slots.
const SLOT_COUNT      = 3;
// Exact slot width so slots never overflow or overlap each other.
const SLOT_WIDTH      = Math.floor(
  (TRAY_WIDTH - TRAY_PAD_H * 2 - SLOT_GAP * (SLOT_COUNT - 1)) / SLOT_COUNT,
);

// ─────────────────────────────────────────────────────────────────────────────
function GridSnapApp() {
  const insets = useSafeAreaInsets();

  // ── Routing ───────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState('SPLASH');

  // ── UI game state ─────────────────────────────────────────────────────────
  const [grid,     setGrid]     = useState(() =>
    Array.from({ length: 10 }, () => Array(10).fill(null)));
  const [shapes,   setShapes]   = useState([]);
  const [score,    setScore]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [level,    setLevel]    = useState(1);
  const [target,   setTarget]   = useState(500);
  const [flash,    setFlash]    = useState(null);
  const [ghost,    setGhost]    = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [combo,    setCombo]    = useState(0);
  const [comboLbl, setComboLbl] = useState('');
  const [pressure, setPressure] = useState(0);
  const [floatingScores, setFloatingScores] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [isWin,    setIsWin]    = useState(false);
  const [endReason,setEndReason]= useState('');
  const [inDanger, setInDanger] = useState(false);
  const [showTimeoutBonusOffer, setShowTimeoutBonusOffer] = useState(false);
  const [isRewardedAdLoading, setIsRewardedAdLoading] = useState(false);
  const [rewardedAdRequested, setRewardedAdRequested] = useState(false);
  const [particles, setParticles] = useState([]);
  const [feverMode, setFeverMode] = useState(false);
  const [achievementPopup, setAchievementPopup] = useState(null);
  const [clearStreak, setClearStreak] = useState(0);
  const [showNotificationConsent, setShowNotificationConsent] = useState(false);
  const lastPlayTimeRef = useRef(Date.now());

  // ── Bonus-time state ──────────────────────────────────────────────────────
  const bonusAvailableRef = useRef(true);
  const rewardedAdAttemptedRef = useRef(false);
  const lastInterstitialAdTimeRef = useRef(0);
  const interstitialSessionHistoryRef = useRef([]);

  const shouldShowInterstitial = useCallback((eventType) => {
    const now = Date.now();
    const windowStart = now - INTERSTITIAL_SESSION_WINDOW_MS;
    const history = interstitialSessionHistoryRef.current.filter((ts) => ts >= windowStart);
    interstitialSessionHistoryRef.current = history;

    if (history.length >= MAX_INTERSTITIALS_PER_SESSION) {
      return false;
    }
    if (now - lastInterstitialAdTimeRef.current < INTERSTITIAL_COOLDOWN_MS) {
      return false;
    }
    if (eventType === 'loss-retry' && history.length >= 3) {
      return false;
    }
    return true;
  }, []);

  const tryShowInterstitialAd = useCallback((eventType) => {
    if (!shouldShowInterstitial(eventType)) return false;
    const now = Date.now();
    lastInterstitialAdTimeRef.current = now;
    interstitialSessionHistoryRef.current = [...interstitialSessionHistoryRef.current, now];
    showInterstitialAd().catch(() => {});
    return true;
  }, [shouldShowInterstitial]);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const st   = useStorage();
  const anim = useAnimations();

  // ── Engine callbacks ──────────────────────────────────────────────────────
  const onComboChange = useCallback((count) => {
    setCombo(count);
    setComboLbl(COMBO_LABELS[Math.min(count, COMBO_LABELS.length - 1)] || 'BLAZING ×3!');
  }, []);

  const onGameEnd = useCallback(({ win, reason, score: s, level: l }) => {
    setEndReason(reason);
    setInDanger(false);
    if (win) {
      setIsWin(true);
      setShowTimeoutBonusOffer(false);
      st.setMaxLevel(prev => {
        const next = Math.max(prev, l + 1);
        st.saveProgress(next, s);
        return next;
      });

      // AD LOGIC: Increment completed levels and check if we should show an ad
      st.incrementCompletedLevels().then(nextCount => {
        if (nextCount > 0 && nextCount % 3 === 0) {
          // Show ad after a short delay so the win screen is visible first
          setTimeout(() => {
            tryShowInterstitialAd('win');
          }, 800);
        }
      });
    } else {
      if (reason === 'time_up' && bonusAvailableRef.current) {
        st.incrementLossCount().catch(() => {});
        setIsWin(false);
        setShowTimeoutBonusOffer(true);
        setGameOver(true);
        anim.triggerModalPop();
        return;
      }
      setShowTimeoutBonusOffer(false);
      setGameOver(true);
      st.saveProgress(l, s);
    }
    anim.triggerModalPop();
  }, [st, anim]);

  const onBoardPressureAnim = useCallback((ratio) => {
    anim.triggerPressureAnim(ratio);
  }, [anim]);

  const onDangerChange = useCallback((active, intensity) => {
    setInDanger(active);
    anim.triggerDangerMode(active, intensity);
  }, [anim]);

  const onFloatingScore = useCallback(({ value, boost, label }) => {
    setFloatingScores(prev => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        value,
        boost: !!boost,
        label: label || '',
      },
    ]);
  }, []);

  const onParticles = useCallback((bursts) => {
    if (!Array.isArray(bursts)) bursts = [bursts];

    bursts.forEach(({ x, y, color, count = 1, delay = 0 }) => {
      setTimeout(() => {
        setParticles(prev => {
          if (prev.length >= 10) return prev; // Global cap on active effects
          const newParticles = Array.from({ length: Math.min(count, 3) }, (_, i) => ({
            id: `${Date.now()}_p${i}_${Math.random().toString(36).slice(2, 5)}`,
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 40,
            color,
          }));
          return [...prev, ...newParticles];
        });
      }, delay);
    });
  }, []);

  const onFeverModeChange = useCallback((active) => {
    setFeverMode(active);
  }, []);

  const onPowerUpEarn = useCallback(({ type, count }) => {
    st.addPowerUp(type, count);
  }, [st]);

  const onAchievement = useCallback(({ id, name, icon, reward }) => {
    if (st.hasAchievement(id)) return;
    st.unlockAchievement(id);
    if (reward) {
      st.addPowerUp(reward.powerUp, reward.count);
    }
    setAchievementPopup({ id, name, icon });
    setTimeout(() => setAchievementPopup(null), 3000);
  }, [st]);

  const onGhostChange = useCallback((ghostPos) => {
    setGhost(ghostPos);
  }, []);

  // ── Timer sync ─────────────────────────────────────────────────────────────
  const onTimerChange = useCallback((t) => {
    setTimeLeft(t);
  }, []);

  // ── Engine ────────────────────────────────────────────────────────────────
  const engine = useGameEngine({
    soundEnabled:     st.soundEnabled,
    vibEnabled:       st.vibEnabled,
    onGridChange:     setGrid,
    onShapesChange:   setShapes,
    onScoreChange:    setScore,
    onTimerChange,
    onComboChange,
    onFlashChange:    setFlash,
    onPressureChange: setPressure,
    onPauseChange:    setIsPaused,
    onGameEnd,
    onBoardPressureAnim,
    onScorePop:       anim.triggerScorePop,
    onComboAnim:      anim.triggerComboAnim,
    onBoardPulse:     anim.triggerJuicyClear,
    onPlaceJuice:     anim.triggerPlaceJuice,
    onDangerChange,
    onGhostChange,
    onFloatingScore,
    onParticles,
    onFeverModeChange,
    onPowerUpEarn,
    onAchievement,
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      await initSounds();
      await st.loadSettings();
      await initializeAds();
      // Show app open ad after initialization
      setTimeout(() => {
        showAppOpenAd();
      }, 1000);
    };
    boot().catch(() => {});

    // App state listener for App Open Ads on resume
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        showAppOpenAd();
      }
    });

    return () => {
      releaseSounds().catch(() => {});
      subscription.remove();
    };
  }, []); // eslint-disable-line

  // ── Check notification status on app start ────────────────────────────────
  useEffect(() => {
    const checkNotifications = async () => {
      // Wait a bit after splash to not overwhelm user
      setTimeout(async () => {
        const isEnabled = await isNotificationEnabled();
        if (!isEnabled) {
          setShowNotificationConsent(true);
        } else {
          // Schedule smart re-engagement notification based on last play
          const lastPlay = lastPlayTimeRef.current;
          await scheduleSmartReengagement(lastPlay);
        }
      }, 2000);
    };
    checkNotifications();
  }, []);

  // ── Android back ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const handler = () => {
      if (screen === 'PLAYING') {
        Alert.alert(
          'Leave game?',
          'Choose where you want to go.',
          [
            { text: 'CANCEL', style: 'cancel' },
            {
              text: 'MAIN MENU',
              onPress: () => {
                setShowTimeoutBonusOffer(false);
                setGameOver(false);
                setIsWin(false);
                setIsPaused(false);
                setScreen('MENU');
              },
            },
            {
              text: 'EXIT GAME',
              style: 'destructive',
              onPress: () => BackHandler.exitApp(),
            },
          ]
        );
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [screen]); // eslint-disable-line

  // ── Resume: restart timer bar ─────────────────────────────────────────────
  const prevPausedRef = useRef(false);
  useEffect(() => {
    if (prevPausedRef.current && !isPaused) anim.restartTimerAnim(timeLeft, level);
    prevPausedRef.current = isPaused;
  }, [isPaused]); // eslint-disable-line

  // ── Consent ───────────────────────────────────────────────────────────────
  const handleSplashFinish = useCallback(async () => {
    const ok = await st.loadConsent();
    if (ok) setScreen('MENU');
    else   { setScreen('CONSENT'); anim.fadeInConsent(); }
  }, [st, anim]);

  const handleAccept  = useCallback(async () => { await st.saveConsent(); setScreen('MENU'); }, [st]);
  const handleDecline = useCallback(() => {
    // Modern consent UX: keep user in a blocked state with clear recovery path,
    // rather than abruptly terminating the app.
    setScreen('DECLINED');
  }, []);
  const handleRetryConsent = useCallback(() => { setScreen('CONSENT'); anim.fadeInConsent(); }, [anim]);
  const openPrivacy = useCallback(() => { Linking.openURL(PRIVACY_URL).catch(() => {}); }, []);

  // ── Settings toggles ──────────────────────────────────────────────────────
  const handleToggleSound = useCallback(() => st.toggleSound(st.vibEnabled),     [st]);
  const handleToggleVib   = useCallback(() => st.toggleVibration(st.soundEnabled), [st]);
  const handleToggleNotifications = useCallback(() => {
    setShowNotificationConsent(true);
  }, []);

  const handleUseTimeoutBonus = useCallback(() => {
    if (typeof engine.consumeTimeoutBonus !== 'function') return;
    const nextTime = engine.consumeTimeoutBonus(BONUS_SECONDS);
    if (typeof nextTime === 'number' && nextTime > 0) {
      bonusAvailableRef.current = false;
      setShowTimeoutBonusOffer(false);
      setGameOver(false);
      setEndReason('');
      setIsWin(false);
      setTimeLeft(nextTime);
      
      // Update last play time
      lastPlayTimeRef.current = Date.now();
      
      anim.restartTimerAnim(nextTime, level);
    }
  }, [engine, anim, level]);

  const handleDeclineTimeoutBonus = useCallback(() => {
    bonusAvailableRef.current = false;
    setShowTimeoutBonusOffer(false);
    setGameOver(true); // Ensure game over screen shows the standard buttons now
  }, []);

  const handleWatchRewardedAd = useCallback(async () => {
    if (rewardedAdAttemptedRef.current || isRewardedAdLoading || !bonusAvailableRef.current) {
      return;
    }

    rewardedAdAttemptedRef.current = true;
    setRewardedAdRequested(true);
    setIsRewardedAdLoading(true);

    const success = await showRewardedAd();
    setIsRewardedAdLoading(false);

    if (success) {
      bonusAvailableRef.current = false;
      setShowTimeoutBonusOffer(false);
      setGameOver(false);
      setEndReason('');
      setIsWin(false);
      const nextTime = engine.consumeTimeoutBonus(BONUS_SECONDS);
      if (typeof nextTime === 'number' && nextTime > 0) {
        onFloatingScore({ value: 'GAME RESTORED!', boost: true, label: '🛡️' });
        setTimeLeft(nextTime);
        lastPlayTimeRef.current = Date.now();
        anim.restartTimerAnim(nextTime, level);
      }
    } else {
      setShowTimeoutBonusOffer(false);
      setGameOver(true);
      Alert.alert(
        "Ad Unavailable",
        "We couldn't load a video right now. Don't worry, you can still try again or start fresh!",
        [{ text: "OK", style: "default" }]
      );
    }
  }, [engine, anim, level, onFloatingScore, isRewardedAdLoading]);

  // ── startLevel ────────────────────────────────────────────────────────────
  const startLevel = useCallback((lvl) => {
    st.markSessionPlayed().catch(() => {});
    setScore(0); setCombo(0); setComboLbl(''); setFlash(null); setGhost(null);
    setFloatingScores([]);
    setGameOver(false); setIsWin(false); setIsPaused(false); setEndReason('');
    setPressure(0); setLevel(lvl); setInDanger(false);

    // Reset bonus for this round
    bonusAvailableRef.current = true;
    rewardedAdAttemptedRef.current = false;
    setRewardedAdRequested(false);
    setIsRewardedAdLoading(false);
    setShowTimeoutBonusOffer(false);

    // Preload ads for the next opportunity (light preloading)
    preloadInterstitial();
    preloadRewarded();

    // Update last play time
    lastPlayTimeRef.current = Date.now();

    anim.resetAll();
    setScreen('PLAYING');

    const { initialGrid, shapes: sh, target: t, timerDuration } =
      engine.startLevel(lvl, (dur) => anim.setupTimerAnim(dur));

    setGrid(initialGrid);
    setShapes(sh);
    setTarget(t);
    setTimeLeft(timerDuration);
  }, [engine, anim]);

  // ── Pause toggle ──────────────────────────────────────────────────────────
  const handleRetryOrContinue = useCallback(async () => {
    if (!isWin) {
      tryShowInterstitialAd('loss-retry');
    }
    startLevel(isWin ? level + 1 : level);
  }, [tryShowInterstitialAd, isWin, level, startLevel]);

  const handleTogglePause = useCallback(() => {
    engine.togglePause(undefined, (rem) => anim.restartTimerAnim(rem, level));
  }, [engine, anim, level]);

  // ── Board layout ──────────────────────────────────────────────────────────
  const onBoardLayout = useCallback(() => {
    // Force measurement on the ref to get absolute screen coordinates
    // setTimeout handles the case where the view isn't fully rendered yet
    setTimeout(() => {
      engine.boardMeasureRef.current?.measureInWindow((pageX, pageY) => {
        if (pageX !== undefined && pageY !== undefined) {
          engine.cacheLayout(pageX, pageY);
        }
      });
    }, 150);
  }, [engine]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onDrop     = useCallback((shape, absX, absY) => engine.onDrop(shape, absX, absY, anim.triggerShake), [engine, anim]);
  const onDragMove = useCallback((shape, absX, absY) => engine.onDragMove(shape, absX, absY), [engine]);

  // ── End message ───────────────────────────────────────────────────────────
  const endMsg = (() => {
    if (showTimeoutBonusOffer) {
      return {
        title: 'TIME IS UP',
        icon: '⚡',
        color: COLORS.accent,
        sub: `Claim a one-time +${BONUS_SECONDS}s boost and finish this level.`,
      };
    }
    if (isWin)                      return { title: 'LEVEL COMPLETE', icon: '✓',  color: COLORS.accent, sub: 'Outstanding!' };
    if (endReason === 'time_up')    return { title: 'TIME EXPIRED',   icon: '⏱',  color: '#FF9F00',     sub: 'Keep practicing!' };
    if (endReason === 'board_full') return { title: 'BOARD FILLED',   icon: '⬛', color: '#FF6B6B',     sub: 'No valid moves' };
    return                                 { title: 'LEVEL FAILED',   icon: '✕',  color: '#FF3D00',     sub: 'Try again!' };
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'SPLASH') return <SplashScreen onFinish={handleSplashFinish} />;

  // ── CONSENT ───────────────────────────────────────────────────────────────
  if (screen === 'CONSENT') {
    return (
      <SafeAreaView style={s.safe} edges={['top','right','left','bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={s.popupBackdrop}>
          <Animated.View style={[s.consentCard, { opacity: anim.consentFade }]}>
            <View style={s.consentIcon}><Text style={s.consentIconTxt}>🔒</Text></View>
            <Text style={s.consentTitle}>Privacy & Terms</Text>
            <ScrollView style={s.consentScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.consentBody}>{PRIVACY_TEXT}</Text>
            </ScrollView>
            <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7} style={s.linkBtn}>
              <Text style={s.linkTxt}>VIEW PRIVACY POLICY ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAccept} activeOpacity={0.9} style={s.acceptBtn}>
              <Text style={s.acceptTxt}>ACCEPT & PLAY</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDecline} activeOpacity={0.7} style={s.declineBtn}>
              <Text style={s.declineTxt}>NOT NOW</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── DECLINED ──────────────────────────────────────────────────────────────
  if (screen === 'DECLINED') {
    return (
      <SafeAreaView style={s.safe} edges={['top','right','left','bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={s.center}>
          <Text style={s.declinedIco}>🚫</Text>
          <Text style={s.declinedTitle}>Consent Required</Text>
          <Text style={s.declinedBody}>To continue playing GridSnap, please review and accept the Privacy Policy and Terms.</Text>
          <TouchableOpacity onPress={handleRetryConsent} activeOpacity={0.85} style={s.acceptBtn}>
            <Text style={s.acceptTxt}>REVIEW & CONTINUE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7} style={s.linkBtn}>
            <Text style={s.linkTxt}>VIEW PRIVACY POLICY ↗</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (screen === 'MENU') {
    return (
      <SafeAreaView style={s.safe} edges={['top','right','left','bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={s.menuGlowTop} />
        <View style={s.menuGlowBottom} />
        <View style={s.menuWrap}>
          <View style={s.menuHero}>
            <View style={s.menuBadge}><Text style={s.menuBadgeTxt}>ARCADE PUZZLE</Text></View>
            <Text style={s.appName} numberOfLines={1} adjustsFontSizeToFit>
              GRID<Text style={{ color: COLORS.accent }}>SNAP</Text>
            </Text>
            <Text style={s.appTag}>PLACE · SNAP · CRUSH</Text>
            <Text style={s.menuSubTag}>FAST ROUNDS · PURE FLOW</Text>
            <View style={s.menuStatsRow}>
              <View style={s.menuStatCard}>
                <Text style={s.menuStatVal}>L{st.maxLevel}</Text>
                <Text style={s.menuStatLbl}>UNLOCKED</Text>
              </View>
              <View style={s.menuStatCard}>
                <Text style={s.menuStatVal}>{st.bestScore > 0 ? st.bestScore.toLocaleString() : '0'}</Text>
                <Text style={s.menuStatLbl}>BEST</Text>
              </View>
            </View>
          </View>

          <View style={s.streakPill}>
            <Text style={s.streakTxt}>🔥 STREAK {st.dailyStreak}</Text>
          </View>

          <TouchableOpacity 
            style={s.mainBtn} 
            onPress={() => startLevel(st.maxLevel)} 
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.mainBtnTxt} numberOfLines={1}>PLAY LEVEL {st.maxLevel}</Text>
            <Text style={s.mainBtnSub}>Tap to continue your run</Text>
          </TouchableOpacity>

          {st.maxLevel > 1 && (
            <TouchableOpacity 
              style={s.secBtn} 
              onPress={() => startLevel(1)} 
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.secBtnTxt}>RESTART FROM LEVEL 1</Text>
            </TouchableOpacity>
          )}

          <View style={s.settingsRow}>
            <TouchableOpacity 
              style={s.iconBtn} 
              onPress={handleToggleSound} 
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.iconTxt}>{st.soundEnabled ? '🔊' : '🔇'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={s.iconBtn} 
              onPress={handleToggleVib} 
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.iconTxt}>{st.vibEnabled ? '📳' : '📴'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={s.iconBtn} 
              onPress={handleToggleNotifications} 
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.iconTxt}>🔔</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={s.privBtn} 
            onPress={openPrivacy} 
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.privTxt}>PRIVACY POLICY</Text>
          </TouchableOpacity>
        </View>
        <View style={s.bannerWrap}>
          <BannerAdComponent />
        </View>
      </SafeAreaView>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  //
  // Layout strategy (FIX ①):
  //   • justifyContent: 'flex-start' — header snaps to top, board + tray
  //     follow with explicit gap/margin rather than being stretched apart.
  //   • paddingBottom: large value (insets.bottom + 32) — guarantees clean
  //     space above the home indicator / Android nav bar.
  //   • Board pushed up with marginTop: 6 (tight, intentional).
  //   • Tray pushed down ONLY enough to separate it visually from the board;
  //     uses marginTop: 10 instead of the old 38px bottom margin.
  //
  return (
    <SafeAreaView
      style={s.game}
      edges={['right', 'left', 'top']}
    >
      <View style={s.gameContent}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* ── Header ── */}
        <View style={[s.header, {
          paddingTop: Math.max(
            insets.top,
            Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
          ) + 10,
        }]}>
        <Animated.Text
          style={[s.scoreTxt, { transform: [{ scale: anim.scorePopAnim }] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {score.toLocaleString()}
        </Animated.Text>

        <View style={s.statsRow}>
          <View style={s.statBlock}>
            <Text style={s.statVal} numberOfLines={1}>{level}</Text>
            <Text style={s.statLbl}>LEVEL</Text>
          </View>
          <View style={s.statBlock}>
            <Text style={[s.statVal, { color: COLORS.accent }]} numberOfLines={1}>
              {target.toLocaleString()}
            </Text>
            <Text style={s.statLbl}>GOAL</Text>
          </View>
          <View style={s.statBlock}>
            <Text style={[s.statVal, inDanger && s.dangerTxt]} numberOfLines={1}>
              {timeLeft}s
            </Text>
            <Text style={s.statLbl}>TIME</Text>
          </View>
          <TouchableOpacity 
            onPress={handleTogglePause} 
            style={s.pauseBtn} 
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.pauseIco}>{isPaused ? '▶' : '⏸'}</Text>
          </TouchableOpacity>
          {/* Power-up buttons */}
          <PowerUpButton
            type="UNDO"
            count={st.powerUps.UNDO}
            onPress={() => {
              if (st.usePowerUp('UNDO')) {
                engine.undoLastMove();
              }
            }}
            disabled={isPaused || engine.isGameEnded()}
          />
          <PowerUpButton
            type="TIME_FREEZE"
            count={st.powerUps.TIME_FREEZE}
            onPress={() => {
              if (st.usePowerUp('TIME_FREEZE')) {
                engine.activateTimeFreeze();
              }
            }}
            disabled={isPaused || engine.isGameEnded()}
          />
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, {
            width: `${Math.min((score / target) * 100, 100)}%`,
          }]} />
        </View>

        {/* Timer bar */}
        <View style={s.timerTrack}>
          <Animated.View style={[s.timerFill, {
            width: anim.timerBarAnim.interpolate({
              inputRange: [0, 1], outputRange: ['0%', '100%'],
            }),
            backgroundColor: anim.timerColor,
          }]} />
        </View>
      </View>

      {/* ── Combo label ── */}
      <Animated.Text style={[s.comboTxt, {
        opacity:   anim.comboOpacity,
        transform: [{ scale: anim.comboScale }],
      }]}>
        {comboLbl}
      </Animated.Text>

      {/* ── Board ── */}
      <View style={s.boardWrapper}>
        <Animated.View style={[
          s.boardColorLayer,
          { opacity: anim.pressureGlow },
        ]} />
        <Animated.View style={[
          s.boardDangerLayer,
          { opacity: anim.dangerGlow },
        ]} />
        <Animated.View
          ref={engine.boardMeasureRef}
          collapsable={false}
          onLayout={onBoardLayout}
          style={{
            transform: [
              { translateX: anim.dangerShakeX },
              { translateX: anim.shakeAnim    },
              { scale:      anim.dangerPulse  },
              { scale:      anim.boardPulse   },
              { scale:      anim.placeAnim    },
            ],
          }}
        >
          <GameBoard grid={grid} flashCells={flash} ghost={ghost} />
        </Animated.View>
      </View>

      {/* ── Piece tray ──────────────────────────────────────────────────────
       *
       * FIX ②③ — no overlap, bigger pieces:
       *
       * The tray uses overflow:'visible' so a dragged block can float above
       * the board without being clipped.  However the SLOTS themselves must
       * NOT use overflow:'visible' — that was the source of bleed-through.
       *
       * Each slot is given an EXACT pixel width (SLOT_WIDTH, computed at the
       * top of the file from tray width, padding, and gap count).  This
       * means three slots fill the tray perfectly with no overflow.
       *
       * The tray height is 130 (was 104/108) and the slot height is 110
       * (was ~96) so blocks have a much larger preview canvas.
       */}
      <View style={s.tray}>
        {shapes.map((sh, idx) => (
          <View
            key={sh.id}
            style={[
              s.slot,
              // Use gap instead of marginHorizontal to keep SLOT_WIDTH exact.
              idx < shapes.length - 1 && { marginRight: SLOT_GAP },
              { zIndex: 10 + idx },
            ]}
          >
            <DraggableBlock
              shape={sh}
              onDrop={onDrop}
              onDragMove={onDragMove}
              disabled={isPaused || engine.isGameEnded()}
            />
          </View>
        ))}
      </View>

      {/* ── Floating scores ── */}
      <View pointerEvents="none" style={s.floatLayer}>
        {floatingScores.map((fs, i) => (
          <FloatingScore
            key={fs.id}
            value={fs.value}
            x={SW * 0.5 - 74 + ((i % 2) === 0 ? -46 : 46)}
            y={SH * 0.52 + (i % 3) * 12}
            boost={fs.boost}
            label={fs.label}
            onComplete={() => setFloatingScores(prev => prev.filter(it => it.id !== fs.id))}
          />
        ))}
      </View>

      {/* ── Particle effects ── */}
      <View pointerEvents="none" style={s.floatLayer}>
        {particles.map((p) => (
          <ParticleEffect
            key={p.id}
            active={p.id}
            x={p.x}
            y={p.y}
            color={p.color}
            onComplete={() => setParticles(prev => prev.filter(it => it.id !== p.id))}
          />
        ))}
      </View>

      {/* ── Fever mode indicator ── */}
      {feverMode && (
        <View style={s.feverBanner}>
          <Text style={s.feverBannerText}>🔥 FEVER MODE 🔥</Text>
          <Text style={s.feverBannerSub}>3× SCORE ACTIVE</Text>
        </View>
      )}

      {/* ── Achievement popup ── */}
      {achievementPopup && (
        <View style={s.achievementPopup}>
          <Text style={s.achievementIcon}>{achievementPopup.icon}</Text>
          <Text style={s.achievementTitle}>ACHIEVEMENT UNLOCKED!</Text>
          <Text style={s.achievementName}>{achievementPopup.name}</Text>
        </View>
      )}

      {/* ── Pause overlay ── */}
      {isPaused && (
        <View style={s.pauseOverlay}>
          <TouchableOpacity
            style={s.pauseContent}
            onPress={handleTogglePause}
            activeOpacity={0.9}
          >
            <Text style={s.pauseOverlayTxt}>PAUSED</Text>
            <Text style={s.pauseOverlayHint}>TAP TO RESUME</Text>
          </TouchableOpacity>
          
          <View style={s.pauseSettings}>
            <TouchableOpacity style={s.pauseIconBtn} onPress={handleToggleSound}>
              <Text style={s.pauseIconTxt}>{st.soundEnabled ? '🔊' : '🔇'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.pauseIconBtn} onPress={handleToggleVib}>
              <Text style={s.pauseIconTxt}>{st.vibEnabled ? '📳' : '📴'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── End modal ── */}
      <Modal visible={gameOver || isWin} transparent animationType="fade">
        <SafeAreaView style={s.modalSafe} edges={['top','right','left','bottom']}>
          <View style={s.modalOverlay}>
            <Animated.View style={[s.modalBox, { transform: [{ scale: anim.modalPopAnim }] }]}>
              <View style={[s.iconCircle, { borderColor: endMsg.color }]}>
                <Text style={[s.modalIco, { color: endMsg.color }]}>{endMsg.icon}</Text>
              </View>
              <Text style={[s.modalTitle, { color: endMsg.color }]} numberOfLines={1}>
                {endMsg.title}
              </Text>
              <Text style={s.modalSub}>{endMsg.sub}</Text>

              <View style={s.modalStats}>
                <View style={s.statRow}>
                  <Text style={s.statRowLbl}>SCORE</Text>
                  <Text style={s.statRowVal}>{score.toLocaleString()}</Text>
                </View>
                {score > st.bestScore && (
                  <View style={[s.statRow, { backgroundColor: COLORS.accent + '22' }]}>
                    <Text style={[s.statRowLbl, { color: COLORS.accent }]}>NEW BEST!</Text>
                    <Text style={[s.statRowVal, { color: COLORS.accent }]}>{score.toLocaleString()}</Text>
                  </View>
                )}
                <View style={s.statRow}>
                  <Text style={s.statRowLbl}>LEVEL</Text>
                  <Text style={s.statRowVal}>{level}</Text>
                </View>
                {!isWin && (
                  <View style={s.statRow}>
                    <Text style={s.statRowLbl}>TARGET</Text>
                    <Text style={s.statRowVal}>{target.toLocaleString()}</Text>
                  </View>
                )}
              </View>

              {showTimeoutBonusOffer ? (
                <View style={{ width: '100%' }}>
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: COLORS.accent, marginBottom: 12, opacity: (isRewardedAdLoading || rewardedAdRequested) ? 0.6 : 1 }]}
                    onPress={handleWatchRewardedAd}
                    activeOpacity={0.7}
                    disabled={isRewardedAdLoading || rewardedAdRequested}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.btnTxt} numberOfLines={1}>
                      {isRewardedAdLoading ? '⏳ LOADING AD...' : (rewardedAdRequested ? 'AD REQUESTED' : '📺 WATCH AD TO CONTINUE')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: '#444' }]}
                    onPress={handleDeclineTimeoutBonus}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.btnTxt} numberOfLines={1}>
                      GIVE UP
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: endMsg.color }]}
                  onPress={handleRetryOrContinue}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={s.btnTxt} numberOfLines={1}>
                    {isWin ? `CONTINUE  LVL ${level + 1}` : 'TRY AGAIN'}
                  </Text>
                </TouchableOpacity>
              )}

              {showTimeoutBonusOffer ? null : (
                <TouchableOpacity 
                  onPress={() => setScreen('MENU')} 
                  style={s.menuLink}
                  activeOpacity={0.6}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Text style={s.menuLinkTxt}>MAIN MENU</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Notification Consent Modal ── */}
      <NotificationConsent
        visible={showNotificationConsent}
        onClose={() => setShowNotificationConsent(false)}
        onEnabled={() => {
          console.log('Notifications enabled successfully');
        }}
      />

      </View>

      {/* Banner Ad at bottom of Gameplay — Moved outside main content to prevent overlap */}
      {screen === 'PLAYING' && (
        <View style={[s.bannerWrap, { paddingBottom: Math.max(insets.bottom, 4) }]}>
          <BannerAdComponent />
        </View>
      )}

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <GridSnapApp />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  // ── Game wrapper ──────────────────────────────────────────────────────────
  // FIX ①: flex-start so header anchors to top; board + tray follow
  // naturally rather than being space-distributed all the way to the bottom.
  game: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bannerWrap: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#111',
  },

  center: {
    flex: 1, backgroundColor: '#000', justifyContent: 'center',
    alignItems: 'center', gap: 16, paddingHorizontal: SW * 0.1,
  },

  // ── Menu ──────────────────────────────────────────────────────────────────
  menuWrap: {
    flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center',
    gap: 14, paddingHorizontal: SW * 0.08,
  },
  menuGlowTop: {
    position: 'absolute', top: -120, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(44,246,200,0.12)',
  },
  menuGlowBottom: {
    position: 'absolute', bottom: -140, left: -90,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(58,118,255,0.10)',
  },

  // ── Consent ───────────────────────────────────────────────────────────────
  popupBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SW * 0.08,
  },
  consentCard: {
    width: '100%', maxWidth: 520, backgroundColor: '#121A2A',
    borderRadius: 22, borderWidth: 1, borderColor: '#2A3650',
    padding: rs(20), alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 14,
  },
  consentIcon:    { width: rs(72), height: rs(72), borderRadius: rs(36), backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  consentIconTxt: { fontSize: rs(32) },
  consentTitle:   { color: '#FFF', fontSize: rs(26), fontWeight: '900', textAlign: 'center' },
  consentScroll:  { maxHeight: rs(140), width: '100%' },
  consentBody:    { color: '#A3B3CD', fontSize: rs(13), textAlign: 'center', lineHeight: rs(20) },
  linkBtn:        { paddingVertical: 6 },
  linkTxt:        { color: '#82A0D0', fontSize: rs(11), fontWeight: '700', letterSpacing: 1.5, textDecorationLine: 'underline' },
  acceptBtn:      { width: '100%', backgroundColor: '#00E5A0', paddingVertical: rs(18), borderRadius: 24, alignItems: 'center', marginTop: 8 },
  acceptTxt:      { color: '#000', fontWeight: '900', fontSize: rs(17), letterSpacing: 1.5 },
  declineBtn:     { paddingVertical: rs(12), paddingHorizontal: rs(32) },
  declineTxt:     { color: '#444', fontWeight: '700', fontSize: rs(13), letterSpacing: 2 },

  // ── Declined ──────────────────────────────────────────────────────────────
  declinedIco:   { fontSize: rs(52), marginBottom: 10 },
  declinedTitle: { color: '#FFF', fontSize: rs(22), fontWeight: '900', marginBottom: 10 },
  declinedBody:  { color: '#555', fontSize: rs(13), textAlign: 'center', lineHeight: rs(20), marginBottom: 16 },

  // ── Menu cards ────────────────────────────────────────────────────────────
  menuHero: {
    width: '100%', backgroundColor: '#0E1420', borderRadius: 24,
    padding: rs(20), borderWidth: 1, borderColor: '#233149', alignItems: 'center', gap: 8,
    shadowColor: COLORS.accent, shadowOpacity: 0.08, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  menuBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#1A2538' },
  menuBadgeTxt: { color: '#8EA6CF', fontSize: rs(9), fontWeight: '800', letterSpacing: 1.4 },
  appName:      { color: '#FFF', fontSize: rs(52), fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  appTag:       { color: '#8FA1BF', fontSize: rs(11), letterSpacing: 4, marginTop: -1 },
  menuSubTag:   { color: '#5C6E8D', fontSize: rs(10), letterSpacing: 2.2, fontWeight: '700' },
  menuStatsRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 6 },
  menuStatCard: { flex: 1, backgroundColor: '#121C2C', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  menuStatVal:  { color: '#FFF', fontSize: rs(18), fontWeight: '900' },
  menuStatLbl:  { color: '#7E90AD', fontSize: rs(9), letterSpacing: 1.5, fontWeight: '700' },
  streakPill:   { marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#0F1A16', borderWidth: 1, borderColor: '#1C4C3F' },
  streakTxt:    { color: COLORS.accent, fontSize: rs(12), fontWeight: '800', letterSpacing: 1 },
  mainBtn:      { width: '100%', backgroundColor: COLORS.accent, paddingHorizontal: rs(30), paddingVertical: rs(18), borderRadius: 18, marginTop: 6, alignItems: 'center', shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 10 },
  mainBtnTxt:   { color: '#03120E', fontWeight: '900', fontSize: rs(18), letterSpacing: 1.2 },
  mainBtnSub:   { color: '#0C4538', fontWeight: '700', fontSize: rs(11), letterSpacing: 0.8, marginTop: 2 },
  secBtn:       { width: '100%', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#273147', alignItems: 'center', backgroundColor: '#0E1420' },
  secBtnTxt:    { color: '#AFC3E5', fontWeight: '800', fontSize: rs(12), letterSpacing: 1.4 },
  settingsRow:  { flexDirection: 'row', gap: 16, marginTop: 6 },
  iconBtn:      { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0F1522', borderWidth: 1, borderColor: '#273147', alignItems: 'center', justifyContent: 'center' },
  iconTxt:      { fontSize: 21 },
  privBtn:      { paddingHorizontal: 20, paddingVertical: 10, marginTop: 'auto' },
  privTxt:      { color: '#5F7395', fontWeight: '700', fontSize: rs(11), letterSpacing: 1.2 },

  // ── Game header ───────────────────────────────────────────────────────────
  header: { width: '92%', alignItems: 'center', gap: 7 },
  scoreTxt: {
    color: '#FFF', fontSize: rs(58), fontWeight: '900',
    lineHeight: rs(64), textAlign: 'center',
    // Premium: subtle glow on score number
    textShadowColor: 'rgba(255,255,255,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  statsRow:  { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  statBlock: { alignItems: 'center' },
  statVal:   { color: '#FFF', fontWeight: '800', fontSize: rs(15) },
  statLbl:   { color: '#2E3C52', fontSize: rs(8), letterSpacing: 3, fontWeight: '700' },
  dangerTxt: { color: '#FF3D00' },
  pauseBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pauseIco:  { color: '#666', fontSize: rs(15) },

  // ── Progress / timer bars ─────────────────────────────────────────────────
  progressTrack: { width: '100%', height: 3, backgroundColor: '#0D1520', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  timerTrack:    { width: '100%', height: 3, backgroundColor: '#0D1520', borderRadius: 2, overflow: 'hidden' },
  timerFill:     { height: '100%', borderRadius: 2 },

  // ── Combo label ───────────────────────────────────────────────────────────
  comboTxt: {
    color: COLORS.accent,
    fontSize: rs(22),
    fontWeight: '900',
    letterSpacing: 2,
    height: rs(28),
    textAlign: 'center',
    marginTop: 4,
    textShadowColor: COLORS.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  floatLayer: { ...StyleSheet.absoluteFillObject, zIndex: 40, elevation: 40 },

  // ── Fever mode banner ─────────────────────────────────────────────────────
  feverBanner: {
    position: 'absolute',
    top: SH * 0.28,
    alignSelf: 'center',
    zIndex: 45,
    elevation: 45,
    backgroundColor: 'rgba(255, 100, 0, 0.15)',
    borderWidth: 2,
    borderColor: '#FF6400',
    borderRadius: 999,
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
    alignItems: 'center',
    shadowColor: '#FF6400',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  feverBannerText: {
    color: '#FF6400',
    fontSize: rs(20),
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#FF6400',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  feverBannerSub: {
    color: '#FF9040',
    fontSize: rs(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // ── Achievement popup ────────────────────────────────────────────────────
  achievementPopup: {
    position: 'absolute',
    top: SH * 0.15,
    alignSelf: 'center',
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 16,
    paddingHorizontal: rs(24),
    paddingVertical: rs(12),
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.7,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  achievementIcon: {
    fontSize: rs(36),
    marginBottom: 4,
  },
  achievementTitle: {
    color: '#FFD700',
    fontSize: rs(11),
    fontWeight: '900',
    letterSpacing: 2,
  },
  achievementName: {
    color: '#FFF',
    fontSize: rs(16),
    fontWeight: '900',
    marginTop: 2,
  },

  // ── Board layers ──────────────────────────────────────────────────────────
  boardWrapper: {
    width: (CELL_SIZE * GRID_SIZE) + 18,    // Explicit width (board + borders + padding)
    height: (CELL_SIZE * GRID_SIZE) + 18,   // Explicit height (board + borders + padding)
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#080D14',
    marginTop: 6,         // FIX ①: small but intentional gap from combo label
    alignItems: 'center',
    justifyContent: 'center',
    // Premium: outer glow ring
    shadowColor: COLORS.accent,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  boardColorLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,159,0,0.8)', // Pressure glow (orange)
  },
  boardDangerLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,30,0,1.0)',  // Danger glow (red)
  },

  // ── Piece tray ────────────────────────────────────────────────────────────
  // FIX ②③: larger height, overflow:'visible' on container only, exact
  // SLOT_WIDTH used per slot so three slots never overlap.
  tray: {
    flexDirection: 'row',
    width: TRAY_WIDTH,
    height: 130,                            // was 108 — 22px taller for bigger pieces
    paddingHorizontal: TRAY_PAD_H,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 10 : 8,
    marginTop: 10,                          // gap below board
    // FIX ①: no large marginBottom; paddingBottom on SafeAreaView handles
    // the bottom safe zone.
    marginBottom: 0,
    borderRadius: 20,
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E2D44',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'visible',                    // allow dragged blocks to float up
    // Premium: subtle inner highlight via extra border
    // (borderTopColor lighter gives a glass-edge effect)
  },

  // ── Tray slot ─────────────────────────────────────────────────────────────
  // FIX ②③: exact SLOT_WIDTH prevents any overlap; default overflow
  // ('hidden') clips only the static layout while the gesture layer escapes
  // via the GestureHandlerRootView portal.
  slot: {
    width: SLOT_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#10182A',
    borderWidth: 1,
    borderColor: '#1C2C42',
    // Premium: pressed-inset look via shadow
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // ── Bonus banner ──────────────────────────────────────────────────────────
  bonusBanner: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 150,
    zIndex: 60,
    elevation: 60,
    backgroundColor: '#071510',
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 22,
    paddingHorizontal: rs(30),
    paddingVertical: rs(16),
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  bonusBannerText: {
    color: COLORS.accent,
    fontSize: rs(28),
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: COLORS.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  bonusBannerSub: {
    color: '#3A7058',
    fontSize: rs(11),
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 3,
  },

  // ── Pause overlay ─────────────────────────────────────────────────────────
  pauseOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  pauseContent:     { alignItems: 'center', justifyContent: 'center', padding: 40 },
  pauseOverlayTxt:  { color: '#FFF', fontSize: rs(42), fontWeight: '900', letterSpacing: 8 },
  pauseOverlayHint: { color: COLORS.accent, fontSize: rs(12), fontWeight: '700', letterSpacing: 4, marginTop: 10 },
  pauseSettings:    { flexDirection: 'row', gap: 24, marginTop: 20 },
  pauseIconBtn:     { width: rs(60), height: rs(60), borderRadius: rs(30), backgroundColor: '#1A2538', borderWidth: 1, borderColor: '#33496E', alignItems: 'center', justifyContent: 'center' },
  pauseIconTxt:     { fontSize: rs(28) },

  // ── End modal ─────────────────────────────────────────────────────────────
  modalSafe:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SW * 0.08 },
  modalBox: {
    width: '100%', backgroundColor: '#0E1624',
    padding: rs(28), borderRadius: 28, alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#1E2F47',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 }, elevation: 18,
  },
  iconCircle:   { width: rs(72), height: rs(72), borderRadius: rs(36), borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  modalIco:     { fontSize: rs(32), fontWeight: '900' },
  modalTitle:   { fontSize: rs(24), fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  modalSub:     { color: '#4A5A74', fontSize: rs(12), textAlign: 'center', marginTop: -4 },
  modalStats:   { width: '100%', gap: 8, marginTop: 2 },
  statRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, backgroundColor: '#080E18', borderRadius: 12 },
  statRowLbl:   { color: '#3A4A64', fontSize: rs(11), fontWeight: '700', letterSpacing: 2 },
  statRowVal:   { color: '#FFF', fontSize: rs(17), fontWeight: '800' },
  btn: {
    width: '100%', padding: rs(16), borderRadius: 14, alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.accent, shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  btnTxt:       { color: '#000', fontWeight: '900', fontSize: rs(14), letterSpacing: 1 },
  menuLink:     { paddingVertical: 8 },
  menuLinkTxt:  { color: '#2E3E58', fontSize: rs(11), fontWeight: '700', letterSpacing: 3 },
});
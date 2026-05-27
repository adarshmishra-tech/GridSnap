/**
 * src/utils/audioManager.js
 *
 * Sounds:
 *   PLACE — piece placed, no clear
 *   CLEAR — line cleared  (plays 60ms after animation peak)
 *   WIN   — level win
 *   LOSE  — game over
 *   TICK  — danger mode loop (≤20s), looped internally
 *
 * Rules:
 *   - All sounds preloaded at boot — zero latency at play-time
 *   - TICK loops internally; stopTick() halts it cleanly
 *   - No sound overlaps CLEAR spam: CLEAR has a 200ms cooldown
 *   - All errors silently swallowed — never crashes the game
 */

let Audio = null;
try { Audio = require('expo-av').Audio; } catch (_) {}

// ─── Module state ─────────────────────────────────────────────────────────────
let _muted          = false;
let _tickPlaying    = false;
let _tickSound      = null;   // separate ref for the looping tick
let _lastClearMs    = 0;      // spam guard for CLEAR sound
const CLEAR_COOLDOWN = 200;   // ms

const _pool = {};  // key → Sound instance
const _pendingTimeouts = new Set();

// ─── Assets ───────────────────────────────────────────────────────────────────
const SOUND_ASSETS = {
  PLACE: require('../../assets/sounds/place.mp3'),
  CLEAR: require('../../assets/sounds/clear.mp3'),
  WIN:   require('../../assets/sounds/win.mp3'),
  LOSE:  require('../../assets/sounds/lose.mp3'),
  TICK:  require('../../assets/sounds/tick.mp3'),
};

const SOUND_VOLUME = {
  PLACE: 0.55,
  CLEAR: 0.9,
  WIN:   1.0,
  LOSE:  0.95,
  TICK:  0.4,
};

// ─────────────────────────────────────────────────────────────────────────────
// initSounds — call once at app boot
// ─────────────────────────────────────────────────────────────────────────────
export async function initSounds() {
  if (!Audio) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  } catch (_) {}

  for (const [key, asset] of Object.entries(SOUND_ASSETS)) {
    try {
      const { sound } = await Audio.Sound.createAsync(asset, {
        shouldPlay: false,
        volume:     SOUND_VOLUME[key] ?? 1.0,
        isLooping:  key === 'TICK',   // tick loops automatically
      });
      _pool[key] = sound;
      if (key === 'TICK') _tickSound = sound;
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// playSound — play a one-shot sound by key
// ─────────────────────────────────────────────────────────────────────────────
export function playSound(key, delayMs = 0) {
  if (_muted) return;
  const sound = _pool[key];
  if (!sound) return;

  // Spam guard for CLEAR
  if (key === 'CLEAR') {
    const now = Date.now();
    if (now - _lastClearMs < CLEAR_COOLDOWN) return;
    _lastClearMs = now;
  }

  const play = () => {
    sound.setPositionAsync(0)
      .then(() => sound.playAsync())
      .catch(() => {});
  };

  if (delayMs > 0) {
    const t = setTimeout(() => {
      _pendingTimeouts.delete(t);
      play();
    }, delayMs);
    _pendingTimeouts.add(t);
  } else {
    play();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// startTick — begin danger-mode loop
// rate: 'normal' (≤20s) or 'fast' (≤10s)
// ─────────────────────────────────────────────────────────────────────────────
export async function startTick(rate = 'normal') {
  if (_muted || !_tickSound) return;
  if (_tickPlaying) {
    // Already playing — just adjust rate (pitch via rate property)
    try {
      await _tickSound.setRateAsync(rate === 'fast' ? 1.6 : 1.0, true);
    } catch (_) {}
    return;
  }
  try {
    await _tickSound.setRateAsync(rate === 'fast' ? 1.6 : 1.0, true);
    await _tickSound.setPositionAsync(0);
    await _tickSound.playAsync();
    _tickPlaying = true;
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// stopTick — halt danger-mode loop
// ─────────────────────────────────────────────────────────────────────────────
export async function stopTick() {
  if (!_tickSound) return;
  _tickPlaying = false;
  try {
    await _tickSound.stopAsync();
    await _tickSound.setPositionAsync(0);
    // Reset rate back to normal for next use
    await _tickSound.setRateAsync(1.0, true);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// setMuted — global mute toggle
// ─────────────────────────────────────────────────────────────────────────────
export function setMuted(value) {
  _muted = Boolean(value);
  if (_muted && _tickPlaying) {
    stopTick();
  }
}

export function isMuted() {
  return _muted;
}

// ─────────────────────────────────────────────────────────────────────────────
// releaseSounds — unload all sound resources + pending timers
// Call on app unmount to prevent leaks in long sessions/dev reloads.
// ─────────────────────────────────────────────────────────────────────────────
export async function releaseSounds() {
  for (const t of _pendingTimeouts) clearTimeout(t);
  _pendingTimeouts.clear();

  _tickPlaying = false;
  _tickSound = null;
  _lastClearMs = 0;

  const unloads = Object.keys(_pool).map(async (key) => {
    try {
      await _pool[key]?.unloadAsync?.();
    } catch (_) {}
    delete _pool[key];
  });
  await Promise.all(unloads);
}
/**
 * src/utils/adManager.js
 *
 * Optimized AdMob manager for GridSnap.
 * Includes Interstitial, Rewarded, and App Open ads with robust retry logic.
 */

import mobileAds, {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  TestIds,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

// Ad Unit IDs
const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-9567251998227475/1795402781';
const REWARDED_AD_UNIT_ID = 'ca-app-pub-9567251998227475/5049470677';
const APP_OPEN_AD_UNIT_ID = __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-9567251998227475/4192630511';

// Shared config
const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: false, // Default to false for better fill rate
  keywords: ['games', 'puzzles', 'arcade', 'brain training', 'blocks', 'grid'],
  maxAdContentRating: MaxAdContentRating.G, // Suitable for all audiences
};

// State
let interstitialInstance = null;
let rewardedInstance = null;
let appOpenInstance = null;

let interstitialRetryCount = 0;
let rewardedRetryCount = 0;
let appOpenRetryCount = 0;

let isInitialized = false;

const MAX_RETRY_COUNT = 5;

/**
 * Initialize the Mobile Ads SDK.
 */
export const initializeAds = async () => {
  if (isInitialized) return;
  try {
    // Set global configuration BEFORE initialization for better reliability
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIds: ['4CCBE0EF63FFB5515F8F377E6FE9E636'],
    });

    const results = await mobileAds().initialize();
    isInitialized = true;
    console.log('Mobile Ads SDK Initialized', results);

    // Start preloading
    preloadInterstitial();
    preloadRewarded();
    preloadAppOpenAd();
  } catch (error) {
    console.warn('Mobile Ads SDK Initialization failed:', error);
  }
};

/**
 * Preload Interstitial Ad
 */
export const preloadInterstitial = () => {
  if (!isInitialized) {
    setTimeout(preloadInterstitial, 2000);
    return;
  }
  if (interstitialInstance) return;

  try {
    interstitialInstance = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, AD_REQUEST_OPTIONS);

    interstitialInstance.addAdEventListener(AdEventType.LOADED, () => {
      console.log('Interstitial Ad Loaded');
      interstitialRetryCount = 0;
    });

    interstitialInstance.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialInstance = null;
      preloadInterstitial();
    });

    interstitialInstance.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Interstitial Ad Error:', error.code, error.message);
      interstitialInstance = null;
      if (interstitialRetryCount < MAX_RETRY_COUNT) {
        const delay = Math.pow(2, interstitialRetryCount) * 2000;
        setTimeout(() => {
          interstitialRetryCount++;
          preloadInterstitial();
        }, delay);
      }
    });

    interstitialInstance.load();
  } catch (e) {
    if (__DEV__) console.error('Error preloading interstitial:', e);
  }
};

/**
 * Preload Rewarded Ad
 */
export const preloadRewarded = () => {
  if (!isInitialized) {
    setTimeout(preloadRewarded, 2000);
    return;
  }
  if (rewardedInstance) return;

  try {
    rewardedInstance = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, AD_REQUEST_OPTIONS);

    rewardedInstance.addAdEventListener(AdEventType.LOADED, () => {
      console.log('Rewarded Ad Loaded');
      rewardedRetryCount = 0;
    });

    rewardedInstance.addAdEventListener(AdEventType.CLOSED, () => {
      rewardedInstance = null;
      preloadRewarded();
    });

    rewardedInstance.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Rewarded Ad Error:', error.code, error.message);
      rewardedInstance = null;
      if (rewardedRetryCount < MAX_RETRY_COUNT) {
        const delay = Math.pow(2, rewardedRetryCount) * 2000;
        setTimeout(() => {
          rewardedRetryCount++;
          preloadRewarded();
        }, delay);
      }
    });

    rewardedInstance.load();
  } catch (e) {
    if (__DEV__) console.error('Error preloading rewarded:', e);
  }
};

/**
 * Preload App Open Ad
 */
export const preloadAppOpenAd = () => {
  if (!isInitialized) {
    setTimeout(preloadAppOpenAd, 2000);
    return;
  }
  if (appOpenInstance) return;

  appOpenInstance = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, AD_REQUEST_OPTIONS);

  appOpenInstance.addAdEventListener(AdEventType.LOADED, () => {
    console.log('App Open Ad Loaded');
    appOpenRetryCount = 0;
  });

  appOpenInstance.addAdEventListener(AdEventType.CLOSED, () => {
    appOpenInstance = null;
    preloadAppOpenAd();
  });

  appOpenInstance.addAdEventListener(AdEventType.ERROR, (error) => {
    console.warn('App Open Ad Error:', error.code, error.message);
    appOpenInstance = null;
    if (appOpenRetryCount < MAX_RETRY_COUNT) {
      const delay = Math.pow(2, appOpenRetryCount) * 2000;
      setTimeout(() => {
        appOpenRetryCount++;
        preloadAppOpenAd();
      }, delay);
    }
  });

  appOpenInstance.load();
};

/**
 * Show Interstitial Ad
 */
export const showInterstitialAd = () => {
  return new Promise((resolve) => {
    if (interstitialInstance && interstitialInstance.loaded) {
      const unsub = interstitialInstance.addAdEventListener(AdEventType.CLOSED, () => {
        unsub();
        resolve(true);
      });
      interstitialInstance.show().catch(() => {
        unsub();
        resolve(false);
      });
    } else {
      preloadInterstitial();
      resolve(false);
    }
  });
};

/**
 * Show Rewarded Ad
 */
export const showRewardedAd = () => {
  return new Promise((resolve) => {
    if (rewardedInstance && rewardedInstance.loaded) {
      let rewardEarned = false;

      const unsubEarned = rewardedInstance.addAdEventListener(AdEventType.EARNED_REWARD, () => {
        rewardEarned = true;
      });

      const unsubClosed = rewardedInstance.addAdEventListener(AdEventType.CLOSED, () => {
        unsubEarned();
        unsubClosed();
        resolve(rewardEarned);
      });

      rewardedInstance.show().catch(() => {
        unsubEarned();
        unsubClosed();
        resolve(false);
      });
    } else {
      // If not loaded, attempt a fast load or fail gracefully
      if (!isInitialized) {
        resolve(false);
        return;
      }
      const tempAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, AD_REQUEST_OPTIONS);
      let earned = false;
      let timeout = setTimeout(() => {
        resolve(false);
      }, 7000);

      tempAd.addAdEventListener(AdEventType.LOADED, () => {
        clearTimeout(timeout);
        tempAd.show().catch(() => resolve(false));
      });
      tempAd.addAdEventListener(AdEventType.EARNED_REWARD, () => { earned = true; });
      tempAd.addAdEventListener(AdEventType.CLOSED, () => { resolve(earned); });
      tempAd.addAdEventListener(AdEventType.ERROR, () => {
        clearTimeout(timeout);
        resolve(false);
      });
      tempAd.load();
    }
  });
};

/**
 * Show App Open Ad (call on app start or foregrounding)
 */
export const showAppOpenAd = () => {
  return new Promise((resolve) => {
    if (appOpenInstance && appOpenInstance.loaded) {
      const unsub = appOpenInstance.addAdEventListener(AdEventType.CLOSED, () => {
        unsub();
        resolve(true);
      });
      appOpenInstance.show().catch(() => {
        unsub();
        resolve(false);
      });
    } else {
      preloadAppOpenAd();
      resolve(false);
    }
  });
};

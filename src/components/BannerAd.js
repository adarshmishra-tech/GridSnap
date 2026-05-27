/**
 * src/components/BannerAd.js
 *
 * Bare React Native AdMob Banner component for GridSnap.
 * Ad Unit ID: ca-app-pub-9567251998227475/8467410892
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = 'ca-app-pub-9567251998227475/8467410892';

const BannerAdComponent = () => {
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleAdFailed = (error) => {
    console.warn('Banner ad failed to load:', error.code, error.message);
    setLoadError(true);

    // Retry with exponential backoff if it fails (max 5 retries)
    if (retryCount < 5) {
      const delay = Math.pow(2, retryCount) * 5000;
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setLoadError(false);
      }, delay);
    }
  };

  const handleAdLoaded = () => {
    console.log('Banner ad loaded successfully');
    setLoadError(false);
    setRetryCount(0);
  };

  // If we have a permanent error and no more retries, we could hide the component
  // but for now we keep the container to avoid layout jumps.

  return (
    <View style={styles.container}>
      {!loadError && (
        <BannerAd
          unitId={AD_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdFailed}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    minHeight: 60,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
});

export default BannerAdComponent;

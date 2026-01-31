const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = ({ config }) => {
  // Custom plugin to ensure RTL is enabled in Android manifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // Set supportsRtl="true" in application tag
    if (androidManifest.application && androidManifest.application.length > 0) {
      androidManifest.application[0].$['android:supportsRtl'] = 'true';
    }

    return config;
  });

  // Return the modified config
  return {
    ...config,
    name: 'MyNewPokerApp',
    slug: 'MyNewPokerApp',
    version: '1.0.0',
    owner: 'elico-cohen',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.elicohen.mynewpokerapp',
      supportsTablet: true,
    },
    android: {
      package: 'com.elicohen.mynewpokerapp',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
      name: 'Poker Night',
      shortName: 'Poker',
      description: 'ניהול ערבי פוקר וסטטיסטיקות',
      lang: 'he',
      dir: 'rtl',
      orientation: 'portrait',
      backgroundColor: '#0D1B1E',
      themeColor: '#35654d',
      display: 'standalone',
      startUrl: '/',
      scope: '/',
    },
    plugins: ['expo-router', 'expo-localization'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '6ac32d81-783d-4234-9063-b9533a13d8aa',
      },
      supportsRTL: true,
      forcesRTL: true,
    },
  };
};

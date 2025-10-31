const { withMainApplication } = require('@expo/config-plugins');

/**
 * Expo config plugin to force RTL layout at the native Android level
 * This ensures RTL works from the first app launch without needing a restart
 */
const withRTL = (config) => {
  return withMainApplication(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Check if RTL configuration already exists
    if (contents.includes('I18nUtil.getInstance()')) {
      return config;
    }

    // Add import for I18nUtil
    if (!contents.includes('import com.facebook.react.modules.i18nmanager.I18nUtil;')) {
      contents = contents.replace(
        /package .*;/,
        `$&\n\nimport com.facebook.react.modules.i18nmanager.I18nUtil;`
      );
    }

    // Add RTL configuration in onCreate method
    const onCreatePattern = /@Override\s+public void onCreate\(\)\s*{\s*super\.onCreate\(\);/;

    if (onCreatePattern.test(contents)) {
      contents = contents.replace(
        onCreatePattern,
        `@Override
  public void onCreate() {
    super.onCreate();

    // Force RTL layout for Hebrew
    I18nUtil sharedI18nUtilInstance = I18nUtil.getInstance();
    sharedI18nUtilInstance.allowRTL(this, true);
    sharedI18nUtilInstance.forceRTL(this, true);`
      );
    }

    modResults.contents = contents;
    return config;
  });
};

module.exports = withRTL;

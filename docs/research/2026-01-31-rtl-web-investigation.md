# RTL Web Investigation

**Date:** 2026-01-31
**Task ID:** 10
**Status:** INVESTIGATION COMPLETE

## Problem Statement

RTL (Right-to-Left) design is NOT working on web, despite:
1. HTML has `<html lang="he" dir="rtl">` in `src/app/+html.tsx`
2. `src/app/_layout.tsx` has `I18nManager.forceRTL(true)`
3. `app.config.js` has `extra.supportsRTL: true` and `extra.forcesRTL: true`

User tested in browser (incognito + regular) and PWA - RTL not applied in any case.

## Root Cause Analysis

### Finding 1: I18nManager is a NO-OP in react-native-web

**File:** `node_modules/react-native-web/dist/exports/I18nManager/index.js`

```javascript
var I18nManager = {
  allowRTL() {
    return;  // Does NOTHING
  },
  forceRTL() {
    return;  // Does NOTHING
  },
  getConstants() {
    return {
      isRTL: false  // ALWAYS returns false
    };
  }
};
```

**Evidence:** Lines 11-24 show all methods are stubs that do nothing and always return `isRTL: false`.

### Finding 2: react-native-web uses a LocaleContext system (not I18nManager)

**File:** `node_modules/react-native-web/dist/modules/useLocale/index.js`

```javascript
var defaultLocale = {
  direction: 'ltr',   // Default is LTR
  locale: 'en-US'
};
var LocaleContext = createContext(defaultLocale);
```

**How it works:**
- View, Text, TextInput all call `useLocaleContext()` to get `direction`
- This direction is used for style calculations (flex-direction flipping, etc.)
- The context defaults to `'ltr'`

### Finding 3: HTML `dir="rtl"` is disconnected from react-native-web

**Evidence:** Searched entire `node_modules/react-native-web/dist` for:
- `document.dir` - NOT FOUND
- `documentElement.dir` - NOT FOUND
- Any code reading HTML dir attribute - NOT FOUND

The HTML attribute `dir="rtl"` only affects:
- Native browser behavior (text alignment in plain HTML)
- CSS `direction` property inheritance

It does NOT affect:
- react-native-web's internal LocaleContext
- Style calculations for `flexDirection`, `marginStart`, etc.
- Any JavaScript-based RTL logic in react-native-web

### Finding 4: createDOMProps defaults to LTR

**File:** `node_modules/react-native-web/dist/modules/createDOMProps/index.js` (lines 807-809)

```javascript
var _StyleSheet = StyleSheet([style, ...], _objectSpread({
    writingDirection: 'ltr'  // Hardcoded default
  }, options)),
```

Even though this uses object spread (so options.writingDirection would override), the options come from LocaleContext which is never set to RTL.

### Finding 5: The solution chain is broken

```
Expected chain (on native):
I18nManager.forceRTL(true) -> Native module sets RTL -> All components use RTL

Actual chain (on web):
I18nManager.forceRTL(true) -> NO-OP (does nothing)
                           -> LocaleContext stays 'ltr'
                           -> All components use LTR

HTML dir="rtl" -> Browser sets direction for CSS
              -> react-native-web ignores this completely
              -> No effect on React Native styles
```

## Git History Analysis

| Commit | Date | Description | Web RTL Fixed? |
|--------|------|-------------|----------------|
| 7bdb6b7 | 2025-10-31 | Added I18nManager.forceRTL() to _layout.tsx | NO (web no-op) |
| 54e2222 | 2025-10-31 | Created plugins/withRTL.js for Android native | NO (Android only) |
| e7e211c | 2025-10-31 | Used expo-localization plugin | NO (Android only) |
| c53bcb0 | 2025-10-31 | Added Android manifest RTL config | NO (Android only) |

**Conclusion:** RTL was NEVER working on web. All previous commits only fixed Android native RTL.

## What Would Need to Change (Do NOT implement)

### Option 1: Wrap App in LocaleProvider

The `LocaleProvider` from react-native-web accepts `direction` and `locale` props:

```typescript
import { LocaleProvider } from 'react-native-web';

function RootLayout() {
  return (
    <LocaleProvider direction="rtl" locale="he">
      <App />
    </LocaleProvider>
  );
}
```

**Challenge:** `LocaleProvider` is not exported from the main `react-native` or `react-native-web` package entry point. It's in `react-native-web/dist/modules/useLocale`.

### Option 2: Pass `dir` prop to root View

react-native-web's View component accepts a `dir` prop:

```typescript
<View style={styles.container} dir="rtl">
  ...
</View>
```

When `dir` is set, it creates a LocaleProvider wrapper (see `createElement/index.js` lines 27-32).

**Challenge:** Would need to set this on EVERY View in the app or ensure the root View propagates it.

### Option 3: Use CSS direction with style overrides

Add CSS to handle direction:
```css
* {
  direction: rtl;
}
```

Plus override styles that use `flexDirection: 'row'` to use `'row-reverse'`.

**Challenge:** Would require massive style changes throughout the codebase.

### Option 4: Wait for react-native-web update

This is a known limitation. A future version of react-native-web might:
- Read document.dir and use it for LocaleContext
- Make I18nManager actually work on web
- Provide better RTL support

## Files Analyzed

| File | Purpose | Finding |
|------|---------|---------|
| `src/app/_layout.tsx` | I18nManager calls | Calls forceRTL but it's a no-op |
| `src/app/+html.tsx` | HTML template | Has correct dir="rtl" but disconnected |
| `app.config.js` | Expo config | RTL settings only affect Android native |
| `node_modules/react-native-web/dist/exports/I18nManager/index.js` | RTL API | All methods are stubs |
| `node_modules/react-native-web/dist/modules/useLocale/index.js` | Actual RTL system | Defaults to 'ltr', never updated |
| `node_modules/react-native-web/dist/exports/View/index.js` | View component | Uses LocaleContext for direction |
| `node_modules/react-native-web/dist/modules/createDOMProps/index.js` | Style processing | Defaults writingDirection to 'ltr' |

## Confidence Level

**High** - The evidence is conclusive:
1. I18nManager source code shows it's a no-op
2. LocaleContext defaults to 'ltr' and is never updated
3. No code reads HTML dir attribute
4. Version 0.19.13 of react-native-web has this limitation

## References

- react-native-web version: ~0.19.13
- Package location: `node_modules/react-native-web/dist/`
- React Native version: 0.76.6
- Expo version: ~52.0.27

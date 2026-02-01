# Fixes to Re-Apply After Revert

**Created:** 2026-01-30
**Purpose:** This file contains all context needed for Claude to re-apply fixes after reverting to an older version.
**Target Revert Commit:** `93b364d` ("Second version with full Authentication")

---

## Overview

Two fixes were successfully applied and committed in `9ca33f8` ("Third version with fonts fixes"). After reverting to `93b364d`, these fixes need to be re-applied.

---

## Fix 1: Firebase Hosting Font Deployment

### Problem
When accessing `https://mynewpokerapp.web.app`, the app showed a black error screen with "Error: a network error occurred". Browser console showed OTS (OpenType Sanitizer) parsing errors for font files.

### Root Cause
The `firebase.json` file had an ignore pattern `**/node_modules/**` which excluded ALL node_modules folders, including the bundled fonts at `dist/assets/node_modules/@expo-google-fonts/`.

When Expo exports for web (`npx expo export --platform web`), it bundles fonts into `dist/assets/node_modules/`. The overly broad ignore pattern prevented these from being deployed to Firebase Hosting.

### The Fix

**File:** `firebase.json`

**Change the ignore pattern from:**
```json
"ignore": [
  "firebase.json",
  "**/.*",
  "**/node_modules/**"
]
```

**To:**
```json
"ignore": [
  "firebase.json",
  "**/.*",
  "node_modules/**"
]
```

**Also add cache headers for fonts (optional but recommended):**
```json
"headers": [
  {
    "source": "**/*.@(js|css|ttf|woff|woff2|eot|otf)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  },
  {
    "source": "**/*.@(png|jpg|jpeg|gif|svg|ico|webp)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=86400"
      }
    ]
  }
]
```

### Complete Fixed firebase.json
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "node_modules/**"
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|ttf|woff|woff2|eot|otf)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(png|jpg|jpeg|gif|svg|ico|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ]
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

---

## Fix 2: Graceful Font Loading Error Handling

### Problem
Even after fonts were deployed correctly, if font loading failed for any reason (network issue, cache issue), the app would crash and show the error boundary screen instead of falling back gracefully.

### Root Cause
In `src/app/_layout.tsx`, the code threw an error when fonts failed to load:
```typescript
React.useEffect(() => {
  if (fontsError) throw fontsError;  // THIS CRASHES THE APP
}, [fontsError]);
```

### The Fix

**File:** `src/app/_layout.tsx`

**Find this code (around line 134-155):**
```typescript
// @ts-ignore - מתעלמים מסוג ה-useEffect
React.useEffect(() => {
  if (fontsError) throw fontsError;
}, [fontsError]);

// @ts-ignore - מתעלמים מסוג ה-useEffect
React.useEffect(() => {
  if (fontsLoaded) {
    SplashScreen.hideAsync();
    // Run data migration after fonts are loaded and splash screen is hidden
    migrateGameDates()
      .then(() => console.log('Migration check completed'))
      .catch(error => console.error('Migration check failed:', error));
  }
}, [fontsLoaded]);

if (!fontsLoaded) {
  return null;
}
```

**Replace with:**
```typescript
// Handle font loading errors gracefully - don't crash the app
// @ts-ignore - מתעלמים מסוג ה-useEffect
React.useEffect(() => {
  if (fontsError) {
    console.warn('Font loading failed, using system fonts as fallback:', fontsError);
    // Don't throw - continue with system fonts
  }
}, [fontsError]);

// @ts-ignore - מתעלמים מסוג ה-useEffect
React.useEffect(() => {
  if (fontsLoaded || fontsError) {
    // Hide splash screen when fonts loaded OR if there was an error (fallback to system fonts)
    SplashScreen.hideAsync();
    // Run data migration after splash screen is hidden
    migrateGameDates()
      .then(() => console.log('Migration check completed'))
      .catch(error => console.error('Migration check failed:', error));
  }
}, [fontsLoaded, fontsError]);

if (!fontsLoaded && !fontsError) {
  // Only show loading state if fonts are still loading (no error yet)
  return null;
}
```

### Key Changes Summary
1. Don't throw `fontsError` - just log a warning
2. Hide splash screen when fonts loaded OR when there's an error (fallback)
3. Only return null (loading state) if fonts are still loading AND no error yet

---

## Deployment Steps After Applying Fixes

1. Build the web app:
   ```bash
   npx expo export --platform web
   ```

2. Deploy to Firebase:
   ```bash
   firebase deploy --only hosting
   ```

3. Verify deployment (should show ~93 files, not ~48):
   ```bash
   # Check that fonts are in the dist folder
   ls dist/assets/node_modules/@expo-google-fonts/
   ```

---

## Known Issue NOT Yet Fixed: Logout Button

### Problem
Logout button doesn't work on web (both laptop and phone browser).

### Root Cause
Existing users created before Cloud Functions were deployed don't have custom claims (`role`) in their Firebase Auth token. The new Firestore rules require `request.auth.token.role`.

### Recommended Fix (not implemented)
Add a Cloud Function to set custom claims for all existing users, then have users re-login to get fresh tokens.

---

## Verification Checklist After Re-Applying Fixes

- [ ] App loads without error screen at https://mynewpokerapp.web.app
- [ ] Login screen appears (may use system fonts as fallback)
- [ ] No OTS parsing errors in browser console
- [ ] Network tab shows font files loading (200 status, not HTML)
- [ ] Can log in successfully

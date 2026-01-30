# Active Context

## Current Focus
Comprehensive code review completed identifying ROOT CAUSES of all reported issues. Two critical bugs found causing both reported problems.

## Recent Changes
- 2026-01-30: Comprehensive root cause analysis completed for sign out + network error issues
- 2026-01-22: Created comprehensive fixes implementation plan (docs/plans/2026-01-22-comprehensive-fixes-plan.md)
- 2026-01-22: Added explicit Android manifest RTL configuration via app.config.js (c53bcb0)

## Next Steps
1. **CRITICAL FIX 1**: Change firebase.json ignore pattern from `**/node_modules/**` to `node_modules/**`
2. **CRITICAL FIX 2**: Add graceful font fallback in `_layout.tsx` (don't throw on fontsError)
3. **CRITICAL FIX 3**: Create Cloud Function to set custom claims for all users OR add fallback rules
4. Deploy fixes and verify both issues are resolved

## Active Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Network error root cause | Firebase hosting excludes bundled fonts | `**/node_modules/**` pattern too broad |
| Sign out root cause | Users lack custom claims for Firestore rules | Rules require `request.auth.token.role` which doesn't exist |
| Font error handling | Graceful fallback, not throw | Crashing app is worse than using system fonts |
| Custom claims approach | Cloud Function needed | Only way to set custom claims on Firebase Auth tokens |

## Critical Bug Analysis (2026-01-30)

### BUG 1: "A network error occurred" on App Load

**Root Cause Chain:**
1. `firebase.json` line 7: `**/node_modules/**` excludes bundled fonts
2. Expo bundles fonts to `dist/assets/node_modules/@expo-google-fonts/`
3. Fonts not deployed to Firebase Hosting (404 errors)
4. `_layout.tsx` line 136: `throw fontsError` crashes app
5. ErrorBoundary shows "Something went wrong. Error: A network error occurred"

**Files Affected:**
- `firebase.json:7` - Wrong ignore pattern
- `src/app/_layout.tsx:136` - Throws instead of graceful fallback

### BUG 2: Sign Out Button Not Responding

**Root Cause Chain:**
1. `firestore.rules` lines 16-33: Rules require `request.auth.token.role`
2. Existing users don't have custom claims set
3. `getUserRole()` returns `undefined`
4. All permission checks (`isAdmin()`, `isSuper()`) fail
5. Firestore operations during logout fail with "Missing or insufficient permissions"
6. `AuthContext.tsx` logout waits for game saves/cleanup that never complete

**Files Affected:**
- `firestore.rules:16-33` - Rules require non-existent claims
- `src/contexts/AuthContext.tsx:444-489` - Logout hangs on failed Firestore ops

## Learnings This Session

### Root Cause Analysis Insights
1. Network error was NOT a network issue - it was a deployment/config issue
2. Sign out issue was NOT a button issue - it was a backend permissions issue
3. Both bugs were introduced together when Firestore rules were updated to use custom claims
4. The fixes in FIXES_TO_REAPPLY.md were identified correctly but not yet applied

### Key Files for Future Reference
- Firebase config: `firebase.json`
- Font loading: `src/app/_layout.tsx`
- Auth flow: `src/contexts/AuthContext.tsx`
- Firestore rules: `firestore.rules`
- Fix documentation: `.claude/cc10x/FIXES_TO_REAPPLY.md`

## Blockers / Issues

**TWO CRITICAL FIXES REQUIRED BEFORE APP IS USABLE:**
1. firebase.json ignore pattern fix (blocks web deployment)
2. Custom claims for Firestore rules (blocks all authenticated operations)

## User Preferences Discovered
- Hebrew-first application (RTL layout required)
- Focus on real-time sync and offline capability
- Multi-user poker game management with statistics tracking
- Role-based permissions (admin, super user, regular)

## Last Updated
2026-01-30 - Comprehensive root cause analysis completed

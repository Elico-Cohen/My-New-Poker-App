# Active Context

## Current Focus
**RTL Web Fix:** Research COMPLETE, Plan READY for execution.

**ROOT CAUSES IDENTIFIED (2026-02-01):**
1. **Manual RTL Workaround (153 occurrences):** `flexDirection: 'row-reverse'` causes DOUBLE reversal with `direction: rtl`
2. **Physical CSS Properties (134 occurrences):** `marginLeft/Right`, `paddingLeft/Right` don't flip in RTL

**Solution Ready:**
- Plan: `docs/plans/2026-02-01-rtl-web-fix-plan.md`
- Research: `docs/research/2026-02-01-rtl-web-solution.md`

**Previous Fixes Status:**
- Fix 1: COMPLETE - WhatsApp individual messages
- Fix 2: COMPLETE - Logout + Android back button
- Fix 3: COMPLETE - PWA implementation
- Fix 4: PENDING - Replace remaining Alert.alert calls

## Recent Changes
- 2026-02-01: **RTL ROOT CAUSE FOUND** - TWO issues: row-reverse double-reversal + physical CSS properties
- 2026-02-01: **PLAN CREATED** - `docs/plans/2026-02-01-rtl-web-fix-plan.md` (287 changes across 87 files)
- 2026-01-31: **RTL WEB FIX ATTEMPT** - Added `dir="rtl"` to root View (correct, but incomplete)
- 2026-01-31: **FIX 3 VERIFIED** - PWA implementation PASSED

## Next Steps
1. **EXECUTE RTL FIX PLAN** - `docs/plans/2026-02-01-rtl-web-fix-plan.md`
   - Phase 1: Replace 153 `row-reverse` with `row`
   - Phase 2: Replace 134 physical properties with logical
   - Phase 3: Test on web and Android
2. PENDING: **FIX 4** - Replace ALL Alert.alert calls (56 remaining)
3. Deploy to Firebase Hosting for production testing

**Correct PWA Build Workflow:**
```
1. npx expo export --platform web
2. node scripts/pwa-post-export.js
3. firebase deploy --only hosting
```

## Active Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| RTL Fix Approach | Replace row-reverse + use logical properties | Only way to fix web RTL without breaking Android |
| Physical -> Logical | marginStart/End, paddingStart/End | Auto-flip based on direction, works cross-platform |
| PWA post-build approach | Custom script (pwa-post-export.js) | Expo Metro bundler doesn't auto-copy public/ to dist/ |

## Learnings This Session

### RTL Web Deep Investigation (2026-02-01) - COMPLETE UNDERSTANDING
1. **I18nManager is a NO-OP in react-native-web** - forceRTL() does nothing on web
2. **`dir="rtl"` on root View IS correct** - But only triggers LocaleContext, not style flipping
3. **CRITICAL: `flexDirection: 'row-reverse'` + `direction: rtl` = DOUBLE REVERSAL**
   - LTR + row-reverse = right-to-left (manual RTL workaround)
   - RTL + row-reverse = left-to-right (WRONG - back to LTR!)
   - RTL + row = right-to-left (CORRECT)
4. **Physical CSS properties (`marginLeft`) don't flip** - Must use logical (`marginStart`)
5. **react-native-web PROPERTIES_I18N map** - Defines which logical properties get flipped
6. **styleq/transform-localize-style.js** - Only transforms styles with `$$css$localize` marker

### Why Android Works But Web Doesn't
- Android: I18nManager.forceRTL() works natively, row-reverse creates expected RTL
- Web: I18nManager is no-op, row-reverse + direction:rtl = double reversal

## Research References

| Topic | File | Key Insight |
|-------|------|-------------|
| RTL Web Investigation | docs/research/2026-01-31-rtl-web-investigation.md | I18nManager is no-op in RNW |
| RTL Web Solution | docs/research/2026-02-01-rtl-web-solution.md | Two root causes: row-reverse + physical properties |
| RTL Git Archaeology | docs/research/2026-02-01-rtl-git-archaeology-deep-dive.md | Historical RTL commits only fixed Android |

## Blockers / Issues

**RESOLVED:**
- RTL Web Root Cause - IDENTIFIED (double reversal + physical properties)
- PWA implementation - FIXED with post-export script

**REMAINING:**
1. RTL Web Fix - PLAN READY, needs execution
2. firebase.json ignore pattern fix (blocks web deployment)
3. Custom claims for Firestore rules (blocks all authenticated operations)

## User Preferences Discovered
- Hebrew-first application (RTL layout required)
- Focus on real-time sync and offline capability
- Multi-user poker game management with statistics tracking
- Role-based permissions (admin, super user, regular)

## Last Updated
2026-02-01 - RTL Web Research COMPLETE, Plan READY

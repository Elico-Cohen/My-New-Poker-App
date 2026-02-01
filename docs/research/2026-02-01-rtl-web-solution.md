# RTL Web Solution Research

**Date:** 2026-02-01
**Status:** RESEARCH COMPLETE
**Problem:** RTL (Right-to-Left) not working on web despite `dir="rtl"` on root View

## Executive Summary

**TWO Root Causes Found:**

1. **Physical CSS Properties (134 occurrences):** The codebase uses `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` which are NOT flipped in RTL mode by react-native-web.

2. **Manual RTL Workaround (153 occurrences):** The codebase uses `flexDirection: 'row-reverse'` as a manual RTL workaround. This conflicts with proper RTL direction, causing DOUBLE reversal.

**The Solution (Two-Part):**

**Part A - Replace Physical with Logical Properties:**
- `marginLeft` -> `marginStart`
- `marginRight` -> `marginEnd`
- `paddingLeft` -> `paddingStart`
- `paddingRight` -> `paddingEnd`

**Part B - Remove Manual RTL Workarounds:**
- `flexDirection: 'row-reverse'` -> `flexDirection: 'row'`
- Let the `direction: rtl` CSS do the reversal automatically

## Technical Analysis

### How react-native-web RTL Works

1. **View receives `dir="rtl"` prop** (current implementation in `_layout.tsx:185`)
2. **View wraps children in LocaleProvider** (`createElement/index.js:27-31`)
3. **Child Views inherit direction via LocaleContext** (`View/index.js:63-64`)
4. **CSS `direction: rtl` is applied** which automatically reverses `flex-direction: row`
5. **StyleSheet compiles styles with direction** (`StyleSheet/index.js:33`)
6. **localizeStyle flips logical properties** (`styleq/transform-localize-style.js`)

### Root Cause 1: Physical vs Logical Properties

react-native-web's `PROPERTIES_I18N` map (`StyleSheet/compiler/index.js:107-124`) defines which properties get flipped:

| Logical Property | LTR Output | RTL Output |
|------------------|------------|------------|
| `marginInlineStart` | `marginLeft` | `marginRight` |
| `marginInlineEnd` | `marginRight` | `marginLeft` |
| `paddingInlineStart` | `paddingLeft` | `paddingRight` |
| `paddingInlineEnd` | `paddingRight` | `paddingLeft` |
| `insetInlineStart` | `left` | `right` |
| `insetInlineEnd` | `right` | `left` |

**Physical properties (`marginLeft`, `paddingRight`, etc.) are NOT in this map and stay unchanged regardless of direction.**

### Root Cause 2: Manual RTL Workaround

The codebase contains 153 occurrences of `flexDirection: 'row-reverse'` as a manual RTL workaround.

**Example from HeaderBar.tsx line 106:**
```typescript
container: {
  flexDirection: 'row-reverse', // For RTL support
  ...
}
```

**The Problem:**
- CSS `direction: rtl` automatically reverses `flex-direction: row` to flow right-to-left
- Using `row-reverse` with `direction: rtl` causes DOUBLE reversal (back to left-to-right!)
- This is why RTL appears broken - elements are in wrong order

**Visual Explanation:**
```
LTR + flexDirection: 'row'         = [A] [B] [C] (left to right)
LTR + flexDirection: 'row-reverse' = [C] [B] [A] (right to left) <-- manual RTL

RTL + flexDirection: 'row'         = [C] [B] [A] (right to left) <-- CORRECT
RTL + flexDirection: 'row-reverse' = [A] [B] [C] (left to right) <-- WRONG!
```

## Codebase Analysis

### Physical Property Usage (ROOT CAUSE 1)

```
Found 134 total occurrences of marginLeft/Right/paddingLeft/Right across 43 files
```

Top files:
- `src/app/statistics/rebuys.tsx`: 33 occurrences
- `src/components/statistics/StatCard.tsx`: 8 occurrences
- `src/components/statistics/StatisticsList.tsx`: 9 occurrences
- `src/app/dashboard/groups.tsx`: 5 occurrences
- `src/components/dashboard/group/DetailsTab.tsx`: 5 occurrences

### Manual RTL Workaround Usage (ROOT CAUSE 2)

```
Found 153 total occurrences of flexDirection: 'row-reverse' across 44 files
```

Top files:
- `src/app/statistics/rebuys.tsx`: 14 occurrences
- `src/app/history/[id].tsx`: 9 occurrences
- `src/components/dashboard/group/DetailsTab.tsx`: 7 occurrences
- `src/components/dashboard/EditUserDialog.tsx`: 6 occurrences
- `src/app/gameFlow/InitialResults.tsx`: 6 occurrences

## Recommended Solution

### Phase 1: Remove Manual RTL Workarounds (CRITICAL - Do First)

**Global find-replace:**
```
Find:    flexDirection: 'row-reverse'
Replace: flexDirection: 'row'
```

**Also update comments and variable names:**
```
Find:    // For RTL support
Replace: // Standard row layout (RTL handled by direction)
```

**Files to update:** 44 files with 153 changes

### Phase 2: Replace Physical with Logical Properties

**Global find-replace:**

| Find | Replace |
|------|---------|
| `marginLeft:` | `marginStart:` |
| `marginRight:` | `marginEnd:` |
| `paddingLeft:` | `paddingStart:` |
| `paddingRight:` | `paddingEnd:` |

**CAUTION:** Review each `left:` and `right:` positioning manually - some are for absolute positioning (top/bottom/left/right) which should stay physical.

**Files to update:** 43 files with 134 changes

### Phase 3: Test and Verify

1. **Build and test web:**
   ```bash
   npx expo export --platform web
   node scripts/pwa-post-export.js
   firebase serve --only hosting
   ```

2. **Visual verification:**
   - Content should flow right-to-left
   - Hebrew text should align to the right
   - Icons should be on the correct side
   - Margins should mirror correctly

3. **Test on Android:**
   - Verify no regressions on native
   - Layout should match web

## Property Mapping Reference

### React Native Logical Properties

| Logical (USE THIS) | LTR Physical | RTL Physical |
|--------------------|--------------|--------------|
| `marginStart` | `marginLeft` | `marginRight` |
| `marginEnd` | `marginRight` | `marginLeft` |
| `paddingStart` | `paddingLeft` | `paddingRight` |
| `paddingEnd` | `paddingRight` | `paddingLeft` |
| `borderStartWidth` | `borderLeftWidth` | `borderRightWidth` |
| `borderEndWidth` | `borderRightWidth` | `borderLeftWidth` |
| `start` | `left` | `right` |
| `end` | `right` | `left` |

### Values That Auto-Flip

For `textAlign`:
- `'start'` -> `left` (LTR) / `right` (RTL)
- `'end'` -> `right` (LTR) / `left` (RTL)

### FlexDirection Behavior with direction: rtl

| FlexDirection | LTR Result | RTL Result |
|---------------|------------|------------|
| `'row'` | Left to Right | Right to Left |
| `'row-reverse'` | Right to Left | Left to Right |
| `'column'` | Top to Bottom | Top to Bottom |
| `'column-reverse'` | Bottom to Top | Bottom to Top |

## Files Analyzed

| File | Purpose | Finding |
|------|---------|---------|
| `node_modules/react-native-web/dist/exports/View/index.js` | View component | Correctly uses LocaleContext |
| `node_modules/react-native-web/dist/exports/createElement/index.js` | Element creation | Wraps in LocaleProvider when dir is set |
| `node_modules/react-native-web/dist/exports/StyleSheet/compiler/index.js` | Style compilation | PROPERTIES_I18N defines logical->physical mapping |
| `node_modules/styleq/dist/transform-localize-style.js` | RTL transformation | Only transforms styles with `$$css$localize` marker |
| `src/app/_layout.tsx` | Root layout | Correctly sets dir="rtl" on web |
| `src/components/navigation/HeaderBar.tsx` | Example of manual RTL | Uses `row-reverse` as workaround |

## Why Android Native Works

On Android:
- `I18nManager.forceRTL(true)` WORKS (unlike web where it's a no-op)
- The native layout system respects RTL direction
- `flexDirection: 'row-reverse'` creates the expected right-to-left flow

But on Web:
- `I18nManager.forceRTL(true)` is a NO-OP
- Must use `dir="rtl"` on root View (which we do)
- `flexDirection: 'row-reverse'` + `direction: rtl` = DOUBLE REVERSAL (wrong!)

## Confidence Level

**Very High** - The analysis is based on:
1. Direct source code inspection of react-native-web
2. Understanding of the compilation and runtime flow
3. Clear evidence that physical properties are not transformed
4. Identification of the `row-reverse` double-reversal issue
5. Complete understanding of how CSS direction affects flexbox

## Implementation Effort Estimate

| Phase | Files | Changes | Time |
|-------|-------|---------|------|
| Phase 1 (row-reverse) | 44 | 153 | 30 min |
| Phase 2 (margin/padding) | 43 | 134 | 30 min |
| Phase 3 (testing) | - | - | 30 min |
| **Total** | 87 | 287 | ~1.5 hours |

## References

- react-native-web version: 0.19.13
- Expo version: 0.22.10
- Previous research: `docs/research/2026-01-31-rtl-web-investigation.md`

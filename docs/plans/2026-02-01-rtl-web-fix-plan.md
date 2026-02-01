# RTL Web Fix Implementation Plan

> **For Claude:** REQUIRED: Follow this plan task-by-task. This is a global refactoring task.
> **Research:** See `docs/research/2026-02-01-rtl-web-solution.md` for full analysis.

**Goal:** Fix RTL (Right-to-Left) layout on web by removing manual RTL workarounds and replacing physical CSS properties with logical ones.

**Architecture:** The codebase uses two conflicting RTL approaches:
1. Manual RTL via `flexDirection: 'row-reverse'` (works on Android, breaks on web)
2. Physical CSS properties (`marginLeft`, etc.) that don't flip in RTL

**Tech Stack:** React Native, Expo, react-native-web 0.19.13

**Prerequisites:**
- Understanding of the root cause (see research doc)
- Current `dir="rtl"` implementation in `_layout.tsx` is correct

---

## Phase 1: Remove Manual RTL Workarounds (CRITICAL)

> **Exit Criteria:** All 153 occurrences of `flexDirection: 'row-reverse'` replaced with `'row'`

### Task 1.1: Common Components

**Files:**
- Modify: `src/components/common/ActiveGameBanner.tsx`
- Modify: `src/components/common/Dialog.tsx`
- Modify: `src/components/common/Button.tsx`
- Modify: `src/components/common/Dropdown.tsx`
- Modify: `src/components/common/Input.tsx`
- Modify: `src/components/common/List.tsx`
- Modify: `src/components/common/SaveIndicator.tsx`
- Modify: `src/components/common/SelectableList.tsx`
- Modify: `src/components/common/Radio.tsx`
- Modify: `src/components/common/TabBar.tsx`
- Modify: `src/components/common/Switch.tsx`

**Step 1:** Find and replace in each file
```
Find:    flexDirection: 'row-reverse'
Replace: flexDirection: 'row'
```

**Step 2:** Update any "For RTL" comments
```
Find:    // For RTL
Replace: // (RTL handled by direction)
```

### Task 1.2: Navigation Components

**Files:**
- Modify: `src/components/navigation/HeaderBar.tsx`
- Modify: `src/components/auth/ReadOnlyIndicator.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.3: Statistics Components

**Files:**
- Modify: `src/components/statistics/StatisticsList.tsx`
- Modify: `src/components/statistics/StatCard.tsx`
- Modify: `src/components/statistics/StatisticsChart.tsx`
- Modify: `src/components/statistics/PlayersRanking.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.4: Dashboard Components

**Files:**
- Modify: `src/components/dashboard/group/DetailsTab.tsx`
- Modify: `src/components/dashboard/EditUserDialog.tsx`
- Modify: `src/components/dashboard/PlayersInGroupManagement.tsx`
- Modify: `src/components/dashboard/RoleChangeConfirmation.tsx`
- Modify: `src/components/dashboard/NewUserDialog.tsx`
- Modify: `src/components/dashboard/NewPaymentUnitDialog.tsx`
- Modify: `src/components/dashboard/NewGroupDialog.tsx`
- Modify: `src/components/dashboard/GroupDialog.tsx`
- Modify: `src/components/dashboard/AddExternalPlayerDialog.tsx`
- Modify: `src/components/dashboard/EditPaymentUnitDialog.tsx`
- Modify: `src/components/dashboard/DeletePaymentUnitDialog.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.5: Game Components

**Files:**
- Modify: `src/components/game/GameStatsPanel.tsx`
- Modify: `src/components/game/HandoffHistory.tsx`
- Modify: `src/components/game/HandoffDialog.tsx`
- Modify: `src/components/gameFlow/ReadOnlyGameView.tsx`
- Modify: `src/components/admin/SecurityAuditTool.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.6: Tab Screens

**Files:**
- Modify: `src/app/(tabs)/games.tsx`
- Modify: `src/app/(tabs)/history.tsx`
- Modify: `src/app/(tabs)/home2.tsx`
- Modify: `src/app/(tabs)/home3.tsx`
- Modify: `src/app/(tabs)/statistics.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.7: GameFlow Screens

**Files:**
- Modify: `src/app/gameFlow/PaymentCalculations.tsx`
- Modify: `src/app/gameFlow/OpenGames.tsx`
- Modify: `src/app/gameFlow/NewGameSetup.tsx`
- Modify: `src/app/gameFlow/InitialResults.tsx`
- Modify: `src/app/gameFlow/GameManagement.tsx`
- Modify: `src/app/gameFlow/FinalResults.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.8: Statistics Screens

**Files:**
- Modify: `src/app/statistics/rebuys.tsx`
- Modify: `src/app/statistics/playerStats.tsx`
- Modify: `src/app/statistics/winnersLosers.tsx`
- Modify: `src/app/statistics/participation.tsx`
- Modify: `src/app/statistics/openGames.tsx`
- Modify: `src/app/statistics/index.tsx`
- Modify: `src/app/statistics/games.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.9: Dashboard Screens

**Files:**
- Modify: `src/app/dashboard/users.tsx`
- Modify: `src/app/dashboard/index.tsx`
- Modify: `src/app/dashboard/groups.tsx`
- Modify: `src/app/dashboard/payment-units.tsx`
- Modify: `src/app/dashboard/group-details/[id].tsx`
- Modify: `src/app/dashboard/group-details/new.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.10: Other Screens

**Files:**
- Modify: `src/app/history/[id].tsx`
- Modify: `src/app/change-password.tsx`
- Modify: `src/app/reset-password.tsx`
- Modify: `src/app/register.tsx`
- Modify: `src/app/offline.tsx`

**Step 1:** Same find-replace as Task 1.1

### Task 1.11: Verify Phase 1 Complete

**Step 1:** Run verification command
```bash
grep -r "row-reverse" src/ --include="*.tsx" | wc -l
```
**Expected:** 0 occurrences

**Step 2:** Commit Phase 1
```bash
git add src/
git commit -m "fix(rtl): Remove manual row-reverse workaround - Phase 1

Replaced 153 occurrences of flexDirection: 'row-reverse' with 'row'.
The CSS direction: rtl now handles RTL layout automatically.
This fixes double-reversal issue on web.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Replace Physical CSS Properties with Logical

> **Exit Criteria:** All 134 occurrences of marginLeft/Right/paddingLeft/Right replaced with logical properties

### Task 2.1: Global Find-Replace for Margin/Padding

**Find-Replace Operations (in order):**

1. `marginLeft:` -> `marginStart:`
2. `marginRight:` -> `marginEnd:`
3. `paddingLeft:` -> `paddingStart:`
4. `paddingRight:` -> `paddingEnd:`

**CAUTION:** Do NOT replace `left:` or `right:` for absolute positioning (top/bottom/left/right) - those should stay physical.

### Task 2.2: Review and Fix Edge Cases

**Manual review needed for:**
- `left:` and `right:` in absolute positioning contexts
- Any conditional logic based on physical properties
- TypeScript type definitions if any

### Task 2.3: Verify Phase 2 Complete

**Step 1:** Run verification commands
```bash
grep -rE "marginLeft:|marginRight:|paddingLeft:|paddingRight:" src/ --include="*.tsx" | wc -l
```
**Expected:** 0 occurrences (or only in special cases that need physical properties)

**Step 2:** Commit Phase 2
```bash
git add src/
git commit -m "fix(rtl): Replace physical CSS properties with logical - Phase 2

Replaced marginLeft/Right with marginStart/End.
Replaced paddingLeft/Right with paddingStart/End.
Logical properties auto-flip based on direction (RTL/LTR).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Test and Verify

> **Exit Criteria:** RTL layout works correctly on both web and Android

### Task 3.1: Build and Test Web

**Step 1:** Build for web
```bash
npx expo export --platform web
node scripts/pwa-post-export.js
```

**Step 2:** Serve locally
```bash
firebase serve --only hosting
```

**Step 3:** Visual verification checklist
- [ ] Content flows right-to-left
- [ ] Hebrew text aligns to right
- [ ] Icons are on correct side
- [ ] Margins mirror correctly
- [ ] Buttons are in correct order
- [ ] Navigation works correctly

### Task 3.2: Test on Android

**Step 1:** Build preview APK
```bash
eas build --platform android --profile preview
```

**Step 2:** Visual verification checklist
- [ ] Layout matches web
- [ ] No regressions from previous behavior
- [ ] All screens look correct

### Task 3.3: Final Commit

```bash
git add .
git commit -m "fix(rtl): Complete RTL fix for web - verified working

Both web and Android now use proper RTL direction.
- Phase 1: Removed 153 row-reverse workarounds
- Phase 2: Replaced 134 physical properties with logical
- Phase 3: Verified on web and Android

Closes RTL web issue.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Risks

| Risk | P | I | Score | Mitigation |
|------|---|---|-------|------------|
| Some layouts break on Android | 3 | 4 | 12 | Test thoroughly, can revert if needed |
| Missed occurrences | 2 | 2 | 4 | Use grep to verify all replaced |
| TypeScript errors | 2 | 2 | 4 | Compile before committing |
| PWA cache issues | 2 | 3 | 6 | Clear cache during testing |

---

## Success Criteria

- [ ] All `flexDirection: 'row-reverse'` replaced (0 occurrences in grep)
- [ ] All physical margin/padding replaced (0 occurrences in grep)
- [ ] Web build succeeds
- [ ] Web layout is correct RTL
- [ ] Android build succeeds
- [ ] Android layout is correct RTL
- [ ] No TypeScript errors

---

## Rollback Plan

If issues occur:
```bash
git revert HEAD~2  # Revert both Phase 1 and Phase 2 commits
```

Or selectively revert specific files that have issues.

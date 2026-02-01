# PHASE 1-3 COMPREHENSIVE TEST PLAN

**Date:** 2026-01-24
**Phases Covered:** Phase 1 (Ownership), Phase 2 (Role Management UI), Phase 3 (Game Handoff)
**Testing Approach:** Playwright E2E + Firebase Emulator + Manual Testing

---

## TEST STRATEGY

### Critical Constraints
- ⚠️ **DO NOT MODIFY ANY SAVED FIREBASE GAME DATA**
- All tests must use Firebase Emulator or test accounts only
- No destructive operations on production data

### Testing Layers
1. **Code Review** - ✅ COMPLETED (92/100, APPROVED)
2. **Playwright E2E Tests** - IN PROGRESS
3. **Firebase Emulator Tests** - PENDING
4. **Manual Testing** - PENDING

---

## PLAYWRIGHT E2E TEST SUITE

### Test File Structure
```
__tests__/
  e2e/
    phase1-ownership.spec.ts          # Ownership enforcement
    phase2-role-management.spec.ts    # Role UI and management
    phase3-game-handoff.spec.ts       # Game ownership transfer
    helpers/
      testUsers.ts                     # Test user fixtures
      firebaseEmulator.ts              # Emulator setup
```

### Test User Fixtures
```typescript
// Admin user
authUid: "test-admin-001"
role: "admin"
isActive: true

// Super user (game owner)
authUid: "test-super-001"
role: "super"
isActive: true

// Super user (eligible for handoff)
authUid: "test-super-002"
role: "super"
isActive: true

// Regular user
authUid: "test-regular-001"
role: "regular"
isActive: true

// Guest user
authUid: "test-guest-001"
role: "guest"
isActive: true
```

---

## PHASE 1 TESTS: OWNERSHIP ENFORCEMENT

### Test Suite: `phase1-ownership.spec.ts`

#### Test 1.1: Game Creation Sets createdBy to authUid
```typescript
test('should set createdBy to Firebase Auth UID when creating game', async ({ page }) => {
  // 1. Login as test-super-001
  // 2. Create new game
  // 3. Verify game.createdBy === "test-super-001" (authUid, not Firestore ID)
  // 4. Verify originalCreatedBy === "test-super-001"
});
```

#### Test 1.2: Owner Can Edit Own Game
```typescript
test('should allow owner to edit their own game', async ({ page }) => {
  // 1. Login as test-super-001
  // 2. Create game
  // 3. Navigate to GameManagement
  // 4. Verify "עדכן שחקן", "סיים משחק" buttons visible
  // 5. Add rebuy, verify success
});
```

#### Test 1.3: Non-Owner Cannot Edit Game
```typescript
test('should prevent non-owner from editing game', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Logout, login as test-super-002
  // 3. Navigate to game
  // 4. Verify "אין הרשאה לערוך" message or buttons disabled
});
```

#### Test 1.4: Admin Can Edit Any Game
```typescript
test('should allow admin to edit any game', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Logout, login as test-admin-001
  // 3. Navigate to game
  // 4. Verify edit buttons visible
  // 5. Add rebuy, verify success
});
```

---

## PHASE 2 TESTS: ROLE MANAGEMENT UI

### Test Suite: `phase2-role-management.spec.ts`

#### Test 2.1: Role Badges Display Correctly
```typescript
test('should display role badges with correct colors and icons', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to dashboard/users
  // 3. Verify admin badge: gold crown
  // 4. Verify super badge: green star
  // 5. Verify regular badge: gray circle
  // 6. Verify guest badge: gray eye-outline
});
```

#### Test 2.2: Admin Can Change User Role
```typescript
test('should allow admin to change user role', async ({ page }) => {
  // 1. Login as test-admin-001
  // 2. Navigate to users dashboard
  // 3. Find test-regular-001
  // 4. Open UserRoleSelector
  // 5. Change role to "super"
  // 6. Confirm in Hebrew dialog
  // 7. Verify badge changes to green star
  // 8. Verify optimistic update (no page reload)
});
```

#### Test 2.3: Non-Admin Cannot Change Roles
```typescript
test('should prevent non-admin from changing roles', async ({ page }) => {
  // 1. Login as test-super-001
  // 2. Navigate to users dashboard
  // 3. Verify role selector not visible OR disabled
});
```

#### Test 2.4: Admin Cannot Remove Last Admin
```typescript
test('should prevent removing last admin role', async ({ page }) => {
  // 1. Login as test-admin-001 (only admin)
  // 2. Navigate to users dashboard
  // 3. Attempt to change own role to "super"
  // 4. Verify error: "לא ניתן להסיר את המנהל האחרון"
});
```

#### Test 2.5: Admin Cannot Change Own Role
```typescript
test('should prevent admin from changing own role', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to users dashboard
  // 3. Find own user card
  // 4. Verify role selector disabled OR shows "אינך יכול לשנות תפקיד משלך"
});
```

#### Test 2.6: RTL Layout Verification
```typescript
test('should display dashboard in RTL with Hebrew text', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to users dashboard
  // 3. Verify Hebrew labels: "מנהל", "על", "רגיל", "אורח"
  // 4. Verify RTL alignment (role badges on right)
  // 5. Verify consistent theme colors (#35654d, #FFD700, #0D1B1E)
});
```

---

## PHASE 3 TESTS: GAME HANDOFF

### Test Suite: `phase3-game-handoff.spec.ts`

#### Test 3.1: Handoff Button Visibility
```typescript
test('should show handoff button only for owner/admin on active games', async ({ page }) => {
  // 1. Login as test-super-001, create active game
  // 2. Navigate to GameManagement
  // 3. Verify "העבר שליטה" button visible
  // 4. Complete game
  // 5. Verify handoff button NOT visible
});
```

#### Test 3.2: Owner Can Hand Off Own Game
```typescript
test('should allow owner to hand off game to eligible user', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Tap "העבר שליטה" button
  // 3. Verify HandoffDialog opens
  // 4. Verify eligible users list shows admin and super users (active)
  // 5. Select test-super-002
  // 6. Enter reason: "נוסע לחופשה"
  // 7. Tap "אשר העברה"
  // 8. Confirm in alert
  // 9. Verify success message: "השליטה הועברה בהצלחה"
  // 10. Verify redirect to home
  // 11. Logout, login as test-super-002
  // 12. Verify game.createdBy === "test-super-002"
  // 13. Verify game.originalCreatedBy === "test-super-001"
  // 14. Verify handoffLog has 1 entry
});
```

#### Test 3.3: Admin Can Hand Off Any Game
```typescript
test('should allow admin to hand off games they do not own', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Logout, login as test-admin-001
  // 3. Navigate to game
  // 4. Tap "העבר שליטה" button
  // 5. Select test-super-002
  // 6. Confirm handoff
  // 7. Verify success
  // 8. Verify handoffLog shows initiatedBy: admin authUid
});
```

#### Test 3.4: Non-Owner Cannot Hand Off
```typescript
test('should prevent non-owner super user from handing off', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Logout, login as test-super-002 (super but not owner)
  // 3. Navigate to game
  // 4. Verify "העבר שליטה" button NOT visible
});
```

#### Test 3.5: Handoff History Display
```typescript
test('should display handoff history with correct details', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Hand off to test-admin-001
  // 3. Logout, login as test-admin-001
  // 4. Hand off to test-super-002
  // 5. Logout, login as test-super-002
  // 6. Navigate to game
  // 7. Verify "העברות שליטה" section visible
  // 8. Verify 2 entries in chronological order
  // 9. Verify entry 1: test-super-001 → test-admin-001, יזם: בעלים
  // 10. Verify entry 2: test-admin-001 → test-super-002, יזם: מנהל
  // 11. Verify original creator: test-super-001
});
```

#### Test 3.6: Eligible Users Filter
```typescript
test('should show only admin/super active users in handoff dialog', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Tap "העבר שליטה"
  // 3. Verify eligible users list:
  //    - Includes: test-admin-001 (admin, active)
  //    - Includes: test-super-002 (super, active)
  //    - Excludes: test-regular-001 (not admin/super)
  //    - Excludes: test-guest-001 (not admin/super)
  //    - Excludes: self (test-super-001)
});
```

#### Test 3.7: Old Owner Loses Permissions
```typescript
test('should redirect old owner after handoff and prevent editing', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Hand off to test-super-002
  // 3. Verify redirect to home
  // 4. Navigate back to game
  // 5. Verify edit buttons NOT visible
  // 6. Verify message: "אין הרשאה לערוך"
});
```

#### Test 3.8: Cannot Hand Off Completed Game
```typescript
test('should hide handoff button for completed games', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Complete game
  // 3. Navigate to game
  // 4. Verify "העבר שליטה" button NOT visible
  // 5. Verify handoffLog preserved if any
});
```

#### Test 3.9: Handoff Reason Optional
```typescript
test('should allow handoff without reason', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Tap "העבר שליטה"
  // 3. Select test-super-002
  // 4. Leave reason field empty
  // 5. Confirm handoff
  // 6. Verify success
  // 7. Verify handoffLog entry has no reason field
});
```

#### Test 3.10: Handoff Confirmation Dialog
```typescript
test('should show confirmation before executing handoff', async ({ page }) => {
  // 1. Login as test-super-001, create game
  // 2. Tap "העבר שליטה"
  // 3. Select test-super-002
  // 4. Tap "אשר העברה"
  // 5. Verify alert: "האם אתה בטוח שברצונך להעביר את השליטה..."
  // 6. Tap "ביטול"
  // 7. Verify handoff NOT executed
  // 8. Repeat steps 3-4
  // 9. Tap "כן, העבר"
  // 10. Verify handoff executes
});
```

---

## FIREBASE EMULATOR TESTS

### Setup
```bash
# Start emulator
firebase emulators:start --only firestore,auth

# Seed test data
npm run seed:emulator
```

### Test Cases

#### Emulator Test 1: Firestore Rules - createdBy Enforcement
```javascript
// Test that users can only edit games where createdBy === request.auth.uid
test('should enforce createdBy ownership in Firestore rules', async () => {
  // 1. Authenticate as test-super-001
  // 2. Create game with createdBy: test-super-001
  // 3. Attempt update → SUCCESS
  // 4. Authenticate as test-super-002
  // 5. Attempt update → PERMISSION_DENIED
});
```

#### Emulator Test 2: Cannot Modify createdBy Field
```javascript
test('should prevent clients from modifying createdBy field', async () => {
  // 1. Authenticate as test-super-001
  // 2. Create game
  // 3. Attempt to update createdBy to different authUid → PERMISSION_DENIED
  // 4. Verify createdBy unchanged
});
```

#### Emulator Test 3: Admin Bypass (When Custom Claims Implemented)
```javascript
// NOTE: This test will pass after Phase 6 Custom Claims
test('should allow admin to edit any game (Custom Claims)', async () => {
  // 1. Authenticate as test-admin-001 with custom claim: {role: 'admin'}
  // 2. Create game as test-super-001
  // 3. Authenticate as test-admin-001
  // 4. Attempt update → SUCCESS (admin bypass)
});
```

---

## MANUAL TESTING CHECKLIST

### Manual Test 1: Super User Handoff Flow
- [ ] Login as super user (owner)
- [ ] Create new game
- [ ] See "העבר שליטה" button
- [ ] Tap handoff button
- [ ] Dialog opens with eligible users
- [ ] Select admin user
- [ ] Enter reason: "בדיקת מערכת"
- [ ] Confirm handoff
- [ ] Success message appears
- [ ] Redirected to home
- [ ] Try to open game again
- [ ] See "אין הרשאה לערוך" or buttons disabled
- [ ] View game from history
- [ ] See handoff log entry with correct details

### Manual Test 2: Admin Override
- [ ] Login as admin
- [ ] Open game created by super user
- [ ] See "העבר שליטה" button
- [ ] Hand off to another user
- [ ] Verify handoff succeeds
- [ ] Check handoff log shows "יזם: מנהל"

### Manual Test 3: Edge Cases
- [ ] Try to hand off completed game → Button not visible
- [ ] Try to hand off to regular user → Not in eligible list
- [ ] Try to hand off to inactive user → Not in eligible list
- [ ] Multiple handoffs in same game → History shows all entries
- [ ] Hand off without reason → Works (reason optional)
- [ ] Network error during handoff → Error message shown

### Manual Test 4: Permission Tests
- [ ] Regular user views game → No handoff button
- [ ] Guest user views game → No handoff button
- [ ] Super user views game they don't own → No handoff button

### Manual Test 5: RTL/Hebrew Verification
- [ ] All Hebrew text renders correctly
- [ ] Dialog layout is RTL (buttons right-aligned)
- [ ] History displays dates in dd/mm/yyyy format
- [ ] Icons positioned correctly in RTL
- [ ] Theme colors consistent (#35654d, #FFD700, #0D1B1E)

---

## TEST DATA SAFETY

### Critical Rules
1. **Use Firebase Emulator for automated tests** - NEVER production
2. **Use test accounts for manual tests** - Accounts with "test-" prefix
3. **Create NEW games for testing** - NEVER modify existing games
4. **Verify emulator connection** - Check for "localhost:8080" in Firebase config during tests

### Emulator Setup Verification
```typescript
// In test setup
expect(firebase.app().options.projectId).toBe('demo-poker-app');
expect(firebase.firestore().host).toContain('localhost');
```

---

## SUCCESS CRITERIA

### Phase 1 (Ownership)
- ✅ createdBy uses authUid (not Firestore ID)
- ✅ Owner can edit own games
- ✅ Non-owner cannot edit games
- ✅ Admin can edit any game

### Phase 2 (Role Management)
- ✅ Role badges display correctly (colors, icons, Hebrew)
- ✅ Admin can change user roles
- ✅ Non-admin cannot change roles
- ✅ Admin cannot change own role
- ✅ Cannot remove last admin
- ✅ Optimistic UI updates work
- ✅ RTL layout maintained

### Phase 3 (Game Handoff)
- ✅ Handoff button visible for owner/admin on active games
- ✅ Handoff button NOT visible for non-owners or completed games
- ✅ Dialog shows only eligible users (admin/super, active)
- ✅ Role badges display in user picker
- ✅ Reason input optional, limited to 200 chars
- ✅ Confirmation alert prevents accidental handoffs
- ✅ Handoff updates createdBy correctly
- ✅ Handoff logs event to handoffLog array
- ✅ Original creator tracked in originalCreatedBy
- ✅ Old owner redirected after handoff
- ✅ New owner gains immediate control
- ✅ Handoff history displays all transfers
- ✅ Hebrew messaging throughout
- ✅ RTL layout maintained
- ✅ Error handling with rollback

---

## NEXT STEPS

1. **Implement Playwright E2E Tests** - Create test files for all 3 phases
2. **Configure Firebase Emulator** - Set up test environment
3. **Run Automated Tests** - Execute Playwright suite
4. **Execute Manual Tests** - Follow checklist above
5. **Document Results** - Create test execution report
6. **Fix Any Issues** - Address failures before Phase 4

---

**END OF TEST PLAN**

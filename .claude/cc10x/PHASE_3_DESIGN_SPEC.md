# PHASE 3: GAME HANDOFF & OWNERSHIP - DESIGN SPECIFICATION

**Date:** 2026-01-24
**Phase:** Game Handoff & Ownership
**Requirement:** Req #12 - Game creator can hand off control to another user

---

## OVERVIEW

This feature allows the current game owner to transfer ownership (control) of an active game to another user with appropriate permissions. This is useful when the original game creator needs to delegate game management responsibilities.

---

## USE CASES

### Primary Use Case
**Scenario:** Super user starts a game but needs to leave. They want to hand off control to another super user or admin who can continue managing the game.

**Example:**
1. User A (super) creates game on Monday
2. On Tuesday, User A can't continue managing
3. User A hands off to User B (super)
4. User B now owns the game and can:
   - Add/remove players
   - Manage rebuys
   - Finish the game
5. User A can no longer edit the game (unless admin)

### Secondary Use Cases
- **Admin Override:** Admin needs to take control of a game from a super user
- **Multiple Handoffs:** Game ownership transferred multiple times during long tournaments
- **Audit Trail:** Need to track who owned the game at different points in time

---

## DESIGN DECISIONS

### 1. When Can Handoff Occur?

✅ **ALLOWED:**
- Game status is NOT 'completed' (active games only)
- Current user is the owner (createdBy === user.authUid) OR admin
- Target user is active (isActive === true)

❌ **NOT ALLOWED:**
- Game status is 'completed' (ownership frozen after completion)
- Current user is neither owner nor admin
- Target user is inactive

**Rationale:** Completed games are historical records and ownership should not change. Only current owner or admin can transfer control.

---

### 2. Who Can Receive Handoff?

✅ **ELIGIBLE USERS:**
- Users with role 'admin'
- Users with role 'super'
- Must be active (isActive === true)

❌ **NOT ELIGIBLE:**
- Regular users (cannot create/manage games)
- Guest users (read-only access)
- Inactive users

**Rationale:** Only users who can create and manage games should be able to receive ownership. Regular and guest users don't have game management permissions.

---

### 3. Who Can Initiate Handoff?

✅ **CAN HANDOFF:**
- Current owner (createdBy === user.authUid)
- Admin (can transfer ANY game)

❌ **CANNOT HANDOFF:**
- Super users (for games they don't own)
- Regular users
- Guest users

**Permission Function:**
```typescript
const canHandoffGame = (gameData: { createdBy?: string; status?: string }): boolean => {
  if (!user) return false;

  // Admin can hand off any game
  if (user.role === 'admin') return true;

  // Super user can hand off only games they created (and not completed)
  if (user.role === 'super' &&
      gameData.createdBy === user.authUid &&
      gameData.status !== 'completed') {
    return true;
  }

  return false;
};
```

---

### 4. What Happens on Handoff?

**Database Changes:**
1. Update `game.createdBy` to new owner's authUid
2. Set `game.originalCreatedBy` to original creator's authUid (if not already set)
3. Add entry to `game.handoffLog` array
4. Update `game.updatedAt` timestamp
5. Sync to Firestore

**HandoffLog Entry:**
```typescript
{
  id: string;              // Unique ID for this handoff event
  fromUserId: string;      // Firestore user document ID (old owner)
  fromUserName: string;    // Name of old owner (snapshot)
  fromAuthUid: string;     // Auth UID of old owner
  toUserId: string;        // Firestore user document ID (new owner)
  toUserName: string;      // Name of new owner (snapshot)
  toAuthUid: string;       // Auth UID of new owner
  timestamp: number;       // When handoff occurred
  reason?: string;         // Optional reason for handoff
  initiatedBy: string;     // authUid of user who initiated (owner or admin)
}
```

**Permission Changes:**
- Old owner loses ability to edit game (unless they're admin)
- New owner gains full control (can edit, finish, hand off again)
- All existing game data remains unchanged

---

### 5. Can Handoff Be Reversed?

✅ **YES:**
- New owner can hand off back to original owner
- New owner can hand off to any other eligible user
- Admin can always take control back

❌ **NO AUTOMATIC REVERSAL:**
- Handoff is permanent until manually reversed
- No "undo" button

**Rationale:** Handoff is an intentional action with confirmation. Users must explicitly hand off again to reverse.

---

### 6. Handoff History & Audit Trail

**Requirements:**
- ✅ All handoffs logged in `game.handoffLog` array
- ✅ Each log entry includes: from/to users, timestamp, reason
- ✅ Original creator tracked in `game.originalCreatedBy`
- ✅ Handoff history visible in game info section

**Display Format:**
```
העברות שליטה (Ownership Transfers):
1. [Date] יובל → דני: "לא יכול להמשיך" (Initiated by: Owner)
2. [Date] דני → אלי: "נוסע לחופשה" (Initiated by: Owner)
3. [Date] אלי → אדמין: (Initiated by: Admin override)
```

---

## DATA MODEL CHANGES

### Game.ts Model Updates

```typescript
export interface Game {
  // ... existing fields

  createdBy: string;              // Current owner's authUid (can change via handoff)
  originalCreatedBy?: string;     // Original creator's authUid (never changes)
  handoffLog?: HandoffEvent[];    // History of ownership transfers

  // ... rest of fields
}

export interface HandoffEvent {
  id: string;              // Unique ID
  fromUserId: string;      // Firestore user doc ID (old owner)
  fromUserName: string;    // Name snapshot
  fromAuthUid: string;     // Auth UID (old owner)
  toUserId: string;        // Firestore user doc ID (new owner)
  toUserName: string;      // Name snapshot
  toAuthUid: string;       // Auth UID (new owner)
  timestamp: number;       // When handoff occurred
  reason?: string;         // Optional reason
  initiatedBy: string;     // authUid of initiator (owner or admin)
}
```

**Migration Notes:**
- Existing games without `originalCreatedBy`: Set to current `createdBy` value
- Existing games without `handoffLog`: Initialize as empty array `[]`
- No database migration script needed (handled in code with defaults)

---

## USER FLOW

### Flow 1: Owner Hands Off Game

1. **User navigates to GameManagement screen** (active game)
2. **User sees "העבר שליטה" button** (visible because user is owner)
3. **User taps "העבר שליטה" button**
4. **HandoffDialog opens** with:
   - Title: "העבר שליטה במשחק"
   - User picker: Dropdown of eligible users (admin/super, active only)
   - Reason input: Optional text field "סיבה (אופציונלי)"
   - Warning: "לאחר ההעברה, לא תוכל לערוך את המשחק"
   - Buttons: "אשר העברה" (confirm), "ביטול" (cancel)
5. **User selects new owner from dropdown**
6. **User optionally enters reason** (e.g., "נוסע לחופשה")
7. **User taps "אשר העברה"**
8. **Confirmation dialog appears:**
   - "האם אתה בטוח שברצונך להעביר את השליטה במשחק ל-[שם]?"
   - "לא תוכל לערוך את המשחק אחרי ההעברה."
   - Buttons: "כן, העבר" (yes), "ביטול" (cancel)
9. **User confirms**
10. **Handoff executed:**
    - Loading indicator shown
    - Backend service called
    - Success: "השליטה הועברה בהצלחה ל-[שם]"
    - Redirect to home screen or game history
11. **New owner receives notification** (future enhancement - Phase 4+)

### Flow 2: Admin Takes Control

Same as Flow 1, but:
- Admin can hand off ANY game (not just games they created)
- Warning text: "אתה עומד להעביר שליטה במשחק של [שם בעלים נוכחי]"

### Flow 3: View Handoff History

1. User navigates to game details/info screen
2. Scroll to "מידע על המשחק" section
3. See "העברות שליטה" subsection
4. See list of all handoffs with dates, users, reasons

---

## UI/UX DESIGN

### Handoff Button (GameManagement.tsx)

**Location:** Above or next to "סיים משחק" button in fixed bottom container

**Appearance:**
- Text: "העבר שליטה"
- Icon: `swap-horizontal` or `account-switch` icon (Material Community Icons)
- Style: Secondary button (outlined, gold border, transparent background)
- Disabled state: Grayed out with tooltip "אין הרשאה להעביר שליטה"

**Visibility Conditions:**
```typescript
const showHandoffButton =
  gameData.status !== 'completed' &&
  (user.role === 'admin' ||
   (user.role === 'super' && gameData.createdBy === user.authUid));
```

**Layout Suggestion:**
```
┌─────────────────────────────────────┐
│                                     │
│   [Player cards with chips...]      │
│                                     │
├─────────────────────────────────────┤
│  [העבר שליטה]  ←  Secondary button  │
│  [סיים משחק]   ←  Primary button    │
└─────────────────────────────────────┘
```

---

### HandoffDialog Component

**Component:** `src/components/game/HandoffDialog.tsx`

**Props:**
```typescript
interface HandoffDialogProps {
  visible: boolean;
  currentGame: Game;
  currentUser: UserProfile;
  eligibleUsers: UserProfile[];  // Admin and super users, active only
  onHandoff: (newOwnerAuthUid: string, reason?: string) => Promise<void>;
  onCancel: () => void;
}
```

**Layout:**
```
┌───────────────────────────────────────────┐
│   ⚡  העבר שליטה במשחק                     │  ← Header
├───────────────────────────────────────────┤
│                                           │
│   בעלים נוכחי: [שם בעלים נוכחי]           │  ← Current owner
│                                           │
│   העבר ל:                                 │  ← Label
│   ┌─────────────────────────────────┐     │
│   │ [בחר משתמש ▼]                   │     │  ← User picker
│   └─────────────────────────────────┘     │
│                                           │
│   סיבה (אופציונלי):                       │  ← Optional reason
│   ┌─────────────────────────────────┐     │
│   │                                 │     │
│   └─────────────────────────────────┘     │
│                                           │
│   ⚠️ לאחר ההעברה, לא תוכל לערוך          │  ← Warning
│      את המשחק                              │
│                                           │
├───────────────────────────────────────────┤
│   [ביטול]         [אשר העברה]             │  ← Actions
└───────────────────────────────────────────┘
```

**User Picker Options:**
- Filter: `user.role === 'admin' || user.role === 'super'`
- Filter: `user.isActive === true`
- Filter: `user.authUid !== currentGame.createdBy` (cannot hand off to self)
- Display: Name + role badge (like in Phase 2 dashboard)
- Sort: Admins first, then super users, alphabetically

---

### Handoff History Display

**Location:** Game info section (could be in GameManagement or separate game details screen)

**Component:** `src/components/game/HandoffHistory.tsx`

**Layout:**
```
┌───────────────────────────────────────────┐
│   📜 העברות שליטה                         │  ← Header
├───────────────────────────────────────────┤
│   1. 24/01/2026 14:30                     │
│      יובל → דני                            │
│      סיבה: "לא יכול להמשיך"               │
│      (יזם: יובל)                          │
├───────────────────────────────────────────┤
│   2. 25/01/2026 09:15                     │
│      דני → אלי                             │
│      סיבה: "נוסע לחופשה"                  │
│      (יזם: דני)                           │
├───────────────────────────────────────────┤
│   3. 26/01/2026 18:00                     │
│      אלי → אדמין                           │
│      (יזם: Admin override)                │
└───────────────────────────────────────────┘
```

---

## PERMISSION MATRIX

| Role | Can Initiate Handoff | Can Receive Handoff | Can View Handoff History |
|------|---------------------|---------------------|--------------------------|
| **Admin** | ✅ ANY game | ✅ YES | ✅ ANY game |
| **Super** | ✅ Games they created (not completed) | ✅ YES | ✅ Games they created or participated |
| **Regular** | ❌ NO | ❌ NO | ✅ Games they participated |
| **Guest** | ❌ NO | ❌ NO | ✅ Games they participated |

---

## BACKEND SERVICE DESIGN

### Service: `src/services/gameHandoff.ts`

**Function: handoffGame**
```typescript
export async function handoffGame(
  gameId: string,
  currentOwnerAuthUid: string,
  newOwnerAuthUid: string,
  initiatorAuthUid: string,
  reason?: string
): Promise<void> {
  // 1. Validate gameId exists
  // 2. Validate current game status !== 'completed'
  // 3. Validate currentOwnerAuthUid matches game.createdBy OR initiator is admin
  // 4. Validate newOwnerAuthUid is admin or super user
  // 5. Validate new owner is active
  // 6. Get user profiles for from/to users (for names)
  // 7. Create handoff log entry
  // 8. Update game document:
  //    - Set createdBy = newOwnerAuthUid
  //    - Set originalCreatedBy = currentOwnerAuthUid (if not already set)
  //    - Append to handoffLog
  //    - Update updatedAt
  // 9. Sync to Firestore
  // 10. Return success
}
```

**Error Handling:**
- Game not found → "המשחק לא נמצא"
- Game already completed → "לא ניתן להעביר שליטה במשחק שהסתיים"
- Permission denied → "אין לך הרשאה להעביר שליטה במשחק"
- New owner not eligible → "המשתמש הנבחר לא יכול לקבל שליטה"
- New owner inactive → "המשתמש הנבחר לא פעיל"
- Network error → "שגיאת רשת. נסה שוב."

---

## FIRESTORE RULES

**Current Rules (Phase 1):**
```javascript
allow update: if isAuthenticated() &&
               isOwner(resource.data) &&
               request.resource.data.createdBy == resource.data.createdBy;
```

**Updated Rules for Handoff:**
```javascript
allow update: if isAuthenticated() &&
               (isOwner(resource.data) ||
                request.auth.token.role == 'admin') &&
               // Allow createdBy to change ONLY if handoffLog is also updated
               (request.resource.data.createdBy == resource.data.createdBy ||
                (request.resource.data.handoffLog.size() > resource.data.handoffLog.size()));
```

**Note:** This is a Phase 6 enhancement (when Custom Claims are implemented). For now, client-side validation will enforce handoff permissions.

---

## TESTING STRATEGY

### Unit Tests (src/services/gameHandoff.test.ts)
- ✅ Validate handoff succeeds for owner
- ✅ Validate handoff succeeds for admin
- ❌ Validate handoff fails for non-owner super user
- ❌ Validate handoff fails for regular user
- ❌ Validate handoff fails for completed game
- ❌ Validate handoff fails if new owner is regular user
- ❌ Validate handoff fails if new owner is inactive
- ✅ Validate handoffLog is updated correctly
- ✅ Validate originalCreatedBy is set on first handoff

### Integration Tests (E2E with Playwright)
- ✅ Owner can see handoff button on active game
- ❌ Owner cannot see handoff button on completed game
- ✅ Owner can select new owner and complete handoff
- ✅ After handoff, old owner sees "אין הרשאה לערוך" message
- ✅ After handoff, new owner can edit game
- ✅ Admin can hand off any game
- ✅ Handoff history displays correctly

### Manual Testing Checklist
- [ ] As super user: create game, hand off to another super user
- [ ] As admin: hand off someone else's game
- [ ] Verify handoff button not visible for completed games
- [ ] Verify handoff dialog shows only eligible users
- [ ] Verify reason field is optional
- [ ] Verify confirmation dialog before handoff
- [ ] Verify old owner loses edit permissions
- [ ] Verify new owner gains edit permissions
- [ ] Verify handoff history shows all transfers
- [ ] Verify multiple handoffs work correctly

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| **User accidentally hands off** | MEDIUM | Confirmation dialog with clear warning |
| **Handoff to wrong user** | MEDIUM | User picker with names and role badges, confirmation dialog |
| **Network failure during handoff** | HIGH | Transaction-style update, rollback on error |
| **HandoffLog grows too large** | LOW | Limit to last 50 entries (archive older ones) |
| **Permission bypass** | HIGH | Phase 6: Server-side enforcement via Custom Claims |

---

## SUCCESS CRITERIA

- ✅ Handoff button visible on active games for owner/admin
- ✅ Handoff dialog shows only eligible users (admin/super, active)
- ✅ Confirmation dialog prevents accidental handoffs
- ✅ Handoff updates createdBy field correctly
- ✅ Handoff logs event to handoffLog array
- ✅ Old owner loses edit permissions after handoff
- ✅ New owner gains edit permissions after handoff
- ✅ Handoff history displays correctly
- ✅ Multiple handoffs work without issues
- ✅ Cannot hand off completed games
- ✅ RTL layout maintained in all handoff UI components
- ✅ UI matches app theme (dark bg, gold accents)

---

## FUTURE ENHANCEMENTS (Post-Phase 3)

1. **Notifications (Phase 4):**
   - Notify new owner when they receive game control
   - Notify old owner when handoff is complete

2. **Approval Flow:**
   - Optional: New owner must accept handoff (not automatic)
   - Pending handoff requests queue

3. **Handoff Requests:**
   - Super users can REQUEST handoff from current owner
   - Owner approves/denies requests

4. **Audit Dashboard:**
   - Admin view of all handoffs across all games
   - Filter by date, user, game

5. **Handoff Restrictions:**
   - Limit handoffs per game (e.g., max 5 transfers)
   - Time-based restrictions (e.g., cannot hand off within 1 hour of receiving)

---

**END OF DESIGN SPECIFICATION**

This specification will guide the implementation of game handoff feature in Phase 3.

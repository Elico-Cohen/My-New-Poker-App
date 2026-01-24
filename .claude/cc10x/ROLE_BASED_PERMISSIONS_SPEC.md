# ROLE-BASED PERMISSIONS SPECIFICATION

**Date:** 2026-01-24
**Status:** APPROVED - Awaiting Phase 6 Implementation
**Implementation Method:** Firebase Custom Claims + Cloud Functions + Firestore Rules

---

## OVERVIEW

This document defines the complete role-based access control (RBAC) system for the Poker App. All permissions listed here will be enforced **server-side** via Firestore Security Rules using Firebase Custom Claims in **Phase 6**.

**Current State (Phase 1-2):**
- ✅ Ownership-based rules enforced (createdBy === request.auth.uid)
- ✅ Authentication required for all operations
- ⏳ Role-based enforcement via client-side validation only
- ⏳ Server-side role enforcement deferred to Phase 6

**Phase 6 Implementation:**
- Cloud Functions to set Custom Claims on user creation/role change
- Firestore rules access `request.auth.token.role`
- Full server-side enforcement of all rules below

---

## USER ROLES

### Role Hierarchy (Highest to Lowest)
1. **Admin** - Full system access
2. **Super** - Game creator and manager
3. **Regular** - Game participant
4. **Guest** - Read-only participant

---

## GAME VIEWING PERMISSIONS

### Ongoing Games (status !== 'completed')

| Role | Can View |
|------|----------|
| **Admin** | ALL ongoing games (no restrictions) |
| **Super** | Games WHERE `createdBy === their authUid` OR `players.includes(their userId)` |
| **Regular** | Games WHERE `players.includes(their userId)` |
| **Guest** | Games WHERE `players.includes(their userId)` |

**Firestore Rule (Phase 6):**
```javascript
function canViewOngoingGame(gameData) {
  let role = request.auth.token.role;
  let userId = getUserDocId(); // Helper to get Firestore user doc ID from authUid

  return role == 'admin' ||
         (role == 'super' && (gameData.createdBy == request.auth.uid || userId in gameData.players)) ||
         ((role == 'regular' || role == 'guest') && userId in gameData.players);
}

match /games/{gameId} {
  allow read: if gameData().status != 'completed' && canViewOngoingGame(gameData());
}
```

---

### Completed Games (status === 'completed')

| Role | Can View |
|------|----------|
| **ALL** | ALL completed games (no restrictions) |

**Firestore Rule (Phase 6):**
```javascript
match /games/{gameId} {
  allow read: if gameData().status == 'completed' && isAuthenticated();
}
```

---

## STATISTICS VIEWING PERMISSIONS

| Role | Can View |
|------|----------|
| **ALL** | ALL statistics (no restrictions) |

**Implementation:** No Firestore rule restrictions needed for statistics queries.

---

## GAME CREATION PERMISSIONS

| Role | Can Create Games |
|------|------------------|
| **Admin** | ✅ YES |
| **Super** | ✅ YES |
| **Regular** | ❌ NO |
| **Guest** | ❌ NO |

**Firestore Rule (Phase 6):**
```javascript
match /games/{gameId} {
  allow create: if isAuthenticated() &&
                 hasValidCreatedBy() &&
                 (request.auth.token.role == 'admin' || request.auth.token.role == 'super');
}
```

---

## GAME MODIFICATION PERMISSIONS

| Role | Can Modify |
|------|------------|
| **Admin** | ANY game (no restrictions) |
| **Super** | ONLY games WHERE `createdBy === their authUid` |
| **Regular** | ❌ NO games |
| **Guest** | ❌ NO games |

**Firestore Rule (Phase 6):**
```javascript
match /games/{gameId} {
  allow update: if isAuthenticated() &&
                 request.resource.data.createdBy == resource.data.createdBy && // Cannot change createdBy
                 (request.auth.token.role == 'admin' ||
                  (request.auth.token.role == 'super' && isOwner(resource.data)));
}
```

---

## GAME DELETION PERMISSIONS

| Role | Can Delete |
|------|------------|
| **Admin** | ANY game (completed or in-progress) |
| **Super** | ONLY games WHERE `createdBy === their authUid` AND `status !== 'completed'` |
| **Regular** | ❌ NO games |
| **Guest** | ❌ NO games |

**Rationale:** Super users cannot delete completed games to maintain historical integrity.

**Firestore Rule (Phase 6):**
```javascript
match /games/{gameId} {
  allow delete: if isAuthenticated() &&
                 (request.auth.token.role == 'admin' ||
                  (request.auth.token.role == 'super' &&
                   isOwner(resource.data) &&
                   resource.data.status != 'completed'));
}
```

---

## USER PROFILE MANAGEMENT

### Own Profile Updates

| Role | Can Update Own Profile |
|------|------------------------|
| **Admin** | ✅ YES (name, phone, email, password) |
| **Super** | ✅ YES (name, phone, email, password) |
| **Regular** | ✅ YES (name, phone, email, password) |
| **Guest** | ❌ NO (read-only) |

**Firestore Rule (Phase 6):**
```javascript
match /users/{userId} {
  allow update: if isAuthenticated() &&
                 getUserAuthUid(userId) == request.auth.uid && // Own profile only
                 request.auth.token.role != 'guest' &&
                 !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'authUid', 'createdAt']); // Cannot change role, authUid, createdAt
}
```

---

### Other Users' Profiles

| Role | Can Update Other Users |
|------|------------------------|
| **Admin** | ✅ YES (any user, any field except role - use dedicated role change) |
| **Super** | ❌ NO |
| **Regular** | ❌ NO |
| **Guest** | ❌ NO |

**Firestore Rule (Phase 6):**
```javascript
match /users/{userId} {
  allow update: if isAuthenticated() &&
                 request.auth.token.role == 'admin' &&
                 getUserAuthUid(userId) != request.auth.uid; // Cannot update own profile via admin path
}
```

---

### User Creation/Deletion

| Role | Can Create/Delete Users |
|------|-------------------------|
| **Admin** | ✅ YES |
| **Super** | ❌ NO |
| **Regular** | ❌ NO |
| **Guest** | ❌ NO |

**Firestore Rule (Phase 6):**
```javascript
match /users/{userId} {
  allow create: if isAuthenticated() && request.auth.token.role == 'admin';
  allow delete: if isAuthenticated() && request.auth.token.role == 'admin';
}
```

---

## ROLE MANAGEMENT PERMISSIONS

### Changing Other Users' Roles

| Role | Can Change Roles |
|------|------------------|
| **Admin** | ✅ YES (other users only, not self) |
| **Super** | ❌ NO |
| **Regular** | ❌ NO |
| **Guest** | ❌ NO |

**Special Rules:**
- ❌ Admin CANNOT change own role (prevents accidental lockout)
- ❌ Admin CANNOT remove last admin (system protection)

**Firestore Rule (Phase 6):**
```javascript
function isChangingRole() {
  return request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
}

function cannotRemoveLastAdmin() {
  // This requires a Cloud Function check before allowing role change
  // Firestore rules cannot count documents, so this validation happens in Cloud Function
  return true; // Validated by Cloud Function before role change
}

match /users/{userId} {
  allow update: if isAuthenticated() &&
                 request.auth.token.role == 'admin' &&
                 isChangingRole() &&
                 getUserAuthUid(userId) != request.auth.uid && // Cannot change own role
                 cannotRemoveLastAdmin();
}
```

**Cloud Function (Phase 6):**
```javascript
// Triggered before role update
exports.validateRoleChange = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.role !== after.role) {
      // Check if removing last admin
      if (before.role === 'admin' && after.role !== 'admin') {
        const admins = await db.collection('users')
          .where('role', '==', 'admin')
          .where('isActive', '==', true)
          .get();

        if (admins.size <= 1) {
          throw new Error('לא ניתן לשנות תפקיד של המנהל האחרון');
        }
      }

      // Set Custom Claim
      await admin.auth().setCustomUserClaims(after.authUid, { role: after.role });
    }
  });
```

---

## GROUP MANAGEMENT PERMISSIONS

| Role | Can Create/Modify/Delete Groups |
|------|----------------------------------|
| **Admin** | ✅ YES |
| **Super** | ❌ NO |
| **Regular** | ❌ NO |
| **Guest** | ❌ NO |

**Firestore Rule (Phase 6):**
```javascript
match /groups/{groupId} {
  allow create, update, delete: if isAuthenticated() && request.auth.token.role == 'admin';
  allow read: if isAuthenticated(); // All users can read groups
}
```

---

## DASHBOARD ACCESS PERMISSIONS

### Dashboard Sections by Role

| Section | Admin | Super | Regular | Guest |
|---------|-------|-------|---------|-------|
| Games Management | ✅ Full | ✅ Own games | ❌ No | ❌ No |
| Users Management | ✅ Full | ❌ No | ❌ No | ❌ No |
| Groups Management | ✅ Full | ❌ No | ❌ No | ❌ No |
| Own Profile | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Read-only |
| Statistics | ✅ All | ✅ All | ✅ All | ✅ All |

**Implementation:** Client-side route protection + UI component visibility checks.

---

## AUTHENTICATION REQUIREMENTS

**All operations require authentication:**
```javascript
function isAuthenticated() {
  return request.auth != null;
}
```

**No operation is allowed for unauthenticated users.**

---

## OWNERSHIP VALIDATION

**Games and Groups must have valid createdBy:**
```javascript
function hasValidCreatedBy() {
  return request.resource.data.createdBy == request.auth.uid;
}

function isOwner(resourceData) {
  return isAuthenticated() && resourceData.createdBy == request.auth.uid;
}
```

---

## PHASE 6 IMPLEMENTATION CHECKLIST

### Cloud Functions Setup
- [ ] Install Firebase Cloud Functions
- [ ] Create function to set Custom Claims on user creation
- [ ] Create function to update Custom Claims on role change
- [ ] Create function to validate "last admin" before role change
- [ ] Handle token refresh on role changes (client-side)

### Firestore Rules Update
- [ ] Add helper function `getUserAuthUid(userId)` to get authUid from user doc
- [ ] Add helper function `getUserDocId()` to get user Firestore doc ID from authUid
- [ ] Implement game viewing rules (ongoing vs completed)
- [ ] Implement game CRUD rules (create/update/delete by role)
- [ ] Implement user profile rules (own vs others)
- [ ] Implement role change rules (admin only, not self, last admin protection)
- [ ] Implement group management rules (admin only)

### Testing (Firebase Emulator)
- [ ] Test all admin operations (should succeed)
- [ ] Test super user game creation/modification/deletion
- [ ] Test super user cannot delete completed games
- [ ] Test regular users cannot create/modify/delete games
- [ ] Test guest users have read-only access
- [ ] Test admin cannot change own role
- [ ] Test admin cannot remove last admin
- [ ] Test Custom Claims are set correctly on role change
- [ ] Test token refresh after role change

---

## CURRENT IMPLEMENTATION (Phase 1-2)

**What IS enforced now:**
- ✅ Authentication required for all operations
- ✅ Ownership-based game access (createdBy === request.auth.uid)
- ✅ createdBy field cannot be changed after creation
- ✅ createdBy must equal request.auth.uid on game creation

**What is NOT enforced yet (client-side only):**
- ⏳ Role-based game creation (admin/super only)
- ⏳ Role-based game deletion (super cannot delete completed)
- ⏳ Role-based game viewing (admin sees all, super sees created+participated)
- ⏳ Role-based user management (admin only)
- ⏳ Role-based group management (admin only)
- ⏳ Admin self-role protection
- ⏳ Last admin protection

**Current firestore.rules (Phase 1):**
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(resourceData) {
      return isAuthenticated() && resourceData.createdBy == request.auth.uid;
    }

    function hasValidCreatedBy() {
      return request.resource.data.createdBy == request.auth.uid;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }

    // Games collection
    match /games/{gameId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && hasValidCreatedBy();
      allow update: if isAuthenticated() &&
                     isOwner(resource.data) &&
                     request.resource.data.createdBy == resource.data.createdBy;
      allow delete: if isAuthenticated() && isOwner(resource.data);
    }

    // Groups collection
    match /groups/{groupId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && hasValidCreatedBy();
      allow update: if isAuthenticated() && isOwner(resource.data);
      allow delete: if isAuthenticated() && isOwner(resource.data);
    }
  }
}
```

---

## MIGRATION PATH (Phase 1-2 → Phase 6)

1. **Phase 1-2 (Current):**
   - Ownership rules in place
   - Client-side role validation
   - Functional but not fully secure

2. **Phase 6 (Future):**
   - Set up Cloud Functions
   - Implement Custom Claims
   - Update Firestore rules with role checks
   - Test extensively with Firebase Emulator
   - Deploy with confidence

3. **No Breaking Changes:**
   - Users collection structure stays the same
   - authUid remains separate field (not document ID)
   - Client code stays the same (already checking roles)
   - Just add server-side enforcement layer

---

## SECURITY CONSIDERATIONS

**Current Risk (Phase 1-2):**
- Malicious users with Firebase SDK access could bypass client-side role checks
- Low risk for internal app with trusted users
- Ownership rules prevent users from modifying others' data

**Phase 6 Mitigation:**
- Server-side enforcement via Custom Claims
- No way to bypass Firestore rules
- Complete security for production deployment

**Recommendation:**
- Use current system for internal testing (Phase 1-5)
- Implement Custom Claims before public release (Phase 6)
- Document clearly that Phase 6 is required for production

---

**END OF SPECIFICATION**

This document will be the definitive reference for Phase 6 implementation of role-based permissions using Firebase Custom Claims and Cloud Functions.

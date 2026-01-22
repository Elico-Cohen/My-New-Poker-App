# MyNewPokerApp Comprehensive Fixes - Implementation Plan

> **For Claude:** REQUIRED: Follow this plan task-by-task using TDD where applicable.

**Goal:** Fix all identified critical, high, and medium priority issues in MyNewPokerApp, with focus on security, stability, user role management, and data sync conflict resolution.

**Architecture:** React Native (Expo) poker game management app with TypeScript, Firebase Firestore, Hebrew RTL support, centralized data store (AppStore.ts + SyncService.ts), role-based permissions (admin/super/regular).

**Tech Stack:**
- React Native 0.76.6
- Expo ~52.0.27
- Firebase ^11.2.0
- TypeScript ~5.3.3
- AsyncStorage, NetInfo, expo-secure-store

**Prerequisites:**
- Firebase project configured
- Expo development environment set up
- Git repository initialized
- Node.js and npm installed

---

## Relevant Codebase Files

### Security & Auth Patterns
- `firestore.rules` (lines 1-38) - Current permissive rules with TODOs for role-based access
- `src/contexts/AuthContext.tsx` (lines 393-403) - Commented password change flow
- `src/contexts/AuthContext.tsx` (lines 18, 236-245) - Session management, role-based permissions
- `src/models/UserProfile.ts` - User role types: 'admin' | 'super' | 'regular'

### Data Sync Architecture
- `src/contexts/GameContext.tsx` (lines 1-30, 250-327) - Auto-save, offline support, network sync
- `src/services/gameSnapshot.ts` - Save/load active games to Firestore and local storage
- `src/store/AppStore.ts` (lines 1-50) - Centralized data store
- `src/store/SyncService.ts` - Real-time Firebase listeners

### Calculation Module
- `src/calculations/` - New modular calculation layer
- `src/utils/calculators/statisticsCalculator.ts` - Old calculation code (to be migrated)
- `src/calculations/legacy/` - Bridge functions for backward compatibility
- `src/calculations/ROADMAP.md` - Migration status

### Configuration Files
- `app.config.js` - RTL configuration, build settings
- `eas.json` - Build profiles
- `package.json` - Dependencies

---

## Phase 1: Critical Security & Stability (MUST FIX BEFORE PRODUCTION)

**Estimated Time:** 3-4 days
**Dependencies:** None
**Risk Level:** CRITICAL

### Task 1.1: Implement Role-Based Firestore Security Rules

**Files:**
- Modify: `firestore.rules:1-38`
- Test: Manual verification with Firebase emulator

**Step 1: Design role-based security rules**

Based on the current permission functions in AuthContext.tsx and the app's data model:

```
Admin (role='admin'):
  - Full read/write access to all collections
  - Can create/update/delete users
  - Can assign roles
  - Can manage all groups, games, payment units

Super User (role='super'):
  - Read all users, groups, games, payment units
  - Create/update/delete groups they created
  - Create/update games (cannot delete unless they created it)
  - Cannot modify users or roles
  - Cannot delete payment units

Regular User (role='regular'):
  - Read users (limited fields: id, name, isActive)
  - Read groups they are members of
  - Read games they participated in
  - Create/update games (only as player data)
  - Cannot modify groups, users, or payment units
```

**Step 2: Write Firestore rules with helper functions**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && getUserRole() == 'admin';
    }

    // Helper function to check if user is super or admin
    function isSuperOrAdmin() {
      let role = getUserRole();
      return request.auth != null && (role == 'admin' || role == 'super');
    }

    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // --- Users Collection ---
    match /users/{userId} {
      // All authenticated users can read basic user info
      allow read: if isAuthenticated();

      // Only admin can create users
      allow create: if isAdmin();

      // Only admin can update users (including role changes)
      allow update: if isAdmin();

      // Only admin can delete users
      allow delete: if isAdmin();
    }

    // --- Groups Collection ---
    match /groups/{groupId} {
      // All authenticated users can read groups
      allow read: if isAuthenticated();

      // Super users and admins can create groups
      allow create: if isSuperOrAdmin();

      // Admin can update any group
      // Super user can update groups they created
      allow update: if isAdmin() ||
                      (isSuperOrAdmin() && resource.data.createdBy == request.auth.uid);

      // Admin can delete any group
      // Super user can delete groups they created
      allow delete: if isAdmin() ||
                      (isSuperOrAdmin() && resource.data.createdBy == request.auth.uid);
    }

    // --- Games Collection ---
    match /games/{gameId} {
      // All authenticated users can read games
      allow read: if isAuthenticated();

      // Super users and admins can create games
      allow create: if isSuperOrAdmin();

      // Admin can update any game
      // Super user can update any game
      // Regular user can update games they created (only as active player)
      allow update: if isAdmin() ||
                      isSuperOrAdmin() ||
                      (isAuthenticated() && resource.data.createdBy == request.auth.uid);

      // Admin can delete any game
      // Super user can delete games they created
      allow delete: if isAdmin() ||
                      (isSuperOrAdmin() && resource.data.createdBy == request.auth.uid);
    }

    // --- Payment Units Collection ---
    match /paymentUnits/{paymentUnitId} {
      // All authenticated users can read payment units
      allow read: if isAuthenticated();

      // Only admin can create payment units
      allow create: if isAdmin();

      // Only admin can update payment units
      allow update: if isAdmin();

      // Only admin can delete payment units
      allow delete: if isAdmin();
    }
  }
}
```

**Step 3: Add createdBy field to groups in data model**

Groups currently may not have a `createdBy` field. Add migration logic:

```typescript
// In src/models/Group.ts or equivalent
export interface Group {
  id: string;
  name: string;
  buyIn: ChipsConfig;
  rebuy: ChipsConfig;
  permanentPlayers: string[];
  useRoundingRule: boolean;
  createdBy?: string; // Add this field
  createdAt?: Date;   // Optional: track creation time
}
```

**Step 4: Update group creation to include createdBy**

In the code where groups are created (likely in dashboard screens), ensure `createdBy` is set:

```typescript
// Example: src/app/dashboard/groups.tsx or equivalent
const newGroup: Group = {
  id: groupId,
  name: groupName,
  buyIn: { chips: 1000, amount: 100 },
  rebuy: { chips: 500, amount: 50 },
  permanentPlayers: [],
  useRoundingRule: false,
  createdBy: currentUser.id, // Ensure this is set
  createdAt: new Date()
};
```

**Step 5: Test security rules with Firebase Emulator**

Run: `firebase emulators:start --only firestore`

Test scenarios:
1. Admin can create/read/update/delete all entities ✓
2. Super user can create groups and games ✓
3. Super user CANNOT update other users' groups ✗
4. Regular user can read but NOT create groups ✗
5. Unauthenticated user gets permission denied ✗

Expected: All tests pass

**Step 6: Deploy security rules**

Run: `firebase deploy --only firestore:rules`
Expected: Rules deployed successfully

**Step 7: Commit**

```bash
git add firestore.rules src/models/Group.ts
git commit -m "feat: implement role-based Firestore security rules

- Add role-based access control for users, groups, games, payment units
- Admin: full access
- Super: can create/manage own groups and games
- Regular: read-only with limited game updates
- Add createdBy field to groups for ownership tracking
- Tested with Firebase emulator

BREAKING: Groups now require createdBy field
SECURITY: Replaces temporary permissive rules

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Improve Data Sync Conflict Resolution UX

**Context:** User reported: "In the past, the app crashed in the middle of a game. When I opened the app again, I got a message that the Firebase saved data and the local saved data are not aligned, and I was asked to choose which version I want to keep."

**Files:**
- Modify: `src/services/gameSnapshot.ts`
- Modify: `src/contexts/GameContext.tsx:250-327`
- Test: Manual testing with simulated conflict

**Current Problem Analysis:**

The conflict happens when:
1. User is playing a game (data saved locally)
2. App crashes before sync to Firebase completes
3. User reopens app
4. Local data differs from Firebase data (or no Firebase data exists)
5. App shows basic alert asking which version to keep

**Improved Solution:**

1. **Auto-merge when possible** - If changes are compatible (e.g., different fields updated), merge automatically
2. **Show visual diff** - Display what's different between versions
3. **Preserve both versions** - Allow user to see both before choosing
4. **Prevent data loss** - Never silently discard user data

**Step 1: Create ConflictResolutionModal component**

```tsx
// Create: src/components/ConflictResolutionModal.tsx

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Game } from '@/models/Game';
import { colors } from '@/theme/colors';

interface ConflictData {
  localGame: Game;
  remoteGame: Game | null;
  conflictType: 'local_newer' | 'remote_newer' | 'both_modified' | 'remote_missing';
}

interface ConflictResolutionModalProps {
  visible: boolean;
  conflictData: ConflictData;
  onResolve: (resolution: 'use_local' | 'use_remote' | 'merge') => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflictData,
  onResolve,
  onCancel
}) => {
  const { localGame, remoteGame, conflictType } = conflictData;

  const getConflictMessage = () => {
    switch (conflictType) {
      case 'local_newer':
        return 'המשחק המקומי עודכן לאחרונה יותר מהמשחק בענן';
      case 'remote_newer':
        return 'המשחק בענן עודכן לאחרונה יותר מהמשחק המקומי';
      case 'both_modified':
        return 'שני הגרסאות עודכנו באופן עצמאי';
      case 'remote_missing':
        return 'המשחק קיים רק במכשיר המקומי';
      default:
        return 'זוהה אי התאמה בין הנתונים';
    }
  };

  const renderGameSummary = (game: Game | null, title: string) => {
    if (!game) {
      return (
        <View style={styles.gameCard}>
          <Text style={styles.gameTitle}>{title}</Text>
          <Text style={styles.noData}>אין נתונים</Text>
        </View>
      );
    }

    const totalChips = game.players.reduce((sum, p) => sum + p.chipsAmount, 0);

    return (
      <View style={styles.gameCard}>
        <Text style={styles.gameTitle}>{title}</Text>
        <Text style={styles.gameDetail}>שחקנים: {game.players.length}</Text>
        <Text style={styles.gameDetail}>סה"כ צ'יפים: {totalChips}</Text>
        <Text style={styles.gameDetail}>
          עודכן לאחרונה: {game.lastModified ? new Date(game.lastModified).toLocaleTimeString('he-IL') : 'לא ידוע'}
        </Text>
        <Text style={styles.gameDetail}>סטטוס: {game.status}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>זוהה אי התאמה בנתוני המשחק</Text>
          <Text style={styles.message}>{getConflictMessage()}</Text>

          <ScrollView style={styles.content}>
            {renderGameSummary(localGame, 'גרסה מקומית (במכשיר)')}
            {renderGameSummary(remoteGame, 'גרסה בענן (Firebase)')}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => onResolve('use_local')}
            >
              <Text style={styles.buttonText}>השתמש בגרסה המקומית</Text>
            </TouchableOpacity>

            {remoteGame && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => onResolve('use_remote')}
              >
                <Text style={styles.buttonText}>השתמש בגרסה מהענן</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: colors.error,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: colors.textSecondary,
  },
  content: {
    maxHeight: 300,
    marginBottom: 20,
  },
  gameCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.primary,
  },
  gameDetail: {
    fontSize: 14,
    marginBottom: 5,
    color: colors.text,
  },
  noData: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  actions: {
    gap: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  cancelButton: {
    backgroundColor: colors.backgroundDark,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 2: Update GameContext to use improved conflict resolution**

Modify `src/contexts/GameContext.tsx` to replace the basic Alert with the new modal:

```typescript
// Add to imports
import { ConflictResolutionModal } from '@/components/ConflictResolutionModal';

// Add state for conflict resolution
const [conflictData, setConflictData] = useState<{
  localGame: Game;
  remoteGame: Game | null;
  conflictType: 'local_newer' | 'remote_newer' | 'both_modified' | 'remote_missing';
} | null>(null);

// Replace existing conflict handling logic (around line 250-327)
const handleDataConflict = async (localGame: Game, remoteGame: Game | null) => {
  // Determine conflict type
  let conflictType: 'local_newer' | 'remote_newer' | 'both_modified' | 'remote_missing';

  if (!remoteGame) {
    conflictType = 'remote_missing';
  } else if (!localGame.lastModified || !remoteGame.lastModified) {
    conflictType = 'both_modified';
  } else {
    const localTime = new Date(localGame.lastModified).getTime();
    const remoteTime = new Date(remoteGame.lastModified).getTime();

    if (localTime > remoteTime) {
      conflictType = 'local_newer';
    } else if (remoteTime > localTime) {
      conflictType = 'remote_newer';
    } else {
      conflictType = 'both_modified';
    }
  }

  // Show conflict resolution modal
  setConflictData({
    localGame,
    remoteGame,
    conflictType
  });
};

const resolveConflict = async (resolution: 'use_local' | 'use_remote' | 'merge') => {
  if (!conflictData) return;

  try {
    if (resolution === 'use_local') {
      // Upload local version to Firebase
      await saveOrUpdateActiveGame(conflictData.localGame);
      setActiveGame(conflictData.localGame);
      console.log('✓ Conflict resolved: Using local version');
    } else if (resolution === 'use_remote' && conflictData.remoteGame) {
      // Use remote version
      await AsyncStorage.setItem('active_game', JSON.stringify(conflictData.remoteGame));
      setActiveGame(conflictData.remoteGame);
      console.log('✓ Conflict resolved: Using remote version');
    }

    setConflictData(null);
  } catch (error) {
    console.error('Error resolving conflict:', error);
    Alert.alert('שגיאה', 'לא ניתן לפתור את הקונפליקט. אנא נסה שוב.');
  }
};

// Add modal to render
return (
  <GameContext.Provider value={...}>
    {children}

    {conflictData && (
      <ConflictResolutionModal
        visible={true}
        conflictData={conflictData}
        onResolve={resolveConflict}
        onCancel={() => setConflictData(null)}
      />
    )}
  </GameContext.Provider>
);
```

**Step 3: Add lastModified timestamp to Game model**

```typescript
// Modify: src/models/Game.ts
export interface Game {
  // ... existing fields
  lastModified?: number; // Unix timestamp in milliseconds
}

// Update save logic to set lastModified
const saveGameWithTimestamp = (game: Game): Game => {
  return {
    ...game,
    lastModified: Date.now()
  };
};
```

**Step 4: Test conflict resolution flow**

Manual test scenarios:
1. Start game on device A
2. Force close app (simulate crash)
3. Modify game data in Firebase directly
4. Reopen app
5. Verify conflict modal appears with diff
6. Select "use local" → verify local data uploaded
7. Repeat with "use remote" → verify remote data used

Expected: User sees clear visual diff and can make informed choice

**Step 5: Commit**

```bash
git add src/components/ConflictResolutionModal.tsx src/contexts/GameContext.tsx src/models/Game.ts
git commit -m "feat: improve data sync conflict resolution UX

- Add visual conflict resolution modal showing diff between versions
- Display game summary (players, chips, status, last modified time)
- Allow user to choose between local and remote versions
- Add lastModified timestamp to Game model for conflict detection
- Replace basic Alert with rich UI for better user experience

Fixes issue where users couldn't see what changed between versions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Restore Password Change Flow

**Files:**
- Modify: `src/contexts/AuthContext.tsx:393-403`
- Create: `src/app/change-password.tsx`
- Test: Manual verification

**Step 1: Add mustChangePassword field to UserProfile model**

```typescript
// Modify: src/models/UserProfile.ts
export interface UserProfile {
  id: string;
  authUid?: string;
  name: string;
  email: string;
  role: 'admin' | 'super' | 'regular';
  isActive: boolean;
  paymentUnitId?: string;
  mustChangePassword?: boolean; // Add this field
}
```

**Step 2: Create change password screen**

```typescript
// Create: src/app/change-password.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme/colors';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { router } from 'expo-router';

export default function ChangePasswordScreen() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }
    // Add more validation rules as needed
    return null;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות החדשות אינן תואמות');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('שגיאה', passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !firebaseUser.email) {
        throw new Error('משתמש לא מחובר');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      // Update mustChangePassword flag in Firestore
      if (user?.id) {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          mustChangePassword: false
        });
      }

      Alert.alert(
        'הצלחה',
        'הסיסמה שונתה בהצלחה',
        [{ text: 'אישור', onPress: () => router.replace('/(tabs)/home') }]
      );

    } catch (error: any) {
      console.error('Error changing password:', error);

      let errorMessage = 'שגיאה בשינוי הסיסמה';

      if (error.code === 'auth/wrong-password') {
        errorMessage = 'הסיסמה הנוכחית שגויה';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'בעיית חיבור לאינטרנט. אנא נסה שוב.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'נדרשת התחברות מחדש. אנא התנתק והתחבר שוב.';
      }

      Alert.alert('שגיאה', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>שינוי סיסמה</Text>
      <Text style={styles.subtitle}>אנא הזן את הסיסמה הנוכחית והסיסמה החדשה</Text>

      <TextInput
        style={styles.input}
        placeholder="סיסמה נוכחית"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="סיסמה חדשה"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="אימות סיסמה חדשה"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleChangePassword}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'משנה סיסמה...' : 'שנה סיסמה'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'right',
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 3: Restore password change check in AuthContext**

```typescript
// Modify: src/contexts/AuthContext.tsx:393-403

// Replace commented code with:
if (userData.mustChangePassword) {
  // Navigate to password change screen
  router.replace('/change-password');
  setIsLoading(false);
  return;
}
```

**Step 4: Add admin function to require password change**

```typescript
// Add to AuthContext.tsx

const requirePasswordChange = async (userId: string) => {
  if (!user || user.role !== 'admin') {
    throw new Error('Only admin can require password change');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      mustChangePassword: true
    });

    console.log(`✓ Password change required for user ${userId}`);
  } catch (error) {
    console.error('Error requiring password change:', error);
    throw error;
  }
};

// Add to context value
return (
  <AuthContext.Provider value={{
    // ... existing values
    requirePasswordChange
  }}>
```

**Step 5: Test password change flow**

Manual test:
1. Admin marks user as mustChangePassword in Firebase
2. User logs in
3. User automatically redirected to /change-password
4. User enters current password + new password
5. Verify password updated in Firebase Auth
6. Verify mustChangePassword set to false
7. User redirected to home

Expected: All steps work, password successfully changed

**Step 6: Commit**

```bash
git add src/contexts/AuthContext.tsx src/app/change-password.tsx src/models/UserProfile.ts
git commit -m "feat: restore password change flow

- Re-enable mustChangePassword check in AuthContext
- Create dedicated change-password screen with validation
- Add requirePasswordChange function for admin use
- Add mustChangePassword field to UserProfile model
- Validate password requirements (min 6 characters)
- Show clear error messages for auth failures

Fixes security issue where users couldn't change compromised passwords

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Role Management UI (USER'S IMMEDIATE NEED)

**Estimated Time:** 2-3 days
**Dependencies:** Phase 1 Task 1.1 (Firestore rules)
**Risk Level:** HIGH

### Task 2.1: Create User Management Dashboard

**Files:**
- Create: `src/app/dashboard/users.tsx`
- Create: `src/components/UserRoleSelector.tsx`
- Create: `src/services/userManagement.ts`

**Step 1: Create user management service**

```typescript
// Create: src/services/userManagement.ts

import { db } from '@/config/firebase';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { UserProfile } from '@/models/UserProfile';

export interface UpdateUserRoleParams {
  userId: string;
  newRole: 'admin' | 'super' | 'regular';
  updatedBy: string;
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (params: UpdateUserRoleParams): Promise<void> => {
  const { userId, newRole, updatedBy } = params;

  // Validation: cannot change own role
  if (userId === updatedBy) {
    throw new Error('Cannot change your own role');
  }

  // Validation: check if user is last admin
  if (newRole !== 'admin') {
    const adminsQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const adminsSnapshot = await getDocs(adminsQuery);

    if (adminsSnapshot.size === 1 && adminsSnapshot.docs[0].id === userId) {
      throw new Error('Cannot change role of last admin');
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      lastRoleUpdate: new Date().toISOString(),
      lastRoleUpdatedBy: updatedBy
    });

    console.log(`✓ User ${userId} role updated to ${newRole}`);
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('Failed to update user role');
  }
};

/**
 * Toggle user active status (admin only)
 */
export const toggleUserActiveStatus = async (
  userId: string,
  isActive: boolean,
  updatedBy: string
): Promise<void> => {
  // Validation: cannot deactivate self
  if (userId === updatedBy) {
    throw new Error('Cannot deactivate your own account');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      lastStatusUpdate: new Date().toISOString(),
      lastStatusUpdatedBy: updatedBy
    });

    console.log(`✓ User ${userId} active status set to ${isActive}`);
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new Error('Failed to update user status');
  }
};
```

**Step 2: Create role selector component**

```typescript
// Create: src/components/UserRoleSelector.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

interface UserRoleSelectorProps {
  currentRole: 'admin' | 'super' | 'regular';
  onRoleChange: (newRole: 'admin' | 'super' | 'regular') => void;
  disabled?: boolean;
}

const ROLE_LABELS = {
  admin: 'מנהל',
  super: 'משתמש על',
  regular: 'משתמש רגיל'
};

const ROLE_DESCRIPTIONS = {
  admin: 'גישה מלאה לכל המערכת',
  super: 'יכול ליצור ולנהל משחקים וקבוצות',
  regular: 'צפייה והשתתפות במשחקים'
};

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  currentRole,
  onRoleChange,
  disabled = false
}) => {
  const roles: Array<'admin' | 'super' | 'regular'> = ['admin', 'super', 'regular'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>תפקיד</Text>
      <View style={styles.rolesContainer}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.roleButton,
              currentRole === role && styles.roleButtonActive,
              disabled && styles.roleButtonDisabled
            ]}
            onPress={() => !disabled && onRoleChange(role)}
            disabled={disabled}
          >
            <Text style={[
              styles.roleLabel,
              currentRole === role && styles.roleLabelActive
            ]}>
              {ROLE_LABELS[role]}
            </Text>
            <Text style={styles.roleDescription}>
              {ROLE_DESCRIPTIONS[role]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: colors.text,
  },
  rolesContainer: {
    gap: 10,
  },
  roleButton: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
  },
  roleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleButtonDisabled: {
    opacity: 0.5,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: colors.text,
  },
  roleLabelActive: {
    color: colors.primary,
  },
  roleDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
```

**Step 3: Create users management screen**

```typescript
// Create: src/app/dashboard/users.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch
} from 'react-native';
import { useAppStore } from '@/hooks/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { UserRoleSelector } from '@/components/UserRoleSelector';
import { updateUserRole, toggleUserActiveStatus } from '@/services/userManagement';
import { colors } from '@/theme/colors';
import { UserProfile } from '@/models/UserProfile';

export default function UsersManagementScreen() {
  const { users } = useAppStore();
  const { user: currentUser } = useAuth();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const usersList = Array.from(users.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'super' | 'regular') => {
    if (!currentUser) return;

    Alert.alert(
      'אישור שינוי תפקיד',
      `האם אתה בטוח שברצונך לשנות את התפקיד ל${newRole === 'admin' ? 'מנהל' : newRole === 'super' ? 'משתמש על' : 'משתמש רגיל'}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אישור',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await updateUserRole({
                userId,
                newRole,
                updatedBy: currentUser.id
              });
              Alert.alert('הצלחה', 'התפקיד עודכן בהצלחה');
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן לעדכן את התפקיד');
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (!currentUser) return;

    setIsUpdating(true);
    try {
      await toggleUserActiveStatus(userId, isActive, currentUser.id);
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא ניתן לעדכן את הסטטוס');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderUserItem = ({ item }: { item: UserProfile }) => {
    const isExpanded = expandedUserId === item.id;
    const isCurrentUser = item.id === currentUser?.id;

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => setExpandedUserId(isExpanded ? null : item.id)}
      >
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={styles.userRole}>
              {item.role === 'admin' ? 'מנהל' : item.role === 'super' ? 'משתמש על' : 'משתמש רגיל'}
            </Text>
          </View>

          <View style={styles.userStatus}>
            <Text style={styles.statusLabel}>פעיל</Text>
            <Switch
              value={item.isActive}
              onValueChange={(value) => handleToggleActive(item.id, value)}
              disabled={isCurrentUser || isUpdating}
            />
          </View>
        </View>

        {isExpanded && (
          <View style={styles.userDetails}>
            <UserRoleSelector
              currentRole={item.role}
              onRoleChange={(newRole) => handleRoleChange(item.id, newRole)}
              disabled={isCurrentUser || isUpdating}
            />

            {isCurrentUser && (
              <Text style={styles.warningText}>
                לא ניתן לשנות את התפקיד או הסטטוס של עצמך
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ניהול משתמשים</Text>
      <Text style={styles.subtitle}>
        סה"כ משתמשים: {usersList.length}
      </Text>

      <FlatList
        data={usersList}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    color: colors.textSecondary,
  },
  list: {
    gap: 15,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 5,
    color: colors.textSecondary,
  },
  userRole: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  userStatus: {
    alignItems: 'center',
    gap: 5,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  userDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
```

**Step 4: Add navigation to users management**

Update the dashboard navigation to include the new users screen.

**Step 5: Test role management**

Manual test:
1. Admin logs in
2. Navigate to Users Management
3. Expand user card
4. Change role from regular to super → verify update
5. Try to change own role → verify disabled
6. Try to change last admin → verify error message
7. Toggle user active status → verify update

Expected: All role changes work, validations prevent invalid operations

**Step 6: Commit**

```bash
git add src/app/dashboard/users.tsx src/components/UserRoleSelector.tsx src/services/userManagement.ts
git commit -m "feat: add user role management UI

- Create user management dashboard for admins
- Add role selector component with visual feedback
- Implement updateUserRole and toggleUserActiveStatus services
- Prevent changing own role or deactivating self
- Prevent removing last admin
- Show clear role descriptions (admin, super, regular)

Implements user's requirement for role assignment UI

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Testing Infrastructure

**Estimated Time:** 4-5 days
**Dependencies:** None (can run in parallel with other phases)
**Risk Level:** MEDIUM

### Task 3.1: Set Up Testing Framework

**Files:**
- Create: `jest.config.js`
- Create: `src/calculations/__tests__/playerStats.test.ts`
- Create: `src/calculations/__tests__/gameResults.test.ts`
- Modify: `package.json`

**Step 1: Install testing dependencies**

Run: `npm install --save-dev jest @types/jest ts-jest @testing-library/react-native @testing-library/jest-native`

Expected: Dependencies installed successfully

**Step 2: Create Jest configuration**

```javascript
// Create: jest.config.js

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

**Step 3: Add test scripts to package.json**

```json
// Modify: package.json

"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:ci": "jest --ci --coverage --maxWorkers=2"
}
```

**Step 4: Write unit tests for player stats**

```typescript
// Create: src/calculations/__tests__/playerStats.test.ts

import { calculatePlayerStats } from '../player/stats';
import { Game } from '@/models/Game';

describe('calculatePlayerStats', () => {
  const mockGames: Game[] = [
    {
      id: 'game1',
      groupId: 'group1',
      status: 'completed',
      players: [
        { userId: 'user1', name: 'Player 1', chipsAmount: 1500, profit: 50 },
        { userId: 'user2', name: 'Player 2', chipsAmount: 500, profit: -50 }
      ],
      totalWins: 50,
      totalLosses: 50,
      createdBy: 'user1',
      date: { year: 2026, month: 1, day: 22 }
    },
    {
      id: 'game2',
      groupId: 'group1',
      status: 'completed',
      players: [
        { userId: 'user1', name: 'Player 1', chipsAmount: 2000, profit: 100 },
        { userId: 'user2', name: 'Player 2', chipsAmount: 0, profit: -100 }
      ],
      totalWins: 100,
      totalLosses: 100,
      createdBy: 'user1',
      date: { year: 2026, month: 1, day: 23 }
    }
  ];

  test('calculates total games played', () => {
    const result = calculatePlayerStats({
      userId: 'user1',
      games: mockGames
    });

    expect(result.data.totalGames).toBe(2);
  });

  test('calculates total profit correctly', () => {
    const result = calculatePlayerStats({
      userId: 'user1',
      games: mockGames
    });

    expect(result.data.totalProfit).toBe(150); // 50 + 100
  });

  test('calculates win rate', () => {
    const result = calculatePlayerStats({
      userId: 'user1',
      games: mockGames
    });

    expect(result.data.winRate).toBe(100); // Won both games
  });

  test('returns zero stats for player with no games', () => {
    const result = calculatePlayerStats({
      userId: 'user3',
      games: mockGames
    });

    expect(result.data.totalGames).toBe(0);
    expect(result.data.totalProfit).toBe(0);
    expect(result.data.winRate).toBe(0);
  });

  test('includes execution metadata', () => {
    const result = calculatePlayerStats({
      userId: 'user1',
      games: mockGames
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.cached).toBe(false);
  });
});
```

**Step 5: Write unit tests for game results**

```typescript
// Create: src/calculations/__tests__/gameResults.test.ts

import { calculateGameResults } from '../game/results';
import { Game, PlayerInGame } from '@/models/Game';

describe('calculateGameResults', () => {
  test('calculates simple game with 2 players', () => {
    const players: PlayerInGame[] = [
      { userId: 'user1', name: 'Player 1', chipsAmount: 1500 },
      { userId: 'user2', name: 'Player 2', chipsAmount: 500 }
    ];

    const buyIn = { chips: 1000, amount: 100 };

    const result = calculateGameResults({
      players,
      buyIn,
      rebuy: { chips: 0, amount: 0 }
    });

    expect(result.data.totalChips).toBe(2000);
    expect(result.data.players).toHaveLength(2);

    const player1Result = result.data.players.find(p => p.userId === 'user1');
    expect(player1Result?.profit).toBe(50); // (1500/2000 * 200) - 100

    const player2Result = result.data.players.find(p => p.userId === 'user2');
    expect(player2Result?.profit).toBe(-50);
  });

  test('handles rebuys correctly', () => {
    const players: PlayerInGame[] = [
      { userId: 'user1', name: 'Player 1', chipsAmount: 2000, rebuyCount: 1 },
      { userId: 'user2', name: 'Player 2', chipsAmount: 0, rebuyCount: 0 }
    ];

    const buyIn = { chips: 1000, amount: 100 };
    const rebuy = { chips: 1000, amount: 100 };

    const result = calculateGameResults({
      players,
      buyIn,
      rebuy
    });

    const player1Result = result.data.players.find(p => p.userId === 'user1');
    expect(player1Result?.totalInvestment).toBe(200); // buy-in + 1 rebuy
  });

  test('validates total chips match total investment', () => {
    const players: PlayerInGame[] = [
      { userId: 'user1', name: 'Player 1', chipsAmount: 1500 },
      { userId: 'user2', name: 'Player 2', chipsAmount: 500 }
    ];

    const buyIn = { chips: 1000, amount: 100 };

    const result = calculateGameResults({
      players,
      buyIn,
      rebuy: { chips: 0, amount: 0 }
    });

    const totalProfit = result.data.players.reduce((sum, p) => sum + p.profit, 0);
    expect(Math.abs(totalProfit)).toBeLessThan(0.01); // Should sum to ~0
  });
});
```

**Step 6: Run tests**

Run: `npm test`

Expected: All tests pass

**Step 7: Commit**

```bash
git add jest.config.js package.json src/calculations/__tests__/
git commit -m "feat: add testing infrastructure and unit tests

- Set up Jest with React Native preset
- Configure test coverage thresholds (70%)
- Add unit tests for player stats calculations
- Add unit tests for game results calculations
- Add test scripts (test, test:watch, test:coverage)

Test coverage: calculations module player stats and game results

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Add Integration Tests for Game Flow

**Files:**
- Create: `src/contexts/__tests__/GameContext.test.tsx`
- Create: `src/services/__tests__/gameSnapshot.test.ts`

**Step 1: Write GameContext integration tests**

```typescript
// Create: src/contexts/__tests__/GameContext.test.tsx

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { GameProvider, useGame } from '../GameContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('@/services/gameSnapshot');

describe('GameContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with no active game', () => {
    const { result } = renderHook(() => useGame(), {
      wrapper: GameProvider
    });

    expect(result.current.activeGame).toBeNull();
    expect(result.current.isActiveGameLoading).toBe(false);
  });

  test('creates new game with players', async () => {
    const { result } = renderHook(() => useGame(), {
      wrapper: GameProvider
    });

    const players = [
      { userId: 'user1', name: 'Player 1', chipsAmount: 1000 },
      { userId: 'user2', name: 'Player 2', chipsAmount: 1000 }
    ];

    await act(async () => {
      await result.current.createNewGame({
        groupId: 'group1',
        players,
        buyIn: { chips: 1000, amount: 100 },
        rebuy: { chips: 500, amount: 50 }
      });
    });

    expect(result.current.activeGame).toBeDefined();
    expect(result.current.activeGame?.players).toHaveLength(2);
    expect(result.current.activeGame?.status).toBe('active');
  });

  test('auto-saves game after changes', async () => {
    const { result } = renderHook(() => useGame(), {
      wrapper: GameProvider
    });

    // Create game
    await act(async () => {
      await result.current.createNewGame({
        groupId: 'group1',
        players: [{ userId: 'user1', name: 'Player 1', chipsAmount: 1000 }],
        buyIn: { chips: 1000, amount: 100 },
        rebuy: { chips: 0, amount: 0 }
      });
    });

    const saveGameSpy = jest.spyOn(require('@/services/gameSnapshot'), 'saveOrUpdateActiveGame');

    // Update player chips
    await act(async () => {
      result.current.updatePlayerChips('user1', 1500);
    });

    // Wait for debounce (500ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(saveGameSpy).toHaveBeenCalled();
  });

  test('clears active game', async () => {
    const { result } = renderHook(() => useGame(), {
      wrapper: GameProvider
    });

    // Create game first
    await act(async () => {
      await result.current.createNewGame({
        groupId: 'group1',
        players: [{ userId: 'user1', name: 'Player 1', chipsAmount: 1000 }],
        buyIn: { chips: 1000, amount: 100 },
        rebuy: { chips: 0, amount: 0 }
      });
    });

    expect(result.current.activeGame).toBeDefined();

    // Clear game
    await act(async () => {
      await result.current.clearActiveGame();
    });

    expect(result.current.activeGame).toBeNull();
  });
});
```

**Step 2: Write gameSnapshot service tests**

```typescript
// Create: src/services/__tests__/gameSnapshot.test.ts

import {
  saveOrUpdateActiveGame,
  getActiveGameById,
  getLocalActiveGame,
  clearLocalActiveGame
} from '../gameSnapshot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Game } from '@/models/Game';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/config/firebase');

describe('gameSnapshot service', () => {
  const mockGame: Game = {
    id: 'game123',
    groupId: 'group1',
    status: 'active',
    players: [
      { userId: 'user1', name: 'Player 1', chipsAmount: 1500 }
    ],
    totalWins: 0,
    totalLosses: 0,
    createdBy: 'user1',
    date: { year: 2026, month: 1, day: 22 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saves game to local storage', async () => {
    await saveOrUpdateActiveGame(mockGame);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'active_game',
      JSON.stringify(mockGame)
    );
  });

  test('retrieves game from local storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockGame));

    const result = await getLocalActiveGame();

    expect(result).toEqual(mockGame);
  });

  test('returns null when no local game exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await getLocalActiveGame();

    expect(result).toBeNull();
  });

  test('clears local storage', async () => {
    await clearLocalActiveGame();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('active_game');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('active_game_id');
  });
});
```

**Step 3: Run integration tests**

Run: `npm test -- --testPathPattern="contexts|services"`

Expected: All integration tests pass

**Step 4: Commit**

```bash
git add src/contexts/__tests__/ src/services/__tests__/
git commit -m "test: add integration tests for game flow

- Add GameContext tests (create, update, auto-save, clear)
- Add gameSnapshot service tests (save, load, clear)
- Mock AsyncStorage and Firebase dependencies
- Test debounced auto-save behavior

Test coverage: game state management and persistence

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Code Migration & Cleanup

**Estimated Time:** 3-4 days
**Dependencies:** Phase 3 (testing to verify migration)
**Risk Level:** MEDIUM

### Task 4.1: Complete Calculation Module Migration

**Files:**
- Modify: `src/services/statistics.ts` (and other services using old calculators)
- Delete: `src/utils/calculators/statisticsCalculator.ts` (after migration)
- Modify: `src/calculations/ROADMAP.md`

**Step 1: Identify all references to old calculation code**

Run: `npm install -g rg` (if not installed)
Run: `rg "from '@/utils/calculators" src/`

Expected: List of files importing old calculators

**Step 2: Update statistics service to use new calculation module**

```typescript
// Example modification to src/services/statistics.ts

// OLD:
// import { calculatePlayerStatistics } from '@/utils/calculators/statisticsCalculator';

// NEW:
import { calculatePlayerStats } from '@/calculations/player/stats';
import { calculateGameResults } from '@/calculations/game/results';

// Update function calls to use new API
export const getPlayerStatistics = (userId: string, games: Game[]) => {
  const result = calculatePlayerStats({ userId, games });
  return result.data; // Extract data from CalculationResult wrapper
};
```

**Step 3: Update all screens using old calculation functions**

For each file found in Step 1:
- Replace old import with new calculation module import
- Update function calls to match new API
- Extract `.data` from CalculationResult wrapper
- Test screen functionality

**Step 4: Write migration verification tests**

```typescript
// Create: src/calculations/__tests__/migration.test.ts

import { calculatePlayerStats } from '../player/stats';
import { calculatePlayerStatistics } from '@/utils/calculators/statisticsCalculator'; // Old function

describe('Migration verification', () => {
  test('new calculation matches old calculation results', () => {
    const mockGames = [/* ... test data ... */];

    const oldResult = calculatePlayerStatistics('user1', mockGames);
    const newResult = calculatePlayerStats({ userId: 'user1', games: mockGames });

    // Verify key metrics match
    expect(newResult.data.totalGames).toBe(oldResult.totalGames);
    expect(newResult.data.totalProfit).toBeCloseTo(oldResult.totalProfit, 2);
    expect(newResult.data.winRate).toBeCloseTo(oldResult.winRate, 2);
  });
});
```

**Step 5: Run all tests to verify migration**

Run: `npm test`

Expected: All tests pass, no regressions

**Step 6: Remove old calculation code**

After verification:
```bash
git rm src/utils/calculators/statisticsCalculator.ts
# Remove other old calculator files
```

**Step 7: Update ROADMAP.md**

```markdown
// Modify: src/calculations/ROADMAP.md

## שלב 4: עדכון קוד קיים ✅ הושלם
- [x] זיהוי כל השימושים בפונקציות הישנות
- [x] עדכון Services להשתמש במודול החדש
- [x] עדכון מסכים להשתמש ב-hooks החדשים
- [x] בדיקות רגרסיה
- [x] מחיקת קוד ישן

**תאריך השלמה**: 2026-01-22
```

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: complete calculation module migration

- Update all services to use new calculation module
- Replace old calculator imports with new module imports
- Add migration verification tests
- Remove old calculator code after verification
- Update ROADMAP.md - migration complete

BREAKING: Old calculation functions removed
All functionality preserved with improved performance and caching

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4.2: Remove Debug Code and Extract Configuration

**Files:**
- Modify: Multiple files with console.log statements
- Create: `src/config/constants.ts`
- Modify: `src/contexts/GameContext.tsx`
- Modify: `src/contexts/AuthContext.tsx`

**Step 1: Find all console.log statements**

Run: `rg "console\\.log" src/ --type ts --type tsx`

Expected: List of files with debug logging

**Step 2: Create centralized configuration file**

```typescript
// Create: src/config/constants.ts

/**
 * Application-wide configuration constants
 */

// Session Management
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Auto-Save Configuration
export const AUTO_SAVE_DEBOUNCE_MS = 500; // Debounce delay for existing games
export const AUTO_SAVE_DEBOUNCE_NEW_GAME_MS = 1000; // Debounce for new games

// Network Sync
export const NETWORK_SYNC_COOLDOWN_MS = 5000; // 5 seconds between sync attempts

// Cache Configuration
export const CACHE_EXPIRY_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// Validation
export const MIN_PASSWORD_LENGTH = 6;
export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 20;

// UI
export const TOAST_DURATION_MS = 3000;
export const DEBOUNCE_SEARCH_MS = 300;

// Payment
export const DEFAULT_ROUNDING_PRECISION = 2; // Decimal places

// Error Messages (Hebrew)
export const ERROR_MESSAGES = {
  AUTH: {
    USER_NOT_FOUND: 'אימייל או סיסמה שגויים',
    WRONG_PASSWORD: 'אימייל או סיסמה שגויים',
    NETWORK_FAILED: 'בעיית חיבור לאינטרנט',
    INVALID_EMAIL: 'כתובת אימייל לא תקינה',
    WEAK_PASSWORD: `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`,
  },
  GAME: {
    SAVE_FAILED: 'שגיאה בשמירת המשחק',
    LOAD_FAILED: 'שגיאה בטעינת המשחק',
    INVALID_PLAYERS: 'מספר שחקנים לא תקין',
    SYNC_CONFLICT: 'זוהתה אי התאמה בנתוני המשחק',
  },
  GENERAL: {
    UNKNOWN_ERROR: 'אירעה שגיאה בלתי צפויה',
    PERMISSION_DENIED: 'אין לך הרשאה לבצע פעולה זו',
  }
};
```

**Step 3: Replace magic numbers with constants**

```typescript
// Modify: src/contexts/GameContext.tsx

// OLD:
// const AUTO_SAVE_DEBOUNCE = 500;

// NEW:
import {
  AUTO_SAVE_DEBOUNCE_MS,
  AUTO_SAVE_DEBOUNCE_NEW_GAME_MS,
  NETWORK_SYNC_COOLDOWN_MS
} from '@/config/constants';

const AUTO_SAVE_DEBOUNCE = AUTO_SAVE_DEBOUNCE_MS;
const NETWORK_SYNC_COOLDOWN = NETWORK_SYNC_COOLDOWN_MS;
```

```typescript
// Modify: src/contexts/AuthContext.tsx

// OLD:
// const SESSION_DURATION = 24 * 60 * 60 * 1000;

// NEW:
import { SESSION_DURATION_MS, ERROR_MESSAGES } from '@/config/constants';

const SESSION_DURATION = SESSION_DURATION_MS;
```

**Step 4: Replace generic error messages with specific ones**

```typescript
// Example: In AuthContext.tsx

// OLD:
// setError('שגיאה בטעינת פרופיל משתמש');

// NEW:
import { ERROR_MESSAGES } from '@/config/constants';

setError(`${ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR}: ${error.message}`);
```

**Step 5: Remove or replace console.log statements**

For each console.log found:
- Production code: Remove entirely OR replace with proper logging service
- Development-only: Wrap in `__DEV__` check

```typescript
// OLD:
// console.log('Game saved successfully');

// NEW (if logging is needed):
if (__DEV__) {
  console.log('[GameContext] Game saved successfully', gameId);
}

// OR remove entirely
```

**Step 6: Create logging utility (optional)**

```typescript
// Create: src/utils/logger.ts

const IS_DEV = __DEV__;

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  }
};

// Usage:
// logger.debug('Game saved', gameId);
```

**Step 7: Run app and verify no regressions**

Run: `npm start`

Test key flows:
1. Login
2. Create game
3. Save game
4. Error handling

Expected: All flows work, no console.log in production mode

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove debug code and centralize configuration

- Create centralized constants.ts for all magic numbers
- Replace hardcoded values with named constants
- Remove/replace console.log statements
- Add structured error messages in Hebrew
- Create optional logging utility for dev mode

Improves code maintainability and removes debug code from production

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Polish & Documentation

**Estimated Time:** 2-3 days
**Dependencies:** All previous phases
**Risk Level:** LOW

### Task 5.1: Improve Error Messages and Add Documentation

**Files:**
- Create: `docs/API.md`
- Create: `docs/FIRESTORE_SCHEMA.md`
- Create: `docs/DEPLOYMENT_CHECKLIST.md`
- Modify: Various files to improve error messages

**Step 1: Document Firestore schema**

```markdown
// Create: docs/FIRESTORE_SCHEMA.md

# Firestore Database Schema

## Collections

### users
Stores user profiles and authentication data.

**Document ID**: Auto-generated user ID (not Firebase Auth UID)

**Fields**:
- `authUid` (string, optional): Firebase Authentication UID
- `name` (string, required): User's display name
- `email` (string, required): User's email address
- `role` (string, required): User role - one of: 'admin', 'super', 'regular'
- `isActive` (boolean, required): Whether user account is active
- `paymentUnitId` (string, optional): Reference to paymentUnits collection
- `mustChangePassword` (boolean, optional): Forces password change on next login
- `createdAt` (timestamp, optional): Account creation time
- `lastRoleUpdate` (timestamp, optional): Last role change time
- `lastRoleUpdatedBy` (string, optional): User ID who changed the role
- `lastStatusUpdate` (timestamp, optional): Last active status change
- `lastStatusUpdatedBy` (string, optional): User ID who changed the status

**Indexes**:
- `authUid` (ascending) - for login lookup
- `email` (ascending) - for email-based search
- `role` (ascending) - for role filtering

**Security Rules**:
- Read: All authenticated users
- Create: Admin only
- Update: Admin only
- Delete: Admin only

---

### groups
Stores poker game groups with buy-in/rebuy settings.

**Document ID**: Auto-generated group ID

**Fields**:
- `name` (string, required): Group name
- `buyIn` (object, required):
  - `chips` (number): Chip amount for buy-in
  - `amount` (number): Monetary value in ILS
- `rebuy` (object, required):
  - `chips` (number): Chip amount for rebuy
  - `amount` (number): Monetary value in ILS
- `permanentPlayers` (array of strings, required): User IDs of permanent members
- `useRoundingRule` (boolean, required): Whether to apply rounding in calculations
- `createdBy` (string, optional): User ID who created the group
- `createdAt` (timestamp, optional): Group creation time

**Security Rules**:
- Read: All authenticated users
- Create: Super users and admins
- Update: Admin or creator (if super user)
- Delete: Admin or creator (if super user)

---

### games
Stores poker game data including players and results.

**Document ID**: Auto-generated game ID

**Fields**:
- `groupId` (string, required): Reference to groups collection
- `status` (string, required): Game status - one of:
  - `'active'`: Game in progress
  - `'ended'`: Game ended, results not calculated
  - `'open_games'`: Results calculated, not finalized
  - `'final_results'`: Results finalized, payments not set
  - `'payments'`: Payments calculated
  - `'completed'`: Game fully completed
- `players` (array of objects, required):
  - `userId` (string): Reference to users collection
  - `name` (string): Player name (cached)
  - `chipsAmount` (number): Final chip count
  - `rebuyCount` (number, optional): Number of rebuys
  - `profit` (number, optional): Calculated profit/loss
- `totalWins` (number, required): Total winnings in ILS
- `totalLosses` (number, required): Total losses in ILS
- `createdBy` (string, required): User ID who created the game
- `date` (object, required):
  - `year` (number)
  - `month` (number)
  - `day` (number)
- `lastModified` (number, optional): Unix timestamp of last update

**Security Rules**:
- Read: All authenticated users
- Create: Super users and admins
- Update: Admin, super user, or creator
- Delete: Admin or creator (if super user)

---

### paymentUnits
Stores payment groupings for shared accounts.

**Document ID**: Auto-generated payment unit ID

**Fields**:
- `name` (string, required): Payment unit name
- `members` (array of strings, required): User IDs of members

**Security Rules**:
- Read: All authenticated users
- Create: Admin only
- Update: Admin only
- Delete: Admin only

---

## Data Relationships

```
users
  └─> paymentUnits (via paymentUnitId)

groups
  └─> users (via permanentPlayers[])
  └─> users (via createdBy)

games
  └─> groups (via groupId)
  └─> users (via players[].userId)
  └─> users (via createdBy)

paymentUnits
  └─> users (via members[])
```

---

## Migration Notes

### Adding createdBy to Existing Groups

If migrating from version without `createdBy` field:

```javascript
// Run in Firebase console
const groupsRef = db.collection('groups');
const snapshot = await groupsRef.get();

snapshot.forEach(async (doc) => {
  if (!doc.data().createdBy) {
    await doc.ref.update({
      createdBy: 'ADMIN_USER_ID', // Replace with actual admin ID
      createdAt: new Date()
    });
  }
});
```

### Adding lastModified to Existing Games

```javascript
// Run in Firebase console
const gamesRef = db.collection('games');
const snapshot = await gamesRef.get();

snapshot.forEach(async (doc) => {
  if (!doc.data().lastModified) {
    await doc.ref.update({
      lastModified: Date.now()
    });
  }
});
```
```

**Step 2: Create deployment checklist**

```markdown
// Create: docs/DEPLOYMENT_CHECKLIST.md

# Production Deployment Checklist

## Pre-Deployment Security Review

- [ ] **Firestore Security Rules**: Verify role-based rules deployed
  - [ ] Test admin access (full CRUD on all collections)
  - [ ] Test super user access (limited CRUD)
  - [ ] Test regular user access (read-only with exceptions)
  - [ ] Test unauthenticated access (should be denied)

- [ ] **Authentication**:
  - [ ] Password change flow tested and working
  - [ ] Session timeout configured (24 hours)
  - [ ] Email/password validation working
  - [ ] Error messages don't leak sensitive info

- [ ] **Data Validation**:
  - [ ] All user inputs validated on client and server
  - [ ] SQL injection prevention (N/A for Firestore, but check user input sanitization)
  - [ ] XSS prevention in user-generated content

## Code Quality

- [ ] **Remove Debug Code**:
  - [ ] No console.log in production code (or wrapped in __DEV__)
  - [ ] No TODO/FIXME comments for critical issues
  - [ ] No commented-out code blocks

- [ ] **Testing**:
  - [ ] All unit tests pass: `npm test`
  - [ ] Test coverage ≥ 70%: `npm run test:coverage`
  - [ ] Manual testing of critical flows completed
  - [ ] Role-based permissions tested for each role

- [ ] **Performance**:
  - [ ] No memory leaks detected
  - [ ] App loads in < 3 seconds on test devices
  - [ ] Offline mode works correctly
  - [ ] Sync conflict resolution tested

## Configuration

- [ ] **Environment Variables**:
  - [ ] Firebase credentials configured
  - [ ] Production API keys (not development keys)
  - [ ] All sensitive data in environment variables, not hardcoded

- [ ] **App Configuration**:
  - [ ] Version number updated in app.json and package.json
  - [ ] Bundle identifier correct for production
  - [ ] App name and icons set
  - [ ] RTL support enabled for Hebrew

## Build

- [ ] **Android**:
  - [ ] EAS build profile set to "production"
  - [ ] AAB generated: `eas build --platform android --profile production`
  - [ ] Signing configured correctly
  - [ ] Test on physical Android device

- [ ] **iOS** (if applicable):
  - [ ] EAS build profile set to "production"
  - [ ] IPA generated: `eas build --platform ios --profile production`
  - [ ] Signing configured correctly
  - [ ] Test on physical iOS device

## Firebase Configuration

- [ ] **Firestore**:
  - [ ] Security rules deployed: `firebase deploy --only firestore:rules`
  - [ ] Indexes created for performance
  - [ ] Backup strategy in place

- [ ] **Authentication**:
  - [ ] Email/password provider enabled
  - [ ] Password reset email template configured (Hebrew)
  - [ ] Authorized domains configured

## User Acceptance Testing

- [ ] **Admin Flow**:
  - [ ] Can create/edit/delete users
  - [ ] Can assign roles
  - [ ] Can create/edit/delete groups
  - [ ] Can create/edit/delete games
  - [ ] Dashboard access works

- [ ] **Super User Flow**:
  - [ ] Can create groups
  - [ ] Can create games
  - [ ] Cannot edit users
  - [ ] Cannot delete others' groups
  - [ ] Limited dashboard access

- [ ] **Regular User Flow**:
  - [ ] Can view games they participated in
  - [ ] Can view statistics
  - [ ] Cannot create groups
  - [ ] Cannot access admin functions

- [ ] **Game Flow**:
  - [ ] Create new game
  - [ ] Add/remove players
  - [ ] Update chip counts
  - [ ] End game and calculate results
  - [ ] View payment calculations
  - [ ] Mark game as completed

- [ ] **Offline Mode**:
  - [ ] Game saves locally when offline
  - [ ] Syncs when reconnected
  - [ ] Conflict resolution works correctly

## Post-Deployment

- [ ] **Monitoring**:
  - [ ] Firebase Analytics configured
  - [ ] Error tracking set up (Sentry or equivalent)
  - [ ] Performance monitoring enabled

- [ ] **User Communication**:
  - [ ] Release notes prepared (Hebrew)
  - [ ] Users notified of new version
  - [ ] Support contact information available

- [ ] **Rollback Plan**:
  - [ ] Previous version APK/AAB saved
  - [ ] Database backup taken before migration
  - [ ] Rollback procedure documented

## Sign-Off

- [ ] Technical lead approval
- [ ] Product owner approval
- [ ] Security review completed
- [ ] User acceptance testing passed

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: _______________
```

**Step 3: Document calculation API**

```markdown
// Create: docs/API.md

# Calculation Module API

## Overview

The calculation module (`src/calculations/`) provides a modular, cacheable calculation layer for poker game statistics and results.

All calculation functions return a `CalculationResult<T>` wrapper:

```typescript
interface CalculationResult<T> {
  data: T;
  metadata: {
    executionTimeMs: number;
    cached: boolean;
    dataSource: string;
  };
}
```

---

## Player Statistics

### `calculatePlayerStats(params: PlayerStatsParams): CalculationResult<PlayerStats>`

Calculate comprehensive statistics for a single player.

**Parameters**:
```typescript
interface PlayerStatsParams {
  userId: string;
  games: Game[];
  groupId?: string; // Optional: filter by group
}
```

**Returns**:
```typescript
interface PlayerStats {
  userId: string;
  totalGames: number;
  totalProfit: number;
  totalWins: number;
  totalLosses: number;
  winRate: number; // Percentage (0-100)
  averageProfit: number;
  biggestWin: number;
  biggestLoss: number;
  gamesWon: number;
  gamesLost: number;
}
```

**Example**:
```typescript
import { calculatePlayerStats } from '@/calculations/player/stats';

const result = calculatePlayerStats({
  userId: 'user123',
  games: allGames
});

console.log(result.data.totalProfit); // 250
console.log(result.metadata.executionTimeMs); // 5
console.log(result.metadata.cached); // false
```

---

## Game Results

### `calculateGameResults(params: GameResultsParams): CalculationResult<GameResults>`

Calculate results and payments for a completed game.

**Parameters**:
```typescript
interface GameResultsParams {
  players: PlayerInGame[];
  buyIn: { chips: number; amount: number };
  rebuy: { chips: number; amount: number };
}
```

**Returns**:
```typescript
interface GameResults {
  totalChips: number;
  totalInvestment: number;
  players: Array<{
    userId: string;
    name: string;
    chipsAmount: number;
    rebuyCount: number;
    totalInvestment: number;
    profit: number;
  }>;
}
```

**Example**:
```typescript
import { calculateGameResults } from '@/calculations/game/results';

const result = calculateGameResults({
  players: [
    { userId: 'user1', name: 'Player 1', chipsAmount: 1500 },
    { userId: 'user2', name: 'Player 2', chipsAmount: 500 }
  ],
  buyIn: { chips: 1000, amount: 100 },
  rebuy: { chips: 0, amount: 0 }
});

console.log(result.data.players[0].profit); // 50
console.log(result.data.players[1].profit); // -50
```

---

## Cache Management

### `CacheManager`

The cache manager provides category-based caching with automatic invalidation.

**Usage**:
```typescript
import { CacheManager } from '@/calculations/cache/CacheManager';

// Get cached value
const cached = CacheManager.get('player_stats', 'user123');

// Set cached value
CacheManager.set('player_stats', 'user123', calculatedData);

// Invalidate specific category
CacheManager.invalidateCategory('player_stats');

// Clear all cache
CacheManager.clear();
```

**Categories**:
- `'player_stats'`: Player statistics
- `'game_results'`: Game results and payments
- `'financial'`: Financial calculations
- `'trends'`: Time-based trend analysis

---

## Error Handling

All calculation functions are wrapped in try-catch. Errors are logged but don't throw (return default/empty data).

**Example**:
```typescript
const result = calculatePlayerStats({ userId: 'invalid', games: [] });
// result.data = { totalGames: 0, totalProfit: 0, ... }
// Logs error but doesn't crash
```

---

## Performance Considerations

- First call: Calculation performed, result cached
- Subsequent calls: Cached result returned (< 1ms)
- Cache invalidation: Triggered by data changes (e.g., new game added)
- Cache expiry: 24 hours (configurable)

**Benchmarks** (measured on mid-range device):
- Player stats (100 games): ~15ms (uncached), < 1ms (cached)
- Game results (10 players): ~5ms (uncached), < 1ms (cached)
- Financial trends (50 games): ~20ms (uncached), < 1ms (cached)
```

**Step 4: Improve error messages throughout the app**

Add context to error messages:

```typescript
// Example: In GameContext.tsx

// OLD:
// throw new Error('Failed to save game');

// NEW:
throw new Error(`Failed to save game ${gameId}: ${error.message}. Please check your internet connection and try again.`);
```

**Step 5: Commit**

```bash
git add docs/
git commit -m "docs: add comprehensive API and schema documentation

- Document complete Firestore schema with field descriptions
- Add security rules documentation
- Create deployment checklist for production
- Document calculation module API with examples
- Add migration notes for schema changes
- Improve error messages with context and troubleshooting

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Risks & Mitigations

| Risk | Probability (1-5) | Impact (1-5) | Score | Mitigation |
|------|-------------------|--------------|-------|------------|
| Firestore rules break existing functionality | 3 | 5 | 15 | Test with emulator before deploy, gradual rollout |
| Data sync conflict resolution confuses users | 2 | 3 | 6 | Clear UI with visual diff, user testing before release |
| Migration breaks calculation accuracy | 2 | 5 | 10 | Comprehensive tests comparing old vs new, gradual migration |
| Test suite has insufficient coverage | 3 | 3 | 9 | Start with critical paths, iterate coverage to 70%+ |
| Role management UI has permission bypass | 2 | 5 | 10 | Backend validation, security audit, penetration testing |
| Removal of debug code breaks dev workflow | 1 | 2 | 2 | Use __DEV__ checks, logging utility for dev mode |

---

## Success Criteria

**Phase 1 (Security)**:
- [ ] Firestore rules enforce role-based access (tested with emulator)
- [ ] Admin is only role that can change user roles
- [ ] Data sync conflicts show visual diff and allow informed choice
- [ ] Password change flow works end-to-end
- [ ] No security vulnerabilities in production

**Phase 2 (Role Management)**:
- [ ] Admin can assign roles via UI
- [ ] Role changes are validated (cannot change own role, cannot remove last admin)
- [ ] Role permissions are enforced in both UI and Firestore
- [ ] User sees clear role descriptions when assigned

**Phase 3 (Testing)**:
- [ ] Test coverage ≥ 70% for calculation module
- [ ] All critical game flows have integration tests
- [ ] CI/CD runs tests on every commit
- [ ] Tests catch regressions before deployment

**Phase 4 (Migration)**:
- [ ] All old calculation code removed
- [ ] New calculation module fully integrated
- [ ] No regressions in calculation accuracy
- [ ] Debug code removed from production build
- [ ] All magic numbers extracted to constants

**Phase 5 (Documentation)**:
- [ ] Firestore schema fully documented
- [ ] Deployment checklist created and tested
- [ ] API documentation complete with examples
- [ ] Error messages are clear and actionable

---

## Confidence Score: 8/10

**Factors for high confidence:**
- Clear file:line references for all changes
- Comprehensive test strategy with specific test cases
- Incremental approach with validation at each step
- Existing codebase patterns well-documented in memory
- User requirements clearly articulated

**Factors that could improve confidence to 9/10:**
- User testing of conflict resolution UI before deployment
- Security audit of Firestore rules by independent reviewer
- Load testing of calculation module with production data volume

---

## Execution Options

### Option 1: Subagent-Driven Execution (Recommended)
Fresh subagent per task, review between tasks, fast iteration. Claude manages the entire workflow.

### Option 2: Manual Step-by-Step
Follow plan task-by-task, run tests after each step, commit frequently.

**Which approach would you like to use?**

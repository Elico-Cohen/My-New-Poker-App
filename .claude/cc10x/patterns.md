# Project Patterns

## Architecture Patterns

### Data Management Architecture
- **Centralized Store**: AppStore.ts maintains single source of truth for users, groups, games, payment units
- **Real-Time Sync**: SyncService.ts listens to Firebase changes and updates AppStore
- **Hooks Layer**: useAppStore.ts provides React hooks for components to access store data
- **Benefits**: Reduced Firebase calls, consistent data across app, automatic real-time updates

### Context Providers
- **AuthContext**: Authentication state, user profile, permission checks
- **GameContext**: Active game state, auto-save logic, offline support
- **Pattern**: Centralized state management with provider pattern

### Permission System
```typescript
Roles: 'admin' | 'super' | 'regular'
- Admin: Full access to everything
- Super: Can create/manage games, limited dashboard access
- Regular: View-only access, can participate in games
```

## Code Conventions

### File Structure
```
src/
├── app/              # Expo Router screens
│   ├── (tabs)/      # Tab navigation screens
│   ├── dashboard/   # Admin dashboard
│   ├── gameFlow/    # Game flow screens
│   ├── history/     # Game history
│   └── statistics/  # Statistics screens
├── calculations/    # NEW modular calculation layer
│   ├── core/        # Types, constants, utils
│   ├── cache/       # CacheManager
│   ├── player/      # Player stats, ranking
│   ├── game/        # Game results, payments
│   ├── financial/   # Money flow calculations
│   ├── distributions/ # Profit distributions
│   ├── time/        # Trend analysis
│   └── legacy/      # Bridge to old code
├── components/      # Reusable UI components
├── contexts/        # React contexts
├── hooks/           # Custom hooks
├── models/          # TypeScript interfaces
├── services/        # Firebase/API services
├── store/           # AppStore + SyncService
├── theme/           # Colors, typography, icons
└── utils/           # Utility functions (OLD - being migrated)
```

### Naming Conventions
- **Components**: PascalCase (e.g., `GameManagement.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useAppStore.ts`)
- **Services**: camelCase (e.g., `gameSnapshot.ts`)
- **Types**: PascalCase (e.g., `UserProfile`, `GameStatus`)
- **Files**: kebab-case for utilities, PascalCase for components

### Import Aliases
```typescript
@/ → src/
Example: import { useAuth } from '@/contexts/AuthContext';
```

## Testing Patterns

**CRITICAL GAP**: No test files found in src/ directory

### Expected Test Structure (Not Implemented)
```
src/calculations/__tests__/
src/components/__tests__/
src/services/__tests__/
```

## Common Gotchas

### 1. Firebase Authentication UID Mismatch
- **Issue**: Users may have different Firebase Auth UIDs on different devices
- **Solution**: Fallback search by email if authUid not found
- **Location**: AuthContext.tsx lines 183-245, 348-382

### 2. Game Save Race Conditions
- **Issue**: Multiple concurrent save operations can cause conflicts
- **Solution**: Use `isSavingRef` and `activeSavePromiseRef` to prevent concurrent saves
- **Location**: GameContext.tsx lines 254-256, 556-568

### 3. Saved Icon Stuck
- **Issue**: Status reset timeout wasn't being cleared properly
- **Solution**: Use ref to track timeout, clear in all cleanup paths
- **Location**: GameContext.tsx statusResetTimeoutRef

### 4. RTL Layout Issues
- **Issue**: Hebrew text and icons not aligned properly
- **Solution**: Use Expo's built-in expo-localization + Android manifest configuration
- **Location**: app.config.js lines 4-14

### 5. Session Expiration During Active Game
- **Issue**: 24-hour session timeout can log out users mid-game
- **Solution**: waitForActiveSaves before logout, check session before critical operations
- **Location**: AuthContext.tsx lines 443-489

### 6. Network Reconnection Sync Spam
- **Issue**: Network listeners can trigger excessive sync attempts
- **Solution**: 5-second cooldown using ref to avoid state updates
- **Location**: GameContext.tsx lastNetworkSyncTimeRef, lines 250-327

## API Patterns

### Firebase Collection Structure
```
users/
  {userId}/
    - authUid: string
    - name: string
    - email: string
    - role: 'admin' | 'super' | 'regular'
    - isActive: boolean
    - paymentUnitId?: string

groups/
  {groupId}/
    - name: string
    - buyIn: { chips, amount }
    - rebuy: { chips, amount }
    - permanentPlayers: string[]
    - useRoundingRule: boolean

games/
  {gameId}/
    - groupId: string
    - status: GameStatus
    - players: PlayerInGame[]
    - totalWins/totalLosses: number
    - createdBy: string
    - date: GameDate

paymentUnits/
  {unitId}/
    - name: string
    - members: string[]
```

### Calculation Function Pattern
```typescript
// NEW pattern (calculations module)
interface CalculationResult<T> {
  data: T;
  metadata: {
    executionTimeMs: number;
    cached: boolean;
    dataSource: string;
  };
}

function calculatePlayerStats(params: PlayerStatsParams): CalculationResult<PlayerStats>
```

## Error Handling

### Authentication Errors
```typescript
// Hebrew error messages with specific codes
'auth/user-not-found' → 'אימייל או סיסמה שגויים'
'auth/wrong-password' → 'אימייל או סיסמה שגויים'
'auth/network-request-failed' → 'בעיית חיבור לאינטרנט'
```

### Game Save Errors
```typescript
// Automatic recovery for deleted games
if (error.message.includes('No document to update')) {
  // Auto-create new document with same data
}
```

### Firestore Permission Errors
```typescript
// Non-critical handling - wait for network
if (error.includes('Missing or insufficient permissions')) {
  // Show temporary error, retry after 5s
  // Don't log out user
}
```

## Dependencies

### Core
- **React Native**: 0.76.6
- **Expo**: ~52.0.27
- **Firebase**: ^11.2.0
- **TypeScript**: ~5.3.3

### Navigation
- **expo-router**: ~4.0.17

### Storage
- **@react-native-async-storage/async-storage**: 1.23.1
- **expo-secure-store**: ^14.0.1

### Firebase
- **@react-native-firebase/app**: ^21.7.1
- **@react-native-firebase/firestore**: ^21.7.1

### Utilities
- **@react-native-community/netinfo**: ^11.4.1
- **expo-localization**: ~16.0.1 (for RTL support)

## Performance Optimizations

### 1. Calculation Caching
- CacheManager with category-based invalidation
- Prevents redundant expensive calculations
- Location: `src/calculations/cache/CacheManager.ts`

### 2. Debounced Auto-Save
- 500ms debounce for existing games
- 1000ms debounce for new games (prevent duplicate creation)
- Location: GameContext.tsx AUTO_SAVE_DEBOUNCE

### 3. Network Sync Cooldown
- 5-second cooldown prevents sync spam
- Uses ref to avoid triggering re-renders
- Location: GameContext.tsx NETWORK_SYNC_COOLDOWN

### 4. Centralized Data Store
- Reduces Firebase queries from N to 1 per collection
- Real-time listeners on collections, not individual documents
- Location: AppStore.ts + SyncService.ts

## Security Patterns

### Role-Based Access Control
```typescript
// Permission check functions in AuthContext
hasPermission(requiredRole: UserRole | UserRole[]): boolean
canDeleteEntity(entityType): boolean
canManageEntity(entityType): boolean
canStartNewGame(): boolean
canAccessDashboard(): boolean
canManageGame(gameData): boolean
```

### Current Issues
- **CRITICAL**: Firestore rules are temporarily permissive
- All authenticated users can read/write all collections
- TODO comments indicate need for proper implementation
- Location: firestore.rules

## Deployment Configuration

### Build Profiles (eas.json)
- **preview**: APK for testing/personal use
- **production**: AAB for Google Play Store
- **development**: Development builds with live reload

### RTL Configuration
- Expo plugin: expo-localization
- Android manifest: supportsRtl="true" via app.config.js
- App config: supportsRTL + forcesRTL flags

### Version Management
- Current: 1.0.0
- Pattern: Semantic versioning (MAJOR.MINOR.PATCH)
- Location: app.json, package.json

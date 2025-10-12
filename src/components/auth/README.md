# רכיבי הרשאות (Authorization Components)

מערכת רכיבי העזר לניהול הרשאות משתמשים באפליקציית הפוקר.

## רכיבים זמינים

### 1. ProtectedRoute
רכיב לעטיפת דפים בהגבלות הרשאה.

```tsx
import ProtectedRoute from '@/components/auth/ProtectedRoute';

<ProtectedRoute requiredRole="admin">
  <AdminOnlyContent />
</ProtectedRoute>

// עם מצב קריאה בלבד
<ProtectedRoute requiredRole={["admin", "super"]} allowReadOnlyMode>
  <GameManagement />
</ProtectedRoute>
```

### 2. PermissionGuard
רכיב לעטיפת תוכן ספציפי בהתאם להרשאות.

```tsx
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// בדיקת תפקיד
<PermissionGuard requiredRole="admin">
  <AdminButton />
</PermissionGuard>

// בדיקה מותאמת
<PermissionGuard 
  checkPermission={() => canStartNewGame()}
  fallback={<DisabledButton />}
>
  <NewGameButton />
</PermissionGuard>
```

### 3. ReadOnlyIndicator
מציג התראה במצב קריאה בלבד.

```tsx
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';

function GameScreen() {
  return (
    <View>
      <Header />
      <ReadOnlyIndicator />
      <GameContent />
    </View>
  );
}
```

## Hooks זמינים

### 1. useUserRole
בדיקות תפקיד משתמש.

```tsx
import { useUserRole } from '@/hooks/useUserRole';

function Component() {
  const { userRole, isAdmin, isSuperUser, hasMinimumRole } = useUserRole();
  
  if (isAdmin()) {
    return <AdminContent />;
  }
  
  if (hasMinimumRole('super')) {
    return <SuperUserContent />;
  }
  
  return <RegularUserContent />;
}
```

### 2. useCan
בדיקות הרשאה ספציפיות.

```tsx
import { useCan } from '@/hooks/useCan';

function Component() {
  const can = useCan();
  
  return (
    <View>
      {can.startNewGame() && <NewGameButton />}
      {can.accessDashboard() && <DashboardLink />}
    </View>
  );
}
```

### 3. useReadOnlyMode
בדיקת מצב קריאה בלבד.

```tsx
import { useReadOnlyMode } from '@/components/auth/ProtectedRoute';

function EditableComponent() {
  const { isReadOnlyMode } = useReadOnlyMode();
  
  return (
    <TextInput 
      value={value}
      onChangeText={isReadOnlyMode ? undefined : setValue}
      editable={!isReadOnlyMode}
    />
  );
}
```

## תפקידי משתמש

- **admin** - מנהל מערכת, הרשאות מלאות
- **super** - סופר יוזר, יכול לנהל משחקים שיצר
- **regular** - משתמש רגיל, צפייה בלבד

## דוגמאות שימוש

### מסך עם הגבלות הרשאה
```tsx
function GameManagement() {
  const { isReadOnlyMode } = useReadOnlyMode();
  const can = useCan();
  
  return (
    <ProtectedRoute requiredRole={["admin", "super"]} allowReadOnlyMode>
      <View>
        <Header />
        <ReadOnlyIndicator />
        
        <PermissionGuard checkPermission={() => can.addPlayerToGame(gameData)}>
          <AddPlayerButton />
        </PermissionGuard>
        
        <PlayersList readOnly={isReadOnlyMode} />
      </View>
    </ProtectedRoute>
  );
}
```

### כפתור עם הרשאות
```tsx
function NewGameButton() {
  const can = useCan();
  
  return (
    <PermissionGuard
      checkPermission={() => can.startNewGame()}
      fallback={
        <DisabledButton 
          text="התחל משחק חדש (נדרשת הרשאה)"
          onPress={() => showPermissionAlert()}
        />
      }
    >
      <Button 
        title="התחל משחק חדש"
        onPress={() => router.push('/newGame')}
      />
    </PermissionGuard>
  );
}
``` 
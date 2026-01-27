import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { HandoffEvent } from '@/models/Game';
import { getUserById } from './users';

/**
 * Hand off game ownership to another user
 *
 * @param gameId - ID of the game to hand off
 * @param currentOwnerAuthUid - Auth UID of current owner
 * @param newOwnerAuthUid - Auth UID of new owner
 * @param initiatorAuthUid - Auth UID of user initiating the handoff
 * @param initiatorRole - Role of user initiating handoff (for validation)
 * @param reason - Optional reason for handoff
 * @throws Error if validation fails or update fails
 */
export async function handoffGame(
  gameId: string,
  currentOwnerAuthUid: string,
  newOwnerAuthUid: string,
  initiatorAuthUid: string,
  initiatorRole: 'admin' | 'super' | 'regular',
  reason?: string
): Promise<void> {
  // 1. Validate game exists and get current data
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('המשחק לא נמצא');
  }

  const gameData = gameSnap.data();

  // 2. Validate game status is not completed
  if (gameData.status === 'completed') {
    throw new Error('לא ניתן להעביר שליטה במשחק שהסתיים');
  }

  // 3. Validate permissions
  // Admin can hand off any game
  // Super user can hand off only games they created
  const isAdmin = initiatorRole === 'admin';
  const isOwner = gameData.createdBy === initiatorAuthUid;

  if (!isAdmin && !isOwner) {
    throw new Error('אין לך הרשאה להעביר שליטה במשחק');
  }

  // 4. Validate current owner matches (unless admin override)
  if (!isAdmin && gameData.createdBy !== currentOwnerAuthUid) {
    throw new Error('בעלים נוכחי לא תואם');
  }

  // 5. Get user profiles for from/to users (for names in log)
  const fromUserProfile = await getUserById(gameData.createdBy || currentOwnerAuthUid);
  if (!fromUserProfile) {
    throw new Error('פרופיל הבעלים הנוכחי לא נמצא');
  }

  // Find new owner by authUid
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('authUid', '==', newOwnerAuthUid));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('המשתמש החדש לא נמצא');
  }

  const toUserDoc = querySnapshot.docs[0];
  const toUserData = toUserDoc.data();
  const toUserProfile = {
    id: toUserDoc.id,
    name: toUserData.name as string,
    role: toUserData.role as string,
    isActive: toUserData.isActive as boolean,
    authUid: toUserData.authUid as string | undefined
  };

  // 6. Validate new owner is eligible (admin or super, and active)
  if (toUserProfile.role !== 'admin' && toUserProfile.role !== 'super') {
    throw new Error('המשתמש הנבחר לא יכול לקבל שליטה (רק מנהל או משתמש על)');
  }

  if (!toUserProfile.isActive) {
    throw new Error('המשתמש הנבחר לא פעיל');
  }

  // 7. Create handoff log entry
  const handoffEvent: HandoffEvent = {
    id: `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromUserId: fromUserProfile.id,
    fromUserName: fromUserProfile.name,
    fromAuthUid: fromUserProfile.authUid || currentOwnerAuthUid,
    toUserId: toUserProfile.id,
    toUserName: toUserProfile.name,
    toAuthUid: newOwnerAuthUid,
    timestamp: Date.now(),
    reason: reason || undefined,
    initiatedBy: initiatorAuthUid
  };

  // 8. Update game document
  const updates: any = {
    createdBy: newOwnerAuthUid,
    updatedAt: Date.now(),
    handoffLog: [...(gameData.handoffLog || []), handoffEvent]
  };

  // Set originalCreatedBy if this is the first handoff
  if (!gameData.originalCreatedBy) {
    updates.originalCreatedBy = currentOwnerAuthUid;
  }

  // 9. Sync to Firestore
  try {
    await updateDoc(gameRef, updates);
    console.log('Game handoff successful:', {
      gameId,
      from: fromUserProfile.name,
      to: toUserProfile.name,
      reason
    });
  } catch (error) {
    console.error('Failed to update game during handoff:', error);
    throw new Error('שגיאה בשמירת ההעברה. נסה שוב.');
  }
}

/**
 * Get handoff history for a game
 *
 * @param gameId - ID of the game
 * @returns Array of handoff events, or empty array if no handoffs
 */
export async function getHandoffHistory(gameId: string): Promise<HandoffEvent[]> {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    return [];
  }

  const gameData = gameSnap.data();
  return gameData.handoffLog || [];
}

/**
 * Get the original creator of a game
 *
 * @param gameId - ID of the game
 * @returns Original creator's authUid, or current createdBy if no handoffs occurred
 */
export async function getOriginalCreator(gameId: string): Promise<string | null> {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    return null;
  }

  const gameData = gameSnap.data();
  return gameData.originalCreatedBy || gameData.createdBy || null;
}

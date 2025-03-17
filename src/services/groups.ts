import { collection, doc, getDocs, addDoc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Group, ChipsConfig } from '@/models/Group';
import { auth } from '@/config/firebase';

// Collection reference
const groupsCollection = collection(db, 'groups');

// Get all active groups
export const getAllActiveGroups = async (): Promise<Group[]> => {
  // בדיקה אם המשתמש מחובר
  if (!auth.currentUser) {
    console.warn('User not authenticated when trying to get groups');
    return []; // החזרת מערך ריק במקום לזרוק שגיאה
  }

  const q = query(groupsCollection, where('isActive', '==', true));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Group));
};

// Get a single group by ID
export const getGroupById = async (groupId: string): Promise<Group | null> => {
    const docRef = doc(db, 'groups', groupId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Group;
  };

// Create a new group
export const createGroup = async (groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = Date.now();
  const newGroup = {
    ...groupData,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(groupsCollection, newGroup);
  return docRef.id;
};

// Update a group
export const updateGroup = async (groupId: string, groupData: Partial<Group>): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    ...groupData,
    updatedAt: Date.now()
  });
};

// Soft delete a group (mark as inactive)
export const deleteGroup = async (groupId: string): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    isActive: false,
    updatedAt: Date.now()
  });
};

// Add player to group
export const addPlayerToGroup = async (groupId: string, playerId: string, isPermanent: boolean): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  const arrayField = isPermanent ? 'permanentPlayers' : 'guestPlayers';
  
  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  
  const players = isPermanent ? [...group.permanentPlayers] : [...group.guestPlayers];
  if (!players.includes(playerId)) {
    players.push(playerId);
    
    await updateDoc(groupRef, {
      [arrayField]: players,
      updatedAt: Date.now()
    });
  }
};

// Remove player from group
export const removePlayerFromGroup = async (groupId: string, playerId: string): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  
  const permanentPlayers = group.permanentPlayers.filter(id => id !== playerId);
  const guestPlayers = group.guestPlayers.filter(id => id !== playerId);
  
  await updateDoc(groupRef, {
    permanentPlayers,
    guestPlayers,
    updatedAt: Date.now()
  });
};

// Get all players in a group
export const getGroupPlayers = async (groupId: string): Promise<{ permanent: string[], guests: string[] }> => {
  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  
  return {
    permanent: group.permanentPlayers,
    guests: group.guestPlayers
  };
};

// Add this new function:
export const changePlayerStatus = async (groupId: string, playerId: string, makePermament: boolean): Promise<void> => {
    const groupRef = doc(db, 'groups', groupId);
    const group = await getGroupById(groupId);
    if (!group) throw new Error('Group not found');
  
    // Create new arrays removing the player from both lists
    const permanentPlayers = group.permanentPlayers.filter(id => id !== playerId);
    const guestPlayers = group.guestPlayers.filter(id => id !== playerId);
  
    // Add the player to the appropriate list
    if (makePermament) {
      permanentPlayers.push(playerId);
    } else {
      guestPlayers.push(playerId);
    }
  
    // Update the group
    await updateDoc(groupRef, {
      permanentPlayers,
      guestPlayers,
      updatedAt: Date.now()
    });
  };
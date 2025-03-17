// src/services/paymentUnits.ts

import { collection, doc, getDocs, addDoc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PaymentUnit } from '@/models/PaymentUnit';
import { updateUserPaymentUnit } from './users';

// Collection reference
const paymentUnitsCollection = collection(db, 'paymentUnits');

// Get all active payment units
export const getAllActivePaymentUnits = async (): Promise<PaymentUnit[]> => {
  const q = query(paymentUnitsCollection, where('isActive', '==', true));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as PaymentUnit));
};

// NEW FUNCTION: Get all payment units (both active and inactive)
export const getAllPaymentUnits = async (): Promise<PaymentUnit[]> => {
  const querySnapshot = await getDocs(paymentUnitsCollection);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as PaymentUnit));
};

// Get payment unit by ID
export const getPaymentUnitById = async (unitId: string): Promise<PaymentUnit | null> => {
  const docRef = doc(db, 'paymentUnits', unitId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as PaymentUnit;
};

// Create new payment unit
export const createPaymentUnit = async (
  unitData: Omit<PaymentUnit, 'id' | 'createdAt' | 'updatedAt'>,
  playerIds: string[]
): Promise<string> => {
  const now = Date.now();
  const newUnit = {
    ...unitData,
    players: playerIds,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(paymentUnitsCollection, newUnit);
  
  // Update payment unit ID for all players
  await Promise.all(
    playerIds.map(playerId => updateUserPaymentUnit(playerId, docRef.id))
  );
  
  return docRef.id;
};

// Update payment unit
export const updatePaymentUnit = async (
  unitId: string, 
  unitData: Partial<PaymentUnit>
): Promise<void> => {
  const unitRef = doc(db, 'paymentUnits', unitId);
  await updateDoc(unitRef, {
    ...unitData,
    updatedAt: Date.now()
  });
};

// Soft delete payment unit (mark as inactive)
export const deletePaymentUnit = async (unitId: string): Promise<void> => {
  const unit = await getPaymentUnitById(unitId);
  if (!unit) throw new Error('Payment unit not found');
  
  // Remove payment unit reference from all players
  await Promise.all(
    unit.players.map(playerId => updateUserPaymentUnit(playerId, null))
  );
  
  // Mark unit as inactive
  const unitRef = doc(db, 'paymentUnits', unitId);
  await updateDoc(unitRef, {
    isActive: false,
    updatedAt: Date.now()
  });
};

// Add player to payment unit
export const addPlayerToPaymentUnit = async (
  unitId: string, 
  playerId: string
): Promise<void> => {
  const unit = await getPaymentUnitById(unitId);
  if (!unit) throw new Error('Payment unit not found');
  
  // Add player to unit's players array
  if (!unit.players.includes(playerId)) {
    const updatedPlayers = [...unit.players, playerId];
    const unitRef = doc(db, 'paymentUnits', unitId);
    
    await updateDoc(unitRef, {
      players: updatedPlayers,
      updatedAt: Date.now()
    });
    
    // Update player's payment unit reference
    await updateUserPaymentUnit(playerId, unitId);
  }
};

// Remove player from payment unit
export const removePlayerFromPaymentUnit = async (
  unitId: string, 
  playerId: string
): Promise<void> => {
  const unit = await getPaymentUnitById(unitId);
  if (!unit) throw new Error('Payment unit not found');
    
  if (unit.players.includes(playerId)) {
    const unitRef = doc(db, 'paymentUnits', unitId);
      
    // Since a payment unit must have exactly 2 players,
    // if we remove one player, we need to remove both and deactivate the unit
    const allPlayers = [...unit.players];
      
    // Remove payment unit reference from all players
    await Promise.all(
      allPlayers.map(pid => updateUserPaymentUnit(pid, null))
    );
      
    // Deactivate the payment unit
    await updateDoc(unitRef, {
      players: [],
      isActive: false,
      updatedAt: Date.now()
    });
  }
};

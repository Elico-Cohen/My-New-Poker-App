// src/services/playerManagement/playerManagement.ts

import { getAllUsers, createUser } from '@/services/users';
import { addPlayerToGroup } from '@/services/groups';
import { UserProfile } from '@/models/UserProfile';

/**
 * נתוני שחקן חדש.
 */
export interface NewPlayerData {
  name: string;
  phone: string;
}

/**
 * בודקת אם שם השחקן כבר קיים במערכת.
 * @param name - שם השחקן לבדיקה.
 * @returns Promise שמחזירה true אם השם קיים, או false אחרת.
 */
export async function isPlayerNameExists(name: string): Promise<boolean> {
  const users: UserProfile[] = await getAllUsers();
  return users.some(user => user.name.toLowerCase() === name.trim().toLowerCase());
}

/**
 * יוצרת שחקן חדש במערכת ומוסיפה אותו לקבוצה כ"שחקן אורח".
 *
 * שלבים:
 * 1. בודקת אם שם השחקן כבר קיים – אם כן, זורקת שגיאה.
 * 2. יוצרת את המשתמש החדש באמצעות createUser.
 * 3. מוסיפה את השחקן לקבוצה באמצעות addPlayerToGroup, כאשר isPermanent מוגדר כ־false.
 * 4. מחזירה את מזהה המשתמש החדש.
 *
 * @param newPlayerData - נתוני השחקן החדש (שם, טלפון וכו').
 * @param groupId - מזהה הקבוצה שאליה יש להוסיף את השחקן.
 * @returns Promise שמחזירה את מזהה המשתמש החדש.
 * @throws Error אם השם כבר קיים במערכת.
 */
export async function createNewPlayerAndAddToGroup(
  newPlayerData: NewPlayerData,
  groupId: string
): Promise<string> {
  if (await isPlayerNameExists(newPlayerData.name)) {
    throw new Error('שם זה כבר קיים במערכת');
  }
  const newUser = {
    name: newPlayerData.name.trim(),
    phone: newPlayerData.phone.trim(),
    role: 'regular' as const,
    isActive: true,
  };
  const newUserId = await createUser(newUser);
  await addPlayerToGroup(groupId, newUserId, false);
  return newUserId;
}

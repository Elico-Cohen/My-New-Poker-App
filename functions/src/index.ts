/**
 * Cloud Functions for Poker App
 *
 * This function automatically updates a user's "role badge" (custom claims)
 * whenever their role is changed in the database.
 *
 * Think of it like this:
 * - When an admin changes someone's role (e.g., from "regular" to "super")
 * - This function notices the change
 * - And automatically updates that person's access badge
 * - So the security rules know what they're allowed to do
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

/**
 * This function runs automatically whenever a user document is updated
 * It checks if the role changed, and if so, updates the user's custom claims
 */
export const onUserRoleChange = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    const userId = context.params.userId;

    // Get the data before and after the change
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    // If document was deleted, nothing to do
    if (!afterData) {
      console.log(`User ${userId} was deleted, no custom claims to update`);
      return null;
    }

    // Get the user's Firebase Auth UID
    const authUid = afterData.authUid;
    if (!authUid) {
      console.log(`User ${userId} has no authUid, skipping custom claims update`);
      return null;
    }

    // Get the old and new roles
    const oldRole = beforeData?.role || null;
    const newRole = afterData.role;

    // If role didn't change, nothing to do
    if (oldRole === newRole) {
      console.log(`User ${userId} role unchanged (${newRole}), no update needed`);
      return null;
    }

    console.log(`User ${userId} role changed: ${oldRole} -> ${newRole}`);

    try {
      // Update the custom claims on the user's Firebase Auth account
      await admin.auth().setCustomUserClaims(authUid, {
        role: newRole,
      });

      console.log(`Successfully updated custom claims for user ${authUid} to role: ${newRole}`);

      // Optionally: Update a timestamp in the user document to signal that claims were updated
      // This can help the app know when to refresh the token
      await change.after.ref.update({
        claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    } catch (error) {
      console.error(`Error updating custom claims for user ${authUid}:`, error);
      throw error;
    }
  });

/**
 * This function runs when a new user is created
 * It sets their initial role custom claims
 */
export const onUserCreate = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;
    const userData = snapshot.data();

    const authUid = userData.authUid;
    if (!authUid) {
      console.log(`New user ${userId} has no authUid, skipping custom claims`);
      return null;
    }

    const role = userData.role || "regular";

    console.log(`New user ${userId} created with role: ${role}`);

    try {
      // Set the initial custom claims
      await admin.auth().setCustomUserClaims(authUid, {
        role: role,
      });

      console.log(`Successfully set initial custom claims for user ${authUid} to role: ${role}`);

      // Update the user document to mark that claims were set
      await snapshot.ref.update({
        claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    } catch (error) {
      console.error(`Error setting custom claims for new user ${authUid}:`, error);
      throw error;
    }
  });

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateExistingUserClaims = exports.onUserCreate = exports.onUserRoleChange = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
/**
 * This function runs automatically whenever a user document is updated
 * It checks if the role changed, and if so, updates the user's custom claims
 */
exports.onUserRoleChange = functions.firestore
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
    const oldRole = (beforeData === null || beforeData === void 0 ? void 0 : beforeData.role) || null;
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
    }
    catch (error) {
        console.error(`Error updating custom claims for user ${authUid}:`, error);
        throw error;
    }
});
/**
 * This function runs when a new user is created
 * It sets their initial role custom claims
 */
exports.onUserCreate = functions.firestore
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
    }
    catch (error) {
        console.error(`Error setting custom claims for new user ${authUid}:`, error);
        throw error;
    }
});
/**
 * ONE-TIME MIGRATION FUNCTION
 *
 * This function sets custom claims for ALL existing users who don't have them.
 * Run this once after deploying the new Firestore security rules.
 *
 * Call via: https://us-central1-mynewpokerapp.cloudfunctions.net/migrateExistingUserClaims
 *
 * After running successfully, you can delete this function.
 */
exports.migrateExistingUserClaims = functions.https.onRequest(async (req, res) => {
    // Only allow POST requests for safety
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed. Use POST to run migration.");
        return;
    }
    console.log("Starting migration of custom claims for existing users...");
    const results = {
        total: 0,
        success: 0,
        skipped: 0,
        failed: 0,
        details: [],
    };
    try {
        // Get all users from Firestore
        const usersSnapshot = await admin.firestore().collection("users").get();
        results.total = usersSnapshot.size;
        console.log(`Found ${results.total} users to process`);
        // Process each user
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const authUid = userData.authUid;
            const role = userData.role || "regular";
            // Skip users without authUid
            if (!authUid) {
                results.skipped++;
                results.details.push(`SKIPPED: ${userId} - no authUid`);
                console.log(`Skipping user ${userId}: no authUid`);
                continue;
            }
            try {
                // Check if user exists in Firebase Auth
                const authUser = await admin.auth().getUser(authUid);
                // Check if claims already exist
                const existingClaims = authUser.customClaims;
                if (existingClaims && existingClaims.role === role) {
                    results.skipped++;
                    results.details.push(`SKIPPED: ${userId} - already has correct claims (${role})`);
                    console.log(`Skipping user ${userId}: already has correct claims`);
                    continue;
                }
                // Set the custom claims
                await admin.auth().setCustomUserClaims(authUid, { role: role });
                // Update the user document to mark migration
                await userDoc.ref.update({
                    claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    claimsMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                results.success++;
                results.details.push(`SUCCESS: ${userId} (${userData.email}) - set role: ${role}`);
                console.log(`Successfully set claims for user ${userId} (${userData.email}): role=${role}`);
            }
            catch (userError) {
                results.failed++;
                const errorMsg = userError.message || "Unknown error";
                results.details.push(`FAILED: ${userId} - ${errorMsg}`);
                console.error(`Failed to set claims for user ${userId}:`, userError);
            }
        }
        // Log summary
        console.log("Migration completed!");
        console.log(`Total: ${results.total}, Success: ${results.success}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
        // Return results
        res.status(200).json({
            message: "Migration completed",
            summary: {
                total: results.total,
                success: results.success,
                skipped: results.skipped,
                failed: results.failed,
            },
            details: results.details,
        });
    }
    catch (error) {
        console.error("Migration failed:", error);
        res.status(500).json({
            message: "Migration failed",
            error: error.message,
        });
    }
});
//# sourceMappingURL=index.js.map
# Active Context

## Current Focus
Comprehensive implementation plan created for fixing all identified issues in MyNewPokerApp. Plan covers security, role management, data sync, testing, and code quality.

## Recent Changes
- 2026-01-22: Created comprehensive fixes implementation plan (docs/plans/2026-01-22-comprehensive-fixes-plan.md)
- 2026-01-22: Added explicit Android manifest RTL configuration via app.config.js (c53bcb0)
- Recent: Removed custom RTL plugin (using Expo's built-in solution) (c0e90ec)
- Recent: Fixed RTL layout and saved icon issues (e7e211c, 54e2222)
- Recent: Fixed saved icon stuck issue - properly clear status reset timeout (6ac9ea9)
- Previous: Fixed 4-5 critical stability/crash issues (7fee500, 09f32f6)
- Previous: Fixed critical memory leak causing crash after 2 hours (65b2aef)

## Next Steps
1. Review implementation plan at docs/plans/2026-01-22-comprehensive-fixes-plan.md
2. Choose execution approach (subagent-driven or manual step-by-step)
3. Execute Phase 1: Critical Security & Stability
4. Execute Phase 2: Role Management UI
5. Execute Phases 3-5 as priority allows

## Active Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Implementation Plan Structure | 5 phases: Security → Role Management → Testing → Migration → Documentation | Address critical issues first, build foundation for quality |
| Security Rules Priority | Implement role-based Firestore rules immediately | Currently permissive rules are blocking production |
| Conflict Resolution UX | Visual modal showing diff between versions | User reported confusion with basic alert, need clear comparison |
| Password Change Flow | Restore commented flow with dedicated screen | Security requirement - users need ability to change compromised passwords |
| Role Management UI | Admin-only dashboard for user role assignment | User's explicit requirement for super-user/regular-user management |
| Testing Strategy | Start with calculation module, 70% coverage target | No tests currently exist, calculations are most critical |
| Migration Approach | Test-driven migration with verification tests | Two calculation systems exist, need safe migration path |
| Configuration | Centralize all constants in src/config/constants.ts | Magic numbers scattered throughout, makes maintenance difficult |

## Plan Reference

**Implementation Plan:** `docs/plans/2026-01-22-comprehensive-fixes-plan.md`

**Plan Summary:**
- **Phase 1 (3-4 days)**: Critical Security & Stability
  - Task 1.1: Role-based Firestore security rules
  - Task 1.2: Improve data sync conflict resolution UX
  - Task 1.3: Restore password change flow

- **Phase 2 (2-3 days)**: Role Management UI
  - Task 2.1: Create user management dashboard with role assignment

- **Phase 3 (4-5 days)**: Testing Infrastructure
  - Task 3.1: Set up Jest testing framework
  - Task 3.2: Add integration tests for game flow

- **Phase 4 (3-4 days)**: Code Migration & Cleanup
  - Task 4.1: Complete calculation module migration
  - Task 4.2: Remove debug code and extract configuration

- **Phase 5 (2-3 days)**: Polish & Documentation
  - Task 5.1: Improve error messages and add comprehensive docs

**Total Estimated Time:** 14-19 days

**Confidence Score:** 8/10 for one-pass success

## Project Overview

**App Name:** MyNewPokerApp
**Platform:** React Native (Expo) with TypeScript
**Purpose:** Hebrew-language poker game management system with real-time sync, statistics tracking, and multi-user support
**Language:** Hebrew (RTL layout enabled)
**Database:** Firebase Firestore
**Authentication:** Firebase Auth

## Critical Issues Addressed

### User-Reported Issues
1. **Data Sync Conflicts** - App crash during game causes conflict, basic alert is confusing
   - Solution: Visual modal showing diff, clear comparison of local vs remote
   - File: src/components/ConflictResolutionModal.tsx (new)

2. **Role Management** - Need to assign super-users and regular users
   - Solution: Admin dashboard for role assignment with validation
   - File: src/app/dashboard/users.tsx (new)

### Security Issues (CRITICAL)
1. **Firestore Rules** - Currently permissive for all authenticated users
   - Solution: Role-based rules (admin/super/regular) with ownership checks
   - File: firestore.rules:1-38

2. **Password Change** - Flow commented out and disabled
   - Solution: Dedicated change-password screen with validation
   - File: src/app/change-password.tsx (new)

### Code Quality Issues
1. **No Test Coverage** - Zero unit/integration tests
   - Solution: Jest setup with 70% coverage target
   - Files: jest.config.js, src/calculations/__tests__/

2. **Incomplete Migration** - Old and new calculation code coexist
   - Solution: Test-driven migration with verification
   - Files: Multiple services updated to use new calculation module

3. **Debug Code** - console.log statements in production
   - Solution: Remove or wrap in __DEV__, create logging utility
   - File: src/utils/logger.ts (new)

4. **Magic Numbers** - Hardcoded configuration values
   - Solution: Centralized constants file
   - File: src/config/constants.ts (new)

## Learnings This Session

### Plan Design Patterns Applied
1. **Bite-sized tasks** - Each step is 2-5 minutes, specific action
2. **Context references** - All code changes reference file:line from existing codebase
3. **Risk assessment** - Probability × Impact scoring for each risk
4. **Success criteria** - Explicit checkboxes for each phase
5. **Confidence score** - 8/10 with clear factors listed

### User Requirements Analysis
- User reported past crash causing sync conflict with confusing UI
- User wants role management (admin assigns super-users and regular users)
- Current app has temporary permissive security rules with TODOs
- Password change flow was intentionally disabled during development

### Architecture Insights
- AppStore + SyncService pattern provides centralized data management
- GameContext handles auto-save with debouncing (500ms existing, 1000ms new games)
- Network sync has 5-second cooldown to prevent spam
- Role-based permissions exist in AuthContext but not enforced in Firestore

## Blockers / Issues

**NONE** - Plan is ready for execution. Waiting for user to choose execution approach.

## User Preferences Discovered
- Hebrew-first application (RTL layout required)
- Focus on real-time sync and offline capability
- Multi-user poker game management with statistics tracking
- Role-based permissions (admin, super user, regular)
- Clear visual feedback for data conflicts (not just basic alerts)
- Admin-only ability to assign roles to users

## Last Updated
2026-01-22 - Comprehensive implementation plan created and saved

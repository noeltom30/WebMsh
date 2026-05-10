# Software Engineering Test Plan

<p align="center">
   <img src="tests\images\webmsg-logo.png" alt="WebMsh Logo" width="380" />
</p>






| Submitted by: | Submitted to: |
|---|---|
| Irfanul Haque Raque  | Dr. Nandu C Nair  |
| BL.EN.U4CSE23070  | Department of CSE|
| B.Tech, 6th Semester  | 
| Department of CSE |  |



<div style="page-break-after: always;"></div>

---

## Table of Contents
- [1. Introduction](#1-introduction)
- [2. Objectives](#2-objectives)
- [3. Team Members](#3-team-members)
- [4. Scope](#4-scope)
- [5. Assumptions](#5-assumptions)
- [6. Risks](#6-risks)
- [7. Test Approach](#7-test-approach)
- [8. Test Automation](#8-test-automation)
- [9. Test Environment](#9-test-environment)
- [10. Test Schedule](#10-test-schedule)
- [11. Deliverables](#11-deliverables)
- [12. Assigned Module Description](#12-assigned-module-description)
- [13. Unit Test Cases](#13-unit-test-cases)
- [14. Integration Test Cases](#14-integration-test-cases)
- [15. System Test Cases](#15-system-test-cases)
- [16. Automation Scripts](#16-automation-scripts)
- [17. Execution Commands](#17-execution-commands)
- [18. Test Results](#18-test-results)
- [19. Conclusion](#19-conclusion)

## 1. Introduction
This document defines my QA responsibilities for frontend behavior in WebMsh, including API client correctness, auth state management, route protection, and UI behavior.

## 2. Objectives
- Validate frontend request construction and error handling.
- Verify auth context hydration and state transitions.
- Validate UI-level protected/guest route behavior.

## 3. Team Members
| Team Member | Role | Ownership |
|---|---|---|
| Shravan Sathiyanarayanan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant Kulkarni| QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfanul Haque Raque | QA Engineer | Frontend UI, API Integration, State Management |
| Noel Tom | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: `frontend/src/api.js`, `frontend/src/context/AuthContext.jsx`, route and home smoke checks.
- Out of Scope: backend password policy internals, DB cascade integrity, report artifact validation.

## 5. Assumptions
- Node modules are installed.
- Vitest + RTL environment is configured.
- Playwright Chromium is installed for browser-level checks.

## 6. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| UI flaky selectors | Medium | Use role-based stable selectors |
| Mock drift from backend contracts | High | Keep API assertions contract-aligned |
| Route guard regressions | High | Add integration tests around auth state |

## 7. Test Approach
- Unit: API helper logic and low-level client behavior.
- Integration: Auth context and route/auth interactions.
- System: browser smoke and visible UI guard behavior.

## 8. Test Automation
- Unit: `frontend/tests/Irfan/unit/test_irfan_unit_api.test.js` (4 tests)
- Integration: `frontend/tests/Irfan/integration/test_irfan_integration_authcontext.test.jsx` (5 tests)
- System: `frontend/tests/Irfan/system/test_irfan_system.spec.ts` (4 tests)

## 9. Test Environment
- OS: Windows 10
- Frontend: React 19 + Vite
- Tools: Vitest, RTL, Playwright

## 10. Test Schedule
| Phase | Duration | Output |
|---|---|---|
| Test design | 0.5 day | Coverage matrix |
| Scripting | 1 day | Frontend test suites |
| Execution | 0.5 day | Pass/fail and coverage summary |
| Evidence curation | 0.5 day | Screenshots + HTML report references |

## 11. Deliverables
- Test plan
- Frontend member test scripts
- Frontend execution logs and evidence references

## 12. Assigned Module Description
I validateed client-side correctness from API invocation to user-visible route/state behavior, ensuring reliable auth-aware UX behavior.

## 13. Unit Test Cases

Exporting very wide Markdown tables to PDF often clips the right columns (for example **Expected Result**). Each case below uses a narrow two-column layout so all fields print reliably.

### IRF-UT-001 — Request Method

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-UT-001 |
| Module Name | `api.js` |
| Test Type | Unit |
| Feature Name | Request Method |
| Objective | Validate signup uses POST |
| Preconditions | Vitest setup |
| Dependencies | Vitest / mock fetch |
| Priority | High |
| Severity | Major |
| Environment | Local FE |
| Test Data | Signup payload |
| Detailed Steps | Call `api.signup` with mocked fetch |
| Expected Result | Request method is POST |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### IRF-UT-002 — Error Shaping

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-UT-002 |
| Module Name | `api.js` |
| Test Type | Unit |
| Feature Name | Error Shaping |
| Objective | Validate non-2xx error object |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local FE |
| Test Data | 401 mock response |
| Detailed Steps | Call `api.me` and assert thrown error |
| Expected Result | Error contains status and body |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative |

### IRF-UT-003 — Endpoint Builder

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-UT-003 |
| Module Name | `api.js` |
| Test Type | Unit |
| Feature Name | Endpoint Builder |
| Objective | Validate dynamic project path |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Major |
| Environment | Local FE |
| Test Data | Project id |
| Detailed Steps | Call project operations and inspect URL |
| Expected Result | URL structure `/projects/{id}` is correct |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Validation |

### IRF-UT-004 — Local State

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-UT-004 |
| Module Name | Auth Context |
| Test Type | Unit |
| Feature Name | Local State |
| Objective | Verify user state set from refresh |
| Preconditions | Same as suite setup |
| Dependencies | RTL + context |
| Priority | Medium |
| Severity | Major |
| Environment | Local FE |
| Test Data | Mock user |
| Detailed Steps | Trigger refresh behavior |
| Expected Result | Context user state updated |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | State management |

![irfanUnit.png](tests\images\irfanUnit.png)

## 14. Integration Test Cases

### IRF-IT-001 — Hydration

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-IT-001 |
| Module Name | Auth Context |
| Test Type | Integration |
| Feature Name | Hydration |
| Objective | Populate user on app boot |
| Preconditions | Mocked `api.me` |
| Dependencies | RTL / Vitest |
| Priority | High |
| Severity | Critical |
| Environment | Local FE |
| Test Data | User object |
| Detailed Steps | Render `AuthProvider` and probe state |
| Expected Result | Email displayed from context |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### IRF-IT-002 — Signout

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-IT-002 |
| Module Name | Auth Context |
| Test Type | Integration |
| Feature Name | Signout |
| Objective | Clear user state on signout |
| Preconditions | Logged-in mock state |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local FE |
| Test Data | Mock logout |
| Detailed Steps | Invoke signOut and inspect state |
| Expected Result | User becomes null |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | State reset |

### IRF-IT-003 — Form Validation

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-IT-003 |
| Module Name | Auth Page |
| Test Type | Integration |
| Feature Name | Form Validation |
| Objective | Reject mismatched passwords |
| Preconditions | Render signup form |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Major |
| Environment | Local FE |
| Test Data | Mismatched passwords |
| Detailed Steps | Submit signup form |
| Expected Result | Error banner displayed; no API call |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative |

### IRF-IT-004 — Protected Route

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-IT-004 |
| Module Name | Router Guard |
| Test Type | Integration |
| Feature Name | Protected Route |
| Objective | Redirect unauthenticated users |
| Preconditions | user = null |
| Dependencies | react-router |
| Priority | High |
| Severity | Critical |
| Environment | Local FE |
| Test Data | Route `/profile` |
| Detailed Steps | Navigate without auth |
| Expected Result | Redirect to auth route |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Security |

### IRF-IT-005 — Guest Route

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-IT-005 |
| Module Name | Router Guard |
| Test Type | Integration |
| Feature Name | Guest Route |
| Objective | Redirect authenticated users away from auth |
| Preconditions | User set |
| Dependencies | react-router |
| Priority | Medium |
| Severity | Major |
| Environment | Local FE |
| Test Data | Route `/auth` |
| Detailed Steps | Navigate as authenticated user |
| Expected Result | Redirect to profile / workspace |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | UX policy |

![irfanInt.png](tests\images\irfanInt.png)

## 15. System Test Cases

### IRF-ST-001 — Branding Visibility

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-ST-001 |
| Module Name | Home UI |
| Test Type | System |
| Feature Name | Branding Visibility |
| Objective | Validate WebMsh branding appears |
| Preconditions | Vite server running |
| Dependencies | Playwright |
| Priority | High |
| Severity | Major |
| Environment | Chromium |
| Test Data | None |
| Detailed Steps | Open home page |
| Expected Result | Branding / nav visible |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Smoke |

### IRF-ST-002 — Page Metadata

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-ST-002 |
| Module Name | Home UI |
| Test Type | System |
| Feature Name | Page Metadata |
| Objective | Validate page title contains WebMsh |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Minor |
| Environment | Chromium |
| Test Data | None |
| Detailed Steps | Assert `toHaveTitle(/WebMsh/i)` |
| Expected Result | Title matches expected branding |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Browser check |

### IRF-ST-003 — Basic Route Reachability

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-ST-003 |
| Module Name | Route UX |
| Test Type | System |
| Feature Name | Basic Route Reachability |
| Objective | Ensure default route loads without crash |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Chromium |
| Test Data | None |
| Detailed Steps | Visit `/` and wait for stable DOM |
| Expected Result | No runtime crash; page interactive |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Stability |

### IRF-ST-004 — Link Visibility

| Attribute | Details |
| --- | --- |
| Test Case ID | IRF-ST-004 |
| Module Name | UI Behavior |
| Test Type | System |
| Feature Name | Link Visibility |
| Objective | Ensure brand link is visible / clickable |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Minor |
| Environment | Chromium |
| Test Data | None |
| Detailed Steps | Check role link `WebMsh` |
| Expected Result | Link visible and actionable |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Accessibility |

![irfanSys.png](tests\images\irfanSys.png)

![irfanSys2.png](tests\images\irfanSys2.png)

## 16. Automation Scripts
- `frontend/tests/Irfan/unit/test_irfan_unit_api.test.js`
- `frontend/tests/Irfan/integration/test_irfan_integration_authcontext.test.jsx`
- `frontend/tests/Irfan/system/test_irfan_system.spec.ts`

## 17. Execution Commands
```powershell
cd C:\Users\irfan\WebMsh\frontend
npx vitest run ./tests/Irfan/unit --config vitest.config.js
npx vitest run ./tests/Irfan/integration --config vitest.config.js
npx playwright test tests/Irfan/system/test_irfan_system.spec.ts --config playwright.config.ts
```

## 18. Test Results
- Planned: 13
- Executed: 13
- Passed: 13
- Failed: 0
- Blocked: 0

## 19. Conclusion
My scope validates frontend reliability at request, state, and route levels, ensuring consistent auth-aware behavior and stable baseline UI functionality.
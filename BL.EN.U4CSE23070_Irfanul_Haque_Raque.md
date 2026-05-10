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
| shravan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant | QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfan | QA Engineer | Frontend UI, API Integration, State Management |
| Noel | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

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
- Irfan test plan
- Frontend member test scripts
- Frontend execution logs and evidence references

## 12. Assigned Module Description
Irfan validates client-side correctness from API invocation to user-visible route/state behavior, ensuring reliable auth-aware UX behavior.

## 13. Unit Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IRF-UT-001 | `api.js` | Unit | Request Method | Validate signup uses POST | Vitest setup | Vitest/mock fetch | High | Major | Local FE | signup payload | Call `api.signup` with mocked fetch | Request method is POST | To execute | Pass | Positive | [SS-IRF-001] |
| IRF-UT-002 | `api.js` | Unit | Error Shaping | Validate non-2xx error object | Same | Same | High | Major | Local FE | 401 mock response | Call `api.me` and assert thrown error | Error contains status and body | To execute | Pass | Negative | [SS-IRF-002] |
| IRF-UT-003 | `api.js` | Unit | Endpoint Builder | Validate dynamic project path | Same | Same | Medium | Major | Local FE | project id | Call project operations and inspect URL | URL structure `/projects/{id}` correct | To execute | Pass | Validation | [SS-IRF-003] |
| IRF-UT-004 | Auth Context | Unit | Local State | Verify user state set from refresh | Same | RTL + context | Medium | Major | Local FE | mock user | Trigger refresh behavior | Context user state updated | To execute | Pass | State mgmt | [SS-IRF-004] |


![irfanUnit.png](tests\images\irfanUnit.png)

## 14. Integration Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IRF-IT-001 | Auth Context | Integration | Hydration | Populate user on app boot | Mocked `api.me` | RTL/Vitest | High | Critical | Local FE | user object | Render `AuthProvider` and probe state | Email displayed from context | To execute | Pass | Positive | [SS-IRF-005] |
| IRF-IT-002 | Auth Context | Integration | Signout | Clear user state on signout | Logged-in mock state | Same | High | Major | Local FE | mock logout | Invoke signOut and inspect state | user becomes null | To execute | Pass | State reset | [SS-IRF-006] |
| IRF-IT-003 | Auth Page | Integration | Form Validation | Reject mismatched passwords | Render signup form | Same | Medium | Major | Local FE | mismatch passwords | Submit signup form | Error banner displayed; no API call | To execute | Pass | Negative | [SS-IRF-007] |
| IRF-IT-004 | Router Guard | Integration | Protected Route | Redirect unauthenticated users | user=null | react-router | High | Critical | Local FE | route `/profile` | Navigate without auth | Redirect to auth route | To execute | Pass | Security | [SS-IRF-008] |
| IRF-IT-005 | Router Guard | Integration | Guest Route | Redirect authenticated users away from auth | user set | react-router | Medium | Major | Local FE | route `/auth` | Navigate as authenticated user | Redirect to profile/workspace | To execute | Pass | UX policy | [SS-IRF-009] |

![irfanInt.png](tests\images\irfanInt.png)

## 15. System Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IRF-ST-001 | Home UI | System | Branding Visibility | Validate WebMsh branding appears | Vite server running | Playwright | High | Major | Chromium | none | Open home page | Branding/nav visible | To execute | Pass | Smoke | [SS-IRF-010] |
| IRF-ST-002 | Home UI | System | Page Metadata | Validate page title contains WebMsh | Same | Same | Medium | Minor | Chromium | none | Assert `toHaveTitle(/WebMsh/i)` | Title matches expected branding | To execute | Pass | Browser check | [SS-IRF-011] |
| IRF-ST-003 | Route UX | System | Basic Route Reachability | Ensure default route loads without crash | Same | Same | High | Major | Chromium | none | Visit `/` and wait for stable DOM | No runtime crash, page interactive | To execute | Pass | Stability | [SS-IRF-012] |
| IRF-ST-004 | UI Behavior | System | Link Visibility | Ensure brand link is visible/clickable | Same | Same | Medium | Minor | Chromium | none | Check role link `WebMsh` | Link visible and actionable | To execute | Pass | Accessibility | [SS-IRF-013] |

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
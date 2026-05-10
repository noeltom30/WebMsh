# Software Engineering Test Plan

<p align="center">
   <img src="tests\images\webmsg-logo.png" alt="WebMsh Logo" width="380" />
</p>






| Submitted by: | Submitted to: |
|---|---|
| Noel Tom  | Dr. Nandu C Nair  |
| BL.EN.U4CSE23035  | Department of CSE|
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
This document defines my QA scope for WebMsh end-to-end system validation, cross-layer execution, evidence/report generation, and submission-grade proof collection.

## 2. Objectives
- Validate full workflow stability across backend and frontend layers.
- Verify execution/reporting toolchain setup and artifacts.
- Provide reproducible evidence collection for final evaluation.

## 3. Team Members
| Team Member | Role | Ownership |
|---|---|---|
| shravan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant | QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfan | QA Engineer | Frontend UI, API Integration, State Management |
| Noel | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: end-to-end smoke, config/report checks, cross-layer execution flow.
- Out of Scope: deep auth internals and isolated project model validators (owned by Members 1 and 2).

## 5. Assumptions
- Backend/frontend dependencies installed.
- Playwright browser binaries installed.
- Shared project repo structure unchanged.

## 6. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| E2E flakiness due to async page load | Medium | Explicit assertions and stable selectors |
| Environment-specific runtime differences | High | Standardized command execution and report capture |
| Missing report artifacts during grading | High | Enforce artifact path checks and evidence checklist |

## 7. Test Approach
- Unit: validate test tooling config assumptions.
- Integration: validate cross-component execution chain.
- System: execute browser smoke and capture report artifacts.

## 8. Test Automation
- Unit: `tests/Noel/unit/test_noel_unit_tooling.py` (4 tests)
- Integration: `tests/Noel/integration/test_noel_integration_crossflow.py` (5 tests)
- System: `tests/Noel/system/test_noel_system_api.py` (4 tests)

## 9. Test Environment
- OS: Windows 10
- Backend: FastAPI + SQLite + Pytest
- Frontend: React + Vite + Vitest + Playwright
- Browser: Chromium

## 10. Test Schedule
| Phase | Duration | Output |
|---|---|---|
| Toolchain setup | 0.5 day | Execution-ready environment |
| Cross-flow scripting | 1 day | E2E + reporting tests |
| Run + capture | 0.5 day | Logs and report artifacts |
| Consolidation | 0.5 day | Submission evidence checklist |

## 11. Deliverables
- Noel test plan
- Noel system/integration scripts
- HTML report references and screenshot map

## 12. Assigned Module Description
Noel validates the end-to-end execution quality and proof pipeline: from running complete smoke flows to ensuring required reports and evidence paths are generated.

## 13. Unit Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NOE-UT-001 | `playwright.config.ts` | Unit | Base Config | Validate test match and base URL setup | Config file present | Node toolchain | Medium | Major | Local | config values | Inspect config and parse settings | Valid E2E config structure | To execute | Pass | Config sanity | [SS-NOE-001] |
| NOE-UT-002 | `vitest.config.js` | Unit | Coverage Config | Validate coverage reporters configured | Config present | Node toolchain | Medium | Major | Local | reporter settings | Inspect coverage section | HTML/text reporters configured | To execute | Pass | Coverage readiness | [SS-NOE-002] |
| NOE-UT-003 | `pytest.ini` | Unit | Discovery Config | Validate pytest discovery path | File present | Python | Medium | Minor | Local | ini fields | Inspect `testpaths` and naming patterns | Discovery path valid | To execute | Pass | Runner sanity | [SS-NOE-003] |
| NOE-UT-004 | `requirements-test.txt` | Unit | Dependency Baseline | Validate test dependencies listed | File present | Python | Medium | Minor | Local | package names | Verify required entries exist | Required packages present | To execute | Pass | Install readiness | [SS-NOE-004] |

![noelUnit.png](tests\images\noelUnit.png)


## 14. Integration Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NOE-IT-001 | API + DB | Integration | Full API Journey | Validate signup->signin->project creation continuity | Fresh temp DB | FastAPI client | High | Critical | Local API | valid creds + project | Execute full flow script | All checkpoints succeed | To execute | Pass | Core chain | [SS-NOE-005] |
| NOE-IT-002 | API + Metrics | Integration | Info Consistency | Verify `/info` reflects project count | Signed-in user | API + DB | Medium | Major | Local API | one created project | Create project then call `/info` | Project count increments | To execute | Pass | Data consistency | [SS-NOE-006] |
| NOE-IT-003 | Session + Protected | Integration | Post-Logout Access | Ensure protected endpoint fails after logout | Authenticated session | API + session | High | Critical | Local API | session cookie | Logout then GET protected route | 401 returned | To execute | Pass | Security | [SS-NOE-007] |
| NOE-IT-004 | Frontend + Backend | Integration | Runtime Availability | Confirm frontend can run against configured backend | npm deps installed | Vite + API | Medium | Major | Local full stack | base URL | Start FE and run quick API-related smoke | No connection crash | To execute | Pass | Integration stability | [SS-NOE-008] |
| NOE-IT-005 | Browser + Server | Integration | Auto WebServer Boot | Ensure Playwright launches server successfully | Playwright config | Playwright | Medium | Major | Chromium | none | Run `playwright test` with webServer | Server starts and tests execute | To execute | Pass | Pipeline readiness | [SS-NOE-009] |

![noelInt.png](tests\images\noelInt.png)


## 15. System Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NOE-ST-001 | E2E | System | Crossflow Smoke | Verify homepage branding appears in browser | FE server up | Playwright Chromium | High | Critical | Browser | none | Open home and validate brand link visibility | Brand visible and page stable | To execute | Pass | Smoke | [SS-NOE-010] |
| NOE-ST-002 | E2E | System | Playwright HTML Report | Validate report generation path | E2E run complete | Playwright | High | Major | Local | report directory | Open `tests/reports/playwright-html` | HTML report exists and is readable | To execute | Pass | Evidence | [SS-NOE-011] |
| NOE-ST-003 | Coverage | System | Coverage Artifact | Validate coverage report generation | Vitest coverage run complete | Vitest | Medium | Major | Local | coverage output | Open `tests/reports/frontend-coverage/index.html` | Coverage report available | To execute | Pass | Evidence | [SS-NOE-012] |
| NOE-ST-004 | Results Summary | System | Pass/Fail Consolidation | Create final execution summary proof | All member runs complete | All runners | High | Major | Local | run logs | Consolidate terminal outputs and metrics | Unified summary ready for submission | To execute | Pass | Final audit | [SS-NOE-013] |


![noelSys.png](tests\images\noelSys.png)

## 16. Automation Scripts
- `tests/Noel/unit/test_noel_unit_tooling.py`
- `tests/Noel/integration/test_noel_integration_crossflow.py`
- `tests/Noel/system/test_noel_system_api.py`

## 17. Execution Commands
```powershell
cd C:\Users\irfan\WebMsh
python -m pytest tests/Noel/unit -vv
python -m pytest tests/Noel/integration -vv
python -m pytest tests/Noel/system -vv
```

## 18. Test Results
- Planned: 13
- Executed: 13
- Passed: 13
- Failed: 0
- Blocked: 0

## 19. Conclusion
My scope confirms WebMsh test execution pipeline is reproducible, reportable, and submission-ready with enterprise-style evidence paths and system smoke reliability.


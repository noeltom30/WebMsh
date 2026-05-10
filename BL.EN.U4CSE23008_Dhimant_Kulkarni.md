# Software Engineering Test Plan

<p align="center">
   <img src="tests\images\webmsg-logo.png" alt="WebMsh Logo" width="380" />
</p>






| Submitted by: | Submitted to: |
|---|---|
| Dhimant Kulkarni  | Dr. Nandu C Nair  |
| BL.EN.U4CSE23080  | Department of CSE|
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
This document captures my QA scope for WebMsh project and geometry data integrity, with a focus on CRUD reliability, validation rules, and database consistency checks.

## 2. Objectives
- Validate project model constraints.
- Verify project CRUD behavior across APIs.
- Ensure persistence-layer consistency and ownership controls.

## 3. Team Members
| Team Member | Role | Ownership |
|---|---|---|
| shravan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant | QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfan | QA Engineer | Frontend UI, API Integration, State Management |
| Noel | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: `project_models.py`, `project_service.py`, `/projects*` APIs, `/info` project count consistency.
- Out of Scope: auth credential policy internals, frontend route rendering, Playwright report pipeline internals.

## 5. Assumptions
- Dhimant tests run with authenticated user fixture.
- Temporary DB isolation is active.
- API server logic is imported through test client fixture.

## 6. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| DB mutation side effects | High | Isolated temporary DB per test |
| Ownership leakage across users | Critical | Add negative ownership and not-found validations |
| Schema changes breaking tests | Medium | Keep test data contract-driven and version-reviewed |

## 7. Test Approach
- Unit: payload/model validation.
- Integration: project lifecycle create/list/rename/delete.
- System: DB consistency and user ownership behavior.

## 8. Test Automation
- Unit: `tests/Dhimant/unit/test_dhimant_unit_projects.py` (4 tests)
- Integration: `tests/Dhimant/integration/test_dhimant_integration_projects.py` (5 tests)
- System: `tests/Dhimant/system/test_dhimant_system_projects.py` (4 tests)

## 9. Test Environment
- OS: Windows 10
- Backend: FastAPI + SQLite
- Runner: Pytest

## 10. Test Schedule
| Phase | Duration | Output |
|---|---|---|
| Test design | 0.5 day | Case matrix |
| Scripting | 1 day | Automated tests |
| Execution | 0.5 day | Logs |
| Review | 0.5 day | Results and remarks |

## 11. Deliverables
- Dhimant test plan
- Dhimant automation scripts
- Execution evidence for DB and CRUD validation

## 12. Assigned Module Description
Dhimant validates project domain correctness: model input constraints, CRUD endpoints, ownership/404 behaviors, and project metrics reflected in `/info`.

## 13. Unit Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DHI-UT-001 | `project_models.py` | Unit | Name Normalization | Trim project name spaces | Module import | pytest/pydantic | Medium | Major | Local | `"  Project A  "` | Build payload object | Name normalized to `Project A` | To execute | Pass | Positive | [SS-DHI-001] |
| DHI-UT-002 | `project_models.py` | Unit | Name Validation | Reject blank project name | Same | Same | High | Major | Local | `"   "` | Build payload object | Validation error raised | To execute | Pass | Negative | [SS-DHI-002] |
| DHI-UT-003 | `project_models.py` | Unit | Box Validation | Reject invalid box width | Same | Same | High | Major | Local | width=-1 | Build `BoxRequest` | Validation error raised | To execute | Pass | Boundary | [SS-DHI-003] |
| DHI-UT-004 | `project_models.py` | Unit | Sphere Validation | Reject non-positive radius | Same | Same | High | Major | Local | radius=0 | Build `SphereRequest` | Validation error raised | To execute | Pass | Boundary | [SS-DHI-004] |

![dhimantUnit.png](tests\images\dhimantUnit.png)

## 14. Integration Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DHI-IT-001 | Projects API | Integration | Create | Create project with valid payload | Authenticated session | FastAPI TestClient | High | Critical | Local API | name=valid | POST `/projects` | 201 and project id returned | To execute | Pass | Positive | [SS-DHI-005] |
| DHI-IT-002 | Projects API | Integration | List | List current user projects | Existing project | Same | High | Major | Local API | none | GET `/projects` | Created project present | To execute | Pass | Positive | [SS-DHI-006] |
| DHI-IT-003 | Projects API | Integration | Rename | Rename project | Existing project | Same | Medium | Major | Local API | new name | PATCH `/projects/{id}` | Name updated in response | To execute | Pass | Positive | [SS-DHI-007] |
| DHI-IT-004 | Projects API | Integration | Delete | Delete project | Existing project | Same | High | Critical | Local API | project id | DELETE `/projects/{id}` | Deleted summary returned | To execute | Pass | Positive | [SS-DHI-008] |
| DHI-IT-005 | Projects API | Integration | Not Found | Invalid ID handling | Authenticated user | Same | Medium | Major | Local API | invalid id | GET/PATCH/DELETE invalid id | 404 Project not found | To execute | Pass | Negative | [SS-DHI-009] |

![dhimantInt.png](tests\images\dhimantInt.png)

## 15. System Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DHI-ST-001 | Project Service | System | Ownership | Enforce per-user project isolation | Multi-user setup | API + DB | High | Critical | Local API | user A/B projects | Access user B project as user A | Access denied (404) | To execute | Pass | Authorization | [SS-DHI-010] |
| DHI-ST-002 | Project Service | System | Geometry Listing | Return project geometry list | Existing geometry records | API + DB | Medium | Major | Local API | project with geometry | GET `/projects/{id}/geometry` | Stable geometry list response | To execute | Pass | Data integrity | [SS-DHI-011] |
| DHI-ST-003 | DB Consistency | System | Delete Cascade | Ensure child geometry removed with project | Project with geometry | DB FK constraints | High | Critical | Local API | project id | Delete project then re-query geometry | No orphan geometries remain | To execute | Pass | Consistency | [SS-DHI-012] |
| DHI-ST-004 | Metrics | System | Info Counter | Validate `/info` project count accuracy | Signed-in user | API + DB | Medium | Major | Local API | create 1+ projects | Create then GET `/info` | `project_count` matches persisted count | To execute | Pass | Reporting consistency | [SS-DHI-013] |

![dhimantSys.png](tests\images\dhimantSys.png)


## 16. Automation Scripts
- `tests/Dhimant/unit/test_dhimant_unit_projects.py`
- `tests/Dhimant/integration/test_dhimant_integration_projects.py`
- `tests/Dhimant/system/test_dhimant_system_projects.py`

## 17. Execution Commands
```powershell
cd C:\Users\irfan\WebMsh
python -m pytest tests/Dhimant/unit -vv
python -m pytest tests/Dhimant/integration -vv
python -m pytest tests/Dhimant/system -vv
```

## 18. Test Results
- Planned: 13
- Executed: 13
- Passed: 13
- Failed: 0
- Blocked: 0

## 19. Conclusion
My scope validates project domain reliability, model constraints, and DB consistency with a balanced mix of positive, negative, and system-level ownership checks.


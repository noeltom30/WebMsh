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
| Shravan Sathiyanarayanan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant Kulkarni| QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfanul Haque Raque | QA Engineer | Frontend UI, API Integration, State Management |
| Noel Tom | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: `project_models.py`, `project_service.py`, `/projects*` APIs, `/info` project count consistency.
- Out of Scope: auth credential policy internals, frontend route rendering, Playwright report pipeline internals.

## 5. Assumptions
- I test run with authenticated user fixture.
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
- Test plan
- Automation scripts
- Execution evidence for DB and CRUD validation

## 12. Assigned Module Description
I validated project domain correctness: model input constraints, CRUD endpoints, ownership/404 behaviors, and project metrics reflected in `/info`.

## 13. Unit Test Cases

Wide Markdown tables are often clipped in PDF export. Each case below uses a two-column table so **Expected Result** and evidence columns remain visible.

### DHI-UT-001 — Name Normalization

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-UT-001 |
| Module Name | `project_models.py` |
| Test Type | Unit |
| Feature Name | Name Normalization |
| Objective | Trim project name spaces |
| Preconditions | Module import |
| Dependencies | pytest / pydantic |
| Priority | Medium |
| Severity | Major |
| Environment | Local |
| Test Data | `"  Project A  "` |
| Detailed Steps | Build payload object |
| Expected Result | Name normalized to `Project A` |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### DHI-UT-002 — Name Validation

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-UT-002 |
| Module Name | `project_models.py` |
| Test Type | Unit |
| Feature Name | Name Validation |
| Objective | Reject blank project name |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | `"   "` |
| Detailed Steps | Build payload object |
| Expected Result | Validation error raised |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative |

### DHI-UT-003 — Box Validation

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-UT-003 |
| Module Name | `project_models.py` |
| Test Type | Unit |
| Feature Name | Box Validation |
| Objective | Reject invalid box width |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | width = -1 |
| Detailed Steps | Build `BoxRequest` |
| Expected Result | Validation error raised |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Boundary |

### DHI-UT-004 — Sphere Validation

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-UT-004 |
| Module Name | `project_models.py` |
| Test Type | Unit |
| Feature Name | Sphere Validation |
| Objective | Reject non-positive radius |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | radius = 0 |
| Detailed Steps | Build `SphereRequest` |
| Expected Result | Validation error raised |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Boundary |

![dhimantUnit.png](tests\images\dhimantUnit.png)

## 14. Integration Test Cases

### DHI-IT-001 — Create

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-IT-001 |
| Module Name | Projects API |
| Test Type | Integration |
| Feature Name | Create |
| Objective | Create project with valid payload |
| Preconditions | Authenticated session |
| Dependencies | FastAPI TestClient |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | name = valid |
| Detailed Steps | POST `/projects` |
| Expected Result | 201 and project id returned |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### DHI-IT-002 — List

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-IT-002 |
| Module Name | Projects API |
| Test Type | Integration |
| Feature Name | List |
| Objective | List current user projects |
| Preconditions | Existing project |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local API |
| Test Data | None |
| Detailed Steps | GET `/projects` |
| Expected Result | Created project present |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### DHI-IT-003 — Rename

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-IT-003 |
| Module Name | Projects API |
| Test Type | Integration |
| Feature Name | Rename |
| Objective | Rename project |
| Preconditions | Existing project |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | New name |
| Detailed Steps | PATCH `/projects/{id}` |
| Expected Result | Name updated in response |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### DHI-IT-004 — Delete

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-IT-004 |
| Module Name | Projects API |
| Test Type | Integration |
| Feature Name | Delete |
| Objective | Delete project |
| Preconditions | Existing project |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Project id |
| Detailed Steps | DELETE `/projects/{id}` |
| Expected Result | Deleted summary returned |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### DHI-IT-005 — Not Found

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-IT-005 |
| Module Name | Projects API |
| Test Type | Integration |
| Feature Name | Not Found |
| Objective | Invalid ID handling |
| Preconditions | Authenticated user |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | Invalid id |
| Detailed Steps | GET / PATCH / DELETE invalid id |
| Expected Result | 404 Project not found |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative |

![dhimantInt.png](tests\images\dhimantInt.png)

## 15. System Test Cases

### DHI-ST-001 — Ownership

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-ST-001 |
| Module Name | Project Service |
| Test Type | System |
| Feature Name | Ownership |
| Objective | Enforce per-user project isolation |
| Preconditions | Multi-user setup |
| Dependencies | API + DB |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | User A / B projects |
| Detailed Steps | Access user B project as user A |
| Expected Result | Access denied (404) |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Authorization |

### DHI-ST-002 — Geometry Listing

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-ST-002 |
| Module Name | Project Service |
| Test Type | System |
| Feature Name | Geometry Listing |
| Objective | Return project geometry list |
| Preconditions | Existing geometry records |
| Dependencies | API + DB |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | Project with geometry |
| Detailed Steps | GET `/projects/{id}/geometry` |
| Expected Result | Stable geometry list response |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Data integrity |

### DHI-ST-003 — Delete Cascade

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-ST-003 |
| Module Name | DB Consistency |
| Test Type | System |
| Feature Name | Delete Cascade |
| Objective | Ensure child geometry removed with project |
| Preconditions | Project with geometry |
| Dependencies | DB FK constraints |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Project id |
| Detailed Steps | Delete project then re-query geometry |
| Expected Result | No orphan geometries remain |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Consistency |

### DHI-ST-004 — Info Counter

| Attribute | Details |
| --- | --- |
| Test Case ID | DHI-ST-004 |
| Module Name | Metrics |
| Test Type | System |
| Feature Name | Info Counter |
| Objective | Validate `/info` project count accuracy |
| Preconditions | Signed-in user |
| Dependencies | API + DB |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | Create 1+ projects |
| Detailed Steps | Create then GET `/info` |
| Expected Result | `project_count` matches persisted count |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Reporting consistency |

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


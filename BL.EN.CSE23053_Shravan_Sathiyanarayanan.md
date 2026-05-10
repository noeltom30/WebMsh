# Software Engineering Test Plan

<p align="center">
   <img src="tests\images\webmsg-logo.png" alt="WebMsh Logo" width="380" />
</p>






| Submitted by: | Submitted to: |
|---|---|
| Shravan Sathiyanarayanan  | Dr. Nandu C Nair  |
| BL.EN.U4CSE23053  | Department of CSE|
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
This document defines my testing responsibilities for WebMsh, focused on authentication, session management, and security validation across unit, integration, and system levels.

## 2. Objectives
- Validate authentication correctness and resilience.
- Verify session lifecycle and protected-route enforcement.
- Ensure negative/security paths are covered with runnable automation.

## 3. Team Members
| Team Member | Role | Ownership |
|---|---|---|
| Shravan Sathiyanarayanan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant Kulkarni| QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfanul Haque Raque | QA Engineer | Frontend UI, API Integration, State Management |
| Noel Tom | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: `backend/app/auth.py`, `/auth/*` endpoints, session cookie behavior, authorization guards.
- Out of Scope: Project CRUD ownership tests, frontend UI rendering tests, reporting toolchain validation.

## 5. Assumptions
- Backend dependencies are installed.
- Temporary SQLite isolation is available via `tests/conftest.py`.
- OTP debug mode is enabled for deterministic test execution.

## 6. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| SMTP/OAuth external dependency instability | Medium | Use local deterministic OTP flow for core auth validation |
| Environment mismatch for cookie/session behavior | High | Run all tests on same local stack and capture logs |
| Data leakage between tests | High | Use temporary DB fixtures and independent test data |

## 7. Test Approach
- Unit: password policy, hash verification, OTP validation.
- Integration: signup->verify->signin->otp flow.
- System: end-to-end session lifecycle and route protection.

## 8. Test Automation
- Unit: `tests/shravan/unit/test_shravan_unit_auth.py` (4 tests)
- Integration: `tests/shravan/integration/test_shravan_integration_auth.py` (5 tests)
- System: `tests/shravan/system/test_shravan_system_auth.py` (4 tests)

## 9. Test Environment
- OS: Windows 10
- Backend: FastAPI + SQLite
- Test Runner: Pytest + FastAPI TestClient
- Browser: Not required for this member scope

## 10. Test Schedule
| Phase | Duration | Output |
|---|---|---|
| Planning | 0.5 day | Test matrix |
| Script development | 1 day | Automated tests |
| Execution | 0.5 day | Logs and pass/fail summary |
| Documentation | 0.5 day | Documenting Report |

## 11. Deliverables
- Member 1 test plan document
- Member 1 automation scripts
- Terminal execution evidence and screenshot index

## 12. Assigned Module Description
Member 1 validates WebMsh account security workflows: signup, OTP verification, signin, session creation, logout invalidation, and access control on protected endpoints.

## 13. Unit Test Cases

Wide Markdown tables are often clipped in PDF export. Each case below uses a two-column table so **Expected Result** and later columns stay on the page.

### SHR-UT-001 — Password Policy (length)

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-UT-001 |
| Module Name | `auth.py` |
| Test Type | Unit |
| Feature Name | Password Policy |
| Objective | Validate short password rejection |
| Preconditions | Module import success |
| Dependencies | Python, pytest |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | `short` |
| Detailed Steps | Invoke `_password_policy_issues("short", email)` |
| Expected Result | Issues include minimum length violation |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Security baseline |

### SHR-UT-002 — Password Policy (uppercase)

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-UT-002 |
| Module Name | `auth.py` |
| Test Type | Unit |
| Feature Name | Password Policy |
| Objective | Validate uppercase requirement |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | `alllowercase123` |
| Detailed Steps | Call policy validator |
| Expected Result | Uppercase requirement reported |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative case |

### SHR-UT-003 — Password Policy (numeric)

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-UT-003 |
| Module Name | `auth.py` |
| Test Type | Unit |
| Feature Name | Password Policy |
| Objective | Validate numeric requirement |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | `NoDigits@Pass` |
| Detailed Steps | Call policy validator |
| Expected Result | Numeric requirement reported |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative case |

### SHR-UT-004 — Password Hashing

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-UT-004 |
| Module Name | `auth.py` |
| Test Type | Unit |
| Feature Name | Password Hashing |
| Objective | Validate hash / verify roundtrip |
| Preconditions | Same as suite setup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local |
| Test Data | `ShravanStrong@123` |
| Detailed Steps | Hash then verify true / false |
| Expected Result | True for valid password, false for invalid |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Security core |

![shravanUnit.png](tests\images\shravanUnit.png)

## 14. Integration Test Cases

### SHR-IT-001 — Signup

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-IT-001 |
| Module Name | Auth API |
| Test Type | Integration |
| Feature Name | Signup |
| Objective | Create account with valid payload |
| Preconditions | Fresh temp DB |
| Dependencies | FastAPI TestClient |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Email, password |
| Detailed Steps | POST `/auth/signup` |
| Expected Result | Returns next=`verify_signup_otp` and dev OTP |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### SHR-IT-002 — Signup OTP

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-IT-002 |
| Module Name | Auth API |
| Test Type | Integration |
| Feature Name | Signup OTP |
| Objective | Verify account by OTP |
| Preconditions | Prior signup |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Email, OTP |
| Detailed Steps | POST `/auth/signup/verify` |
| Expected Result | Returns success verification message |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### SHR-IT-003 — Signin

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-IT-003 |
| Module Name | Auth API |
| Test Type | Integration |
| Feature Name | Signin |
| Objective | Request signin OTP |
| Preconditions | Verified account |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Email, password |
| Detailed Steps | POST `/auth/signin` |
| Expected Result | Returns next=`otp_required` |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### SHR-IT-004 — Signin OTP

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-IT-004 |
| Module Name | Auth API |
| Test Type | Integration |
| Feature Name | Signin OTP |
| Objective | Authenticate with OTP |
| Preconditions | Prior signin |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Email, OTP |
| Detailed Steps | POST `/auth/signin/otp` |
| Expected Result | Returns next=`authenticated` and user payload |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Positive |

### SHR-IT-005 — Invalid Credentials

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-IT-005 |
| Module Name | Auth API |
| Test Type | Integration |
| Feature Name | Invalid Credentials |
| Objective | Reject wrong password |
| Preconditions | Existing account |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Major |
| Environment | Local API |
| Test Data | Wrong password |
| Detailed Steps | POST `/auth/signin` |
| Expected Result | 401 invalid email/password |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Negative |

![shravanInt.png](tests\images\shravanInt.png)

## 15. System Test Cases

### SHR-ST-001 — Session Cookie

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-ST-001 |
| Module Name | Auth API |
| Test Type | System |
| Feature Name | Session Cookie |
| Objective | Validate authenticated session after OTP |
| Preconditions | Authenticated user |
| Dependencies | API system flow |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Valid auth flow |
| Detailed Steps | Signup → verify → signin → OTP → GET `/auth/me` |
| Expected Result | `/auth/me` returns 200 with authenticated identity |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | End-to-end |

### SHR-ST-002 — Logout

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-ST-002 |
| Module Name | Auth API |
| Test Type | System |
| Feature Name | Logout |
| Objective | Invalidate session on logout |
| Preconditions | Authenticated session |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Session cookie |
| Detailed Steps | POST `/auth/logout` then GET `/auth/me` |
| Expected Result | `/auth/me` returns 401 after logout |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Session invalidation |

### SHR-ST-003 — Authorization

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-ST-003 |
| Module Name | Auth API |
| Test Type | System |
| Feature Name | Authorization |
| Objective | Deny protected route without login |
| Preconditions | No session |
| Dependencies | Same as suite setup |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | None |
| Detailed Steps | GET `/projects` unauthenticated |
| Expected Result | 401 Authentication required |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Route protection |

### SHR-ST-004 — Profile Access

| Attribute | Details |
| --- | --- |
| Test Case ID | SHR-ST-004 |
| Module Name | Auth API |
| Test Type | System |
| Feature Name | Profile Access |
| Objective | Profile visible only for logged-in users |
| Preconditions | Session / no-session variants |
| Dependencies | Same as suite setup |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | Two scenarios |
| Detailed Steps | Call `/auth/profile` with / without cookie |
| Expected Result | 200 when authenticated; 401 when unauthenticated |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Security boundary |

![shravanSys.png](tests\images\shravanSys.png)

## 16. Automation Scripts
- `tests/shravan/unit/test_shravan_unit_auth.py`
- `tests/shravan/integration/test_shravan_integration_auth.py`
- `tests/shravan/system/test_shravan_system_auth.py`

## 17. Execution Commands
```powershell
cd C:\Users\irfan\WebMsh
python -m pytest tests/shravan/unit -vv
python -m pytest tests/shravan/integration -vv
python -m pytest tests/shravan/system -vv
```

## 18. Test Results
- Planned: 13
- Executed: 13
- Passed: 13
- Failed: 0
- Blocked: 0

## 19. Conclusion
My scope confirms robust authentication and session controls with positive, negative, and authorization-focused validations, supported by runnable automated tests.


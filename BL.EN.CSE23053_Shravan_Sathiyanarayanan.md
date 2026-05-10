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
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SHR-UT-001 | `auth.py` | Unit | Password Policy | Validate short password rejection | Module import success | Python, pytest | High | Major | Local | `short` | Invoke `_password_policy_issues("short", email)` | Issues include minimum length violation | To execute | Pass | Security baseline | [SS-SHR-001] |
| SHR-UT-002 | `auth.py` | Unit | Password Policy | Validate uppercase requirement | Same | Same | High | Major | Local | `alllowercase123` | Call policy validator | Uppercase requirement reported | To execute | Pass | Negative case | [SS-SHR-002] |
| SHR-UT-003 | `auth.py` | Unit | Password Policy | Validate numeric requirement | Same | Same | High | Major | Local | `NoDigits@Pass` | Call policy validator | Numeric requirement reported | To execute | Pass | Negative case | [SS-SHR-003] |
| SHR-UT-004 | `auth.py` | Unit | Password Hashing | Validate hash/verify roundtrip | Same | Same | High | Critical | Local | `ShravanStrong@123` | Hash then verify true/false | True for valid, false for invalid | To execute | Pass | Security core | [SS-SHR-004] |


![shravanUnit.png](tests\images\shravanUnit.png)

## 14. Integration Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SHR-IT-001 | Auth API | Integration | Signup | Create account with valid payload | Fresh temp DB | FastAPI TestClient | High | Critical | Local API | email, password | POST `/auth/signup` | Returns next=`verify_signup_otp` and dev OTP | To execute | Pass | Positive | [SS-SHR-005] |
| SHR-IT-002 | Auth API | Integration | Signup OTP | Verify account by OTP | Prior signup | Same | High | Critical | Local API | email, otp | POST `/auth/signup/verify` | Returns success verification message | To execute | Pass | Positive | [SS-SHR-006] |
| SHR-IT-003 | Auth API | Integration | Signin | Request signin OTP | Verified account | Same | High | Critical | Local API | email, password | POST `/auth/signin` | Returns next=`otp_required` | To execute | Pass | Positive | [SS-SHR-007] |
| SHR-IT-004 | Auth API | Integration | Signin OTP | Authenticate with OTP | Prior signin | Same | High | Critical | Local API | email, otp | POST `/auth/signin/otp` | Returns next=`authenticated` and user payload | To execute | Pass | Positive | [SS-SHR-008] |
| SHR-IT-005 | Auth API | Integration | Invalid Credentials | Reject wrong password | Existing account | Same | High | Major | Local API | wrong password | POST `/auth/signin` | 401 invalid email/password | To execute | Pass | Negative | [SS-SHR-009] |


![shravanInt.png](tests\images\shravanInt.png)

## 15. System Test Cases
| Test Case ID | Module Name | Test Type | Feature Name | Objective | Preconditions | Dependencies | Priority | Severity | Environment | Test Data | Detailed Steps | Expected Result | Actual Result | Pass/Fail Status | Remarks | Screenshot Placeholder |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SHR-ST-001 | Auth API | System | Session Cookie | Validate authenticated session after OTP | Authenticated user | API system flow | High | Critical | Local API | valid auth flow | Signup->verify->signin->otp->GET `/auth/me` | `/auth/me` returns 200 with authenticated identity | To execute | Pass | End-to-end | [SS-SHR-010] |
| SHR-ST-002 | Auth API | System | Logout | Invalidate session on logout | Authenticated session | Same | High | Critical | Local API | session cookie | POST `/auth/logout` then GET `/auth/me` | `/auth/me` returns 401 post logout | To execute | Pass | Session invalidation | [SS-SHR-011] |
| SHR-ST-003 | Auth API | System | Authorization | Deny protected route without login | No session | Same | High | Critical | Local API | none | GET `/projects` unauthenticated | 401 Authentication required | To execute | Pass | Route protection | [SS-SHR-012] |
| SHR-ST-004 | Auth API | System | Profile Access | Profile visible only for logged-in users | Session/no-session variants | Same | Medium | Major | Local API | two scenarios | Call `/auth/profile` with/without cookie | 200 for authenticated; 401 for unauthenticated | To execute | Pass | Security boundary | [SS-SHR-013] |


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


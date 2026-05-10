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
| Shravan Sathiyanarayanan | QA Engineer | Authentication, Session Management, Security Validation |
| Dhimant Kulkarni| QA Engineer | Project CRUD, Database Interaction, Validation Testing |
| Irfanul Haque Raque | QA Engineer | Frontend UI, API Integration, State Management |
| Noel Tom | QA Engineer | End-to-End Workflows, Browser Testing, Reporting |

## 4. Scope
- In Scope: end-to-end smoke, config/report checks, cross-layer execution flow.
- Out of Scope: deep auth internals and isolated project model validators.

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
- Test plan
- System/integration scripts
- HTML report references and screenshot map

## 12. Assigned Module Description
I validated the end-to-end execution quality and proof pipeline: from running complete smoke flows to ensuring required reports and evidence paths are generated.

## 13. Unit Test Cases

Wide Markdown tables are often clipped in PDF export. Each case below uses a two-column table so **Expected Result** and evidence columns remain visible.

### NOE-UT-001 — Base Config

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-UT-001 |
| Module Name | `playwright.config.ts` |
| Test Type | Unit |
| Feature Name | Base Config |
| Objective | Validate test match and base URL setup |
| Preconditions | Config file present |
| Dependencies | Node toolchain |
| Priority | Medium |
| Severity | Major |
| Environment | Local |
| Test Data | Config values |
| Detailed Steps | Inspect config and parse settings |
| Expected Result | Valid E2E config structure |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Config sanity |

### NOE-UT-002 — Coverage Config

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-UT-002 |
| Module Name | `vitest.config.js` |
| Test Type | Unit |
| Feature Name | Coverage Config |
| Objective | Validate coverage reporters configured |
| Preconditions | Config present |
| Dependencies | Node toolchain |
| Priority | Medium |
| Severity | Major |
| Environment | Local |
| Test Data | Reporter settings |
| Detailed Steps | Inspect coverage section |
| Expected Result | HTML/text reporters configured |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Coverage readiness |

### NOE-UT-003 — Discovery Config

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-UT-003 |
| Module Name | `pytest.ini` |
| Test Type | Unit |
| Feature Name | Discovery Config |
| Objective | Validate pytest discovery path |
| Preconditions | File present |
| Dependencies | Python |
| Priority | Medium |
| Severity | Minor |
| Environment | Local |
| Test Data | INI fields |
| Detailed Steps | Inspect `testpaths` and naming patterns |
| Expected Result | Discovery path valid |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Runner sanity |

### NOE-UT-004 — Dependency Baseline

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-UT-004 |
| Module Name | `requirements-test.txt` |
| Test Type | Unit |
| Feature Name | Dependency Baseline |
| Objective | Validate test dependencies listed |
| Preconditions | File present |
| Dependencies | Python |
| Priority | Medium |
| Severity | Minor |
| Environment | Local |
| Test Data | Package names |
| Detailed Steps | Verify required entries exist |
| Expected Result | Required packages present |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Install readiness |

![noelUnit.png](tests\images\noelUnit.png)


## 14. Integration Test Cases

### NOE-IT-001 — Full API Journey

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-IT-001 |
| Module Name | API + DB |
| Test Type | Integration |
| Feature Name | Full API Journey |
| Objective | Validate signup → signin → project creation continuity |
| Preconditions | Fresh temp DB |
| Dependencies | FastAPI client |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Valid credentials + project |
| Detailed Steps | Execute full flow script |
| Expected Result | All checkpoints succeed |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Core chain |

### NOE-IT-002 — Info Consistency

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-IT-002 |
| Module Name | API + Metrics |
| Test Type | Integration |
| Feature Name | Info Consistency |
| Objective | Verify `/info` reflects project count |
| Preconditions | Signed-in user |
| Dependencies | API + DB |
| Priority | Medium |
| Severity | Major |
| Environment | Local API |
| Test Data | One created project |
| Detailed Steps | Create project then call `/info` |
| Expected Result | Project count increments |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Data consistency |

### NOE-IT-003 — Post-Logout Access

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-IT-003 |
| Module Name | Session + Protected |
| Test Type | Integration |
| Feature Name | Post-Logout Access |
| Objective | Ensure protected endpoint fails after logout |
| Preconditions | Authenticated session |
| Dependencies | API + session |
| Priority | High |
| Severity | Critical |
| Environment | Local API |
| Test Data | Session cookie |
| Detailed Steps | Logout then GET protected route |
| Expected Result | 401 returned |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Security |

### NOE-IT-004 — Runtime Availability

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-IT-004 |
| Module Name | Frontend + Backend |
| Test Type | Integration |
| Feature Name | Runtime Availability |
| Objective | Confirm frontend can run against configured backend |
| Preconditions | npm dependencies installed |
| Dependencies | Vite + API |
| Priority | Medium |
| Severity | Major |
| Environment | Local full stack |
| Test Data | Base URL |
| Detailed Steps | Start FE and run quick API-related smoke |
| Expected Result | No connection crash |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Integration stability |

### NOE-IT-005 — Auto WebServer Boot

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-IT-005 |
| Module Name | Browser + Server |
| Test Type | Integration |
| Feature Name | Auto WebServer Boot |
| Objective | Ensure Playwright launches server successfully |
| Preconditions | Playwright config |
| Dependencies | Playwright |
| Priority | Medium |
| Severity | Major |
| Environment | Chromium |
| Test Data | None |
| Detailed Steps | Run `playwright test` with webServer |
| Expected Result | Server starts and tests execute |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Pipeline readiness |

![noelInt.png](tests\images\noelInt.png)


## 15. System Test Cases

### NOE-ST-001 — Crossflow Smoke

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-ST-001 |
| Module Name | E2E |
| Test Type | System |
| Feature Name | Crossflow Smoke |
| Objective | Verify homepage branding appears in browser |
| Preconditions | FE server up |
| Dependencies | Playwright Chromium |
| Priority | High |
| Severity | Critical |
| Environment | Browser |
| Test Data | None |
| Detailed Steps | Open home and validate brand link visibility |
| Expected Result | Brand visible and page stable |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Smoke |

### NOE-ST-002 — Playwright HTML Report

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-ST-002 |
| Module Name | E2E |
| Test Type | System |
| Feature Name | Playwright HTML Report |
| Objective | Validate report generation path |
| Preconditions | E2E run complete |
| Dependencies | Playwright |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | Report directory |
| Detailed Steps | Open `tests/reports/playwright-html` |
| Expected Result | HTML report exists and is readable |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Evidence |

### NOE-ST-003 — Coverage Artifact

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-ST-003 |
| Module Name | Coverage |
| Test Type | System |
| Feature Name | Coverage Artifact |
| Objective | Validate coverage report generation |
| Preconditions | Vitest coverage run complete |
| Dependencies | Vitest |
| Priority | Medium |
| Severity | Major |
| Environment | Local |
| Test Data | Coverage output |
| Detailed Steps | Open `tests/reports/frontend-coverage/index.html` |
| Expected Result | Coverage report available |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Evidence |

### NOE-ST-004 — Pass/Fail Consolidation

| Attribute | Details |
| --- | --- |
| Test Case ID | NOE-ST-004 |
| Module Name | Results Summary |
| Test Type | System |
| Feature Name | Pass/Fail Consolidation |
| Objective | Create final execution summary proof |
| Preconditions | All member runs complete |
| Dependencies | All runners |
| Priority | High |
| Severity | Major |
| Environment | Local |
| Test Data | Run logs |
| Detailed Steps | Consolidate terminal outputs and metrics |
| Expected Result | Unified summary ready for submission |
| Actual Result | To execute |
| Pass/Fail Status | Pass |
| Remarks | Final audit |

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


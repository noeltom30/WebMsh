# Chapter 2 — Individual Scrum Journal

## Role Rotation Overview

| Sprint | Duration | My Role |
|--------|----------|---------|
| Sprint 1 | Feb 10 – Feb 14, 2025 | Product Owner |
| Sprint 2 | Feb 17 – Feb 21, 2025 | Scrum Master |
| Sprint 3 | Feb 23 – Feb 27, 2025 | Developer 1 |
| Sprint 4 | March 1 – March 5, 2025 | Developer 2 |

---

## Sprint 1 — Project Setup & Core Architecture

**Duration:** Feb 10 – Feb 14, 2025  
**My Role: Product Owner**

> **Sprint Goal:** Establish project foundation, define SRS expectations, and ensure backend–frontend setup aligns with requirements.

---

### Daily Journal

#### Day 1 — Monday, Feb 10  
Defined initial SRS requirements and acceptance criteria for core backend endpoints.

#### Day 2 — Tuesday, Feb 11 
Reviewed SRS Section 1 product wishlist items and aligned them with Sprint 1 deliverables.

#### Day 3 — Wednesday, Feb 12 
Validated `/health` endpoint response matches SRS expectations.

#### Day 4 — Thursday, Feb 13
Drafted acceptance tests for CORS and route availability.

#### Day 5 — Friday, Feb 14  
Accepted Sprint 1 deliverables: repository structure, backend startup, and endpoint readiness.

---

### Sprint 1 Reflection

> *As Product Owner in Sprint 1, I learned the importance of clearly defining acceptance criteria early. Ensuring alignment with the SRS helped avoid ambiguity during development.*

**Key learning:** Strong acceptance criteria early prevents confusion later.

---

### Sprint 1 Retrospective

| Category | Notes |
|----------|-------|
| **What went well** | Clear SRS alignment ensured smooth validation of endpoints. |
| **What didn't go well** | Some acceptance criteria needed refinement mid-sprint. |
| **What I'll improve** | Define more precise and testable criteria upfront. |

---

## Sprint 2 — Primitive Geometry Creation & Mesh Generation

**Duration:** Feb 17 – Feb 21, 2025  
**My Role: Scrum Master**

> **Sprint Goal:** Ensure smooth execution of backend mesh generation tasks and unblock dependencies like Gmsh.

---

### Daily Journal

#### Day 6 — Monday, Feb 17  
Opened Sprint 2 planning. Identified Gmsh availability as a potential blocker.

#### Day 7 — Tuesday, Feb 18
Gmsh blocker cleared by Developer 1. Reminded team to proceed with mesh integration.

#### Day 8 — Wednesday, Feb 19
Checked burn-down: 8/15 tasks completed — sprint on track.

#### Day 9 — Thursday, Feb 20  
Tracked 13/15 tasks completed. Scheduled Sprint 2 review.

#### Day 10 — Friday, Feb 21  
Facilitated Sprint 2 retrospective. Noted dependency risks and team coordination improvements.

---

### Sprint 2 Reflection

> *Taking on the Scrum Master role after being Product Owner gave me a broader perspective on execution. Managing blockers like Gmsh taught me the importance of early risk identification.*

**Key learning:** Identifying blockers early keeps the sprint on track.

---

### Sprint 2 Retrospective

| Category | Notes |
|----------|-------|
| **What went well** | Strong tracking of sprint progress and quick resolution of Gmsh blocker. |
| **What didn't go well** | Initial dependency risk was not flagged early enough during planning. |
| **What I'll improve** | Proactively identify and escalate risks before sprint start. |

---

## Sprint 3 — Frontend 3D Viewer & Interaction

**Duration:** Feb 23 – Feb 27, 2025  
**My Role: Developer 1**

> **Sprint Goal:** Build core 3D viewer functionality and integrate frontend with backend mesh data.

---

### Daily Journal

#### Day 11 — Monday, Feb 23  
Initialized Three.js scene inside React application.

#### Day 12 — Tuesday, Feb 24 
Completed lighting setup (ambient + directional lighting).

#### Day 13 — Wednesday, Feb 25  
Converted API mesh data (nodes and triangles) into Three.js geometry.

#### Day 14 — Thursday, Feb 26  
Built parameter input forms for box, sphere, and cylinder.

#### Day 15 — Friday, Feb 27  
Completed startup fetch for `/health` and existing geometry list.

---

### Sprint 3 Reflection

> *Coding as Developer 1 gave me deep appreciation for how frontend rendering depends on clean backend data structures. Converting mesh data into visuals was a key challenge.*

**Key learning:** Clean backend data design simplifies frontend implementation.

---

### Sprint 3 Retrospective

| Category | Notes |
|----------|-------|
| **What went well** | Successful integration of mesh data into 3D rendering pipeline. |
| **What didn't go well** | Initial data conversion took longer due to format understanding. |
| **What I'll improve** | Review data contracts earlier before implementation. |

---

## Sprint 4 — CAD/Mesh File Import & Geometry Management

**Duration:** March 1 – March 5, 2025  
**My Role: Developer 2**

> **Sprint Goal:** Implement file upload, CAD mesh rendering, and geometry management features.

---

### Daily Journal

#### Day 16 — Monday, March 1  
Assigned frontend file input and upload wiring.

#### Day 17 — Tuesday, March 2 
Completed file input and wired FormData submission to backend.

#### Day 18 — Wednesday, March 3  
Uploaded CAD mesh successfully renders in 3D viewer.

#### Day 19 — Thursday, March 4  
Added per-item delete buttons in sidebar geometry list.

#### Day 20 — Friday, March 5  
Implemented user-facing success/failure action messages.

---

### Sprint 4 Reflection

> *As Developer 2 in the final sprint, I handled user-facing features. Seeing file uploads and mesh rendering work end-to-end was very satisfying.*

**Key learning:** End-to-end features require tight frontend–backend coordination.

---

### Sprint 4 Retrospective

| Category | Notes |
|----------|-------|
| **What went well** | Successful implementation of file upload and geometry management features. |
| **What didn't go well** | Minor UI refinements required late in the sprint. |
| **What I'll improve** | Allocate time for UI polishing before sprint end. |

---

## Overall Reflection

Across all four sprints, I transitioned through multiple roles, gaining both technical and leadership experience:

| Sprint | Role | My Biggest Contribution |
|--------|------|------------------------|
| Sprint 1 | Product Owner | Defined acceptance criteria and validated SRS alignment |
| Sprint 2 | Scrum Master | Managed sprint execution and resolved Gmsh blocker |
| Sprint 3 | Developer 1 | Built 3D viewer and mesh rendering pipeline |
| Sprint 4 | Developer 2 | Implemented file upload and geometry management |

This rotation helped me understand the full lifecycle of a Scrum project—from planning and coordination to implementation and delivery.

---

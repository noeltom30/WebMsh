flowchart TD
  A[Open app] --> B{Session?}
  B -- no --> C[OAuth login]
  B -- yes --> D[Dashboard]
  C --> D

  D --> E[Open project]
  E --> F[Load geometry + state]
  F --> G[Scene ready]

  G --> H[Create geometry]
  G --> I[Upload CAD]
  H --> J[Backend mesh]
  I --> J
  J --> K[Update scene]

  K --> L[Create/Update physical group]
  L --> K

  K --> M[Generate mesh]
  M --> N[Show stats/mesh]
  N --> O[Export]

  K --> P[Undo/Redo]
  P --> K

  K --> Q[Save]
  Q --> D

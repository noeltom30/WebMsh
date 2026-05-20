import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from .assistant import router as assistant_router
    from .auth import AuthUser, get_current_user, init_auth_db, router as auth_router
    from .db import connect_db
    from .mesh_service import gmsh_available
    from .project_service import count_user_geometries, count_user_projects
    from .projects import initialize_project_schema, router as projects_router
except ImportError:
    from assistant import router as assistant_router
    from auth import AuthUser, get_current_user, init_auth_db, router as auth_router
    from db import connect_db
    from mesh_service import gmsh_available
    from project_service import count_user_geometries, count_user_projects
    from projects import initialize_project_schema, router as projects_router


app = FastAPI(title="WebMsh API", version="0.2.0")
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "WEBMSH_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(assistant_router)


@app.on_event("startup")
async def on_startup():
    init_auth_db()
    initialize_project_schema()


@app.get("/", tags=["system"])
async def root():
    return {"message": "WebMsh API is running", "docs": "/docs"}


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}


@app.get("/info", tags=["system"])
async def info(current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        return {
            "name": "WebMsh",
            "version": "0.2.0",
            "gmsh_available": gmsh_available(),
            "project_count": count_user_projects(conn, current_user.id),
            "geometry_count": count_user_geometries(conn, current_user.id),
        }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)

import json
import sqlite3
from typing import Any

from fastapi import HTTPException

try:
    from .db import isoformat_ts, now_ts
    from .project_models import GeometryRecord, Mesh, ProjectDetail, ProjectSummary
except ImportError:
    from db import isoformat_ts, now_ts
    from project_models import GeometryRecord, Mesh, ProjectDetail, ProjectSummary


def init_project_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_opened_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS project_geometries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            params TEXT NOT NULL,
            mesh TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_project_geometries_project ON project_geometries(project_id, id);
        """
    )

    project_columns = {
        str(row["name"])
        for row in conn.execute("PRAGMA table_info(projects)").fetchall()
    }
    if "last_opened_at" not in project_columns:
        conn.execute("ALTER TABLE projects ADD COLUMN last_opened_at INTEGER")


def list_projects(conn: sqlite3.Connection, user_id: int) -> list[ProjectSummary]:
    rows = conn.execute(
        """
        SELECT
            p.id,
            p.name,
            p.created_at,
            p.updated_at,
            p.last_opened_at,
            COUNT(pg.id) AS geometry_count
        FROM projects p
        LEFT JOIN project_geometries pg ON pg.project_id = p.id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY COALESCE(p.last_opened_at, p.updated_at) DESC, p.id DESC
        """,
        (user_id,),
    ).fetchall()
    return [_row_to_project_summary(row) for row in rows]


def create_project(conn: sqlite3.Connection, user_id: int, name: str) -> ProjectSummary:
    timestamp = now_ts()
    conn.execute(
        """
        INSERT INTO projects (user_id, name, created_at, updated_at, last_opened_at)
        VALUES (?, ?, ?, ?, NULL)
        """,
        (user_id, name, timestamp, timestamp),
    )
    project_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
    return _get_project_summary(conn, user_id, project_id)


def rename_project(conn: sqlite3.Connection, user_id: int, project_id: int, name: str) -> ProjectSummary:
    _assert_project_owned(conn, user_id, project_id)
    conn.execute(
        "UPDATE projects SET name = ?, updated_at = ? WHERE id = ?",
        (name, now_ts(), project_id),
    )
    return _get_project_summary(conn, user_id, project_id)


def get_project_detail(
    conn: sqlite3.Connection,
    user_id: int,
    project_id: int,
    *,
    touch_last_opened: bool = False,
) -> ProjectDetail:
    _assert_project_owned(conn, user_id, project_id)
    if touch_last_opened:
        conn.execute(
            "UPDATE projects SET last_opened_at = ? WHERE id = ?",
            (now_ts(), project_id),
        )
    summary = _get_project_summary(conn, user_id, project_id)
    geometries = _list_project_geometries_by_project(conn, project_id)
    return ProjectDetail(**summary.model_dump(), geometries=geometries)


def delete_project(conn: sqlite3.Connection, user_id: int, project_id: int) -> ProjectSummary:
    summary = _get_project_summary(conn, user_id, project_id)
    conn.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
    return summary


def list_project_geometries(conn: sqlite3.Connection, user_id: int, project_id: int) -> list[GeometryRecord]:
    _assert_project_owned(conn, user_id, project_id)
    return _list_project_geometries_by_project(conn, project_id)


def create_geometry(
    conn: sqlite3.Connection,
    user_id: int,
    project_id: int,
    geometry_type: str,
    params: dict[str, Any],
    mesh: Mesh | None,
) -> GeometryRecord:
    _assert_project_owned(conn, user_id, project_id)
    timestamp = now_ts()
    conn.execute(
        """
        INSERT INTO project_geometries (project_id, type, params, mesh, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            geometry_type,
            json.dumps(params),
            json.dumps(mesh.model_dump(mode="json")) if mesh else None,
            timestamp,
            timestamp,
        ),
    )
    geometry_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
    conn.execute(
        "UPDATE projects SET updated_at = ? WHERE id = ?",
        (timestamp, project_id),
    )
    return _get_geometry_record(conn, user_id, project_id, geometry_id)


def delete_geometry(
    conn: sqlite3.Connection,
    user_id: int,
    project_id: int,
    geometry_id: int,
) -> GeometryRecord:
    geometry = _get_geometry_record(conn, user_id, project_id, geometry_id)
    conn.execute("DELETE FROM project_geometries WHERE id = ? AND project_id = ?", (geometry_id, project_id))
    conn.execute(
        "UPDATE projects SET updated_at = ? WHERE id = ?",
        (now_ts(), project_id),
    )
    return geometry


def count_user_projects(conn: sqlite3.Connection, user_id: int) -> int:
    row = conn.execute("SELECT COUNT(*) AS count FROM projects WHERE user_id = ?", (user_id,)).fetchone()
    return int(row["count"]) if row else 0


def count_user_geometries(conn: sqlite3.Connection, user_id: int) -> int:
    row = conn.execute(
        """
        SELECT COUNT(pg.id) AS count
        FROM project_geometries pg
        JOIN projects p ON p.id = pg.project_id
        WHERE p.user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return int(row["count"]) if row else 0


def _assert_project_owned(conn: sqlite3.Connection, user_id: int, project_id: int) -> None:
    row = conn.execute(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")


def _get_project_summary(conn: sqlite3.Connection, user_id: int, project_id: int) -> ProjectSummary:
    row = conn.execute(
        """
        SELECT
            p.id,
            p.name,
            p.created_at,
            p.updated_at,
            p.last_opened_at,
            COUNT(pg.id) AS geometry_count
        FROM projects p
        LEFT JOIN project_geometries pg ON pg.project_id = p.id
        WHERE p.user_id = ? AND p.id = ?
        GROUP BY p.id
        """,
        (user_id, project_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _row_to_project_summary(row)


def _list_project_geometries_by_project(conn: sqlite3.Connection, project_id: int) -> list[GeometryRecord]:
    rows = conn.execute(
        """
        SELECT id, type, params, mesh
        FROM project_geometries
        WHERE project_id = ?
        ORDER BY id ASC
        """,
        (project_id,),
    ).fetchall()
    return [_row_to_geometry_record(row) for row in rows]


def _get_geometry_record(
    conn: sqlite3.Connection,
    user_id: int,
    project_id: int,
    geometry_id: int,
) -> GeometryRecord:
    row = conn.execute(
        """
        SELECT pg.id, pg.type, pg.params, pg.mesh
        FROM project_geometries pg
        JOIN projects p ON p.id = pg.project_id
        WHERE pg.id = ? AND pg.project_id = ? AND p.user_id = ?
        """,
        (geometry_id, project_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Geometry not found")
    return _row_to_geometry_record(row)


def _row_to_project_summary(row: sqlite3.Row) -> ProjectSummary:
    return ProjectSummary(
        id=int(row["id"]),
        name=str(row["name"]),
        created_at=isoformat_ts(int(row["created_at"])) or "",
        updated_at=isoformat_ts(int(row["updated_at"])) or "",
        last_opened_at=isoformat_ts(int(row["last_opened_at"])) if row["last_opened_at"] is not None else None,
        geometry_count=int(row["geometry_count"] or 0),
    )


def _row_to_geometry_record(row: sqlite3.Row) -> GeometryRecord:
    raw_params = row["params"] or "{}"
    raw_mesh = row["mesh"]
    mesh = Mesh.model_validate(json.loads(raw_mesh)) if raw_mesh else None
    return GeometryRecord(
        id=int(row["id"]),
        type=str(row["type"]),
        params=json.loads(raw_params),
        mesh=mesh,
    )

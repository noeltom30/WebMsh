import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DB_PATH = Path(os.getenv("WEBMSH_DB_PATH", str(Path(__file__).resolve().parent / "webmsh_auth.sqlite3")))
DATABASE_URL = os.getenv("WEBMSH_DATABASE_URL") or os.getenv("DATABASE_URL")


class DatabaseConnection:
    def __init__(self, raw_conn: Any, dialect: str):
        self.raw_conn = raw_conn
        self.dialect = dialect

    def __enter__(self) -> "DatabaseConnection":
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        try:
            if exc_type is None:
                self.raw_conn.commit()
            else:
                self.raw_conn.rollback()
        finally:
            self.raw_conn.close()

    def execute(self, sql: str, params: tuple[Any, ...] | list[Any] | None = None):
        if self.dialect == "postgres":
            sql = self._postgres_sql(sql)
        return self.raw_conn.execute(sql, params or ())

    def executescript(self, script: str) -> None:
        for statement in script.split(";"):
            sql = statement.strip()
            if sql:
                self.execute(sql)

    def _postgres_sql(self, sql: str) -> str:
        normalized = " ".join(sql.strip().lower().split())
        if normalized == "select last_insert_rowid() as id":
            return "SELECT lastval() AS id"
        return sql.replace("?", "%s")


def connect_db() -> DatabaseConnection:
    if DATABASE_URL:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "WEBMSH_DATABASE_URL is set, but psycopg is not installed. "
                "Install dependencies from backend/requirements.txt."
            ) from exc

        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        return DatabaseConnection(conn, "postgres")

    conn = sqlite3.connect(DB_PATH, timeout=90, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    wrapped = DatabaseConnection(conn, "sqlite")
    wrapped.execute("PRAGMA foreign_keys = ON")
    wrapped.execute("PRAGMA busy_timeout = 90000")
    wrapped.execute("PRAGMA journal_mode = DELETE")
    wrapped.execute("PRAGMA synchronous = NORMAL")
    return wrapped


def is_postgres(conn: DatabaseConnection) -> bool:
    return conn.dialect == "postgres"


def table_columns(conn: DatabaseConnection, table_name: str) -> set[str]:
    if is_postgres(conn):
        rows = conn.execute(
            """
            SELECT column_name AS name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            """,
            (table_name,),
        ).fetchall()
    else:
        rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def now_ts() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def isoformat_ts(value: int | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat().replace("+00:00", "Z")

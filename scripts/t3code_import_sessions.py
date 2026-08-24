#!/usr/bin/env python3
"""Import T3 Code conversation history into Hermes' session store.

T3 Code (pingdotgg/t3code) keeps its threads in ~/.t3/userdata/state.sqlite:

    projection_threads          thread_id, project_id, title, created_at, updated_at, deleted_at
    projection_projects         project_id, title, workspace_root
    projection_thread_messages  message_id, thread_id, role, text, created_at, is_streaming

This script converts every non-deleted thread into a Hermes session and writes
it through ``SessionDB.import_sessions`` (the same import path the dashboard's
Sessions page uses), so imported threads show up in ``hermes sessions list``
and are resumable/searchable like native sessions.

``hermes import-agent t3code`` deliberately does NOT do this part: the CLI
importer only writes one summary memory entry, while full bodies belong in the
session store — which requires write access to state.db and therefore lives in
this standalone script.

Usage:
    python scripts/t3code_import_sessions.py            # dry run (default)
    python scripts/t3code_import_sessions.py --execute  # actually import
    python scripts/t3code_import_sessions.py --project loramake
    python scripts/t3code_import_sessions.py --source ~/.t3/userdata --limit 10

Safety:
- Read-only connection (mode=ro) against the T3 database; a running T3 app is
  never disturbed.
- Session ids are prefixed ``t3-`` so they can never collide with native ones;
  existing ids are skipped by import_sessions (re-runs are idempotent).
- Streaming placeholders (is_streaming=1) and empty texts are dropped.
- Defaults to dry run; nothing is written without --execute.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

HERMES_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERMES_REPO))

from hermes_state import SessionDB  # noqa: E402

DEFAULT_T3_USERDATA = Path.home() / ".t3" / "userdata"
SESSION_ID_PREFIX = "t3-"


def t3_epoch(iso: str | None) -> float | None:
    """Parse T3 ISO8601 timestamps ('2026-07-22T13:12:46.581Z') to epoch s."""
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def open_t3_db(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise SystemExit(f"T3 database not found: {db_path}")
    return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)


def fetch_threads(con: sqlite3.Connection, project_filter: str | None):
    """Return [(thread_row, project_row)] for active threads, oldest first."""
    where = "WHERE t.deleted_at IS NULL"
    params: list = []
    if project_filter:
        # Match on project title OR a substring of the workspace root.
        where += " AND (p.title LIKE ? OR p.workspace_root LIKE ?)"
        like = f"%{project_filter}%"
        params = [like, like]
    rows = con.execute(
        f"""
        SELECT t.thread_id, t.title, t.created_at, t.updated_at,
               p.title AS project_title, p.workspace_root
        FROM projection_threads t
        LEFT JOIN projection_projects p ON p.project_id = t.project_id
        {where}
        ORDER BY t.created_at
        """,
        params,
    ).fetchall()
    return rows


def build_session(thread: tuple, messages: list[dict]) -> dict:
    thread_id, title, created_at, updated_at, _proj, workspace_root = thread
    started = t3_epoch(created_at) or time.time()
    ended = t3_epoch(updated_at)
    stamps = [m["timestamp"] for m in messages] or [started]
    first_user = next((m["content"] for m in messages if m["role"] == "user"), None)
    display_title = (title or "").strip() or (first_user or "")[:80].strip() \
        or "(imported T3 thread)"
    return {
        "id": f"{SESSION_ID_PREFIX}{thread_id}",
        "source": "t3code",
        "model": None,
        "title": display_title[:200],
        "cwd": workspace_root or None,
        "git_repo_root": workspace_root or None,
        "started_at": min(stamps[0], started),
        "ended_at": max(ended or 0.0, *stamps) or None,
        "end_reason": "completed",
        "archived": True,  # imported history starts archived; unarchive at will
        "messages": messages,
    }


def load_messages(con: sqlite3.Connection, thread_id: str) -> list[dict]:
    rows = con.execute(
        """
        SELECT text, role, created_at
        FROM projection_thread_messages
        WHERE thread_id = ? AND is_streaming = 0
        ORDER BY created_at, message_id
        """,
        (thread_id,),
    ).fetchall()
    messages = []
    for text, role, created_at in rows:
        clean = (text or "").strip()
        if not clean:
            continue
        # T3 roles: 'user' and 'assistant:<uuid>' — normalize to Hermes roles.
        norm_role = "assistant" if role.startswith("assistant") else (
            role if role in ("user", "system") else "user")
        ts = t3_epoch(created_at)
        messages.append({
            "role": norm_role,
            "content": clean,
            "timestamp": ts,
        })
    return messages


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Import T3 Code threads into the Hermes session store.",
    )
    ap.add_argument("--source", type=Path, default=DEFAULT_T3_USERDATA,
                    help="T3 userdata dir containing state.sqlite "
                         "(default: %(default)s)")
    ap.add_argument("--project", default=None,
                    help="Only threads whose project title/workspace root "
                         "matches this substring")
    ap.add_argument("--limit", type=int, default=None,
                    help="Import at most N threads")
    ap.add_argument("--execute", action="store_true",
                    help="Actually write to Hermes state.db (default: dry run)")
    args = ap.parse_args()

    con = open_t3_db(args.source / "state.sqlite")
    try:
        threads = fetch_threads(con, args.project)
        if args.limit:
            threads = threads[-args.limit:]  # keep the most recent N
        if not threads:
            print("Nothing to import (no matching active threads).")
            return

        sessions = []
        total_msgs = 0
        print(f"{'threads':>7} {'msgs':>6}  title")
        for thread in threads:
            messages = load_messages(con, thread[0])
            total_msgs += len(messages)
            sessions.append(build_session(thread, messages))
        print(f"{len(sessions):>7} {total_msgs:>6}  matched")

        if not args.execute:
            print("\nDRY RUN — nothing written. Re-run with --execute to import.")
            return

        db = SessionDB()
        try:
            result = db.import_sessions(sessions)
        finally:
            db.close()

        ok = result.get("ok")
        print(f"\nimported={result.get('imported')} skipped="
              f"{result.get('skipped')} detached={result.get('detached')}")
        if not ok:
            for err in result.get("errors", []):
                print(f"  error: {err}")
            raise SystemExit("import failed")
        print("Done.")
    finally:
        con.close()


if __name__ == "__main__":
    main()

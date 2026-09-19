#!/usr/bin/env python3
"""Static quiz app + local media uploads into ./media."""

from __future__ import annotations

import json
import os
import re
import uuid
from email import policy
from email.parser import BytesParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEDIA_ROOT = ROOT / "media"
PORT = int(os.environ.get("PORT", "8088"))
MAX_BYTES = 200 * 1024 * 1024
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
ALLOWED_EXT = {
    "image": {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"},
    "audio": {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"},
    "video": {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"},
}


def json_bytes(data: dict) -> bytes:
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def safe_id(value: str) -> str:
    value = (value or "").strip()
    if not SAFE_ID.match(value):
        raise ValueError("bad id")
    return value


def safe_filename(name: str) -> str:
    base = Path(name or "file").name
    cleaned = SAFE_NAME.sub("_", base).strip("._")[:80]
    return cleaned or "file"


def kind_from_name(name: str, declared: str | None = None) -> str:
    ext = Path(name).suffix.lower()
    if declared in ALLOWED_EXT:
        if ext in ALLOWED_EXT[declared]:
            return declared
        raise ValueError("file does not match this media slot")
    for kind, exts in ALLOWED_EXT.items():
        if ext in exts:
            return kind
    raise ValueError("unsupported file type")


def media_url(rel: Path) -> str:
    return "/" + rel.as_posix()


def resolve_media_url(url: str) -> Path:
    if not url.startswith("/media/"):
        raise ValueError("not a media url")
    rel = Path(url.lstrip("/"))
    full = (ROOT / rel).resolve()
    if MEDIA_ROOT not in full.parents and full != MEDIA_ROOT:
        raise ValueError("path escape")
    return full


def parse_multipart(handler: SimpleHTTPRequestHandler):
    content_type = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length > MAX_BYTES:
        raise ValueError("file too large")
    body = handler.rfile.read(length)
    header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode()
    msg = BytesParser(policy=policy.default).parsebytes(header + body)
    fields: dict[str, str] = {}
    files: dict[str, tuple[str, bytes]] = {}
    parts = list(msg.iter_parts()) if msg.is_multipart() else [msg]
    for part in parts:
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            files[str(name)] = (filename, payload)
        else:
            fields[str(name)] = payload.decode("utf-8", errors="replace")
    return fields, files


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _send_json(self, code: int, data: dict):
        payload = json_bytes(data)
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_POST(self):
        try:
            if self.path == "/api/upload":
                self.handle_upload()
                return
            if self.path == "/api/copy":
                self.handle_copy()
                return
            if self.path == "/api/seed-packs":
                self.handle_seed_packs()
                return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self.send_error(404)

    def do_DELETE(self):
        try:
            if self.path == "/api/media":
                data = self._read_json()
                path = resolve_media_url(data.get("url", ""))
                if path.is_file():
                    path.unlink()
                self._send_json(200, {"ok": True})
                return
            if self.path == "/api/pack-media":
                data = self._read_json()
                pack_id = safe_id(data.get("packId", ""))
                folder = MEDIA_ROOT / pack_id
                if folder.is_dir():
                    for item in folder.rglob("*"):
                        if item.is_file():
                            item.unlink()
                    for item in sorted(folder.rglob("*"), reverse=True):
                        if item.is_dir():
                            item.rmdir()
                    folder.rmdir()
                self._send_json(200, {"ok": True})
                return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self.send_error(404)

    def handle_upload(self):
        fields, files = parse_multipart(self)
        if "file" not in files:
            raise ValueError("file is required")
        filename, payload = files["file"]
        if not payload:
            raise ValueError("empty file")
        pack_id = safe_id(fields.get("packId", ""))
        question_id = safe_id(fields.get("questionId", ""))
        kind = kind_from_name(filename, fields.get("kind"))
        slot = fields.get("slot") if fields.get("slot") in {"question", "answer"} else "question"
        dest_dir = MEDIA_ROOT / pack_id / question_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        stored = f"{slot}_{kind}_{uuid.uuid4().hex[:8]}_{safe_filename(filename)}"
        dest = dest_dir / stored
        dest.write_bytes(payload)
        rel = dest.relative_to(ROOT)
        self._send_json(
            200,
            {
                "url": media_url(rel),
                "name": filename,
                "kind": kind,
            },
        )

    def handle_copy(self):
        data = self._read_json()
        source = resolve_media_url(data.get("fromUrl", ""))
        if not source.is_file():
            raise ValueError("source file missing")
        pack_id = safe_id(data.get("packId", ""))
        question_id = safe_id(data.get("questionId", ""))
        kind = kind_from_name(source.name, data.get("kind"))
        slot = data.get("slot") if data.get("slot") in {"question", "answer"} else "question"
        dest_dir = MEDIA_ROOT / pack_id / question_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        stored = f"{slot}_{kind}_{uuid.uuid4().hex[:8]}_{safe_filename(source.name)}"
        dest = dest_dir / stored
        dest.write_bytes(source.read_bytes())
        self._send_json(200, {"url": media_url(dest.relative_to(ROOT)), "name": source.name, "kind": kind})

    def handle_seed_packs(self):
        data = self._read_json()
        packs = data.get("packs")
        if not isinstance(packs, list) or not packs:
            raise ValueError("packs required")
        dest = ROOT / "js" / "seed-packs.js"
        dest.write_text("export default " + json.dumps(packs, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
        self._send_json(200, {"ok": True, "count": len(packs), "path": "js/seed-packs.js"})

    def log_message(self, format, *args):
        print("[%s] %s" % (self.log_date_time_string(), format % args))


def main():
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Quiz Arena -> http://localhost:{PORT}")
    print(f"Media folder -> {MEDIA_ROOT}")
    server.serve_forever()


if __name__ == "__main__":
    main()

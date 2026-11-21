#!/usr/bin/env python3
# /// script
# requires-python = ">=3.14"
# dependencies = []
# ///
"""Download the fonts declared in fonts.toml into ~/.local/share/fonts and rebuild
the fontconfig cache.

Fonts are large, so none of them live in git: this script plus the
`install-fonts` mise task are what reproduce them. Each family declares where it
comes from, either an archive plus the members to take or a few plain file URLs,
and everything lands in one directory of its own.

Archives are read with HTTP range requests, so a family that only wants the ttf
members of a 217 MiB zip transfers ~54 MiB instead of the whole file. A
per-family state file records what was installed, so an unchanged machine checks
local sizes and never touches the network.

No third-party dependencies: TOML comes from the stdlib (tomllib), so the PEP 723
`dependencies` list above stays empty and plain `python install_fonts.py` runs it.

    python install_fonts.py [-manifest FILE] [-root DIR] [-state DIR] [-only NAME,...] [-force]
"""

import argparse
import contextlib
import hashlib
import http.client
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import tomllib
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

UA = "fonts-installer/1.0 (+dotfiles)"

# block_size/max_blocks trade HTTP requests against memory: zipfile reads the
# central directory, then small local headers, then ~32 KiB at a time while
# inflating, so one block satisfies many reads.
BLOCK_SIZE = 4 << 20
MAX_BLOCKS = 6


@dataclass(frozen=True)
class Family:
    """One font family: where its files come from, and where they go."""

    url: str = ""  # archive holding the members below
    globs: list[str] = field(default_factory=list)  # archive members to take
    files: list[str] = field(default_factory=list)  # direct file URLs
    dest: str = ""  # directory under the font root, default family name

    def destination(self, name: str) -> str:
        return self.dest or name


@dataclass(frozen=True)
class Entry:
    """One installed file: the name it gets and the size it must have."""

    name: str
    size: int  # 0 when unknown


@dataclass(frozen=True)
class Remote:
    """An entry that can also be fetched."""

    entry: Entry
    open: object  # callable returning a binary reader


def main(argv: list[str] | None = None) -> int:
    home = Path.home()
    p = argparse.ArgumentParser(
        prog="install_fonts.py",
        description="Download the fonts declared in fonts.toml into the font root.",
    )
    p.add_argument("-manifest", "--manifest", default="", help="manifest to read (default: fonts.toml next to this script)")
    p.add_argument("-root", "--root", default=str(home / ".local" / "share" / "fonts"), help="font directory")
    p.add_argument("-state", "--state", default=str(home / ".local" / "state" / "fonts"), help="install state directory")
    p.add_argument("-only", "--only", default="", help="comma-separated families to install (default: all)")
    p.add_argument("-force", "--force", action="store_true", help="download again even when the fonts are already installed")
    args = p.parse_args(argv)

    try:
        run(args.manifest, args.root, args.state, split_list(args.only), args.force)
    except Exception as err:  # noqa: BLE001 - top-level reporting like the old Go binary
        print(f"fonts: {err}", file=sys.stderr)
        return 1
    return 0


def run(manifest_path: str, root: str, state_dir: str, only: list[str], force: bool) -> None:
    families = load(manifest_path)
    names = select_families(families, only)

    dirs: list[str] = []
    installed = 0
    for name in names:
        added, dest = install_family(name, families[name], root, state_dir, force)
        if added == 0:
            print(f"{name:<16} up to date")
            continue
        dirs.append(dest)
        installed += added
    if installed > 0:
        fc_cache(dirs)
        print(f"fonts: {installed} files installed")


def install_family(name: str, f: Family, root: str, state_dir: str, force: bool) -> tuple[int, str]:
    """Bring one family up to date and report how many files it wrote."""
    try:
        return _install_family(name, f, root, state_dir, force)
    except Exception as err:
        raise RuntimeError(f"{name}: {err}") from err


def _install_family(name: str, f: Family, root: str, state_dir: str, force: bool) -> tuple[int, str]:
    dest = os.path.join(root, f.destination(name))
    state_path = os.path.join(state_dir, f"{name}.state")
    spec = spec_hash(f)

    # Fast path: the state file lists what this directory holds, so an unchanged
    # machine only stats local files and never touches the network.
    if not force and up_to_date(state_path, spec, dest):
        return 0, dest

    remotes_ = remotes(f)
    os.makedirs(dest, mode=0o755, exist_ok=True)
    os.makedirs(state_dir, mode=0o755, exist_ok=True)

    todo = [r for r in remotes_ if force or not exists(os.path.join(dest, r.entry.name), r.entry.size)]
    if not todo:
        write_state(state_path, spec, remotes_)
        return 0, dest

    print(f"{name:<16} installing {len(todo)}/{len(remotes_)} files into {dest}")
    added = 0
    for r in todo:
        written = install(dest, r)
        print(f"  {r.entry.name:<26} {size(written)}")
        added += 1
    write_state(state_path, spec, remotes_)
    return added, dest


def remotes(f: Family) -> list[Remote]:
    """Every file the family installs. Archive families read the remote index
    here, which is the one network access the state file cannot avoid."""
    if f.url:
        length = remote_size(f.url)
        zf = zipfile.ZipFile(HTTPZipFile(HTTPReaderAt(f.url, length)))
        out: list[Remote] = []
        for info in zf.infolist():
            if match_any(f.globs, info.filename):
                out.append(Remote(Entry(posix_base(info.filename), info.file_size), lambda i=info: zf.open(i)))
        if not out:
            raise RuntimeError(f"{f.url}: no member matches {' or '.join(f.globs)}")
        return out

    out = []
    for u in f.files:
        out.append(Remote(Entry(url_base(u), 0), lambda u=u: http_get(u)))
    return out


def install(dest: str, r: Remote) -> int:
    """Write one file through a temp file: the rename is what publishes it, so
    fontconfig never sees a half-written font. Returns the bytes written."""
    rc = r.open()
    try:
        fd, tmp = tempfile.mkstemp(dir=dest, prefix="." + r.entry.name + ".")
        try:
            written = 0
            with os.fdopen(fd, "wb") as out:
                while chunk := rc.read(1 << 20):
                    out.write(chunk)
                    written += len(chunk)
            if r.entry.size > 0 and written != r.entry.size:
                raise RuntimeError(f"{r.entry.name}: got {written} bytes, want {r.entry.size}")
            os.chmod(tmp, 0o644)
            os.replace(tmp, os.path.join(dest, r.entry.name))
        except BaseException:
            with contextlib.suppress(OSError):
                os.unlink(tmp)
            raise
    finally:
        rc.close()
    return written


def exists(p: str, size: int) -> bool:
    """Whether p is already installed at the expected size."""
    try:
        st = os.stat(p)
    except OSError:
        return False
    return size == 0 or st.st_size == size


def up_to_date(state_path: str, spec: str, dest: str) -> bool:
    try:
        st_spec, files = read_state(state_path)
    except (OSError, ValueError):
        return False
    if st_spec != spec:
        return False
    return all(exists(os.path.join(dest, e.name), e.size) for e in files)


def read_state(p: str) -> tuple[str, list[Entry]]:
    spec = ""
    files: list[Entry] = []
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if line.startswith("# spec "):
                spec = line[len("# spec "):]
                continue
            name, _, raw = line.partition(" ")
            try:
                n = int(raw)
            except ValueError:
                continue
            if not name:
                continue
            files.append(Entry(name, n))
    if not spec or not files:
        raise ValueError("no usable state")
    return spec, files


def write_state(p: str, spec: str, files: list[Remote]) -> None:
    body = [f"# spec {spec}\n"]
    body += [f"{r.entry.size} {r.entry.name}\n" for r in files]
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("".join(body))
    os.chmod(p, 0o644)


def spec_hash(f: Family) -> str:
    """Tie a state file to the manifest entry that produced it, so editing a
    family (new url, new globs) invalidates the old state."""
    return hashlib.sha256(repr(f).encode()).hexdigest()[:16]


def load(path: str) -> dict[str, Family]:
    if path:
        data = Path(path).read_bytes()
    else:
        data = (Path(__file__).resolve().parent / "fonts.toml").read_bytes()
    raw = tomllib.loads(data.decode())
    fonts = raw.get("fonts") or {}
    if not fonts:
        raise RuntimeError("manifest declares no fonts")
    out: dict[str, Family] = {}
    for name, spec in fonts.items():
        f = Family(
            url=spec.get("url", ""),
            globs=list(spec.get("globs", [])),
            files=list(spec.get("files", [])),
            dest=spec.get("dest", ""),
        )
        if not f.url and not f.files:
            raise RuntimeError(f"fonts.{name}: needs url or files")
        if f.url and f.files:
            raise RuntimeError(f"fonts.{name}: url and files are mutually exclusive")
        if f.url and not f.globs:
            raise RuntimeError(f"fonts.{name}: url needs globs")
        out[name] = f
    return out


def select_families(families: dict[str, Family], only: list[str]) -> list[str]:
    if not only:
        return sorted(families)
    for name in only:
        if name not in families:
            raise RuntimeError(f'unknown font "{name}"')
    return only


def match_any(globs: list[str], name: str) -> bool:
    # Go's path.Match semantics: `*` and `?` never cross a path separator, which
    # a plain fnmatch-style translation would not honour.
    return any(pmatch(g, name) for g in globs)


_glob_cache: dict[str, re.Pattern[str]] = {}


def pmatch(pattern: str, name: str) -> bool:
    rx = _glob_cache.get(pattern)
    if rx is None:
        rx = _glob_cache[pattern] = re.compile(glob_regex(pattern), re.S)
    return rx.match(name) is not None


def glob_regex(pattern: str) -> str:
    out = ["\\A"]
    i = 0
    while i < len(pattern):
        c = pattern[i]
        i += 1
        if c == "*":
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
        elif c == "\\":
            if i < len(pattern):
                out.append(re.escape(pattern[i]))
                i += 1
            else:
                out.append(re.escape(c))
        elif c == "[":
            j = i
            if j < len(pattern) and pattern[j] == "^":
                j += 1
            if j < len(pattern) and pattern[j] == "]":
                j += 1
            while j < len(pattern) and pattern[j] != "]":
                j += 1
            if j >= len(pattern):
                out.append(re.escape("["))
                continue
            inner = pattern[i:j]
            i = j + 1
            if inner.startswith("^"):
                inner = "^" + inner[1:]
            out.append("[" + inner.replace("\\", "\\\\") + "]")
        else:
            out.append(re.escape(c))
    out.append("\\Z")
    return "".join(out)


def posix_base(name: str) -> str:
    return name.rsplit("/", 1)[-1]


def url_base(url: str) -> str:
    return urllib.request.urlsplit(url).path.rsplit("/", 1)[-1]


def http_get(url: str) -> io.BufferedIOBase:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        resp = urllib.request.urlopen(req, timeout=600)
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"{url}: {err.code} {err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"{url}: {err.reason}") from err
    return resp


def remote_size(url: str) -> int:
    """Ask for a length up front: zipfile needs the archive size to seek to the
    central directory."""
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            length = int(resp.headers.get("Content-Length") or 0)
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"{url}: {err.code} {err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"{url}: {err.reason}") from err
    if length <= 0:
        raise RuntimeError(f"{url}: no Content-Length")
    return length


def fc_cache(dirs: list[str]) -> None:
    if not shutil.which("fc-cache"):
        return
    proc = subprocess.run(["fc-cache", "-f", *dirs], capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        print(f"fonts: fc-cache: exit {proc.returncode}: {proc.stderr.strip()}", file=sys.stderr)
        return
    print(f"fonts: font cache rebuilt for {' '.join(dirs)}")


def split_list(s: str) -> list[str]:
    return [part.strip() for part in s.split(",") if part.strip()]


def size(n: int) -> str:
    if n <= 0:
        return "-"
    return f"{n / (1 << 20):7.2f} MiB"


class HTTPReaderAt:
    """A ReaderAt over HTTP range requests with a small block cache, which is what
    lets zipfile read a remote archive. It is also why a family only pays for the
    members it actually takes."""

    def __init__(self, url: str, length: int) -> None:
        self.url = url
        self.length = length
        self._blocks: dict[int, bytes] = {}
        self._order: list[int] = []
        self._lock = threading.Lock()

    def read_at(self, offset: int, length: int) -> bytes:
        chunks: list[bytes] = []
        got = 0
        while got < length and offset + got < self.length:
            pos = offset + got
            start = pos // BLOCK_SIZE * BLOCK_SIZE
            blk = self.block(start)
            take = blk[pos - start: pos - start + (length - got)]
            if not take:
                break
            chunks.append(take)
            got += len(take)
        return b"".join(chunks)

    def block(self, start: int) -> bytes:
        with self._lock:
            cached = self._blocks.get(start)
        if cached is not None:
            return cached

        want = min(BLOCK_SIZE, self.length - start)
        req = urllib.request.Request(self.url, headers={"User-Agent": UA, "Range": f"bytes={start}-{start + want - 1}"})
        try:
            resp = urllib.request.urlopen(req, timeout=300)
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{self.url}: {err.code} {err.reason}") from err
        except urllib.error.URLError as err:
            raise RuntimeError(f"{self.url}: {err.reason}") from err
        with resp:
            if resp.status != http.client.PARTIAL_CONTENT:
                raise RuntimeError(f"{self.url}: range request rejected ({resp.status} {resp.reason})")
            blk = resp.read()
        if len(blk) != want:
            raise RuntimeError("short range response")

        with self._lock:
            if len(self._order) == MAX_BLOCKS:
                del self._blocks[self._order.pop(0)]
            self._blocks[start] = blk
            self._order.append(start)
        return blk


class HTTPZipFile(io.RawIOBase):
    """The seekable read-only file object zipfile expects, backed by HTTPReaderAt."""

    def __init__(self, ra: HTTPReaderAt) -> None:
        super().__init__()
        self._ra = ra
        self._pos = 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self._pos

    def seek(self, offset: int, whence: int = os.SEEK_SET) -> int:
        if whence == os.SEEK_SET:
            pos = offset
        elif whence == os.SEEK_CUR:
            pos = self._pos + offset
        elif whence == os.SEEK_END:
            pos = self._ra.length + offset
        else:
            raise ValueError(f"invalid whence {whence}")
        if pos < 0:
            raise ValueError("negative seek position")
        self._pos = pos
        return pos

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            n = max(0, self._ra.length - self._pos)
        data = self._ra.read_at(self._pos, n)
        self._pos += len(data)
        return data

    def readinto(self, b: bytearray | memoryview) -> int:
        data = self.read(len(b))
        b[: len(data)] = data
        return len(data)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Releases, driven by two files you edit on your branch:

    RELEASE        release=major | minor | patch | none
    CHANGELOG.md   what changed, under "## [Unreleased]"

    python3 scripts/release.py kind    print what RELEASE asks for (major/minor/patch/none)
    python3 scripts/release.py check   RELEASE is valid, and a release has changelog notes
                                       (runs on every pull request)
    python3 scripts/release.py apply   the release itself (runs on every merge to main):
                                       bump the version everywhere (bump-my-version,
                                       .bumpversion.toml), turn [Unreleased] into the new
                                       version, set RELEASE back to none. Prints the new
                                       version and writes its notes to $RELEASE_NOTES
                                       (default: release-notes.md, not committed);
                                       does nothing when RELEASE says none.

Only the standard library; bump-my-version must be installed for "apply".
"""

import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / "RELEASE"
CHANGELOG = ROOT / "CHANGELOG.md"
NOTES = Path(os.environ.get("RELEASE_NOTES", ROOT / "release-notes.md"))
KINDS = ("major", "minor", "patch", "none")

RELEASE_LINE = re.compile(r"^\s*release\s*=\s*(\S+)\s*$", re.IGNORECASE | re.MULTILINE)
UNRELEASED = re.compile(r"^## \[Unreleased\][^\n]*\n(.*?)(?=^## \[|\Z)", re.MULTILINE | re.DOTALL)


class ReleaseError(Exception):
    pass


def release_kind() -> str:
    """The kind of release RELEASE asks for (lower case)."""
    lines = RELEASE_LINE.findall(RELEASE.read_text())
    if len(lines) != 1:
        raise ReleaseError(f"RELEASE needs exactly one 'release=...' line ({', '.join(KINDS)}).")
    kind = lines[0].lower()
    if kind not in KINDS:
        raise ReleaseError(f"RELEASE says release={lines[0]}; use one of: {', '.join(KINDS)}.")
    return kind


def unreleased_notes() -> str:
    """What's written under [Unreleased] (without the heading), trimmed."""
    match = UNRELEASED.search(CHANGELOG.read_text())
    if not match:
        raise ReleaseError("CHANGELOG.md has no '## [Unreleased]' section.")
    return match.group(1).strip()


def check() -> None:
    kind = release_kind()
    if kind != "none" and not unreleased_notes():
        raise ReleaseError(
            f"RELEASE asks for a {kind} release, but [Unreleased] in CHANGELOG.md is empty. "
            "Write what changed there."
        )
    print(f"RELEASE: {kind}" + ("" if kind == "none" else " (changelog notes found)"))


def current_version() -> str:
    match = re.search(r'^current_version = "([^"]+)"', (ROOT / ".bumpversion.toml").read_text(), re.M)
    if not match:
        raise ReleaseError(".bumpversion.toml has no current_version.")
    return match.group(1)


def apply(today: date | None = None) -> None:
    check()
    kind = release_kind()
    if kind == "none":
        print("No release: RELEASE says none.")
        return
    notes = unreleased_notes()

    subprocess.run(["bump-my-version", "bump", kind], cwd=ROOT, check=True)
    version = current_version()

    # [Unreleased] becomes the new version; a fresh, empty [Unreleased] goes on top.
    heading = f"## [{version}] - {(today or date.today()).isoformat()}"
    changelog = UNRELEASED.sub(
        lambda _: f"## [Unreleased]\n\n{heading}\n\n{notes}\n\n", CHANGELOG.read_text(), count=1
    )
    CHANGELOG.write_text(changelog)
    NOTES.write_text(notes + "\n")
    RELEASE.write_text(RELEASE_LINE.sub("release=none", RELEASE.read_text(), count=1))
    print(version)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if command == "kind":
            print(release_kind())
        elif command == "check":
            check()
        elif command == "apply":
            apply()
        else:
            sys.exit(__doc__)
    except ReleaseError as e:
        sys.exit(f"✗ {e}")

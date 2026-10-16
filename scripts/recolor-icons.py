#!/usr/bin/env python3
"""Recolour the app icon and splash screen to the train colour (--train in
frontend/src/index.css), then regenerate the Android icons and splash screens from them.

    python3 scripts/recolor-icons.py

Run it after changing --train. The images in frontend/assets/ are the train's colour with a
white train on top; each pixel keeps how far it is between the two (the soft edges), with the
new colour instead of the old. Also sets the adaptive icon's background colour
(ic_launcher_background.xml). Needs Pillow (pip install pillow) and, for the last step, npx.
"""

import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
ASSETS = FRONTEND / "assets"
IMAGES = ["icon-background.png", "icon-only.png", "splash.png", "splash-dark.png"]
LAUNCHER_COLOR = FRONTEND / "android/app/src/main/res/values/ic_launcher_background.xml"
WHITE = (255, 255, 255)


def hex_to_rgb(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def train_color() -> tuple[int, int, int]:
    css = (FRONTEND / "src/index.css").read_text()
    match = re.search(r"--train:\s*(#[0-9a-fA-F]{6})\s*;", css)
    if not match:
        sys.exit("✗ No --train: #rrggbb; found in frontend/src/index.css")
    return hex_to_rgb(match.group(1))


def recolor(path: Path, old: tuple[int, int, int], new: tuple[int, int, int]) -> None:
    image = Image.open(path).convert("RGBA")
    # The channel where the old colour and white differ most tells how white a pixel is.
    c = max(range(3), key=lambda i: WHITE[i] - old[i])
    span = WHITE[c] - old[c]
    lookup = {}
    pixels = []
    for r, g, b, a in image.getdata():
        if (r, g, b) not in lookup:
            t = min(1.0, max(0.0, ((r, g, b)[c] - old[c]) / span))
            lookup[(r, g, b)] = tuple(round(n + t * (255 - n)) for n in new)
        pixels.append((*lookup[(r, g, b)], a))
    image.putdata(pixels)
    image.save(path)


def main() -> None:
    new = train_color()
    # The colour the images have now: the background image is all one colour.
    old = Counter(Image.open(ASSETS / "icon-background.png").convert("RGB").getdata()).most_common(1)[0][0]
    hex_new = "#%02x%02x%02x" % new
    if old == new:
        print(f"Icons are already {hex_new}")
    else:
        for name in IMAGES:
            recolor(ASSETS / name, old, new)
        print(f"Recoloured {', '.join(IMAGES)}: #%02x%02x%02x → {hex_new}" % old)
    LAUNCHER_COLOR.write_text(
        LAUNCHER_COLOR.read_text().replace(
            re.search(r">#[0-9a-fA-F]{6}<", LAUNCHER_COLOR.read_text()).group(0), f">{hex_new}<"
        )
    )
    # The Android icon and splash files, in every size, from these images.
    subprocess.run(
        [str(ROOT / "scripts/frontend-run.sh"), "npx", "--yes", "@capacitor/assets", "generate", "--android"],
        check=True,
    )


if __name__ == "__main__":
    main()

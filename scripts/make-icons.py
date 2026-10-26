#!/usr/bin/env python3
"""Make every icon from the logo (frontend/assets/logo.png): the app icon and splash screen,
then the Android icons and splash screens in every size from those, and the browser tab icon
(frontend/public/favicon.png, for the dev server).

    python3 scripts/make-icons.py

Run it after changing the logo. The logo's own background colour (its corner) becomes the
background of the icon and splash screen, so they blend: the launcher icon (full square),
the adaptive icon (Android crops it to a circle or rounded square, so the logo stays inside
the middle 66%) and the splash screen (logo in the middle). Needs Pillow (pip install pillow)
and, for the last step, npx.
"""

import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "frontend/assets"
FAVICON = ROOT / "frontend/public/favicon.png"
LAUNCHER_COLOR = ROOT / "frontend/android/app/src/main/res/values/ic_launcher_background.xml"


def placed(logo: Image.Image, size: int, share: float, background) -> Image.Image:
    """The logo scaled to `share` of a square canvas of `size`, in the middle."""
    canvas = Image.new("RGBA", (size, size), background)
    scale = share * size / max(logo.size)
    w, h = round(logo.width * scale), round(logo.height * scale)
    canvas.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


def main() -> None:
    logo = Image.open(ASSETS / "logo.png").convert("RGBA")
    bg = logo.getpixel((0, 0))[:3] + (255,)
    hex_bg = "#%02x%02x%02x" % bg[:3]

    placed(logo, 1024, 0.9, bg).save(ASSETS / "icon-only.png")  # the launcher icon
    Image.new("RGBA", (1024, 1024), bg).save(ASSETS / "icon-background.png")  # adaptive: back
    placed(logo, 1024, 0.62, (0, 0, 0, 0)).save(ASSETS / "icon-foreground.png")  # adaptive: front
    for name in ("splash.png", "splash-dark.png"):
        placed(logo, 2732, 0.3, bg).save(ASSETS / name)
    placed(logo, 64, 0.98, bg).save(FAVICON)  # the browser tab
    text = LAUNCHER_COLOR.read_text()
    start = text.index(">#") + 1
    LAUNCHER_COLOR.write_text(text[:start] + hex_bg + text[start + 7 :])
    print(f"Icon and splash from logo.png, on {hex_bg}")

    # The Android icon and splash files, in every size, from these images.
    subprocess.run(
        [str(ROOT / "scripts/frontend-run.sh"), "npx", "--yes", "@capacitor/assets", "generate", "--android"],
        check=True,
    )


if __name__ == "__main__":
    main()

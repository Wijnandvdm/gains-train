#!/usr/bin/env python3
"""Make every icon from the logo (frontend/assets/logo.png): the app icon and splash screen,
then the Android icons and splash screens in every size from those, the browser tab icon
(frontend/public/favicon.png, for the dev server), the train in the app itself
(frontend/src/assets/train.png: the logo cut out of its background) and the Google Play
store graphics (docs/store: the 512 x 512 icon and the 1024 x 500 feature graphic, to upload
in the Play Console under store listing → Graphics).

    python3 scripts/make-icons.py

Run it after changing the logo. The logo's own background colour (its corner) becomes the
background of the icon and splash screen, so they blend: the launcher icon (full square),
the adaptive icon (Android crops it to a circle or rounded square, so the logo stays inside
the middle 66%) and the splash screen (logo in the middle). Needs Pillow (pip install pillow),
the Liberation Sans font for the feature graphic (fonts-liberation on Debian/Ubuntu) and, for
the last step, npx.
"""

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "frontend/assets"
FAVICON = ROOT / "frontend/public/favicon.png"
TRAIN = ROOT / "frontend/src/assets/train.png"
LAUNCHER_COLOR = ROOT / "frontend/android/app/src/main/res/values/ic_launcher_background.xml"
STORE = ROOT / "docs/store"

TRAIN_RED = (227, 2, 1)  # --train in frontend/src/index.css
TAGLINE = ["Log gym workouts in a tap.", "No account, no internet:", "it all stays on your phone."]


def trimmed(logo: Image.Image, background) -> Image.Image:
    """The logo without the empty margin around it (pixels close to its background colour)."""
    diff = Image.eval(
        Image.merge("RGB", [
            band.point(lambda v, b=b: 255 if abs(v - b) > 24 else 0)
            for band, b in zip(logo.convert("RGB").split(), background[:3])
        ]).convert("L"),
        lambda v: 255 if v else 0,
    )
    box = diff.getbbox()
    return logo.crop(box) if box else logo


def placed(logo: Image.Image, size: int, share: float, background) -> Image.Image:
    """The logo scaled to `share` of a square canvas of `size`, in the middle."""
    canvas = Image.new("RGBA", (size, size), background)
    scale = share * size / max(logo.size)
    w, h = round(logo.width * scale), round(logo.height * scale)
    canvas.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


def cut_out(logo: Image.Image, background, size: int) -> Image.Image:
    """The logo without its background (see-through, so it sits on any colour of the app),
    in the middle of a square of `size`. Pixels close to the background fade out smoothly."""
    distance = Image.eval(
        Image.merge("RGB", [
            band.point(lambda v, b=b: abs(v - b))
            for band, b in zip(logo.convert("RGB").split(), background[:3])
        ]).convert("L"),
        lambda v: v,
    )
    alpha = distance.point(lambda v: 0 if v < 6 else min(255, (v - 6) * 8))
    drawing = logo.convert("RGBA")
    drawing.putalpha(alpha)
    drawing = drawing.crop(alpha.point(lambda v: 255 if v > 40 else 0).getbbox())
    return placed(drawing, size, 1.0, (0, 0, 0, 0))


def store_graphics(icon: Image.Image, background) -> None:
    """Google Play: the icon (a full square; Play rounds the corners itself) and the feature
    graphic (the logo on the left, the name and the short description on the right)."""
    STORE.mkdir(exist_ok=True)
    icon = icon.convert("RGB")
    icon.resize((512, 512), Image.LANCZOS).save(STORE / "icon-512.png")

    feature = Image.new("RGB", (1024, 500), background[:3])
    feature.paste(icon.resize((440, 440), Image.LANCZOS), (40, 30))
    draw = ImageDraw.Draw(feature)
    title = ImageFont.truetype("LiberationSans-Bold.ttf", 92)
    draw.text((520, 130), "Gains", font=title, fill="white")
    draw.text((520, 225), "Train", font=title, fill=TRAIN_RED)
    small = ImageFont.truetype("LiberationSans-Regular.ttf", 30)
    for i, line in enumerate(TAGLINE):
        draw.text((524, 345 + i * 38), line, font=small, fill=(200, 200, 200))
    feature.save(STORE / "feature-1024x500.png")


def main() -> None:
    logo = Image.open(ASSETS / "logo.png").convert("RGBA")
    bg = logo.getpixel((0, 0))[:3] + (255,)
    logo = trimmed(logo, bg)  # so the drawing itself fills the icon, whatever its margin
    hex_bg = "#%02x%02x%02x" % bg[:3]

    icon = placed(logo, 1024, 0.9, bg)
    icon.save(ASSETS / "icon-only.png")  # the launcher icon
    Image.new("RGBA", (1024, 1024), bg).save(ASSETS / "icon-background.png")  # adaptive: back
    placed(logo, 1024, 0.62, (0, 0, 0, 0)).save(ASSETS / "icon-foreground.png")  # adaptive: front
    for name in ("splash.png", "splash-dark.png"):
        placed(logo, 2732, 0.3, bg).save(ASSETS / name)
    placed(logo, 64, 0.98, bg).save(FAVICON)  # the browser tab
    TRAIN.parent.mkdir(exist_ok=True)
    cut_out(logo, bg, 160).save(TRAIN)  # the train in the app: up to 40 px, on 4x screens
    text = LAUNCHER_COLOR.read_text()
    start = text.index(">#") + 1
    LAUNCHER_COLOR.write_text(text[:start] + hex_bg + text[start + 7 :])
    store_graphics(icon, bg)
    print(f"Icon, splash and store graphics from logo.png, on {hex_bg}")

    # The Android icon and splash files, in every size, from these images.
    subprocess.run(
        [str(ROOT / "scripts/frontend-run.sh"), "npx", "--yes", "@capacitor/assets", "generate", "--android"],
        check=True,
    )


if __name__ == "__main__":
    main()

"""Convert the raw guide screenshots to WebP and write the image manifest.

Run after the capture spec:

    CC_GUIDE_CAPTURE=1 npx playwright test tests/e2e/guide-capture.spec.ts
    python scripts/optimize_guide_images.py

Needs Pillow (pip install pillow). Reads tests/e2e/.guide-raw/<lang>/<name>.png
and .json (callout anchor positions measured from the live DOM), writes
apps/web/public/guide/<lang>/<name>.webp and apps/web/app/guide/guide-images.json.
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tests" / "e2e" / ".guide-raw"
OUT = ROOT / "apps" / "web" / "public" / "guide"
MANIFEST = ROOT / "apps" / "web" / "app" / "guide" / "guide-images.json"

QUALITY = 74


def main() -> None:
    manifest: dict[str, dict[str, dict]] = {}
    total = 0
    for lang_dir in sorted(p for p in RAW.iterdir() if p.is_dir()):
        lang = lang_dir.name
        manifest[lang] = {}
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for png in sorted(lang_dir.glob("*.png")):
            meta = json.loads(png.with_suffix(".json").read_text(encoding="utf-8"))
            img = Image.open(png).convert("RGB")
            dest = OUT / lang / (png.stem + ".webp")
            img.save(dest, "WEBP", quality=QUALITY, method=6)
            total += dest.stat().st_size
            manifest[lang][png.stem] = {
                "w": img.width,
                "h": img.height,
                "anchors": meta["anchors"],
            }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"{sum(len(v) for v in manifest.values())} images, {total / 1024:.0f} KiB")


if __name__ == "__main__":
    main()

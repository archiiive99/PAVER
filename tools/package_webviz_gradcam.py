#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pillow>=11.0",
#   "typer>=0.16",
# ]
# ///
#
# How to run:
# uv run tools/package_webviz_gradcam.py \
#   --source /data4/song99/AAAI27/project_page/assets/webviz/gradcam \
#   --output assets/webviz

from __future__ import annotations

import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import typer
from PIL import Image

CAMERAS: Final = (
    "CAM_FRONT_LEFT",
    "CAM_FRONT",
    "CAM_FRONT_RIGHT",
    "CAM_BACK_LEFT",
    "CAM_BACK",
    "CAM_BACK_RIGHT",
)
ARCHITECTURES: Final = (
    ("VAD-Tiny", "vad-tiny"),
    ("VAD-Base", "vad-base"),
    ("GenAD", "genad"),
)
SLOTS: Final = ("base", "paver")


@dataclass(frozen=True, slots=True)
class MosaicJob:
    token: str
    source: Path
    output: Path
    tile_width: int
    tile_height: int
    quality: int
    force: bool


def build_token(job: MosaicJob) -> tuple[str, tuple[tuple[str, int, int], ...]]:
    results: list[tuple[str, int, int]] = []
    for _, architecture_dir in ARCHITECTURES:
        for slot in SLOTS:
            destination = (
                job.output
                / "gradcam"
                / job.token
                / architecture_dir
                / f"{slot}_bev.webp"
            )
            if destination.exists() and not job.force:
                results.append((architecture_dir, 0, destination.stat().st_size))
                continue
            mosaic = Image.new("RGB", (job.tile_width * 3, job.tile_height * 2))
            for index, camera in enumerate(CAMERAS):
                source = (
                    job.source
                    / job.token
                    / architecture_dir
                    / f"{slot}_bev_{camera}.webp"
                )
                with Image.open(source) as image:
                    tile = image.convert("RGB").resize(
                        (job.tile_width, job.tile_height),
                        Image.Resampling.LANCZOS,
                    )
                mosaic.paste(tile, ((index % 3) * job.tile_width, (index // 3) * job.tile_height))
            destination.parent.mkdir(parents=True, exist_ok=True)
            mosaic.save(destination, "WEBP", quality=job.quality, method=5)
            results.append((architecture_dir, 1, destination.stat().st_size))
    return job.token, tuple(results)


def main(
    source: Path = typer.Option(..., exists=True, file_okay=False, readable=True),
    output: Path = typer.Option(..., exists=True, file_okay=False, writable=True),
    tile_width: int = typer.Option(360, min=240, max=640),
    tile_height: int = typer.Option(203, min=135, max=360),
    quality: int = typer.Option(60, min=40, max=90),
    workers: int = typer.Option(24, min=1, max=64),
    force: bool = typer.Option(False),
) -> None:
    """Write one 3-by-2 WebP per token, architecture, and model slot."""
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    tokens = sorted({token for clip in manifest["clips"] for token in clip["tokens"]})
    jobs = (
        MosaicJob(token, source, output, tile_width, tile_height, quality, force)
        for token in tokens
    )
    counts = {architecture_dir: 0 for _, architecture_dir in ARCHITECTURES}
    sizes = {architecture_dir: 0 for _, architecture_dir in ARCHITECTURES}
    written = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(build_token, job) for job in jobs]
        for completed, future in enumerate(as_completed(futures), start=1):
            _, results = future.result()
            for architecture_dir, created, byte_count in results:
                counts[architecture_dir] += 1
                sizes[architecture_dir] += byte_count
                written += created
            if completed % 100 == 0 or completed == len(tokens):
                typer.echo(
                    f"[{completed}/{len(tokens)}] {written} mosaics written, "
                    f"{sum(sizes.values()) / 2**20:.1f} MiB"
                )

    expected_per_architecture = len(tokens) * len(SLOTS)
    for _, architecture_dir in ARCHITECTURES:
        if counts[architecture_dir] != expected_per_architecture:
            raise RuntimeError(
                f"{architecture_dir}: expected {expected_per_architecture} mosaics, "
                f"found {counts[architecture_dir]}"
            )

    for experiment in manifest["experiments"]:
        experiment.pop("path", None)
        experiment.pop("provenance", None)
    previous = manifest.get("gradcam", {}).get("architectures", {})
    manifest["gradcam"] = {
        "targets": ["bev"],
        "mosaic": {
            "columns": 3,
            "rows": 2,
            "tileWidth": tile_width,
            "tileHeight": tile_height,
            "quality": quality,
            "cameraOrder": list(CAMERAS),
        },
        "architectures": {
            architecture: {
                "available": True,
                "dir": architecture_dir,
                "alpha": previous.get(architecture, {}).get("alpha", 0.4),
                "files": counts[architecture_dir],
                "bytes": sizes[architecture_dir],
            }
            for architecture, architecture_dir in ARCHITECTURES
        },
    }
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    typer.echo(f"Updated {manifest_path} with the verified mosaic contract")


if __name__ == "__main__":
    typer.run(main)

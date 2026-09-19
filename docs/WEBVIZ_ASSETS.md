# Interactive Visualizer Assets

The project-page visualizer uses browser-native static files. It does not load
Python pickle files at runtime.

## Inference results

The six nuScenes result pickles are converted offline into the
`paver.webviz.v1` schema. Each frame file contains the normalized geometry for
detections, object motion, vector maps, ego planning, ground truth, camera
calibration, and per-frame planning metrics.

```text
assets/webviz/
├── manifest.json
├── frames/
│   └── <sample-token>.json
└── cam/
    └── <sample-token>/
        ├── CAM_FRONT_LEFT.webp
        ├── CAM_FRONT.webp
        ├── CAM_FRONT_RIGHT.webp
        ├── CAM_BACK_LEFT.webp
        ├── CAM_BACK.webp
        └── CAM_BACK_RIGHT.webp
```

The public manifest contains model names and rendering metadata only. Local
checkpoint and pickle paths are intentionally omitted.

## Grad-CAM

The visualizer displays the BEV attribution target because it is the
representation transferred by PAVER. The source archive also retains planning,
detection, motion, and map targets for the paper, but publishing every target
would add several gigabytes without changing this visualizer.

Six camera overlays are packed into one 3 by 2 WebP mosaic for each frame,
architecture, and model slot.

```text
assets/webviz/gradcam/<sample-token>/
├── vad-tiny/
│   ├── base_bev.webp
│   └── paver_bev.webp
├── vad-base/
│   ├── base_bev.webp
│   └── paver_bev.webp
└── genad/
    ├── base_bev.webp
    └── paver_bev.webp
```

The browser crops the same mosaic into six cells with CSS. This reduces the
published Grad-CAM set from 50,364 individual overlays to 8,394 files and from
703,764,716 bytes to 238,808,934 bytes.

Rebuild the mosaics with:

```bash
uv run tools/package_webviz_gradcam.py \
  --source /data4/song99/AAAI27/project_page/assets/webviz/gradcam \
  --output assets/webviz
```

## Reliability

Scene loading limits background frame prefetch to three requests. Frame JSON
and image requests retry transient HTTP 429 and 5xx responses. A failed frame
promise is removed from the cache so a later seek can recover instead of
remaining broken for the browser session.

Run the complete static contract check before publishing:

```bash
node tools/check_webviz.mjs --require-gradcam
python tools/check_page.py
```

The contract check verifies every manifest token, frame JSON, camera image,
model prediction entry, and Grad-CAM mosaic.

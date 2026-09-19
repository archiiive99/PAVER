#!/usr/bin/env node

import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requireGradcam = process.argv.includes('--require-gradcam');
const manifestPath = join(root, 'assets', 'webviz', 'manifest.json');
const errors = [];

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  errors.push(message);
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const experiments = manifest.experiments ?? [];
const clips = manifest.clips ?? [];
const cameraOrder = manifest.cameraOrder ?? [];
const tokens = [...new Set(clips.flatMap(clip => clip.tokens ?? []))];

if (manifest.schema !== 'paver.webviz.v1') fail(`unexpected schema: ${manifest.schema}`);
if (cameraOrder.length !== 6) fail(`expected 6 cameras, found ${cameraOrder.length}`);
if (!tokens.length) fail('manifest contains no visualizer frames');

let frameBytes = 0;
let cameraBytes = 0;
for (const token of tokens) {
  const framePath = join(root, 'assets', 'webviz', 'frames', `${token}.json`);
  if (!(await exists(framePath))) {
    fail(`missing frame: ${token}`);
    continue;
  }
  const frameText = await readFile(framePath, 'utf8');
  frameBytes += Buffer.byteLength(frameText);
  const frame = JSON.parse(frameText);
  if (frame.sampleToken !== token) fail(`frame token mismatch: ${token}`);
  const frameCameras = new Map((frame.cameras ?? []).map(camera => [camera.name, camera]));
  for (const cameraName of cameraOrder) {
    const camera = frameCameras.get(cameraName);
    if (!camera) {
      fail(`missing camera metadata: ${token}/${cameraName}`);
      continue;
    }
    const relative = camera.image ?? `cam/${token}/${cameraName}.webp`;
    const cameraPath = join(root, 'assets', 'webviz', relative);
    if (!(await exists(cameraPath))) fail(`missing camera image: ${relative}`);
    else cameraBytes += (await stat(cameraPath)).size;
  }
  for (const experiment of experiments) {
    if (!frame.models?.[experiment.id]) fail(`missing model ${experiment.id}: ${token}`);
  }
}

let gradcamFiles = 0;
let gradcamBytes = 0;
if (requireGradcam) {
  const gradcam = manifest.gradcam;
  if (!gradcam?.mosaic) fail('manifest has no Grad-CAM mosaic contract');
  for (const architecture of [...new Set(experiments.map(item => item.arch))]) {
    const entry = gradcam?.architectures?.[architecture];
    if (!entry?.available) {
      fail(`Grad-CAM unavailable: ${architecture}`);
      continue;
    }
    for (const token of tokens) {
      for (const slot of ['base', 'paver']) {
        const relative = `gradcam/${token}/${entry.dir}/${slot}_bev.webp`;
        const path = join(root, 'assets', 'webviz', relative);
        if (!(await exists(path))) fail(`missing Grad-CAM mosaic: ${relative}`);
        else {
          gradcamFiles += 1;
          gradcamBytes += (await stat(path)).size;
        }
      }
    }
  }
}

const summary = {
  clips: clips.length,
  frames: tokens.length,
  experiments: experiments.length,
  cameras: tokens.length * cameraOrder.length,
  frameBytes,
  cameraBytes,
  gradcamFiles,
  gradcamBytes,
  errors: errors.length,
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  for (const message of errors.slice(0, 50)) console.error(`ERROR ${message}`);
  if (errors.length > 50) console.error(`ERROR ${errors.length - 50} more failures`);
  process.exitCode = 1;
}

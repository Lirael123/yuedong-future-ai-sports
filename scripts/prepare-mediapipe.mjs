import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dependency = new URL('node_modules/@mediapipe/tasks-vision/', root);
const { version } = JSON.parse(await readFile(new URL('package.json', dependency), 'utf8'));
const target = new URL(`public/mediapipe/runtime/${version}/`, root);
const model = new URL('public/mediapipe/pose_landmarker_lite.task', root);
const expectedModelSha256 = '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a';
const actual = createHash('sha256').update(await readFile(model)).digest('hex');
if (actual !== expectedModelSha256) throw new Error('MediaPipe model checksum mismatch');
await mkdir(target, { recursive: true });
for (const name of [
  'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm',
]) {
  await copyFile(new URL(`wasm/${name}`, dependency), new URL(name, target));
}
console.log(`Prepared locked MediaPipe ${version} runtime at ${fileURLToPath(target)}; model SHA-256 verified`);

// MapLibre runs its tile work in a module worker that Turbopack does not serve, so the worker and
// the chunk it imports are copied to public/maplibre and loaded with setWorkerUrl (see MapView).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(from, f), join(to, f));
console.log("maplibre worker copied to public/maplibre");

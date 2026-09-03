#!/usr/bin/env node
/**
 * fetch_synapse_chunks.js — Download Razer Synapse Web (apps.razer.com) JS chunks.
 *
 * Usage:
 *   node tools/fetch_synapse_chunks.js [--all] [--out DIR] [--base URL]
 *
 * Reads the webpack chunk map from `razer官方驱动/synapse_web/main.<hash>.js`
 * (download it first from https://apps.razer.com/synapse/dashboard/static/js/main.<hash>.js)
 * and downloads chunks whose names match device/protocol keywords, or all chunks with --all.
 *
 * Output: razer官方驱动/synapse_web/chunks/<id>-<name>.<hash>.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "razer官方驱动", "synapse_web");
const DEFAULT_BASE = "https://apps.razer.com/synapse/dashboard";

const KEYWORDS = /mouse|rzHardware|Protocol|Device|Sensitivity|Calibration|Polling|Battery|Power|Sensor|Mapping|Mapping|Hyper|Onboard|OBM|Profile|Keymap|Dpi|DPI|Lighting|Sleep/i;

function parseArgs(argv) {
  const args = { all: false, out: path.join(WEB_DIR, "chunks"), base: DEFAULT_BASE, main: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--base") args.base = argv[++i];
    else if (argv[i] === "--main") args.main = argv[++i];
  }
  return args;
}

function findMainBundle() {
  const dir = fs.readdirSync(WEB_DIR).filter((f) => /^main\.[a-f0-9]+\.js$/.test(f));
  if (!dir.length) {
    throw new Error(`No main.*.js found in ${WEB_DIR}. Download it first:\n  curl -sL ${DEFAULT_BASE}/static/js/main.<hash>.js -o ${WEB_DIR}/main.<hash>.js`);
  }
  return path.join(WEB_DIR, dir[0]);
}

function extractChunkMaps(source) {
  const match = source.match(/\.u=e=>"static\/js\/"\+\(\{([^}]*)\}\[e\]\|\|e\)\+"\."\+\{([^}]*)\}\[e\]\+"\.chunk\.js"/);
  if (!match) throw new Error("Chunk map pattern not found in main bundle");
  const names = Object.fromEntries([...match[1].matchAll(/(\d+):"([^"]+)"/g)].map((x) => [x[1], x[2]]));
  const hashes = Object.fromEntries([...match[2].matchAll(/(\d+):"([^"]+)"/g)].map((x) => [x[1], x[2]]));
  return { names, hashes };
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    });
    req.on("error", (err) => { fs.unlinkSync(dest); reject(err); });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mainPath = args.main || findMainBundle();
  const source = fs.readFileSync(mainPath, "utf8");
  const { names, hashes } = extractChunkMaps(source);
  console.log(`Chunk map: ${Object.keys(names).length} chunks from ${path.basename(mainPath)}`);

  const ids = args.all
    ? Object.keys(names)
    : Object.entries(names).filter(([, n]) => KEYWORDS.test(n)).map(([id]) => id);
  console.log(`Downloading ${ids.length} chunks${args.all ? " (--all)" : " (keyword-filtered)"}...`);

  fs.mkdirSync(args.out, { recursive: true });
  const manifest = [];
  let ok = 0;
  for (const id of ids) {
    const name = names[id] || id;
    const hash = hashes[id];
    if (!hash) continue;
    const file = path.join(args.out, `${id}-${name}.${hash}.js`);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { ok++; manifest.push({ id, name, hash, file }); continue; }
    const url = `${args.base}/static/js/${name || id}.${hash}.chunk.js`;
    try {
      await download(url, file);
      manifest.push({ id, name, hash, file, url });
      ok++;
    } catch (err) {
      console.warn(`  FAIL ${id} ${name}: ${err.message}`);
    }
  }
  fs.writeFileSync(path.join(args.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Done: ${ok}/${ids.length} chunks -> ${args.out}`);
  console.log(`Total size: ${(fs.readdirSync(args.out).filter(f => f.endsWith(".js")).reduce((s, f) => s + fs.statSync(path.join(args.out, f)).size, 0) / 1048576).toFixed(1)} MB`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });

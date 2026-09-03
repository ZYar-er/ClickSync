#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OFFICIAL_DRIVER_DIR = "razer官方驱动";
const OUTPUT_DIR_NAME = "mouse_modules";

const CATEGORY_DESCRIPTIONS = {
  protocol:
    "Low-level device protocol, command headers, HID wrappers, and event parsers used by the official mouse stack.",
  mapping:
    "Mouse button-mapping, OBM conversion, public-action translation, and mapping helper modules.",
  device:
    "Mouse device defaults, product descriptors, feature enums, and profile/layout definitions.",
  ui: "Mouse page/store/controller modules from the official Synapse Web Beta UI.",
};

const MODULES = [
  {
    id: "1207",
    category: "protocol",
    slug: "mouse-device-protocol-v1",
    note: "Mouse device protocol class with button, DPI, polling, power, and wireless handling.",
  },
  {
    id: "17937",
    category: "protocol",
    slug: "mouse-device-protocol-v2",
    note: "Another mouse protocol implementation branch with OBM and feature-specific handlers.",
  },
  {
    id: "43086",
    category: "protocol",
    slug: "obm-button-key-ops",
    note: "Official OBM get/set operations for single button assignment, key assignment, and related helpers.",
  },
  {
    id: "36675",
    category: "protocol",
    slug: "obm-command-headers",
    note: "OBM command headers and command descriptions used by the official driver.",
  },
  {
    id: "38287",
    category: "protocol",
    slug: "mouse-command-pack",
    note: "Mouse feature command pack used by protocol classes for polling, DPI, lift-off, and related controls.",
  },
  {
    id: "85189",
    category: "protocol",
    slug: "mouse-command-parsers",
    note: "Parser and serializer helpers for mouse command payloads.",
  },
  {
    id: "11880",
    category: "protocol",
    slug: "mouse-feature-command-headers",
    note: "Feature command headers/constants for mouse lighting, polling, battery, and related controls.",
  },
  {
    id: "30186",
    category: "protocol",
    slug: "hardware-event-constants",
    note: "Hardware event and protocol constants shared across mouse runtime code.",
  },
  {
    id: "25319",
    category: "protocol",
    slug: "wireless-command-headers",
    note: "Wireless and dongle command headers reused by mouse runtime modules.",
  },
  {
    id: "91314",
    category: "protocol",
    slug: "hyperspeed-wireless-commands",
    note: "HyperSpeed and wireless mode command constants/helpers.",
  },
  {
    id: "16841",
    category: "protocol",
    slug: "mouse-hardware-event-parser",
    note: "Mouse hardware-event parser used when the device pushes live state updates.",
  },
  {
    id: "87547",
    category: "protocol",
    slug: "mouse-hardware-event-router",
    note: "Mouse event routing and parser registration glue.",
  },
  {
    id: "34508",
    category: "protocol",
    slug: "hid-device-wrapper",
    note: "Thin HID device wrapper used by the official mouse stack.",
  },
  {
    id: "56676",
    category: "mapping",
    slug: "mouse-obm-engine",
    note: "Official mouse OBM engine for reading and writing single-button assignments.",
  },
  {
    id: "85234",
    category: "mapping",
    slug: "mouse-profile-obm-engine",
    note: "Profile-oriented mouse OBM engine that also depends on explicit OBM command headers.",
  },
  {
    id: "39770",
    category: "mapping",
    slug: "mouse-mapping-base",
    note: "Base encoder/decoder logic for official mouse mapping payloads.",
  },
  {
    id: "92663",
    category: "mapping",
    slug: "mouse-mapping-transform",
    note: "Transforms between official mapping structs and public mouse actions/groups.",
  },
  {
    id: "16306",
    category: "mapping",
    slug: "mapping-enums",
    note: "Mapping enums used across mouse, keyboard, and controller assignment layers.",
  },
  {
    id: "23286",
    category: "mapping",
    slug: "mapping-input-dictionaries",
    note: "Input-ID to mapping dictionaries, including generic mouse inputs.",
  },
  {
    id: "99426",
    category: "mapping",
    slug: "macro-mapping-enums",
    note: "Macro/mapping assignment enums referenced by mouse mapping code.",
  },
  {
    id: "82407",
    category: "mapping",
    slug: "mouse-button-function-enums",
    note: "Official enums for button IDs, button modes, and function IDs.",
  },
  {
    id: "46503",
    category: "mapping",
    slug: "obm-profile-converter",
    note: "OBM profile conversion helpers, including OBM button assignment parsing.",
  },
  {
    id: "41156",
    category: "mapping",
    slug: "mapping-preset-tables",
    note: "Preset tables and HyperShift-related mapping presets used by mouse UI.",
  },
  {
    id: "58112",
    category: "mapping",
    slug: "mapping-selector-helpers",
    note: "Mouse mapping selector/helper logic used by the UI layer.",
  },
  {
    id: "69937",
    category: "mapping",
    slug: "mapping-ui-constants",
    note: "UI-facing constants and action descriptors used by the mouse feature pages.",
  },
  {
    id: "91272",
    category: "mapping",
    slug: "action-label-dictionaries",
    note: "Human-readable label dictionaries for mouse, DPI, media, profile, and related actions.",
  },
  {
    id: "95554",
    category: "mapping",
    slug: "macro-record-type-enums",
    note: "Macro record-type enums used by mapping conversion paths.",
  },
  {
    id: "59934",
    category: "mapping",
    slug: "polling-rate-enums",
    note: "Polling-rate enums referenced by official mouse code paths.",
  },
  {
    id: "78193",
    category: "device",
    slug: "device-defaults",
    note: "Mouse device defaults, feature flags, firmware mappings, and default profile metadata.",
  },
  {
    id: "5315",
    category: "device",
    slug: "viper-v4-product-config",
    note: "Product configuration for Razer Viper V4 Pro, including DPI and dongle metadata.",
  },
  {
    id: "41782",
    category: "device",
    slug: "default-profile-template",
    note: "Default mouse profile template used by the official UI.",
  },
  {
    id: "56929",
    category: "device",
    slug: "sensor-enums",
    note: "Sensor-related enums, including lift-detection/proximity constants.",
  },
  {
    id: "31218",
    category: "device",
    slug: "calibration-enums",
    note: "Calibration and lift-off enums used by mouse surface calibration flows.",
  },
  {
    id: "4938",
    category: "device",
    slug: "led-region-enums",
    note: "LED region enums for mouse lighting-related features.",
  },
  {
    id: "62249",
    category: "device",
    slug: "led-effect-enums",
    note: "LED effect enums referenced by mouse lighting code.",
  },
  {
    id: "21368",
    category: "device",
    slug: "mouse-button-layout",
    note: "Mouse button-group layout definition used by the button-mapping UI.",
  },
  {
    id: "39222",
    category: "device",
    slug: "dpi-feature-loader",
    note: "DPI feature loader/helper that reads supported DPI capabilities from OBM specs.",
  },
  {
    id: "72560",
    category: "ui",
    slug: "mouse-page-container",
    note: "Top-level mouse page/container module that wires the official UI together.",
  },
  {
    id: "78717",
    category: "ui",
    slug: "mouse-redux-selectors",
    note: "Redux selectors/actions for mouse settings, mappings, DPI, and HyperShift UI state.",
  },
  {
    id: "74799",
    category: "ui",
    slug: "mouse-redux-store",
    note: "Mouse Redux store/thunk wiring for the official driver UI.",
  },
  {
    id: "65150",
    category: "ui",
    slug: "mouse-device-summary-card",
    note: "Mouse device summary card/entry component shown in the UI.",
  },
  {
    id: "84350",
    category: "ui",
    slug: "mouse-button-map-controller",
    note: "Mouse button-mapping controller/UI glue.",
  },
  {
    id: "13254",
    category: "ui",
    slug: "mouse-feature-labels",
    note: "Mouse feature labels, text helpers, and feature-specific UI descriptors.",
  },
  {
    id: "27734",
    category: "ui",
    slug: "mouse-option-spinner",
    note: "Spinner-style UI component used by mouse option selectors.",
  },
  {
    id: "97278",
    category: "ui",
    slug: "mouse-option-dropdown",
    note: "Dropdown-style UI component used by mouse option selectors.",
  },
  {
    id: "37226",
    category: "ui",
    slug: "runtime-cache-and-events",
    note: "Runtime cache/event plumbing used by the official mouse session layer.",
  },
  {
    id: "39356",
    category: "ui",
    slug: "device-event-registry",
    note: "Device-event registry used by the official runtime to manage HID listeners.",
  },
];

// Keywords used by --rescan mode to locate SE/mouse protocol modules in bundles
// whose webpack module ids differ from the curated MODULES list.
const RESCAN_KEYWORDS = [
  { weight: 3, terms: ["00de", "00df"] }, // Viper V3 Pro SE PIDs (hex in strings)
  { weight: 2, terms: ["viper"] },
  { weight: 1, terms: ["proximity", "proximitysensor"] },
  { weight: 1, terms: ["calibration"] },
  { weight: 1, terms: ["smarttracking", "smart tracking"] },
  { weight: 1, terms: ["liftoff", "lift off", "liftdistance", "landingdistance"] },
  { weight: 1, terms: ["lowbatterythreshold", "battery critical", "batterythreshold"] },
  { weight: 1, terms: ["charge limiter", "chargelimiter", "battery charge"] },
  { weight: 1, terms: ["time to dim", "timetodim"] },
  { weight: 1, terms: ["auto sleep", "autosleep", "sleep mode"] },
  { weight: 1, terms: ["power mode", "powermode"] },
  { weight: 1, terms: ["game mode", "gamemode"] },
  { weight: 1, terms: ["hyperpolling"] },
  { weight: 1, terms: ["pollingperiod", "polling rate"] },
  { weight: 1, terms: ["obm", "onboard memory"] },
  { weight: 1, terms: ["hypershift"] },
  { weight: 1, terms: ["dynamic sensitivity", "dynamicsensitivity"] },
];

function rescanModules(source, spans) {
  const scored = [];
  for (const span of spans) {
    const body = source.slice(span.bodyStart, span.bodyEndExclusive);
    if (body.length > 2_000_000) continue; // skip suspiciously huge spans
    const lower = body.toLowerCase();
    const hits = [];
    let score = 0;
    for (const group of RESCAN_KEYWORDS) {
      const matched = group.terms.filter((t) => lower.includes(t.toLowerCase()));
      if (matched.length) {
        score += group.weight;
        hits.push(...matched);
      }
    }
    if (score === 0) continue;
    const exportMatch = body.match(/n\.d\(t,\{([^}]*)\}\)/);
    scored.push({
      id: span.id,
      score,
      hits: [...new Set(hits)].slice(0, 12),
      size: body.length,
      exportsPreview: exportMatch ? exportMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : "",
      dependencies: getDependencies(body),
      headerStart: span.headerStart,
    });
  }
  scored.sort((a, b) => b.score - a.score || b.size - a.size);
  return scored;
}

function fail(message) {
  throw new Error(message);
}

function ensureInside(rootPath, childPath) {
  const relative = path.relative(rootPath, childPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`Refusing to write outside ${rootPath}: ${childPath}`);
  }
}

function findOfficialBundle() {
  const explicitDir = path.join(ROOT_DIR, OFFICIAL_DRIVER_DIR, "Synapse Web Beta_files");
  const candidateDirs = [];

  if (fs.existsSync(explicitDir)) {
    candidateDirs.push(explicitDir);
  }

  for (const entry of fs.readdirSync(ROOT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const maybeFilesDir = path.join(ROOT_DIR, entry.name, "Synapse Web Beta_files");
    if (fs.existsSync(maybeFilesDir) && !candidateDirs.includes(maybeFilesDir)) {
      candidateDirs.push(maybeFilesDir);
    }
  }

  for (const dir of candidateDirs) {
    const bundle = fs
      .readdirSync(dir)
      .find((name) => /^main\..+\.js$/.test(name) && !name.endsWith(".map"));
    if (bundle) {
      return path.join(dir, bundle);
    }
  }

  fail("Could not locate the official Synapse Web Beta main bundle.");
}

// Module header patterns covering common webpack / CDP-pretty-printed shapes:
//   1207:function(e,t,n){     1207: function (e, t, n) {
//   1207:(e,t,n)=>{            1207: (e, t, n) => {
//   1207:(e,t,n){              1207(e,t,n){
const MODULE_HEADER_PATTERNS = [
  /(\d+)\s*:\s*function\s*\(\s*e\s*,\s*t\s*,\s*n\s*\)\s*\{/g,
  /(\d+)\s*:\s*\(\s*e\s*,\s*t\s*,\s*n\s*\)\s*=>\s*\{/g,
  /(\d+)\s*:\s*\(\s*e\s*,\s*t\s*,\s*n\s*\)\s*\{/g,
  /(\d+)\s*\(\s*e\s*,\s*t\s*,\s*n\s*\)\s*\{/g,
];

function collectModuleSpans(source) {
  const byIndex = new Map();
  for (const pattern of MODULE_HEADER_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const existing = byIndex.get(match.index);
      // Keep the longest header at the same offset (most specific shape).
      if (!existing || match[0].length > existing.header.length) {
        byIndex.set(match.index, {
          id: match[1],
          headerStart: match.index,
          bodyStart: match.index + match[0].length,
          header: match[0],
        });
      }
    }
  }

  const markers = [...byIndex.values()].sort((a, b) => a.headerStart - b.headerStart);

  if (!markers.length) {
    fail("No webpack module headers were found in the bundle.");
  }

  // Webpack runtime tail marker: `},t={}` (with optional spaces). Fall back to
  // the end of file when the runtime shape differs (CDP pretty dumps etc.).
  let tailStart = -1;
  for (const candidate of ["},t={}", "},t = {}", "},t={", "}, t = {"]) {
    const idx = source.indexOf(candidate, markers[markers.length - 1].headerStart);
    if (idx !== -1) { tailStart = idx; break; }
  }
  if (tailStart === -1) {
    console.warn("[warn] webpack tail marker `},t={}` not found; using EOF as last-module bound.");
    tailStart = source.length;
  }

  return markers.map((marker, index) => {
    const nextHeaderStart =
      index + 1 < markers.length ? markers[index + 1].headerStart : tailStart;
    const rawEnd = nextHeaderStart - 1;
    const trailerLength = source[rawEnd] === "," ? 1 : 0;
    return {
      id: marker.id,
      headerStart: marker.headerStart,
      bodyStart: marker.bodyStart,
      bodyEndExclusive: nextHeaderStart - trailerLength,
    };
  });
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => Number(left) - Number(right));
}

function getDependencies(body) {
  return uniqueSorted([...body.matchAll(/n\((\d+)\)/g)].map((match) => match[1]));
}

function getExportPreview(body) {
  const exportMatch = body.match(/n\.d\(t,\{([^}]*)\}\)/);
  if (!exportMatch) return "";
  return exportMatch[1].replace(/\s+/g, " ").trim();
}

function renderModuleFile(entry, body, bundleLabel) {
  const deps = getDependencies(body);
  const depText = deps.length ? deps.join(", ") : "none";
  return [
    "/**",
    " * Extracted from the official Razer Synapse Web Beta bundle.",
    ` * Source bundle: ${bundleLabel}`,
    ` * Webpack module id: ${entry.id}`,
    ` * Category: ${entry.category}`,
    ` * Note: ${entry.note}`,
    ` * Local webpack deps: ${depText}`,
    " */",
    `const webpackModule_${entry.id} = function (e, t, n) {`,
    body,
    "};",
    "",
    `module.exports = webpackModule_${entry.id};`,
    "",
  ].join("\n");
}

function renderReadme(bundlePath, manifest) {
  const bundleDisplay = `${path.basename(path.dirname(bundlePath))}/${path.basename(bundlePath)}`;
  const lines = [
    "# Official Razer Mouse Module Extraction",
    "",
    "This folder is a readable slice of mouse-related modules extracted from the official Synapse Web Beta bundle.",
    "",
    `Source bundle: \`${bundleDisplay}\``,
    "Generated by: `node tools/extract_razer_mouse_bundle.js`",
    "",
    "The extracted files keep original webpack module ids and local variable names, but each module is wrapped in a valid standalone JS file so it can be formatted and read more easily.",
    "",
    "## Categories",
    "",
  ];

  for (const [category, description] of Object.entries(CATEGORY_DESCRIPTIONS)) {
    lines.push(`- \`${category}\`: ${description}`);
  }

  lines.push("", "## Modules", "");

  const entriesByCategory = {};
  for (const item of manifest) {
    if (!entriesByCategory[item.category]) entriesByCategory[item.category] = [];
    entriesByCategory[item.category].push(item);
  }

  for (const category of Object.keys(CATEGORY_DESCRIPTIONS)) {
    if (!entriesByCategory[category] || !entriesByCategory[category].length) continue;
    lines.push(`### ${category}`, "");
    for (const item of entriesByCategory[category]) {
      const depText = item.dependencies.length ? item.dependencies.join(", ") : "none";
      lines.push(
        `- \`${item.file.replace(/\\/g, "/")}\` (module \`${item.id}\`): ${item.note} Deps: ${depText}.`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { bundlePath: null, rescan: false, strict: false };
  for (const raw of argv) {
    if (raw === "--rescan") args.rescan = true;
    else if (raw === "--strict") args.strict = true;
    else if (raw.startsWith("--bundle=")) args.bundlePath = raw.slice("--bundle=".length);
    else if (raw === "--bundle") {
      const idx = argv.indexOf(raw);
      if (idx + 1 < argv.length) args.bundlePath = argv[idx + 1];
    } else if (!raw.startsWith("-")) {
      args.bundlePath = raw; // positional shorthand
    }
  }
  return args;
}

function writeRescanOutput(outputRoot, bundleLabel, scored, source, spans) {
  const spanMap = new Map(spans.map((span) => [span.id, span]));
  const rescanDir = path.join(outputRoot, "rescan");
  fs.mkdirSync(rescanDir, { recursive: true });

  const top = scored.slice(0, 80);
  const report = {
    bundle: bundleLabel,
    generatedBy: "node tools/extract_razer_mouse_bundle.js --rescan",
    totalScored: scored.length,
    topModules: top.map((entry) => ({
      id: entry.id,
      score: entry.score,
      hits: entry.hits,
      size: entry.size,
      exportsPreview: entry.exportsPreview,
      dependencies: entry.dependencies,
    })),
  };
  fs.writeFileSync(
    path.join(rescanDir, "rescan_report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  for (const entry of top) {
    const span = spanMap.get(entry.id);
    if (!span) continue;
    const rawBody = source.slice(span.bodyStart, span.bodyEndExclusive).trim();
    const body = rawBody.endsWith("}") ? rawBody.slice(0, -1).trimEnd() : rawBody;
    const file = path.join(rescanDir, `${entry.id}_${entry.hits[0] || "match"}.js`);
    ensureInside(outputRoot, file);
    fs.writeFileSync(
      file,
      [
        "/**",
        " * RESCAN: matched by keywords, module id may be bundle-version specific.",
        ` * Source bundle: ${bundleLabel}`,
        ` * Webpack module id: ${entry.id}`,
        ` * Score: ${entry.score}  Hits: ${entry.hits.join(", ")}`,
        ` * Exports: ${entry.exportsPreview || "(none previewed)"}`,
        ` * Local webpack deps: ${entry.dependencies.join(", ") || "none"}`,
        " */",
        `const webpackModule_${entry.id} = function (e, t, n) {`,
        body,
        "};",
        "",
        `module.exports = webpackModule_${entry.id};`,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  console.log(`Rescan: ${scored.length} modules matched; wrote top ${top.length} to ${rescanDir}`);
  console.log("Top matches by score:");
  for (const entry of top.slice(0, 20)) {
    console.log(
      `  #${entry.id} score=${entry.score} hits=[${entry.hits.join(",")}] size=${entry.size} exports={${entry.exportsPreview.slice(0, 80)}}`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundlePath = args.bundlePath ? path.resolve(ROOT_DIR, args.bundlePath) : findOfficialBundle();
  if (!fs.existsSync(bundlePath)) {
    fail(`Bundle not found: ${bundlePath}`);
  }
  const bundleDir = path.dirname(bundlePath);
  const officialRoot = args.bundlePath ? ROOT_DIR : path.dirname(bundleDir);
  const outputRoot = path.join(officialRoot, OUTPUT_DIR_NAME);
  const bundleLabel = args.bundlePath
    ? bundlePath
    : `${path.basename(bundleDir)}/${path.basename(bundlePath)}`;

  ensureInside(ROOT_DIR, outputRoot);
  if (path.basename(outputRoot) !== OUTPUT_DIR_NAME) {
    fail(`Unexpected output folder name: ${outputRoot}`);
  }

  const source = fs.readFileSync(bundlePath, "utf8");
  const spans = collectModuleSpans(source);
  const spanMap = new Map(spans.map((span) => [span.id, span]));
  const missing = MODULES.filter((entry) => !spanMap.has(entry.id)).map((entry) => entry.id);

  if (missing.length && !args.rescan && !args.strict) {
    console.warn(
      `[warn] ${missing.length} curated module ids missing in this bundle: ${missing.join(", ")}\n` +
        `[warn] The bundle version differs from the one the MODULES list was built for.\n` +
        `[warn] Falling back to keyword rescan (--rescan). Use --strict to fail instead.`,
    );
    args.rescan = true;
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  if (args.rescan) {
    const scored = rescanModules(source, spans);
    if (!scored.length) {
      fail("Rescan found no modules matching the SE/mouse keywords.");
    }
    writeRescanOutput(outputRoot, bundleLabel, scored, source, spans);
    return;
  }

  if (missing.length) {
    fail(`Missing module ids in bundle: ${missing.join(", ")} (use --rescan for keyword mode)`);
  }

  for (const category of Object.keys(CATEGORY_DESCRIPTIONS)) {
    fs.mkdirSync(path.join(outputRoot, category), { recursive: true });
  }

  const manifest = [];
  for (const entry of MODULES) {
    const span = spanMap.get(entry.id);
    const rawBody = source.slice(span.bodyStart, span.bodyEndExclusive).trim();
    const body = rawBody.endsWith("}") ? rawBody.slice(0, -1).trimEnd() : rawBody;
    const fileName = `${entry.id}_${entry.slug}.js`;
    const relativeFile = path.join(entry.category, fileName);
    const absoluteFile = path.join(outputRoot, relativeFile);
    ensureInside(outputRoot, absoluteFile);

    fs.writeFileSync(
      absoluteFile,
      renderModuleFile(entry, body, bundleLabel),
      "utf8",
    );

    manifest.push({
      ...entry,
      file: relativeFile,
      dependencies: getDependencies(body),
      exportsPreview: getExportPreview(body),
    });
  }

  const manifestPath = path.join(outputRoot, "manifest.json");
  const readmePath = path.join(outputRoot, "README.md");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(readmePath, `${renderReadme(bundlePath, manifest)}\n`, "utf8");

  console.log(`Extracted ${manifest.length} mouse-related modules to ${outputRoot}`);
}

main();

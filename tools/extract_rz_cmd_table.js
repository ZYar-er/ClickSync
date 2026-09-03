#!/usr/bin/env node
/**
 * extract_rz_cmd_table.js — Extract the Razer device command table from the mw
 * protocol library chunk (6120.*.js) into a readable mapping.
 *
 * Usage: node tools/extract_rz_cmd_table.js <6120.chunk.js> [--all-classes]
 * Output: printed lines "class/cmd size  Name"
 */

const fs = require("fs");

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node tools/extract_rz_cmd_table.js <6120.*.js>");
    process.exit(1);
  }
  const src = fs.readFileSync(input, "utf8");

  // Match both tuple shapes: ("Name",new Uint8Array([d,c,cmd])) and
  // (new Uint8Array([d,c,cmd]),"Name").
  const re =
    /\(\s*(?:"([^"]+)",\s*new\s+Uint8Array\(\[([0-9, ]+)\]\)|new\s+Uint8Array\(\[([0-9, ]+)\]\),\s*"([^"]+)")\s*\)/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(src))) {
    const name = (m[1] || m[4] || "").trim();
    const raw = (m[2] || m[3] || "").split(",").map((s) => parseInt(s.trim(), 10));
    if (raw.length < 3 || raw.some((n) => !Number.isFinite(n))) continue;
    const [size, cls, cmd] = raw;
    const key = `${cls}:${cmd}`;
    if (!seen.has(key)) seen.set(key, { size, cls, cmd, names: [] });
    if (name) seen.get(key).names.push(name);
  }

  const rows = [...seen.values()].sort((a, b) => a.cls - b.cls || a.cmd - b.cmd);
  console.log(`# ${rows.length} unique commands from ${input}`);
  console.log("class/cmd      size  names");
  for (const r of rows) {
    const clsH = `0x${r.cls.toString(16).padStart(2, "0")}`;
    const cmdH = `0x${r.cmd.toString(16).padStart(2, "0")}`;
    console.log(`${clsH}/${cmdH}  ${String(r.size).padStart(3)}  ${[...new Set(r.names)].join(" / ")}`);
  }
}

main();

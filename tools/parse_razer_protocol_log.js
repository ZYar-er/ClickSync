#!/usr/bin/env node
/**
 * parse_razer_protocol_log.js — Parse RazerAppEngine --logProtocol output.
 *
 * Windows side (no admin needed):
 *   1. Fully exit Razer Synapse (including tray icon).
 *   2. Run:  "C:\Program Files\Razer\RazerAppEngine\RazerAppEngine.exe" --logProtocol
 *   3. Operate the SE device pages (calibration, lift/landing sliders, dynamic
 *      sensitivity, low battery threshold, sleep, DPI, polling, buttons, ...).
 *   4. Exit Synapse, then copy:
 *        %LOCALAPPDATA%\Razer\RazerAppEngine\User Data\Logs\protocol.log
 *      (plus protocol.log.1 / .2 if rotated) into razer官方驱动/pcaps/
 *
 * WSL side:
 *   node tools/parse_razer_protocol_log.js "razer官方驱动/pcaps/protocol.log"
 *
 * Log line shape (winston):
 *   YYYY-MM-DD HH:mm:ss.SSS [INFO]: <productId> <containerId> <op> [hex,...] <len> <url>
 *   op: set = sendFeatureReport payload (90 B frame, reportId prepended later by main),
 *       get = raw getFeatureReport response (91 B incl. reportId at [0]),
 *       w/r = hid.write/hid.read (interrupt transfer).
 */

const fs = require("fs");
const path = require("path");

const CLASS_NAMES = {
  0x00: "General", 0x02: "Button", 0x04: "DPI",
  0x07: "Battery/Power", 0x0b: "Sensor/Proximity", 0x0d: "Thermal",
};
const STATUS_NAMES = {
  0x00: "req", 0x01: "busy", 0x02: "ok", 0x03: "err", 0x04: "timeout", 0x05: "unsupported",
};

const KNOWN_CLASSES = new Set([0x00, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x32]);

function decodeFrame(bytes) {
  if (!bytes || (bytes.length !== 90 && bytes.length !== 91)) return null;
  // Two payload conventions appear in the log:
  //   A) 90-byte dataSend frame: [0]=status, [1]=tx, [2-4]=reserved,
  //      [5]=dataSize, [6]=class, [7]=cmd, [8+]=args, [88]=ck=XOR[2..87]
  //   B) 91-byte wire frame (reportId prepended): [0]=reportId(0x00),
  //      [1]=status, [2]=tx, [3-5]=reserved, [6]=dataSize, [7]=class,
  //      [8]=cmd, [9+]=args, [89]=ck=XOR[3..87].
  //      90-byte logs sometimes carry this wire frame minus the trailing 0x00
  //      (then ck sits at [88]).
  let isWire = bytes.length === 91;
  if (!isWire && bytes.length === 90) {
    // Ambiguous for all-zero reserved bytes: prefer the interpretation whose
    // class is known and whose reserved bytes are all zero.
    const clsWire = bytes[7];
    const clsFrame = bytes[6];
    const reservedWireOk = bytes[3] === 0 && bytes[4] === 0 && bytes[5] === 0;
    const reservedFrameOk = bytes[2] === 0 && bytes[3] === 0 && bytes[4] === 0;
    if (reservedWireOk && !reservedFrameOk) isWire = true;
    else if (reservedFrameOk && !reservedWireOk) isWire = false;
    else if (KNOWN_CLASSES.has(clsWire) && !KNOWN_CLASSES.has(clsFrame)) isWire = true;
    else if (KNOWN_CLASSES.has(clsFrame) && !KNOWN_CLASSES.has(clsWire)) isWire = false;
    else isWire = true;
  }
  const status = bytes[isWire ? 1 : 0];
  const tx = bytes[isWire ? 2 : 1];
  const dataSize = bytes[isWire ? 6 : 5];
  const cls = bytes[isWire ? 7 : 6];
  const cmd = bytes[isWire ? 8 : 7];
  const ckIdx = isWire ? 89 : 88;
  const ckOk = bytes.slice(isWire ? 3 : 2, 88).reduce((acc, x) => acc ^ x, 0) === bytes[ckIdx];
  const argsStart = isWire ? 9 : 8;
  const args = Array.from(bytes.slice(argsStart, argsStart + Math.min(dataSize, 16)))
    .map((x) => x.toString(16).padStart(2, "0")).join(" ");
  return {
    wire: bytes.length,
    layout: isWire ? "B(wire91)" : "A(dataSend90)",
    checksumOk: ckOk,
    status: STATUS_NAMES[status] || `0x${status.toString(16)}`,
    tx,
    dataSize,
    cls,
    clsName: CLASS_NAMES[cls] || "",
    cmd,
    argsHead: args,
    hex: Array.from(bytes).map((x) => x.toString(16).padStart(2, "0")).join(" "),
  };
}

const LINE_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[INFO\]: (\d+) (\S+) (set|get|w|r|write|read) (\[[^\]]*\]) (\d+) (.*)$/;

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node tools/parse_razer_protocol_log.js <protocol.log>");
    process.exit(1);
  }
  if (!fs.existsSync(input)) {
    console.error(`File not found: ${input}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(input, "utf8").split(/\r?\n/).filter((l) => l.includes("[INFO]:"));
  console.log(`# ${path.basename(input)} — ${lines.length} protocol log lines\n`);

  let decoded = 0;
  const pairs = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, ts, pid, cid, op, arrStr, len, url] = m;
    const bytes = arrStr
      .slice(1, -1).split(",")
      .map((s) => parseInt(s.trim(), 16)) // protocolLogger prints Uint8Array in HEX
      .filter((n) => Number.isFinite(n));
    const d = decodeFrame(bytes);
    if (d) decoded++;
    const tag = `${pid} ${cid}`;
    if (op === "set" || op === "w" || op === "write") {
      pairs.push({ ts, tag, op: "SET ", bytes, d, url });
    } else {
      pairs.push({ ts, tag, op: "GET ", bytes, d, url });
    }
  }

  for (const p of pairs) {
    if (!p.d) continue;
    const extra = `status=${p.d.status} tx=0x${p.d.tx.toString(16).padStart(2, "0")} ` +
      `[${p.d.layout}]${p.d.wire === 91 ? " wire91" : ""}${p.d.checksumOk ? "" : " BAD-CHK"} ` +
      `size=${p.d.dataSize} class=0x${p.d.cls.toString(16).padStart(2, "0")}${p.d.clsName ? `(${p.d.clsName})` : ""} ` +
      `cmd=0x${p.d.cmd.toString(16).padStart(2, "0")} args=${p.d.argsHead}`;
    console.log(`${p.ts} ${p.op} ${p.tag} ${extra}`);
  }

  if (!decoded) {
    console.log("(no 90/91-byte frames decoded — check the log has set/get lines)");
  } else {
    console.log(`\n解码帧: ${decoded}/${pairs.length} 条; 其余为 openDevice/close/read 等非帧行`);
  }
}

main();

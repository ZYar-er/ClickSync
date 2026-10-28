#!/usr/bin/env node
/**
 * parse_razer_pcap.js — Parse tshark-extracted USB capture text into Razer command frames.
 *
 * Why text input: USBPcap runs on the Windows host; the pcap stays there. The
 * Wireshark install ships tshark.exe, so on Windows run:
 *
 *   tshark -r SE-校准.pcapng -Y "usb.capdata || usb.setup.bRequest" -T fields \
 *     -E header=y -E separator=, \
 *     -e frame.number -e usb.urb_type -e usb.endpoint_address \
 *     -e usb.setup.bmRequestType -e usb.setup.bRequest -e usb.setup.wValue \
 *     -e usb.setup.wIndex -e usb.setup.wLength -e usb.capdata > SE-校准.txt
 *
 * then bring SE-校准.txt to WSL and run:
 *
 *   node tools/parse_razer_pcap.js razer官方驱动/pcaps/SE-校准.txt
 *
 * The header line (from -E header=y) is used to detect which columns exist.
 * Output: numbered request/response frames with 90-byte decode (both layouts).
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// 90-byte frame decode (same logic as WebHID_Workbench Razer rule)
// ---------------------------------------------------------------------------
const CLASS_NAMES = {
  0x00: "General", 0x02: "Button", 0x04: "DPI",
  0x07: "Battery/Power", 0x0b: "Sensor/Proximity", 0x0d: "Thermal",
};
const STATUS_NAMES = {
  0x00: "req", 0x01: "busy", 0x02: "ok", 0x03: "err", 0x04: "timeout", 0x05: "unsupported",
};

function decodeRazerFrame(bytes) {
  if (!bytes || bytes.length !== 90) return null;
  const xor = bytes.slice(2, 88).reduce((acc, b) => acc ^ b, 0);
  if (xor !== bytes[88]) return { frame: "bad-checksum", hex: toHex(bytes) };
  const sizeA = (bytes[5] << 8) | bytes[6];
  const sizeB = bytes[5];
  let layout, size, cls, cmd;
  if (sizeA > 0 && sizeA <= 0x50 && (sizeB === 0 || sizeB > 0x50)) {
    layout = "A(OpenRazer)"; size = sizeA; cls = bytes[7]; cmd = bytes[8];
  } else if (sizeB > 0 && sizeB <= 0x50 && (sizeA === 0 || sizeA > 0x50)) {
    layout = "B(Synapse2.5)"; size = sizeB; cls = bytes[6]; cmd = bytes[7];
  } else if (sizeA > 0 && sizeA <= 0x50) {
    layout = "A(OpenRazer)?"; size = sizeA; cls = bytes[7]; cmd = bytes[8];
  } else {
    layout = "B(Synapse2.5)?"; size = sizeB; cls = bytes[6]; cmd = bytes[7];
  }
  const args = Array.from(bytes.slice(9, 9 + Math.min(size, 16)))
    .map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return {
    frame: "razer-90",
    layout,
    status: STATUS_NAMES[bytes[0]] || `0x${bytes[0].toString(16)}`,
    tx: bytes[1],
    dataSize: size,
    cls,
    clsName: CLASS_NAMES[cls] || "",
    cmd,
    argsHead: args,
    hex: toHex(bytes),
  };
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function hexToBytes(s) {
  const clean = String(s).replace(/^0x/i, "").replace(/[^0-9a-fA-F]/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ---------------------------------------------------------------------------
// HID control transfer constants
// ---------------------------------------------------------------------------
const HID_REQUEST = { 0x01: "GET_REPORT", 0x09: "SET_REPORT" };

// ---------------------------------------------------------------------------
// CSV parsing (handles -E separator=, ; quoted values are not expected here)
// ---------------------------------------------------------------------------
function parseCsvLines(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0).map((line) => line.split(","));
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "Usage: node tools/parse_razer_pcap.js <tshark-export.txt>\n" +
      "See the header comment of this file for the tshark command to run on Windows.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }
  const rows = parseCsvLines(fs.readFileSync(inputPath, "utf8"));
  // Normalize tshark field names: "frame.number" -> "number", "usb.capdata" -> "capdata",
  // "usb.setup.bRequest" -> "bRequest", "2.usb.urb_type" -> "urb_type".
  const header = rows[0].map((h) =>
    h.trim()
      .replace(/^\d+\./, "")
      .replace(/^frame\./, "")
      .replace(/^usb\./, "")
      .replace(/^setup\./, ""),
  );
  const col = (name) => header.indexOf(name);
  const get = (row, name) => (col(name) >= 0 ? row[col(name)] : undefined);

  if (!header.some((h) => /capdata|bRequest/i.test(h))) {
    console.error("Unrecognized tshark output: expected -E header=y with capdata/setup fields.");
    process.exit(1);
  }

  const lines = [];
  for (const row of rows.slice(1)) {
    if (row.length < 2) continue;
    const frame = get(row, "number") || get(row, "frame.number") || "?";
    const capdata = get(row, "capdata");
    const bRequest = get(row, "bRequest");
    const bmRequestType = get(row, "bmRequestType");
    const wValue = get(row, "wValue");
    const wLength = get(row, "wLength");
    const urbType = get(row, "urb_type") || "";
    const ep = get(row, "endpoint_address") || "";

    let dir, label, dataHex;
    if (capdata && capdata !== "0x") {
      const bytes = hexToBytes(capdata);
      const isSet = bmRequestType === "0x21" && bRequest === "0x09";
      const isGet = bmRequestType === "0x21" && bRequest === "0x01";
      const endpointIn = /0x8[0-9a-fA-F]/.test(ep || "");
      if (isSet) {
        dir = "OUT"; label = `SET_REPORT wValue=${wValue} wLength=${wLength}`;
      } else if (isGet) {
        dir = "IN"; label = `GET_REPORT wValue=${wValue} wLength=${wLength}`;
      } else if (endpointIn) {
        dir = "IN"; label = `INT-IN ep=${ep} (urb=${urbType})`;
      } else {
        dir = "OUT"; label = `OUT ep=${ep} (urb=${urbType})`;
      }
      const decoded = bytes && bytes.length === 90 ? decodeRazerFrame(bytes) : null;
      lines.push({ frame, dir, label, bytes, decoded });
    } else if (bRequest) {
      // Control request without data stage captured separately (GET_REPORT request).
      const isGet = bmRequestType === "0x21" && bRequest === "0x01";
      if (isGet) {
        lines.push({
          frame,
          dir: "OUT",
          label: `GET_REPORT请求 wValue=${wValue} wIndex=${get(row, "wIndex")} wLength=${wLength}`,
          bytes: null,
          decoded: null,
        });
      }
    }
  }

  if (!lines.length) {
    console.log("No HID packets found. Check the tshark filter (usb.capdata || usb.setup.bRequest).");
    return;
  }

  // Pair GET_REPORT requests with their IN completion data.
  const pendingGet = [];
  for (const line of lines) {
    if (line.label && line.label.startsWith("GET_REPORT请求")) {
      pendingGet.push(line);
    }
  }

  console.log(`# ${path.basename(inputPath)}  —  ${lines.length} HID frames\n`);
  for (const line of lines) {
    const extra = line.decoded
      ? `status=${line.decoded.status} tx=0x${line.decoded.tx.toString(16).padStart(2, "0")} ` +
        `[${line.decoded.layout}] size=${line.decoded.dataSize} ` +
        `class=0x${line.decoded.cls.toString(16).padStart(2, "0")}${line.decoded.clsName ? `(${line.decoded.clsName})` : ""} ` +
        `cmd=0x${line.decoded.cmd.toString(16).padStart(2, "0")} args=${line.decoded.argsHead}`
      : (line.decoded ? `[${line.decoded.frame}]` : "");
    const data = line.bytes ? toHex(line.bytes) : "";
    console.log(`f${line.frame} ${line.dir.padEnd(3)} ${line.label}\n    ${data}${extra ? "\n    " + extra : ""}`);
  }
  console.log(
    "\n提示：GET_REPORT 的 90 字节响应一般在紧随其后的 IN 帧里；" +
    "SET_REPORT 数据即写入内容。对比相邻帧即可看出雷云改了哪个字段。",
  );
}

main();

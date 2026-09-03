# Razer Viper V3 Pro SE Protocol Reference

## 静态逆向发现（2026-08，RazerAppEngine 4.0.692 app.asar + 远程 bundle）

- **架构**：Electron 主进程仅做 HID 传输桥（`electron/UsbRzDeviceAction.js` + `node-rz-hid`，ipc `rzDeviceAction`）；Synapse UI 从 `https://apps.razer.com/synapse/dashboard` 远程加载，设备配置器 iframe 指向 `/synapse/products/<pid>/ui/index.html`。
- **SE 配置器代号 "Wilmat1c"**：`/synapse/products/222/ui`（222=0x00DE 有线），变体目录 `222_0`（有线）与 `222_128/129/130/131`（无线版/区域版）；内含校准页 UI（LIFT-OFF RANGE、表面校准流程文案）。
- **Protocol 2.5 线缆布局**（`electron/Protocol/protocol25.js` 确认）：
  - 90 字节帧：`[0]=status, [1]=tx, [5]=dataSize(单字节), [6]=class, [7]=cmd, [8+]=args, [88]=XOR(2..87), [89]=0x00`
  - 线上实际 **91 字节**：reportId(0x00) 前置；响应读取 91 字节后 `slice(1)` 还原 90 字节帧
  - 65 字节设备需显式 `protocol:'25'` 标记，读取 `reportLength:65`
- **抓包通道**：主进程 `--logProtocol` 启动参数 → `%LOCALAPPDATA%\Razer\RazerAppEngine\User Data\Logs\protocol.log` 记录全部 HID set/get（90/91 字节数组 + PID + 时间戳），10MB×3 轮转。
- **局限**：当前公开 JS bundle 中未定位到帧构造代码（协议层可能随登录态下发），线缆/日志抓包仍为最可靠真源。

## Device Info
- **VID**: 0x1532
- **PID**: 0x00de (Wired), 0x00df (Wireless)
- **Transport**: Legacy V3
- **Report ID**: 0x00
- **Report Size**: 90 bytes

## Command Format

### Packet Structure
```
Byte 0:   Status (0x00=request, 0x02=success, 0x03=error)
Byte 1:   Transaction ID (0x1f)
Byte 2-4: Reserved (0x00)
Byte 5:   Data Size (high byte)
Byte 6:   Data Size (low byte)
Byte 7:   Command Class
Byte 8:   Command ID
Byte 9+:  Arguments
Byte 88:  Checksum (XOR of bytes 2-87)
Byte 89:  0x00
```

### Response Format
Same as request, with:
- Byte 0: Status (0x02 = success)
- Bytes 8+: Echo of class/cmd + response data

---

## Class 0x00 - General

### Get Firmware Version
- **Command**: class=0x00, cmd=0x81, dataSize=0x02
- **Response**: [major, minor]
- **Example**: [0x01, 0x00] = v1.0

### Get Serial Number
- **Command**: class=0x00, cmd=0x82, dataSize=0x16
- **Response**: ASCII string (22 bytes)
- **Example**: "PM2550H30701767"

### Get Polling Rate
- **Command**: class=0x00, cmd=0x85, dataSize=0x01
- **Response**: [polling_code]
- **Codes**: 0x01=1000Hz, 0x02=500Hz, 0x08=125Hz

### Set Polling Rate
- **Command**: class=0x00, cmd=0x05, dataSize=0x01
- **Arguments**: [polling_code]
- **Codes**: 0x01=1000Hz, 0x02=500Hz, 0x08=125Hz

---

## Class 0x04 - DPI

### Get DPI Stages
- **Command**: class=0x04, cmd=0x86, dataSize=0x50
- **Arguments**: [profileId=0x01]
- **Response**: DPI stage data

### Set DPI Stages
- **Command**: class=0x04, cmd=0x06, dataSize=0x50
- **Arguments**: DPI stage data

### DPI Range
- **Min**: 100
- **Max**: 35000

---

## Class 0x07 - Battery & Power

### Get Battery Level
- **Command**: class=0x07, cmd=0x80, dataSize=0x02
- **Response**: [profileId, level]
- **Level**: 0x00-0xff (0-255), convert to percent: level * 100 / 255

### Get Charging Status
- **Command**: class=0x07, cmd=0x84, dataSize=0x02
- **Response**: [profileId, status]
- **Status**: 0x00=not charging, 0x01=charging

### Get Sleep Time
- **Command**: class=0x07, cmd=0x83, dataSize=0x02
- **Response**: [high_byte, low_byte]
- **Value**: (high << 8) | low = seconds
- **Example**: [0x01, 0x2c] = 300 seconds = 5 minutes

### Get Low Battery Threshold
- **Command**: class=0x07, cmd=0x81, dataSize=0x01
- **Response**: [raw_value]
- **Formula**: percent = floor(raw / 255 * 100)
- **Max**: 100%
- **Example**: raw=128 → percent = floor(128/255*100) = floor(50.19) = 50%

### Set Low Battery Threshold
- **Command**: class=0x07, cmd=0x01, dataSize=0x01
- **Arguments**: [raw_value]
- **Formula**: raw = ceil(percent / 100 * 255)
- **Max**: 100% (raw=255)
- **Example**: 15% → raw = ceil(15/100*255) = ceil(38.25) = 39

---

## Class 0x0b - Sensor Features

### Get Dynamic Sensitivity State
- **Command**: class=0x0b, cmd=0x90, dataSize=0x02
- **Arguments**: [profileId=0x01]
- **Response**: [profileId, enabled]
- **Enabled**: 0x00=off, 0x01=on

### Set Dynamic Sensitivity State
- **Command**: class=0x0b, cmd=0x10, dataSize=0x02
- **Arguments**: [profileId=0x01, enabled]
- **Enabled**: 0x00=off, 0x01=on

### Get Dynamic Sensitivity Mode
- **Command**: class=0x0b, cmd=0x91, dataSize=0x02
- **Arguments**: [profileId=0x01]
- **Response**: [profileId, mode]
- **Mode**: 0x00=classic, 0x01=natural, 0x02=jump

### Set Dynamic Sensitivity Mode
- **Command**: class=0x0b, cmd=0x11, dataSize=0x02
- **Arguments**: [profileId=0x01, mode]
- **Mode**: 0x00=classic, 0x01=natural, 0x02=jump

### Get Sensor Angle
- **Command**: class=0x0b, cmd=0x94, dataSize=0x03
- **Arguments**: [profileId=0x01]
- **Response**: [profileId, ???, angle]
- **Angle**: signed int8, range -44 to +44 degrees
- **Note**: arguments[2] = angle value

### Set Sensor Angle
- **Command**: class=0x0b, cmd=0x14, dataSize=0x03
- **Arguments**: [profileId=0x01, state=0x01, angle]
- **Angle**: signed int8, range -44 to +44 degrees
- **Convert**: raw = angle < 0 ? (0x100 + angle) & 0xff : angle & 0xff

### Get Smart Tracking Lift Setting
- **Command**: class=0x0b, cmd=0x8b, dataSize=0x04
- **Arguments**: [classId=0x00, sensorId=0x04]
- **Response**: [classId, sensorId, modeSel, trackingDistance]
- **modeSel**: 0x01=symmetric, 0x04=asymmetric
- **trackingDistance**: level value (0=high, 1=low, 2=medium)

### Set Smart Tracking Lift Setting
- **Command**: class=0x0b, cmd=0x0b, dataSize=0x04
- **Arguments**: [classId=0x00, sensorId=0x04, liftMode, liftHeight]
- **liftMode**: 0x01=symmetric, 0x04=asymmetric

### Get Smart Tracking Configuration
- **Command**: class=0x0b, cmd=0x85, dataSize=0x0a
- **Arguments**: [classId=0x00, sensorId=0x04]
- **Response**: [classId, sensorId, ???, liftOffRaw, landingRaw, ...]
- **liftOff distance**: liftOffRaw + 1
- **landing distance**: landingRaw + 1

---

## Class 0x02 - Button Mapping

### Get Button Mapping (REP4)
- **Command**: class=0x02, cmd=0x8c, dataSize=0x0a
- **Arguments**: [0x01, sourceCode_low, sourceCode_high, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]

### Source Codes
| Slot | Button | Source Code |
|------|--------|-------------|
| 1 | Left Click | 0x0001 |
| 2 | Right Click | 0x0002 |
| 3 | Middle Click | 0x0003 |
| 4 | Side Forward | 0x0005 |
| 5 | Side Back | 0x0004 |
| 6 | Bottom Button | 0x0060 |

### Response Format
```
args[0] = 0x01 (header)
args[1] = sourceCode low byte
args[2] = 0x01 (profileId, NOT sourceCode high byte)
args[3] = quadlet byte 0
args[4] = quadlet byte 1
args[5] = quadlet byte 2
args[6] = quadlet byte 3
```

### Quadlet Mapping
| Quadlet | Action |
|---------|--------|
| [01,01,01,00] | Left Click (1:0) |
| [01,01,02,00] | Right Click (2:0) |
| [01,01,03,00] | Middle Click (4:0) |
| [01,01,05,00] | Back (8:0) |
| [01,01,04,00] | Forward (16:0) |
| [01,01,00,00] | Disabled (7:0) |
| [01,06,06,00] | DPI Cycle (32:5) |
| [0b,01,01,00] | DPI Clutch (1:6) |
| [01,01,09,00] | Scroll Up (1:9) |
| [01,01,0a,00] | Scroll Down (1:10) |

---

## V3 PRO vs V3 PRO SE Differences

| Feature | V3 PRO | V3 PRO SE |
|---------|--------|-----------|
| DPI Max | 45000 | 35000 |
| Polling Rate Write | cmd=0x05 | cmd=0x05 |
| Dynamic Sensitivity Read | cmd=0x90/0x91 | cmd=0x90/0x91 |
| Sensor Angle Read | cmd=0x94 | cmd=0x94 |
| Low Battery Threshold | floor(raw/255*100) | floor(raw/255*100) |
| Low Battery Write | ceil(percent/100*255) | ceil(percent/100*255) |
| Smart Tracking | Supported | Supported |
| Button Mapping | REP4 | REP4 (args[2]=profileId) |
| HyperPolling | Supported (wireless) | Not Supported |

---

## Notes

1. **Button Mapping Response**: V3 PRO SE returns args[2]=0x01 (profileId) instead of sourceCode high byte. The validator must accept this format.

2. **Smart Tracking Config**: The `parseOfficialProximitySensorConfiguration` function uses `dataSize >= 5` to detect the classId/sensorId echo. This threshold is safe — Razer's official `Proximity Sensor Configuration` command uses dataSize=10, so `>=5` correctly handles it without affecting other devices.

3. **Low Battery Threshold**: Confirmed via Razer Synapse desktop reverse engineering (RazerAppEngine 4.0.683 `6120.pretty.js` module 55052):
   - Read formula: `percent = floor(raw / 255 * 100)`
   - Write formula: `raw = ceil(percent / 100 * 255)`
   - Max: 100% (raw=255)

4. **Sleep Time**: V3 PRO SE uses class=0x07, cmd=0x83 for sleep time (not idle time). The response is [high_byte, low_byte] in seconds. Confirmed — Razer calls this "Time to Sleep Mode on Battery Mode".

5. **No HyperPolling**: V3 PRO SE does not support HyperPolling Wireless Dongle mode. Polling rates are limited to 125/500/1000Hz.

6. **Button Mapping Read**: `skipDeviceRead` logic is modified for V3 PRO SE to read button mappings on connect. This does not affect other legacy V3 devices — the condition is guarded by `isViperV3ProSe`.

---

## 抓包实机确认（2026-08-16，--logProtocol 捕获，protocol.log 396 行）

> ⚠️ **全部 4 次抓包（protocol.log / -2 / -3 / -4）均为无线模式（pid=223, 0x00DF，接收器连接）**。
> 有线模式（0x00DE，USB 线直连）未抓包验证；但 OpenRazer PR #2886 对有线+无线均实测通过（命令一致），风险低。

> 来源：雷云桌面版 4.0.692 + SE 无线（pid=223, 0x00df），用户实际操作（校准滑块/低电量/睡眠/DPI/改键）。
> **日志数组为 HEX 格式**（protocolLogger 对 Uint8Array 用 toString(16)）。

### 线缆格式（终版）

```
91B wire: [0]=reportId(0x00) [1]=status [2]=tx [3-5]=res [6]=dataSize [7]=class [8]=cmd
          [9+]=args [89]=checksum=XOR[3..87] [90]=0x00
90B 帧:  同上去掉 reportId：status@[0] tx@[1] dataSize@[5] class@[6] cmd@[7] ck@[88]
```
- 应用有时发 90B dataSend（主进程前置 reportId），有时直接发 91B
- 校验和：`XOR[3..87]`（不含 tx）；个别预构建命令（0x82 serial）校验和按默认 tx=0x1D 计算未更新（应用 bug，设备不校验）
- 设备响应 status=0x02 成功；0x0F/0x02 (SetChromaEffect) → notSupported（SE 无 Chroma）

### 实机命令流（全部与命令表一致，0x80+ 代）

| 命令 | 实测请求 | 实测响应 |
|---|---|---|
| Get Serial 0x00/0x82 (22B) | `[00...]` | `50 4d 32 35 35 30 48 33 30 37 30 31 37 36 37` = "PM2550H30701767" |
| Get Edition 0x00/0x86 (3B) | — | — |
| Get Device Mode 0x00/0x84 (2B) | — | — |
| Set Device Mode 0x00/0x04 (2B) | `[03 00]` | — |
| Get Polling 0x00/0x85 (1B) | `[00]` | `[01]`=1000Hz |
| Set Polling 0x00/0x05 (1B) | `[02]` | 500Hz |
| Get MultiDeviceWirelessV2 0x00/0xbf (80B) | — | `[.. 00 df 00 ff ff ..]`（双链路：pid=0xdf, 0xffff） |
| Get MultiDevicePrimary 0x00/0xc5 (3B) | — | — |
| Get Battery 0x07/0x80 (2B) | `[00 00]` | `[01 xx]` (profileId, raw) |
| Get Charging 0x07/0x84 (2B) | — | — |
| **Get LowBattery 0x07/0x81 (1B)** | `[00]` | `[4d]` 等 → **raw=ceil(pct/100*255) 确认** |
| **Set LowBattery 0x07/0x01 (1B)** | `[4d]` | 5%→0x0d, 10%→0x1a, 15%→0x27, 20%→0x33, 30%→0x4d, 50%→0x80 |
| Get Sleep 0x07/0x83 (2B) | — | `[01 2c]`=300s |
| Set Sleep 0x07/0x03 (2B) | `[00 3c]` | 60s=1分钟（2B BE 秒） |
| Get ActiveDPI 0x04/0x85 (7B) | `[01 00...]` | `[01 06 40 06 40 00 00]` = [profileId, x=1600(2B), y=1600(2B), 0,0] |
| Get DPIStages 0x04/0x86 (80B) | — | `[01 03 05 01] + 5×[id,x2B,y2B,00,00]`（id 1 起） |
| Set DPIStages 0x04/0x06 (38B) | `[01 03 05] + 5×[id,x2B,y2B,00,00]`（id 0 起） | 档位 400/800/1600/3200/6400 |
| **Get ButtonMapping REP4 0x02/0x8c (10B)** | `[01 src mode 00...]` | `[01 src p/m q0 q1 q2 q3 00 00]` |
| **Set ButtonMapping REP4 0x02/0x0c (10B)** | `[01 03 00 06 01 01 00 00 00 00]` | 中键→DPI(fnId=6) |
| Set ProximityState 0x0b/0x03 (3B) | `[00 04 01]` | [classId, sensorId, enabled] |
| **Set LiftSetting 0x0b/0x0b (4B)** | `[00 04 01 00/01/02]` | 校准档位 0/1/2（用户拖滑块） |
| Set AccelState 0x0b/0x10 (2B) | `[01 00]/[01 01]` | [profileId, enabled] |
| Set AccelMode 0x0b/0x11 (2B) | `[01 00]/[01 01]/[01 02]` | 模式 0/1/2（经典/自然/跳跃） |
| Set AngleTune 0x0b/0x14 (3B) | `[01 00 06]` | [profileId, state, angle] |

### 与 ClickSync 现有实现的对照结论

- **所有已实现命令的类/命令码/参数布局与雷云实机流量完全一致**（0x07/0x81+0x01 低电量公式、0x07/0x83+0x03 睡眠、0x0b 传感器族、REP4 等）
- SE 校准 UI 操作对应 `0x0b/0x0b`（Lift Setting，非 0x88 校准数据）——用户拖动的是"智能追踪档位"
- `0x0b/0x88/0x8c/0x8d`（50B/18B 校准数据）在本次抓包中**未出现**——需在雷云"校准"流程（非滑块）中再抓一次

### 非对称截止距离（Smart Tracking）实机确认（protocol-2.log）

操作序列（每个滑块动作重复 3 命令）：
```
0x0b/0x03 [00 04 01]        — Set Proximity State: [classId=0, sensorId=4, enabled=1]
0x0b/0x0b [00 04 04 00]     — Set Lift Setting: [classId, sensorId, mode=0x04(非对称), height=0]
0x0b/0x05 [00 04 LR LL ...] — Set Proximity Configuration (10B): [classId, sensorId, liftRaw, landingRaw, 0×6]
```

- **mode 语义实机确认**：0x01=对称（height=level 0/1/2）、0x04=非对称（height=0，距离由 0x0b/0x05 决定）
- **0x0b/0x05 写入格式**：`[00 04 liftRaw landingRaw 00 00 00 00 00 00]`，距离=raw+1 mm
- **SET 回显确认（协议日志 get 方向）**：设备对每条 SET 精确回显（如写 `[00 04 0c 0b ...]` → 回 `[00 04 0c 0b ...]`）；**雷云从不发独立 GET（0x8b/0x85）**，距离值只存 localStorage——ClickSync 是唯一做读回验证的实现，GET 响应布局尚未实机确认（2026-08-17 起读取路径带 `console.debug` 原始响应日志）
- **默认值验证**：初始写入 `[0x0c, 0x0b]` = 12/11 raw = **13mm/12mm**——与 ClickSync `DEFAULT_RAZER_SMART_TRACKING_OFFICIAL_MODEL`（liftOff=13, landing=12）完全一致
- 用户拖动范围：lift 1~25mm、landing 0~24mm（raw 0x01~0x19 / 0x00~0x18）
- **联动约束（对齐雷云官方 UI）**：se_chunks 确认官方行为——落地滑块 max = 抬起-1（`maxLandingDistance: liftOffDistance - 1`），抬起被拉低到 ≤ 落地时落地压到 抬起-1，落地被拉高到 ≥ 抬起时抬起抬到 落地+1（上限 26）。ClickSync 已实现同款联动（app.js 动态 max + 协议层 prev 感知归一化）
- **0x0b/0x88/0x8c/0x8d（50/18B 校准数据）未出现在任何操作中**——SE 的"校准"页 = 非对称截止距离设置，**无表面校准流程**，这些命令对 SE 可跳过

### OpenRazer PR #2886 交叉验证（2026-08-12, [openrazer/openrazer#2886](https://github.com/openrazer/openrazer/pull/2886)）

作者 Gavin Greer，实机测试（有线 0x00DE + 无线 0x00DF），修复了 #2718 的轮询率 bug。

| 项 | OpenRazer PR | ClickSync（抓包确认） | 结论 |
|---|---|---|---|
| PID | 0x00DE / 0x00DF | 0x00DE / 0x00DF | ✅ |
| DPI_MAX | 35000 | maxDpi=35000 | ✅ |
| POLL_RATES | [125, 500, 1000]（有线+无线） | 无 HyperPolling | ✅ |
| 能力集 | dpi_xy/stages、poll_rate、battery、charging、idle、low_battery_threshold | 同 | ✅ |
| HyperPolling 指示灯 | **被注释掉**（SE 无线不在 hyperpolling indicator 分支） | 矩阵行无 hyperpollingIndicatorMode | ✅ |
| 轮询率写入 | `set_polling_rate2(polling_rate, 0x01)`（tx=0x01 变体） | 0x00/0x05，ClickSync 用 tx=0x1f | ✅ 兼容 |
| 接收器等待 | 无线版 `RAZER_VIPER_MOUSE_RECEIVER_WAIT_US`（同 V3 Pro Wireless） | LEGACY_V3 dongle 处理 | ✅ |
| 测试结论 | charge_low_threshold / idle_time / dpi / poll_rate 全部 OK | 与抓包命令一致 | ✅ |

**结论：第三方独立实现（Linux 内核驱动）与 ClickSync 的 WebHID 实现+抓包结果完全吻合，无冲突。**

### 无线模式睡眠时间实机确认（protocol-4.log）

与有线模式**完全相同**的命令：
```
0x07/0x03 [hi lo]  — Set Time to Sleep（2 字节 BE 秒），写入后立即 0x07/0x83 回读确认
```
用户实测值（无线模式下拉）：240s(4分)、120s(2分)、540s(9分)、840s(14分)、180s(3分)，默认 300s(5分)。
**无独立"无线睡眠"命令（Auto Sleep Mode 0x87/Time To Dim 0x8b 未出现）**；电量读 `[00 17]`=23/255≈9%。

> ⚠️ 以上均为**无线模式**数据。有线模式（0x00DE）应验证：充电状态（0x07/0x84 有线时=充电中?）、有线轮询写入、双链路信息（0x00/0xbf 中 pid 切换）。

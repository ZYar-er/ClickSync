# Viper V3 Pro SE — 实现工作清单（Implementation Map）

> 状态更新：2026-08-16 抓包（protocol.log）已实机确认绝大多数命令（见 v3_pro_se_protocol.md 抓包章节）；
> 2026-08-16 二次抓包（protocol-2 非对称 / protocol-3 校准）确认：SE 的"校准"即非对称截止距离设置
> （0x0b/0x0b mode=0x04 + 0x0b/0x05 10B 配置），**无 0x88/0x8c/0x8d 表面校准流程，可跳过**。
>
> **终态（2026-08-16）**：4 次 --logProtocol 抓包 + OpenRazer PR #2886 交叉验证完成，全部命令已实机确认。
>
> 本文把 `docs/razer_synapse_command_table.md`（雷云桌面版逆向命令表）中与 SE 相关的
> 每条命令映射到 ClickSync 代码落点与"待逆向信息"，作为逆向素材到位后的机械式实现清单。
> 状态：`✅ 已实现` / `⬜ 待实现` / `🔵 部分`

## 命令表布局对照

| 字段 | 雷云内部 Uint8Array | ClickSync/OpenRazer 90 字节帧 |
|---|---|---|
| dataSize | `[0]` 单字节 | `[5-6]` big-endian |
| class | `[1]` | `[7]` |
| cmd | `[2]` | `[8]` |

抓包解析（`tools/parse_razer_pcap.js`）自动识别两种布局。

---

## Class 0x00 — General

| cmd | 名称 | 状态 | 代码落点 | 待逆向信息 |
|---|---|---|---|---|
| 0x81/0x01 | Firmware | ✅ | `ProtocolCodec.commands.getFirmwareVersion` | — |
| 0x82/0x02 | Serial | ✅ | `getSerialNumber` | — |
| 0x85/0x05 | Polling Rate | ✅ | `getPollingRate/setPollingRate` | — |
| 0x88/0x08 | Game Mode State | ⬜ | 新增 `getGameModeState/setGameModeState` + capability `gameMode` + stdKey `gameModeEnabled` + 高级面板 | 参数布局（应为 [enabled]）与 SE 是否支持 |
| 0x84/0x04 | Device Mode | ⬜ | 可选：用于连接态识别 | 非必需 |
| 0x0e | Device Profile Polling Period | ⬜ | 可选 | 非必需 |

## Class 0x02 — Button Mapping

| cmd | 名称 | 状态 | 代码落点 | 待逆向信息 |
|---|---|---|---|---|
| 0x80/0x00 (REP4) | Button Mapping | ✅ | `getButtonMappingRep4/setButtonMappingRep4`（SE 格式：`args[2]=profileId`） | — |
| 0x0f | Get Key Assignment List | ⬜ | 可选：完整按键动作枚举 | 仅当需要补动作类型时 |

## Class 0x04 — DPI

| cmd | 名称 | 状态 | 代码落点 | 待逆向信息 |
|---|---|---|---|---|
| 0x85/0x05 | Active DPI Stage | ✅ | `getActiveDpiStageIndex/setActiveDpiStageIndex` | — |
| 0x86/0x06 | DPI Stages (0x50) | ✅ | `getDpiStages/setDpiStages` | — |
| — | SE maxDpi | ✅ | 矩阵行 `maxDpi: 35000` | 与雷云实际上限核对 |

## Class 0x07 — Battery & Power

| cmd | 名称 | 状态 | 代码落点 | 待逆向信息 |
|---|---|---|---|---|
| 0x80 | Battery Level | ✅ | `getBatteryLevel` | — |
| 0x81/0x01 | Low Battery Threshold | ✅ | `get/setLowBatteryThreshold`（floor/ceil 公式已逆向） | — |
| 0x83/0x03 | Sleep Time | ✅ | `getIdle/setIdle`（class 0x07 语义=电池模式睡眠） | — |
| 0x84 | Charging Status | ✅ | `getChargingStatus` | — |
| 0x82/0x02 | LED Max Brightness on Battery | ⬜ | 新增 `get/setLedMaxBrightnessOnBattery` + capability `ledBatteryBrightness` + 面板 | 参数范围（0-255?）、SE 是否支持 |
| 0x87/0x07 | Auto Sleep Mode | ⬜ | 新增 `get/setAutoSleepMode` + capability `autoSleepMode` + stdKey | 布尔位布局 |
| 0x8b/0x0b | Time To Dim | ⬜ | 新增 `get/setTimeToDim` + capability `timeToDim` | 单位/范围（秒？）、SE 是否支持 |
| 0x90/0x10 | Power Mode Control | ⬜ | 新增 `get/setPowerModeControl` | 模式枚举（SE 是否只有"平衡"？） |
| 0x93/0x13 | Battery Charge Limiter | ⬜ | 新增 `get/setBatteryChargeLimiter` | 百分比编码、SE 是否支持 |
| 0x96 | Low Power Mode State | ⬜ | 只读显示 | 读取布局 |
| 0x8f/0x0f | CPU Boost Control | 🔵 | 仅存在于部分设备 | 确认 SE 不支持则跳过 |

## Class 0x0b — Sensor / Proximity / Smart Tracking（逆向重点）

| cmd | 名称 | 状态 | 代码落点 | 待逆向信息 |
|---|---|---|---|---|
| 0x83/0x03 | Proximity Sensor State | ✅ | `get/setProximitySensorState` | — |
| 0x85/0x05 | Proximity Sensor Configuration (10B) | ✅ | `get/setProximitySensorConfiguration`（`dataSize>=5` 判定） | — |
| 0x8b/0x0b | Proximity Sensor Lift Setting (4B) | ✅ | `get/setProximitySensorLiftSetting` | — |
| 0x90/0x10 | Acceleration State（动态灵敏度开关） | ✅ | `get/setProximitySensorAccelerationState` | — |
| 0x91/0x11 | Acceleration Mode | ✅ | `get/setProximitySensorAccelerationMode` | — |
| 0x94/0x14 | Angle Tune | ✅ | `get/setSensorAngle` | — |
| 0x81/0x01 | Proximity Sensor Threshold (8B) | ⬜ | 新增 `get/setProximitySensorThreshold` | 8 字节布局（多个阈值？），SE 是否支持 |
| 0x88/0x08 | Calibration Data (50B) | ⬜ | **新增 `get/setProximitySensorCalibrationData`** | 50 字节布局（`[0]=classId? [1]=sensorId?`）、校准流程命令顺序 |
| 0x8c/0x0c | Lift-To-Track Calibration Data (18B) | ⬜ | 新增（写） | 18 字节布局、与 0x88 的关系 |
| 0x8d/0x0d | Track-To-Lift Calibration Data (18B) | ⬜ | 新增（写） | 同上 |
| 0x86 | Manual Calibration (7B) | ⬜ | 新增（读） | 布局 |
| 0x80/0x00 | Calibration 启动 | ⬜ | 新增 `startProximitySensorCalibration` | 是否=0x80 读触发校准 |
| 0x87/0x07 | Accuracy (3B) | ⬜ | 可选只读 | — |
| 0x89/0x09 | Control (4B) | ⬜ | 可选 | — |
| 0x8a/0x0a | Lifted Indicator (3B) | ⬜ | 可选 | — |
| 0x92/0x12, 0x93/0x13 | Acceleration Curve (3B/37B) | ⬜ | 可选（动态灵敏度曲线） | 37 字节曲线数据布局 |

## 落地触点汇总（实现阶段改动文件）

| 文件 | 改动 |
|---|---|
| `src/protocols/protocol_api_razer.js` | `ProtocolCodec.commands` 新命令、`TRANSFORMERS`、Planner actions、`buildCapabilities` 新开关、PID 矩阵行 `lowThresholdTx` 等、快照读取（`_readDeviceStateSnapshot`）、写队列分发 |
| `src/refactor/refactor.profiles.js` | RazerProfile `keyMap/transforms/actions/features/ui` 注册新 stdKey |
| `src/refactor/refactor.core.js` | `AppConfig.ranges.razer` 新范围（如 timeToDim 秒表、chargeLimiterPercent、ledBrightness 0-255） |
| `src/core/i18n.literals.js` | 新面板文案 |
| `index.html` | 新面板语义节点 `data-std-key` |
| `docs/razer_synapse_command_table.md` | 回填 "ClickSync 函数" 列 |
| `docs/v3_pro_se_protocol.md` | 新增命令章节 |

## 逆向结论（终态）

- **P0 校准**：SE 无表面校准流程（0x88/0x8c/0x8d 不出现）；"校准"页=非对称截止距离（0x0b/0x0b mode=0x04 + 0x0b/0x05 10B 配置）✅ 已实机确认
- **P0 联动**（2026-08-17）：抬起/落地距离联动对齐官方 UI（落地 max=抬起-1、差值最小 1；拖抬起压落地、拖落地抬抬起）✅ app.js 动态 max + 协议层 prev 感知归一化
- **P0 读回**：SET 回显精确（日志 get 方向）；雷云从不发 GET（0x8b/0x85）→ GET 响应布局待 ClickSync 实机验证（读取路径已加 console.debug 原始响应日志）；用户报"写入读取偏移 1-2"排查中（疑为 GET 失败静默回退 _cfg 默认值）
- **P1 电源**：0x07/0x01+0x81（低电量）、0x07/0x03+0x83（睡眠）✅；**0x82/0x87/0x8b/0x90/0x93 确认 SE 不支持**（抓包未出现），不实现
- **P2 系统**：Game Mode（0x00/0x88）抓包未出现 → SE 无此选项，不实现
- **P3 可选**：加速曲线 0x92/0x93 抓包未出现 → SE UI 无此功能，不实现
- 交叉验证：OpenRazer PR #2886（有线+无线实测）与抓包结论完全一致

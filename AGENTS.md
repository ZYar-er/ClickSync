# AGENTS.md — ClickSync 开发指南

## 项目概述

纯前端静态站点，基于 WebHID API 统一多品牌鼠标配置。无构建依赖，无后端。

## 启动方式

```bash
# 任选一种
python -m http.server 8000
npx http-server . -p 8000
```

访问 `http://localhost:8000/index.html`。必须 https 或 localhost，`file://` 不可用 WebHID。

**无自动化测试、无 lint/typecheck 命令。** 验证靠实机连接。

## 架构分层（按修改频率排序）

```
src/protocols/protocol_api_<brand>.js   ← 品牌协议（Razer/Logitech/Rapoo/ATK/Ninjutso）
src/refactor/refactor.profiles.js       ← 品牌 profile（ranges/keyMap/transforms/actions/features/ui）
src/core/device_runtime.js              ← 设备识别、PID 矩阵、协议脚本动态加载
src/refactor/refactor.core.js           ← AppConfig.ranges、标准键、Reader/Writer 基础能力
src/refactor/refactor.ui.js             ← 纯渲染层（布局、可见性、排序、文案）
src/core/app.js                         ← 启动、握手、写入队列、防抖、DOM 事件绑定
```

**强约束：**
- `protocol_api_*` 不操作 DOM，不读 `refactor.ui.js` / `index.html`
- `app.js` 不写品牌分支，只通过标准键 + 协议层能力快照工作
- UI 层不直接调用 `protocol_api_*`

## 新设备接入顺序

1. `src/refactor/refactor.core.js` — 添加 `AppConfig.ranges.<device>`
2. `src/refactor/refactor.profiles.js` — 新增 profile，注册到 `DEVICE_PROFILES`
3. `src/core/device_runtime.js`:
   - 添加 VID/PID 到 `RAZER_SUPPORTED_PIDS`（或对应品牌集合）
   - 添加 `isXxxPid()` 函数（如 `isViperV3Pid`）
   - 添加 `requestDevice` filter
   - 在 `ensureProtocolLoaded()` 添加协议脚本映射
4. `src/protocols/protocol_api_<brand>.js` — 导出 `window.ProtocolApi`
5. `index.html` — 如有新控件，补充 `data-adv-* / data-std-key` 语义节点

## Razer 协议关键细节

### 传输模式
- `OFFICIAL`：标准 Razer WebHID 协议（V4 Pro 等）
- `LEGACY_V3`：旧版 V3 协议（Viper V3 Pro、V3 Pro SE、Viper Mini SE 等）
- 判断逻辑：`isViperV3Pid(pid)` → `RAZER_VIPER_V3_PIDS` 集合

### 报文格式（90 字节）
```
[0]   status (0x00=请求, 0x02=成功, 0x03=错误)
[1]   transactionId
[2-4] reserved
[5-6] dataSize (big endian)
[7]   commandClass
[8]   commandId
[9+]  arguments
[88]  checksum = XOR(bytes[2..87])
[89]  0x00
```

**注意（2026-08 抓包确认）**：雷云桌面版实际线缆是 **91 字节**（reportId=0x00 前置：
`[0]=reportId [1]=status [2]=tx [3-5]=res [6]=dataSize [7]=class [8]=cmd [89]=checksum [90]=0x00`），
90 字节帧是去掉 reportId 的 dataSend 形态。Viper V3 Pro SE 全系列协议已通过
`--logProtocol` 抓包实机验证（无线模式，pid=0x00DF；有线模式经 OpenRazer PR #2886 验证）。

### PID 能力矩阵
在 `protocol_api_razer.js` 的 `PID_CAPABILITY_MATRIX` 中定义。每个 PID 一行，包含：
- `pollingMode`: "legacy" | "v2"
- `battery`, `dynamicSensitivity`, `sensorAngle`, `smartTracking` 等布尔开关
- `lowBatteryThreshold`: 可覆盖默认值（默认 = !!battery）

### 读取快照逻辑
`_readDeviceStateSnapshot()` 中：
- `readOptionalAdvancedSnapshot = !(isLegacyV3 && isConnectFull) || isViperV3ProSe`
- Legacy V3 设备在 CONNECT_FULL 时默认跳过高级参数读取
- V3 PRO SE 特殊处理：连接时也读取高级参数

### 按键映射（REP4）
- Legacy V3 设备用 REP4 协议读写按键映射
- V3 PRO SE 响应格式特殊：`args[2]` 是 profileId (0x01)，不是 sourceCode 高字节
- 验证器需要兼容两种格式

## 品牌协议模式（通用）

每个 `protocol_api_*.js` 遵循 6+1 层结构：
1. Errors & utilities
2. Device identity & capability model（PID 矩阵）
3. Transport layer（队列、发送/接收、重试）
4. Codec layer（命令构造、响应解析）
5. Transformers（原始值 ↔ 运行时值归一化）
6. Planner（patch 归一化、命令序列编排）
7. ProtocolApi exports（挂载到 `window.ProtocolApi`）

## 调试工具

### WebHID Workbench
`tools/WebHID_Workbench.js` — Userscript，用于抓包分析。
- Hook `sendReport/sendFeatureReport/receiveFeatureReport/inputreport`
- 导出 JSON 快照（含 VID/PID）
- `@match` 包含各品牌官方驱动网站

### 控制台调试
- `window.__HID_API_INSTANCE__` — 当前协议 API 实例
- `_driver.device` — HID 设备对象
- `_driver.sendAndWait(packet)` — 手动发送命令

### 手动发包（控制台）
```javascript
const dev = (await navigator.hid.getDevices()).find(d => d.vendorId === 0x1532 && d.opened);
const pkt = new Uint8Array(90);
pkt[1] = 0x1f; // transactionId
pkt[5] = 0x01; // dataSize high
pkt[6] = 0x01; // dataSize low
pkt[7] = 0x0b; // commandClass
pkt[8] = 0x94; // commandId
pkt[9] = 0x01; // arguments[0]
for (let i = 2; i < 88; i++) pkt[88] ^= pkt[i]; // checksum = XOR(bytes[2..87])
await dev.sendFeatureReport(0x00, pkt);
await new Promise(r => setTimeout(r, 60));
const res = new Uint8Array((await dev.receiveFeatureReport(0x00)).buffer);
console.log("status:", res[0].toString(16));
```

**注意：** checksum 从 `i=2` 开始（不含 tx 字节），不是 `i=1`。

## 已知陷阱

1. **Razer 设备需退出雷云** — 否则雷云覆盖配置
2. **Logitech 需开启板载内存模式** — 否则无法写入
3. **WebHID 需用户手势触发** — 首次连接必须用户点击
4. **Legacy V3 设备连接时跳过高级参数读取** — 需要 refresh 才能读取动态灵敏度/传感器角度
5. **V3 PRO SE 按键映射响应格式** — `args[2]` 是 profileId 不是 sourceCode 高字节
6. **V3 PRO SE 低电量阈值公式** — `floor(raw/255*100)` 读取，`ceil(percent/100*255)` 写入，最大 100%（已通过雷云桌面版逆向确认）
7. **Smart Tracking Config dataSize 检查** — 使用 `>=5` 阈值，安全（雷云官方 Proximity Sensor Configuration dataSize=10）
8. **V3 PRO SE 不支持 HyperPolling** — 回报率限 125/500/1000Hz
9. **Ninjutso 识别严格** — `productName` 必须为 `ninjutso sora v3`（不区分大小写）
10. **V3 PRO SE Smart Tracking 联动** — 抬起 > 落地、差值最小 1（对齐官方 UI `maxLandingDistance=liftOffDistance-1`）：app.js `__normalizeSmartTrackingPair`/`syncSmartTrackingCompositeUi` 动态 max；协议层 `normalizeSmartTrackingDistances(lift, landing, prev)` 按"哪个字段变了"决定压落地还是抬抬起
11. **V3 PRO SE 距离读回** — 设备对 SET 精确回显（raw=dist-1）；雷云从不发 GET 0x8b/0x85（距离仅存 localStorage），GET 响应布局未实机确认——读取路径有 `console.debug` 原始响应日志，排查偏移先看它

## 文档索引

| 文档 | 用途 |
|------|------|
| `docs/PROTOCOL_API_DESIGN_SPEC.md` | 协议文件设计规范 |
| `docs/NEW_BRAND_PROTOCOL_ONBOARDING_SPEC.md` | 新品牌接入流程 |
| `docs/CAPABILITIES_CONTRACT_SPEC.md` | 能力快照契约 |
| `docs/ADVANCED_UI_REUSE_SPEC.md` | 高级面板 UI 复用规则 |
| `docs/PROTOCOL_MAINTAINER_GUIDE.md` | 协议维护者导航 |
| `docs/DEVICE_UI_REGRESSION_CHECKLIST.md` | 设备 UI 回归清单 |
| `docs/v3_pro_se_protocol.md` | V3 PRO SE 协议参考 |

## 文件版本管理

- `index.html` 中 `meta[name="app-asset-version"]` 控制 CSS/JS 缓存版本
- CSS/JS 引用带 `?v=<version>` 查询参数
- 更新版本：修改 `meta` 标签 + 所有 `?v=` 引用
- `tools/bump_js_version.py` 可自动更新版本号

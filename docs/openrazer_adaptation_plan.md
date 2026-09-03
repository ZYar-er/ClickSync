# OpenRazer 适配计划

## 研究总结

### OpenRazer 项目结构

OpenRazer 是一个开源的 Razer 设备驱动项目，支持 Linux 系统。其设备定义分布在三个层级：

| 层级 | 文件路径 | 作用 |
|------|----------|------|
| **PID 常量** | `openrazer/driver/razermouse_driver.h` | 定义所有鼠标 PID (`#define USB_DEVICE_ID_RAZER_*`) |
| **能力矩阵** | `openrazer/driver/razermouse_driver.c` | `razer_mouse_probe()` 中按 PID 分配 sysfs 属性 |
| **设备类** | `openrazer/daemon/openrazer_daemon/hardware/mouse.py` | Python 类定义，包含 METHODS/DPI_MAX/POLL_RATES |

### 协议细节

**报文格式 (90 字节):**
```
[0]   status (0x00=请求, 0x02=成功, 0x03=错误)
[1]   transaction_id
[2-4] remaining_packets (big endian)
[5]   protocol_type (0x00)
[6]   data_size
[7]   command_class
[8]   command_id
[9-88] arguments[80]
[88]  crc = XOR(bytes[2..87])
[89]  reserved (0x00)
```

**主要命令类:**
- `0x00` - 设备控制 (模式、轮询率、序列号)
- `0x03` - LED 效果
- `0x04` - DPI 设置
- `0x07` - 电源/电池管理

---

## ClickSync 当前支持状态

### 已支持的 Razer 鼠标 (13 个 PID)

| PID | 设备名称 | 传输模式 |
|-----|----------|----------|
| `0x00b3` | HyperPolling Wireless Dongle | STANDALONE_DONGLE |
| `0x00b6` | DeathAdder V3 Pro (Wired) | BODY |
| `0x00b7` | DeathAdder V3 Pro (Wireless) | DONGLE |
| `0x00c0` | Viper V3 Pro (Wired) | BODY |
| `0x00c1` | Viper V3 Pro (Wireless) | DONGLE |
| `0x00c2` | DeathAdder V3 Pro (Wired Alt) | BODY |
| `0x00c3` | DeathAdder V3 Pro (Wireless Alt) | DONGLE |
| `0x00c4` | DeathAdder V3 HyperSpeed (Wired) | BODY |
| `0x00c5` | DeathAdder V3 HyperSpeed (Wireless) | DONGLE |
| `0x00de` | Viper V3 Pro SE (Wired) | BODY |
| `0x00df` | Viper V3 Pro SE (Wireless) | DONGLE |
| `0x00e5` | Viper V4 Pro (Wired) | BODY |
| `0x00e6` | Viper V4 Pro (Wireless) | DONGLE |

### OpenRazer 支持的设备 (100+ 个 PID)

OpenRazer 支持大量 Razer 鼠标，包括经典型号和新型号。

---

## 适配优先级建议

### 第一优先级：近现代旗舰鼠标 (2022-2025)

这些设备使用与 ClickSync 已支持设备相似的协议：

| PID | 设备名称 | 适配难度 | 理由 |
|-----|----------|----------|------|
| `0x0099` | Basilisk V3 | 低 | 主流旗舰，协议成熟 |
| `0x00AA` | Basilisk V3 Pro (Wired) | 低 | 与 Viper V3 Pro 相似 |
| `0x00AB` | Basilisk V3 Pro (Wireless) | 低 | 配对设备 |
| `0x00CB` | Basilisk V3 35K | 低 | 新款迭代 |
| `0x00CC` | Basilisk V3 Pro 35K (Wired) | 低 | 新款迭代 |
| `0x00CD` | Basilisk V3 Pro 35K (Wireless) | 低 | 配对设备 |
| `0x00A5` | Viper V2 Pro (Wired) | 低 | 前代旗舰 |
| `0x00A6` | Viper V2 Pro (Wireless) | 低 | 配对设备 |
| `0x0084` | DeathAdder V2 | 低 | 经典款 |
| `0x0085` | Basilisk V2 | 低 | 经典款 |

### 第二优先级：中端及特色设备

| PID | 设备名称 | 适配难度 | 理由 |
|-----|----------|----------|------|
| `0x0078` | Viper | 中 | 2019 款，协议可能略有差异 |
| `0x007A` | Viper Ultimate (Wired) | 中 | 无线旗舰前代 |
| `0x007B` | Viper Ultimate (Wireless) | 中 | 配对设备 |
| `0x0083` | Basilisk X HyperSpeed | 中 | 入门无线 |
| `0x0094` | Orochi V2 (Receiver) | 中 | 轻量无线 |
| `0x0095` | Orochi V2 (Bluetooth) | 中 | 蓝牙版本 |
| `0x008F` | Naga Pro (Wired) | 中 | 模块化侧键 |
| `0x0090` | Naga Pro (Wireless) | 中 | 配对设备 |
| `0x00A7` | Naga V2 Pro (Wired) | 中 | 新款 MMO 鼠标 |
| `0x00A8` | Naga V2 Pro (Wireless) | 中 | 配对设备 |

### 第三优先级：经典设备 (可选)

这些设备使用较旧的协议，可能需要额外适配：
- DeathAdder 系列 (2013-2021)
- Mamba 系列
- Naga 系列 (早期型号)
- 其他 2018 年前设备

---

## 适配流程

### 步骤 1: 收集设备信息

从 OpenRazer 提取目标设备信息：
```bash
# 提取 PID 常量
grep -n "USB_DEVICE_ID_RAZER_" openrazer/driver/razermouse_driver.h

# 提取设备能力 (在 probe 函数中)
grep -A 30 "case USB_DEVICE_ID_RAZER_BASILISK_V3:" openrazer/driver/razermouse_driver.c
```

### 步骤 2: 确定设备能力

根据 OpenRazer 的 `mouse.py` 中的设备类定义，确定：
- `METHODS` - 支持的操作列表
- `DPI_MAX` - 最大 DPI
- `POLL_RATES` - 支持的轮询率
- 是否支持 DPI 分级、电池、充电等

### 步骤 3: 更新 ClickSync 代码

#### 3.1 更新 `src/protocols/protocol_api_razer.js`

在 `PID_CAPABILITY_MATRIX` 中添加新行：
```javascript
buildPidMatrixRow(0x0099, "Razer Basilisk V3", {
  modelKey: "basilisk_v3",
  transportRole: TRANSPORT_ROLE.BODY,
  bodyPid: 0x0099,
  donglePid: null,  // 有线设备
  pollingMode: "legacy",  // 或 "v2" 取决于设备
  battery: false,  // 有线设备通常无电池
  dynamicSensitivity: false,
  sensorAngle: false,
  smartTracking: false,
  maxDpi: 26000,  // 从 OpenRazer DPI_MAX 获取
}),
```

#### 3.2 更新 `src/core/device_runtime.js`

在 `RAZER_SUPPORTED_PIDS` 集合中添加新 PID：
```javascript
const RAZER_SUPPORTED_PIDS = new Set([
  // ... 现有 PID ...
  0x0099, // Basilisk V3
  // ... 其他新 PID ...
]);
```

#### 3.3 更新 `src/refactor/refactor.profiles.js`

如需支持新设备的特殊功能，添加相应的 profile 配置。

### 步骤 4: 测试验证

- 连接设备，检查 WebHID 识别
- 测试 DPI 读取/设置
- 测试轮询率读取/设置
- 测试按键映射 (如适用)
- 测试电池状态 (如适用)

---

## 关键注意事项

### 1. 传输模式判断

OpenRazer 区分有线/无线作为不同设备类。ClickSync 使用 `transportRole`:
- `BODY` - 鼠标本体 (有线连接)
- `DONGLE` - 无线接收器
- `STANDALONE_DONGLE` - 独立接收器 (如 HyperPolling Dongle)

### 2. 轮询率模式

OpenRazer 使用两种轮询率命令：
- V1: `0x00/0x05` (set) / `0x00/0x85` (get) - 125/500/1000Hz
- V2: `0x00/0x40` (set) / `0x00/0xC0` (get) - 支持 8000Hz

ClickSync 使用 `pollingMode: "legacy"` 或 `"v2"` 标识。

### 3. 能力标记

ClickSync 特有的能力标记 (OpenRazer 中没有直接对应):
- `dynamicSensitivity` - 动态灵敏度 (需从 Razer Synapse 逆向)
- `sensorAngle` - 传感器角度调整
- `smartTracking` - 智能追踪 (抬升/放下距离)

这些功能可能需要通过实机抓包确定协议细节。

### 4. Legacy V3 设备

ClickSync 中 `isViperV3Pid()` 判断的设备使用旧版 V3 协议。添加新设备时需确认是否属于此类。

---

## 参考资源

- OpenRazer 源码: `openrazer/` (已 clone，已加入 .gitignore)
- OpenRazer 设备列表: `openrazer/driver/razermouse_driver.h`
- OpenRazer 设备能力: `openrazer/daemon/openrazer_daemon/hardware/mouse.py`
- ClickSync 协议实现: `src/protocols/protocol_api_razer.js`
- ClickSync 设备运行时: `src/core/device_runtime.js`
- Razer 协议文档: `docs/v3_pro_se_protocol.md`
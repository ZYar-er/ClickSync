# Razer Synapse 逆向 SOP（Viper V3 Pro SE）

> 状态：2026 已确认 **Synapse Web Beta 不支持 Viper V3 Pro SE**，因此 Web 版抓包通道作废。
> 逆向主通道 = **雷云桌面版（RazerAppEngine）静态提取** + **Windows USB 抓包（USBPcap）**。
> WebHID Workbench 降级为 ClickSync 自身验证 / 报文回放工具（localhost）。

## 环境分工

| 角色 | 机器 | 职责 |
|---|---|---|
| 抓包机 / 雷云机 | Windows 主机 | 运行雷云桌面版、USBPcap 抓包、Chrome 验证 ClickSync |
| 分析机 | WSL-Ubuntu（本仓库） | 解包分析、命令反推、代码落地、文档更新 |

---

## 通道 A：雷云桌面版静态提取（主通道）

### A1. 定位 app.asar（Windows）

雷云桌面版（RazerAppEngine）是 Electron 应用，bundle 打包在 asar 中。常见位置：

```
C:\Program Files\Razer\RazerAppEngine\resources\app.asar
C:\Program Files (x86)\Razer\RazerAppEngine\resources\app.asar
%LOCALAPPDATA%\Razer\RazerAppEngine\resources\app.asar
```

若找不到，在资源管理器搜索 `app.asar`，或检查进程命令行（任务管理器 → 命令行）确认 exe 路径。

### A2. 解包（Windows 或 WSL 均可，推荐 WSL）

```bash
# 把 app.asar 复制到仓库 razer官方驱动/ 目录后，在 WSL 中：
mkdir -p razer官方驱动
cp /mnt/c/Users/<你>/Downloads/app.asar razer官方驱动/   # 或直接放到 WSL 可访问路径
npx --yes @electron/asar extract razer官方驱动/app.asar razer官方驱动/asar_out
du -sh razer官方驱动/asar_out
```

### A3. 定位 SE 相关 JS（WSL）

```bash
# PID 0x00DE/0x00DF 是 SE 指纹；"Viper V3 Pro SE" 是设备名
grep -rl -i "00de\|00df" razer官方驱动/asar_out --include="*.js" | head -20
grep -rl -i "viper" razer官方驱动/asar_out --include="*.js" | head -20
# 找到设备配置模块后，顺着它的 import/依赖找协议模块
```

### A4. 模块级提取（WSL）

```bash
# 若 bundle 是 webpack 打包的 main.*.js，可用提取工具：
node tools/extract_razer_mouse_bundle.js --bundle razer官方驱动/asar_out/<路径>/main.<hash>.js --rescan
# --rescan 按关键词（00de/00df/viper/proximity/calibration/smarttracking/hyperpolling/obm 等）扫描全部模块，
# 输出到 mouse_modules/rescan/ + rescan_report.json（适配任意新版 bundle，module id 变化也不怕）。
# 老版本 bundle（module id 与 MODULES 列表一致时）直接跑不带参数的原模式。
```

### A5. 反推要点（SE 目标命令）

| 目标 | 已知线索 | 待反推 |
|---|---|---|
| `0x0b/0x88` Calibration Data (50B) | 命令表已列，参数未知 | 布局（`[0]=classId? [1]=sensorId?`），校准流程调用顺序 |
| `0x0b/0x8c,0x0d` Lift-To-Track / Track-To-Lift (18B) | 名称即含义 | 数据格式、与 0x88 的关系 |
| `0x0b/0x81` Proximity Threshold (8B) | 未知 | 阈值原始值格式 |
| `0x07/0x82` LED Brightness on Battery | 未知 | 参数范围 |
| `0x07/0x8b` Time To Dim | 未知 | 单位 / 范围 |
| `0x07/0x87` Auto Sleep Mode | 未知 | 布尔位 |
| `0x07/0x93` Charge Limiter | 未知 | 百分比编码 |
| `0x00/0x88` Game Mode | 未知 | 状态位 |

---

## 通道 B：USB 抓包（验证通道，字节级铁证）

静态逆向只能给出"命令应该长什么样"，USB 抓包能给出"雷云实际发了什么"。

### B1. Windows 侧

**首选方式：内置协议日志（`--logProtocol`，免管理员、免 Wireshark）**

已在 `app.asar`（RazerAppEngine 4.0.692）中确认：Electron 主进程在 `--logProtocol`
启动参数下会把**全部 HID 收发**（`sendFeatureReport` 的 90 字节帧 + `getFeatureReport`
的 91 字节原始响应）写入日志，含产品 PID、时间戳、字节数组。

```bat
:: 1. 完全退出雷云（含托盘图标）
:: 2. 启动（注意是 RazerAppEngine.exe 本体，路径以实际安装为准）：
"C:\Program Files\Razer\RazerAppEngine\RazerAppEngine.exe" --logProtocol
:: 3. 在雷云里操作 SE 设备页：校准页(Lift/Landing 滑块、执行校准)、动态灵敏度、
::    低电量阈值、睡眠、DPI、回报率、按键、游戏模式……
:: 4. 完全退出雷云
:: 5. 拷贝日志：
%LOCALAPPDATA%\Razer\RazerAppEngine\User Data\Logs\protocol.log
::    （若轮转还有 protocol.log.1 / .2 一并拷贝）
```

> 注意：正式版（buildSettings 生产构建）已关闭 F12 控制台（`enableConsole:false`）
> 与远程调试端口（`allowRemoteDebuggingPort:false`），所以上次逆向用的 "CDP dump"
> 方法在正式版走不通；`--logProtocol` 是应用级参数，不受构建常量限制，为唯一可靠通道。

WSL 侧解析：

```bash
node tools/parse_razer_protocol_log.js "razer官方驱动/pcaps/protocol.log"
```

输出示例：
```
2026-08-16 10:00:01.001 SET  222 ... status=req tx=0x1f [B(Synapse2.5)] size=4 class=0x0b(Sensor/Proximity) cmd=0x85 args=00 04 00 00
2026-08-16 10:00:01.060 GET  222 ... status=ok tx=0x1f [B(Synapse2.5)] wire91 size=7 class=0x0b(Sensor/Proximity) cmd=0x85 args=00 04 0a 0b 0c 00 00
```

**备选方式：USBPcap 抓包**（需要管理员 + Wireshark）

1. 安装 [Wireshark](https://www.wireshark.org/)（安装时勾选 **USBPcap** 组件）。
2. 把 `tools/capture_razer_scenarios.cmd` 复制到 Windows 一个空目录，**以管理员身份运行**。
3. 按提示选择 USBPcap 接口，然后逐场景执行：按回车 → 3 秒倒计时 → 在雷云里操作 SE 页面。
   脚本自动产出 `SE-<序号>-<场景>.pcapng`（已过滤 VID=0x1532）和 `SE-<序号>-<场景>.txt`（可直接喂 `parse_razer_pcap.js`）。
4. 抓包前先只开雷云 + 关闭其他 Razer 软件（Chroma 等），减少噪声。

**手动方式**（脚本不可用时的后备）：

1. 打开 Wireshark → 选择 `USBPcap1`（或对应接口）→ 捕获过滤器：
   ```
   usb.idVendor == 0x1532
   ```
2. **抓包前先只开雷云 + 关闭其他 Razer 软件**（Chroma 等），减少噪声。
3. 在雷云中打开 SE 设备页，**逐个操作、逐个保存**：
   - 打开"校准"页（Smart Tracking / 非对称截止距离）→ 拖动 Lift 距离滑块 → 拖动 Landing 距离滑块 → 点"校准"按钮
   - 切换 Smart Tracking 模式（对称/非对称）
   - 动态灵敏度开关 + 模式切换
   - 低电量阈值滑块（5%→100% 逐档）
   - 睡眠时间下拉（含 Time To Dim 若有）
   - DPI 档位修改、当前档切换、回报率切换
   - 按键自定义（改 1 个键 → 保存）
   - 游戏模式开关（若有）
4. 保存每个操作为独立 pcapng：`文件 → 另存为`，命名规范：
   ```
   SE-<操作名>.pcapng      例：SE-校准Lift到10mm.pcapng、SE-低电量阈值30.pcapng
   ```

### B2. WSL 侧解析

```bash
# 把 pcapng 复制到 razer官方驱动/pcaps/
# Windows 侧先用 Wireshark 自带的 tshark.exe 导出文本（-Y 过滤 HID 帧，-E header=y 带表头）：
#   tshark -r "SE-校准.pcapng" -Y "usb.capdata || usb.setup.bRequest" -T fields ^
#     -E header=y -E separator=, ^
#     -e frame.number -e usb.urb_type -e usb.endpoint_address ^
#     -e usb.setup.bmRequestType -e usb.setup.bRequest -e usb.setup.wValue ^
#     -e usb.setup.wIndex -e usb.setup.wLength -e usb.capdata > SE-校准.txt
#   然后把 SE-*.txt 带回 WSL

# WSL 侧解析为 Razer 命令帧（自动识别 90 字节帧、校验 checksum、标注 class/cmd）：
node tools/parse_razer_pcap.js 'razer官方驱动/pcaps/SE-校准.txt'
```

输出示例（节选）：
```
f1 OUT SET_REPORT wValue=0x0000 wLength=0x5a
    00 1f 00 00 00 00 04 0b 85 00 04 ...
    status=req tx=0x1f [A(OpenRazer)] size=4 class=0x0b(Sensor/Proximity) cmd=0x85 args=00 04 00 00
```

对比相邻帧即可看出雷云改了哪个字段，与命令表交叉验证。

---

## 通道 C：ClickSync 自验证 / 回放（WSL + Windows Chrome）

1. Workbench 已加 `http://localhost:8000/*` 匹配。
2. Windows Chrome 打开 `http://localhost:8000/index.html`（需 WSL 起静态服务，见 AGENTS.md），连 SE。
3. 抓 ClickSync 自己发出的读写帧（Workbench 会按 Razer 90 字节帧规则解码 class/cmd）。
4. **回放验证**：把通道 B 抓到的雷云 OUT 帧整理后，可用 Workbench"复刻"功能按原时序重放，对比 ClickSync 行为。
5. 手动发包（控制台）参考 AGENTS.md"手动发包"小节。

---

## 交付物清单（用户需带回 WSL）

| 序号 | 交付物 | 说明 |
|---|---|---|
| 1 | `app.asar`（原文件） | 静态提取源，几十 MB 可接受 |
| 2 | `SE-*.pcapng`（每个操作一个） | 命名带操作说明 |
| 3 | 雷云版本号 + SE 固件版本 | 记录在案，用于版本对照 |
| 4 | （可选）`asar_out/` 里已定位的 SE 模块文件 | 若已自行找到 |

## 版本记录

| 日期 | 事件 |
|---|---|
| 2026 | 确认 Synapse Web Beta 不支持 SE，切换主通道为桌面版 + USBPcap |

@echo off
rem ===========================================================================
rem  capture_razer_scenarios.cmd — Razer Viper V3 Pro SE USB 抓包向导（Windows）
rem
rem  前置条件：
rem    1. 已安装 Wireshark（自带 tshark.exe 与 USBPcap 驱动）
rem    2. 以【管理员身份】运行本脚本（USBPcap 需要管理员权限）
rem    3. 雷云桌面版已打开 SE 设备页面；先退出其他 Razer 软件（Chroma 等）
rem
rem  产出（当前目录）：
rem    SE-<序号>-<场景>.pcapng   原始抓包（已过滤 VID=0x1532）
rem    SE-<序号>-<场景>.txt      tshark 导出文本（可直接喂 parse_razer_pcap.js）
rem
rem  用法：在要存放抓包结果的目录里双击运行（或 cmd 中执行本脚本路径）
rem ===========================================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "TSHARK=tshark"
where tshark >nul 2>nul
if errorlevel 1 (
    if exist "C:\Program Files\Wireshark\tshark.exe" (
        set "TSHARK=C:\Program Files\Wireshark\tshark.exe"
    ) else (
        echo [错误] 找不到 tshark.exe。请先安装 Wireshark 并勾选 USBPcap。
        pause
        exit /b 1
    )
)

echo ============================================================
echo  Razer V3 Pro SE USB 抓包向导
echo ============================================================
echo.

rem ---- 列出接口，挑选 USBPcap ----
echo [1/2] 检测 USBPcap 接口...
"%TSHARK%" -D > "%TEMP%\tshark_ifaces.txt" 2>nul
set "IFACE_IDX="
for /f "delims=" %%l in ('type "%TEMP%\tshark_ifaces.txt"') do (
    echo %%l
    echo %%l | findstr /i "USBPcap" >nul
    if not errorlevel 1 (
        if not defined IFACE_IDX (
            for /f "tokens=1 delims=. " %%n in ("%%l") do set "IFACE_IDX=%%n"
        )
    )
)
if not defined IFACE_IDX (
    echo [错误] 未找到 USBPcap 接口。请确认已安装 USBPcap 驱动并以管理员运行。
    pause
    exit /b 1
)
set /p "PICK=选择接口编号（直接回车用 %IFACE_IDX%）："
if not defined PICK set "PICK=%IFACE_IDX%"
echo 使用接口：%PICK%
echo.

rem ---- 场景清单（可在此增删）----
rem 格式：序号|场景名|操作提示
set "S1=校准-打开校准页初始读取|打开雷云 SE 校准页，等待页面加载完成（含 Lift/Landing 数值回读）"
set "S2=校准-Lift滑块|在雷云校准页，把 Lift(抬升) 距离从最小值逐档拖到最大值，每档停 1 秒"
set "S3=校准-Landing滑块|把 Landing(落地) 距离从最小值逐档拖到最大值，每档停 1 秒"
set "S4=校准-模式切换|在对称/非对称截止距离之间来回切换 2 次"
set "S5=校准-执行校准|点击雷云的校准按钮（若有），等待校准流程完成"
set "S6=动态灵敏度|开关动态灵敏度，并切换 3 种模式（经典/自然/跳跃）"
set "S7=低电量阈值|把低电量阈值从 5% 逐档拖到 100%，每档停 1 秒"
set "S8=睡眠时间|把睡眠时间下拉从最小值切到最大值，每个选项停 1 秒"
set "S9=DPI档位|修改 DPI 档位值、当前档切换、X/Y 独立 DPI（若有）"
set "S10=回报率|回报率在 125/500/1000 之间切换，每个停 2 秒"
set "S11=按键映射|把任意一个按键改成其他功能并保存"
set "S12=游戏模式|打开/关闭游戏模式（若有该选项）"
set "S13=连接全量回读|断开重连设备，让雷云完整读取一次设备配置"

echo [2/2] 开始分场景抓包。共 13 个场景，每个窗口 25 秒。
echo 每个场景：按回车开始 -> 3 秒倒计时 -> 立即在雷云里执行提示的操作。
echo.
for /l %%n in (1,1,13) do (
    set "SCEN=!S%%n!"
    for /f "tokens=1,2 delims=|" %%a in ("!SCEN!") do (
        set "NAME=%%a"
        set "TIP=%%b"
    )
    echo --------------------------------------------
    echo  场景 %%n/13 ：!NAME!
    echo  操作提示：!TIP!
    echo --------------------------------------------
    set /p "GO=按回车开始抓包（25 秒窗口）..."
    echo 倒计时 3 秒... 开始操作！
    timeout /t 3 /nobreak >nul
    "%TSHARK%" -i %PICK% -a duration:25 -w "SE-%%n-!NAME!.pcapng" >nul 2>nul
    echo 抓包完成，正在导出文本...
    "%TSHARK%" -r "SE-%%n-!NAME!.pcapng" -Y "usb.idVendor == 0x1532" ^
        -w "SE-%%n-!NAME!.filtered.pcapng" >nul 2>nul
    "%TSHARK%" -r "SE-%%n-!NAME!.filtered.pcapng" ^
        -Y "usb.capdata || usb.setup.bRequest" -T fields -E header=y -E separator=, ^
        -e frame.number -e usb.urb_type -e usb.endpoint_address ^
        -e usb.setup.bmRequestType -e usb.setup.bRequest -e usb.setup.wValue ^
        -e usb.setup.wIndex -e usb.setup.wLength -e usb.capdata > "SE-%%n-!NAME!.txt"
    del "SE-%%n-!NAME!.filtered.pcapng" >nul 2>nul
)
echo.
echo ============================================================
echo  全部完成！请把本目录的 SE-*.pcapng 和 SE-*.txt 复制到
echo  WSL 仓库的 razer官方驱动/pcaps/ 目录，然后运行：
echo    node tools/parse_razer_pcap.js "razer官方驱动/pcaps/SE-xx-*.txt"
echo ============================================================
pause

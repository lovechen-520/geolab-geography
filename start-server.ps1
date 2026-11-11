# GeoLab 一键启动（本机 TeleAgent 模型模式）
# 用法（在项目根目录）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\start-server.ps1
# 作用：
#   1) 确认 TeleAgent 桌面版正在运行（本地后端 127.0.0.1:4397）
#   2) 重新获取本次运行期的本地会话密钥（App 重启后密钥会变）
#   3) 以 teleagent 模式启动 server.mjs，浏览器打开 http://127.0.0.1:8787
# 不联网、不上传任何数据；只在本机回环地址与 TeleAgent 通信。
# 说明：密钥获取依赖本机接管工具目录 D:\DSH-Workspaces\teleagent-bridge；
#       若该目录不存在或获取失败，脚本会自动以 offline 模式启动。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridge = 'D:\DSH-Workspaces\teleagent-bridge'

function Test-Backend {
  $c = Get-NetTCPConnection -LocalPort 4397 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return [bool]$c
}

if (-not (Test-Backend)) {
  Write-Host '未检测到 TeleAgent 本地后端（127.0.0.1:4397）。' -ForegroundColor Yellow
  Write-Host '请先启动 TeleAgent 桌面版并保持运行，然后重试；也可以直接离线使用：' -ForegroundColor Yellow
  Write-Host '  双击 index.html（无需模型，全部学习功能可用）'
  exit 1
}

$env:GEO_MODEL_MODE = 'offline'
$keyFile = Join-Path $bridge '.session-key'
$refresh = Join-Path $bridge 'refresh-key.ps1'

if (Test-Path $refresh) {
  Write-Host '正在获取 TeleAgent 本次运行期的本地会话密钥…'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $refresh
  if ($LASTEXITCODE -eq 0 -and (Test-Path $keyFile)) {
    $env:GEO_MODEL_MODE = 'teleagent'
    $env:TELEAGENT_KEY_FILE = $keyFile
    Write-Host '模型模式：teleagent（使用 TeleAgent 的账号与模型）' -ForegroundColor Green
  } else {
    Write-Host '密钥获取失败，将以离线模式启动（AI 助教使用内置知识库回答）。' -ForegroundColor Yellow
  }
} else {
  Write-Host '未找到密钥获取脚本，将以离线模式启动。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '启动 GeoLab 服务：http://127.0.0.1:8787 （Ctrl+C 停止）' -ForegroundColor Cyan
Push-Location $root
try {
  & node (Join-Path $root 'server.mjs')
} finally {
  Pop-Location
}

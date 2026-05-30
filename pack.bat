@echo off
chcp 65001 >nul
echo ================================
echo Daily Text Editor - 打包脚本
echo ================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js v20 或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] 正在安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [2/3] 正在打包 exe...
call npm run dist
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo [3/3] 打包完成！
echo exe 文件位于 dist\ 目录下
echo.
pause

# 开发与构建

## 环境

推荐 Windows x64、Node.js 22 LTS 和 npm。技术栈：Electron 38、React 19、TypeScript、Vite、Vitest、better-sqlite3、SheetJS。依赖版本以 `package-lock.json` 为准。

```powershell
npm ci
npm run dev
```

开发模式启动 Vite 和 Electron，使用 5173 端口。单独在浏览器访问 Vite 不能调用 Electron 的行情与文件存储桥接接口。

## 检查

```powershell
npm run lint
npm run test:unit
npm run build
```

better-sqlite3 是原生模块。切换 Node 或 Electron 版本后若报 ABI 不匹配，应在目标 Node 版本下重新安装／重建依赖；不要把其他电脑的 node_modules 复制过来。当前有效测试集位于 tests/unit；package.json 中 component/e2e 命令是预留入口，本发布不声称已有对应完整测试套件。

## Windows 安装包

```powershell
npm run package:win
```

输出位于 release。Windows 图标来自 assets/icons/app-icon.ico，包含 7 种尺寸；窗口运行时图标作为额外资源复制到 resources/app-icon.ico。

如维护者已经确认当前依赖适配目标运行环境，可在本机打包时显式跳过原生依赖重建：

```powershell
npm run build
& .\node_modules\.bin\electron-builder.cmd --win nsis '--config.npmRebuild=false'
```

不要将跳过重建视为解决 ABI 不匹配的通用方法。发布前应实际检查安装、启动、刷新、保存、导出及图标。签名与作者身份需由维护者自行配置，本项目不提供私钥、签名证书或 GitHub Token。

## 目录

- src/renderer：界面、持仓计算、排行和 Excel 导出。
- src/main：Electron 窗口、文件存储、行情服务及数据库模块。
- src/preload：隔离的 IPC 桥接。
- src/shared：数据模型。
- assets：当前版本图像及应用图标。
- tests/unit：现有单元测试。

GitHub Actions 提供 Windows Node 22 的类型检查、单元测试和构建。该工作流不自动发布、不自动上传安装包，也不声明代码已签名。

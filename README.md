# page-agent-userscript

在**任意网页**手动启动 [PageAgent.js](https://github.com/alibaba/page-agent) 的油猴脚本。

整库打包、零运行时外部依赖：打开网页 → 点油猴菜单 → 开始用自然语言操作页面。

## 功能

- 🚀 油猴菜单命令 `启动 Page-Agent` / `Page-Agent 设置`，页面零常驻注入
- ⚙️ Shadow DOM 设置面板（不污染页面、不被页面样式干扰），支持配置：
  - **model**：datalist 预置 7 个官方 ⭐ 推荐模型，可自由输入
  - **baseURL**：datalist 预置阿里云百炼 / OpenAI / 免费测试端点，可自由输入任意 OpenAI 兼容端点（含 Ollama、LM Studio 等本地服务）
  - **apiKey**：本地 LLM 或免费测试端点可留空
  - **language**：跟随浏览器（默认）/ 简体中文 / English
- 📌 端点列表：点「应用」即按 [model+baseURL] upsert 整套配置；下拉菜单以 `模型 - [api host]` 展示，点击加载、悬停删除；「重置」还原表单默认值
- 🌐 LLM 请求方式三模式（默认**自动**）：直连优先、失败（CORS / http 混合内容 / GitHub 类站点 CSP `connect-src` 拦截）自动回退油猴代理；可选强制直连（保留流式）或强制代理（万能但非流式）
- 🔄 打开设置面板自动检查上游库版本
- 🤖 GitHub Actions 每周监控 npm 上游版本，发新版后自动重新构建并提交，Tampermonkey 用户经 `@updateURL` 自动更新

## 安装

浏览器装好 [Tampermonkey](https://www.tampermonkey.net/) 后，打开：

```
https://raw.githubusercontent.com/flashlab/page-agent-userscript/main/dist/page-agent-userscript.user.js
```

Tampermonkey 会弹出安装确认。之后它会按 `@updateURL` 自动检查更新。

## 使用

1. 在任意网页点击 Tampermonkey 图标 → `⚙️ Page-Agent 设置`，填入 baseURL 和 model（apiKey 视端点而定），保存
2. 点击 `🚀 启动 Page-Agent`，面板出现后即可用自然语言下达任务
3. 改了配置后再次点"启动"即可生效（旧实例会被销毁重建）

## 开发

```bash
npm install        # 安装依赖（page-agent 固定为 latest 标签）
npm run build      # 打包出 dist/page-agent-userscript.user.js（单文件，含 userscript 头）
npm run dev        # watch 模式
npm run typecheck  # tsc --noEmit
npm test           # vitest + jsdom 单测
npm install page-agent@latest   # 手动升级上游库
```

### 项目结构

```
src/
  main.ts            # 入口：注册油猴菜单
  launcher.ts        # 启动生命周期（未配置→弹设置；重复启动→dispose 重建）
  settings.ts        # GM_setValue 跨站点设置存储
  settings-panel.ts  # Shadow DOM 设置面板（closed 模式）
  version-check.ts   # npm registry 版本检查 + semver 比较
  gm-fetch.ts        # 经 GM_xmlhttpRequest 的 fetch 实现（绕过 CORS）
  presets.ts         # 星标推荐模型 / 预置端点（快照，来源见文件注释）
scripts/build.mjs    # esbuild 打包 + userscript 头注入 + 版本常量注入
tests/               # vitest + jsdom 单测
.github/workflows/   # 每周同步上游版本并自动构建
```

### 自动更新机制

- 用户侧：Tampermonkey 按 `@updateURL` 定期检查 `@version`，更大则更新
- 构建侧：workflow 每周一 00:00 UTC（可手动触发）比较本地与 npm 的 page-agent 版本；有新版则升级依赖 → `npm version patch` → 测试 → 构建 → commit 回 main。无需配置任何额外 secret

## 推荐模型快照（2026-08，[来源](https://alibaba.github.io/page-agent/docs/features/models)）

`qwen3.5-plus` · `qwen3.5-flash` · `gpt-5.4-mini` · `gpt-5.4-nano` · `claude-haiku-4-5` · `gemini-3.5-flash` · `deepseek-v4-flash`

上游推荐列表更新时改 `src/presets.ts` 即可。datalist 只是建议，任何模型名都能输入。

## ⚠️ 安全提示

- **apiKey 以明文存储在油猴扩展的存储区**。个人使用没有问题，但不要把你的 Tampermonkey 配置备份或同步数据分享给别人
- 不要把真实 apiKey 提交进任何会被公开的代码里
- 免费测试端点仅供技术评估，数据经中国大陆服务器处理，勿输入敏感信息（[使用条款](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md)）

## License

MIT

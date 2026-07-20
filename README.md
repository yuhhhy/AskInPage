# AskInPage

AskInPage 是一个基于 Manifest V3 的 Chrome / Edge 扩展。在任意网页选中文字，即可使用自己的 AI API Key 获得即时解释或翻译。

## 功能

- 解释词语、短语或段落，并结合当前页面上下文消除歧义
- 选中文字后按 `T`，在中英文之间快速翻译
- 在回答面板中追加问题，支持流式输出
- 回答面板可拖拽、固定、复制和重新生成
- 支持 OpenAI-compatible Chat Completions API
- API Key 保存在浏览器的 `storage.sync` 中，不经过中间服务器

## 项目结构

```text
AskInPage/
├── src/                         # 可直接加载的扩展源码
│   ├── manifest.json            # Manifest V3 清单
│   ├── background/
│   │   └── service-worker.js    # 请求模型、转发流式响应
│   ├── content/
│   │   ├── index.js             # 网页选区与回答面板
│   │   └── styles.css           # 注入页面的样式
│   ├── options/
│   │   ├── index.html           # 扩展弹窗与设置页
│   │   └── index.js
│   └── shared/
│       └── options.js           # background/options 共用默认配置
├── demo/                        # 不安装扩展也能预览交互的演示页
├── dist/                        # npm run build 生成的发布包（不提交）
├── package.json
└── README.md
```

`src` 本身就是完整的扩展根目录，不需要编译后才能调试。发布时再将它校验并打成 zip。

## 本地安装

### Chrome

1. 打开 `chrome://extensions`
2. 开启右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目的 `src` 目录

### Edge

1. 打开 `edge://extensions`
2. 开启“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择本项目的 `src` 目录

加载后点击工具栏中的 AskInPage 图标，填写 Base URL、Model 和 API Key。

## 配置示例

| 服务 | Base URL | 模型示例 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` |

Base URL 填到 `/v1` 即可，也可以直接填写完整的 `/chat/completions` 地址。

## 开发与发布

```bash
npm install
npm run dev
```

开发命令会启动一个加载了 `src` 的独立 Chromium 窗口，并在文件变化后自动重载扩展。

```bash
npm run lint
npm run build
```

- `npm run lint`：检查扩展清单和源码是否符合 WebExtension 规范
- `npm run build`：校验后在 `dist` 中生成可发布的 zip 包

演示页面可以直接打开 `demo/index.html`，或在项目根目录启动任意静态服务器。演示模式默认返回示例内容；也可以连接允许跨域访问的本地 Ollama。

## 权限说明

- `storage`：保存 API Key 和用户设置
- `host_permissions: <all_urls>`：在网页中注入选区交互，并向用户配置的模型服务发送请求

## License

MIT

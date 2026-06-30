# Ask in Page

Chrome 插件：在任意网页选中文字，即可用你自己的 AI API Key 获得即时解释或翻译。

## 功能

- **解释词语/短语**：选中后点击弹出按钮，200 字以内的维基百科式解释
- **解释一段话**：结合当前页面上下文，500 字以内说清楚这句话的意思
- **翻译**：选中后按 `T`，直接翻译（中↔英互译）
- **追加提问**：在弹出框的输入框里打字，按 Enter 追加自定义问题
- **流式输出**：回答边生成边显示
- **可拖拽、可固定**：回答面板可拖动位置，点击图钉锁定不自动关闭
- 支持任意 OpenAI-compatible Chat Completions API
- API Key 存储在 Chrome `storage.sync`，不经过任何第三方服务器

## 安装

> 目前未上架 Chrome Web Store，需手动加载。

1. 下载或克隆本仓库到本地
2. 打开 Chrome，访问 `chrome://extensions`
3. 右上角开启 **Developer mode**
4. 点击 **Load unpacked**，选择本仓库根目录
5. 点击工具栏扩展图标，填写 Base URL、Model 和 API Key，保存

## 配置示例

| 服务 | Base URL | 推荐模型 |
|------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` |

Base URL 填到 `/v1` 即可，插件会自动补全 `/chat/completions`。

## 快捷操作

| 操作 | 行为 |
|------|------|
| 选中文字 | 出现 Ask 按钮 |
| 点击 Ask 按钮 | 解释选中内容 |
| 按 `Enter`（焦点在输入框时）| 带追加问题发送 |
| 按 `T` | 翻译选中内容 |
| 右键回答面板 | 复制 / 重新生成 |

## 权限说明

- `storage`：保存你的 API Key 和设置
- `host_permissions: <all_urls>`：在所有网页注入选区按钮

模型请求由扩展 background service worker 直接发出，绕过网页自身的 CORS 限制，你的 API Key 不经过任何中间服务器。

## License

MIT

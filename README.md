<h1 align="center">AskInPage</h1>

<p align="center">
  <strong>简体中文</strong> · <a href="./README_EN.md">English</a>
</p>

<p align="center">
  在任意网页选中文字，获得结合页面上下文的 AI 解释或翻译
</p>

<p align="center">
  划一下，问一下，少一点跳转
</p>

<p align="center">
  <img src="./public/icons/icon-128.png" width="128" height="128" alt="AskInPage Logo">
</p>


<p align="center">
  Manifest V3 · React · TypeScript · Chrome · Edge
</p>

## 功能概览

### 💬 上下文解释

选中网页中的词语、短语或段落后，AskInPage 会读取附近的页面文字，结合上下文解释选中内容，减少术语歧义和来回搜索。

### 🌐 快捷翻译

选中文字后按下 `T` 即可翻译，按下 `Enter` 直接询问；

### ✍️ 追加提问

选中文字后，可以直接输入自己的问题。AskInPage 会同时参考选中文字、附近内容和追加问题生成回答。

### 回答面板

- 支持流式输出
- 支持拖拽和固定位置
- 右键可以复制回答或重新生成
- 可以选中回答中的内容继续递归式地提问

## 安全与权限

- API Key 仅保存在当前设备的浏览器扩展本地存储中，不参与浏览器同步
- 远程模型服务必须使用 HTTPS；本机回环地址可以使用 HTTP
- 扩展会读取选中文字及相关页面文字，并将其发送至用户配置的模型服务。请勿在涉及敏感信息或有严格隐私要求的场景中使用
- 完整说明参见 [隐私政策](./PRIVACY.md)

## 本地安装

1. 打开 Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 运行 `npm run build`，然后选择本项目生成的 `dist` 目录

## 开发与发布

```bash
npm install
npm run lint
npm run build
```

发布新版本时
```bash
npm run release -- major
```

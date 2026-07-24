<h1 align="center">AskInPage</h1>

<p align="center">
  <a href="./README.md">简体中文</a> · <strong>English</strong>
</p>

<p align="center">
  Select text on any webpage to get an AI-powered explanation or translation based on the page context
</p>

<p align="center">
  Select, ask, and stay on the page
</p>

<p align="center">
  <img src="./public/icons/icon-128.png" width="128" height="128" alt="AskInPage Logo">
</p>

<p align="center">
  Manifest V3 · React · TypeScript · Chrome · Edge
</p>

## Features

### 💬 Context-Aware Explanations

After you select a word, phrase, or paragraph on a webpage, AskInPage reads the surrounding text and explains your selection in context, reducing ambiguity and the need for repeated searches.

### 🌐 Quick Translation

After selecting text, press `T` to translate it or `Enter` to ask about it directly.

### ✍️ Follow-Up Questions

After selecting text, you can type your own question. AskInPage uses the selected text, its surrounding context, and your additional question to generate an answer.

### Answer Panel

- Streams responses as they are generated
- Supports dragging and pinning
- Lets you right-click to copy or regenerate an answer
- Lets you select text within an answer and ask follow-up questions recursively

## Security and Permissions

- Your API key is stored only in the browser extension's local storage on the current device and is not synced through your browser account
- Remote model services must use HTTPS; HTTP is allowed only for local loopback addresses
- The extension reads your selected text and relevant page content, then sends them to your configured model service. Do not use it with sensitive information or in situations with strict privacy requirements
- See the [Privacy Policy](./PRIVACY_EN.md) for full details

## Local Installation

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Run `npm run build`, then select the generated `dist` directory

## Development and Release

```bash
npm install
npm run lint
npm run build
```

To publish a new version:

```bash
npm run release -- major
```

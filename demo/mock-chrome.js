(function () {
  const P = 'aip_';
  const listeners = [];

  const DEMO = {
    explain: (t) =>
      `**${t.slice(0, 28)}${t.length > 28 ? '...' : ''}**\n\n这是 **Demo 模式**下的示例回答，没有真实 AI 调用。\n\n如需真实回答，请在右上角设置中填写一个支持跨域的本地服务，例如 **Ollama**（Base URL: \`http://localhost:11434/v1\`，Model: \`qwen2.5:7b\`，无需 API Key）。\n\n> OpenAI / DeepSeek 等云端服务因浏览器跨域限制，在此 Demo 页面无法直接调用，但安装插件后完全正常。`,
    translate: (t) =>
      `**[Demo 翻译]**\n\n「${t.slice(0, 60)}${t.length > 60 ? '...' : ''}」\n\n→ *This is a demo translation. Configure Ollama in the settings panel to get real translations.*`
  };

  async function streamText(requestId, text) {
    for (let i = 0; i < text.length; i += 4) {
      await new Promise((r) => setTimeout(r, 22));
      const chunk = text.slice(i, i + 4);
      for (const fn of listeners) {
        try { fn({ type: 'ASK_CHAT_DELTA', requestId, chunk }, null, () => {}); } catch {}
      }
    }
  }

  async function callApi(payload) {
    const { requestId, selectedText, userPrompt, intent } = payload;
    const apiKey = localStorage.getItem(P + 'apiKey') || '';
    const base = (localStorage.getItem(P + 'apiBaseUrl') || 'http://localhost:11434/v1').replace(/\/+$/, '');
    const model = localStorage.getItem(P + 'model') || 'qwen2.5:7b';
    const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

    const prompt =
      intent === 'translate'
        ? `将以下文本翻译（中文↔英文互译），只输出译文：\n「${selectedText}」`
        : `用简洁的 Markdown 解释这段文字（禁止标题，禁止复述原文）：「${selectedText}」${userPrompt ? `\n\n追加提问：${userPrompt}` : ''}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey || 'demo'}` },
      body: JSON.stringify({ model, temperature: 0.2, stream: true, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let content = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const chunk = JSON.parse(raw).choices?.[0]?.delta?.content || '';
            if (!chunk) continue;
            content += chunk;
            for (const fn of listeners) {
              try { fn({ type: 'ASK_CHAT_DELTA', requestId, chunk }, null, () => {}); } catch {}
            }
          } catch {}
        }
      }
    }
    return content;
  }

  function storageGet(defaults) {
    const out = {};
    for (const [k, def] of Object.entries(defaults)) {
      const raw = localStorage.getItem(P + k);
      if (raw === null) { out[k] = def; continue; }
      out[k] =
        typeof def === 'boolean' ? raw === 'true'
        : typeof def === 'number' ? (Number(raw) || def)
        : raw;
    }
    return out;
  }

  window.chrome = {
    runtime: {
      sendMessage(msg) {
        return new Promise(async (resolve) => {
          if (msg?.type === 'ASK_CHAT_CANCEL') { resolve({ ok: true }); return; }
          if (msg?.type !== 'ASK_CHAT_EXPLAIN') { resolve(null); return; }

          const { requestId, intent, selectedText } = msg.payload;

          try {
            const content = await callApi(msg.payload);
            if (content.trim()) { resolve({ ok: true, data: { content } }); return; }
          } catch (e) {
            console.warn('[AskInPage Demo] API unavailable, using demo mode:', e.message);
          }

          const demoText = (DEMO[intent] || DEMO.explain)(selectedText);
          await streamText(requestId, demoText);
          resolve({ ok: true, data: { content: demoText } });
        });
      },
      onMessage: { addListener: (fn) => listeners.push(fn) }
    },
    storage: {
      sync: {
        get: (defaults) => Promise.resolve(storageGet(defaults)),
        set: (data) => {
          for (const [k, v] of Object.entries(data)) localStorage.setItem(P + k, String(v));
          return Promise.resolve();
        }
      }
    }
  };
})();

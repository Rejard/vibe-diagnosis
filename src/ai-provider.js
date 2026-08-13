const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    chatPath: '/v1/chat/completions',
    buildHeaders(apiKey) {
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    },
    buildBody(model, messages) {
      return JSON.stringify({ model, messages, temperature: 0.2 });
    },
    extractContent(json) {
      return json.choices?.[0]?.message?.content || '';
    },
  },

  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    chatPath: '/v1/messages',
    buildHeaders(apiKey) {
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
    },
    buildBody(model, messages) {
      const system = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));
      return JSON.stringify({ model, system, messages: userMessages, max_tokens: 8192, temperature: 0.2 });
    },
    extractContent(json) {
      const block = json.content?.find(b => b.type === 'text');
      return block?.text || '';
    },
  },

  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    chatPath: null,
    buildChatUrl(model) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    },
    buildHeaders(apiKey) {
      return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
    },
    buildBody(model, messages) {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      const contents = userMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body = { contents, generationConfig: { temperature: 0.2 } };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }
      return JSON.stringify(body);
    },
    extractContent(json) {
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },

  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai',
    chatPath: '/api/v1/chat/completions',
    buildHeaders(apiKey) {
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    },
    buildBody(model, messages) {
      return JSON.stringify({ model, messages, temperature: 0.2 });
    },
    extractContent(json) {
      return json.choices?.[0]?.message?.content || '';
    },
  },
};

const REQUEST_TIMEOUT_MS = 60000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

async function readLimitedText(response, limit = MAX_RESPONSE_BYTES) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new Error(`Provider response exceeds ${limit} bytes`);
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > limit) throw new Error(`Provider response exceeds ${limit} bytes`);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error(`Provider response exceeds ${limit} bytes`); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function chat(providerName, apiKey, model, messages) {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);
  if (!apiKey) throw new Error('API key is required');
  if (!model) throw new Error('Model name is required');

  const url = provider.buildChatUrl
    ? provider.buildChatUrl(model, apiKey)
    : `${provider.baseUrl}${provider.chatPath}`;

  const headers = provider.buildHeaders(apiKey);
  const body = provider.buildBody(model, messages);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    if (!response.ok) {
      const errText = await readLimitedText(response, 64 * 1024).catch(() => 'Unknown error');
      let errMsg = `${provider.name} API error (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg += ': ' + (errJson.error?.message || errJson.error?.type || errText);
      } catch {
        errMsg += ': ' + errText.slice(0, 200);
      }
      throw new Error(errMsg);
    }

    const json = JSON.parse(await readLimitedText(response));
    const content = provider.extractContent(json);
    if (!content) throw new Error(`Empty response from ${provider.name}`);
    return content;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${provider.name} API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({ id: key, name: p.name }));
}

module.exports = { chat, listProviders, PROVIDERS };

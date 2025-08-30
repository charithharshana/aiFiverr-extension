/**
 * AI Assistance Base Class for Browser Extension
 * Core functionality for AI assistance system
 */

// Note: Using global variables instead of ES6 imports for browser extension compatibility

/**
 * Base LLM Class
 */
class LLM {
  static service = 'base';
  static DEFAULT_BASE_URL = '';
  static DEFAULT_MODEL = '';
  static isLocal = false;
  static isBearerAuth = false;
  static MessageExtendedContentInputKey = 'text';

  constructor(input, options = {}) {
    this.service = options.service || this.constructor.service;
    this.messages = [];
    this.options = {
      service: 'google',
      max_tokens: 4096,
      temperature: 0.7,
      stream: false,
      extended: false,
      think: false,
      ...options
    };
    this.model = options.model || this.constructor.DEFAULT_MODEL;
    this.baseUrl = options.baseUrl || this.constructor.DEFAULT_BASE_URL;
    this.stream = options.stream || false;
    this.max_tokens = options.max_tokens || 4096;
    this.extended = options.extended || false;
    this.think = options.think || false;
    this.temperature = options.temperature;
    this.max_thinking_tokens = options.max_thinking_tokens;
    this.parser = options.parser;
    this.json = options.json;
    this.tools = options.tools;
    this.qualityFilter = options.qualityFilter || {};
    this.abortController = null;
    this.cache = {};

    // Handle input
    if (input && typeof input === 'string') {
      this.user(input, options.attachments);
    } else if (input && Array.isArray(input)) {
      this.messages = input;
    }

    // Auto-enable extended mode for certain features
    if (this.think) this.extended = true;
    if (this.tools && this.tools.length > 0) this.extended = true;

    // Set up JSON parser if needed
    if (this.json && !this.parser) {
      this.parser = parsers.json;
    }

    console.log(`LLM ${this.service} initialized`);
  }

  get isLocal() {
    return this.constructor.isLocal;
  }

  get apiKey() {
    if (this.options.apiKey) return this.options.apiKey;

    // Use LLM API key manager if available
    if (typeof window !== 'undefined' && window.LLM_API_KEY_MANAGER) {
      // This will be async, but we need sync access
      // Store the promise and handle it in send method
      this._apiKeyPromise = window.LLM_API_KEY_MANAGER.getApiKey(this.service, this.options.sessionId);
      return null; // Will be resolved in send method
    }

    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      const key = localStorage.getItem(`${this.service.toUpperCase()}_API_KEY`);
      if (key) return key;
    }

    return undefined;
  }

  async getApiKeyAsync() {
    if (this.options.apiKey) return this.options.apiKey;

    // Use LLM API key manager if available
    if (typeof window !== 'undefined' && window.LLM_API_KEY_MANAGER) {
      const key = await window.LLM_API_KEY_MANAGER.getApiKey(this.service, this.options.sessionId);
      if (key) return key;
    }

    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      const key = localStorage.getItem(`${this.service.toUpperCase()}_API_KEY`);
      if (key) return key;
    }

    return undefined;
  }

  get llmOptions() {
    const options = {
      model: this.model,
      messages: this.parseMessages(this.messages),
      stream: this.stream,
      max_tokens: this.max_tokens,
      think: this.think
    };

    if (typeof this.max_thinking_tokens === 'number') {
      options.max_thinking_tokens = this.max_thinking_tokens;
    }
    if (typeof this.temperature === 'number') {
      options.temperature = this.temperature;
    }
    if (this.tools) {
      options.tools = this.tools;
    }

    return options;
  }

  async getLLMHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const apiKey = await this.getApiKeyAsync();

    if (this.constructor.isBearerAuth) {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  get llmHeaders() {
    // Sync version for backward compatibility
    const headers = {
      'Content-Type': 'application/json'
    };

    const apiKey = this.apiKey;

    if (this.constructor.isBearerAuth) {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  get chatUrl() {
    return join(this.baseUrl, 'api/chat');
  }

  get modelsUrl() {
    return join(this.baseUrl, 'api/tags');
  }

  getChatUrl(opts) {
    return this.chatUrl;
  }

  getModelsUrl() {
    return this.modelsUrl;
  }

  get parsers() {
    return {
      thinking: this.parseThinkingChunk.bind(this),
      content: this.parseContentChunk.bind(this),
      usage: this.parseTokenUsage.bind(this),
      tool_calls: this.parseToolsChunk.bind(this)
    };
  }

  // Message management methods
  addMessage(role, content) {
    this.messages.push(createMessage(role, content));
  }

  user(content, attachments) {
    if (attachments && attachments.length > 0) {
      const key = this.constructor.MessageExtendedContentInputKey;
      this.addMessage(MESSAGE_ROLES.USER, { type: key, text: content, attachments });
    } else {
      this.addMessage(MESSAGE_ROLES.USER, content);
    }
  }

  assistant(content) {
    this.addMessage(MESSAGE_ROLES.ASSISTANT, content);
  }

  system(content) {
    this.addMessage(MESSAGE_ROLES.SYSTEM, content);
  }

  thinking(content) {
    this.addMessage(MESSAGE_ROLES.THINKING, content);
  }

  toolCall(tool) {
    this.addMessage(MESSAGE_ROLES.TOOL_CALL, tool);
  }

  // Main chat method
  async chat(input, options) {
    const attachments = options?.attachments || [];
    this.user(input, attachments);
    return await this.send(options);
  }

  // Abort current request
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Main send method
  async send(options) {
    delete options?.attachments;

    const vanillaOptions = { ...this.llmOptions, ...options || {} };
    const opts = this.parseOptions(JSON.parse(JSON.stringify(vanillaOptions)));

    this.resetCache();

    if (opts.tools && opts.tools.length > 0) {
      this.extended = true;
    }

    console.log(`AI Assistance ${this.service} sending request`);

    this.abortController = new AbortController();

    try {
      const headers = await this.getLLMHeaders();

      const response = await fetch(this.getChatUrl(opts), {
        method: 'POST',
        body: JSON.stringify(opts),
        headers: headers,
        signal: this.abortController.signal,
        mode: 'cors',
        credentials: 'omit'
      });

      await handleErrorResponse(response, 'Failed to send request');

      if (this.stream) {
        const body = response.body;
        if (!body) throw new Error('No body found');
        if (this.extended) return this.extendedStreamResponse(body, vanillaOptions);
        return this.streamResponse(body);
      }

      try {
        const data = await response.json();
        if (this.extended) return this.extendedResponse(data, vanillaOptions);
        return this.response(data);
      } finally {
        this.abortController = null;
      }
    } catch (error) {
      this.abortController = null;
      throw error;
    }
  }

  // Response handling methods (to be implemented by subclasses)
  response(data) {
    let content = this.parseContent(data);
    if (this.parser) content = this.parser(content);
    if (content) this.assistant(content);
    return content;
  }

  extendedResponse(data, options) {
    const response = {
      service: this.service,
      options
    };

    const tokenUsage = this.parseTokenUsage(data);
    if (tokenUsage) {
      response.usage = this.parseUsage(tokenUsage);
    }

    if (options.think) {
      const thinking = this.parseThinking(data);
      if (thinking) {
        response.thinking = thinking;
        this.thinking(thinking);
      }
    }

    let content = this.parseContent(data);
    if (this.parser) content = this.parser(content);
    if (content) this.assistant(content);

    if (this.tools && this.tools.length > 0) {
      response.tool_calls = this.parseTools(data) || [];
      for (const tool of response.tool_calls) {
        if (tool && Object.keys(tool).length > 0) {
          this.toolCall(tool);
        }
      }
    }

    response.content = content;
    response.messages = JSON.parse(JSON.stringify(this.messages));

    return response;
  }

  async *streamResponse(stream) {
    const restream = this.streamResponses(stream, { content: this.parseContentChunk.bind(this) });
    for await (const chunk of restream) {
      if (chunk.type === CHUNK_TYPES.CONTENT) {
        yield chunk.content;
      }
    }
    this.abortController = null;
  }

  async *streamResponses(stream, parsers) {
    const reader = await parseStream(stream);
    let buffers = { type: CHUNK_TYPES.BUFFERS };

    for await (const chunk of reader) {
      for (const [name, parser] of Object.entries(parsers)) {
        const content = parser(chunk);
        if (!content) continue;

        if (name === 'usage') {
          buffers[name] = content;
          yield { type: name, content };
        } else if (name === 'tool_calls') {
          if (!Array.isArray(content) || content.length === 0) continue;
          if (!buffers[name]) buffers[name] = [];
          buffers[name].push(...content);
          yield { type: name, content };
        } else {
          if (!buffers[name]) buffers[name] = '';
          buffers[name] += content;
          yield { type: name, content };
        }
      }
    }

    this.saveBuffers(buffers);
    return buffers;
  }

  saveBuffers(buffers) {
    for (let [name, content] of Object.entries(buffers)) {
      if (name === 'thinking') {
        this.thinking(content);
      } else if (name === 'tool_calls') {
        for (const tool of content) {
          if (tool && Object.keys(tool).length > 0) {
            this.toolCall(tool);
          }
        }
      } else if (name === 'content') {
        if (this.parser) {
          content = this.parser(content);
          buffers[name] = content;
        }
        if (content) this.assistant(content);
      }
    }
  }

  extendedStreamResponse(body, options) {
    let usage;
    let thinking = '';
    let content = '';
    let tool_calls = [];

    const complete = async () => {
      const messages = JSON.parse(JSON.stringify(this.messages));
      const response = { service: this.service, options, usage, messages, content };
      if (thinking) response.thinking = thinking;
      if (tool_calls.length > 0) response.tool_calls = tool_calls;
      this.abortController = null;
      return response;
    };

    const stream = this.streamResponses(body, this.parsers);
    const restream = this.restream(stream, (chunk) => {
      if (chunk.type === 'usage' && chunk.content && typeof chunk.content === 'object') {
        usage = this.parseUsage(chunk.content);
      }
      if (chunk.type === 'tool_calls' && chunk.content && Array.isArray(chunk.content)) {
        tool_calls.push(...chunk.content);
      }
      if (chunk.type !== CHUNK_TYPES.BUFFERS) return;
      if (chunk.thinking) thinking = chunk.thinking;
      if (chunk.content) content = chunk.content;
    });

    return { service: this.service, options, stream: restream, complete, think: this.think || false };
  }

  async *restream(stream, callback) {
    while (true) {
      const { value, done } = await stream.next();
      if (callback && value) callback(value);
      if (done) break;
      yield value;
    }
  }

  // Methods to be implemented by subclasses
  parseContent(data) {
    throw new Error('parseContent not implemented');
  }

  parseTools(data) {
    return [];
  }

  parseToolsChunk(chunk) {
    return this.parseTools(chunk);
  }

  parseContentChunk(chunk) {
    return this.parseContent(chunk);
  }

  parseThinking(data) {
    return '';
  }

  parseThinkingChunk(chunk) {
    return this.parseThinking(chunk);
  }

  parseModel(model) {
    throw new Error('parseModel not implemented');
  }

  parseMessages(messages) {
    return messages.map(message => {
      const copy = deepClone(message);
      if (copy.role === MESSAGE_ROLES.THINKING || copy.role === MESSAGE_ROLES.TOOL_CALL) {
        copy.role = MESSAGE_ROLES.ASSISTANT;
      }

      if (message.content && message.content.attachments) {
        copy.content = this.parseAttachmentsContent(message.content);
      } else if (message.content && message.content.text) {
        copy.content = message.content.text;
      } else if (typeof copy.content !== 'string') {
        copy.content = JSON.stringify(copy.content);
      }

      return copy;
    });
  }

  parseAttachmentsContent(content) {
    const key = this.constructor.MessageExtendedContentInputKey;
    const parts = content.attachments.map(this.parseAttachment);
    parts.push({ type: key, text: content.text });
    return parts;
  }

  parseAttachment(attachment) {
    return attachment.content;
  }

  parseOptions(options) {
    return options || {};
  }

  parseTokenUsage(usage) {
    return usage;
  }

  parseUsage(tokenUsage) {
    const inputCostPerToken = 0; // Will be implemented with model usage
    const outputCostPerToken = 0;

    const input_cost = tokenUsage.input_tokens * inputCostPerToken;
    const output_cost = tokenUsage.output_tokens * outputCostPerToken;
    const total_cost = input_cost + output_cost;

    return {
      ...tokenUsage,
      local: this.isLocal,
      total_tokens: tokenUsage.input_tokens + tokenUsage.output_tokens,
      input_cost,
      output_cost,
      total_cost
    };
  }

  resetCache() {
    this.cache = {};
  }
}

// Export to global window object for browser extension
if (typeof window !== 'undefined') {
  window.LLM = LLM;
}

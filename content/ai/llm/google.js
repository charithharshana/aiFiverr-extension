/**
 * Google/Gemini LLM Provider for Browser Extension
 * Adapted from the original LLM.js Google provider
 */

import LLM from './base.js';
import { MESSAGE_ROLES, SERVICES } from './types.js';
import { filterMessageRole, filterNotMessageRole, join, deepClone, handleErrorResponse } from './utils.js';

/**
 * Google/Gemini LLM Provider
 */
export default class Google extends LLM {
  static service = SERVICES.GOOGLE;
  static DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/';
  static DEFAULT_MODEL = 'gemini-2.5-flash';
  static isBearerAuth = false;

  get chatUrl() {
    return join(this.baseUrl, 'chat/completions');
  }

  get modelsUrl() {
    return join(this.baseUrl, 'models');
  }

  async getChatUrl(opts) {
    const apiKey = await this.getApiKeyAsync();
    return join(this.baseUrl, 'models', `${opts.model}:generateContent?key=${apiKey}`);
  }

  async getModelsUrl() {
    const apiKey = await this.getApiKeyAsync();
    return `${this.modelsUrl}?key=${apiKey}`;
  }

  parseOptions(options) {
    const opts = deepClone(options);
    const messages = opts.messages || [];

    // Separate system and non-system messages
    const system = filterMessageRole(messages, MESSAGE_ROLES.SYSTEM);
    const nonSystem = filterNotMessageRole(messages, MESSAGE_ROLES.SYSTEM);
    delete opts.messages;

    // Set system instruction
    if (system.length > 0) {
      opts.system_instruction = {
        parts: system.map(message => ({ text: message.content }))
      };
    }

    // Convert messages to Google format
    if (nonSystem.length > 0) {
      opts.contents = nonSystem.map(Google.toGoogleMessage);
    }

    // Set generation config
    if (!opts.generationConfig) opts.generationConfig = {};
    if (typeof opts.temperature === 'number') {
      opts.generationConfig.temperature = opts.temperature;
    }
    if (typeof opts.max_tokens === 'number') {
      opts.generationConfig.maxOutputTokens = opts.max_tokens;
    }
    if (!opts.generationConfig.maxOutputTokens) {
      opts.generationConfig.maxOutputTokens = this.max_tokens;
    }

    // Handle tools
    if (opts.tools) {
      opts.tools = [{
        functionDeclarations: opts.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }))
      }];
    }

    // Handle thinking mode
    if (opts.think) {
      if (!opts.generationConfig) opts.generationConfig = {};
      opts.generationConfig.thinkingConfig = { includeThoughts: true };
      delete opts.think;
    }

    // Clean up options
    delete opts.max_tokens;
    delete opts.temperature;
    delete opts.stream;

    return opts;
  }

  static toGoogleMessage(message) {
    const role = message.role === MESSAGE_ROLES.USER ? 'user' : 'model';
    
    if (typeof message.content === 'string') {
      return {
        role,
        parts: [{ text: message.content }]
      };
    }

    // Handle complex content with attachments
    if (Array.isArray(message.content)) {
      const parts = message.content.map(part => {
        if (part.type === 'text') {
          return { text: part.text };
        } else if (part.type === 'image_url') {
          // Convert image URL to inline data format
          const url = part.image_url.url;
          if (url.startsWith('data:')) {
            const [mimeType, data] = url.split(',');
            return {
              inline_data: {
                mime_type: mimeType.split(':')[1].split(';')[0],
                data: data
              }
            };
          }
        }
        return { text: JSON.stringify(part) };
      });
      return { role, parts };
    }

    return {
      role,
      parts: [{ text: JSON.stringify(message.content) }]
    };
  }

  parseContent(data) {
    if (!data || !data.candidates || !data.candidates[0]) {
      return '';
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return '';
    }

    return candidate.content.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join('');
  }

  parseContentChunk(chunk) {
    if (!chunk || !chunk.candidates || !chunk.candidates[0]) {
      return '';
    }

    const candidate = chunk.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return '';
    }

    return candidate.content.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join('');
  }

  parseThinking(data) {
    if (!data || !data.candidates || !data.candidates[0]) {
      return '';
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return '';
    }

    // Look for thinking content in parts
    const thinkingParts = candidate.content.parts.filter(part => 
      part.thought || (part.text && part.text.includes('<thinking>'))
    );

    if (thinkingParts.length > 0) {
      return thinkingParts
        .map(part => part.thought || part.text)
        .join('');
    }

    return '';
  }

  parseThinkingChunk(chunk) {
    return this.parseThinking(chunk);
  }

  parseTools(data) {
    if (!data || !data.candidates || !data.candidates[0]) {
      return [];
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return [];
    }

    const toolCalls = [];
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }

    return toolCalls;
  }

  parseTokenUsage(data) {
    if (!data || !data.usageMetadata) {
      return null;
    }

    const usage = data.usageMetadata;
    return {
      input_tokens: usage.promptTokenCount || 0,
      output_tokens: usage.candidatesTokenCount || 0,
      total_tokens: usage.totalTokenCount || 0
    };
  }

  parseModel(model) {
    return {
      model: model.name,
      name: model.displayName || model.name,
      created: null,
      max_tokens: model.inputTokenLimit || 0,
      max_input_tokens: model.inputTokenLimit || 0,
      max_output_tokens: model.outputTokenLimit || 0,
      supports_reasoning: model.name.includes('thinking') || false,
      supports_function_calling: true,
      supports_vision: model.name.includes('vision') || model.name.includes('pro'),
      supports_web_search: false,
      supports_audio_input: false,
      supports_audio_output: false,
      supports_prompt_caching: false,
      tags: []
    };
  }

  async fetchModels() {
    const headers = await this.getLLMHeaders();
    const options = { headers };
    console.log(`LLM ${this.service} fetchModels`);

    const modelsUrl = await this.getModelsUrl();
    const response = await fetch(modelsUrl, options);
    await handleErrorResponse(response, 'Failed to fetch models');

    const data = await response.json();
    let models = [];
    
    if (Array.isArray(data.models)) {
      models = data.models;
    } else if (Array.isArray(data)) {
      models = data;
    }

    if (!models || models.length === 0) {
      throw new Error('No models found');
    }

    return models.map(this.parseModel);
  }

  // Override getChatUrl for streaming
  async getChatUrlForStreaming(opts) {
    const apiKey = await this.getApiKeyAsync();
    return join(this.baseUrl, 'models', `${opts.model}:streamGenerateContent?key=${apiKey}`);
  }

  async send(options) {
    // Override send to handle streaming URL difference
    delete options?.attachments;

    const vanillaOptions = { ...this.llmOptions, ...options || {} };
    const opts = this.parseOptions(JSON.parse(JSON.stringify(vanillaOptions)));

    this.resetCache();

    if (opts.tools && opts.tools.length > 0) {
      this.extended = true;
    }

    console.log(`LLM ${this.service} sending request`);

    this.abortController = new AbortController();

    try {
      const url = this.stream ? await this.getChatUrlForStreaming(opts) : await this.getChatUrl(opts);
      const headers = await this.getLLMHeaders();

      const response = await fetch(url, {
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
}

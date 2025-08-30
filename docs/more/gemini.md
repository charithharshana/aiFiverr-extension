# Gemini API Integration Guide for aiFiverr Extension

## Table of Contents
1. [Streaming API Integration](#streaming-api-integration)
2. [JSON Parsing Challenges and Solutions](#json-parsing-challenges-and-solutions)
3. [Best Practices for Streaming Responses](#best-practices-for-streaming-responses)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [File Upload API](#file-upload-api)
6. [Performance Optimization](#performance-optimization)

---

## Streaming API Integration

### Overview
The Gemini API supports streaming responses for real-time text generation. This is crucial for the aiFiverr extension's streaming chatbox functionality, providing users with immediate feedback as the AI generates responses.

### Streaming Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
```

### Request Format
```javascript
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  })
});
```

### Streaming Response Format
Gemini API returns streaming responses in Server-Sent Events (SSE) format:
```
data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"},"finishReason":"STOP","index":0}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":1,"totalTokenCount":6}}

data: {"candidates":[{"content":{"parts":[{"text":" there!"}],"role":"model"},"finishReason":"STOP","index":0}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":3,"totalTokenCount":8}}
```

---

## JSON Parsing Challenges and Solutions

### Common Issues

#### 1. Multiple JSON Objects in Single Chunk
**Problem**: Streaming chunks may contain multiple JSON objects concatenated together.
```
data: {"candidates":[...]}{"candidates":[...]}
```

**Solution**: Implemented multi-object parsing with brace counting algorithm.

#### 2. Incomplete JSON Objects
**Problem**: JSON objects may be split across multiple chunks.
```
Chunk 1: data: {"candidates":[{"content":{"parts":[{"text":"Hel
Chunk 2: lo"}],"role":"model"}]}
```

**Solution**: Buffer incomplete chunks and reassemble complete JSON objects.

#### 3. Malformed JSON with Extra Content
**Problem**: Valid JSON followed by non-JSON content in the same string.
```
{"candidates":[...]}some extra text
```

**Solution**: Extract valid JSON from the beginning of the string using position-based parsing.

### Parsing Architecture

The aiFiverr extension implements a multi-layered parsing approach:

1. **Sanitization Layer**: Removes common streaming artifacts
2. **Single Object Parser**: Attempts simple JSON.parse() first
3. **JSON Extraction**: Extracts valid JSON from mixed content
4. **Multi-Object Parser**: Handles concatenated JSON objects
5. **Brace Counting Parser**: Advanced fallback with object boundary detection
6. **JSON Repair**: Attempts to fix common formatting issues

### Implementation Details

#### Sanitization Process
```javascript
sanitizeJSONChunk(jsonStr) {
  let sanitized = jsonStr.trim();

  // Remove streaming prefixes
  if (sanitized.startsWith('data: ')) {
    sanitized = sanitized.slice(6).trim();
  }

  // Handle termination markers
  if (sanitized === '[DONE]' || sanitized === 'data: [DONE]') {
    return '';
  }

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove trailing commas
  sanitized = sanitized.replace(/,\s*$/, '');

  return sanitized;
}
```

#### JSON Extraction Algorithm
```javascript
extractValidJSON(jsonStr) {
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    return null;
  }

  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;

      // Complete JSON object/array found
      if (braceCount === 0 && bracketCount === 0) {
        return jsonStr.substring(0, i + 1);
      }
    }
  }

  return null;
}
```

---

## Best Practices for Streaming Responses

### 1. Buffer Management
- Maintain a buffer for incomplete chunks
- Process complete lines only
- Handle partial JSON objects gracefully

### 2. Error Handling
- Continue processing even if individual chunks fail
- Log problematic chunks for debugging
- Implement multiple fallback parsing strategies

### 3. Performance Optimization
- Use efficient string operations
- Minimize JSON parsing attempts
- Cache parsing results when possible

### 4. User Experience
- Show streaming indicators during processing
- Handle connection interruptions gracefully
- Provide meaningful error messages

---

## Troubleshooting Guide

### JSON Parsing Errors

#### Error: "Unexpected non-whitespace character after JSON at position X"
**Cause**: Valid JSON followed by additional content in the same string.
**Solution**: Use `extractValidJSON()` method to isolate valid JSON portion.

#### Error: "Unexpected end of JSON input"
**Cause**: Incomplete JSON object in streaming chunk.
**Solution**: Buffer incomplete chunks until complete object is received.

#### Error: "Unexpected token in JSON"
**Cause**: Malformed JSON due to streaming artifacts or encoding issues.
**Solution**: Apply sanitization and JSON repair methods.

### Common Streaming Issues

#### Issue: Missing Text Content
**Symptoms**: Streaming appears to work but no text is displayed.
**Debugging**:
1. Check if `data.candidates[0].content.parts[0].text` exists
2. Verify content is being appended to the correct DOM element
3. Ensure streaming message element is properly initialized

#### Issue: Streaming Stops Prematurely
**Symptoms**: Streaming starts but stops before completion.
**Debugging**:
1. Check network connectivity
2. Verify API key validity and rate limits
3. Monitor console for parsing errors
4. Check if `finishReason` indicates completion

#### Issue: Duplicate Content
**Symptoms**: Same text appears multiple times in the response.
**Debugging**:
1. Ensure text is being appended, not replaced
2. Check for duplicate event listeners
3. Verify chunk processing logic

### Debugging Tools

#### Enable Debug Logging
```javascript
// Add to streaming-chatbox.js for detailed logging
console.log('aiFiverr StreamingChatbox: Processing chunk:', jsonStr.substring(0, 100));
console.log('aiFiverr StreamingChatbox: Parsed objects:', jsonObjects.length);
```

#### Monitor Network Traffic
Use browser DevTools Network tab to inspect:
- Request headers and body
- Response status codes
- Streaming chunk content
- Connection timing

---

## File Upload API

The Gemini API supports uploading media files separately from the prompt input, allowing your media to be reused across multiple requests and multiple prompts. For more details, check out the Prompting with media guide.

---

## Performance Optimization

### Streaming Performance Metrics

#### Token Usage Tracking
```javascript
// Extract usage metadata from streaming responses
if (data.usageMetadata) {
  const { promptTokenCount, candidatesTokenCount, totalTokenCount } = data.usageMetadata;
  console.log(`Tokens - Prompt: ${promptTokenCount}, Response: ${candidatesTokenCount}, Total: ${totalTokenCount}`);
}
```

#### Response Time Monitoring
```javascript
const startTime = performance.now();
// ... streaming process ...
const endTime = performance.now();
console.log(`Streaming completed in ${endTime - startTime}ms`);
```

### API Key Rotation
For high-volume usage, implement API key rotation to avoid rate limits:

```javascript
class APIKeyRotator {
  constructor(keys) {
    this.keys = keys;
    this.currentIndex = 0;
    this.rateLimitTracker = new Map();
  }

  getNextKey() {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  handleRateLimit(key) {
    this.rateLimitTracker.set(key, Date.now() + 60000); // 1 minute cooldown
  }

  getAvailableKey() {
    const now = Date.now();
    for (const key of this.keys) {
      const cooldownEnd = this.rateLimitTracker.get(key) || 0;
      if (now > cooldownEnd) {
        return key;
      }
    }
    return this.keys[0]; // Fallback to first key
  }
}
```

### Model Selection Guidelines

#### gemini-2.5-flash
- **Use for**: Quick responses, high-volume requests
- **Pros**: Faster response times, lower cost
- **Cons**: May have slightly lower quality for complex tasks

#### gemini-2.5-pro
- **Use for**: Complex reasoning, high-quality responses
- **Pros**: Better accuracy, more sophisticated responses
- **Cons**: Slower response times, higher cost

#### gemini-2.5-flash-lite
- **Use for**: Simple tasks, maximum speed
- **Pros**: Fastest response times, lowest cost
- **Cons**: Limited capabilities for complex tasks

### Conversation Context Management

#### Efficient History Handling
```javascript
// Limit conversation history to prevent token overflow
const MAX_HISTORY_TOKENS = 4000;
const MAX_HISTORY_MESSAGES = 20;

function trimConversationHistory(history) {
  if (history.length > MAX_HISTORY_MESSAGES) {
    // Keep system message and recent messages
    const systemMessages = history.filter(msg => msg.role === 'system');
    const recentMessages = history.slice(-MAX_HISTORY_MESSAGES + systemMessages.length);
    return [...systemMessages, ...recentMessages];
  }
  return history;
}
```

#### Context Summarization
For long conversations, implement context summarization:
```javascript
async function summarizeContext(longHistory) {
  const summaryPrompt = "Summarize the key points from this conversation history:";
  const summary = await generateContent(summaryPrompt + JSON.stringify(longHistory));
  return {
    role: 'system',
    parts: [{ text: `Previous conversation summary: ${summary}` }]
  };
}
```

---

## Error Codes and Recovery

### Common API Error Codes

#### 400 Bad Request
- **Cause**: Invalid request format or parameters
- **Recovery**: Validate request structure and parameters

#### 401 Unauthorized
- **Cause**: Invalid or missing API key
- **Recovery**: Check API key configuration, rotate to backup key

#### 403 Forbidden
- **Cause**: API key lacks required permissions
- **Recovery**: Verify API key permissions in Google Cloud Console

#### 429 Too Many Requests
- **Cause**: Rate limit exceeded
- **Recovery**: Implement exponential backoff, rotate API keys

#### 500 Internal Server Error
- **Cause**: Temporary server issues
- **Recovery**: Retry with exponential backoff

### Retry Strategy Implementation
```javascript
async function retryWithBackoff(apiCall, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Testing and Validation

### Unit Testing Streaming Parser
```javascript
// Test cases for JSON parsing
const testCases = [
  {
    name: 'Single valid JSON',
    input: '{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
    expected: 1
  },
  {
    name: 'Multiple JSON objects',
    input: '{"test":1}{"test":2}',
    expected: 2
  },
  {
    name: 'JSON with extra content',
    input: '{"test":1}extra content',
    expected: 1
  },
  {
    name: 'Malformed JSON',
    input: '{"test":1,}',
    expected: 1 // Should be fixed by repair logic
  }
];

function runParsingTests() {
  testCases.forEach(testCase => {
    const results = parseMultipleJSONObjects(testCase.input);
    console.assert(
      results.length === testCase.expected,
      `Test "${testCase.name}" failed: expected ${testCase.expected}, got ${results.length}`
    );
  });
}
```

### Integration Testing
```javascript
async function testStreamingIntegration() {
  const testMessage = "Hello, this is a test message.";
  const startTime = performance.now();

  try {
    const response = await streamWithFullContext(testMessage);
    const endTime = performance.now();

    console.log(`✅ Streaming test passed in ${endTime - startTime}ms`);
    return true;
  } catch (error) {
    console.error('❌ Streaming test failed:', error);
    return false;
  }
}
```

---

## File Upload API Reference

Method: media.upload
Creates a File.

Endpoint
Upload URI, for media upload requests:
post
https://generativelanguage.googleapis.com/upload/v1beta/files
Metadata URI, for metadata-only requests:
post
https://generativelanguage.googleapis.com/v1beta/files
Request body
The request body contains data with the following structure:

Fields
file
object (File)
Optional. Metadata for the file to create.

Example request
Image
Audio
Text
Video
PDF
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "Cajun_instruments.jpg"),
  config: { mimeType: "image/jpeg" },
});
console.log("Uploaded file:", myfile);

const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "\n\n",
    "Can you tell me about the instruments in this photo?",
  ]),
});
console.log("result.text=", result.text);
Response body
Response for media.upload.

If successful, the response body contains data with the following structure:

Fields
file
object (File)
Metadata for the created file.

JSON representation

{
  "file": {
    object (File)
  }
}
Method: files.get
Gets the metadata for the given File.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to get. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
Response body
If successful, the response body contains an instance of File.

Method: files.list
Lists the metadata for Files owned by the requesting project.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/files

Query parameters
pageSize
integer
Optional. Maximum number of Files to return per page. If unspecified, defaults to 10. Maximum pageSize is 100.

pageToken
string
Optional. A page token from a previous files.list call.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}
Response body
Response for files.list.

If successful, the response body contains data with the following structure:

Fields
files[]
object (File)
The list of Files.

nextPageToken
string
A token that can be sent as a pageToken into a subsequent files.list call.

JSON representation

{
  "files": [
    {
      object (File)
    }
  ],
  "nextPageToken": string
}
Method: files.delete
Deletes the File.

Endpoint
delete
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to delete. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// The Gen AI SDK for TypeScript and JavaScript is in preview.
// Some features have not been implemented.
Response body
If successful, the response body is an empty JSON object.

REST Resource: files
Resource: File
A file uploaded to the API. Next ID: 15

Fields
name
string
Immutable. Identifier. The File resource name. The ID (name excluding the "files/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be generated. Example: files/123-456

displayName
string
Optional. The human-readable display name for the File. The display name must be no more than 512 characters in length, including spaces. Example: "Welcome Image"

mimeType
string
Output only. MIME type of the file.

sizeBytes
string (int64 format)
Output only. Size of the file in bytes.

createTime
string (Timestamp format)
Output only. The timestamp of when the File was created.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

updateTime
string (Timestamp format)
Output only. The timestamp of when the File was last updated.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

expirationTime
string (Timestamp format)
Output only. The timestamp of when the File will be deleted. Only set if the File is scheduled to expire.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

sha256Hash
string (bytes format)
Output only. SHA-256 hash of the uploaded bytes.

A base64-encoded string.

uri
string
Output only. The uri of the File.

downloadUri
string
Output only. The download uri of the File.

state
enum (State)
Output only. Processing state of the File.

source
enum (Source)
Source of the File.

error
object (Status)
Output only. Error status if File processing failed.

metadata
Union type
Metadata for the File. metadata can be only one of the following:
videoMetadata
object (VideoFileMetadata)
Output only. Metadata for a video.

JSON representation

{
  "name": string,
  "displayName": string,
  "mimeType": string,
  "sizeBytes": string,
  "createTime": string,
  "updateTime": string,
  "expirationTime": string,
  "sha256Hash": string,
  "uri": string,
  "downloadUri": string,
  "state": enum (State),
  "source": enum (Source),
  "error": {
    object (Status)
  },

  // metadata
  "videoMetadata": {
    object (VideoFileMetadata)
  }
  // Union type
}
VideoFileMetadata
Metadata for a video File.

Fields
videoDuration
string (Duration format)
Duration of the video.

A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

JSON representation

{
  "videoDuration": string
}
State
States for the lifecycle of a File.

Enums
STATE_UNSPECIFIED	The default value. This value is used if the state is omitted.
PROCESSING	File is being processed and cannot be used for inference yet.
ACTIVE	File is processed and available for inference.
FAILED	File failed processing.
Source
Enums
SOURCE_UNSPECIFIED	Used if source is not specified.
UPLOADED	Indicates the file is uploaded by the user.
GENERATED	Indicates the file is generated by Google.
Status
The Status type defines a logical error model that is suitable for different programming environments, including REST APIs and RPC APIs. It is used by gRPC. Each Status message contains three pieces of data: error code, error message, and error details.

You can find out more about this error model and how to work with it in the API Design Guide.

Fields
code
integer
The status code, which should be an enum value of google.rpc.Code.

message
string
A developer-facing error message, which should be in English. Any user-facing error message should be localized and sent in the google.rpc.Status.details field, or localized by the client.

details[]
object
A list of messages that carry the error details. There is a common set of message types for APIs to use.

An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.

JSON representation

{
  "code": integer,
  "message": string,
  "details": [
    {
      "@type": string,
      field1: ...,
      ...
    }
  ]
}
---
The Gemini API supports uploading media files separately from the prompt input, allowing your media to be reused across multiple requests and multiple prompts. For more details, check out the Prompting with media guide.

Method: media.upload
Creates a File.

Endpoint
Upload URI, for media upload requests:
post
https://generativelanguage.googleapis.com/upload/v1beta/files
Metadata URI, for metadata-only requests:
post
https://generativelanguage.googleapis.com/v1beta/files
Request body
The request body contains data with the following structure:

Fields
file
object (File)
Optional. Metadata for the file to create.

Example request
Image
Audio
Text
Video
PDF
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "sample.mp3"),
  config: { mimeType: "audio/mpeg" },
});
console.log("Uploaded file:", myfile);

const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "Describe this audio clip",
  ]),
});
console.log("result.text=", result.text);
Response body
Response for media.upload.

If successful, the response body contains data with the following structure:

Fields
file
object (File)
Metadata for the created file.

JSON representation

{
  "file": {
    object (File)
  }
}
Method: files.get
Gets the metadata for the given File.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to get. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
Response body
If successful, the response body contains an instance of File.

Method: files.list
Lists the metadata for Files owned by the requesting project.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/files

Query parameters
pageSize
integer
Optional. Maximum number of Files to return per page. If unspecified, defaults to 10. Maximum pageSize is 100.

pageToken
string
Optional. A page token from a previous files.list call.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}
Response body
Response for files.list.

If successful, the response body contains data with the following structure:

Fields
files[]
object (File)
The list of Files.

nextPageToken
string
A token that can be sent as a pageToken into a subsequent files.list call.

JSON representation

{
  "files": [
    {
      object (File)
    }
  ],
  "nextPageToken": string
}
Method: files.delete
Deletes the File.

Endpoint
delete
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to delete. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// The Gen AI SDK for TypeScript and JavaScript is in preview.
// Some features have not been implemented.
Response body
If successful, the response body is an empty JSON object.

REST Resource: files
Resource: File
A file uploaded to the API. Next ID: 15

Fields
name
string
Immutable. Identifier. The File resource name. The ID (name excluding the "files/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be generated. Example: files/123-456

displayName
string
Optional. The human-readable display name for the File. The display name must be no more than 512 characters in length, including spaces. Example: "Welcome Image"

mimeType
string
Output only. MIME type of the file.

sizeBytes
string (int64 format)
Output only. Size of the file in bytes.

createTime
string (Timestamp format)
Output only. The timestamp of when the File was created.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

updateTime
string (Timestamp format)
Output only. The timestamp of when the File was last updated.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

expirationTime
string (Timestamp format)
Output only. The timestamp of when the File will be deleted. Only set if the File is scheduled to expire.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

sha256Hash
string (bytes format)
Output only. SHA-256 hash of the uploaded bytes.

A base64-encoded string.

uri
string
Output only. The uri of the File.

downloadUri
string
Output only. The download uri of the File.

state
enum (State)
Output only. Processing state of the File.

source
enum (Source)
Source of the File.

error
object (Status)
Output only. Error status if File processing failed.

metadata
Union type
Metadata for the File. metadata can be only one of the following:
videoMetadata
object (VideoFileMetadata)
Output only. Metadata for a video.

JSON representation

{
  "name": string,
  "displayName": string,
  "mimeType": string,
  "sizeBytes": string,
  "createTime": string,
  "updateTime": string,
  "expirationTime": string,
  "sha256Hash": string,
  "uri": string,
  "downloadUri": string,
  "state": enum (State),
  "source": enum (Source),
  "error": {
    object (Status)
  },

  // metadata
  "videoMetadata": {
    object (VideoFileMetadata)
  }
  // Union type
}
VideoFileMetadata
Metadata for a video File.

Fields
videoDuration
string (Duration format)
Duration of the video.

A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

JSON representation

{
  "videoDuration": string
}
State
States for the lifecycle of a File.

Enums
STATE_UNSPECIFIED	The default value. This value is used if the state is omitted.
PROCESSING	File is being processed and cannot be used for inference yet.
ACTIVE	File is processed and available for inference.
FAILED	File failed processing.
Source
Enums
SOURCE_UNSPECIFIED	Used if source is not specified.
UPLOADED	Indicates the file is uploaded by the user.
GENERATED	Indicates the file is generated by Google.
Status
The Status type defines a logical error model that is suitable for different programming environments, including REST APIs and RPC APIs. It is used by gRPC. Each Status message contains three pieces of data: error code, error message, and error details.

You can find out more about this error model and how to work with it in the API Design Guide.

Fields
code
integer
The status code, which should be an enum value of google.rpc.Code.

message
string
A developer-facing error message, which should be in English. Any user-facing error message should be localized and sent in the google.rpc.Status.details field, or localized by the client.

details[]
object
A list of messages that carry the error details. There is a common set of message types for APIs to use.

An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.

JSON representation

{
  "code": integer,
  "message": string,
  "details": [
    {
      "@type": string,
      field1: ...,
      ...
    }
  ]
}
----
Method: media.upload
Creates a File.

Endpoint
Upload URI, for media upload requests:
post
https://generativelanguage.googleapis.com/upload/v1beta/files
Metadata URI, for metadata-only requests:
post
https://generativelanguage.googleapis.com/v1beta/files
Request body
The request body contains data with the following structure:

Fields
file
object (File)
Optional. Metadata for the file to create.

Example request
Image
Audio
Text
Video
PDF
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
console.log("Uploaded file:", myfile);

const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "\n\n",
    "Can you add a few more lines to this poem?",
  ]),
});
console.log("result.text=", result.text);
Response body
Response for media.upload.

If successful, the response body contains data with the following structure:

Fields
file
object (File)
Metadata for the created file.

JSON representation

{
  "file": {
    object (File)
  }
}
Method: files.get
Gets the metadata for the given File.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to get. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
Response body
If successful, the response body contains an instance of File.

Method: files.list
Lists the metadata for Files owned by the requesting project.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/files

Query parameters
pageSize
integer
Optional. Maximum number of Files to return per page. If unspecified, defaults to 10. Maximum pageSize is 100.

pageToken
string
Optional. A page token from a previous files.list call.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}
Response body
Response for files.list.

If successful, the response body contains data with the following structure:

Fields
files[]
object (File)
The list of Files.

nextPageToken
string
A token that can be sent as a pageToken into a subsequent files.list call.

JSON representation

{
  "files": [
    {
      object (File)
    }
  ],
  "nextPageToken": string
}
Method: files.delete
Deletes the File.

Endpoint
delete
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to delete. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// The Gen AI SDK for TypeScript and JavaScript is in preview.
// Some features have not been implemented.
Response body
If successful, the response body is an empty JSON object.

REST Resource: files
Resource: File
A file uploaded to the API. Next ID: 15

Fields
name
string
Immutable. Identifier. The File resource name. The ID (name excluding the "files/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be generated. Example: files/123-456

displayName
string
Optional. The human-readable display name for the File. The display name must be no more than 512 characters in length, including spaces. Example: "Welcome Image"

mimeType
string
Output only. MIME type of the file.

sizeBytes
string (int64 format)
Output only. Size of the file in bytes.

createTime
string (Timestamp format)
Output only. The timestamp of when the File was created.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

updateTime
string (Timestamp format)
Output only. The timestamp of when the File was last updated.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

expirationTime
string (Timestamp format)
Output only. The timestamp of when the File will be deleted. Only set if the File is scheduled to expire.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

sha256Hash
string (bytes format)
Output only. SHA-256 hash of the uploaded bytes.

A base64-encoded string.

uri
string
Output only. The uri of the File.

downloadUri
string
Output only. The download uri of the File.

state
enum (State)
Output only. Processing state of the File.

source
enum (Source)
Source of the File.

error
object (Status)
Output only. Error status if File processing failed.

metadata
Union type
Metadata for the File. metadata can be only one of the following:
videoMetadata
object (VideoFileMetadata)
Output only. Metadata for a video.

JSON representation

{
  "name": string,
  "displayName": string,
  "mimeType": string,
  "sizeBytes": string,
  "createTime": string,
  "updateTime": string,
  "expirationTime": string,
  "sha256Hash": string,
  "uri": string,
  "downloadUri": string,
  "state": enum (State),
  "source": enum (Source),
  "error": {
    object (Status)
  },

  // metadata
  "videoMetadata": {
    object (VideoFileMetadata)
  }
  // Union type
}
VideoFileMetadata
Metadata for a video File.

Fields
videoDuration
string (Duration format)
Duration of the video.

A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

JSON representation

{
  "videoDuration": string
}
State
States for the lifecycle of a File.

Enums
STATE_UNSPECIFIED	The default value. This value is used if the state is omitted.
PROCESSING	File is being processed and cannot be used for inference yet.
ACTIVE	File is processed and available for inference.
FAILED	File failed processing.
Source
Enums
SOURCE_UNSPECIFIED	Used if source is not specified.
UPLOADED	Indicates the file is uploaded by the user.
GENERATED	Indicates the file is generated by Google.
Status
The Status type defines a logical error model that is suitable for different programming environments, including REST APIs and RPC APIs. It is used by gRPC. Each Status message contains three pieces of data: error code, error message, and error details.

You can find out more about this error model and how to work with it in the API Design Guide.

Fields
code
integer
The status code, which should be an enum value of google.rpc.Code.

message
string
A developer-facing error message, which should be in English. Any user-facing error message should be localized and sent in the google.rpc.Status.details field, or localized by the client.

details[]
object
A list of messages that carry the error details. There is a common set of message types for APIs to use.

An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.

JSON representation

{
  "code": integer,
  "message": string,
  "details": [
    {
      "@type": string,
      field1: ...,
      ...
    }
  ]
}
----
The Gemini API supports uploading media files separately from the prompt input, allowing your media to be reused across multiple requests and multiple prompts. For more details, check out the Prompting with media guide.

Method: media.upload
Creates a File.

Endpoint
Upload URI, for media upload requests:
post
https://generativelanguage.googleapis.com/upload/v1beta/files
Metadata URI, for metadata-only requests:
post
https://generativelanguage.googleapis.com/v1beta/files
Request body
The request body contains data with the following structure:

Fields
file
object (File)
Optional. Metadata for the file to create.

Example request
Image
Audio
Text
Video
PDF
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let myfile = await ai.files.upload({
  file: path.join(media, "Big_Buck_Bunny.mp4"),
  config: { mimeType: "video/mp4" },
});
console.log("Uploaded video file:", myfile);

// Poll until the video file is completely processed (state becomes ACTIVE).
while (!myfile.state || myfile.state.toString() !== "ACTIVE") {
  console.log("Processing video...");
  console.log("File state: ", myfile.state);
  await sleep(5000);
  myfile = await ai.files.get({ name: myfile.name });
}

const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "Describe this video clip",
  ]),
});
console.log("result.text=", result.text);
Response body
Response for media.upload.

If successful, the response body contains data with the following structure:

Fields
file
object (File)
Metadata for the created file.

JSON representation

{
  "file": {
    object (File)
  }
}
Method: files.get
Gets the metadata for the given File.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to get. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
Response body
If successful, the response body contains an instance of File.

Method: files.list
Lists the metadata for Files owned by the requesting project.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/files

Query parameters
pageSize
integer
Optional. Maximum number of Files to return per page. If unspecified, defaults to 10. Maximum pageSize is 100.

pageToken
string
Optional. A page token from a previous files.list call.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}
Response body
Response for files.list.

If successful, the response body contains data with the following structure:

Fields
files[]
object (File)
The list of Files.

nextPageToken
string
A token that can be sent as a pageToken into a subsequent files.list call.

JSON representation

{
  "files": [
    {
      object (File)
    }
  ],
  "nextPageToken": string
}
Method: files.delete
Deletes the File.

Endpoint
delete
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to delete. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// The Gen AI SDK for TypeScript and JavaScript is in preview.
// Some features have not been implemented.
Response body
If successful, the response body is an empty JSON object.

REST Resource: files
Resource: File
A file uploaded to the API. Next ID: 15

Fields
name
string
Immutable. Identifier. The File resource name. The ID (name excluding the "files/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be generated. Example: files/123-456

displayName
string
Optional. The human-readable display name for the File. The display name must be no more than 512 characters in length, including spaces. Example: "Welcome Image"

mimeType
string
Output only. MIME type of the file.

sizeBytes
string (int64 format)
Output only. Size of the file in bytes.

createTime
string (Timestamp format)
Output only. The timestamp of when the File was created.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

updateTime
string (Timestamp format)
Output only. The timestamp of when the File was last updated.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

expirationTime
string (Timestamp format)
Output only. The timestamp of when the File will be deleted. Only set if the File is scheduled to expire.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

sha256Hash
string (bytes format)
Output only. SHA-256 hash of the uploaded bytes.

A base64-encoded string.

uri
string
Output only. The uri of the File.

downloadUri
string
Output only. The download uri of the File.

state
enum (State)
Output only. Processing state of the File.

source
enum (Source)
Source of the File.

error
object (Status)
Output only. Error status if File processing failed.

metadata
Union type
Metadata for the File. metadata can be only one of the following:
videoMetadata
object (VideoFileMetadata)
Output only. Metadata for a video.

JSON representation

{
  "name": string,
  "displayName": string,
  "mimeType": string,
  "sizeBytes": string,
  "createTime": string,
  "updateTime": string,
  "expirationTime": string,
  "sha256Hash": string,
  "uri": string,
  "downloadUri": string,
  "state": enum (State),
  "source": enum (Source),
  "error": {
    object (Status)
  },

  // metadata
  "videoMetadata": {
    object (VideoFileMetadata)
  }
  // Union type
}
VideoFileMetadata
Metadata for a video File.

Fields
videoDuration
string (Duration format)
Duration of the video.

A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

JSON representation

{
  "videoDuration": string
}
State
States for the lifecycle of a File.

Enums
STATE_UNSPECIFIED	The default value. This value is used if the state is omitted.
PROCESSING	File is being processed and cannot be used for inference yet.
ACTIVE	File is processed and available for inference.
FAILED	File failed processing.
Source
Enums
SOURCE_UNSPECIFIED	Used if source is not specified.
UPLOADED	Indicates the file is uploaded by the user.
GENERATED	Indicates the file is generated by Google.
Status
The Status type defines a logical error model that is suitable for different programming environments, including REST APIs and RPC APIs. It is used by gRPC. Each Status message contains three pieces of data: error code, error message, and error details.

You can find out more about this error model and how to work with it in the API Design Guide.

Fields
code
integer
The status code, which should be an enum value of google.rpc.Code.

message
string
A developer-facing error message, which should be in English. Any user-facing error message should be localized and sent in the google.rpc.Status.details field, or localized by the client.

details[]
object
A list of messages that carry the error details. There is a common set of message types for APIs to use.

An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.

JSON representation

{
  "code": integer,
  "message": string,
  "details": [
    {
      "@type": string,
      field1: ...,
      ...
    }
  ]
}
---
Method: media.upload
Creates a File.

Endpoint
Upload URI, for media upload requests:
post
https://generativelanguage.googleapis.com/upload/v1beta/files
Metadata URI, for metadata-only requests:
post
https://generativelanguage.googleapis.com/v1beta/files
Request body
The request body contains data with the following structure:

Fields
file
object (File)
Optional. Metadata for the file to create.

Example request
Image
Audio
Text
Video
PDF
Python
Go

from google import genai

client = genai.Client()
sample_pdf = client.files.upload(file=media / "test.pdf")
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=["Give me a summary of this pdf file.", sample_pdf],
)
print(response.text)
Response body
Response for media.upload.

If successful, the response body contains data with the following structure:

Fields
file
object (File)
Metadata for the created file.

JSON representation

{
  "file": {
    object (File)
  }
}
Method: files.get
Gets the metadata for the given File.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to get. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const myfile = await ai.files.upload({
  file: path.join(media, "poem.txt"),
});
const fileName = myfile.name;
console.log(fileName);

const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
Response body
If successful, the response body contains an instance of File.

Method: files.list
Lists the metadata for Files owned by the requesting project.

Endpoint
get
https://generativelanguage.googleapis.com/v1beta/files

Query parameters
pageSize
integer
Optional. Maximum number of Files to return per page. If unspecified, defaults to 10. Maximum pageSize is 100.

pageToken
string
Optional. A page token from a previous files.list call.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log("My files:");
// Using the pager style to list files
const pager = await ai.files.list({ config: { pageSize: 10 } });
let page = pager.page;
const names = [];
while (true) {
  for (const f of page) {
    console.log("  ", f.name);
    names.push(f.name);
  }
  if (!pager.hasNextPage()) break;
  page = await pager.nextPage();
}
Response body
Response for files.list.

If successful, the response body contains data with the following structure:

Fields
files[]
object (File)
The list of Files.

nextPageToken
string
A token that can be sent as a pageToken into a subsequent files.list call.

JSON representation

{
  "files": [
    {
      object (File)
    }
  ],
  "nextPageToken": string
}
Method: files.delete
Deletes the File.

Endpoint
delete
https://generativelanguage.googleapis.com/v1beta/{name=files/*}

Path parameters
name
string
Required. The name of the File to delete. Example: files/abc-123 It takes the form files/{file}.

Request body
The request body must be empty.

Example request
Python
Node.js
Go
Shell

// The Gen AI SDK for TypeScript and JavaScript is in preview.
// Some features have not been implemented.
Response body
If successful, the response body is an empty JSON object.

REST Resource: files
Resource: File
A file uploaded to the API. Next ID: 15

Fields
name
string
Immutable. Identifier. The File resource name. The ID (name excluding the "files/" prefix) can contain up to 40 characters that are lowercase alphanumeric or dashes (-). The ID cannot start or end with a dash. If the name is empty on create, a unique name will be generated. Example: files/123-456

displayName
string
Optional. The human-readable display name for the File. The display name must be no more than 512 characters in length, including spaces. Example: "Welcome Image"

mimeType
string
Output only. MIME type of the file.

sizeBytes
string (int64 format)
Output only. Size of the file in bytes.

createTime
string (Timestamp format)
Output only. The timestamp of when the File was created.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

updateTime
string (Timestamp format)
Output only. The timestamp of when the File was last updated.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

expirationTime
string (Timestamp format)
Output only. The timestamp of when the File will be deleted. Only set if the File is scheduled to expire.

Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

sha256Hash
string (bytes format)
Output only. SHA-256 hash of the uploaded bytes.

A base64-encoded string.

uri
string
Output only. The uri of the File.

downloadUri
string
Output only. The download uri of the File.

state
enum (State)
Output only. Processing state of the File.

source
enum (Source)
Source of the File.

error
object (Status)
Output only. Error status if File processing failed.

metadata
Union type
Metadata for the File. metadata can be only one of the following:
videoMetadata
object (VideoFileMetadata)
Output only. Metadata for a video.

JSON representation

{
  "name": string,
  "displayName": string,
  "mimeType": string,
  "sizeBytes": string,
  "createTime": string,
  "updateTime": string,
  "expirationTime": string,
  "sha256Hash": string,
  "uri": string,
  "downloadUri": string,
  "state": enum (State),
  "source": enum (Source),
  "error": {
    object (Status)
  },

  // metadata
  "videoMetadata": {
    object (VideoFileMetadata)
  }
  // Union type
}
VideoFileMetadata
Metadata for a video File.

Fields
videoDuration
string (Duration format)
Duration of the video.

A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

JSON representation

{
  "videoDuration": string
}
State
States for the lifecycle of a File.

Enums
STATE_UNSPECIFIED	The default value. This value is used if the state is omitted.
PROCESSING	File is being processed and cannot be used for inference yet.
ACTIVE	File is processed and available for inference.
FAILED	File failed processing.
Source
Enums
SOURCE_UNSPECIFIED	Used if source is not specified.
UPLOADED	Indicates the file is uploaded by the user.
GENERATED	Indicates the file is generated by Google.
Status
The Status type defines a logical error model that is suitable for different programming environments, including REST APIs and RPC APIs. It is used by gRPC. Each Status message contains three pieces of data: error code, error message, and error details.

You can find out more about this error model and how to work with it in the API Design Guide.

Fields
code
integer
The status code, which should be an enum value of google.rpc.Code.

message
string
A developer-facing error message, which should be in English. Any user-facing error message should be localized and sent in the google.rpc.Status.details field, or localized by the client.

details[]
object
A list of messages that carry the error details. There is a common set of message types for APIs to use.

An object containing fields of an arbitrary type. An additional field "@type" contains a URI identifying the type. Example: { "id": 1234, "@type": "types.example.com/standard/id" }.

JSON representation

{
  "code": integer,
  "message": string,
  "details": [
    {
      "@type": string,
      field1: ...,
      ...
    }
  ]
}
------------
Files API

The Gemini family of artificial intelligence (AI) models is built to handle various types of input data, including text, images, and audio. Since these models can handle more than one type or mode of data, the Gemini models are called multimodal models or explained as having multimodal capabilities.

This guide shows you how to work with media files using the Files API. The basic operations are the same for audio files, images, videos, documents, and other supported file types.

For file prompting guidance, check out the File prompt guide section.

Upload a file
You can use the Files API to upload a media file. Always use the Files API when the total request size (including the files, text prompt, system instructions, etc.) is larger than 20 MB.

The following code uploads a file and then uses the file in a call to generateContent.

Python
JavaScript
Go
REST

import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {
  const myfile = await ai.files.upload({
    file: "path/to/sample.mp3",
    config: { mimeType: "audio/mpeg" },
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: createUserContent([
      createPartFromUri(myfile.uri, myfile.mimeType),
      "Describe this audio clip",
    ]),
  });
  console.log(response.text);
}

await main();
Get metadata for a file
You can verify that the API successfully stored the uploaded file and get its metadata by calling files.get.

Python
JavaScript
Go
REST

const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const fileName = myfile.name;
const fetchedFile = await ai.files.get({ name: fileName });
console.log(fetchedFile);
List uploaded files
You can upload multiple files using the Files API. The following code gets a list of all the files uploaded:

Python
JavaScript
Go
REST

const listResponse = await ai.files.list({ config: { pageSize: 10 } });
for await (const file of listResponse) {
  console.log(file.name);
}
Delete uploaded files
Files are automatically deleted after 48 hours. You can also manually delete an uploaded file:

Python
JavaScript
Go
REST

const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const fileName = myfile.name;
await ai.files.delete({ name: fileName });
Usage info
You can use the Files API to upload and interact with media files. The Files API lets you store up to 20 GB of files per project, with a per-file maximum size of 2 GB. Files are stored for 48 hours. During that time, you can use the API to get metadata about the files, but you can't download the files. The Files API is available at no cost in all regions where the Gemini API is available.

File prompting strategies
This section provides guidance and best practices for using media files with prompts for the Gemini API.

Being able to use various types of data in your prompts gives you more flexibility in terms of what tasks you can tackle with the Gemini API. For example, you can send the model a photo of a delicious meal and ask it to write a short blog about the meal.

Prompt	Response
Write a short, engaging blog post based on this picture. It should include a description of the meal in the photo and talk about my journey meal prepping.


Cookies	
Meal prepping is a great way to save time and money, and it can also help you to eat healthier. This meal is a great example of a healthy and delicious meal that can be easily prepped ahead of time.

This meal features brown rice, roasted vegetables, and chicken teriyaki. The brown rice is a healthy and complex carbohydrate that will give you sustained energy. The roasted vegetables are a great way to get your daily dose of vitamins and minerals, and the chicken teriyaki is a delicious and protein-rich option.

This meal is also very easy to prepare. Simply cook the brown rice, roast the vegetables, and cook the chicken teriyaki. Once everything is cooked, divide it into meal prep containers and store them in the refrigerator. You can then grab a container and go on busy mornings!

If you're looking for a healthy and delicious meal that can be easily prepped ahead of time, this meal is a great option. It's packed with nutrients and flavor, and it's sure to keep you feeling full and satisfied.

Here's to healthy and delicious meal prepping!

If you are having trouble getting the output you want from prompts that use media files, there are some strategies that can help you get the results you want. The following sections provide design approaches and troubleshooting tips for improving prompts that use multimodal input.

You can improve your multimodal prompts by following these best practices:

Prompt design fundamentals
Be specific in your instructions: Craft clear and concise instructions that leave minimal room for misinterpretation.
Add a few examples to your prompt: Use realistic few-shot examples to illustrate what you want to achieve.
Break it down step-by-step: Divide complex tasks into manageable sub-goals, guiding the model through the process.
Specify the output format: In your prompt, ask for the output to be in the format you want, like markdown, JSON, HTML and more.
Put your image first for single-image prompts: While Gemini can handle image and text inputs in any order, for prompts containing a single image, it might perform better if that image (or video) is placed before the text prompt. However, for prompts that require images to be highly interleaved with texts to make sense, use whatever order is most natural.
Troubleshooting your multimodal prompt
If the model is not drawing information from the relevant part of the image: Drop hints with which aspects of the image you want the prompt to draw information from.
If the model output is too generic (not tailored enough to the image/video input): At the start of the prompt, try asking the model to describe the image(s) or video before providing the task instruction, or try asking the model to refer to what's in the image.
To troubleshoot which part failed: Ask the model to describe the image, or ask the model to explain its reasoning, to gauge the model's initial understanding.
If your prompt results in hallucinated content: Try dialing down the temperature setting or asking the model for shorter descriptions so that it's less likely to extrapolate additional details.
Tuning the sampling parameters: Experiment with different temperature settings and top-k selections to adjust the model's creativity.
Be specific in your instructions
Prompts have the most success when they are clear and detailed. If you have a specific output in mind, it's better to include that requirement in the prompt to ensure you get the output you want.

For this image of an airport board, asking the model to just "describe this image" could generate a general description. If you need the model to parse the time and city from the image, you can include that request directly in your prompt.

Prompt	Model response

Describe this image.

The image shows an airport arrivals and departures board.

Updated prompt	Improved response
Travel timetable
Parse the time and city from the airport board shown in this image into a list.

10:50 Moscow
11:05 Edinburgh
11:05 London
11:10 Bucharest
11:30 Kiev
11:35 Dublin
11:45 East Midlands
12:15 Sofia
12:30 London
12:30 Newcastle
12:40 St Petersburg
12:40 London
12:45 Manchester
Add a few examples
The Gemini model can accept multiple inputs which it can use as examples to understand the output you want. Adding these examples can help the model identify the patterns and apply the relationship between the given images and responses to the new example. This is also called "few-shot" learning.

In the example below, the initial output is written in sentence form, and also contains the country (Brazil). Suppose you want the output in a different format or style, and you want only the city, not the country. Adding few-shot examples to your prompt can steer the model to respond in the way you want.

Prompt	Model response
Travel timetable
Determine the city along with the landmark.

The landmark is the Christ the Redeemer statue in Rio de Janeiro, Brazil.

Updated prompt	Improved response
Determine the city along with the landmark.

colosseum	
city: Rome, landmark: the Colosseum.

Forbidden City	
city: Beijing, landmark: Forbidden City

forbidden-city	
city: Rio de Janeiro, landmark: Christ the Redeemer statue

Break it down step-by-step
For complex tasks like the ones that require both visual understanding and reasoning, it can be helpful to split the task into smaller, more straightforward steps. Alternatively, it could also be effective if you directly ask the model to “think step by step” in your prompt.

Prompt	Model response

When will I run out of toilet paper?

Soon, you only have 3 rolls left.

Updated prompt	Improved response


1. First, count how many toilet paper rolls are in this picture.
2. Then, determine how much toilet paper a typical person uses per day.
3. Calculate how long these rolls of toilet paper will last.

1. There are 3 rolls of toilet paper in this picture.
2. A typical person uses about 20 sheets of toilet paper per day.
3. If each roll contains 200 sheets, then each roll will last for about 10 days. Therefore, the 3 rolls will last for about a month.
Math problems or other types of word problems are great candidates for asking the model to think step-by-step.

Prompt	Response


What is the 4th term in the sequence?

-135

The response from the model is incorrect. Some ways to improve this is to ask the model to parse the problem before answering the prompt.

Prompt	Response


Parse the formula in the image first.

Then based on the formula, answer "what's the 4th term in the sequence?".

Click to expand the result
This model response is correct - now to make the response even more streamlined, you can ask the model to to think step-by-step.

Updated prompt	Improved response

What is the 4th term in the sequence? Think step by step.

The first term is 15.

The second term is b(1) * (-3) = 15 * (-3) = -45.

The third term is b(2) * (-3) = -45 * (-3) = 135.

The fourth term is b(3) * (-3) = 135 * (-3) = -405.

Specify the output format
A common problem is the need for model output to be in a certain format (e.g. markdown, JSON, HTML), especially if the model output needs to be ingested by a downstream task. You can try to produce output in that format by instructing the model to do so within the prompt. Below are two examples:

Prompt	Model response

Parse the table in this image into markdown format

| Subject | Status | Time | Start date | Due on |

| ------- | ------ | ---- | ---------- | ------ |

| Math | Done | 1.5 hrs | 11/29/2023 | 12/1/2023 |

| Geography | Done | 30 min | 12/2/2023 | 12/4/2023 |

| Physics | In progress | 2 hrs | 12/3/2023 | 12/5/2023 |

| Biology | Not started | 6 hrs | 11/2/2016 | 12/6/2023 |

Prompt	Model response

Provide a list of all the following attributes:

ingredients, type of cuisine, vegetarian or not, in JSON format


```json

{

"ingredients": [

"rice",
"shrimp",
"clams",
"mussels",
"peas",
"tomatoes",
"onions",
"garlic",
"olive oil",
"paprika",
"salt",
"pepper"

],
"type of cuisine": "Spanish",
"vegetarian": false

}

```

Put your image first for single-image prompts
While Gemini can interpret image and text in any order within a prompt, placing a single image before the text prompt might lead to better results. In the following samples, you'll notice the image comes first before the text in each prompt.

Troubleshooting your multimodal prompt
You might need to troubleshoot your prompt if you are not getting a helpful response. Here are a few strategies you could try.

If the model is not drawing information from the relevant part of the image
To get a more specific response, you can point out which aspects of the image you want the prompt to draw information from to inform its response.

Prompt	Model response

How many days will these diapers last a baby?

The diapers will last for 198 days before they run out.

Updated prompt	Improved response

How long will these diapers last before I run out?

Use the weight shown on the box to determine the child's age, and use the total number of diapers in the box.

Divide the total number by how many diapers the child goes through per day.

The box contains 198 diapers. The box states the diapers are for a child weighing 22-37 lbs.

The average child in this weight range is likely between 1 and 2 years old.

A 2-year-old typically goes through 6 diapers per day, therefore, the diapers will last around 33 days (198/6).

If the model output is too generic and not tailored enough to the image input
To help the model tailor its response to the image(s), try asking it to describe the images before performing its reasoning task.

Prompt	Model response
   
What is in common between these images?

All four images are examples of landscape photography.

Updated prompt	Improved response
   
First, describe what's in each image in detail. What's in common between these images?

The first image shows a person packing a suitcase. The second image shows an empty hallway in a shopping mall. The third image shows a roll of toilet paper. The fourth image shows a dark and stormy sea.

The commonality between these images is that they are all examples of liminal spaces. Liminal spaces are places or situations that are in between two other places or situations. They are often characterized by a sense of uncertainty or ambiguity.

The first image shows the person in between being at home and being on a trip. The second image shows the hallway in between two stores. The third image is of toilet paper, which can represent a bathroom. A bathroom is a transitional space between private and public realms. It's a place where we prepare ourselves to enter or leave the outside world.

The fourth image shows the sea in between being calm and being stormy.

Liminal spaces can be both exciting and unsettling. They can be a place of new beginning or a place of endings. They can be a place of reflection or a place of action.

You can also try explicitly asking the model to refer to what's in the image.

Updated prompt	Improved response
   
What is in common between these images? Refer to what's in the images in your response.

All of the images are related to travel. The first image shows a person packing a suitcase, the second image shows an empty hallway in a shopping mall, the third image shows a stack of toilet paper, and the fourth image shows a dark and stormy sea.

These images are all related to travel because they are all things that people need or use when they travel. The first image shows a person packing a suitcase, which is something that people do when they are going on a trip. The second image shows an empty hallway in a shopping mall, which is a place where people often go to buy things for their trips. The third image shows a stack of toilet paper, which is something that people often use when they are traveling. The fourth image shows a dark and stormy sea, which is something that people often encounter when they are traveling.

The same tips work for creative output from images. In the following example with the rabbit, explicitly asking the model to include aspects from the image can improve the output.

Prompt	Model response

Can you write me a poem about this image?

Little bunny, so soft and brown,
Hopping through the field, up and down.
Your ears so long, your tail so small,
You're the cutest creature of them all.

You nibble on the grass, so green and sweet,
And hop away when you see me.
But I'll always be your friend,
Little bunny, until the very end.

Updated prompt	Improved response

Can you write me a descriptive and dramatic poem about this image and include the location?

Little bunny on the green,
Ears so long, so keen.
What do you see out there,
In the distance, where you stare?

Is it the ocean blue,
Sparkling in the sun's hue?
Or the waves that crash and roar,
A rhythm that you adore?

Little bunny, tell me true,
What captures your attention so?
Is it the salty breeze,
Or the seagulls' cries that please?

Perhaps it's the vastness of it all,
A world so big and small.
A place where dreams can roam,
And adventures can be sown.

Little bunny, I wonder what you dream,
As you sit on the grass, so serene.
Do you yearn to explore the deep,
Or stay on land, where you can leap?

Whatever it may be, little bunny,
Keep that spark of wonder burning brightly.
For in your dreams and aspirations,
Lies a world waiting for your creation.

Troubleshooting which part of the prompt failed
It can be hard to know whether a prompt failed because the model didn't understand the image to begin with, or if it did understand the image but did not perform the correct reasoning steps afterward. To disambiguate between those reasons, ask the model to describe what's in the image.

In the following example, if the model responds with a snack that seems surprising when paired with tea (e.g. popcorn), you can first troubleshoot to determine whether the model correctly recognized that the image contains tea.

Prompt	Prompt for troubleshooting

What's a snack I can make in 1 minute that would go well with this?


Describe what's in this image.

Another strategy is to ask the model to explain its reasoning. That can help you narrow down which part of the reasoning broke down, if any.

Prompt	Prompt for troubleshooting

What's a snack I can make in 1 minute that would go well with this?


What's a snack I can make in 1 minute that would go well with this? Please explain why.

What's next
Try writing your own multimodal prompts using Google AI Studio.
For information on using the Gemini Files API for uploading media files and including them in your prompts, see the Vision, Audio, and Document processing guides.
For more guidance on prompt design, like tuning sampling parameters, see the Prompt strategies page.
---
Document understanding

Gemini models can process documents in PDF format, using native vision to understand entire document contexts. This goes beyond simple text extraction, allowing Gemini to:

Analyze and interpret content, including text, images, diagrams, charts, and tables, even in long documents up to 1000 pages.
Extract information into structured output formats.
Summarize and answer questions based on both the visual and textual elements in a document.
Transcribe document content (e.g. to HTML), preserving layouts and formatting, for use in downstream applications.
Passing inline PDF data
You can pass inline PDF data in the request to generateContent. For PDF payloads under 20MB, you can choose between uploading base64 encoded documents or directly uploading locally stored files.

The following example shows you how to fetch a PDF from a URL and convert it to bytes for processing:

Python
JavaScript
Go
REST

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
    const pdfResp = await fetch('https://discovery.ucl.ac.uk/id/eprint/10089234/1/343019_3_art_0_py4t4l_convrt.pdf')
        .then((response) => response.arrayBuffer());

    const contents = [
        { text: "Summarize this document" },
        {
            inlineData: {
                mimeType: 'application/pdf',
                data: Buffer.from(pdfResp).toString("base64")
            }
        }
    ];

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents
    });
    console.log(response.text);
}

main();
You can also read a PDF from a local file for processing:

Python
JavaScript
Go

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
    const contents = [
        { text: "Summarize this document" },
        {
            inlineData: {
                mimeType: 'application/pdf',
                data: Buffer.from(fs.readFileSync("content/343019_3_art_0_py4t4l_convrt.pdf")).toString("base64")
            }
        }
    ];

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents
    });
    console.log(response.text);
}

main();
Uploading PDFs using the File API
You can use the File API to upload larger documents. Always use the File API when the total request size (including the files, text prompt, system instructions, etc.) is larger than 20MB.

Note: The File API lets you store up to 50MB of PDF files. Files are stored for 48 hours. You can access them in that period with your API key, but you can't download them from the API. The File API is available at no cost in all regions where the Gemini API is available.
Call media.upload to upload a file using the File API. The following code uploads a document file and then uses the file in a call to models.generateContent.

Large PDFs from URLs
Use the File API to simplify uploading and processing large PDF files from URLs:

Python
JavaScript
Go
REST

import { createPartFromUri, GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {

    const pdfBuffer = await fetch("https://www.nasa.gov/wp-content/uploads/static/history/alsj/a17/A17_FlightPlan.pdf")
        .then((response) => response.arrayBuffer());

    const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const file = await ai.files.upload({
        file: fileBlob,
        config: {
            displayName: 'A17_FlightPlan.pdf',
        },
    });

    // Wait for the file to be processed.
    let getFile = await ai.files.get({ name: file.name });
    while (getFile.state === 'PROCESSING') {
        getFile = await ai.files.get({ name: file.name });
        console.log(`current file status: ${getFile.state}`);
        console.log('File is still processing, retrying in 5 seconds');

        await new Promise((resolve) => {
            setTimeout(resolve, 5000);
        });
    }
    if (file.state === 'FAILED') {
        throw new Error('File processing failed.');
    }

    // Add the file to the contents.
    const content = [
        'Summarize this document',
    ];

    if (file.uri && file.mimeType) {
        const fileContent = createPartFromUri(file.uri, file.mimeType);
        content.push(fileContent);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
    });

    console.log(response.text);

}

main();
Large PDFs stored locally
Python
JavaScript
Go
REST

import { createPartFromUri, GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
    const file = await ai.files.upload({
        file: 'path-to-localfile.pdf'
        config: {
            displayName: 'A17_FlightPlan.pdf',
        },
    });

    // Wait for the file to be processed.
    let getFile = await ai.files.get({ name: file.name });
    while (getFile.state === 'PROCESSING') {
        getFile = await ai.files.get({ name: file.name });
        console.log(`current file status: ${getFile.state}`);
        console.log('File is still processing, retrying in 5 seconds');

        await new Promise((resolve) => {
            setTimeout(resolve, 5000);
        });
    }
    if (file.state === 'FAILED') {
        throw new Error('File processing failed.');
    }

    // Add the file to the contents.
    const content = [
        'Summarize this document',
    ];

    if (file.uri && file.mimeType) {
        const fileContent = createPartFromUri(file.uri, file.mimeType);
        content.push(fileContent);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
    });

    console.log(response.text);

}

main();
You can verify the API successfully stored the uploaded file and get its metadata by calling files.get. Only the name (and by extension, the uri) are unique.

Python
REST

from google import genai
import pathlib

client = genai.Client()

fpath = pathlib.Path('example.txt')
fpath.write_text('hello')

file = client.files.upload(file='example.txt')

file_info = client.files.get(name=file.name)
print(file_info.model_dump_json(indent=4))
Passing multiple PDFs
The Gemini API is capable of processing multiple PDF documents (up to 1000 pages) in a single request, as long as the combined size of the documents and the text prompt stays within the model's context window.

Python
JavaScript
Go
REST

import { createPartFromUri, GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function uploadRemotePDF(url, displayName) {
    const pdfBuffer = await fetch(url)
        .then((response) => response.arrayBuffer());

    const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const file = await ai.files.upload({
        file: fileBlob,
        config: {
            displayName: displayName,
        },
    });

    // Wait for the file to be processed.
    let getFile = await ai.files.get({ name: file.name });
    while (getFile.state === 'PROCESSING') {
        getFile = await ai.files.get({ name: file.name });
        console.log(`current file status: ${getFile.state}`);
        console.log('File is still processing, retrying in 5 seconds');

        await new Promise((resolve) => {
            setTimeout(resolve, 5000);
        });
    }
    if (file.state === 'FAILED') {
        throw new Error('File processing failed.');
    }

    return file;
}

async function main() {
    const content = [
        'What is the difference between each of the main benchmarks between these two papers? Output these in a table.',
    ];

    let file1 = await uploadRemotePDF("https://arxiv.org/pdf/2312.11805", "PDF 1")
    if (file1.uri && file1.mimeType) {
        const fileContent = createPartFromUri(file1.uri, file1.mimeType);
        content.push(fileContent);
    }
    let file2 = await uploadRemotePDF("https://arxiv.org/pdf/2403.05530", "PDF 2")
    if (file2.uri && file2.mimeType) {
        const fileContent = createPartFromUri(file2.uri, file2.mimeType);
        content.push(fileContent);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
    });

    console.log(response.text);
}

main();
Technical details
Gemini supports a maximum of 1,000 document pages. Each document page is equivalent to 258 tokens.

While there are no specific limits to the number of pixels in a document besides the model's context window, larger pages are scaled down to a maximum resolution of 3072x3072 while preserving their original aspect ratio, while smaller pages are scaled up to 768x768 pixels. There is no cost reduction for pages at lower sizes, other than bandwidth, or performance improvement for pages at higher resolution.

Document types
Technically, you can pass other MIME types for document understanding, like TXT, Markdown, HTML, XML, etc. However, document vision only meaningfully understands PDFs. Other types will be extracted as pure text, and the model won't be able to interpret what we see in the rendering of those files. Any file-type specifics like charts, diagrams, HTML tags, Markdown formatting, etc., will be lost.

Best practices
For best results:

Rotate pages to the correct orientation before uploading.
Avoid blurry pages.
If using a single page, place the text prompt after the page.
What's next
To learn more, see the following resources:

File prompting strategies: The Gemini API supports prompting with text, image, audio, and video data, also known as multimodal prompting.
System instructions: System instructions let you steer the behavior of the model based on your specific needs and use cases.

Model variants
The Gemini API offers different models that are optimized for specific use cases. Here's a brief overview of Gemini variants that are available:

Model variant	Input(s)	Output	Optimized for
Gemini 2.5 Pro
gemini-2.5-pro	Audio, images, videos, text, and PDF	Text	Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more
Gemini 2.5 Flash
gemini-2.5-flash	Audio, images, videos, and text	Text	Adaptive thinking, cost efficiency
Gemini 2.5 Flash-Lite
gemini-2.5-flash-lite	Text, image, video, audio	Text	Most cost-efficient model supporting high throughput

--
Gemini 2.5 Pro is our state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.

Try in Google AI Studio

Model details
Property	Description
Model code	gemini-2.5-pro
Supported data types
Inputs

Audio, images, video, text, and PDF

Output

Text

Token limits[*]
Input token limit

1,048,576

Output token limit

65,536

Capabilities
Structured outputs

Supported

Caching

Supported

Function calling

Supported

Code execution

Supported

Search grounding

Supported

Image generation

Not supported

Audio generation

Not supported

Live API

Not supported

Thinking

Supported

Batch Mode

Supported

URL Context

Supported

Versions	
Read the model version patterns for more details.
Stable: gemini-2.5-pro
Latest update	June 2025
Knowledge cutoff	January 2025
--
Our best model in terms of price-performance, offering well-rounded capabilities. 2.5 Flash is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases.

Try in Google AI Studio

Model details
Property	Description
Model code	models/gemini-2.5-flash
Supported data types
Inputs

Text, images, video, audio

Output

Text

Token limits[*]
Input token limit

1,048,576

Output token limit

65,536

Capabilities
Audio generation

Not supported

Caching

Supported

Code execution

Supported

Function calling

Supported

Image generation

Not supported

Search grounding

Supported

Structured outputs

Supported

Thinking

Supported

Batch Mode

Supported

URL Context

Supported

Versions	
Read the model version patterns for more details.
Stable: gemini-2.5-flash
Preview: gemini-2.5-flash-preview-05-20
Latest update	June 2025
Knowledge cutoff	January 2025
---
A Gemini 2.5 Flash model optimized for cost-efficiency and high throughput.

Try in Google AI Studio

Model details
Property	Description
Model code	models/gemini-2.5-flash-lite
Supported data types
Inputs

Text, image, video, audio, PDF

Output

Text

Token limits[*]
Input token limit

1,048,576

Output token limit

65,536

Capabilities
Structured outputs

Supported

Caching

Supported

Function calling

Supported

Code execution

Supported

URL Context

Supported

Search grounding

Supported

Image generation

Not supported

Audio generation

Not supported

Live API

Not supported

Thinking

Supported

Batch mode

Supported

URL Context

Supported

Versions	
Read the model version patterns for more details.
Stable: gemini-2.5-flash-lite
Preview: gemini-2.5-flash-lite-06-17
Latest update	July 2025
Knowledge cutoff	January 2025

also i foudnd this- Attaching a Google Drive file directly to a Gemini API call is not a direct process. The Gemini API, specifically the Files API, requires you to upload files to its own service for use in prompts. This means you cannot directly reference a file's Google Drive URL in a Gemini API request.
To use a Google Drive file with the Gemini API:
Retrieve the file from Google Drive:
You need to access the content of the file from Google Drive. This typically involves using the Google Drive API to download the file's content.
Upload the file to the Gemini Files API:
Once you have the file's content, you can then upload it to the Gemini Files API. This API provides an endpoint for uploading various file types, including images, audio, video, and documents. The Files API will return a unique identifier for the uploaded file.
Reference the uploaded file in your Gemini API call:
After successfully uploading the file to the Files API, you can include the returned file identifier in your generateContent request to the Gemini API. This tells Gemini to use the content of that specific file as part of your prompt.
Note: For smaller files (under 20MB), some media types like audio, video, and PDF can potentially be passed inline within the generateContent request by base64 encoding the file content. However, for larger files or if you intend to reuse the file across multiple prompts, using the Files API is the recommended and more efficient approach.

Directly attaching a file from Google Drive to a Gemini API call using JavaScript is not a built-in feature of the Gemini API. However, you can achieve this by first making the Google Drive file accessible and then passing its content or a reference to it in the Gemini API call.
Here's a general approach:
Access the Google Drive File:
Google Drive API: Utilize the Google Drive API in your JavaScript application to retrieve the file's content. This might involve setting up authentication and then using methods like files.get with alt=media to download the file's binary content.
Make File Publicly Accessible (with caution): If appropriate for your use case and security considerations, you could make the Google Drive file publicly accessible and obtain its direct download link. Then, you can use this link in your Gemini API call if the API supports fetching external URLs.
Prepare the File for Gemini:
Files API (Recommended for Larger Files): For larger files, upload the retrieved content from Google Drive to the Gemini Files API. This API allows you to upload and store files temporarily, providing a fileData reference that can be included in your generateContent request.
Inline Data (For Smaller Files): For smaller files (e.g., under 20MB for videos, or within token limits for text/PDFs), you can encode the file's content (e.g., base64 encoding for binary data) and include it directly as inlineData within the contents array of your generateContent request.
Call the Gemini API:
Once the file is uploaded to the Files API or prepared as inline data, construct your generateContent request to the Gemini API, including the fileData reference or inlineData blob in the parts array of your contents.
Example (Conceptual, using inline data for small files):
JavaScript

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs"; // For reading local files, replace with Google Drive API call

const ai = new GoogleGenAI({ apiKey: "YOUR_API_KEY" });

async function processGoogleDriveFileWithGemini(fileContentFromDrive, mimeType) {
  const contents = [
    {
      inlineData: {
        mimeType: mimeType,
        data: Buffer.from(fileContentFromDrive).toString("base64"), // Encode content from Drive
      },
    },
    { text: "Analyze this file and provide a summary." }, // Your prompt
  ];

  const response = await ai.models.generateContent({
    model: "gemini-pro-vision", // Or another suitable Gemini model
    contents: contents,
  });

  console.log(response.text);
}

// Example of how you might get file content (replace with actual Google Drive API integration)
// const driveFileContent = await getFileContentFromGoogleDrive("file_id_here");
// processGoogleDriveFileWithGemini(driveFileContent, "application/pdf");
Important Considerations:
Authentication:
When using the Google Drive API, ensure proper authentication and authorization to access the user's Drive files.
File Size Limits:
Be aware of the size limitations for inline data and the Files API.
Security:
If making files publicly accessible, understand and mitigate the security implications.
Error Handling:
Implement robust error handling for both Google Drive API calls and Gemini API calls.
------
Attaching a Google Drive file directly to a Gemini API request is not supported in the same way as attaching a local file. Instead, you need to use the Gemini Files API to manage files for use with the Gemini API.
Here's the general process:
Upload the Google Drive file to the Gemini Files API:
You would first need to download the file from Google Drive to your local environment or a cloud storage location accessible by your application.
Then, use the Gemini Files API to upload this file. This API provides an endpoint for uploading various media types, including text, images, audio, and video. You'll receive a file URI in return.
Reference the uploaded file in your Gemini API request:
Once the file is uploaded to the Gemini Files API, you can reference it in your generateContent request using the URI provided during the upload process.
This is typically done by including a Part in your contents array with uri and mime_type fields pointing to the uploaded file.
Example (conceptual, using Python client library):
Python

from google import genai
from google.genai.types import GenerateContentConfig

# Assuming you have authenticated and initialized the client
client = genai.Client()

# 1. Upload the file (replace with your actual file path and MIME type)
# This step would involve downloading from Google Drive first if not local
file_path = "path/to/your/downloaded_drive_file.pdf"
mime_type = "application/pdf"

uploaded_file = client.Files.upload_from_path(
    file_path,
    mime_type=mime_type
)

# 2. Use the uploaded file's URI in your generateContent request
response = client.models.generate_content(
    model="gemini-pro-vision", # Or another appropriate model
    contents=[
        genai.NewPartFromText("Summarize the key points in this document:"),
        genai.NewPartFromURI(uploaded_file.uri, uploaded_file.mime_type)
    ]
)

print(response.text)
Important Considerations:
File Size Limits:
The Gemini Files API has limits on file size (e.g., 2GB per file) and total storage per project (e.g., 20GB).
File Retention:
Files uploaded to the Gemini Files API are typically stored for a limited time (e.g., 48 hours).
MIME Types:
Ensure you provide the correct MIME type for the file during upload.
Authentication:
You will need proper authentication (e.g., API key) to interact with both the Gemini API and the Files API.
-----

google drive file attach to the gemini api call js
Directly attaching a Google Drive file to a Gemini API call in JavaScript is not possible. You must first download the file from Drive. Then, upload it to the Gemini API using the Files API. This two-step process is necessary because Gemini requires file data to be sent through its own storage system. 
Here's the general workflow and a JavaScript example:
Retrieve the file: Use the Google Drive API to get the file content (download it).
Upload to Gemini: Use the Gemini Files API to upload the file and get a file ID.
Attach to prompt: Use the Gemini file ID in the API call to generateContent. 
Step 1: Set up the Google Cloud project
Enable APIs: In the Google Cloud Console, enable the Google Drive API and the Gemini API.
Create credentials: Create an OAuth client ID for a "Web application" (for client-side JS) or a "Web application" and "API key" (for server-side JS with Node.js).
Set up OAuth consent: Configure the OAuth consent screen in the Google Cloud Console. 
Step 2: Retrieve the file from Google Drive
This example uses the client-side Google API library for a browser-based application. 
javascript
// Load the Google API client library
function loadClient() {
  gapi.load('client', initClient);
}

// Initialize the client with your API key and OAuth info
async function initClient() {
  await gapi.client.init({
    apiKey: YOUR_API_KEY, // Replace with your API key
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  });

  // Initialize the Google Identity Services client
  await gisLoaded();
}

let tokenClient;
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: YOUR_CLIENT_ID, // Replace with your client ID
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: '', // The callback function is set later
  });
}

// Handle the sign-in process
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error) {
      throw (resp);
    }
    // Access token is now available: gapi.client.getToken().access_token
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user for consent
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Use existing token
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

// Function to download a file from Google Drive as a Blob
async function downloadDriveFile(fileId) {
  const response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return new Blob([response.body], { type: response.headers['Content-Type'] });
}
Use code with caution.

Step 3: Upload the file to the Gemini Files API
Use the file Blob from the previous step to upload to the Gemini API. 
javascript
// A simple function to create parts from a Blob
const createPartFromBlob = (blob, mimeType) => {
  return {
    inlineData: {
      data: btoa(String.fromCharCode(...new Uint8Array(blob))),
      mimeType,
    },
  };
};

async function uploadToGemini(fileBlob, mimeType) {
  // Use the Gemini client library for this part.
  // The Gemini API does not use the GAPI client directly.
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  // Create a file part from the Blob
  const filePart = createPartFromBlob(fileBlob, mimeType);
  
  // This is a simplified approach using inline data.
  // For larger files, you must use the Files API's multipart upload.
  const result = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent([
    filePart,
    'What can you tell me about this file?',
  ]);
  
  return result;
}
Use code with caution.

Complete workflow
The functions can be chained together to perform the full operation. 
javascript
// Assuming fileId is the Google Drive ID of the target file
const driveFileId = 'YOUR_DRIVE_FILE_ID';

async function processDriveFileWithGemini() {
  try {
    // 1. Get user authentication for Google Drive
    await handleAuthClick();

    // 2. Download the file from Google Drive
    const fileBlob = await downloadDriveFile(driveFileId);
    console.log('File downloaded from Google Drive.');

    // 3. Upload the file (inline in this example) to the Gemini API
    const mimeType = 'image/jpeg'; // Adjust for your file type
    const geminiResult = await uploadToGemini(fileBlob, mimeType);
    
    // 4. Process and print the Gemini response
    console.log('Gemini response:', geminiResult.response.text());
    
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Call the function to start the process
processDriveFileWithGemini();
Use code with caution.

For large files (over 20 MB)
For files over 20 MB, it is necessary to use the Files API's dedicated upload process, which is more robust than sending the file inline. 
Upload the file: Use the Gemini SDK's files.upload method.
Wait for processing: The Gemini API needs time to process the file.
Reference the file in generateContent: Use the file's URI returned by the upload to reference it in the prompt. 
Example using Gemini's Files API (Node.js):
javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function processLargeFileWithGemini(filePath, mimeType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Upload the file to Gemini's files storage
  const uploadResult = await genAI.files.upload({
    file: fs.createReadStream(filePath),
    config: { mimeType },
  });
  const file = uploadResult.file;

  console.log(`Uploaded file '${file.name}' as: ${file.uri}`);

  // Reference the uploaded file in your prompt
  const result = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent([
    { fileData: { uri: file.uri, mimeType } },
    'What can you tell me about the content of this file?',
  ]);

  console.log('Gemini response:', result.response.text());
}
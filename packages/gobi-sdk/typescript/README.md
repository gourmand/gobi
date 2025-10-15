# @gourmanddev/sdk

> **⚠️ EXPERIMENTAL: This package is in early development and subject to frequent breaking changes without notice.**

This SDK provides a drop-in replacement for OpenAI libraries to easily integrate with Gobi assistants.

## Installation

```bash
npm install @gourmanddev/sdk
```

## Usage

The SDK provides a `Gobi.from()` method that initializes an assistant and returns a client you can use as a drop-in replacement for the OpenAI SDK:

```typescript
import { Gobi } from "@gourmanddev/sdk";

// Initialize the Gobi client with your API key and assistant
const { client, assistant } = await Gobi.from({
  apiKey: process.env.GOBI_API_KEY,
  assistant: "owner-slug/assistant-slug", // The assistant identifier
});

// Use the client just like the OpenAI SDK
const response = await client.chat.completions.create({
  model: assistant.getModel("claude-3-7-sonnet-latest"), // Use the assistant's model
  messages: [
    { role: "system", content: assistant.systemMessage }, // Use the assistant's system message
    { role: "user", content: "Hello!" },
  ],
});

console.log(response.choices[0].message.content);
```

You can also use the SDK without specifying an assistant to just get the Gobi API client:

```typescript
import { Gobi } from "@gourmanddev/sdk";

// Initialize just the Gobi API client
const { api } = await Gobi.from({
  apiKey: process.env.GOBI_API_KEY,
});

// Make calls to the Gobi API
const assistants = await api.listAssistants({});
```

## API Reference

### Gobi.from(options)

Creates a Gobi instance with a pre-configured OpenAI client and assistant.

#### Options

- `apiKey` (string, required): Your Gobi API key
- `assistant` (string, optional): The assistant identifier in the format `owner-slug/assistant-slug`
- `organizationId` (string, optional): Optional organization ID
- `baseURL` (string, optional): Base URL for the Gobi API (defaults to `https://api.gourmand.dev/`)

#### Returns

When `assistant` is provided, returns an object containing:

- `api`: The Gobi API client for direct API access
- `client`: An OpenAI-compatible client configured to use the Gobi API
- `assistant`: The assistant configuration with utility methods

When assistant is not provided, returns an object containing:

- `api`: The Gobi API client for direct API access

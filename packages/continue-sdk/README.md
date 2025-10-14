# @gourmanddev/sdk

> **⚠️ EXPERIMENTAL: This package is in early development and subject to frequent breaking changes without notice.**

This SDK provides programmatic access to Gobi's Hub APIs and functionality.

## Overview

The Gobi SDK is structured into separate language-specific packages, currently with implementations for TypeScript and Python, with more languages planned for the future:

- **TypeScript SDK**: Located in the `/typescript` directory, providing a drop-in replacement for OpenAI's TypeScript client libraries
- **Python SDK**: Located in the `/python` directory, providing a drop-in replacement for OpenAI's Python client libraries
- **Additional languages**: More language implementations are planned to be added in the future

Each package includes:

1. OpenAPI-generated clients for the Gobi Hub API
2. A wrapper layer that exposes a `Gobi.from()` method to easily initialize and use Gobi assistants with an OpenAI-compatible interface

## For End Users

End users should install the published packages directly:

- For TypeScript/JavaScript: `npm install @gourmanddev/sdk`
- For Python: `pip install gourmand`
- For other languages: Check back for new language support

Each published package includes its own documentation.

## For Developers

### Development

```bash
# Install dependencies
npm install

# Generate API clients
npm run generate-client:ALL

# Start Swagger UI for API exploration
npm run swagger-ui
```

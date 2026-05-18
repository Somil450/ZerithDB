# Edge Computing Deployment Guide

This document describes how to deploy the ZerithDB signaling server to edge computing platforms for globally distributed, ultra-low latency signaling.

## Supported Platforms

- **Cloudflare Workers** - Global edge network with WebSocket support
- **Vercel Edge Functions** - Distributed edge computing with HTTP-based polling

## Prerequisites

```bash
cd infra/signaling-server
npm install
```

## Building

### Build All Platforms

```bash
npm run build
```

### Build Individual Platforms

```bash
# Node.js (default)
npm run build:node

# Vercel Edge
npm run build:edge

# Cloudflare Workers
npm run build:cloudflare
```

## Deployment

### Cloudflare Workers

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:

```bash
wrangler login
```

3. Deploy to production:

```bash
npm run deploy:cloudflare
```

For local development:

```bash
npm run dev:cloudflare
```

**Note:** Cloudflare Workers require a paid plan for WebSocket support. The free tier only supports HTTP-based long-polling.

### Vercel Edge Functions

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Deploy to production:

```bash
npm run deploy:edge
```

Vercel Edge Functions automatically deploy to multiple edge regions worldwide.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for validating room tokens | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | No |

## API Endpoints

All platforms support the same API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and server status |
| `/ws` | WebSocket | WebSocket connection for signaling (Cloudflare paid plan) |
| `/poll/join` | POST | Join via HTTP polling |
| `/poll/messages` | GET | Poll for messages |
| `/poll/send` | POST | Send message via polling |
| `/poll/leave` | POST | Leave room via polling |

## Architecture Notes

### Polling Behavior

**Node.js Server**: Supports true long-polling (30 second hold time)

**Edge Platforms (Cloudflare Workers, Vercel Edge)**:
- Uses short-polling due to platform execution time limits
- Client automatically handles repeated polling
- Recommended poll interval: 1-2 seconds
- The SDK automatically adjusts based on server response

### State Management

**Development**: In-memory state works for single-instance deployments

**Production**: For multi-instance deployments, use external state:
- **Cloudflare Workers**: Durable Objects (built-in)
- **Vercel Edge**: Redis (via Upstash or similar)
- **General**: Any Redis-compatible store

### WebSocket Support

- **Cloudflare Workers**: WebSocket requires paid plan ($5+/mo)
- **Vercel Edge**: No native WebSocket; use polling transport
- The SDK automatically falls back to polling when WebSocket unavailable

### Latency

Edge deployments provide:
- Sub-10ms latency in major metropolitan areas
- Automatic geographic distribution
- Built-in DDoS protection

## Zero-Config Deployment

The ZerithDB client automatically detects edge deployments. Configure your signaling URL:

```typescript
import { createApp } from "@zerithdb/sdk";

const app = createApp({
  sync: {
    signalingUrl: "https://your-edge-deployment.workers.dev",
  },
});
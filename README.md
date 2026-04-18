# PageOps Screenshot Tool (Electron)

## Features

- URL input
- Cookie / Token input (JSON: Headers + Cookies)
- Screenshot configuration (viewport / selector / delayMs)
- Call Screenshot API
  - POST `/api/v1/screenshots`
  - Async mode with auto polling GET `/api/v1/screenshots/{jobId}`
  - Handle common errors: 401 / 402 / 429, timeout, etc.
- Display thumbnail and download PNG/JPEG
- Local history (within current running session)

## Directory Structure

- `src/main/main.ts`: Electron Main (API calls, polling, download)
- `src/main/preload.ts`: Bridge (Renderer calls via `window.pageops.*`)
- `src/renderer/*`: React UI

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Start the app

```bash

npm run start
```

## Input Format

### Headers JSON (Object)
```
{ "Authorization": "Bearer xxx" }
```

### Cookies JSON (Array)
```json
[
{ "name": "sid", "value": "...", "domain": "example.com", "path": "/" }
]
```
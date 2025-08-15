# vishnu_cursor_app

Minimal Express app serving a static SPA and AI endpoint using Google Generative AI.

## Prerequisites
- Node >= 18.17
- Set `GEMINI_API_KEY` in your environment (see `.env.example`).

## Local run
```bash
cp .env.example .env  # edit GEMINI_API_KEY
npm install
npm start
# App runs on http://localhost:3000 (or $PORT)
```

## Deploy (Docker)
```bash
# Build
docker build -t vishnu-cursor-app .
# Run
docker run -e GEMINI_API_KEY=... -p 3000:3000 vishnu-cursor-app
```

## Deploy (Render)
- Create a new Web Service from this repo
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Add env var: `GEMINI_API_KEY`

## Deploy (Railway/Fly/Cloud Run)
Use the Dockerfile or set Start Command to `npm start`. Ensure `PORT` is provided by the platform and `GEMINI_API_KEY` is set.
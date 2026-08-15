# Parallax frontend

React/Vite editor for the Parallax project-scoped media agent.

## Run locally

Start the backend first on port 8080, then:

```bash
npm install
npm run dev
```

The frontend uses `http://localhost:8080` by default. Override it when needed:

```bash
VITE_API_URL=http://127.0.0.1:8080 npm run dev
```

## Connected workflow

1. Create or select a project in the top bar.
2. Upload video, audio, image, or subtitle files.
3. Click or drag media from the bin onto the timeline.
4. Ask Director to inspect or transform project files.
5. Generated media is refreshed into the same project's bin.

Project metadata and files are persisted by the Go backend. Timeline layout is
currently frontend session state and is not yet persisted.

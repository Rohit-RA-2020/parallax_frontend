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
5. Hover a bin item to delete it from the project. Timeline clips that used it
   are removed with the file.
6. Director applies edits to the current clip in the bin. Separate files appear
   only when you ask for an export, highlight, or extract.

Project metadata, media, and Director chats are persisted by the Go backend.
Each project can have multiple chats. Timeline layout is still session-only.

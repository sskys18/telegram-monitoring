# Code Conventions

- Runtime: **Bun** (not Node.js) — native TypeScript, no build step, no tsconfig.json
- Keep implementation in as few files as possible (single `src/index.ts` preferred)
- No unnecessary abstractions or helper modules
- Use `dotenv/config` for env, plain JSON files for state/config
- Auto-generated files (`session.json`, `channels.json`) go in project root, not committed to git

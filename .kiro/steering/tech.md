# Tech

- TypeScript strict mode throughout.
- Vite + React for the app; Vitest + fast-check for tests.
- Engine code in `src/engine` must have zero React or DOM imports.
- Do not add new runtime dependencies without justification.
- All LLM calls go through `/api/agent`.

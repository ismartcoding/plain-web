# Team Memory — plain-web

> Shared memory across all reins for this repo. Use narrowest-scope first: per-rein notes go in that rein's `memory/`; project-wide notes go here; cross-project lessons go to the global agent memory.

## Project rules (binding)

The full binding rule set lives in `.trae/rules/project_rules.md`. Highlights the team must enforce:

- **Single-agent, plan-then-execute.** No `mavis team plan` / parallel worker pool for this repo. Implementation happens in one context.
- **Plans live in `docs/`** with `- [ ]` checkboxes. Each completed sub-task flips its checkbox and adds a one-line "落地" note.
- **No comments in new code** unless the user explicitly asks.
- **`async-graphql` field names stay `snake_case`** — the framework auto-converts to `camelCase` on the wire. Don't add `#[graphql(name = …)]` to match Android spelling.
- **Resolver file routing** is fixed: `chat_query.rs`, `chat_message.rs`, `chat_channel.rs`, `chat_member.rs`.

## State as of 2026-06-07

- Working tree has uncommitted Rust changes — chat key migration (channel ChaCha20 key), `chat_helper` extraction, schema refactor, plus a local-mode upload fix. See `docs/chat-plain-app-alignment-plan.md` (P0–P3) for the canonical sub-task list.
- `src-tauri/src/local/server/upload.rs` and `src-tauri/src/local/graphql/schema/file_upload.rs` are untracked (new files). Treat them as draft until the user reviews.
- `src/lib/upload/upload.ts` has matching frontend changes for the local-mode upload flow. Coordinate with frontend before merging.

## Conventions discovered

- The user prefers terse output. No "I'll do X then Y" narration, no congratulations, no restating the question. Diff + one-line result is the expected reply shape.
- The user keeps the Kotlin reference (`plain-app`) as the source of truth for protocol behavior. When the Rust side and the Kotlin side diverge, Kotlin wins.
- The chat plan uses `[ ]` and `[x]` literally (markdown checkboxes), not GitHub task-list syntax. Preserve them as-is when editing.

## Things that have bitten us

- Renaming an async-graphql field by adding `#[graphql(name = "…")]` because the Kotlin side uses a different casing. The auto-conversion handles it; the rename attribute breaks the GraphQL schema docs.
- Editing `src/components/base/` styling to "modernize" it. The V-prefixed base components are a stable design system — feature components depend on the existing class shapes. Touch only when the user asks.
- Adding `///` doc comments to a new Rust helper "to be helpful". The user removed every one. Don't.

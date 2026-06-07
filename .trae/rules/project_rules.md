# Coding Rules

## Comments

- **Do not add comments** to new code unless the user explicitly asks for them.
  - No `//` line comments, no `///` / `//!` doc comments, no block comments.
  - No explanatory paragraphs above functions, no "mirrors …" headers, no
    step-by-step narration of the algorithm.
  - Code should speak for itself: prefer clear naming, small functions, and
    extracted helpers over prose.
- This applies to **all** new files and to all freshly written code in edited
  files. Pre-existing comments in untouched code are not in scope.
- If a piece of logic is genuinely non-obvious and the user requests it, a
  short comment may be added — but only when explicitly requested.

## Naming

- async-graphql field / query / mutation names follow Rust convention
  (`snake_case`) and the framework auto-converts them to `camelCase` on the
  wire. Do **not** hand-write `#[graphql(name = "leaveChatChannel")]` style
  renames just to match the Android spelling — the conversion is automatic.
- The `to_id` argument and the `peer:` / `channel:` prefix convention are
  part of the protocol — keep them stable.

## Code structure

- Keep GraphQL resolvers thin: parse args, call into `crate::local::db::*`
  or `crate::local::channel::sender::*`, emit a `WsEvent`, return the model.
  No business logic should live in the resolver body.
- New resolvers go in the file that matches the corresponding Android
  schema file: queries in `chat_query.rs`, message mutations in
  `chat_message.rs`, channel mutations in `chat_channel.rs`.

## Workflow

- **One agent, one task at a time.** Do not spawn a `mavis team plan` /
  parallel worker pool for this codebase — it burns tokens with little gain
  when the work is single-package Rust edits. The user runs everything in
  one context.
- **Plan before code.** For any non-trivial task, write or update a plan
  (in `docs/` if missing) before touching code. The plan enumerates each
  sub-task with target file, contract, and verification.
- **Update the plan as you go.** Each completed sub-task flips its
  checkbox (`- [ ]` → `- [x]`) and gets a one-line "落地" note describing
  the actual change. Never leave stale `[]` in a finished plan.
- **Stay in scope.** Do not refactor unrelated code, reformat untouched
  files, or add features the user did not ask for. If something adjacent
  looks broken, mention it in the final summary and stop.
- **Verify between steps.** Run `cargo check` (and `cargo test` when
  applicable) after every meaningful change. Do not stack 5 edits and
  then build once.
- **Keep responses tight.** No "I'll do X then Y then Z" narration, no
  re-stating the user's request, no congratulatory closings. The diff +
  a brief result line is enough. Ask one question only when a real
  blocking decision is pending.

## Communication

- No filler ("Sure!", "Great question!", "I hope this helps"). No
  bullet-point listings of capabilities. No restating the task back.
- The default answer to "should I open a popup / ask a question?" is no.
  Pick a reasonable default, surface the assumption in one line, move on.
- After delivering, slip in **at most one** light context question (role,
  focus area) only if it flows naturally. Skip otherwise.

# i18n Automation with GitHub Actions

This document describes the fully-automated Crowdin translation workflow for plain-web.
The setup mirrors plain-app. No manual operations on the Crowdin web UI are required after
the initial one-time setup.

---

## Overview

plain-web locale files are TypeScript modules (`src/locales/en-US.ts` as source, 16 target
locales). Because Crowdin works with JSON, two lightweight conversion scripts bridge the gap:

```
Developer pushes English strings to src/locales/en-US.ts
        ↓
[crowdin-upload.yml] triggers automatically
  → i18n-ts-to-json.mjs converts en-US.ts → .crowdin/en-US.json
  → Crowdin action uploads .crowdin/en-US.json
        ↓
Community translates on Crowdin
        ↓
[crowdin-sync.yml] (weekly / manual) pulls translations
  → Crowdin action downloads .crowdin/<locale>.json files
  → i18n-json-to-ts.mjs converts each .crowdin/<locale>.json → src/locales/<locale>.ts
  → PR opened: "chore(i18n): sync translations from Crowdin"
        ↓
Maintainer reviews & merges the PR
```

---

## Repository layout

| Path | Role |
|------|------|
| `crowdin.yml` | Crowdin CLI configuration — file mappings & language codes |
| `src/locales/en-US.ts` | English source (base locale) |
| `src/locales/<lang>.ts` | 16 translated locale files |
| `scripts/i18n-ts-to-json.mjs` | Convert `en-US.ts` → `.crowdin/en-US.json` for upload |
| `scripts/i18n-json-to-ts.mjs` | Convert downloaded `.crowdin/*.json` → `src/locales/*.ts` |
| `.crowdin/` | Staging directory (gitignored; created at CI runtime) |
| `.github/workflows/crowdin-upload.yml` | CI workflow that uploads English sources |
| `.github/workflows/crowdin-sync.yml` | CI workflow that pulls translations & opens a PR |

---

## One-time setup

### 1 · Create a Crowdin project

If the project does not yet exist on Crowdin:

1. Log in to [crowdin.com](https://crowdin.com) → **Create project**.
2. Choose **Files-based** project.
3. Copy the **Project ID** from the project settings page.
4. Paste it into `crowdin.yml` as `project_id`.

### 2 · Create a Crowdin Personal Access Token

1. Go to **Account settings → API → New token**.
2. Give it a descriptive name (e.g. `plain-web-ci`).
3. Grant the **Projects (source files & translations)** scope.
4. Copy the generated token — shown only once.

### 3 · Add the secret to GitHub

1. Open the repository on GitHub → **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name: `CROWDIN_PERSONAL_TOKEN`
4. Value: the token from step 2.

> `GITHUB_TOKEN` is provided automatically by GitHub and requires no extra setup.

---

## Workflow reference

### `crowdin-upload.yml` — Upload Sources

| Property | Value |
|----------|-------|
| Trigger | Push to `main` touching `src/locales/en-US.ts`; manual dispatch |
| Steps | `yarn install` → `i18n-ts-to-json.mjs` → Crowdin upload |
| Effect | Converts the TypeScript source to JSON and uploads it to Crowdin |

### `crowdin-sync.yml` — Sync Translations

| Property | Value |
|----------|-------|
| Trigger | Weekly cron (Monday 09:00 UTC); manual dispatch |
| Steps | `yarn install` → Crowdin download → `i18n-json-to-ts.mjs` → open PR |
| PR branch | `l10n/crowdin-translations` |
| PR labels | `i18n`, `automated` |

The sync workflow uses [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
(v7) to open the PR after converting downloaded JSONs back to TypeScript.

---

## How the conversion works

### `i18n-ts-to-json.mjs` — TypeScript → JSON

Uses the TypeScript compiler API (already a devDependency) to evaluate `en-US.ts` and serialize
its default export as `JSON.stringify`, writing to `.crowdin/en-US.json`. The `.crowdin/`
directory is gitignored and created fresh on each CI run.

### `i18n-json-to-ts.mjs` — JSON → TypeScript

Reads each `<locale>.json` downloaded by the Crowdin action into `.crowdin/` and writes the
corresponding `src/locales/<locale>.ts` file in the same `export default { … }` format used
throughout the project. Only locales with an existing `.ts` file are updated (new languages
must be explicitly opted into the project first).

---

## Day-to-day developer workflow

### Adding or changing English strings

1. Edit `src/locales/en-US.ts` as usual.
2. Open a PR and merge to `main`.
3. The **Upload Sources** workflow fires automatically.
   - New/changed keys appear in Crowdin within seconds.

### Shipping translations

1. Wait for the weekly **Sync Translations** workflow, **or** trigger it manually from
   **Actions → Crowdin — Sync Translations → Run workflow**.
2. Review the automatically-opened PR (`chore(i18n): sync translations from Crowdin`).
3. Merge — done.

---

## Supported locales

| File | Language |
|------|----------|
| `zh-CN.ts` | Chinese Simplified |
| `zh-TW.ts` | Chinese Traditional |
| `de.ts` | German |
| `fr.ts` | French |
| `es.ts` | Spanish |
| `it.ts` | Italian |
| `pt.ts` | Portuguese |
| `ru.ts` | Russian |
| `ja.ts` | Japanese |
| `ko.ts` | Korean |
| `nl.ts` | Dutch |
| `tr.ts` | Turkish |
| `vi.ts` | Vietnamese |
| `hi.ts` | Hindi |
| `ta.ts` | Tamil |
| `bn.ts` | Bengali |

---

## Troubleshooting

### The upload workflow fails with "Unauthorized"

Verify that `CROWDIN_PERSONAL_TOKEN` is set in GitHub repository secrets and that the token
has not been revoked.

### The upload fails with "project not found"

Check that `project_id` in `crowdin.yml` matches the numeric ID in your Crowdin project URL
and that the token has access to that project.

### The sync workflow opens an empty PR / no changes

No new translations have been submitted since the last sync. Trigger again after active
translation activity.

### Merge conflicts on the `l10n/crowdin-translations` branch

Re-run the **Sync Translations** workflow — `peter-evans/create-pull-request` force-pushes
the branch on every run.

### Translators need access to the project

Invite them via **Crowdin → Project → Members** or set the project visibility to **Public**
so anyone can suggest translations without an invitation.

---

## References

- [crowdin/github-action — official action](https://github.com/crowdin/github-action)
- [Crowdin CLI configuration docs](https://developer.crowdin.com/configuration-file/)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
- [Crowdin API — Personal Access Tokens](https://support.crowdin.com/personal-access-tokens/)

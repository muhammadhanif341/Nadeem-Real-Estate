# Nadeem Real Estate Consultant

## Purpose

A web application for Nadeem Real Estate Consultant to list, browse, and manage
property listings (buy/sell/rent) and connect prospective clients with the
consultancy.

## Architecture Overview

- `frontend/` — static client: `index.html`, `styles.css`, `app.js`. Renders
  listings and forms, calls the backend over HTTP.
- `backend/` — server-side API. Owns business logic, data validation, and
  persistence access. No secrets or credentials committed here.
- `data/` — data files (seed data, fixtures, exports). Not a database itself.
- `prompts/` — prompt templates used for any AI-assisted features.

Frontend talks to backend only through its API; backend is the only layer
that touches `data/` or any real datastore.

## Coding Rules

- Keep changes minimal and scoped to the current task — no speculative
  features, no premature abstractions.
- Match existing file/folder conventions above; don't introduce new top-level
  folders without a clear reason.
- No dead code, no commented-out blocks, no placeholder TODOs left behind.
- Comments only when the *why* isn't obvious from the code itself.
- Keep frontend and backend concerns separated; don't embed backend logic in
  `frontend/` or vice versa.

## Security Rules

- Never commit secrets, API keys, tokens, or credentials to any file in this
  repo, including `data/`.
- Validate and sanitize all user input on the backend; never trust
  client-side validation alone.
- Never expose internal error details, stack traces, or database details to
  the frontend.
- Any contact/lead-capture forms must guard against injection (SQL/XSS/etc.)
  per OWASP top 10 practices.

## Token-Saving Rules

- Read only the files relevant to the current task; don't re-read files
  already open in context.
- Prefer targeted edits over rewriting whole files.
- Avoid generating explanatory summaries or documentation unless asked.
- Don't re-derive project structure or conventions already documented here —
  refer to this file instead.

## Scope Rule

- Only modify the files strictly required for the current task. Do not
  touch unrelated files, folders, or configuration as a side effect.

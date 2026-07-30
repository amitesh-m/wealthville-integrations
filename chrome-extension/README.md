# Captcha Assistant

A Chrome (MV3) extension that notices captchas on any page and either solves them
automatically through a third-party solving service, or surfaces them to you in a
companion window so you can solve them without hunting for the blocked tab.

> **Status: scaffold.** Architecture and contracts are defined; no behaviour is
> implemented yet. See [`ROADMAP.md`](ROADMAP.md).

## What it does

- **Detects** reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, Arkose/FunCaptcha,
  GeeTest and (with per-site config) plain image captchas.
- **Automatic mode** submits the captcha to your configured solving service, then
  injects the token and triggers the site's callback. On a form you're filling in,
  the solve usually finishes before you reach the submit button.
- **Manual mode** opens a small always-available window listing tabs blocked on a
  captcha, with a thumbnail and a jump-to-tab button.
- **Switchable services** — 2Captcha, CapSolver, CapMonster, Anti-Captcha — chosen
  globally or per captcha type, with automatic failover.

## Honest limits

- Automatic solving takes **15–60 seconds**. When the captcha appears at page load
  it's usually invisible to you; when it appears *after* you hit submit, you will
  see that wait.
- **reCAPTCHA v3, Turnstile "managed" and Enterprise variants are score-based.** A
  token bought from a solving service is often scored on the provider's IP rather
  than yours and can be rejected even though it's valid. Automatic mode is
  best-effort here and falls back to manual.
- A live captcha widget **cannot be moved into another window**. Cross-origin
  iframes reject synthetic clicks, so manual mode brings you to the captcha rather
  than the captcha to you — unless you enable the optional CDP remote view, which
  shows a persistent "being debugged" banner on the tab.
- Solving services **charge per solve**. Automatic mode is opt-in per site so you
  don't spend credits on every page you happen to open.
- API keys are stored in `chrome.storage.sync`, which is **plaintext** to anything
  with access to your browser profile.

## Develop

```bash
npm install
npm run build      # -> dist/
npm run watch
npm run typecheck
npm test
```

Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

Design docs: [architecture](docs/ARCHITECTURE.md) ·
[captcha types](docs/CAPTCHA-TYPES.md) · [providers](docs/PROVIDERS.md).
Working notes for Claude Code: [`CLAUDE.md`](CLAUDE.md).

## Terms

Solving captchas on your own accounts, your own test environments, or for
accessibility reasons is ordinary use. Bulk-bypassing captchas on third-party
services generally violates both those services' terms and the solving providers'
terms. You are responsible for how you use this.

MIT licensed.

# Captcha Assistant — Chrome extension

An MV3 Chrome extension that detects captchas on any page and resolves them either
**automatically** (via a pluggable third-party solving service) or **manually**
(companion popup window that surfaces the blocked tab and hands it back to you).

Status: **scaffold**. Nothing is implemented yet — see `ROADMAP.md` for the build
order and pick up at the first unchecked phase.

## Hard constraints — read before designing anything

These are properties of the browser, not preferences. Code that ignores them will
appear to work in review and fail silently at runtime.

1. **You cannot synthesize a click into a cross-origin captcha iframe.** reCAPTCHA
   and hCaptcha check `event.isTrusted`, and a content script's `dispatchEvent`
   produces untrusted events. Any "screenshot the widget and replay my clicks"
   approach fails. Trusted input at the browser level requires `chrome.debugger` +
   CDP `Input.dispatchMouseEvent`. That is the only route, and it is behind an
   optional permission because it shows a persistent debugging banner.

2. **The MV3 service worker is killed after ~30s idle.** Solves take 15–60s. Never
   hold solve state in module-scope variables, and never `await` a long poll
   directly in the worker and expect to survive. State lives in
   `chrome.storage.session`; polling is driven by `chrome.alarms`.

3. **Captcha tokens expire — reCAPTCHA v2 is ~120 seconds.** A token pre-solved on
   page load is dead if the user takes three minutes on the form. Pre-solve must
   carry a refresh loop, and every refresh costs another paid solve.

4. **Injecting the token into the textarea is not sufficient.** Most sites read the
   token from their own callback, not the DOM. After writing
   `g-recaptcha-response` you must invoke the site's registered callback
   (`___grecaptcha_cfg.clients[...]` for reCAPTCHA, the equivalent for hCaptcha).

5. **Always verify the page accepted the token.** Confirm navigation happened or
   the captcha element is gone. Never blind-retry a solve — that burns credits and
   masks real failures.

6. **Score-based captchas are best-effort, not solved.** reCAPTCHA v3, Turnstile
   "managed", and Enterprise variants return a *reputation* score. A token minted
   from a provider's IP frequently scores below the site's threshold. Treat a
   low-score rejection as a normal outcome that falls back to manual, not a bug.

7. **No remote code.** Chrome Web Store policy and MV3 forbid executing remotely
   fetched code. All provider logic is bundled locally; providers are contacted
   over `fetch` for data only.

8. **Never auto-solve outside the user's allowlist.** Every solve costs money and
   consumes a captcha on the user's behalf. Default posture is ask/manual;
   automatic is opt-in per origin.

9. **Never log API keys, solve tokens, or page content.** Redact in all paths,
   including error handlers.

## Layout

```
src/
  manifest.json          MV3 manifest — permissions are deliberately narrow
  types.ts               core contracts (CaptchaTask, Provider, SolveState)
  background/
    orchestrator.ts      solve lifecycle state machine; alarm-driven polling
    providers/           one adapter per service, registry + failover
  content/
    detect.ts            MutationObserver + per-type fingerprints
    inject.ts            token injection + site callback invocation
  manual/                companion popup window (+ optional CDP screencast)
  options/               provider selection, keys, per-site policy
```

Detection fingerprints and per-type injection recipes: `docs/CAPTCHA-TYPES.md`.
Provider adapter contract and per-service API notes: `docs/PROVIDERS.md`.
Solve state machine and message flow: `docs/ARCHITECTURE.md`.

## Commands

```bash
npm install
npm run build      # esbuild -> dist/, copies manifest + static assets
npm run watch      # rebuild on change
npm run typecheck  # tsc --noEmit
npm test           # vitest — pure logic only (providers, state machine, parsers)
```

To load: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

Anything touching the DOM or the `chrome.*` APIs is verified by hand against a real
captcha, not by unit test. Keep that logic thin and push decisions into pure
functions that *are* testable.

## Conventions

- TypeScript, `strict: true`, ES2022 modules — matches the rest of this repo.
- No UI framework. Vanilla DOM in the popup and options pages.
- Provider adapters implement `Provider` from `types.ts` and are registered in
  `background/providers/index.ts`. Adding a service should mean adding one file
  and one registry line, nothing else.
- Errors that the user must act on (bad key, zero balance, provider down) surface
  through the badge and a notification. Everything else is logged and retried
  through the normal failover path.

## Scope note

This lives in the Wealthville integrations monorepo for now but shares no code with
the MCP server or the agent plugins. It is self-contained under `chrome-extension/`
and can be extracted to its own repository without untangling anything — keep it
that way.

## Legal

Solving captchas on your own accounts, your own test environments, or for
accessibility reasons is ordinary use. Bulk-bypassing captchas on third-party
services generally violates those services' terms and the solving providers' terms
alike. The README says this; keep it there.

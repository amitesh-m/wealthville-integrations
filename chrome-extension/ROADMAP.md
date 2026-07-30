# Build order

Phases are ordered so that something is testable end to end as early as possible.
Each is a reasonable single Claude Code session. Work top down; don't start a phase
with the previous one unverified against a real captcha.

## Phase 1 — detection only, no solving

`src/manifest.json` is written as the *target* manifest, so it already points at
`popup/popup.html`, `options/options.html` and `icons/icon128.png`. Those don't
exist yet — Chrome refuses to load an unpacked extension with missing references,
so creating them (even as empty stubs) is the first task here.

- [ ] `src/popup/popup.html`, `src/options/options.html`, `src/icons/icon128.png`.
- [ ] `content/detect.ts`: MutationObserver + fingerprints for reCAPTCHA v2 and
      hCaptcha (see `docs/CAPTCHA-TYPES.md`). Extract sitekey and pageurl.
- [ ] `background/orchestrator.ts`: receive `CAPTCHA_DETECTED`, write a `TaskRecord`
      to `chrome.storage.session`, set the badge.
- [ ] `popup/`: list currently-detected captchas across tabs.

**Done when**: opening a page with a reCAPTCHA lights the badge and the popup names
the captcha kind and sitekey. No provider involved yet.

## Phase 2 — one provider, manual trigger

- [ ] `types.ts` `Provider` implemented by `background/providers/twocaptcha.ts`.
- [ ] `options/`: provider selection + API key entry, stored in `chrome.storage.sync`.
- [ ] Alarm-driven poll loop. State machine through `submitted → polling → injected`.
- [ ] `content/inject.ts`: write token, invoke the site callback.
- [ ] A "Solve now" button in the popup as the trigger.

**Done when**: clicking "Solve now" on a real reCAPTCHA v2 page results in a form
that submits successfully. This is the phase that proves the whole idea works —
budget the most time here.

## Phase 3 — automatic mode

- [ ] Per-origin policy (`auto` / `manual` / `ask` / `off`) in options and storage.
- [ ] Auto-submit on detection when policy is `auto`.
- [ ] Pre-solve toggle, with the 100s staleness refresh loop.
- [ ] Submit interception: hold the form submit until the token lands, with an
      inline status chip so the page doesn't look frozen.
- [ ] Verification step — confirm the page actually moved on before marking
      `verified`.

**Done when**: on an allowlisted origin you can fill a form and submit without ever
looking at the captcha.

## Phase 4 — manual companion window

- [ ] `manual/`: popup window listing blocked tabs, cropped screenshot via
      `chrome.tabs.captureVisibleTab`, focus-and-scroll button.
- [ ] Detect user-completed captchas (response field populates) → `CAPTCHA_RESOLVED`.
- [ ] Notification when a task falls back to manual.
- [ ] Skip the popup entirely for `SCORE_BASED_KINDS` — there is nothing to show.

## Phase 5 — multi-provider

- [ ] Second adapter (CapSolver — best Turnstile coverage).
- [ ] Registry, `supports` filtering, ordered failover, terminal vs transient errors.
- [ ] Per-kind provider preference.
- [ ] Balance display.

## Phase 6 — coverage and polish

- [ ] Turnstile, Arkose, GeeTest detection + injection.
- [ ] Per-site rules for plain image captchas.
- [ ] Solve history and spend counter.
- [ ] Optional CDP remote view behind the `debugger` optional permission.
- [ ] Store listing: privacy policy, screenshots, justification for each permission.

## Not doing

- Bundled or built-in API keys. Users bring their own.
- Any "stealth" or anti-detection work. This is a convenience and accessibility
  tool for your own sessions, not an evasion tool.
- Auto-solving on origins the user hasn't opted in — cost and consent both.

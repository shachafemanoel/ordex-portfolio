# Guided demo release verification — 2026-11-08

## Build and automated domain checks

- Node.js 24.22.2; clean install using the committed lockfile and `npm ci --ignore-scripts`.
- `npm run build`: passed (TypeScript and Vite production build).
- `npm test`: **49 passed** across four files. Includes the 40 original browser-safe workflow tests and nine added guided/bench regression cases.
- Added cases cover date/payment combinations, summary/gate/domain parity, actual-action guide progression, optional installation, held and cancelled station handling, and proportional payment display.
- The enclosing full-system `package.json` has a pre-existing duplicate `demo` script key. Vite/Vitest emit a warning when reading that parent file; this release does not edit that unrelated file. The AppDeploy project is standalone.

## Browser verification actually performed

Used Codex's in-app browser against the local preview. These were direct UI checks, not a Playwright CLI run:

1. **Guided completion and handoff — passed.** Entered from the landing page, advanced to processing, observed blocked readiness, prepared items, advanced to ready, and verified dispatch count 0. Set a date through the native date control; payment remained missing. Marked payment in the demo; the gate opened and dispatch count became 1. Departed, completed directly from transit, and opened the creation form in free exploration while keeping the completed order.
2. **Mobile creation and filters — passed.** Empty customer name and zero amount were rejected by native form validation. Created a fictional order for 450 ILS, found it using search, combined search with a nonmatching status, observed the empty state, and cleared filters. Mobile queue/detail switching worked. Escape closed the form and returned focus to its trigger.
3. **Hold, resume, cancellation — passed.** Empty reasons blocked confirmation. A reason enabled hold, the bench reflected the held state, and resume restored the prior status. Cancellation required a reason, recorded it in history, disabled editing and removed further transitions.
4. **Responsive, reduced motion and keyboard — passed within tested scope.** Inspected actual CSS widths 375, 390, 768 and 1280 without horizontal page overflow. At phone widths the primary action remained within the viewport. With reduced motion enabled, tabbed through the controls and activated the next action using Return; guidance and textual bench status updated. Restored emulated media after the test.
5. **Reset, reload and route navigation — passed.** Reset restored three original orders. A payment marker was discarded on reload. Brand navigation and browser Back returned to the intended hash route. No uncaught frontend errors were reported; the observed network requests were same-origin development files and a browser-generated date-picker data URI, with no external provider calls.

## Reusable acceptance suites

- `tests/tests.json` contains five independent AppDeploy scenarios with nonempty coverage and exactly one sanity scenario.
- `tests/e2e/demo.spec.ts` contains the equivalent five Playwright scenarios for subsequent automated runs. The Playwright CLI suite was **not executed in this release session**; the direct in-app browser checks above are the browser evidence.
- AppDeploy deployment and live smoke results are recorded below after publication.

## Limits

No real payment, store connection, outbound messages, server authorization, administrator override, persistence or production customer data is involved. No actual-phone session, screen-reader audit, full WCAG compliance audit or production-system acceptance test was performed. Visual motion was inspected, not benchmarked for device performance.

## Hosted release

- AppDeploy reports **ready**, version `1794156813329`, with empty frontend/backend/runtime/network error lists. The preceding working release is `1794149841913` for rollback.
- Public URL: https://ordex-demo-ju11d2.v2.appdeploy.ai/
- Verified the supplied logo loads at 596 × 166, guided progression, missing-preparation guard, closed gate with date but no payment, open gate and dispatch count 1 after payment, departure, direct completion, and creation of a fourth order in free exploration.
- At CSS 390 × 844 on the public deployment, queue/detail switching worked, there was no page overflow, and the primary action occupied y=754–801 within the viewport. Reset restored the clean initial state. No frontend console errors were observed.
- AppDeploy injects its own hosting overlay, warm-up request, `/p` request and platform favicon. These hosting requests were observed and are explicitly distinguished from application business integrations. The hosted page is not claimed to make zero cross-origin requests. The reusable browser suite allows only these observed platform paths when targeting this AppDeploy host.
- The cloud build uses `appdeploy.package.json`, excludes local test-runner dependencies, and uses relative TypeScript paths without `baseUrl`. The logo is transferred as a validated PNG resource because the platform rejects SVG uploads. No custom favicon was added.

Hosted evidence: [landing](live-landing.png), [completed guide](live-completed.png), [phone-width landing](live-mobile.png).

The final packaging pass preserves the complete Anatomy MIT notice in the minified production JavaScript (verified in the built asset). It changes build attribution only; the public end-to-end UI walkthrough above used the same application code at version `1794156109980`.

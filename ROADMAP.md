# Roadmap

Where this project is headed and what to pick up next. Work the top unchecked
item first. When something ships, check it off and move it to Done with the date.
Keep items small enough to land as one focused PR.

## Goal

Make this a small SRE tool I'd actually leave running against a real project:
clean repo, tested incident de-duplication (the core logic), an alert channel
that doesn't require Gmail OAuth ceremony, and screenshots that show the loop
working end to end. It started as a TypeScript learning project — the goal now
is to make it trustworthy, not bigger.

## Next up

- [ ] Feed recent deploy/commit context into the LLM analysis so root-cause
      suggestions can point at the change that likely broke things.

## Later

- [ ] Multi-project support (poll several Vercel projects, tag incidents).
- [ ] Track LLM analysis accuracy: was the suggested fix right? A simple
      thumbs up/down on resolved incidents.

## Done

- [x] Screenshots in the README: the dashboard, an incident with its LLM
      analysis, and the alert email with the approve/dismiss links
      (`docs/screenshots/`). Static PNGs rather than a GIF — the loop is
      three states, not motion, and a GIF costs more to keep current. Getting a
      dashboard worth showing meant `seed-incident.js` needed more than one row,
      so it now seeds three incidents across P0/P1/P2 and open/notified/dismissed.
      Everything is fixture data — `prisma db push` then `node seed-incident.js`
      reproduces the exact screenshots with no Vercel token and no LLM key.
      (2026-08-10)
- [x] Hardened the action tokens. Minting and redemption moved out of the two
      route handlers into `src/lib/approval-token.ts`, so they test without the
      Prisma client (same trick as `signature.ts`). The expiry and single-use
      checks were already there but were a read-then-write: two clicks on the
      same link could both pass the `usedAt` check and both fire a redeploy.
      Redemption is now a conditional `updateMany` on `usedAt: null` +
      unexpired, and only a `count` of 1 counts as a claim.
      `approval-token.test.ts` covers the replay case the item asked for, plus
      two simultaneous claims racing (exactly one wins), expiry, a token aimed
      at another incident, and an unknown token. The `action` column now starts
      at `pending` and records which link was actually clicked — the approve
      route used to reject anything not already marked `approve` while the
      dismiss route quietly rewrote it. (2026-08-03)
- [x] Slack webhook as an alert channel alongside Gmail. `src/lib/slack.ts`
      posts a Block Kit message (summary, likely causes, approve/dismiss link
      buttons) to `SLACK_WEBHOOK_URL` — one env var, no OAuth; unset falls back
      to a console log, same as Gmail. The agent now fires both channels via
      `Promise.allSettled` so one failing doesn't block the other or stop the
      incident being marked notified. Split the payload into a pure
      `buildSlackMessage` so `slack.test.ts` asserts the button URLs, cause
      rendering, and title truncation with no network. (2026-07-18)
- [x] CI: typecheck + lint + tests on push (`.github/workflows/ci.yml`, runs on
      push and PR). Getting the checks green meant clearing the debt they
      surfaced: a real `bigint`/`number` mismatch in `agent.ts`, ~20 `no-explicit-any`
      lint errors (mostly `catch (error: any)` and untyped fetch state — replaced
      with a shared `src/lib/types.ts` for the incident shapes), a `@ts-ignore`
      that should have been `@ts-expect-error`, and unescaped quotes in JSX. Left
      the unused-import warnings alone — they don't fail the build. (2026-07-14)
- [x] Tests for the incident-signature/de-dup logic. Moved `generateSignature`
      and `redactMessage` out of `src/lib/incident.ts` into `src/lib/signature.ts`
      so they test without dragging in the Prisma client, then added
      `signature.test.ts` (vitest): same error groups, different stack doesn't,
      numeric ids and UUIDs collapse, path is part of the key, and the 500-char
      cap groups long stacks that share a head. Writing them surfaced one real
      quirk — a number glued to letters (`1200ms`) isn't normalized because
      `\b\d+\b` needs a boundary on both sides. (2026-07-11)
- [x] Repo hygiene: removed the committed SQLite files (`dev.db`,
      `prisma/dev.db`) and the one-off `test-db.js` script, gitignored the db
      paths, documented `prisma db push` as the setup step. (2026-07-08)

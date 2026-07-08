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

- [ ] Tests for the incident-signature/de-dup logic in `src/lib/incident.ts`
      — same error twice groups, different stack doesn't, boundary cases.
      This is the logic the whole tool rests on.
- [ ] CI: typecheck + lint + tests on push.
- [ ] Slack webhook as an alert channel alongside Gmail — one env var instead
      of OAuth setup, which makes the project runnable by anyone in minutes.
- [ ] Harden the action tokens: expiry and enforced single-use on the
      approve/dismiss links, with a test proving a replayed token fails.
- [ ] Screenshots (or a short GIF) of the incident dashboard and the alert
      email in the README — this project demos visually or not at all.

## Later

- [ ] Feed recent deploy/commit context into the LLM analysis so root-cause
      suggestions can point at the change that likely broke things.
- [ ] Multi-project support (poll several Vercel projects, tag incidents).
- [ ] Track LLM analysis accuracy: was the suggested fix right? A simple
      thumbs up/down on resolved incidents.

## Done

- [x] Repo hygiene: removed the committed SQLite files (`dev.db`,
      `prisma/dev.db`) and the one-off `test-db.js` script, gitignored the db
      paths, documented `prisma db push` as the setup step. (2026-07-08)

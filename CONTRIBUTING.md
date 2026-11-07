# Contributing

Project start: 2026-10-04. Read `docs/TEAM_RESPONSIBILITY_MATRIX.md` and `docs/architecture/OVERVIEW.md` first.

## Branches
`main` (stable) and `develop` (integration). Every task uses a short-lived branch from the latest `develop`:
`feature|fix|test|docs|refactor|chore/<member-or-area>/<short-description>`, e.g. `feature/member-3/location-update-api`.

## Workflow
1. `git fetch origin --prune`, update `develop`, create your task branch.
2. Implement one task only; add or update tests.
3. Run lint, tests and build; inspect `git diff` and `git diff --check`.
4. Stage specific files (not `git add .`), then commit.
5. Push and open a PR to `develop`. The project manager (`adithyasandew`) reviews; CI must pass.
6. Never force-push shared branches or rewrite published history.

## Commits
Conventional Commits: `<type>(<scope>): <imperative description>` with types feat, fix, docs, style, refactor, test, chore, build, ci, perf. One coherent change per commit.
Each commit is authored by the member who did the work, using their own `user.name` and verified `user.email`. Verify with `git log -1 --format='%h %an <%ae>'`.

## Rules
- Never commit secrets or real `.env` files; commit `.env.example` only.
- Use synthetic seed data. No real payments or personal data.
- Follow `docs/api/API_CONTRACT.md`; change the contract before changing an endpoint.
- Backend is the source of truth; validate and authorize every protected operation.

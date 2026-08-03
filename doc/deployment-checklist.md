# Deployment Checklist

[← Documentation index](../README.md#documentation)

## Pre-deployment

- [ ] `bun run lint` clean
- [ ] `bun run build` succeeds
- [ ] Manual regression pass completed ([workflow.md](./workflow.md#testing-workflow))
- [ ] `CHANGELOG.md` updated and versioned
- [ ] Documentation updated for every behavioural change
- [ ] No secrets or credentials committed
- [ ] Environment variables reviewed against `.env.example`
- [ ] Scoring weight changes, if any, flagged as breaking

## Deploy

- [ ] Merge `develop` → `main`
- [ ] Tag `vX.Y.Z`
- [ ] Publish the deployment

## Post-deployment verification

- [ ] `/` loads and the map renders
- [ ] State and LGA selection resolves a boundary
- [ ] Facilities load for a known dense area and a known sparse area
- [ ] Nearest-facility search returns results
- [ ] Navigation returns a route with steps
- [ ] `/quality` scores, charts and filters all work
- [ ] All four exports download and open
- [ ] Editor deep links open the correct feature
- [ ] Hard refresh on both routes shows no hydration errors
- [ ] Mobile viewport usable
- [ ] Browser console free of errors
- [ ] Page metadata and social preview correct

## Rollback

If verification fails, redeploy the previous tag immediately, then diagnose on `develop`. Do not attempt forward fixes directly against production.

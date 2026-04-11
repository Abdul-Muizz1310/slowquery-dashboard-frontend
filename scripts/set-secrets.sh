#!/usr/bin/env bash
# Push GitHub Actions secrets for this repo.
#
# Stub — filled in at S5 once we know which secrets Vercel + CI need.
# Likely candidates: VERCEL_TOKEN (for optional CLI-driven previews).
#
# Until then, CI on the empty project needs no repo-level secrets — everything
# runs from public npm + the hard-coded NEXT_PUBLIC_API_URL in ci.yml.
set -euo pipefail

REPO=Abdul-Muizz1310/slowquery-dashboard-frontend
echo "No secrets to set yet for ${REPO}. See S5 in docs/PLAN.md."

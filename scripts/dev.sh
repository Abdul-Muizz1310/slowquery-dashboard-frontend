#!/usr/bin/env bash
# Local dev startup.
#
# Expects pnpm 10, Node 24, and a populated .env.local (copy .env.example).
# Points the dashboard at the live Render backend by default; override
# NEXT_PUBLIC_API_URL in .env.local if you're running slowquery-demo-backend
# locally on http://localhost:8000.
set -euo pipefail

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example — edit if you need non-defaults."
fi

pnpm install
pnpm dev

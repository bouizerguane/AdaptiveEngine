#!/usr/bin/env bash
set -euo pipefail

echo "Seeding AdaptiveEngine E2E test data..."
node e2e-validation/e2e-test-data/seed-e2e-data.mjs

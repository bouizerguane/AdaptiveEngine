#!/usr/bin/env bash
set -euo pipefail

echo "Running AdaptiveEngine E2E validation..."
node e2e-validation/run-e2e-validation.mjs

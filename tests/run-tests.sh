#!/bin/bash
# Run playwright tests from the e2e directory
cd "$(dirname "$0")"
npx playwright test "$@"

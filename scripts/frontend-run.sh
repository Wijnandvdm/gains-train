#!/usr/bin/env bash
# Run a command inside frontend/ using the Node version from frontend/.nvmrc.
# Used by pre-commit hooks: git hooks often don't have nvm's Node on PATH, and
# a system Node may be too old. Arguments like "frontend/src/x.tsx" are made
# relative to frontend/.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "$nvm_sh" ]; then
  # shellcheck disable=SC1090
  . "$nvm_sh"
  # Where nvm doesn't have that version (e.g. GitHub's runners, which have nvm but get Node
  # from setup-node), keep the Node that's already on the PATH.
  nvm use --silent >/dev/null 2>&1 || true
fi

exec "${@/#frontend\//}"

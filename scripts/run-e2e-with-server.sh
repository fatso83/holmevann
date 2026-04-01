#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_LOG="$(mktemp "${TMPDIR:-/tmp}/holmevann-netlify-dev.XXXXXX.log")"
NETLIFY_HOME="$(mktemp -d "${TMPDIR:-/tmp}/holmevann-netlify-home.XXXXXX")"
SERVER_PID=""

server_is_healthy() {
  curl --silent --fail --max-time 2 http://localhost:8888/ >/dev/null
}

wait_for_server() {
  for _ in $(seq 1 60); do
    if server_is_healthy; then
      return 0
    fi

    sleep 0.5
  done

  return 1
}

cleanup() {
  local exit_code=$?

  if [[ -n "${SERVER_PID}" ]]; then
    if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
      kill "${SERVER_PID}" >/dev/null 2>&1 || true
      wait "${SERVER_PID}" >/dev/null 2>&1 || true
    fi
  fi

  if [[ ${exit_code} -ne 0 && -s "${SERVER_LOG}" ]]; then
    echo "Netlify dev log:" >&2
    tail -n 100 "${SERVER_LOG}" >&2 || true
  fi

  rm -f "${SERVER_LOG}"
  rm -rf "${NETLIFY_HOME}"
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"

if ! server_is_healthy; then
  if ! command -v netlify >/dev/null 2>&1; then
    echo "netlify CLI is required to start the local verification server" >&2
    exit 1
  fi

  HOME="${NETLIFY_HOME}" netlify dev --no-open >"${SERVER_LOG}" 2>&1 &
  SERVER_PID=$!

  if ! wait_for_server; then
    echo "Timed out waiting for http://localhost:8888/ to become healthy" >&2
    exit 1
  fi
fi

PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:8888}" \
  make test-e2e

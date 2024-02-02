#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")/.."

URL='https://raw.githubusercontent.com/chromium/chromium/master/net/http/transport_security_state_static.json'

preload="$(
  curl "$URL" |
    sed 's/^\s*\/\/.*$//' |
    jq '[.entries[] | select(.policy == "public-suffix") | .name]'
)"

echo "$preload" >src/preload.json

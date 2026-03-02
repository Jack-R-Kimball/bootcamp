#!/usr/bin/env bash
# Rebuild and restart the local dashboard container.
# Run this after making any code changes.
set -e
cd "$(dirname "$0")"

source ~/.nvm/nvm.sh
npm run build
podman build -t ghcr.io/jack-r-kimball/link-dashboard:latest .
podman-compose down
podman-compose up -d
echo "Dashboard updated and running at http://localhost:4321"

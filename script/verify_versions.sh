#!/bin/bash

v1=$(jq -r '.version' package.json)
v2=$(jq -r '.version' frontend/package.json)
v3=$(jq -r '.version' tauri/src-tauri/tauri.conf.json)

echo "Root version: $v1"
echo "Frontend version: $v2"
echo "Tauri version: $v3"

if [ "$v1" != "$v2" ] || [ "$v1" != "$v3" ]; then
  echo "❌ Version numbers are NOT consistent across all files!"
  exit 1
fi

echo "✅ All version numbers are consistent!"

#!/bin/zsh
# 在项目目录启动服务；已有本地实例时直接打开学习页。
cd "$(dirname "$0")"
if curl --silent --fail http://127.0.0.1:8765/ >/dev/null 2>&1; then
  open http://127.0.0.1:8765/
  exit 0
fi
node server.mjs &
listening_server_pid=$!
trap 'kill "$listening_server_pid" 2>/dev/null' EXIT INT TERM
for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:8765/ >/dev/null 2>&1; then
    open http://127.0.0.1:8765/
    wait "$listening_server_pid"
    exit $?
  fi
  sleep 0.2
done
print '启动失败，请检查 Node.js 或 8765 端口。'

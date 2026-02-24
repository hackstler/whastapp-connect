#!/bin/bash
SESSION_PATH=$(grep -E '^SESSION_PATH=' .env 2>/dev/null | cut -d= -f2)
SESSION_PATH=${SESSION_PATH:-.wwebjs_auth}
rm -rf "$SESSION_PATH"
echo "Sesión eliminada: $SESSION_PATH"

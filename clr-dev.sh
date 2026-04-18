#!/bin/bash
# clr-dev.sh — Clean up ainative dev server processes
# Kills next dev, next-server children, and checks for DB locks

DB_PATH="$HOME/.ainative/ainative.db"
FOUND=0

# 1. Kill "next dev" parent processes
NEXT_DEV_PIDS=$(pgrep -f "next dev" 2>/dev/null)
if [ -n "$NEXT_DEV_PIDS" ]; then
  echo "Found next dev processes:"
  ps -p "$NEXT_DEV_PIDS" -o pid,command 2>/dev/null | tail -n +2
  kill $NEXT_DEV_PIDS 2>/dev/null
  echo "  → killed"
  FOUND=1
fi

# 2. Kill surviving "next-server" child processes
NEXT_SERVER_PIDS=$(pgrep -f "next-server" 2>/dev/null)
if [ -n "$NEXT_SERVER_PIDS" ]; then
  echo "Found next-server processes:"
  ps -p "$NEXT_SERVER_PIDS" -o pid,command 2>/dev/null | tail -n +2
  kill $NEXT_SERVER_PIDS 2>/dev/null
  echo "  → killed"
  FOUND=1
fi

# 3. Check for DB locks
if [ -f "$DB_PATH" ]; then
  DB_LOCKS=$(lsof "$DB_PATH" 2>/dev/null)
  if [ -n "$DB_LOCKS" ]; then
    echo "DB lock holders on $DB_PATH:"
    echo "$DB_LOCKS" | tail -n +2
    echo "  → warning: DB may still be locked by above processes"
    FOUND=1
  fi
fi

# 4. Final status
if [ "$FOUND" -eq 0 ]; then
  echo "No ainative dev server processes found."
else
  echo "Cleanup complete."
fi

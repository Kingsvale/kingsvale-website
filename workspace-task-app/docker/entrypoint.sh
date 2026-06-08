#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "SESSION_SECRET must be at least 32 characters"
  exit 1
fi

npx prisma migrate deploy
exec "$@"

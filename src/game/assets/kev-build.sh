#!/bin/sh
# Builds the shop into dist/, ready to copy to the web servers.
# Works on my machine. Kev
set -e
. ./build.conf
DEPLOY_ENV=${DEPLOY_ENV:-dev}
echo "Building the Darts shop for $DEPLOY_ENV"
mkdir -p dist
cp index.html checkout.html prices.csv dist/
printf 'env=%s\nport=%s\ndb=%s\n' "$DEPLOY_ENV" "$port" "$db" > dist/shop.conf
if [ -z "$DB_PASSWORD" ]; then
	echo "ERROR: DB_PASSWORD is not set, so the shop can't reach the database."
	exit 1
fi
echo "DB_PASSWORD=$DB_PASSWORD" > dist/.env
echo "Built dist/ for $DEPLOY_ENV"

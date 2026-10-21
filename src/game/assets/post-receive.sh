#!/bin/sh
# GitBit tells Jonkins about every push to main.
while read -r old new ref; do
	[ "$ref" = refs/heads/main ] || continue
	[ -n "$JONKINS_SKIP" ] && continue
	echo "Jonkins: build queued. Watch it in the Jonkins panel."
	setsid /usr/local/bin/jonkins-build "$new" </dev/null >/dev/null 2>&1 &
done

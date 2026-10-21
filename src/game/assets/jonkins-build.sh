#!/bin/bash
# Jonkins: builds a commit pushed to GitBit by running the sh steps in its
# Jonkinsfile, stage by stage. GitBit's post-receive hook starts it in the
# bare repo. Runs and console logs go to /var/lib/desk/jonkins, where the
# desk's Jonkins panel reads them.
#
# It reads the same declarative shape as a real Jenkinsfile, but understands
# only stage('...'), sh '...', and NAME = 'value' or NAME = credentials('id').
rev=$1
repo=$PWD
unset GIT_DIR
J=/var/lib/desk/jonkins
CREDS=/var/lib/jonkins/credentials

# One build at a time, like a single build agent.
until mkdir "$J/.lock" 2>/dev/null; do sleep 1; done
n=$(cat "$J/next" 2>/dev/null)
n=${n:-1}
echo $((n + 1)) > "$J/next"
info=$(git --git-dir="$repo" log -1 --format='%h|%an|%s' "$rev")
{ echo "$n|RUNNING|$info"; cat "$J/runs" 2>/dev/null; } > "$J/runs.new"
mv "$J/runs.new" "$J/runs"

log=$J/$n.log
ws=$J/workspace
rm -rf "$ws"
mkdir -p "$ws"
git --git-dir="$repo" archive "$rev" | tar -x -C "$ws"
{
	echo "Started by a push to GitBit"
	echo "Checking out commit ${info%%|*}: ${info##*|}"
} > "$log"

status=SUCCESS
steps=()
secrets=()
stage=
if [ ! -f "$ws/Jonkinsfile" ]; then
	echo "ERROR: There is no Jonkinsfile in this commit, so Jonkins doesn't know what to build." >> "$log"
	status=FAILURE
else
	while IFS= read -r line || [ -n "$line" ]; do
		l=${line#"${line%%[![:space:]]*}"}
		l=${l%"${l##*[![:space:]]}"}
		case $l in
		stage\(*)
			stage=${l#stage(}
			stage=${stage%%)*}
			stage=${stage//[\'\"]/}
			;;
		sh\ *)
			c=${l#sh }
			c=${c#[\'\"]}
			c=${c%[\'\"]}
			steps+=("$stage"$'\t'"$c")
			;;
		[A-Z_]*=*)
			name=${l%%=*}
			name=${name%% *}
			val=${l#*=}
			val=${val#"${val%%[![:space:]]*}"}
			case $val in
			credentials\(*)
				id=${val#credentials(}
				id=${id%%)*}
				id=${id//[\'\"]/}
				if [ -r "$CREDS/$id" ]; then
					v=$(cat "$CREDS/$id")
					export "$name=$v"
					secrets+=("$v")
				else
					echo "ERROR: Jonkins has no credentials with the ID '$id'." >> "$log"
					status=FAILURE
				fi
				;;
			*)
				val=${val#[\'\"]}
				val=${val%[\'\"]}
				export "$name=$val"
				;;
			esac
			;;
		esac
	done < "$ws/Jonkinsfile"
	if [ $status = SUCCESS ] && [ ${#steps[@]} -eq 0 ]; then
		echo "ERROR: The Jonkinsfile has no stages with sh steps, so there is nothing to run." >> "$log"
		status=FAILURE
	fi
fi

# Like the real thing, Jonkins hides credentials in the console.
mask() {
	local t s
	t=$(cat "$1")
	for s in "${secrets[@]}"; do
		[ -n "$s" ] && t=${t//"$s"/****}
	done
	printf '%s\n' "$t"
}

last=
for s in "${steps[@]}"; do
	[ $status = SUCCESS ] || break
	st=${s%%$'\t'*}
	c=${s#*$'\t'}
	if [ "$st" != "$last" ]; then
		echo "[Pipeline] stage: $st" >> "$log"
		last=$st
	fi
	echo "+ $c" >> "$log"
	(cd "$ws" && sh -c "$c") > "$J/.out" 2>&1
	rc=$?
	[ -s "$J/.out" ] && mask "$J/.out" >> "$log"
	if [ $rc -ne 0 ]; then
		echo "ERROR: script returned exit code $rc" >> "$log"
		status=FAILURE
	fi
done
echo "Finished: $status" >> "$log"
if [ -x "$ws/build.sh" ]; then echo yes; else echo no; fi > "$J/$n.exec"

while IFS= read -r r; do
	if [ "${r%%|*}" = "$n" ]; then r="$n|$status|${r#*|RUNNING|}"; fi
	printf '%s\n' "$r"
done < "$J/runs" > "$J/runs.new"
mv "$J/runs.new" "$J/runs"
rmdir "$J/.lock"

/**
 * Sprint 1: Onboarding. The tickets, the chat script and the checks.
 * See docs/DESIGN.md for the design. Every check reads the VMs' real files.
 */
import { readState, type Sprint } from './types';

const norm = (v: string) => v.trim().toLowerCase();

/** Brant's fixed nginx config, waiting in the player's handover folder. */
const FIXED_NGINX = `# Darts shop. Fixed by Brant, Friday 18:20. Copy to web02 and restart nginx.
server {
    listen 80;
    root /srv/darts-shop;
    index index.html;
}
`;

export const sprint1: Sprint = {
	number: 1,
	title: 'Onboarding',
	servers: [
		{ name: 'web01', ip: '10.5.0.21/24', terminal: true, setup: '' },
		{ name: 'web02', ip: '10.5.0.22/24', setup: '' },
	],
	intro: [
		{ from: 'Derek', text: 'Morning, {name}! Welcome to Darts Unlimited. Brant will show you round.' },
		{ from: 'Brant', text: 'Auto-reply: I am out of the office until Monday. For anything urgent, see man.' },
		{
			from: 'Derek',
			text: "Right. Your tickets are in Jeera, top left. You're logged in to web01 in the terminal. Sprint ends Friday. No pressure.",
		},
	],
	done: [{ from: 'Derek', text: "That's everything? On your first week? Sprint review, my office, now." }],
	tickets: [
		{
			id: 'DART-101',
			title: "Reset my password, I'm locked out",
			from: 'Sandra',
			points: 1,
			body: [
				"I've been locked out of web01. My username is sandra.",
				'Please set me a new password (anything you like, tell me later) and unlock my account.',
			],
			steps: [
				{
					text: "Changing another user's password needs root, so the command starts with sudo. When sudo asks for a password, type yours: Welcome1. Nothing shows on screen while you type a password.",
				},
				{
					text: "Set Sandra's new password. passwd asks for it twice. Setting a new password also removes the lock.",
					cmd: 'sudo passwd sandra',
					done: async (vms) => (await sandraState(vms.web01)) === 'reset',
				},
				{ text: 'Press Check my work.' },
			],
			opened: "Thanks for looking. I've screenshotted the error if you need it. I've screenshotted everything.",
			thanks: "I'm in! I'll write the password on a sticky note. Joking. Mostly.",
			check: async (vms) => {
				const state = await sandraState(vms.web01);
				if (state === 'gone') return { ok: false, message: 'The sandra account has gone. Reload the page to put it back.' };
				if (state === 'locked') return { ok: false, message: "Sandra's account is still locked." };
				if (state === 'unchanged') return { ok: false, message: "The account is unlocked, but Sandra's password hasn't changed." };
				return { ok: true, message: 'Sandra has a new password and her account is unlocked.' };
			},
		},
		{
			id: 'DART-102',
			title: 'Disk filling up on web01',
			from: 'Monitoring',
			points: 3,
			body: [
				'ALERT: the /var/log filesystem on web01 is over 95% full. When it fills up, the shop stops logging and then stops working.',
				'Find what is using the space and free it. The shop app is running, so be careful what you delete.',
			],
			steps: [
				{ text: 'See how big the filesystem is, and how full.', cmd: 'df -h /var/log' },
				{ text: 'Find what is using the space. Sizes are in KB, biggest last.', cmd: 'du -a /var/log | sort -n | tail -5' },
				{
					text: "The darts-shop app has that log open, so empty it rather than deleting it. Use your password, Welcome1, if sudo asks.",
					cmd: 'sudo truncate -s 0 /var/log/darts-shop/debug.log',
					done: async (vms) => (await vms.web01.readFile('/var/lib/desk/debug.log.state'))?.trim() === 'empty',
				},
				{ text: 'Check the space is back, then press Check my work.', cmd: 'df -h /var/log' },
			],
			opened: 'ALERT acknowledged by you. (Nobody else ever acknowledges alerts.)',
			thanks: 'RECOVERY: /var/log on web01 is back below 10%.',
			check: async (vms) => {
				// The darts-shop app (see setup) reports its log's state every 2 s.
				const state = await readState(vms.web01, '/var/lib/desk/debug.log.state', 'full');
				if (state === 'deleted')
					return {
						ok: false,
						message:
							"You deleted debug.log, but run df -h /var/log: it's still full. The darts-shop app still has the file open, so Linux can't free the space until the app stops. Reload the page to put things back, and empty the file instead.",
					};
				if (state === 'empty')
					return { ok: true, message: 'The debug log is empty, the space is free, and the app can still write to it.' };
				return { ok: false, message: '/var/log is still over 95% full.' };
			},
		},
		{
			id: 'DART-103',
			title: "What's my IP?",
			from: 'Derek',
			points: 1,
			body: ['What is the IP address of web01? The network team are asking and I said "the usual".'],
			steps: [
				{ text: "List the server's network addresses.", cmd: 'ip addr' },
				{
					text: 'Find the line starting inet under eth0. Ignore 127.0.0.1: that is the machine talking to itself. Type the address, without the /24, into the ticket.',
				},
			],
			opened: 'Quick one. Should take you 5 seconds. Took Brant 3 days.',
			thanks: "Perfect. I've told them it's 10.5.0.21, which is what I was about to say.",
			answer: {
				label: 'IP address of web01',
				check: (v) =>
					norm(v).replace(/\/24$/, '') === '10.5.0.21'
						? { ok: true, message: "That's web01's address." }
						: { ok: false, message: "That isn't web01's address. Check eth0 in ip addr." },
			},
		},
		{
			id: 'DART-104',
			title: 'Who keeps editing /etc/hosts?',
			from: 'Priya',
			points: 2,
			body: [
				'Someone keeps editing /etc/hosts on web01 with sudo. It breaks name lookups for the shop.',
				'Every sudo command is logged in /var/log/sudo.log. Find out who it is.',
			],
			steps: [
				{ text: 'grep prints only the lines that contain a word.', cmd: 'grep hosts /var/log/sudo.log' },
				{ text: 'The username comes straight after "sudo:" on each line. Type it into the ticket.' },
			],
			opened: "I'm not saying it's an insider threat. I'm not saying it isn't.",
			thanks: 'Thank you. I will be having words.',
			answer: {
				label: 'Username',
				check: (v) =>
					norm(v).startsWith('kev')
						? { ok: true, message: "It's Kev." }
						: { ok: false, message: 'Not them. Look again at the lines that mention /etc/hosts.' },
			},
		},
		{
			id: 'DART-105',
			title: 'URGENT: printer broken',
			from: 'Derek',
			points: 1,
			arrivesAfter: 2,
			interruption: true,
			body: ['The printer on floor 2 is broken AGAIN. I need it for the board meeting in 10 minutes. URGENT.'],
			steps: [{ text: 'Is a printer one of your servers? Who looks after the printers here?' }],
			opened: 'Sorry, I know you are busy. But URGENT.',
			thanks: 'Facilities say it was out of paper. Thanks for sorting it.',
			choices: [
				{
					label: 'Fix it yourself',
					result: {
						ok: false,
						message:
							"You spend 20 minutes on the floor 2 printer. It has no network port and a sticker saying 'Property of Facilities'. Your other tickets wait.",
					},
				},
				{
					label: 'Reassign it to Facilities, with a polite note',
					result: {
						ok: true,
						message: 'Reassigned. Facilities own the printers. Derek gets his printer, and you get your morning back.',
					},
				},
			],
		},
		{
			id: 'DART-106',
			title: 'Deploy my build, it works in dev',
			from: 'Kev',
			points: 5,
			body: [
				"New shop release! It's in ~/builds/darts-shop-1.4 on web01. Run ./start.sh and you're done.",
				'It must run in production mode, against the production database, db01.',
				'Works in dev!',
			],
			steps: [
				{
					text: 'Go to the build folder, run the app, and read the error carefully.',
					cmd: 'cd ~/builds/darts-shop-1.4\n./start.sh',
					done: async (vms) => (await vms.web01.readFile('/tmp/.darts-shop.tried')) !== null,
				},
				{
					text: 'It needs a config file that only exists on Kev\'s laptop. Press "Ask Kev about the error" to get his. Then make the folder for it: /etc needs root.',
					cmd: 'sudo mkdir -p /etc/darts',
					done: async (vms) => (await vms.web01.readFile('/etc/darts/shop.conf')) !== null,
				},
				{
					text: "Create the config with Kev's settings, changed for production: env=prod and db=db01. In nano, type the three lines, then press Ctrl+O, Enter to save and Ctrl+X to exit.",
					cmd: 'sudo nano /etc/darts/shop.conf',
					done: async (vms) => {
						const conf = (await vms.web01.readFile('/etc/darts/shop.conf')) ?? '';
						return /^env=prod$/m.test(conf) && /^db=db01$/m.test(conf);
					},
				},
				{
					text: 'Start the app again.',
					cmd: './start.sh',
					done: async (vms) => (await vms.web01.readFile('/tmp/darts-shop.mode'))?.trim() === 'prod',
				},
				{ text: 'Press Check my work.' },
			],
			opened: 'Should be a 2-minute job. It works on my machine.',
			thanks: 'Told you it works. (Thanks.) (Sorry about the config file.)',
			ask: {
				label: 'Ask Kev about the error',
				reply: [
					"Oh, it needs a config file. I've had one on my laptop for ages. Here's mine:",
					'env=dev\nport=8080\ndb=localhost',
					'Pop that in /etc/darts/shop.conf. Should be fine.',
				],
			},
			check: async (vms) => {
				const conf = await vms.web01.readFile('/etc/darts/shop.conf');
				if (conf === null) return { ok: false, message: '/etc/darts/shop.conf does not exist yet, so the app cannot start.' };
				const mode = (await vms.web01.readFile('/tmp/darts-shop.mode'))?.trim();
				if (!mode) return { ok: false, message: "The shop hasn't started yet. Run ./start.sh in the build folder." };
				if (mode !== 'prod')
					return {
						ok: false,
						message: `The shop started as: ${mode}. Production needs env=prod and db=db01 in the config. Then start it again.`,
					};
				return { ok: true, message: 'The shop is running in production mode against db01.' };
			},
		},
		{
			id: 'DART-107',
			title: 'The website is down on web02',
			from: 'Derek',
			points: 3,
			arrivesAfter: 4,
			body: [
				"The shop website on web02 is DOWN. Customers can't buy darts.",
				"Brant changed something on Friday and went on holiday. He left a note in ~/handover on web01. Get the site back up.",
			],
			steps: [
				{
					text: "Read Brant's note on web01.",
					cmd: 'cat ~/handover/README.txt',
				},
				{
					text: 'Copy his fixed config to your home folder on web02. The first time, ssh asks if you trust web02: type yes. Your password is Welcome1.',
					cmd: 'scp ~/handover/darts.conf web02:',
					done: async (vms) => (await vms.web02.readFile(`/home/${vms.web02.user}/darts.conf`)) !== null,
				},
				{ text: 'Log in to web02. Your prompt changes to show you are on web02.', cmd: 'ssh web02' },
				{
					text: "On web02, move the file into nginx's config folder, replacing the broken one.",
					cmd: 'sudo mv darts.conf /etc/nginx/http.d/darts.conf',
					done: async (vms) => (await vms.web02.readFile('/etc/nginx/http.d/darts.conf')) === FIXED_NGINX,
				},
				{
					text: 'Test the config, then start nginx. nginx -t should say the syntax is ok.',
					cmd: 'sudo nginx -t\nsudo rc-service nginx restart',
					done: async (vms) => (await vms.web02.readFile('/var/lib/desk/web.state'))?.trim() === 'up',
				},
				{
					text: 'Log out of web02, then check the site from web01, like a customer would.',
					cmd: 'exit\nwget -qO- http://web02',
				},
			],
			opened: "The website is down. This is the DevOps, isn't it? Can you fix the DevOps?",
			thanks: "It's back! I told the board it was a 'cyber incident'.",
			check: async (vms) => {
				const state = await readState(vms.web02, '/var/lib/desk/web.state', 'down');
				if (state === 'up') return { ok: true, message: 'web02 is serving the shop again.' };
				const conf = (await vms.web02.readFile('/etc/nginx/http.d/darts.conf')) ?? '';
				if (conf.includes('lisen'))
					return {
						ok: false,
						message: "The site is still down. nginx on web02 still has the broken config: Brant typed 'lisen' instead of 'listen'.",
					};
				return { ok: false, message: "The config looks fixed, but nginx on web02 isn't running. Start it." };
			},
		},
	],
	retro: [
		{
			question: "Kev's build failed on web01. What was the real problem?",
			options: ['web01 was too slow', "A config file only existed on Kev's laptop", 'Linux cannot run shell scripts'],
			correct: 1,
			why: 'Anything that only exists on one machine is a bug waiting to happen. Sprint 2 fixes this with version control.',
		},
		{
			question: 'Why empty a busy log file instead of deleting it?',
			options: [
				'Deleting files is against the rules',
				'The app keeps the deleted file open, so the space is not freed',
				'Empty files load faster',
			],
			correct: 1,
			why: 'On Linux, a deleted file that a program still has open keeps using disk space until the program closes it.',
		},
		{
			question: 'Before restarting nginx with a new config, what is worth doing first?',
			options: ['Reboot the server', 'Test the config with nginx -t', 'Delete the old logs'],
			correct: 1,
			why: 'nginx -t checks the config without touching the running site. A typo found there is a typo that never takes the shop down.',
		},
		{
			question: "Derek's printer broke mid-sprint. What did you do?",
			options: ['Fixed it, it was urgent', 'Passed it to the team that owns it', 'Ignored it'],
			correct: 1,
			why: 'Urgent for someone is not the same as yours to fix. Routing work to the right team is part of the job.',
		},
	],
	translation: [
		['Jeera', 'Jira, or any ticket tracker: sprints, story points and queues.'],
		['passwd, sudo', 'Exactly the same on every Linux server.'],
		['df, du, truncate', 'How sysadmins find and free disk space on every Linux server.'],
		['A deleted file that is still open', 'Still uses disk space until the program closes it. A classic real-world surprise.'],
		['ip addr', "The standard way to see a Linux server's addresses."],
		['grep and log files', 'How you find out who did what, everywhere.'],
		['ssh, scp', 'How you log in to and copy files between servers, everywhere.'],
		[
			'rc-service nginx restart',
			'Alpine Linux uses OpenRC. On Ubuntu and Red Hat, the same job is systemctl restart nginx.',
		],
		['A config file on one laptop', 'A real, common cause of "works in dev". Sprint 2 brings version control.'],
	],
	next: "Sprint 2, Who changed prod?, brings version control and GitBit.",
};

async function sandraState(vm: import('./vm').GameVM): Promise<'gone' | 'locked' | 'unchanged' | 'reset'> {
	const shadow = await vm.readFile('/etc/shadow');
	const line = shadow?.split('\n').find((l) => l.startsWith('sandra:'));
	if (!line) return 'gone';
	const hash = line.split(':')[1] ?? '';
	const original = (await vm.readFile('/var/lib/desk/sandra.hash'))?.trim();
	if (hash.startsWith('!')) return 'locked';
	if (hash === original?.replace(/^!/, '')) return 'unchanged';
	return 'reset';
}

/** Builds the scenario on web01. Runs once as root when the VM starts. */
sprint1.servers[0].setup = `
mkdir -p /var/lib/desk

# DART-101: Sandra is locked out.
adduser -D -s /bin/sh sandra 2>/dev/null
echo 'sandra:Spring2014' | chpasswd 2>/dev/null
passwd -l sandra >/dev/null 2>&1
grep '^sandra:' /etc/shadow | cut -d: -f2 > /var/lib/desk/sandra.hash

# DART-102: /var/log becomes its own small filesystem, nearly full, with
# the darts-shop app holding its debug log open.
mkdir -p /tmp/.oldlog && cp -a /var/log/. /tmp/.oldlog/
mount -t tmpfs -o size=8m logvol /var/log
cp -a /tmp/.oldlog/. /var/log/ && rm -rf /tmp/.oldlog
mkdir -p /var/log/darts-shop
dd if=/dev/zero of=/var/log/darts-shop/debug.log bs=4096 count=1980 2>/dev/null
for i in 1 2 3 4 5 6 7 8; do echo "10.5.0.$i - - [14/Oct/2014:09:0$i:00] \\"GET /darts HTTP/1.1\\" 200 512" >> /var/log/darts-shop/access.log; done
echo "[14/Oct/2014 09:01] WARN basket service slow" > /var/log/darts-shop/error.log
echo "Oct 14 08:59:01 web01 cron: daily backup finished" > /var/log/cron.log

# The darts-shop app keeps debug.log open and tells the desk what state the
# log is in. It uses only shell built-ins, so it costs almost nothing while
# it waits (each new program takes about 0.4 s to start in the emulator).
cat > /usr/local/bin/darts-shop <<'EOF'
#!/bin/bash
LOG=/var/log/darts-shop/debug.log
exec 8>>"$LOG"
mkfifo /tmp/.darts-shop.tick 2>/dev/null
exec 9<>/tmp/.darts-shop.tick
last=
while :; do
  if [ ! -e "$LOG" ]; then s=deleted; elif [ -s "$LOG" ]; then s=full; else s=empty; fi
  if [ "$s" != "$last" ]; then echo "$s" > /var/lib/desk/debug.log.state; last=$s; fi
  read -t 2 -u 9 _
done
EOF
chmod +x /usr/local/bin/darts-shop
setsid /usr/local/bin/darts-shop >/dev/null 2>&1 < /dev/null &

# DART-104: the sudo log.
cat > /var/log/sudo.log <<'EOF'
Oct 13 09:12:01 web01 sudo: brant : TTY=pts/0 ; PWD=/home/brant ; USER=root ; COMMAND=/sbin/reboot
Oct 13 10:40:17 web01 sudo: sandra : TTY=pts/1 ; PWD=/home/sandra ; USER=root ; COMMAND=/usr/bin/vi /etc/motd
Oct 13 14:03:55 web01 sudo: kev : TTY=pts/2 ; PWD=/home/kev ; USER=root ; COMMAND=/usr/bin/vi /etc/hosts
Oct 13 16:21:09 web01 sudo: brant : TTY=pts/0 ; PWD=/home/brant ; USER=root ; COMMAND=/usr/bin/apk upgrade
Oct 14 08:47:30 web01 sudo: tom : TTY=pts/3 ; PWD=/home/tom ; USER=root ; COMMAND=/usr/bin/docker ps
Oct 14 09:05:12 web01 sudo: kev : TTY=pts/2 ; PWD=/home/kev ; USER=root ; COMMAND=/usr/bin/vi /etc/hosts
Oct 14 09:30:44 web01 sudo: sandra : TTY=pts/1 ; PWD=/home/sandra ; USER=root ; COMMAND=/bin/cat /var/log/messages
EOF

# DART-106: Kev's build.
B=/home/$P/builds/darts-shop-1.4
mkdir -p $B
cat > $B/start.sh <<'EOF'
#!/bin/sh
CONF=/etc/darts/shop.conf
echo "Darts Shop 1.4"
echo tried > /tmp/.darts-shop.tried
if [ ! -f "$CONF" ]; then
  echo "ERROR: config file $CONF not found" >&2
  exit 1
fi
. "$CONF"
if [ "$env" != "prod" ] || [ "$db" != "db01" ]; then
  echo "Started in \${env:-unknown} mode on port \${port:-8080}, database \${db:-none}"
  echo "\${env:-unknown} (database \${db:-none})" > /tmp/darts-shop.mode
  exit 0
fi
echo "Started in production mode on port \${port:-8080}, database $db"
echo prod > /tmp/darts-shop.mode
EOF
chmod +x $B/start.sh
echo "Darts Shop 1.4. Run ./start.sh" > $B/README
chown -R "$P:$P" /home/$P/builds
rm -f /tmp/darts-shop.mode /tmp/.darts-shop.tried

# DART-107: Brant's handover note and fixed nginx config.
mkdir -p /home/$P/handover
cat > /home/$P/handover/darts.conf <<'EOF'
${FIXED_NGINX}EOF
cat > /home/$P/handover/README.txt <<'EOF'
Broke the shop's nginx config on web02 on Friday. Fixed version is
darts.conf in this folder. Copy it to /etc/nginx/http.d/ on web02 and
restart nginx. Back Monday.  B.
EOF
chown -R "$P:$P" /home/$P/handover
`;

/** Builds the scenario on web02: nginx stopped, with Brant's broken config. */
sprint1.servers[1].setup = `
mkdir -p /var/lib/desk /srv/darts-shop
# nginx's service needs OpenRC's networking service, which needs this file.
# The page sets up eth0 itself (ld-net), so only the loopback is listed.
[ -s /etc/network/interfaces ] || printf 'auto lo\\niface lo inet loopback\\n' > /etc/network/interfaces
rm -f /etc/nginx/http.d/default.conf
# Normally made by the nginx service on first start; without it, nginx -t
# reports a missing pid folder and confuses the player.
mkdir -p /run/nginx && chown nginx:nginx /run/nginx
cat > /srv/darts-shop/index.html <<'EOF'
<h1>Darts Unlimited</h1>
<p>The shop is open for business.</p>
EOF
cat > /etc/nginx/http.d/darts.conf <<'EOF'
# Darts shop. Edited by Brant, Friday 17:58.
server {
    lisen 80;
    root /srv/darts-shop;
    index index.html;
}
EOF

# Asks the site for its home page every 2 seconds and tells the desk whether
# it is up. Shell built-ins only, including bash's /dev/tcp.
cat > /usr/local/bin/desk-webcheck <<'EOF'
#!/bin/bash
mkfifo /tmp/.webcheck.tick 2>/dev/null
exec 9<>/tmp/.webcheck.tick
last=
while :; do
  s=down
  { printf 'GET / HTTP/1.0\\r\\nHost: web02\\r\\n\\r\\n' >&3
    while IFS= read -r -t 2 line <&3; do
      [[ $line == *"open for business"* ]] && s=up
    done
  } 3<>/dev/tcp/127.0.0.1/80 2>/dev/null
  if [ "$s" != "$last" ]; then echo "$s" > /var/lib/desk/web.state; last=$s; fi
  read -t 2 -u 9 _
done
EOF
chmod +x /usr/local/bin/desk-webcheck
setsid /usr/local/bin/desk-webcheck >/dev/null 2>&1 < /dev/null &
`;

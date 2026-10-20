/**
 * Sprint 1: Onboarding. The tickets, the chat script and the checks.
 * See docs/DESIGN.md for the design. Every check reads the VM's real files.
 */
import type { GameVM } from './vm';

export type Person = 'Derek' | 'Brant' | 'Sandra' | 'Kev' | 'Priya' | 'Tom' | 'Monitoring' | 'You';

export interface CheckResult {
	ok: boolean;
	message: string;
}

export interface Ticket {
	id: string;
	title: string;
	from: Person;
	points: number;
	/** Arrives mid-sprint, once this many other tickets are done */
	arrivesAfter?: number;
	interruption?: boolean;
	body: string[];
	hints: string[];
	/** What the reporter says in chat when you open the ticket */
	opened: string;
	/** What the reporter says when it's done */
	thanks: string;
	/** A typed answer, checked here */
	answer?: { label: string; check: (value: string) => CheckResult };
	/** A check against the VM */
	check?: (vm: GameVM) => Promise<CheckResult>;
	/** Choices instead of a check */
	choices?: { label: string; result: CheckResult }[];
	/** Extra chat when the player asks the reporter for help */
	ask?: { label: string; reply: string[] };
}

export interface RetroQuestion {
	question: string;
	options: string[];
	correct: number;
	why: string;
}

export const sprint = {
	number: 1,
	title: 'Onboarding',
	vm: { name: 'web01', ip: '10.5.0.21/24' },
	intro: [
		{ from: 'Derek', text: "Morning! Welcome to Darts Unlimited. Brant will show you round." } as const,
		{
			from: 'Brant',
			text: 'Auto-reply: I am out of the office until Monday. For anything urgent, see man.',
		} as const,
		{
			from: 'Derek',
			text: "Right. Your tickets are in Jeera, top left. You're logged in to web01 in the terminal. Sprint ends Friday. No pressure.",
		} as const,
	],
	done: [
		{ from: 'Derek', text: "That's everything? On your first week? Sprint review, my office, now." } as const,
	],
};

const norm = (v: string) => v.trim().toLowerCase();

export const tickets: Ticket[] = [
	{
		id: 'DART-101',
		title: "Reset my password, I'm locked out",
		from: 'Sandra',
		points: 1,
		body: [
			"I've been locked out of web01. My username is sandra.",
			'Please set me a new password (anything you like, tell me later) and unlock my account.',
		],
		hints: [
			'Changing another user\'s password needs root. Put sudo in front of the command. Your password is learner.',
			'The command is passwd, followed by the username: sudo passwd sandra',
			'Setting a new password also removes the lock.',
		],
		opened: "Thanks for looking. I've screenshotted the error if you need it. I've screenshotted everything.",
		thanks: "I'm in! I'll write the password on a sticky note. Joking. Mostly.",
		check: async (vm) => {
			const shadow = await vm.readFile('/etc/shadow');
			const line = shadow?.split('\n').find((l) => l.startsWith('sandra:'));
			if (!line) return { ok: false, message: "The sandra account has gone. Reload the page to put it back." };
			const hash = line.split(':')[1] ?? '';
			const original = (await vm.readFile('/var/lib/desk/sandra.hash'))?.trim();
			if (hash.startsWith('!')) return { ok: false, message: "Sandra's account is still locked." };
			if (hash === original?.replace(/^!/, ''))
				return { ok: false, message: "The account is unlocked, but Sandra's password hasn't changed." };
			return { ok: true, message: "Sandra has a new password and her account is unlocked." };
		},
	},
	{
		id: 'DART-102',
		title: 'Disk filling up on web01',
		from: 'Monitoring',
		points: 3,
		body: [
			'ALERT: /var/log on web01 is filling up fast.',
			'Find the biggest file under /var/log and empty it. Do not delete it: the shop app still has it open.',
		],
		hints: [
			'find can list files over a size: find /var/log -size +1M',
			"ls -lhS lists a folder's files biggest first, with sizes you can read. Try it in the folder you found.",
			'To empty a file without deleting it: sudo truncate -s 0 <file>',
		],
		opened: 'ALERT acknowledged by you. (Nobody else ever acknowledges alerts.)',
		thanks: 'RECOVERY: /var/log on web01 is back to normal.',
		check: async (vm) => {
			const size = await vm.fileSize('/var/log/darts-shop/debug.log');
			if (size === null)
				return {
					ok: false,
					message:
						"debug.log has been deleted. The app still has it open, so the space isn't freed until the app restarts. Reload the page to try again, and empty it instead.",
				};
			if (size > 1024) return { ok: false, message: 'The biggest log is still full.' };
			return { ok: true, message: 'The debug log is empty and the app can still write to it.' };
		},
	},
	{
		id: 'DART-103',
		title: "What's my IP?",
		from: 'Derek',
		points: 1,
		body: ['What is the IP address of web01? The network team are asking and I said "the usual".'],
		hints: ['ip addr shows the addresses of every network interface.', 'Look for inet on eth0. Ignore 127.0.0.1: that is the machine talking to itself.'],
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
		hints: [
			'grep prints only the lines that contain a word: grep hosts /var/log/sudo.log',
			'The username comes straight after "sudo:" on each line.',
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
		hints: ['Is a printer an operations server? Who looks after the printers here?'],
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
				result: { ok: true, message: 'Reassigned. Facilities own the printers. Derek gets his printer, and you get your morning back.' },
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
		hints: [
			'cd into the build folder and run ./start.sh. Read the error carefully.',
			'The script looks for a config file. Does it exist? ls -l /etc/darts',
			'Creating files in /etc needs root: sudo mkdir -p /etc/darts, then sudo vi /etc/darts/shop.conf (or sudo nano).',
			"Kev's config is for his laptop. Production needs env=prod and db=db01.",
		],
		opened: "Should be a 2-minute job. It works on my machine.",
		thanks: "Told you it works. (Thanks.) (Sorry about the config file.)",
		ask: {
			label: 'Ask Kev about the error',
			reply: [
				"Oh, it needs a config file. I've had one on my laptop for ages. Here's mine:",
				'env=dev\nport=8080\ndb=localhost',
				'Pop that in /etc/darts/shop.conf. Should be fine.',
			],
		},
		check: async (vm) => {
			const conf = await vm.readFile('/etc/darts/shop.conf');
			if (conf === null) return { ok: false, message: '/etc/darts/shop.conf does not exist yet, so the app cannot start.' };
			const mode = (await vm.readFile('/tmp/darts-shop.mode'))?.trim();
			if (!mode) return { ok: false, message: "The shop hasn't started yet. Run ./start.sh in the build folder." };
			if (mode !== 'prod')
				return {
					ok: false,
					message: `The shop started as: ${mode}. Production needs env=prod and db=db01 in the config. Then start it again.`,
				};
			return { ok: true, message: 'The shop is running in production mode against db01.' };
		},
	},
];

export const retro: RetroQuestion[] = [
	{
		question: "Kev's build failed on web01. What was the real problem?",
		options: ['web01 was too slow', 'A config file only existed on Kev\'s laptop', 'Linux cannot run shell scripts'],
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
		question: "Derek's printer broke mid-sprint. What did you do?",
		options: ['Fixed it, it was urgent', 'Passed it to the team that owns it', 'Ignored it'],
		correct: 1,
		why: 'Urgent for someone is not the same as yours to fix. Routing work to the right team is part of the job.',
	},
];

export const translation = [
	['Jeera', 'Jira, or any ticket tracker: sprints, story points and queues.'],
	['passwd, sudo', 'Exactly the same on every Linux server.'],
	['find, ls -lhS, truncate', 'How sysadmins find and free disk space. On a real server, du -h does this job too.'],
	['ip addr', 'The standard way to see a Linux server\'s addresses.'],
	['grep and log files', 'How you find out who did what, everywhere.'],
	['A config file on one laptop', 'A real, common cause of "works in dev". Sprint 2 brings version control.'],
];

/** Builds the scenario on web01. Runs once as root when the VM starts. */
export const setup = `#!/bin/sh
mkdir -p /var/lib/desk

# DART-101: Sandra is locked out.
adduser -D -s /bin/sh sandra 2>/dev/null
echo 'sandra:Spring2014' | chpasswd 2>/dev/null
passwd -l sandra >/dev/null 2>&1
grep '^sandra:' /etc/shadow | cut -d: -f2 > /var/lib/desk/sandra.hash

# DART-102: a log that is filling the disk, and some that aren't.
mkdir -p /var/log/darts-shop
dd if=/dev/zero of=/var/log/darts-shop/debug.log bs=1024 count=6144 2>/dev/null
for i in 1 2 3 4 5 6 7 8; do echo "10.5.0.$i - - [14/Oct/2014:09:0$i:00] \\"GET /darts HTTP/1.1\\" 200 512" >> /var/log/darts-shop/access.log; done
echo "[14/Oct/2014 09:01] WARN basket service slow" > /var/log/darts-shop/error.log
echo "Oct 14 08:59:01 web01 cron: daily backup finished" > /var/log/cron.log

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
B=/home/learner/builds/darts-shop-1.4
mkdir -p $B
cat > $B/start.sh <<'EOF'
#!/bin/sh
CONF=/etc/darts/shop.conf
echo "Darts Shop 1.4"
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
chown -R learner:learner /home/learner/builds
rm -f /tmp/darts-shop.mode
`;

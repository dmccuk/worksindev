/**
 * Sprint 2: Who changed prod? Version control with Git, and GitBit.
 *
 * web01 has two repos: ~/darts-config (not yet under version control) and
 * ~/darts-shop (real history, including Tom's "testing discount"). gitbit
 * hosts bare repos over SSH. A reference-transaction hook in every repo
 * writes its log and file list to /var/lib/desk, which the checks and the
 * GitBit panel read.
 */
import { DARTS_SHOP_REPO } from './assets/darts-shop-repo';
import { readState, type Sprint, type VMs } from './types';

const norm = (v: string) => v.trim().toLowerCase();

/** Lines of `hash|author|subject`, newest first, or [] if the repo has none. */
export async function gitLog(vm: import('./vm').GameVM, repo: string): Promise<{ hash: string; author: string; subject: string }[]> {
	const text = await vm.readFile(`/var/lib/desk/git-${repo}.log`);
	return (text ?? '')
		.split('\n')
		.filter(Boolean)
		.map((l) => {
			const [hash, author, ...rest] = l.split('|');
			return { hash, author, subject: rest.join('|') };
		});
}

/** Files in the repo's latest commit. */
export async function gitFiles(vm: import('./vm').GameVM, repo: string): Promise<string[]> {
	return ((await vm.readFile(`/var/lib/desk/git-${repo}.files`)) ?? '').split('\n').filter(Boolean);
}

const home = (vms: VMs) => `/home/${vms.web01.user}`;

export const sprint2: Sprint = {
	number: 2,
	title: 'Who changed prod?',
	servers: [
		{ name: 'web01', ip: '10.5.0.21/24', terminal: true, setup: '', files: { '/tmp/darts-shop.tgz': DARTS_SHOP_REPO } },
		{ name: 'gitbit', ip: '10.5.0.23/24', setup: '' },
	],
	intro: [
		{
			from: 'Derek',
			text: 'Morning, {name}. Bad news: overnight the shop sold 200 dartboards at £4.99. Nobody knows who changed the price.',
		},
		{ from: 'Priya', text: 'This is why we need version control. Every change, who made it, and why.' },
		{
			from: 'Tom',
			text: "I've set up GitBit! It's on the gitbit server, next to web01. It's basically like the big Git hosting sites, but ours.",
		},
		{ from: 'Derek', text: "I don't know what any of that means. Make it so this never happens again." },
	],
	done: [{ from: 'Derek', text: 'So now we can see who changed what, and undo it? Why did nobody tell me this existed? Sprint review.' }],
	tickets: [
		{
			id: 'DART-201',
			title: 'Put the server config under version control',
			from: 'Priya',
			points: 3,
			body: [
				'The shop config files are in ~/darts-config on web01. Right now, if someone changes one, nobody knows.',
				'Put the folder under version control with Git and make the first commit. Git needs to know who you are first.',
			],
			steps: [
				{ text: 'Go to the folder and look at what is there.', cmd: 'cd ~/darts-config\nls' },
				{
					text: 'Tell Git your name and email. Every commit records them. Use your own name.',
					cmd: 'git config --global user.name "Your Name"\ngit config --global user.email "you@darts.example"',
					done: async (vms) => /email\s*=/.test((await vms.web01.readFile(`${home(vms)}/.gitconfig`)) ?? ''),
				},
				{
					text: 'Turn the folder into a Git repository.',
					cmd: 'git init',
					done: async (vms) => (await vms.web01.readFile(`${home(vms)}/darts-config/.git/HEAD`)) !== null,
				},
				{ text: 'Choose what goes into the first commit: everything here.', cmd: 'git add .\ngit status' },
				{
					text: 'Save the snapshot with a message saying what it is.',
					cmd: 'git commit -m "Add the shop config"',
					done: async (vms) => (await gitLog(vms.web01, 'darts-config')).length > 0,
				},
				{ text: 'See your commit in the history, then press Check my work.', cmd: 'git log' },
			],
			opened: 'Version control is a security control. I will die on this hill.',
			thanks: 'Lovely. Now we have a record. I like records.',
			check: async (vms) => {
				const log = await gitLog(vms.web01, 'darts-config');
				if (!log.length) return { ok: false, message: 'There are no commits in ~/darts-config yet.' };
				const files = await gitFiles(vms.web01, 'darts-config');
				if (!files.includes('shop.conf') || !files.includes('darts.conf'))
					return { ok: false, message: 'The commit is missing shop.conf or darts.conf. Add them and commit again.' };
				return { ok: true, message: 'darts-config is under version control, with both config files committed.' };
			},
		},
		{
			id: 'DART-202',
			title: 'Who changed the dartboard price?',
			from: 'Derek',
			points: 2,
			body: [
				'The shop code is in ~/darts-shop on web01, and it IS in Git, apparently. The dartboard price is in prices.csv.',
				'Someone changed it from £49.99 to £4.99. Find out who.',
			],
			steps: [
				{ text: 'Go to the shop repo and see its history, one line per commit.', cmd: 'cd ~/darts-shop\ngit log --oneline' },
				{ text: 'Show only the commits that changed prices.csv, with what changed in each.', cmd: 'git log -p prices.csv' },
				{
					text: 'Or ask Git who last changed each line. The author is next to the dartboard line. Type their name into the ticket.',
					cmd: 'git blame prices.csv',
				},
			],
			opened: "Whoever it was, I'm not angry. I'm just disappointed. And also angry.",
			thanks: "Tom?! He said he was 'testing'. On the live shop.",
			answer: {
				label: 'Who changed the price?',
				check: (v) =>
					norm(v).startsWith('tom')
						? { ok: true, message: 'It was Tom, in a commit called "testing discount".' }
						: { ok: false, message: 'Not them. Look at who changed the dartboard line in prices.csv.' },
			},
		},
		{
			id: 'DART-203',
			title: 'Put the price back, without losing history',
			from: 'Derek',
			points: 3,
			body: [
				"Undo Tom's price change in ~/darts-shop. Priya says: do not rewrite history. Everyone must still be able to see what happened.",
			],
			steps: [
				{
					text: "List the commits that changed prices.csv. Tom's is 'testing discount': its short hash is the code at the start of the line. Not 'Initial shop': reverting that one undoes the whole shop.",
					cmd: 'cd ~/darts-shop\ngit log --oneline prices.csv',
				},
				{
					text: 'Make sure Git knows who you are, or the revert stops halfway. Use your own name. (If you refreshed the page, the servers were reset, so do this again.)',
					cmd: 'git config --global user.name "Your Name"\ngit config --global user.email "you@darts.example"',
					done: async (vms) => /email\s*=/.test((await vms.web01.readFile(`${home(vms)}/.gitconfig`)) ?? ''),
				},
				{
					text: "Make a new commit that undoes Tom's. Put his hash in place of HASH. --no-edit keeps Git's own message. If Git said 'Please tell me who you are' during the revert, the change is already staged: run git commit --no-edit to finish it. If it says CONFLICT, run git revert --abort and check the hash.",
					cmd: 'git revert --no-edit HASH',
					done: async (vms) => (await gitLog(vms.web01, 'darts-shop')).some((c) => c.subject.startsWith('Revert')),
				},
				{ text: 'Check the price is back and the history shows both commits.', cmd: 'grep dartboard prices.csv\ngit log --oneline' },
			],
			opened: 'And do it properly this time.',
			thanks: 'Dartboards are £49.99 again. Finance have stopped crying.',
			check: async (vms) => {
				const git = `${home(vms)}/darts-shop/.git`;
				for (const [file, what] of [['REVERT_HEAD', 'git revert'], ['CHERRY_PICK_HEAD', 'git cherry-pick'], ['MERGE_HEAD', 'git merge']]) {
					if (await vms.web01.readFile(`${git}/${file}`))
						return {
							ok: false,
							message: `A ${what} is half-finished: it stopped on a conflict, and some files may be missing. Run ${what} --abort to go back to your last commit, then try again.`,
						};
				}
				if ((await vms.web01.readFile(`${git}/MERGE_MSG`))?.startsWith('Revert'))
					return {
						ok: false,
						message:
							"Your revert is staged but not committed: Git stopped to ask who you are. Set your name and email with git config, then run git commit --no-edit to finish it.",
					};
				const log = await gitLog(vms.web01, 'darts-shop');
				const tom = log.findIndex((c) => c.subject === 'testing discount');
				if (tom < 0)
					return {
						ok: false,
						message:
							"Tom's commit has gone from the history. That's rewriting history, and on a shared repo it breaks everyone else's copy. Reset the sprint and use git revert instead.",
					};
				const prices = (await vms.web01.readFile(`${home(vms)}/darts-shop/prices.csv`)) ?? '';
				if (!prices.includes('dartboard,49.99')) return { ok: false, message: 'prices.csv still has the wrong dartboard price.' };
				if (tom === 0)
					return {
						ok: false,
						message: "The price is right in the file, but the fix isn't committed. Commit it so history shows it, ideally with git revert.",
					};
				if (!log.slice(0, tom).some((c) => c.subject.startsWith('Revert')))
					return {
						ok: true,
						message:
							"Fixed with a new commit, and Tom's is still in the history. Next time try git revert HASH: it writes the fix for you, and its message says which commit it undoes.",
					};
				return { ok: true, message: "Tom's change is undone with a new commit, and the history still shows what happened." };
			},
		},
		{
			id: 'DART-204',
			title: 'Push the shop to GitBit',
			from: 'Tom',
			points: 3,
			body: [
				'The shop repo only exists on web01. If web01 dies, so does the history.',
				"I've made an empty repo for you on GitBit: darts-shop.git in your home folder on the gitbit server. Push the shop to it!",
			],
			steps: [
				{
					text: "Tell your repo where GitBit is. A remote is a named address for another copy of the repo.",
					cmd: 'cd ~/darts-shop\ngit remote add gitbit gitbit:darts-shop.git\ngit remote -v',
				},
				{
					text: 'Send your commits to GitBit. The first time, SSH asks if you trust gitbit: type yes. Your password is Welcome1.',
					cmd: 'git push gitbit main',
					done: async (vms) => (await gitLog(vms.gitbit, 'darts-shop')).length > 0,
				},
				{ text: 'Look at the GitBit panel in Tools: your commits are there. Then press Check my work.' },
			],
			opened: "You're going to love GitBit. I love GitBit.",
			thanks: 'IT WORKS. Have you seen the GitBit panel? Look at the GitBit panel.',
			check: async (vms) => {
				const remote = await readState(vms.gitbit, '/var/lib/desk/git-darts-shop.log', '');
				if (!remote) return { ok: false, message: 'GitBit has no commits for darts-shop yet. Push to it.' };
				const local = await gitLog(vms.web01, 'darts-shop');
				if (local[0] && !remote.startsWith(local[0].hash))
					return { ok: false, message: 'GitBit is behind web01: you have commits that are not pushed yet. Push again.' };
				return { ok: true, message: 'The shop and its whole history are on GitBit.' };
			},
		},
		{
			id: 'DART-205',
			title: 'Can I be admin on GitBit?',
			from: 'Sandra',
			points: 1,
			arrivesAfter: 2,
			interruption: true,
			body: ["Can you make me an admin on GitBit? I need to look at one file in the shop repo. Just the one. Quickly."],
			steps: [{ text: 'What is the least access Sandra needs to do what she asked?' }],
			opened: "I'll screenshot it and then I won't need it any more.",
			thanks: "Read access works. I've screenshotted the file.",
			choices: [
				{
					label: 'Make her a GitBit admin',
					result: {
						ok: false,
						message:
							"Admin can delete every repo and change everyone's access. Priya appears behind you, silently. Sandra only needed to read one file.",
					},
				},
				{
					label: 'Give her read access to darts-shop only',
					result: {
						ok: true,
						message: 'Read access to one repo: exactly what she needs, nothing more. That is the principle of least privilege.',
					},
				},
				{
					label: 'Tell her your password',
					result: { ok: false, message: 'Priya has added you to a mandatory security training course. It is 4 hours long.' },
				},
			],
		},
		{
			id: 'DART-206',
			title: 'Kev committed a password',
			from: 'Priya',
			points: 3,
			arrivesAfter: 4,
			body: [
				'Kev committed the shop database password to the darts-shop repo, in a file called .env. It is now on GitBit too.',
				'The app needs .env on the server, so keep the file. But Git must stop tracking it, and ignore it from now on. Then push.',
			],
			steps: [
				{ text: 'Look at the file, and see it in the repo.', cmd: 'cd ~/darts-shop\ncat .env\ngit ls-files' },
				{
					text: 'Stop tracking .env, but leave the file where it is. --cached means "only from Git".',
					cmd: 'git rm --cached .env',
				},
				{
					text: 'Tell Git to ignore .env from now on.',
					cmd: 'echo ".env" >> .gitignore',
					done: async (vms) => /^\.env$/m.test((await vms.web01.readFile(`${home(vms)}/darts-shop/.gitignore`)) ?? ''),
				},
				{
					text: 'Commit both changes.',
					cmd: 'git add .gitignore\ngit commit -m "Stop tracking .env"',
					done: async (vms) => !(await gitFiles(vms.web01, 'darts-shop')).includes('.env'),
				},
				{
					text: 'Push to GitBit.',
					cmd: 'git push gitbit main',
					done: async (vms) => {
						const files = await gitFiles(vms.gitbit, 'darts-shop');
						return files.length > 0 && !files.includes('.env');
					},
				},
			],
			opened: 'I am calm. I am very calm.',
			thanks: 'Thank you. Kev is changing the database password now. It is still in the history, so it has to change.',
			check: async (vms) => {
				const env = await vms.web01.readFile(`${home(vms)}/darts-shop/.env`);
				if (env === null) return { ok: false, message: 'The .env file has gone from web01, and the app needs it. Reset the sprint and use git rm --cached.' };
				const ignore = (await vms.web01.readFile(`${home(vms)}/darts-shop/.gitignore`)) ?? '';
				if (!/^\.env$/m.test(ignore)) return { ok: false, message: '.gitignore does not list .env yet.' };
				if ((await gitFiles(vms.web01, 'darts-shop')).includes('.env'))
					return { ok: false, message: 'The latest commit on web01 still includes .env.' };
				const remote = await gitFiles(vms.gitbit, 'darts-shop');
				if (!remote.length || remote.includes('.env'))
					return { ok: false, message: 'GitBit still has .env in its latest commit. Push your fix.' };
				return { ok: true, message: '.env is no longer tracked or pushed, and the file is still on web01 for the app.' };
			},
		},
	],
	retro: [
		{
			question: "What is the right way to undo a bad commit on a branch other people use?",
			options: ['git revert, which adds a new commit', 'git reset --hard, then force push', 'Delete the repo and start again'],
			correct: 0,
			why: 'revert keeps history honest and does not break anyone else\'s copy. Rewriting shared history does.',
		},
		{
			question: "Kev's password is no longer tracked. What else has to happen?",
			options: ['Nothing, it is fixed', 'Change the password: it is still in the history', 'Delete .gitignore'],
			correct: 1,
			why: 'Anyone with a copy of the repo can still find the password in old commits. A leaked secret must be changed.',
		},
		{
			question: 'Sandra needed to read one file. What access did she get?',
			options: ['Admin, to save time', 'Read access to that one repo', 'Your password'],
			correct: 1,
			why: 'Least privilege: give people exactly the access the job needs, and no more.',
		},
		{
			question: 'Why put server config files under version control?',
			options: [
				'Git makes files smaller',
				'You can see who changed what, when and why, and undo it',
				'It stops anyone editing them',
			],
			correct: 1,
			why: 'Version control does not stop changes. It makes every change visible and reversible.',
		},
	],
	translation: [
		['GitBit', 'GitHub, GitLab or Bitbucket: hosted Git repositories.'],
		['git init, add, commit', 'Exactly the same everywhere Git runs.'],
		['git log, git blame', 'How teams find who changed what, and why.'],
		['git revert', 'The safe way to undo a change that others already have.'],
		['git remote, git push', 'How your work leaves your machine. Hosted services use the same commands.'],
		['git rm --cached and .gitignore', 'How to stop tracking a file. A leaked secret must still be changed.'],
		['Least privilege', 'A core security principle on every platform.'],
	],
	next: 'Sprint 3, Works in dev, brings builds, environments and Jonkins.',
	promotion: "Derek now introduces you as 'our Git person'. Tom has asked if he can be your Git person too.",
};

/** Git setup shared by both servers: a default branch, and the desk's hook in every new repo. */
const GIT_COMMON = `
mkdir -p /var/lib/desk && chmod 1777 /var/lib/desk
mkdir -p /usr/share/desk/git-template/hooks
cat > /usr/share/desk/git-template/hooks/reference-transaction <<'EOF'
#!/bin/sh
# Tells the Works in Dev desk about this repo whenever a branch changes.
# Each program start costs about 0.4 s in the emulator, so this uses shell
# built-ins wherever it can and does nothing for other ref updates.
[ "$1" = committed ] || exit 0
hit=
while read -r old new ref; do
  case "$ref" in refs/heads/*) hit=1 ;; esac
done
[ -n "$hit" ] || exit 0
# Git runs hooks in the bare repo, or at the top of the working tree.
name=\${PWD##*/}
name=\${name%.git}
git log --format='%H|%an|%s' > /var/lib/desk/git-$name.log 2>/dev/null
git ls-tree -r --name-only HEAD > /var/lib/desk/git-$name.files 2>/dev/null
exit 0
EOF
chmod 755 /usr/share/desk/git-template/hooks/reference-transaction
git config --system init.templateDir /usr/share/desk/git-template
git config --system init.defaultBranch main
`;

sprint2.servers[0].setup = `${GIT_COMMON}
# DART-201: the config files from sprint 1, not yet in Git.
C=/home/$P/darts-config
mkdir -p $C
printf 'env=prod\\nport=8080\\ndb=db01\\n' > $C/shop.conf
cat > $C/darts.conf <<'EOF'
server {
    listen 80;
    root /srv/darts-shop;
    index index.html;
}
EOF
chown -R "$P:$P" $C

# DART-202 to 206: the shop repo, with its 2014 history. Unpacked from an
# archive (see scripts/build-darts-shop-repo.sh): building it here would take
# about 12 Git commands at about 0.4 s each.
S=/home/$P/darts-shop
tar -xzf /tmp/darts-shop.tgz -C /home/$P && rm -f /tmp/darts-shop.tgz
mkdir -p $S/.git/hooks && cp /usr/share/desk/git-template/hooks/reference-transaction $S/.git/hooks/
cd $S && echo "0 0 refs/heads/main" | sh .git/hooks/reference-transaction committed
cd / && chown -R "$P:$P" $S
chown "$P:$P" /var/lib/desk/git-* 2>/dev/null
`;

sprint2.servers[1].setup = `${GIT_COMMON}
# DART-204: an empty repo on GitBit, owned by the player.
su "$P" -s /bin/sh -c 'git init -q --bare ~/darts-shop.git'
`;

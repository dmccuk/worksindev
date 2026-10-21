/**
 * Sprint 3: Works in dev. Builds, environments and Jonkins.
 *
 * web01 has the shop repo as sprint 2 left it, plus Kev's new build.sh. gitbit
 * hosts the same history, and runs Jonkins: a post-receive hook that builds
 * every push to main from its Jonkinsfile (assets/jonkins-build.sh). Builds
 * are written to /var/lib/desk/jonkins, which the checks and the Jonkins
 * panel read. The player has an SSH key for gitbit, so pushes need no password.
 */
import { DARTS_SHOP_REPO } from './assets/darts-shop-repo';
import JONKINS_BUILD from './assets/jonkins-build.sh?raw';
import KEV_BUILD from './assets/kev-build.sh?raw';
import POST_RECEIVE from './assets/post-receive.sh?raw';
import { buildOf, jonkinsExecutable, jonkinsLog, jonkinsRuns, type Run } from './jonkins';
import { asPlayer, GIT_COMMON, gitFiles, gitLog, GITBIT_WORK, REVERT_TOM, UNTRACK_ENV } from './sprint2';
import type { CheckResult, Sprint, VMs } from './types';

/** The new database password, which lives only in Jonkins's credentials. */
const DB_PASSWORD = 'Bullseye180';

// A throwaway key pair, only ever used between the game's two in-browser servers.
const GAME_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAr++3pfHAleEuUfNeDIMqCq4E8+nI/7ABtvLueMfCLxwAAAJhfutysX7rc
rAAAAAtzc2gtZWQyNTUxOQAAACAr++3pfHAleEuUfNeDIMqCq4E8+nI/7ABtvLueMfCLxw
AAAECGm6vT+rT1tOpULYeDfrTbdyaVB+pKJm8cHCnFUBbFDCv77el8cCV4S5R814MgyoKr
gTz6cj/sAG28u54x8IvHAAAAFXdvcmtzLWluLWRldiBnYW1lIGtleQ==
-----END OPENSSH PRIVATE KEY-----
`;
const GAME_KEY_PUB = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICv77el8cCV4S5R814MgyoKrgTz6cj/sAG28u54x8IvH works-in-dev game key\n';

const JONKINSFILE = `pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh './build.sh'
            }
        }
    }
}
`;

const home = (vms: VMs) => `/home/${vms.web01.user}`;
const shopFile = (vms: VMs, name: string) => vms.web01.readFile(`${home(vms)}/darts-shop/${name}`);
const CREDENTIAL = /credentials\(\s*['"]darts-db['"]\s*\)/;
const PROD = /DEPLOY_ENV\s*=\s*['"]prod['"]/;

/**
 * Jonkins's latest finished build, if it built web01's latest commit.
 * Otherwise, a result saying what to do first.
 */
async function pushedBuild(vms: VMs): Promise<{ run: Run; log: string } | CheckResult> {
	const local = await gitLog(vms.web01, 'darts-shop');
	const remote = (await gitLog(vms.gitbit, 'darts-shop'))[0];
	if (remote && !local.some((c) => c.hash === remote.hash))
		return { ok: false, message: "GitBit has commits that web01 doesn't. Get them first: git pull." };
	if (local[0] && remote && local[0].hash !== remote.hash)
		return { ok: false, message: `GitBit doesn't have your latest commit, ${local[0].hash.slice(0, 7)}, so Jonkins hasn't built it. Push it: git push.` };
	const run = await buildOf(vms.gitbit, remote?.hash);
	if (!run) return { ok: false, message: "Jonkins hasn't built anything yet. Commit your Jonkinsfile and push it to GitBit." };
	if (run.status === 'RUNNING' || (remote && !remote.hash.startsWith(run.hash)))
		return { ok: false, message: "Jonkins hasn't finished building your latest push. Give it a few more seconds, then check again." };
	return { run, log: await jonkinsLog(vms.gitbit, run.n) };
}
const failed = (b: { run: Run; log: string } | CheckResult): b is CheckResult => 'ok' in b;

export const sprint3: Sprint = {
	number: 3,
	title: 'Works in dev',
	servers: [
		{ name: 'web01', ip: '10.5.0.21/24', terminal: true, setup: '' },
		{ name: 'gitbit', ip: '10.5.0.23/24', setup: '' },
	],
	intro: [
		{
			from: 'Derek',
			text: "Morning, {name}. I've bought us a Jonkins. Every time someone pushes to GitBit, it builds the shop. Automatically. That's the DevOps.",
		},
		{
			from: 'Brant',
			text: "Back from holiday. I've put an SSH key on web01 for you, so pushing to GitBit doesn't ask for a password any more.",
		},
		{ from: 'Kev', text: "I've added a build script. It'll prove my code works. It works on my machine." },
		{
			from: 'Priya',
			text: "Kev changed the database password after last week. It's stored in Jonkins as a credential called darts-db. Nobody else needs to know it.",
		},
	],
	done: [
		{
			from: 'Derek',
			text: 'Every push gets built, and when it breaks we know who did it within minutes? I was promised this in 2009. Sprint review.',
		},
	],
	tickets: [
		{
			id: 'DART-301',
			title: 'Set up Jonkins for the shop',
			from: 'Derek',
			points: 3,
			body: [
				"Jonkins builds whatever a file called Jonkinsfile, at the top of the repo, tells it to. The shop doesn't have one. Kev's build script is build.sh.",
				'Write a Jonkinsfile with one stage, Build, that runs ./build.sh. Commit it and push to GitBit. Jonkins builds every push.',
			],
			steps: [
				{ text: "Go to the shop and look at Kev's build script.", cmd: 'cd ~/darts-shop\nls\ncat build.sh' },
				{
					text: "Create the Jonkinsfile. It's the same shape as a real Jenkinsfile: a pipeline, with stages, each with steps. sh runs a shell command. Paste all of this.",
					cmd: `cat > Jonkinsfile <<'EOF'\n${JONKINSFILE}EOF`,
					done: async (vms) => (await shopFile(vms, 'Jonkinsfile')) !== null,
				},
				{
					text: 'Commit it and push. Your SSH key means no password. GitBit tells Jonkins, and the build starts.',
					cmd: 'git add Jonkinsfile\ngit commit -m "Add a Jonkinsfile"\ngit push',
					done: async (vms) => (await gitFiles(vms.gitbit, 'darts-shop')).includes('Jonkinsfile'),
				},
				{ text: "Watch the Jonkins panel in Tools. The build runs, and fails. That's fine for now: press Check my work." },
			],
			opened: 'Jonkins is very good. The salesman said so.',
			thanks: "A build server! Is it doing the DevOps now? It's gone red. Is red good?",
			check: async (vms) => {
				if (!(await gitFiles(vms.gitbit, 'darts-shop')).includes('Jonkinsfile'))
					return { ok: false, message: "GitBit has no Jonkinsfile yet. Commit it, then push it with git push." };
				const run = await buildOf(vms.gitbit, (await gitLog(vms.gitbit, 'darts-shop'))[0]?.hash);
				if (!run) return { ok: false, message: "Jonkins hasn't started a build yet. Give it a few seconds, then check again." };
				const log = await jonkinsLog(vms.gitbit, run.n);
				if (/no stages/.test(log))
					return { ok: false, message: "Jonkins can't find a stage with an sh step in your Jonkinsfile. Compare it with the one in the Stuck? steps." };
				if (!/stage: Build/.test(log)) return { ok: false, message: "Jonkins ran, but there's no stage called Build. Name the stage 'Build'." };
				return {
					ok: true,
					message: `Jonkins built your push as build #${run.n}. It failed, but that's the point: now every push is built on a clean machine, and you can read why.`,
				};
			},
		},
		{
			id: 'DART-302',
			title: 'Build fails: Permission denied',
			from: 'Tom',
			points: 2,
			blockedBy: ['DART-301'],
			body: [
				"Jonkins says './build.sh: Permission denied'. Kev types 'sh build.sh' on his laptop, so he never noticed.",
				'Linux only runs a file as a program if it has the execute permission, and Git records that permission. Fix it in the repo, not on the build server.',
			],
			steps: [
				{
					text: "Read the console in the Jonkins panel. Then look at the file's permissions: no x means it can't be run as a program.",
					cmd: 'cd ~/darts-shop\nls -l build.sh',
				},
				{ text: 'Make it executable. Git sees the change.', cmd: 'chmod +x build.sh\ngit status' },
				{
					text: 'Commit and push. Jonkins builds again.',
					cmd: 'git commit -am "Make build.sh executable"\ngit push',
					done: async (vms) => {
						const run = (await jonkinsRuns(vms.gitbit))[0];
						return run && run.status !== 'RUNNING' ? jonkinsExecutable(vms.gitbit, run.n) : false;
					},
				},
				{ text: 'The build gets further, then fails on something else. Press Check my work.' },
			],
			opened: "It's Linux, isn't it? Linux hates Kev.",
			thanks: 'New error! That counts as progress, right?',
			check: async (vms) => {
				const jf = (await shopFile(vms, 'Jonkinsfile')) ?? '';
				if (/chmod|(^|[\s'"])(ba)?sh\s+(\.\/)?build\.sh/m.test(jf.replace(/sh\s+'\.\/build\.sh'/, '')))
					return {
						ok: false,
						message: 'That works around it in the Jonkinsfile, so every other machine still has the problem. Fix the permission in Git: chmod +x build.sh, commit, push. Then put the Jonkinsfile back.',
					};
				const b = await pushedBuild(vms);
				if (failed(b)) return b;
				if (/Permission denied/.test(b.log) || !(await jonkinsExecutable(vms.gitbit, b.run.n)))
					return { ok: false, message: "Jonkins still gets Permission denied. Make build.sh executable, commit, and push." };
				return { ok: true, message: 'build.sh is executable in Git, so it runs on every machine that checks it out.' };
			},
		},
		{
			id: 'DART-303',
			title: 'The build fails, but it works on my machine',
			from: 'Kev',
			points: 5,
			blockedBy: ['DART-302'],
			body: [
				"Jonkins says it can't open build.conf. It's right there on my laptop! Can't Jonkins just use my laptop?",
				'Jonkins builds from what is in Git, on a clean machine. Anything the build needs has to be in the repo. Except secrets.',
			],
			ask: {
				label: 'Ask Kev for his build.conf',
				reply: ['Here you go:', `port=8080\ndb=db01\nDB_PASSWORD=${DB_PASSWORD}`, "Don't tell Priya I sent you that."],
			},
			steps: [
				{ text: 'Read the error in the Jonkins console. Then check: is build.conf in the repo?', cmd: 'cd ~/darts-shop\ngit ls-files' },
				{
					text: 'Ask Kev for his build.conf (the button on this ticket). Create the file with his settings, but leave out the password: secrets never go in Git.',
					cmd: "printf 'port=8080\\ndb=db01\\n' > build.conf\ncat build.conf",
					done: async (vms) => (await shopFile(vms, 'build.conf')) !== null,
				},
				{
					text: 'Commit and push.',
					cmd: 'git add build.conf\ngit commit -m "Add the build config"\ngit push',
					done: async (vms) => (await gitFiles(vms.gitbit, 'darts-shop')).includes('build.conf'),
				},
				{ text: "The build gets further, then stops at the password. That's the next ticket. Press Check my work." },
			],
			opened: 'It works on my machine.',
			thanks: "So my laptop isn't production? Nobody told me that.",
			check: async (vms) => {
				const conf = (await shopFile(vms, 'build.conf')) ?? '';
				if (conf.includes(DB_PASSWORD) || /DB_PASSWORD/.test(conf))
					return {
						ok: false,
						message:
							"build.conf has the database password in it. Priya is walking over. Take the DB_PASSWORD line out, commit and push. It's in the history now, so tell Kev it has to change again.",
					};
				const b = await pushedBuild(vms);
				if (failed(b)) return b;
				if (!/Building the Darts shop/.test(b.log))
					return { ok: false, message: "Jonkins still can't load build.conf. Is it committed and pushed? Check with git ls-files." };
				return { ok: true, message: 'build.conf is in Git, so the build works on any machine, not just Kev\'s laptop.' };
			},
		},
		{
			id: 'DART-304',
			title: 'The build needs the database password',
			from: 'Priya',
			points: 3,
			blockedBy: ['DART-303'],
			body: [
				"The build now stops: DB_PASSWORD is not set. Kev wants to paste the password into the Jonkinsfile. He can't.",
				"It's stored in Jonkins as a credential with the ID darts-db. Use it in an environment block in the Jonkinsfile. Jonkins hands it to the build, and hides it in the console.",
			],
			steps: [
				{
					text: "Open the Jonkinsfile and add these lines after 'agent any'. credentials() looks the secret up in Jonkins, so it never appears in Git. In nano: paste, then Ctrl+O, Enter to save and Ctrl+X to exit.",
					cmd: "nano Jonkinsfile\n    environment {\n        DB_PASSWORD = credentials('darts-db')\n    }",
					done: async (vms) => CREDENTIAL.test((await shopFile(vms, 'Jonkinsfile')) ?? ''),
				},
				{ text: 'Commit and push.', cmd: 'git commit -am "Use the darts-db credential"\ngit push' },
				{ text: 'Watch the build go green. In the console, the password shows as ****. Then press Check my work.' },
			],
			opened: 'Kev, step away from the Jonkinsfile.',
			thanks: 'Green, and the password shows as ****. This is the happiest I have been in months.',
			check: async (vms) => {
				const jf = (await shopFile(vms, 'Jonkinsfile')) ?? '';
				if (jf.includes(DB_PASSWORD))
					return {
						ok: false,
						message:
							"The password is written in the Jonkinsfile, so it's in Git for anyone to read. Use credentials('darts-db') instead, commit and push. Then it has to be changed, again.",
					};
				if (!CREDENTIAL.test(jf)) return { ok: false, message: "The Jonkinsfile doesn't use credentials('darts-db') yet." };
				const b = await pushedBuild(vms);
				if (failed(b)) return b;
				if (b.run.status !== 'SUCCESS')
					return { ok: false, message: `Build #${b.run.n} failed. Read its console in the Jonkins panel to see why.` };
				return { ok: true, message: 'The build is green, and the password lives only in Jonkins, never in Git or the console.' };
			},
		},
		{
			id: 'DART-305',
			title: 'Can Jonkins email me every build?',
			from: 'Sandra',
			points: 1,
			arrivesAfter: 2,
			interruption: true,
			body: ['Can Jonkins email me every time it builds anything? And everyone else too? I like to keep an eye on things.'],
			steps: [{ text: 'Who needs to know about a build, and when?' }],
			opened: "I'll print them out and file them.",
			thanks: "Fine. I'll screenshot the Jonkins panel instead.",
			choices: [
				{
					label: 'Email everyone about every build',
					result: {
						ok: false,
						message:
							'By Friday everyone has 300 Jonkins emails and a filter that deletes them, so nobody sees the one that matters. Remember the backup cron job?',
					},
				},
				{
					label: 'Email whoever broke it, only when a build fails',
					result: {
						ok: true,
						message: 'Alerts go to someone who can act on them, only when something needs doing. Everyone else can look at the Jonkins panel.',
					},
				},
				{
					label: 'Turn Jonkins emails off',
					result: { ok: false, message: 'Then a broken build stays red for a week, and nobody notices until a release.' },
				},
			],
		},
		{
			id: 'DART-306',
			title: 'Prod is getting dev builds',
			from: 'Kev',
			points: 3,
			blockedBy: ['DART-303'],
			body: [
				"The Jonkins console says 'Building the Darts shop for dev', and those builds go to production. build.sh reads DEPLOY_ENV, and if it isn't set, it uses dev.",
				"Don't change the code: the same code should build for any environment. Set DEPLOY_ENV to prod in the Jonkinsfile's environment block.",
			],
			steps: [
				{ text: 'See where build.sh picks the environment.', cmd: 'cd ~/darts-shop\ngrep DEPLOY_ENV build.sh' },
				{
					text: "Add this line inside the environment block in the Jonkinsfile. If there's no environment block yet, add one after 'agent any', as in DART-304.",
					cmd: "nano Jonkinsfile\n        DEPLOY_ENV = 'prod'",
					done: async (vms) => PROD.test((await shopFile(vms, 'Jonkinsfile')) ?? ''),
				},
				{ text: "Commit, push, and check the console says prod. Then press Check my work.", cmd: 'git commit -am "Build for prod"\ngit push' },
			],
			opened: 'To be fair, it does work in dev.',
			thanks: 'Prod builds for prod. Who knew?',
			check: async (vms) => {
				const jf = (await shopFile(vms, 'Jonkinsfile')) ?? '';
				const b = await pushedBuild(vms);
				if (failed(b)) return b;
				if (!/Building the Darts shop for prod/.test(b.log))
					return { ok: false, message: `Build #${b.run.n} still says it's building for dev. Set DEPLOY_ENV = 'prod' in the Jonkinsfile, commit and push.` };
				if (!PROD.test(jf))
					return {
						ok: false,
						message: "The build says prod, but not because of the Jonkinsfile. Put build.sh back, and set DEPLOY_ENV in the Jonkinsfile's environment block instead.",
					};
				return { ok: true, message: 'The same code builds for any environment. The pipeline says which one.' };
			},
		},
		{
			id: 'DART-307',
			title: 'Friday, 4:55pm: who broke the build?',
			from: 'Derek',
			points: 3,
			arrivesAfter: 6,
			body: [
				"Jonkins has gone red. Someone pushed something. I'm meant to be at the pub at five.",
				"Find which commit broke it and who pushed it, then undo it without rewriting history. Your copy on web01 doesn't have the new commit yet: pull it from GitBit first.",
			],
			steps: [
				{ text: 'Look at the Jonkins panel: the red build names the commit and its author. Read its console to see what failed.' },
				{
					text: 'Get the new commit from GitBit. pull fetches it and adds it to your branch.',
					cmd: 'cd ~/darts-shop\ngit pull\ngit log --oneline -3',
					done: async (vms) => (await gitLog(vms.web01, 'darts-shop')).some((c) => c.subject === 'Tidy up file names'),
				},
				{
					text: "Undo it with a new commit, as you did with Tom's price change. Put the commit's short hash in place of HASH.",
					cmd: 'git revert --no-edit HASH',
				},
				{ text: 'Push, and watch Jonkins go green. Then press Check my work.', cmd: 'git push' },
			],
			opened: "It's always 4:55 on a Friday.",
			thanks: 'Green by 5:01. Tom, a word. On Monday.',
			check: async (vms) => {
				const remote = await gitLog(vms.gitbit, 'darts-shop');
				const tom = remote.findIndex((c) => c.subject === 'Tidy up file names');
				if (tom < 0)
					return {
						ok: false,
						message: "Tom's commit has gone from GitBit's history. That's rewriting shared history. Reset the sprint and use git revert.",
					};
				const b = await pushedBuild(vms);
				if (failed(b)) return b;
				if (b.run.status !== 'SUCCESS')
					return { ok: false, message: `Build #${b.run.n} is still red. Read its console in the Jonkins panel.` };
				if (!remote.slice(0, tom).some((c) => c.subject.startsWith('Revert')))
					return {
						ok: true,
						message: "Green again, and Tom's commit is still in the history. Next time, git revert HASH undoes it and says which commit it undid.",
					};
				return { ok: true, message: "Found Tom's commit from the red build, reverted it, and Jonkins is green. Everyone can see what happened." };
			},
		},
	],
	retro: [
		{
			question: 'Why does Jonkins build every push, on its own machine?',
			options: [
				"To prove the code works somewhere other than the developer's laptop",
				'Because it is faster than a laptop',
				'So developers can stop testing',
			],
			correct: 0,
			why: "A clean build server only has what is in Git. If it builds there, it doesn't depend on anyone's laptop.",
		},
		{
			question: 'The build needs a password. Where should it come from?',
			options: ['A file in the repo', "The build server's credentials store", 'The Jonkinsfile'],
			correct: 1,
			why: "Anything in Git can be read by everyone with a copy, forever. Credentials stay on the build server, and are hidden in its console.",
		},
		{
			question: 'How should the same code be built for dev and for prod?',
			options: ['Keep a separate copy of the code for each', 'Set the environment in the pipeline', 'Edit build.sh before each release'],
			correct: 1,
			why: 'One codebase, with the environment passed in, means what you tested is what you ship.',
		},
		{
			question: 'Who should get an email when a build fails?',
			options: ['Everyone, every build', 'Whoever can fix it, when it fails', 'Nobody'],
			correct: 1,
			why: 'Alerts nobody acts on train people to ignore alerts. Send them to someone who can act, when action is needed.',
		},
	],
	translation: [
		['Jonkins', 'Jenkins, GitHub Actions or GitLab CI: continuous integration (CI) servers.'],
		['Jonkinsfile', 'A Jenkinsfile, with the same pipeline, stages and steps.'],
		['Console output', 'Every CI server keeps a log of each build. Reading it is most of the job.'],
		["credentials('id')", 'Jenkins credentials, or secrets in GitHub Actions and GitLab CI. Masked in the log.'],
		['environment { ... }', 'Environment variables set by the pipeline, the same in every CI tool.'],
		['chmod +x and Git', 'Git stores the execute bit. A script that works for you may not run anywhere else.'],
		['SSH keys', 'How you log in to servers and push to Git hosts without typing a password.'],
		['git pull', 'Fetches new commits from the remote and adds them to your branch.'],
	],
	next: 'Sprint 4, The pipeline, adds automated tests and deploys.',
	promotion: "Kev has started saying 'it works on Jonkins'. It's progress.",
};

/** Commits that both servers make identically, so their hashes match. */
const SPRINT2_END = `${REVERT_TOM}\n${UNTRACK_ENV}`;
const KEV_COMMIT = `cp /tmp/kev-build.sh build.sh
chmod 644 build.sh
git add build.sh
GIT_AUTHOR_NAME='Kev Malone' GIT_COMMITTER_NAME='Kev Malone' GIT_AUTHOR_EMAIL=kev@darts.example GIT_COMMITTER_EMAIL=kev@darts.example \\
GIT_AUTHOR_DATE='2014-10-20T17:55:00+01:00' GIT_COMMITTER_DATE='2014-10-20T17:55:00+01:00' git commit -qm "Add a build script"`;
const TOM_BREAK = `git mv index.html home.html
GIT_AUTHOR_NAME=Tom GIT_COMMITTER_NAME=Tom GIT_AUTHOR_EMAIL=tom@darts.example GIT_COMMITTER_EMAIL=tom@darts.example \\
GIT_AUTHOR_DATE='2014-10-24T16:55:00+01:00' GIT_COMMITTER_DATE='2014-10-24T16:55:00+01:00' git commit -qm "Tidy up file names"`;

const FILES = {
	'/tmp/darts-shop.tgz': DARTS_SHOP_REPO,
	'/tmp/kev-build.sh': btoa(KEV_BUILD),
};

sprint3.servers[0].files = { ...FILES, '/tmp/id_ed25519': btoa(GAME_KEY) };
sprint3.servers[0].setup = `${GIT_COMMON}
# Brant's SSH key, so pushes to GitBit need no password.
H=/home/$P
mkdir -p $H/.ssh
mv /tmp/id_ed25519 $H/.ssh/id_ed25519
printf 'Host gitbit\\n    StrictHostKeyChecking accept-new\\n' > $H/.ssh/config
chmod 700 $H/.ssh && chmod 600 $H/.ssh/id_ed25519 $H/.ssh/config
chown -R "$P:$P" $H/.ssh

# The shop as sprint 2 left it, plus Kev's build script, tracking GitBit.
${asPlayer(`git config --global user.name "$u"
git config --global user.email "$u@darts.example"
git config --global pull.rebase false
tar -xzf /tmp/darts-shop.tgz -C ~
cd ~/darts-shop
mkdir -p .git/hooks
cp /usr/share/desk/git-template/hooks/reference-transaction .git/hooks/
${SPRINT2_END}
${KEV_COMMIT}
git remote add gitbit gitbit:darts-shop.git
git update-ref refs/remotes/gitbit/main HEAD
git branch -q -u gitbit/main`)}
rm -f /tmp/darts-shop.tgz /tmp/kev-build.sh
`;

sprint3.servers[1].files = {
	...FILES,
	'/tmp/id_ed25519.pub': btoa(GAME_KEY_PUB),
	'/tmp/jonkins-build': btoa(JONKINS_BUILD),
	'/tmp/post-receive': btoa(POST_RECEIVE),
};
sprint3.servers[1].setup = `${GIT_COMMON}
H=/home/$P
mkdir -p $H/.ssh
mv /tmp/id_ed25519.pub $H/.ssh/authorized_keys
chmod 700 $H/.ssh && chmod 600 $H/.ssh/authorized_keys
chown -R "$P:$P" $H/.ssh

# Jonkins: the runner, its credentials store, and where it writes builds.
install -m 755 /tmp/jonkins-build /usr/local/bin/jonkins-build
mkdir -p /var/lib/desk/jonkins /var/lib/jonkins/credentials
printf '%s' '${DB_PASSWORD}' > /var/lib/jonkins/credentials/darts-db
chown -R "$P:$P" /var/lib/desk/jonkins /var/lib/jonkins
chmod 700 /var/lib/jonkins/credentials

# GitBit: the same history as web01. A working copy in /tmp lets the restore
# scripts and Tom's push (DART-307) make commits here too.
${asPlayer(`${GITBIT_WORK}
${SPRINT2_END}
${KEV_COMMIT}
git init -q --bare ~/darts-shop.git
git push -q ~/darts-shop.git main`)}
install -o "$P" -g "$P" -m 755 /tmp/post-receive $H/darts-shop.git/hooks/post-receive
`;

// Redo finished work when the servers start fresh after a refresh.
const ADD_ENV = `addenv() {
  if grep -q 'environment {' Jonkinsfile; then
    awk -v l="        $1 = $2" '{ print } /environment \\{/ { print l }' Jonkinsfile > Jonkinsfile.new
  else
    awk -v l="        $1 = $2" '{ print } /agent any/ { print "    environment {"; print l; print "    }" }' Jonkinsfile > Jonkinsfile.new
  fi
  mv Jonkinsfile.new Jonkinsfile
}`;
const both = (commands: string) => ({
	web01: asPlayer(`export GIT_AUTHOR_DATE='2014-10-27T09:00:00+00:00' GIT_COMMITTER_DATE='2014-10-27T09:00:00+00:00'
${ADD_ENV}
cd ~/darts-shop
${commands}
git update-ref refs/remotes/gitbit/main HEAD`),
	gitbit: asPlayer(`export GIT_AUTHOR_DATE='2014-10-27T09:00:00+00:00' GIT_COMMITTER_DATE='2014-10-27T09:00:00+00:00'
${ADD_ENV}
cd /tmp/restore/darts-shop
${commands}
JONKINS_SKIP=1 git push -q ~/darts-shop.git main`),
});
const restore = (id: string, commands: string) => {
	const t = sprint3.tickets.find((x) => x.id === id);
	if (t) t.restore = both(commands);
};
restore('DART-301', `cat > Jonkinsfile <<'JF'\n${JONKINSFILE}JF\ngit add Jonkinsfile\ngit commit -qm "Add a Jonkinsfile"`);
restore('DART-302', 'chmod +x build.sh\ngit commit -qam "Make build.sh executable"');
restore('DART-303', `printf 'port=8080\\ndb=db01\\n' > build.conf\ngit add build.conf\ngit commit -qm "Add the build config"`);
restore('DART-304', `addenv DB_PASSWORD "credentials('darts-db')"\ngit commit -qam "Use the darts-db credential"`);
restore('DART-306', `addenv DEPLOY_ENV "'prod'"\ngit commit -qam "Build for prod"`);
restore('DART-307', `${TOM_BREAK}\ngit revert --no-edit HEAD`);

// After a restore, Jonkins builds the latest commit once, so the panel isn't empty.
sprint3.afterRestore = {
	gitbit: asPlayer('cd ~/darts-shop.git\nsetsid /usr/local/bin/jonkins-build "$(git rev-parse main)" </dev/null >/dev/null 2>&1 &'),
};

// DART-307: on Friday afternoon, Tom pushes a tidy-up that breaks the build.
const ticket307 = sprint3.tickets.find((t) => t.id === 'DART-307');
if (ticket307)
	ticket307.onArrive = {
		gitbit: asPlayer(`cd /tmp/restore/darts-shop
git pull -q --ff-only ~/darts-shop.git main
${TOM_BREAK}
git push -q ~/darts-shop.git main`),
	};

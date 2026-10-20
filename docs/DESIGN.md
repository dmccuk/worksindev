# Works in Dev: game design

A browser game that teaches real DevOps skills. You are a new junior operations engineer at Darts Unlimited, a fictional company, in 2014, at the height of the DevOps movement. Developers throw builds over the fence with a note saying "works in dev". Your job is to make them work in production, then fix the reasons they keep breaking, until the fence comes down.

Sister project of [learndevops.co.uk](https://dmccuk.github.io/learndevops/): same skills, told as a story. When you finish the game, you "get a real job", which hands you on to the course.

## Rules that do not bend

1. **The skills are real.** The terminal is real Linux (the v86 in-browser VM from learndevops). Commands, Git, shell scripts and config files work exactly as they do at work.
2. **The tools are parodies, but they behave like the real thing.** A `Jonkinsfile` uses the same structure as a `Jenkinsfile`. Every sprint ends with a "Real-world translation" card: "Jonkins is Jenkins. What you did works the same way there."
3. **A ticket closes only when a check script confirms it.** "It works on my machine" is not accepted.
4. **The joke is the situation, never the person.** Stereotypes are by job role and affectionate. Nothing based on gender, age, nationality or any other personal trait. Everyone means well.
5. **Facts are real.** History notes about DevOps need a source. Fiction is clearly fiction.
6. **No tracking.** Progress saves in the player's own browser. No accounts, no analytics, no third-party scripts.

## Structure: one sprint per level

Each level is a sprint. Work arrives in the **Jeera** ticket queue; the player does not choose what arrives, but does choose the order to work it.

- **Stand-up** opens the sprint: the manager's briefing, the goal, and what's new this sprint.
- **Tickets** of mixed size, shown as story points: small (1), medium (3), large (5 to 8).
- **Interruptions** arrive mid-sprint and cannot be refused ("URGENT: printer broken").
- **The burndown chart** is the progress bar.
- **Shortcuts come back.** Fix something by hand instead of automating it and the ticket reopens next sprint, and the fence gets taller.
- **Sprint review** closes the sprint: every committed ticket must be done to be promoted.
- **Retro** is the quiz: what went well, what didn't, and why.
- **Promotion**: a new stripe, and the fence gets shorter.

**Each sprint introduces one new tool or concept**, and keeps using the ones before it.

| Sprint | Title | New tool or concept | Real-world equivalent |
| --- | --- | --- | --- |
| 1 | Onboarding | The shell, users, files, logs. The Jeera queue. | Linux, Jira |
| 2 | Who changed prod? | Version control. GitBit. | Git, GitHub |
| 3 | Works in dev | Builds, dependencies, environments. Jonkins. | Jenkins (CI) |
| 4 | The pipeline | Automated tests and deploys. Jonkins pipelines. | CI/CD |
| 5 | Fifty snowflakes | Configuration management across servers. Ansibubble. | Ansible |
| 6 | Dockle all the things | Containers and images. Dockle. | Docker |
| 7 | 3am | Monitoring, alerts, logs, on-call. Naggios. | Nagios, incident response |
| 8 | Ten deploys a day | Everything together. The fence comes down. | DevOps |

Epilogue (later): "2017. Have you heard of Kubernotes?"

## Sprint 1 in full: Onboarding

Stand-up (Derek, Head of IT): "Welcome aboard. Brant will show you round. He's on holiday. Here's your login."

| Ticket | From | Points | Task | Check |
| --- | --- | --- | --- | --- |
| DART-101 | Sandra | 1 | Reset my password, I'm locked out | Sandra's account password changed and unlocked |
| DART-102 | Monitoring | 3 | Disk full on web01 | Largest log found with `du`, rotated, `df` under 80% |
| DART-103 | Derek | 1 | What's my IP? | Correct address written in the ticket |
| DART-104 | Kev | 2 | Who keeps editing /etc/hosts? | Answer found in the logs with `grep` |
| DART-105 | Derek | 1 | URGENT: printer broken (interruption) | Reassigned to facilities, politely |
| DART-106 | Kev | 5 | Deploy my build, it works in dev | App running; the missing config file found and added |

DART-106 is the first build thrown over the fence. It fails because a config file exists only on Kev's laptop. The retro asks why, which sets up sprint 2.

Real-world translation card: users and passwords, `df`/`du`, `ip addr`, `grep` and log files, and "configuration that lives on one laptop is a bug".

## Cast (staff directory)

Extension numbers are port numbers, for people who know.

| Name | Role | Ext | Known for |
| --- | --- | --- | --- |
| You | Junior operations engineer | 1 | First week. Has a desk, mostly. |
| Derek Vance | Head of IT, your manager | 0 | Wants "the DevOps" by Friday. Loves a single pane of glass. |
| Brant Holloway | Senior sysadmin | 22 | Everything goes through Brant. Answers questions with `man`. |
| Sandra Price | Windows admin | 3389 | Screenshots everything. Has a fix in the registry. |
| Kev Malone | Lead developer | 8080 | "It works in dev." |
| Priya Nair | Security | 443 | Says no. Usually right. |
| Tom | The intern | 2375 | Already knows Dockle. Will not stop mentioning it. |

## Parody tools

| In the game | Real tool | What it does |
| --- | --- | --- |
| Jeera | Jira | Ticket queue and sprints |
| GitBit | GitHub | Hosts your Git repositories |
| Jonkins | Jenkins | Builds, tests and deploys code |
| Ansibubble | Ansible | Configures many servers at once |
| Dockle | Docker | Packages apps into containers |
| Naggios | Nagios | Monitoring and alerts |
| Kubernotes | Kubernetes | Runs containers at scale (epilogue) |

The parodies must look clearly fictional: no real logos, colours or layouts. The home page says they are parodies and not affiliated with the real products.

## The worker screen

One screen, like a real desk, with every panel sharing the space:

- **Queue**: the Jeera sprint board.
- **Ticket**: the selected ticket, its messages and its checks.
- **Terminal**: real Linux, one or more servers.
- **Tools**: tabs for the parody tools unlocked so far (GitBit, Jonkins, and so on).
- **Chat**: messages from the cast, interruptions and the manager.

Panels resize by dragging their borders, and any panel can be maximised and restored, so a player can make the terminal big, then go back to the queue and enlarge it to read a ticket. The layout is saved in the browser. On a phone, panels become tabs.

## Technical plan

- Astro static site on GitHub Pages, like learndevops.
- The terminal reuses learndevops's in-browser VM (v86 and an Alpine image from its GitHub releases). Several servers per sprint use its in-browser network.
- Parody tools are small in-page apps that read and write files inside the VM (for example, Jonkins runs the `Jonkinsfile` from the repo the player pushed to GitBit).
- Check scripts run inside the VM and report pass or fail to the page.
- Progress, stripes and layout are saved in `localStorage` only.

## First version

1. Home page. (Done.)
2. The worker screen at `/desk/` with resizable panels, the queue and the terminal. (Done.)
3. Sprint 1 playable end to end, with checks. (Done.)

Known limits of the in-browser VM, found while building sprint 1:

- `du` reports almost every file as 1 KB (the emulator's filesystem does not report disk blocks), so hints use `find -size` and `ls -lhS`.
- A file deleted while a program is reading it loses its contents at once, unlike real Linux. Setup scripts delete themselves only after they finish.
- After a panel is resized, Linux still uses the terminal width from start-up, so very long lines may wrap oddly. TODO: send the new size to the VM.

Then judge whether it is fun before building sprint 2 and GitBit.

## Open questions for the owner

- TODO(owner): public or private repository, and licence.
- TODO(owner): domain (worksindev.com / worksindev.co.uk not checked).

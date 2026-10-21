# Contributing to Works in Dev

Thanks for wanting to help. There are two ways in:

1. **Send a ticket from your career.** Lived through a real incident that would make a good ticket? [Open a war story issue](../../issues/new?template=war-story.yml). You don't need to write any code. If it becomes a ticket, you're credited in the game.
2. **Write code or a whole sprint.** Fork the repo, make your change, and open a pull request.

## House rules

These keep the game worth playing. Pull requests that break them won't be merged.

1. **The skills are real.** Every command a player types must work the same way on a real Linux server. The fake tools (Jeera, GitBit, Jonkins...) must behave like the real ones they parody.
2. **Checks read the server.** A ticket closes only when a check proves the work is done, by reading the VM's files. "It works on my machine" is not accepted.
3. **The joke is the situation, never the person.** Characters are job roles, written with affection. Nothing based on gender, age, nationality, religion, disability or any other personal trait.
4. **Facts are real.** History notes need a source. Fiction is clearly fiction.
5. **No tracking.** No analytics, no third-party scripts, no accounts. Progress stays in the player's browser.
6. **Plain UK English.** Short sentences. Say why before how.

## How a sprint is built

Each sprint is one file in `src/game/`, for example `sprint2.ts`, listed in `src/game/sprints.ts`. The shape is in `src/game/types.ts`:

- `servers`: the Linux servers it needs, each with a setup script that runs as root. `$P` is the player's username. One server has the terminal; the rest run in the background on the in-browser network.
- `tickets`: each with its story, a `check` (or a typed `answer`, or `choices`), and `steps` for the Stuck? coach. A step can have a `done` function so the coach knows the player has already done it.
- `retro`, `translation`, `intro`, `done`, `next` and `promotion`: the story around the work.
- A ticket can also have `blockedBy` (other tickets that must be done first), `restore` (shell that redoes its work when the servers start fresh after a refresh) and `onArrive` (shell that runs on a background server when it arrives, such as a colleague pushing a commit).

Things learned the hard way, in `docs/DESIGN.md`:

- Every program start costs about 0.4 seconds in the emulator. Keep setup scripts short, and use shell built-ins in anything that loops.
- Checks read files through the emulator, which can't see inside a tmpfs and treats an empty file as missing. Write state files with some content in them.
- Disk-space tickets need their own small filesystem; the main one reports 256 GB free.

To test locally, follow the README to run the site, then play the sprint end to end. Please describe in your pull request how you tested it.

## Licence of contributions

Works in Dev is licensed under [CC BY-NC-SA 4.0](LICENSE). By opening a pull request or a war story issue, you agree that:

- your contribution is your own work, or you have the right to share it;
- it is licensed to everyone under CC BY-NC-SA 4.0, like the rest of the project; and
- Dennis McCarthy may also use, change and license it under other terms, including commercially, so the project's future isn't blocked by any one contribution.

You keep the copyright in your contribution, and you're credited for it.

TODO(owner): have the contribution terms above checked by someone qualified before relying on them.

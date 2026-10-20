/**
 * The shape of a sprint. Each sprint file (sprint1.ts, sprint2.ts, ...)
 * exports one of these, and the desk plays whichever is current.
 */
import type { GameVM } from './vm';

export type Person = 'Derek' | 'Brant' | 'Sandra' | 'Kev' | 'Priya' | 'Tom' | 'Monitoring' | 'You';

export interface CheckResult {
	ok: boolean;
	message: string;
}

/** The sprint's servers, by name, e.g. vms.web01 */
export type VMs = Record<string, GameVM>;

export interface Step {
	/** What to do, in plain words */
	text: string;
	/** Commands to type, one per line, shown in a copyable block */
	cmd?: string;
	/** Whether the player has already done this step, checked on the VMs */
	done?: (vms: VMs) => Promise<boolean>;
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
	/** The "Stuck?" coach: steps, checked against the servers where possible */
	steps: Step[];
	/** What the reporter says in chat when you open the ticket */
	opened: string;
	/** What the reporter says when it's done */
	thanks: string;
	/** A typed answer, checked here */
	answer?: { label: string; check: (value: string) => CheckResult };
	/** A check against the VMs */
	check?: (vms: VMs) => Promise<CheckResult>;
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

export interface ServerSpec {
	name: string;
	/** Address on the in-browser network, e.g. 10.5.0.21/24 */
	ip: string;
	/** Shell script run as root at start. $P is the player's username. */
	setup: string;
	/** Shown in the terminal panel. Other servers run in the background. */
	terminal?: boolean;
}

export interface Sprint {
	number: number;
	title: string;
	servers: ServerSpec[];
	intro: { from: Person; text: string }[];
	done: { from: Person; text: string }[];
	tickets: Ticket[];
	retro: RetroQuestion[];
	translation: [string, string][];
	/** Shown after promotion */
	next: string;
}

/** Reads a state file a VM process writes, waiting a few seconds for it to change from `busy`. */
export async function readState(vm: GameVM, path: string, busy: string): Promise<string | undefined> {
	let state: string | undefined;
	for (let i = 0; i < 4; i++) {
		state = (await vm.readFile(path))?.trim();
		if (state !== busy) break;
		await new Promise((r) => setTimeout(r, 1000));
	}
	return state;
}

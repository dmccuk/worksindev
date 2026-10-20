/**
 * Everything the game saves, in one place. Today it lives in this browser's
 * localStorage only. When accounts arrive, this is the file to change.
 */
import type { Person } from './types';

export interface SprintProgress {
	done: string[];
	opened: string[];
	chat: { from: Person; text: string; time: string }[];
	promoted: boolean;
}

export interface GameProgress {
	/** The sprint the desk opens */
	current: number;
	username?: string;
}

const GAME = 'wid-game';
const sprintKey = (n: number) => `wid-sprint${n}`;

function read<T>(key: string): T | null {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage can be blocked; the game still works for this visit.
	}
}

export function loadGame(): GameProgress {
	const g = read<GameProgress>(GAME);
	if (g?.current) return g;
	// Before wid-game existed, the username lived with sprint 1.
	const old = read<{ username?: string }>(sprintKey(1));
	return { current: 1, username: old?.username };
}

export function saveGame(g: GameProgress) {
	write(GAME, g);
}

export function loadSprint(n: number): SprintProgress {
	const p = read<SprintProgress>(sprintKey(n));
	if (p?.done) return p;
	return { done: [], opened: [], chat: [], promoted: false };
}

export function saveSprint(n: number, p: SprintProgress) {
	write(sprintKey(n), p);
}

export function clearSprint(n: number) {
	try {
		localStorage.removeItem(sprintKey(n));
	} catch {
		// Nothing saved.
	}
}

import {
	type MessageKind,
	getHtmlFileUrl,
	listenForAnswer,
} from './shared.js';

// Only ever resolves, so a failed popup never blocks or breaks the following ones
let queue: Promise<void> = Promise.resolve();

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const previous = queue;
	const {promise, resolve} = Promise.withResolvers<void>();
	queue = promise;

	await previous;
	try {
		return await showOne(message, kind, defaultValue);
	} finally {
		// Delay the next popup regardless of whether this one succeeded or failed
		setTimeout(resolve, 500);
	}
}

async function showOne(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const originalActionPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message, kind, defaultValue)});
	const listener = listenForAnswer(5000);
	try {
		await chrome.action.openPopup();
		return await listener.answer;
	} finally {
		listener.dismiss();
		// Restoring can fail on Safari and must not override the answer
		await chrome.action.setPopup({popup: originalActionPopup}).catch(() => undefined);
	}
}

import {
	type MessageKind,
	getHtmlFileUrl,
	listenForAnswer,
	sleep,
} from './shared.js';

let queue: Promise<unknown> = Promise.resolve();

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const result = queue.then(async () => showOne(message, kind, defaultValue));
	// Wait for it to settle, even if it failed, then cool down. Only the next popup is delayed, not the answer
	queue = Promise.allSettled([result]).then(async () => sleep(500));
	return result;
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

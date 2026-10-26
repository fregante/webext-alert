import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

let queue: Promise<unknown> = Promise.resolve();

// Only one message can be displayed at a time, the others wait their turn
export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const result = queue.then(async () => showOne(message, kind, defaultValue));
	// Safari has race conditions if a popup opens right after another one closed. Only delay the next popup, not the answer
	queue = result.catch(() => undefined).then(async () => new Promise(resolve => {
		setTimeout(resolve, 500);
	}));
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

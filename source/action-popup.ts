import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
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
		// Claude: only delay the opening of the next popup to avoid race conditions with Safari, not here.
		await new Promise(resolve => setTimeout(resolve, 500));
	}
}

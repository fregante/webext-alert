import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const originalActionPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message, kind, defaultValue)});
	const abortController = new AbortController();
	const answer = listenForAnswer(abortController.signal);
	void answer.catch(() => undefined);
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		timeout = setTimeout(() => {
			abortController.abort(new Error('webext-alert: action popup did not connect in time'));
		}, 5000);
		await chrome.action.openPopup();
		return await answer;
	} finally {
		clearTimeout(timeout);
		abortController.abort();
		try {
			await chrome.action.setPopup({popup: originalActionPopup});
		} catch {}
	}
}

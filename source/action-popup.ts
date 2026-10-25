import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const originalActionPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message, kind, defaultValue)});
	const answer = listenForAnswer(5000);
	void answer.catch(() => undefined);
	try {
		await chrome.action.openPopup();
		return await answer;
	} finally {
		try {
			await chrome.action.setPopup({popup: originalActionPopup});
		} catch {}
	}
}

import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

export async function showInActionPopup(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const originalActionPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message, kind, defaultValue)});
	let listener: ReturnType<typeof listenForAnswer> | undefined;
	try {
		listener = listenForAnswer(5000);
		await chrome.action.openPopup();
		await listener.closed;
		return listener.getAnswer();
	} finally {
		listener?.stop();
		try {
			await chrome.action.setPopup({popup: originalActionPopup});
		} catch {}
	}
}

import oneEvent from 'webext-events/one-event';
import {isChrome} from 'webext-detect';
import css from 'bundle-text:../web/style.css';
import js from 'bundle-text:../web/main.js';
import {type MessageKind, getHtmlFileUrl, listenForAnswer} from './shared.js';

async function onWindowClose(watchedWindowId: number): Promise<void> {
	await oneEvent(chrome.windows.onRemoved, {
		filter: closedWindowId => closedWindowId === watchedWindowId,
	});
}

async function onWindowResize(windowId: number): Promise<void> {
	const response = await oneEvent(chrome.runtime.onMessage, {
		filter: (message: unknown) => typeof message === 'object' && message !== null && 'webextAlert' in message,
	});
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
	await chrome.windows.update(windowId, response![0].webextAlert);
}

function getPage(message = ''): string {
	return /* html */ `
		<!doctype html>
		<meta charset="utf-8" />
		<title>${chrome.runtime.getManifest().name}</title>
		<style>${css}</style>
		<body>
			<form method="dialog">
				<main>${message}</main>
				<button type="submit">Ok</button>
			</form>
		</body>
		<script>${js}</script>
	`;
}

async function openWindow(url: string): Promise<chrome.windows.Window | void> {
	const width = 420;
	const height = 180;

	// `chrome` is Promisified where the window is used
	try {
		return await chrome.windows.create({
			type: 'popup',
			focused: true,
			url,
			height,
			width,
		});
	} catch {
		// Firefox as always https://github.com/fregante/webext-alert/issues/13
	}
}

export async function showInWindow(message: string, kind: MessageKind, defaultValue: string): Promise<unknown> {
	const answerPromise = kind === 'alert' ? undefined : listenForAnswer(5000);
	void answerPromise?.catch(() => undefined);
	let answer: unknown;
	let window: chrome.windows.Window | void;
	if (kind === 'alert') {
		window = await openWindow('data:text/html,' + encodeURIComponent(getPage(message)));
	}

	window ??= await openWindow(getHtmlFileUrl(message, kind, defaultValue));

	if (window?.id === undefined) {
		// Last ditch effort
		console.log(message);
	} else {
		if (!isChrome()) {
			void onWindowResize(window.id);
		}

		await onWindowClose(window.id);
	}

	if (answerPromise && window?.id !== undefined) {
		answer = await answerPromise;
	}

	return answer;
}

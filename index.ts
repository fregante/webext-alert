import {oneEvent} from 'webext-events';
import {isBackgroundWorker, isChrome, isBackgroundPage} from 'webext-detect';
import css from 'bundle-text:./web/style.css';
import js from 'bundle-text:./web/main.js';

const defaultUrl = 'https://webext-alert.vercel.app/';
let htmlFileUrl = new URL(defaultUrl);

async function onPopupClose(watchedWindowId: number): Promise<void> {
	await oneEvent(chrome.windows.onRemoved, {
		filter: closedWindowId => closedWindowId === watchedWindowId,
	});
}

async function onPopupResize(windowId: number, tabId: number, signal: AbortSignal): Promise<void> {
	const result = await oneEvent(chrome.tabs.onUpdated, {
		signal,
		filter: (id, changeInfo) =>
			id === tabId && Boolean(changeInfo.url?.includes('#webext-alert=')),
	});
	if (!result) {
		return;
	}

	const [, changeInfo] = result;
	const parts = new URL(changeInfo.url!).hash.replace('#webext-alert=', '').split(',');
	const height = Number(parts[0]);
	const left = Number(parts[1]);
	const top = Number(parts[2]);
	if (height > 0 && Number.isFinite(left) && Number.isFinite(top)) {
		try {
			await chrome.windows.update(windowId, {height, left, top});
		} catch {
			// Window was already closed
		}
	}
}

function getPage(message = ''): string {
	return /* html */ `
		<!doctype html>
		<meta charset="utf-8" />
		<title>${chrome.runtime.getManifest().name}</title>
		<style>${css}</style>
		<body>
			<main>${message}</main>
			<button>Ok</button>
		</body>
		<script>${js}</script>
	`;
}

function getHtmlFileUrl(message: string): string {
	htmlFileUrl.searchParams.set('message', message);
	htmlFileUrl.searchParams.set('title', chrome.runtime.getManifest().name);
	return htmlFileUrl.href;
}

async function openPopup(url: string): Promise<chrome.windows.Window | void > {
	const width = 420;
	const height = 180;

	// `chrome` is Promisified where `popupAlert` is used
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

async function popupAlert(message: string): Promise<void> {
	message = message.trim();
	const popup = await openPopup('data:text/html,' + encodeURIComponent(getPage(message)))
		?? await openPopup(getHtmlFileUrl(message));

	if (popup?.id) {
		const closePromise = onPopupClose(popup.id);
		if (!isChrome() && popup.tabs?.[0]?.id) {
			const controller = new AbortController();
			void onPopupResize(popup.id, popup.tabs[0].id, controller.signal);
			await closePromise;
			controller.abort();
		} else {
			await closePromise;
		}
	} else {
		// Last ditch effort
		console.log(message);
	}
}

// `alert()` is not available in any service worker
// `alert()` is not available in any background context in Firefox and Safari
const webextAlert = isBackgroundWorker() || (!isChrome() && isBackgroundPage())
	? popupAlert
	: globalThis.alert ?? console.log;

export default webextAlert;

/**
 * Change the HTML page to be used in certain scenarios (Firefox).
 * This can be used to add offline support for Firefox.
 *
 * @param url If not provided, the default URL will be used
*/
// eslint-disable-next-line unicorn/prevent-abbreviations
export function localWebExtAlertHtml(url = defaultUrl): void {
	htmlFileUrl = new URL(url, chrome.runtime.getURL('/'));
}

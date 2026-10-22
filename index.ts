import oneEvent from 'webext-events/one-event';
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

async function onPopupResize(windowId: number): Promise<void> {
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

async function openWithActionPopup(message: string): Promise<void> {
	const originalPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message)});
	try {
		const timeoutMs = 5000;
		// Register listener before opening popup to avoid race condition
		const closePromise = new Promise<void>((resolve, reject) => {
			function onConnect(port: chrome.runtime.Port) {
				if (port.name !== 'webext-alert') {
					return;
				}

				clearTimeout(timeout);
				chrome.runtime.onConnect.removeListener(onConnect);
				port.onDisconnect.addListener(() => {
					resolve();
				});
			}

			chrome.runtime.onConnect.addListener(onConnect);
			const timeout = setTimeout(() => {
				chrome.runtime.onConnect.removeListener(onConnect);
				reject(new Error('webext-alert: popup did not connect in time'));
			}, timeoutMs);
		});
		await chrome.action.openPopup();
		await closePromise;
	} finally {
		await chrome.action.setPopup({popup: originalPopup});
	}
}

async function openPopup(url: string): Promise<chrome.windows.Window | void> {
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

	try {
		await openWithActionPopup(message);
		return;
	} catch {
		// Continue with the alternatives
	}

	const popup = await openPopup('data:text/html,' + encodeURIComponent(getPage(message)))
		?? await openPopup(getHtmlFileUrl(message));

	if (popup?.id === undefined) {
		// Last ditch effort
		console.log(message);
	} else {
		if (!isChrome()) {
			void onPopupResize(popup.id);
		}

		await onPopupClose(popup.id);
	}
}

// `alert()` is not available in any service worker
// `alert()` is not available in any background context in Firefox and Safari
const webextAlert = isBackgroundWorker() || (!isChrome() && isBackgroundPage())
	? popupAlert
	: globalThis.alert ?? console.log;

export default webextAlert;

/**
 Change the HTML page to be used in certain scenarios (Firefox).
 This can be used to add offline support for Firefox.

 @param url If not provided, the default URL will be used
*/
export function localWebExtAlertHtml(url = defaultUrl): void {
	htmlFileUrl = new URL(url, chrome.runtime.getURL('/'));
}

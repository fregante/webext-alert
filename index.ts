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

type PopupKind = 'alert' | 'confirm' | 'prompt';

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

function getHtmlFileUrl(message: string, kind: PopupKind = 'alert', defaultValue = ''): string {
	const url = new URL(htmlFileUrl);
	url.searchParams.set('message', message);
	url.searchParams.set('title', chrome.runtime.getManifest().name);
	if (kind !== 'alert') {
		url.searchParams.set('kind', kind);
		url.searchParams.set('default', defaultValue);
	}

	return url.href;
}

// Register the listener before opening the popup to avoid race conditions
function listenForPopup(timeoutMs?: number) {
	let answer: unknown;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let onConnect: ((port: chrome.runtime.Port) => void) | undefined;

	function stop() {
		clearTimeout(timeout);
		if (onConnect) {
			chrome.runtime.onConnect.removeListener(onConnect);
		}
	}

	const closed = new Promise<void>((resolve, reject) => {
		onConnect = port => {
			if (port.name !== 'webext-alert') {
				return;
			}

			stop();
			port.onMessage.addListener((message: unknown) => {
				answer = (message as {answer?: unknown}).answer;
			});
			port.onDisconnect.addListener(() => {
				resolve();
			});
		};

		chrome.runtime.onConnect.addListener(onConnect);
		if (timeoutMs !== undefined) {
			timeout = setTimeout(() => {
				stop();
				reject(new Error('webext-alert: popup did not connect in time'));
			}, timeoutMs);
		}
	});

	return {closed, stop, getAnswer: () => answer};
}

async function openWithActionPopup(message: string, kind: PopupKind, defaultValue: string): Promise<unknown> {
	const originalPopup = await chrome.action.getPopup({});
	await chrome.action.setPopup({popup: getHtmlFileUrl(message, kind, defaultValue)});
	try {
		const listener = listenForPopup(5000);
		await chrome.action.openPopup();
		await listener.closed;
		return listener.getAnswer();
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

async function showPopup(kind: PopupKind, message: string, defaultValue = ''): Promise<unknown> {
	message = message.trim();

	// The answer can only be sent back by an extension page, not by a `data:` URL or a remote page
	if (kind !== 'alert' && !htmlFileUrl.protocol.endsWith('extension:')) {
		throw new Error(`webext-alert: ${kind}() requires a local page, call localWebExtAlertHtml() first`);
	}

	try {
		return await openWithActionPopup(message, kind, defaultValue);
	} catch {
		// Continue with the alternatives
	}

	const listener = listenForPopup();
	try {
		let popup: chrome.windows.Window | void;
		if (kind === 'alert') {
			popup = await openPopup('data:text/html,' + encodeURIComponent(getPage(message)));
		}

		popup ??= await openPopup(getHtmlFileUrl(message, kind, defaultValue));

		if (popup?.id === undefined) {
			// Last ditch effort
			console.log(message);
		} else {
			if (!isChrome()) {
				void onPopupResize(popup.id);
			}

			await onPopupClose(popup.id);
		}
	} finally {
		listener.stop();
	}

	return listener.getAnswer();
}

async function popupAlert(message: string): Promise<void> {
	await showPopup('alert', message);
}

// `alert()` is not available in any service worker
// `alert()` is not available in any background context in Firefox and Safari
const shouldUsePopup = isBackgroundWorker() || (!isChrome() && isBackgroundPage());

const webextAlert = shouldUsePopup
	? popupAlert
	: globalThis.alert ?? console.log;

export {webextAlert as alert};

/**
 Like `confirm()`, but also available where the native one isn't.

 Outside of the native `confirm()` contexts, `localWebExtAlertHtml()` must be called first.

 @returns `true` if the user clicked OK, `false` if they cancelled or closed the popup
*/
// eslint-disable-next-line unicorn/consistent-boolean-name -- Same name as the native `confirm()`
export async function confirm(message = ''): Promise<boolean> {
	return shouldUsePopup
		? await showPopup('confirm', message) === true
		: globalThis.confirm?.(message) ?? false;
}

/**
 Like `prompt()`, but also available where the native one isn't.

 Outside of the native `prompt()` contexts, `localWebExtAlertHtml()` must be called first.

 @returns The text entered by the user, or `null` if they cancelled or closed the popup
*/
// eslint-disable-next-line @typescript-eslint/no-restricted-types -- Same return value as the native `prompt()`
export async function prompt(message = '', defaultValue = ''): Promise<string | null> {
	if (!shouldUsePopup) {
		return globalThis.prompt?.(message, defaultValue) ?? null;
	}

	const answer = await showPopup('prompt', message, defaultValue);
	return typeof answer === 'string' ? answer : null;
}

/**
 Change the HTML page to be used in certain scenarios (Firefox).
 This can be used to add offline support for Firefox.

 @param url If not provided, the default URL will be used
*/
export function localWebExtAlertHtml(url = defaultUrl): void {
	htmlFileUrl = new URL(url, chrome.runtime.getURL('/'));
}

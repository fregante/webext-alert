import {oneEvent} from 'webext-events';
import {isBackgroundWorker, isChrome, isBackgroundPage} from 'webext-detect';

const defaultUrl = 'https://webext-alert.vercel.app/';
let htmlFileUrl = new URL(defaultUrl);

async function onPopupClose(watchedWindowId: number): Promise<void> {
	await oneEvent(chrome.windows.onRemoved, {
		filter: closedWindowId => closedWindowId === watchedWindowId,
	});
}

// This function will be serialized, do not use variables outside its scope
function pageScript(): void {
	const button = document.querySelector('button')!;
	button.addEventListener('click', _ => {
		window.close();
	});

	let timeout: ReturnType<typeof setTimeout>;
	window.addEventListener('blur', _ => {
		timeout = setTimeout(() => {
			window.close();
		}, 60_000);
	});

	window.addEventListener('focus', _ => {
		clearInterval(timeout);
	});

	window.resizeBy(0, document.body.scrollHeight - window.innerHeight);
	// eslint-disable-next-line unicorn/prefer-global-this
	window.moveTo((screen.width - window.outerWidth) / 2, (screen.height - window.outerHeight) / 2);
	button.focus();
}

// TODO: Add bundler to include base-css
const css = /* css */`
	/*! https://npm.im/webext-base-css */

	:root {
		color-scheme: light dark;
		max-width: 700px;
		margin: auto;
	}

	body {
		font: 16px/1.5 system-ui, sans-serif;
	}

	input[type='submit'],
	button {
		font: inherit;
	}

	img {
		vertical-align: middle;
	}

	/* Firefox-only style */
	@-moz-document url-prefix('') {
		@media (prefers-color-scheme: dark) {
			:root {
				--background-color: #23222b;
			}
		}
	}

	/* iOS/iPadOS-specific style */
	@supports (-webkit-text-size-adjust: none) {
		@media (prefers-color-scheme: dark) {
			:root {
				--background-color: #1e1e1e;
			}
		}
	}

	/* End webext-base-css */

	html {
		overscroll-behavior: none;
	}

	body {
		box-sizing: border-box;
		margin: 0;
		padding: 1em;
		justify-content: center;
		display: flex;
		flex-direction: column;
		font-size: 14px;
		line-height: 1.5;
		gap: 1em;
		font-family: system, system-ui, sans-serif;
	}

	button {
		margin-inline: auto;
		min-width: 70px;
		min-height: 30px;
	}

	main {
		white-space: pre-wrap;
	}
`;

function getPage(message = '') {
	return /* html */ `
		<!doctype html>
		<meta charset="utf-8" />
		<title>${chrome.runtime.getManifest().name}</title>
		<style>${css}</style>
		<body>
			<main>${message}</main>
			<button>Ok</button>
		</body>
		<script>(${pageScript.toString()})()</script>
	`;
}

function getHtmlFileUrl(message: string): string {
	htmlFileUrl.searchParams.set('message', message);
	htmlFileUrl.searchParams.set('title', chrome.runtime.getManifest().name);
	return htmlFileUrl.href;
}

async function openPopup(url: string): Promise<chrome.windows.Window | void > {
	const width = 420;
	const height = 150;

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
		await onPopupClose(popup.id);
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

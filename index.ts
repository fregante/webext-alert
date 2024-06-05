import {oneEvent} from 'webext-events';
import {isBackgroundWorker, isChrome, isBackgroundPage} from 'webext-detect-page';

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
	window.addEventListener('blur', _ => {
		window.close();
	});

	window.resizeBy(0, document.body.scrollHeight - window.innerHeight);
	window.moveTo((screen.width - window.outerWidth) / 2, (screen.height - window.outerHeight) / 2);
	button.focus();
}

// TODO: Add bundler to include base-css
const css = /* css */`
	/*! https://npm.im/webext-base-css */

	/* Chrome only: -webkit-hyphens */
	/* Safari only: _::-webkit-full-page-media */

	/* webpackIgnore: true */
	@import url('chrome://global/skin/in-content/common.css') (min--moz-device-pixel-ratio:0); /* Firefox-only */

	:root {
		--background-color-for-chrome: #292a2d;
		max-width: 700px;
		margin: auto;
	}

	body {
		--body-margin-h: 8px;
		margin-left: var(--body-margin-h);
		margin-right: var(--body-margin-h);
	}

	/* Selector matches Firefox’ */
	input[type='number'],
	input[type='password'],
	input[type='search'],
	input[type='text'],
	input[type='url'],
	input:not([type]),
	textarea {
		display: block;
		box-sizing: border-box;
		margin-left: 0;
		width: 100%;
		resize: vertical;
		-moz-tab-size: 4 !important;
		tab-size: 4 !important;
	}

	input[type='checkbox'] {
		vertical-align: -0.15em;
	}

	@supports (not (-webkit-hyphens:none)) and (not (-moz-appearance:none)) and (list-style-type:'*') {
		textarea:focus {
			/* Inexplicably missing from Chrome’s input style https://github.com/chromium/chromium/blob/6bea0557fe/extensions/renderer/resources/extension.css#L287 */
			border-color: #4d90fe;
			transition: border-color 200ms;
		}
	}

	hr {
		margin-right: calc(-1 * var(--body-margin-h));
		margin-left: calc(-1 * var(--body-margin-h));
		border: none;
		border-bottom: 1px solid #aaa4;
	}

	img {
		vertical-align: middle;
	}

	_::-webkit-full-page-media,
	_:future,
	:root {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif, 'Apple Color Emoji';
	}

	_::-webkit-full-page-media,
	_:future,
	input[type='number'],
	input[type='password'],
	input[type='search'],
	input[type='text'],
	input[type='url'],
	input:not([type]),
	textarea {
		border: solid 1px #888;
		padding: 0.4em;
		font: inherit;
		-webkit-appearance: none;
	}

	@media (prefers-color-scheme: dark) {
		:root {
			color-scheme: dark;
			background-color: var(--background-color-for-chrome);
		}

		body,
		h3 { /* Chrome #3 */
			color: #e8eaed;
		}

		a {
			color: var(--link-color, #8ab4f8);
		}

		a:active {
			color: var(--link-color-active, #b6d3f9);
		}

		input[type='number'],
		input[type='password'],
		input[type='search'],
		input[type='text'],
		input[type='url'],
		input:not([type]),
		textarea {
			color: inherit;
			background-color: transparent;
		}
	}

	/* End webext-base-css */

	body {
		box-sizing: border-box;
		min-height: 100vh;
		margin: 0;
		padding: 1em;
		justify-content: center;
		display: flex;
		flex-direction: column;
		font-size: 14px;
		line-height: 1.5;
		font-family: system, system-ui, sans-serif;
	}

	button {
		margin-top: 1em;
		margin-left: auto;
	}
`;

function getPage(message = '') {
	return /* html */ `
		<!doctype html>
		<meta charset="utf-8" />
		<title>${chrome.runtime.getManifest().name}</title>
		<style>${css}</style>
		<script defer src="alert.js"></script>
		<body>
			<main>${message}</main>
			<button>Ok</button>
		</body>
		<script>(${pageScript.toString()})()</script>
	`;
}

function getExternalUrl(message: string): string {
	const url = new URL('https://webext-alert.vercel.app/');
	url.searchParams.set('message', message);
	url.searchParams.set('title', chrome.runtime.getManifest().name);
	return url.href;
}

async function openPopup(url: string): Promise<chrome.windows.Window> {
	const width = 420;
	const height = 150;

	// `chrome` is Promisified where `popupAlert` is used
	return chrome.windows.create({
		type: 'popup',
		focused: true,
		url,
		height,
		width,
	});
}

async function popupAlert(message: string): Promise<void> {
	const popup = await openPopup('data:text/html,' + encodeURIComponent(getPage(message)))
		?? await openPopup(getExternalUrl(message));

	await onPopupClose(popup.id!);
}

// `alert()` is not available in any service worker
// `alert()` is not available in any background context in Firefox and Safari
const webextAlert = isBackgroundWorker() || (!isChrome() && isBackgroundPage())
	? popupAlert
	: alert;

export default webextAlert;

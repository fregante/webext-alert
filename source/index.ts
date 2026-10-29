import {isBackgroundWorker, isBackgroundPage} from 'webext-detect';
import {
	type MessageKind,
	defaultUrl,
	isLocalHtmlFile,
	setHtmlFileUrl,
} from './shared.js';
import {showInActionPopup} from './action-popup.js';
import {showInWindow} from './window.js';

async function show(kind: MessageKind, message: string, defaultValue = ''): Promise<unknown> {
	// The answer is sent back via `chrome.runtime`, which the remote page can't use
	if (kind !== 'alert' && !isLocalHtmlFile()) {
		throw new Error(`webext-alert: \`${kind}()\` requires a local page, see \`localWebExtAlertHtml()\``);
	}

	message = message.trim();

	try {
		return await showInActionPopup(message, kind, defaultValue);
	} catch {
		// Continue with the alternatives
	}

	return showInWindow(message, kind, defaultValue);
}

// `alert()`, `confirm()` and `prompt()` are not available in any service worker or background page
// They may exist in background pages (Firefox, Safari), but they silently fail
const isNative = !isBackgroundWorker() && !isBackgroundPage();

export const alert = isNative
	? globalThis.alert ?? console.log
	: async (message = '') => {
		await show('alert', message);
	};

/**
 Like `confirm()`, but also available where the native one isn't.

 Where the native one isn't available, it requires `localWebExtAlertHtml()` to be called first, otherwise it throws.

 @returns `true` if the user clicked OK, `false` if they cancelled or dismissed it
*/
export const confirm = isNative
	? globalThis.confirm ?? (() => false)
	: async (message = '') => await show('confirm', message) === true;

/**
 Like `prompt()`, but also available where the native one isn't.

 Where the native one isn't available, it requires `localWebExtAlertHtml()` to be called first, otherwise it throws.

 @returns The text entered by the user, or `null` if they cancelled or dismissed it
*/
export const prompt = isNative
	? globalThis.prompt ?? (() => null)
	: async (message = '', defaultValue = '') => {
		const answer = await show('prompt', message, defaultValue);
		return typeof answer === 'string' ? answer : null;
	};

/**
 Change the HTML page to be used in certain scenarios (Firefox).
 This can be used to add offline support for Firefox.

 It's required for `confirm()` and `prompt()` where the native ones aren't available, because the remote page can't send the answer back to the extension.

 @param url Path of a copy of the page, included in your extension. If not provided, the default remote URL will be used
*/
export function localWebExtAlertHtml(url = defaultUrl): void {
	setHtmlFileUrl(url);
}

/**
 Runs the callback and, if it throws (or returns a rejected promise), shows the error to the user via `alert()` and rethrows it.

 To use it as a listener, see `showErrorsCallback`.

 @param callback The function to run, sync or async
 @returns Whatever the callback returns
*/
export async function showErrors<ReturnType>(callback: () => ReturnType): Promise<Awaited<ReturnType>> {
	try {
		return await callback();
	} catch (error) {
		await alert(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

/**
 Wraps the callback so that, if it throws (or returns a rejected promise), the error is shown to the user via `alert()` and rethrown.

 Meant to be used as a listener: `chrome.someEvent.addListener(showErrorsCallback(callback))`.

 @param callback The function to wrap, sync or async
 @returns A function that accepts the same arguments and returns a promise of whatever `callback` returns
*/
export function showErrorsCallback<Arguments extends unknown[], Result>(
	callback: (...arguments_: Arguments) => Result | Promise<Result>,
): (...arguments_: Arguments) => Promise<Result> {
	return async (...arguments_) => showErrors(async () => callback(...arguments_));
}

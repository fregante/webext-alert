export type MessageKind = 'alert' | 'confirm' | 'prompt';

export const defaultUrl = 'https://webext-alert.vercel.app/';
let htmlFileUrl = new URL(defaultUrl);

export function setHtmlFileUrl(url: string): void {
	htmlFileUrl = new URL(url, chrome.runtime.getURL('/'));
}

// The remote page can't use `chrome.runtime`, so it can't send the answer back
export function isLocalHtmlFile(): boolean {
	return htmlFileUrl.protocol.endsWith('extension:');
}

export function getHtmlFileUrl(message: string, kind: MessageKind = 'alert', defaultValue = ''): string {
	const url = new URL(htmlFileUrl);
	url.searchParams.set('message', message);
	url.searchParams.set('title', chrome.runtime.getManifest().name);
	if (kind !== 'alert') {
		url.searchParams.set('kind', kind);
		url.searchParams.set('default', defaultValue);
	}

	return url.href;
}

// Register the listener before opening the action popup or window to avoid race conditions
export function listenForAnswer(timeoutMs?: number) {
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
				reject(new Error('webext-alert: action popup did not connect in time'));
			}, timeoutMs);
		}
	});

	return {closed, stop, getAnswer: () => answer};
}

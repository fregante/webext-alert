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
export async function listenForAnswer(timeoutMs?: number): Promise<unknown> {
	let answer: unknown;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let disconnectTimeout: ReturnType<typeof setTimeout> | undefined;

	return new Promise((resolve, reject) => {
		function cleanup() {
			clearTimeout(timeout);
			clearTimeout(disconnectTimeout);
			chrome.runtime.onConnect.removeListener(onConnect);
			chrome.runtime.onMessage.removeListener(onMessage);
		}

		const onMessage = (message: unknown) => {
			if (typeof message !== 'object' || message === null || !('webextAlertAnswer' in message)) {
				return;
			}

			answer = message.webextAlertAnswer;
		};

		const onConnect = (port: chrome.runtime.Port) => {
			if (port.name !== 'webext-alert') {
				return;
			}

			clearTimeout(timeout);
			port.onDisconnect.addListener(() => {
				// Give the page a chance to deliver its answer before treating the disconnect as dismissal
				disconnectTimeout = setTimeout(() => {
					cleanup();
					resolve(answer);
				}, 100);
			});
		};

		chrome.runtime.onMessage.addListener(onMessage);
		chrome.runtime.onConnect.addListener(onConnect);
		if (timeoutMs !== undefined) {
			timeout = setTimeout(() => {
				cleanup();
				reject(new Error('webext-alert: action popup did not connect in time'));
			}, timeoutMs);
		}
	});
}

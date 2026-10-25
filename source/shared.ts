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
	let onMessage: ((message: unknown) => void) | undefined;

	function stop() {
		clearTimeout(timeout);
		if (onConnect) {
			chrome.runtime.onConnect.removeListener(onConnect);
		}

		if (onMessage) {
			chrome.runtime.onMessage.removeListener(onMessage);
		}
	}

	const closed = new Promise<unknown>((resolve, reject) => {
		onMessage = message => {
			if (typeof message !== 'object' || message === null || !('webextAlertAnswer' in message)) {
				return;
			}

			answer = message.webextAlertAnswer;
		};

		chrome.runtime.onMessage.addListener(onMessage);

		onConnect = port => {
			if (port.name !== 'webext-alert') {
				return;
			}

			clearTimeout(timeout);
			port.onDisconnect.addListener(() => {
				// Give the page a chance to deliver its answer before treating the disconnect as dismissal
				setTimeout(() => {
					resolve(answer);
				}, 100);
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

	return {closed, stop};
}

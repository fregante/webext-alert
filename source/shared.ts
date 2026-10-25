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
export async function listenForAnswer(signal: AbortSignal): Promise<unknown> {
	if (signal.aborted) {
		throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
	}

	return new Promise((resolve, reject) => {
		let answer: unknown;
		let disconnectTimeout: ReturnType<typeof setTimeout> | undefined;

		function cleanup() {
			clearTimeout(disconnectTimeout);
			chrome.runtime.onConnect.removeListener(onConnect);
			chrome.runtime.onMessage.removeListener(onMessage);
			signal.removeEventListener('abort', onAbort);
		}

		const onAbort = () => {
			cleanup();
			reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
		};

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

			port.onDisconnect.addListener(() => {
				// Give the page a chance to deliver its answer before treating the disconnect as dismissal
				disconnectTimeout = setTimeout(() => {
					cleanup();
					resolve(answer);
				}, 100);
			});
		};

		signal.addEventListener('abort', onAbort, {once: true});
		chrome.runtime.onMessage.addListener(onMessage);
		chrome.runtime.onConnect.addListener(onConnect);
	});
}

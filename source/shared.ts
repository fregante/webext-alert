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

function isAnswer(message: unknown): message is {webextAlertAnswer: unknown} {
	return typeof message === 'object' && message !== null && 'webextAlertAnswer' in message;
}

// Register the listener before opening the action popup or window to avoid race conditions
export function listenForAnswer(connectTimeoutMs?: number) {
	let dismiss!: () => void;
	const answer = new Promise<unknown>((resolve, reject) => {
		function cleanup() {
			clearTimeout(timeout);
			chrome.runtime.onConnect.removeListener(onConnect);
			chrome.runtime.onMessage.removeListener(onMessage);
		}

		// The page disconnects when it closes; if it did before answering, it was dismissed
		function onConnect(port: chrome.runtime.Port) {
			if (port.name !== 'webext-alert') {
				return;
			}

			clearTimeout(timeout);
			port.onDisconnect.addListener(dismiss);
		}

		// The page waits for this acknowledgement before closing, so the answer always wins over the disconnection
		function onMessage(message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: () => void) {
			if (!isAnswer(message)) {
				return;
			}

			cleanup();
			resolve(message.webextAlertAnswer);
			sendResponse();
		}

		const timeout = connectTimeoutMs === undefined
			? undefined
			: setTimeout(() => {
				cleanup();
				reject(new Error('webext-alert: action popup did not connect in time'));
			}, connectTimeoutMs);

		dismiss = () => {
			cleanup();
			resolve(undefined);
		};

		chrome.runtime.onConnect.addListener(onConnect);
		chrome.runtime.onMessage.addListener(onMessage);
	});

	return {answer, dismiss};
}

export async function sleep(ms: number): Promise<void> {
	await new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

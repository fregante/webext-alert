// Register the listener before opening the popup to avoid race conditions
export function listenForPopup(timeoutMs?: number) {
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

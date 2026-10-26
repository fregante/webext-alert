import assert from 'node:assert/strict';
import {
	test,
	type TestContext,
} from 'node:test';
import {setImmediate as flush} from 'node:timers/promises';
import {showInActionPopup} from './action-popup.js';

type MessageListener = (message: unknown, sender: unknown, sendResponse: () => void) => void;
type ConnectListener = (port: {name: string; onDisconnect: {addListener(listener: () => void): void}}) => void;

const originalPopup = 'original.html';

function setupChrome(t: TestContext, openPopup: () => Promise<void> = async () => undefined) {
	const messageListeners = new Set<MessageListener>();
	const connectListeners = new Set<ConnectListener>();
	const popups: string[] = [];
	const state = {failRestore: false, opened: 0};

	const fakeChrome = {
		runtime: {
			// eslint-disable-next-line @typescript-eslint/naming-convention -- Mirrors the extension API
			getURL: (path: string) => `chrome-extension://id${path}`,
			getManifest: () => ({name: 'Test'}),
			onMessage: {
				addListener: (listener: MessageListener) => messageListeners.add(listener),
				removeListener: (listener: MessageListener) => messageListeners.delete(listener),
			},
			onConnect: {
				addListener: (listener: ConnectListener) => connectListeners.add(listener),
				removeListener: (listener: ConnectListener) => connectListeners.delete(listener),
			},
		},
		action: {
			getPopup: async () => originalPopup,
			async setPopup({popup}: {popup: string}) {
				if (popup === originalPopup && state.failRestore) {
					throw new Error('Cannot restore');
				}

				popups.push(popup);
			},
			async openPopup() {
				state.opened++;
				await openPopup();
			},
		},
	};

	Object.defineProperty(globalThis, 'chrome', {value: fakeChrome, configurable: true});
	t.after(() => {
		Reflect.deleteProperty(globalThis, 'chrome');
	});

	return {
		popups,
		state,
		listeners: () => ({message: messageListeners.size, connect: connectListeners.size}),
		// Returns whether the message was acknowledged
		answer(webextAlertAnswer: unknown) {
			let acknowledged = false;
			const sendResponse = () => {
				acknowledged = true;
			};

			for (const listener of messageListeners) {
				listener({webextAlertAnswer}, {}, sendResponse);
			}

			return acknowledged;
		},
		connect() {
			const disconnectListeners = new Set<() => void>();
			for (const listener of connectListeners) {
				listener({
					name: 'webext-alert',
					onDisconnect: {
						addListener(disconnectListener: () => void) {
							disconnectListeners.add(disconnectListener);
						},
					},
				});
			}

			return {
				disconnect() {
					for (const listener of disconnectListeners) {
						listener();
					}
				},
			};
		},
	};
}

async function run(name: string, callback: (browser: ReturnType<typeof setupChrome>, t: TestContext) => Promise<void>, openPopup?: () => Promise<void>): Promise<void> {
	// eslint-disable-next-line node-test/require-assertion -- The assertions are in the callback
	await test(name, async t => {
		t.mock.timers.enable({apis: ['setTimeout']});
		await callback(setupChrome(t, openPopup), t);
		// Release the queue so the next test starts clean
		await flush();
		t.mock.timers.tick(500);
		await flush();
	});
}

await run('returns the answer, acknowledges it and restores the popup', async browser => {
	const result = showInActionPopup('Hello', 'prompt', 'default');
	await flush();

	assert.equal(browser.state.opened, 1);
	const url = new URL(browser.popups[0]!);
	assert.equal(url.searchParams.get('message'), 'Hello');
	assert.equal(url.searchParams.get('kind'), 'prompt');
	assert.equal(url.searchParams.get('default'), 'default');

	browser.connect();
	assert.equal(browser.answer('yes'), true);
	assert.equal(await result, 'yes');
	assert.equal(browser.popups.at(-1), originalPopup);
	assert.deepEqual(browser.listeners(), {message: 0, connect: 0});
});

await run('returns undefined if the popup is closed without an answer', async browser => {
	const result = showInActionPopup('Hello', 'confirm', '');
	await flush();

	browser.connect().disconnect();
	assert.equal(await result, undefined);
});

await run('keeps the answer if the popup cannot be restored', async browser => {
	browser.state.failRestore = true;
	const result = showInActionPopup('Hello', 'confirm', '');
	await flush();

	browser.connect();
	browser.answer(true);
	assert.equal(await result, true);
});

await run('rejects if the popup does not connect in time', async (browser, t) => {
	const result = assert.rejects(showInActionPopup('Hello', 'alert', ''), /did not connect in time/v);
	await flush();

	t.mock.timers.tick(5000);
	await result;
	assert.equal(browser.popups.at(-1), originalPopup);
	assert.deepEqual(browser.listeners(), {message: 0, connect: 0});
});

await run('shows one message at a time, with a cooldown between them', async (browser, t) => {
	const first = showInActionPopup('First', 'confirm', '');
	const second = showInActionPopup('Second', 'confirm', '');
	await flush();

	assert.equal(browser.state.opened, 1);
	browser.connect();
	browser.answer('one');
	// The answer isn't delayed by the cooldown
	assert.equal(await first, 'one');
	await flush();
	assert.equal(browser.state.opened, 1);

	t.mock.timers.tick(499);
	await flush();
	assert.equal(browser.state.opened, 1);

	t.mock.timers.tick(1);
	await flush();
	assert.equal(browser.state.opened, 2);
	assert.equal(new URL(browser.popups.at(-1)!).searchParams.get('message'), 'Second');

	browser.connect();
	browser.answer('two');
	assert.equal(await second, 'two');
});

let shouldFail = true;
await run('a failed popup does not block the next one', async (browser, t) => {
	const first = assert.rejects(showInActionPopup('First', 'confirm', ''), /Cannot open/v);
	const second = showInActionPopup('Second', 'confirm', '');
	await first;
	shouldFail = false;
	t.mock.timers.tick(500);
	await flush();

	assert.equal(browser.state.opened, 2);
	browser.connect().disconnect();
	assert.equal(await second, undefined);
}, async () => {
	if (shouldFail) {
		throw new Error('Cannot open');
	}
});

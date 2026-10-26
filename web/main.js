// Not available in all contexts (e.g. data URLs, or the remote page)
const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id);

// Connect to background to allow it to detect when this popup closes
if (hasExtensionApi) {
	chrome.runtime.connect({name: 'webext-alert'});
}

const parameters = new URLSearchParams(location.search);
const kind = parameters.get('kind') ?? 'alert';

const textElement = document.querySelector('main');
// The contents may have been pre-set via data URL
if (!textElement.textContent) {
	try {
		textElement.textContent = parameters.get('message');
		document.title = parameters.get('title') || document.title;
	} catch {
		textElement.textContent = 'There was an error showing this message';
	}
}

// The data URL page only has the Ok button
const okButton = document.querySelector('button[type="submit"]');
const cancel = document.querySelector('button[type="button"]');
const input = document.querySelector('input');

async function answer(value) {
	try {
		// Wait for the background to acknowledge it before closing, but never get stuck if the browser doesn't settle the promise (Safari)
		if (hasExtensionApi) {
			await Promise.race([
				chrome.runtime.sendMessage({webextAlertAnswer: value}),
				new Promise(resolve => {
					setTimeout(resolve, 1000);
				}),
			]);
		}
	} catch {}

	window.close();
}

if (kind === 'prompt') {
	input.hidden = false;
	input.value = parameters.get('default') ?? '';
}

if (kind !== 'alert') {
	cancel.hidden = false;
	cancel.addEventListener('click', _ => {
		answer(kind === 'prompt' ? null : false);
	});
}

// Also handles Enter in the input
document.querySelector('form').addEventListener('submit', event => {
	event.preventDefault();
	answer(kind === 'prompt' ? input.value : true);
});

let timeout;
window.addEventListener('blur', _ => {
	timeout = setTimeout(() => {
		window.close();
	}, 60_000);
});

window.addEventListener('focus', _ => {
	clearInterval(timeout);
});

// `left` and `top` are browser globals and cannot be redeclared; use an object to group all dimensions
const size = {
	height: document.body.scrollHeight + window.outerHeight - window.innerHeight,
	left: Math.round((screen.width - window.outerWidth) / 2),
	top: Math.round((screen.height - document.body.scrollHeight) / 2),
};
window.moveTo(size.left, size.top);
(kind === 'prompt' ? input : okButton).focus();
if (hasExtensionApi) {
	chrome.runtime.sendMessage({webextAlert: size});
}

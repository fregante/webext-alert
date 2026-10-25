// Connect to background to allow it to detect when this popup closes
let port;
try {
	port = chrome.runtime.connect({name: 'webext-alert'});
} catch {
	// Not available in all contexts (e.g. data URLs in some browsers)
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
const button = document.querySelector('button:last-of-type');
const cancel = document.querySelector('button[hidden]');
const input = document.querySelector('input');

function answer(value) {
	port?.postMessage({answer: value});
	window.close();
}

if (kind === 'prompt') {
	input.hidden = false;
	input.value = parameters.get('default') ?? '';
	input.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			button.click();
		}
	});
}

if (kind !== 'alert') {
	cancel.hidden = false;
	cancel.addEventListener('click', _ => {
		answer(kind === 'prompt' ? null : false);
	});
}

button.addEventListener('click', _ => {
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
chrome.runtime.sendMessage({webextAlert: size});
(kind === 'prompt' ? input : button).focus();

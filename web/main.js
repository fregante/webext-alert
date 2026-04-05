// Connect to background to allow it to detect when this popup closes
try {
	chrome.runtime.connect({name: 'webext-alert'});
} catch {
	// Not available in all contexts (e.g. data URLs in some browsers)
}

const textElement = document.querySelector('main');
// The contents may have been pre-set via data URL
if (!textElement.textContent) {
	try {
		const message = new URLSearchParams(location.search);
		textElement.textContent = message.get('message');
		document.title = message.get('title') || document.title;
	} catch {
		textElement.textContent = 'There was an error showing this message';
	}
}

const button = document.querySelector('button');
button.addEventListener('click', _ => {
	window.close();
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

window.resizeBy(0, document.body.scrollHeight - window.innerHeight);
// eslint-disable-next-line unicorn/prefer-global-this
window.moveTo((screen.width - window.outerWidth) / 2, (screen.height - window.outerHeight) / 2);
button.focus();

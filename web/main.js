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

const scrollDelta = document.body.scrollHeight - window.innerHeight;
// eslint-disable-next-line unicorn/prefer-global-this
const targetHeight = window.outerHeight + scrollDelta;
// eslint-disable-next-line unicorn/prefer-global-this
const targetLeft = Math.round((screen.width - window.outerWidth) / 2);
const targetTop = Math.round((screen.height - targetHeight) / 2);

window.resizeBy(0, scrollDelta);
window.moveTo(targetLeft, targetTop);

// Tell the opener the intended size/position for browsers that restrict popup self-resizing
location.hash = `webext-alert=${targetHeight},${targetLeft},${targetTop}`;
button.focus();

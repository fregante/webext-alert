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

// `left` and `top` are browser globals and cannot be redeclared; use an object to group all dimensions
const size = {
	height: document.body.scrollHeight,
	// eslint-disable-next-line unicorn/prefer-global-this
	left: Math.round((screen.width - window.outerWidth) / 2),
	top: Math.round((screen.height - document.body.scrollHeight) / 2),
};
window.resizeBy(0, document.body.scrollHeight - window.innerHeight);
window.moveTo(size.left, size.top);
chrome.runtime.sendMessage({webextAlert: size});
button.focus();

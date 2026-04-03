const textElement = document.querySelector('main');
const searchParameters = new URLSearchParams(location.search);

const message = searchParameters.get('message');
if (message !== null) {
	textElement.textContent = message;
}

const title = searchParameters.get('title');
if (title !== null) {
	document.title = title;
}

const button = document.querySelector('button');
button?.addEventListener('click', _ => {
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
button?.focus();

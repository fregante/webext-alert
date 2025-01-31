
const textElement = document.querySelector('main');
try {
	const message = new URLSearchParams(location.search);
	textElement.textContent = message.get('message');
	document.title = message.get('title') || document.title;

	// Fit window
	window.resizeBy(0, document.body.scrollHeight - window.innerHeight);
} catch {
	textElement.textContent('There was an error showing this message');
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
window.moveTo((screen.width - window.outerWidth) / 2, (screen.height - window.outerHeight) / 2);
button.focus();

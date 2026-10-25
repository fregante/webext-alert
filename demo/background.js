import {
	alert,
	confirm,
	prompt,
	localWebExtAlertHtml,
} from 'webext-alert';
import localPage from 'url:./webext-alert.html';

localWebExtAlertHtml(localPage);

setTimeout(async () => {
	const name = await prompt('What is your name?', 'Anonymous');
	if (name !== null && await confirm(`Hello ${name}, is this correct?`)) {
		await alert('Great!');
	}
}, 2000);

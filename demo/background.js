import {
	alert,
	confirm,
	prompt,
	localWebExtAlertHtml,
	showErrors,
} from 'webext-alert';
import localPage from 'url:./webext-alert.html';

localWebExtAlertHtml(localPage);

console.log('Background script started with', localPage);

setTimeout(async () => {
	await showErrors(async () => {
		const name = await prompt('What is your name?', 'Anonymous');
		if (name !== null && await confirm(`Hello ${name}, is this correct?`)) {
			await alert('Great!');
		} else {
			throw new Error('Error: Cancelled?! :(');
		}
	});
}, 2000);

import {
	alert,
	confirm,
	prompt,
	localWebExtAlertHtml,
	showErrors,
} from 'webext-alert';

const localPage = chrome.runtime.getURL('web/index.html');

localWebExtAlertHtml(localPage);

console.log('Background script started with', localPage);

setTimeout(async () => {
	await showErrors(async () => {
		const name = await prompt('What is your name?', 'Anonymous');
		console.log('Name entered:', name);
		if (name !== null && await confirm(`Hello ${name}, is this correct?`)) {
			console.log('Confirmed');
			await alert('Great!');
		} else {
			throw new Error('Error: Cancelled?! :(');
		}
	});
}, 2000);

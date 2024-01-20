import alert from 'webext-alert';

(chrome.action ?? chrome.browserAction).onClicked.addListener(() => {
	alert('Hello from background script!');
});

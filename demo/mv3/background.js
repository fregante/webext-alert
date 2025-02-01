import alert, {localWebExtAlertHtml} from 'webext-alert';
import localPage from 'url:./webext-alert.html';

localWebExtAlertHtml(localPage);

chrome.action.onClicked.addListener(() => {
	alert('Thanks for clicking!');
});

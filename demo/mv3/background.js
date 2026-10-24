import alert, {localWebExtAlertHtml} from 'webext-alert';
import localPage from 'url:./webext-alert.html';

localWebExtAlertHtml(localPage);

chrome.action.onClicked.addListener(() => {
	alert('Thanks for clicking!\n\n- Background script');
});

setTimeout(alert, 3000, 'Thanks for clicking!\n\n- Background script');

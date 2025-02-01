import alert, {localWebExtAlertHtml} from 'webext-alert';
import localPage from 'url:../../web/index.html';

localWebExtAlertHtml(localPage);

chrome.browserAction.onClicked.addListener(() => {
	alert('Thanks for clicking!\n\n- Background script');
});

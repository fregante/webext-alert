import alert, {customizeWebExtAlert} from 'webext-alert';
import localPage from 'url:../../web/index.html';

customizeWebExtAlert(localPage);

chrome.action.onClicked.addListener(() => {
	alert('Thanks for clicking!\n\n- Background script');
});

import alert, {setLocalWebExtAlert} from 'webext-alert';
import localPage from 'url:../../web/index.html';

setLocalWebExtAlert(localPage);

chrome.action.onClicked.addListener(() => {
	alert('Thanks for clicking!\n\n- Background script');
});

import alert, {localWebExtAlertHtml} from 'webext-alert';
import localPage from 'url:./webext-alert.html';

localWebExtAlertHtml(localPage);

setTimeout(alert, 3000, 'Thanks for visiting!\n\n- Background script');

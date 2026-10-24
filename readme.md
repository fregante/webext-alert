# webext-alert [![npm version](https://img.shields.io/npm/v/webext-alert.svg)](https://www.npmjs.com/package/webext-alert)

> WebExtension module: alert() for background pages/workers in Web Extensions

- Browsers: Chrome, Firefox, Safari
- Manifest: v3
- Contexts: background page, service worker

Every function tries these in order until one works:

1. The native function (`alert()`, `prompt()`, `confirm()`)
2. `chrome.action.openPopup()`
3. `chrome.windows.create()`
4. `console.log()`

## Install

You can download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-alert&global=webextAlert) and include it in your `manifest.json`.

Or use `npm`:

```sh
npm install webext-alert
```

## Usage

```js
import {alert} from 'webext-alert';

alert('Hello from background script!');
```

<img width="420" alt="alert from service worker in MV3" src="https://github.com/fregante/webext-alert/assets/1402241/bc25c6dc-633a-40f9-91f2-04d0cca16300">

## API

### alert(message)

Uses `alert()` wherever possible, but falls back to a custom window with the same content.

If the native `alert` is used, this will block the execution of the background script until the user closes the alert.

If the custom window is used, `webextAlert` will return a promise that resolves when the user closes the window.

### confirm(message)

Returns a promise that resolves to `true` if the user clicked OK, `false` if they cancelled or closed the popup.

The custom window must be able to send the answer back, so it requires a local page: call `localWebExtAlertHtml()` first (see below).

```js
import {confirm} from 'webext-alert';

if (await confirm('Delete everything?')) {
	// …
}
```

### prompt(message, defaultValue?)

Returns a promise that resolves to the text entered by the user, or `null` if they cancelled or closed the popup. It requires `localWebExtAlertHtml()` as well.

```js
import {prompt} from 'webext-alert';

const name = await prompt('What is your name?', 'Anonymous');
```

### localWebExtAlertHtml(url)

In some cases it will display the message using a remote page hosted on `https://webext-alert.vercel.app`. The source of this page can be found in the [`./web` folder](./web). If you prefer having a local version, you can:

1. copy the files from the [`./web` folder](./web) into your extension
2. call `localWebExtAlertHtml` at the top of `background.js`

```js
// background.js
import {alert, localWebExtAlertHtml} from 'webext-alert';

localWebExtAlertHtml('your/folder/the-local-copied-file.html');

alert('Hello from background script!');
```

## Related

- [Awesome-WebExtensions](https://github.com/fregante/Awesome-WebExtensions) - A curated list of awesome resources for WebExtensions development.
- [More…](https://github.com/fregante/webext-fun)

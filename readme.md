# webext-alert [![npm version](https://img.shields.io/npm/v/webext-alert.svg)](https://www.npmjs.com/package/webext-alert)

> WebExtension module: alert() for background pages/workers in Web Extensions

- Browsers: Chrome, Firefox, Safari
- Manifest: v3
- Contexts: background page, service worker

Every function tries these in order until one works:

1. The native function (`alert()`, `prompt()`, `confirm()`)
2. `chrome.action.openPopup()` (requires the [`action` key](#manifestjson))
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
import {alert, prompt, confirm, showErrors} from 'webext-alert';

await alert('Hello from background script!');
await prompt('What is your name?', 'Anonymous');
await confirm('Are you sure?');

await showErrors(async () => {
	throw new Error('Something went wrong!');
});
```

<img alt="alert from service worker in MV3" src="https://github.com/user-attachments/assets/ba6ae04f-3219-4f58-af0a-2d3f348d15e3">

## manifest.json

`chrome.action` only exists if `manifest.json` has the `action` key, so the popup strategy doesn't work out of the box. An empty object is enough:

```json
{
	"manifest_version": 3,
	"action": {},
	"background": {
		"service_worker": "background.js"
	}
}
```

Without it, `chrome.action` is `undefined` and the window from `chrome.windows.create()` is used instead. If your `action` already has a `default_popup`, it's replaced temporarily while the message is shown and restored afterwards.

## API

### alert(message)

Uses `alert()` wherever possible, but falls back to a custom window with the same content.

If the native `alert` is used, this will block the execution of the background script until the user closes the alert.

If the custom window is used, `alert` will return a promise that resolves when the user closes the window.

### confirm(message)

Uses `confirm()` wherever possible, but falls back to a custom window with the same content.

> [!IMPORTANT]
> The custom window requires [`localWebExtAlertHtml()`](#localwebextalerthtmlurl), otherwise it throws.

Returns `true` if the user clicked OK, `false` if they cancelled or closed the window. If the custom window is used, it returns a promise that resolves to that value, so always `await` it.

```js
import {confirm} from 'webext-alert';

if (await confirm('Delete everything?')) {
	// …
}
```

### prompt(message, defaultValue?)

Uses `prompt()` wherever possible, but falls back to a custom window with the same content.

> [!IMPORTANT]
> The custom window requires [`localWebExtAlertHtml()`](#localwebextalerthtmlurl), otherwise it throws.

Returns the text entered by the user, or `null` if they cancelled or closed the window. If the custom window is used, it returns a promise that resolves to that value, so always `await` it.

```js
import {prompt} from 'webext-alert';

const name = await prompt('What is your name?', 'Anonymous');
```

### showErrors(callback)

Runs `callback` and, if it throws (or returns a rejected promise), shows the error to the user via `alert()` and rethrows it. Returns whatever `callback` returns.

```js
import {showErrors} from 'webext-alert';

await showErrors(async () => {
	await chrome.permissions.request({origins: ['*://*/*']});
});
```

To use it as a listener, wrap the call:

```js
chrome.action.onClicked.addListener(() => showErrors(async () => {
	await chrome.permissions.request({origins: ['*://*/*']});
}));
```

### localWebExtAlertHtml(url)

`alert()` may display the message using a remote page hosted on `https://webext-alert.vercel.app`. The source of this page can be found in the [`./web` folder](./web). The remote page can't communicate with your extension, so `confirm()` and `prompt()` **require** a local copy when the custom window is used (service workers, Firefox, Safari). For `alert()` it's optional, but it adds offline support.

If you use an HTML-aware bundler, you can import the bundled page URL directly from the package:

```js
import pageUrl from 'webext-alert/page.html?url'; // Vite
import pageUrl from 'webext-alert/page.html?url'; // or Vite

import {localWebExtAlertHtml} from 'webext-alert';

localWebExtAlertHtml(pageUrl);
```

Otherwise, copy the files from the [`./web` folder](./web) into your extension and pass the copied HTML path to `localWebExtAlertHtml`.

## Related

- [Awesome-WebExtensions](https://github.com/fregante/Awesome-WebExtensions) - A curated list of awesome resources for WebExtensions development.
- [More…](https://github.com/fregante/webext-fun)

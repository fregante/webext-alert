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
import alert from 'webext-alert';

alert('Hello from background script!');
```

<img width="420" alt="alert from service worker in MV3" src="https://github.com/fregante/webext-alert/assets/1402241/bc25c6dc-633a-40f9-91f2-04d0cca16300">

## API

### alert(message)

Uses `alert()` wherever possible, but falls back to a custom window with the same content.

If the native `alert` is used, this will block the execution of the background script until the user closes the alert.

If the custom window is used, `webextAlert` will return a promise that resolves when the user closes the window.

### localWebExtAlertHtml(url)

In some cases, loading a remote page is required. If you prefer having a local version, you can:

1. copy the `html` and `js` files you find in the `web` folder into your extension
2. call `localWebExtAlertHtml('your/folder/the-local-copied-file.html')` at the top of `background.js`

## Known issues

- If the action popup isn't available, the popup windows open as regular windows when the user is in full screen on macOS or on mobile. This is a limitation of the WebExtensions API.

## Related

- [Awesome-WebExtensions](https://github.com/fregante/Awesome-WebExtensions) - A curated list of awesome resources for WebExtensions development.
- [More…](https://github.com/fregante/webext-fun)

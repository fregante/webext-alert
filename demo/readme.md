Demo/test extension for `webext-alert`

Run these 3 commands simultaneusly to manually test the module:

```sh
npm run watch
```

```sh
cd manual-test npm run watch
```

Then install `web-ext` globally and run one of:

```sh
web-ext run # MV3 Firefox
web-ext run --target chromium # MV3 Chrome

web-ext run --source-dir dist/mv2 # MV2 Firefox
web-ext run --source-dir dist/mv2 --target chromium # MV2 Chrome
```

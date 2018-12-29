Provides more clicks options: you can set some built-in action (or write any custom action) for click (right-click, Shift+left-click, etc.) on some items like links (or you can add detect function for any other items).

#### Historical notes
This is very old project (version 0.0.1.0a1 was created at 2008-08-28), it contains a lot of obsolete code (especially due to removed <a href="https://developer.mozilla.org/en-US/docs/E4X">E4X</a>), supports only clicks inside main browser window and contains many features, that not tested in new browser versions. Unfortunately I don't have enough free time to debug and make something release-like, so finally I decided to make it public “as is”.
<br>Some old version and examples (also old) can be found <a href="http://infocatcher.ucoz.net/ext/fx/handy_clicks/hc_releases.html">here</a>.

#### Options
* <em>handyclicks/</em> directory in browser <a href="http://kb.mozillazine.org/Profile_folder">profile</a>
* <em>extensions.handyclicks.</em>* branch in <a href="http://kb.mozillazine.org/About:config">about:config</a>

#### Hotkeys
Note: some hotkeys are described in the interface and not listed here.
<br>Hotkeys for browser window can be changed using <em>extensions.handyclicks.key.</em>* preferences in about:config.

##### Hotkeys in all settings windows
<table>
<tr><td>F5, Ctrl+R            </td><td>Reload (load saved settings)        </td></tr>
<tr><td>Ctrl+Shift+J          </td><td>Open error console                  </td></tr>
<tr><td>F10                   </td><td>Maximize/restore window             </td></tr>
<tr><td>F11                   </td><td>Toggle fullscreen mode              </td></tr>
</table>

##### Hotkeys in editor window
<table>
<tr><td>Ctrl+Shift+C          </td><td>Copy settings to internal buffer     </td></tr>
<tr><td>Ctrl+Shift+V          </td><td>Paste settings from internal buffer  </td></tr>
<tr><td>Ctrl+Down             </td><td>Focus next field (like Tab)          </td></tr>
<tr><td>Ctrl+Up               </td><td>Focus previous field (like Shift+Tab)</td></tr>
</table>

##### Hotkeys in code editor
<table>
<tr><td>Tab                   </td><td>indent selected lines using tabs    </td></tr>
<tr><td>Shift+Tab             </td><td>unindent selected lines using tabs  </td></tr>
<tr><td>Space                 </td><td>indent selected lines using spaces  </td></tr>
<tr><td>Shift+Space           </td><td>unindent selected lines using spaces</td></tr>
<tr><td>Ctrl+Shift+Q          </td><td>Comment/uncomment                   </td></tr>
<tr><td>Ctrl+Shift+A          </td><td>Comment/uncomment at line start     </td></tr>
<tr><td>Alt+Backspace         </td><td>Trim trailing spaces                </td></tr>
<tr><td>Ctrl+G, Ctrl+L, Ctrl+J</td><td>Go to line                          </td></tr>
<tr><td>Ctrl++                </td><td>Increase font size                  </td></tr>
<tr><td>Ctrl+-                </td><td>Decrease font size                  </td></tr>
<tr><td>Ctrl+0                </td><td>Reset font size                     </td></tr>
<tr><td>Ctrl+W                </td><td>Toggle word wrap                    </td></tr>
<tr><td>F12                   </td><td>Toggle “fullwindow” mode            </td></tr>
<tr><td>Ctrl+Space            </td><td>Autocomplete                        </td></tr>
<tr><td>Ctrl+Shift+Space      </td><td>Autocomplete in reversed order      </td></tr>
<tr><td>Ctrl+Shift+E, F4*     </td><td>Open in external editor             </td></tr>
<tr><td>Ctrl+Shift+X*         </td><td>Move code into linked file          </td></tr>
<tr><td>Ctrl+Shift+D*         </td><td>Open scripts directory              </td></tr>
<tr><td>Ctrl+O*               </td><td>Load code from file                 </td></tr>
<tr><td>Ctrl+Shift+O*         </td><td>Load code from file and sync changes</td></tr>
<tr><td>Ctrl+Shift+S*         </td><td>Save code to file                   </td></tr>
</table>
* – “global” hotkey, works even if editor field isn't focused.

#### Troubleshooting
Turn off from command line: `firefox -handyclicks-disable`.
<br>Log debug messages into error console: <em>extensions.handyclicks.debug</em> preference.

#### API
##### Execution context
<table>
<thead>
<tr>
	<th>Shortcut</th>
	<th>Global object*</th>
	<th>File</th>
	<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
	<td>this</td>
	<td>handyClicksFuncs</td>
	<td><a href="chrome/content/funcs.js">chrome://handyclicks/content/funcs.js</a></td>
	<td>Built-in functions</td>
</tr>
<tr>
	<td>this.g</td>
	<td>handyClicksGlobals</td>
	<td><a href="chrome/content/globals.js">chrome://handyclicks/content/globals.js</a></td>
	<td><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain">[[Prototype]]</a> of all handyClicks* objects</td>
</tr>
<tr>
	<td>this.hc</td>
	<td>handyClicks</td>
	<td><a href="chrome/content/handyclicks.js">chrome://handyclicks/content/handyclicks.js</a></td>
	<td>Core with functions to detect built-in types</td>
</tr>
<tr>
	<td>this.ut</td>
	<td>handyClicksUtils</td>
	<td><a href="chrome/content/utils.js">chrome://handyclicks/content/utils.js</a></td>
	<td>Various utils</td>
</tr>
<tr>
	<td>this.cs</td>
	<td>handyClicksCleanupSvc</td>
	<td><a href="chrome/content/utils.js">chrome://handyclicks/content/utils.js</a></td>
	<td>Cleanup/destructors</td>
</tr>
<tr>
	<td>this.wu</td>
	<td>handyClicksWinUtils</td>
	<td><a href="chrome/content/winUtils.js">chrome://handyclicks/content/winUtils.js</a></td>
	<td>Working with windows</td>
</tr>
<tr>
	<td>this.pu</td>
	<td>handyClicksPrefUtils</td>
	<td><a href="chrome/content/prefUtils.js">chrome://handyclicks/content/prefUtils.js</a></td>
	<td>Working with about:config preferences</td>
</tr>
<tr>
	<td>this.ct</td>
	<td>handyClicksConst</td>
	<td><a href="chrome/content/consts.js">chrome://handyclicks/content/consts.js</a></td>
	<td>Some global constants</td>
</tr>
<tr>
	<td>this.ui</td>
	<td>handyClicksUI</td>
	<td><a href="chrome/content/handyclicksUI.js">chrome://handyclicks/content/handyclicksUI.js</a></td>
	<td>Some UI-related things</td>
</tr>
<tr>
	<td>this.ps</td>
	<td>handyClicksPrefSvc</td>
	<td><a href="chrome/content/prefSvc.js">chrome://handyclicks/content/prefSvc.js</a></td>
	<td>Settings service</td>
</tr>
<tr>
	<td>this.rs</td>
	<td>handyClicksRegSvc</td>
	<td><a href="chrome/content/regSvc.js">chrome://handyclicks/content/regSvc.js</a></td>
	<td>Registration service</td>
</tr>
</tbody>
</table>
* Note: you should always use shortcut because script may use lazy loading.

##### API functions:
DOMNode <a href="#handyclicksfuncsshowgeneratedpopup">handyClicksFuncs.showGeneratedPopup</a>(in array/string/DOMNode items)
<br>DOMNode <a href="#handyclicksfuncsshowopenuriwithappspopup">handyClicksFuncs.showOpenURIWithAppsPopup</a>(in array items, in boolean checkPaths)
<br>string <a href="#handyclicksfuncsgetitemuri">handyClicksFuncs.getItemURI</a>([in DOMNode item[, in string itemType[, in boolean noTrim]]])
<br>string <a href="#handyclicksfuncsgetitemtext">handyClicksFuncs.getItemText</a>([in DOMNode item[, in string itemType[, in DOMEvent event[, in boolean noTrim]]]])
<br>nsIVariant <a href="#handyclicksprefutilsgetpref">handyClicksPrefUtils.getPref</a>(in string prefName[, in nsIVariant defaultValue[, in nsIPrefBranch prefBranch]])
<br>void <a href="#handyclicksprefutilssetpref">handyClicksPrefUtils.setPref</a>(in string prefName, in nsIVariant value[, in nsIPrefBranch prefBranch])
<br>DOMWindow <a href="#handyclicksutilsnotify">handyClicksUtils.notify</a>(in string message[, in object options]) <sup><em><a href="https://github.com/Infocatcher/Handy_Clicks/blob/0.1.3pre6/README.md#api-functions">changed</a> in Handy Clicks 0.1.3pre7+</em></sup>
<br>DOMWindow <a href="#handyclicksutilsnotifyinwindowcorner">handyClicksUtils.notifyInWindowCorner</a>(in string message[, in object options]) <sup><em><a href="https://github.com/Infocatcher/Handy_Clicks/blob/0.1.3pre6/README.md#api-functions">changed</a> in Handy Clicks 0.1.3pre7+</em></sup>
<br>DOMWindow <a href="#handyclicksutilsnotifywarning">handyClicksUtils.notifyWarning</a>(in string message[, in object options]) <sup><em>Handy Clicks 0.1.3pre7+</em></sup>
<br>DOMWindow <a href="#handyclicksutilsnotifyerror">handyClicksUtils.notifyError</a>(in string message[, in object options]) <sup><em>Handy Clicks 0.1.3pre7+</em></sup>
<br>void <a href="#handyclicksglobals_info">handyClicksGlobals.\_info</a>(in string message)
<br>void <a href="#handyclicksglobals_log">handyClicksGlobals.\_log</a>(in string message)
<br>void <a href="#handyclicksutils_err">handyClicksUtils.\_err</a>(in string/error message[, in string fileName[, in string lineNumber]])
<br>void <a href="#handyclicksutils_warn">handyClicksUtils.\_warn</a>(in string/error message[, in string fileName[, in string lineNumber]])

###### handyClicksFuncs.showGeneratedPopup()
Creates popup from <a href="https://github.com/Infocatcher/Handy_Clicks_scripts/blob/master/Link/browsersMenu.js">special array</a> or <a href="https://github.com/Infocatcher/Handy_Clicks_scripts/blob/master/Link/copyMenu.js">string</a> and shows it.
```js
// Simple popup
var items = [
	{ tagName: "menuitem", attr_label: "Label - 0", attr_oncommand: "alert(this.label);" },
	{ tagName: "menuseparator" },
	{ tagName: "menuitem", attr_label: "Label - 1", prop_onclick: function() { alert(this.label); } },
	{ tagName: "menuitem", attr_label: "Label - 2", attr_oncommand: "alert(this.label);", "attr_handyclicks_tooltip-0": "tooltip-0" },
	{ tagName: "menuitem", attr_label: "Label - 3", attr_oncommand: "alert(this.label);", "attr_handyclicks_tooltip-0": "tooltip-0", "attr_handyclicks_tooltip-1": "tooltip-1" },
];
this.showGeneratedPopup(items);
```
```js
// Popup with submenu
var items = [
	{ tagName: "menuitem", attr_label: "Label - 0", prop_className: "menuitem-iconic", attr_image: "moz-icon://.js?size=16" },
	{ tagName: "menuseparator" },
	{
		tagName: "menu",
		attr_label: "Menu",
		childNodes: [
			{
				tagName: "menupopup",
				childNodes: [
					{ tagName: "menuitem", attr_label: "Label - 1" },
					{ tagName: "menuitem", attr_label: "Label - 2" }
				]
			}
		]
	},
];
var popup = this.showGeneratedPopup(items);
popup.setAttribute("oncommand", "alert(event.target.label);");
```
```js
// Create popup from XUL string
var items = '\
	<menupopup xmlns="' + this.ut.XULNS + '"\
		oncommand="alert(event.target.label);">\
		<menuitem label="Item 1" tooltiptext="Tip 1" />\
		<menuitem label="Item 2" tooltiptext="Tip 2" />\
		<menuseparator />\
		<menuitem label="Item 3" tooltiptext="Tip 3" />\
	</menupopup>';
this.addEditItem(items);
this.showGeneratedPopup(items);
```

###### handyClicksFuncs.showOpenURIWithAppsPopup()
Shows special popup to open link in other browser, very similar to <a href="#handyclicksfuncsshowgeneratedpopup">handyClicksFuncs.showGeneratedPopup</a>().
```js
// Open link in other browser
var items = [
	{ tagName: "menuitem", attr_label: "Internet Explorer", prop_hc_path: "%ProgF%\\Internet Explorer\\iexplore.exe" },
	{ tagName: "menuitem", attr_label: "Google Chrome", prop_hc_path: "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" },
	{ tagName: "menuitem", attr_label: "Seamonkey", prop_hc_path: "%ProgF%\\SeaMonkey\\seamonkey.exe" },
	{ tagName: "menuseparator" },
	{ tagName: "menuitem", attr_label: "Opera portable", prop_hc_path: "%ProfD%\\..\\..\\..\\Opera\\Opera.exe" },
	{ tagName: "menuitem", attr_label: "Google Chrome portable", prop_hc_path: "%ProfD%\\..\\..\\..\\GoogleChromePortable\\GoogleChromePortable.exe" }
];
this.showOpenUriWithAppsPopup(items, true /* check paths */);
```

###### handyClicksFuncs.getItemURI()
Gets URI of link-like item.

###### handyClicksFuncs.getItemText()
Gets text of item, like “text” from `<a href="#">text</a>`.

###### handyClicksPrefUtils.getPref()
Reads preference from about:config storage.
```js
var tab = gBrowser.addTab("https://mozilla.org/");
if(!this.pu.getPref("browser.tabs.loadInBackground"))
	gBrowser.selectedTab = tab;
```

###### handyClicksPrefUtils.setPref()
Writes preference to about:config storage.
```js
// Toggle boolean preference
var pref = "middlemouse.scrollbarPosition";
this.pu.setPref(pref, !this.pu.getPref(pref));
```

###### handyClicksUtils.notify()
Shows notification message under cursor (or in window corner, if <em>extensions.handyclicks.notifyInWindowCorner</em> is set to `true`).
<br>Example:
```js
this.ut.notify("Simple message with default title");
```
With all options:
```js
this.ut.notify("Some message", { // All options are optional
	title: "Title",
	icon: this.ut.NOTIFY_ICON_WARNING,
	inWindowCorner: true, // Force open in window corner
	parentWindow: window, // Set parent window (for current window by default)
	onLeftClick: function() {
		alert("Left-click");
	},
	onMiddleClick: function() { // Or left-click with any modifier
		alert("Middle-click");
	},
	context: this // Execution context for onLeftClick and onMiddleClick
});
```
Icons:
```js
handyClicksUtils.NOTIFY_ICON_NORMAL
handyClicksUtils.NOTIFY_ICON_DISABLED
handyClicksUtils.NOTIFY_ICON_WARNING
handyClicksUtils.NOTIFY_ICON_ERROR
```

###### handyClicksUtils.notifyInWindowCorner()
Like <a href="#handyclicksutilsnotify">handyClicksUtils.notify</a>(), but force shows notification message in window corner, equals to
```js
this.ut.notify("Something", {
	inWindowCorner: true
});
```

###### handyClicksUtils.notifyWarning()
Like <a href="#handyclicksutilsnotify">handyClicksUtils.notify</a>(), but set icon and default title to this.ut.NOTIFY_ICON_WARNING and this.getLocalized("warningTitle"), equals to
```js
this.ut.notify("Error!", {
	icon: this.ut.NOTIFY_ICON_ERROR
});
```

###### handyClicksUtils.notifyError()
Like <a href="#handyclicksutilsnotify">handyClicksUtils.notify</a>(), but set icon and default title to this.ut.NOTIFY_ICON_ERROR and this.getLocalized("errorTitle"), equals to
```js
this.ut.notify("Error!", {
	icon: this.ut.NOTIFY_ICON_ERROR
});
```

###### handyClicksGlobals._info()
Logs message into <a href="https://developer.mozilla.org/en-US/docs/Error_Console">error</a>/<a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">browser</a> console.
```js
this._info("Some message");
```

###### handyClicksGlobals._log()
Logs message into <a href="https://developer.mozilla.org/en-US/docs/Error_Console">error</a>/<a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">browser</a> console, like <a href="#handyclicksutils_info">handyClicksUtils._info</a>(), but only if <em>extensions.handyclicks.debug</em> = `true`.

###### handyClicksUtils._err()
Logs error message into <a href="https://developer.mozilla.org/en-US/docs/Error_Console">error</a>/<a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">browser</a> console.

###### handyClicksUtils._warn()
Logs warning message into <a href="https://developer.mozilla.org/en-US/docs/Error_Console">error</a>/<a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">browser</a> console.

#### Scripts
<a href="https://github.com/Infocatcher/Handy_Clicks_scripts">Scripts repository</a>
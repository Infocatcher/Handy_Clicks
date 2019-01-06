#### Handy Clicks: Changelog

`+` – added<br>
`-` – deleted<br>
`x` – fixed<br>
`*` – improved<br>

##### master/HEAD
`x` Editor: fixed autocomplete feature for properties of `window` object.<br>
`x` Fixed support for <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">Browser Console</a> in Firefox 48+.<br>
`*` Editor: disable “Delete” button, if there is nothing to delete.<br>
`x` Fixed Scratchpad support in Firefox 56+.<br>
`*` Edit mode tooltip: hide empty URI field.<br>
`+` Added export/import for separate *.js files (`//> %hc_ScriptsDir%/example.js` in code, also added %hc_ScriptsDir% alias for %profile%/handyclicks/scripts/ and %data% search placeholder) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/32">#32</a>).<br>
`*` Restored window.handyClicks (as lazy getter) to detect Handy Clicks presence even in disabled mode.<br>
`*` Improved startup performance: load handyclicks.js after small delay, increased delay to preload settings.<br>
`*` Added special highlighting for custom files (`//> %hc_ScriptsDir%/example.js` in code).<br>
`*` UI tweaks and improved localization strings.<br>
`+` Added menu to insert search placeholders (like %custom%).<br>
`x` Correctly reset filter: fix possible rows disappearance.<br>
`*` Sort rows in invert mode.<br>
`x` Fixed XSS in labels for custom types.<br>
`+` Added %init% placeholder to search custom initialization.<br>
`x` Fixed user backups highlighting in “Restore from backup” menu.<br>
`x` Correctly open all preferences in case of unloaded about:config tab presence.<br>
`+` Reset preferences: added checkbox to take export first.<br>
`x` Workaround to correctly import multiline <em>extensions.handyclicks.editor.external.args</em> preference.<br>
`+` Added UI for <em>extensions.handyclicks.editor.external.labelInFileName</em> preference.<br>
`*` Rewritten code to make relative path to external editor: also use %CurProcD% and %hc_ProfDrv%, use ../ only for %ProfD% and %CurProcD% (and limit ../ levels).<br>
`x` Correctly set selection in Scratchpad in Firefox 44+.<br>
`*` Improved startup performance: moved not used on startup code from prefSvc.js to prefSvcExt.js with lazy loading (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/33">#33</a>).<br>
`*` Improved settings performance: used faster way to detect unsaved state (compare only settings data without hash calculations, ≈4x faster).<br>
`x` Fixed trim trailing spaces (Alt+Backspace) in Firefox 49+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1108382">bug 1108382</a>).<br>
`x` Editor: fixed temp file name for delayed actions.<br>
`x` Editor: restored undo ability after entire text modification in Firefox 56.<br>
`+` Editor: added “To file” and “Scripts…” buttons.<br>
`*` Editor: updated icons for code toolbars (now used <a href="https://www.fatcow.com/free-icons">Farm-Fresh Web Icons by FatCow Web Hosting</a>).<br>
`x` Editor: fixed loading from file in case of missed temp directory.<br>
`x` Editor: fixed internal window ID for custom types (to focus already opened editor with edited type).<br>
`x` Editor: correctly mark as (un)saved in various cases.<br>
`*` Highlight not available types (for disabled/missed extensions).<br>
`+` Added %na% placeholder for not available types.<br>
`*` Save settings: search for %bug% in case of buggy settings presence.<br>
`*` Show warning, if detected buggy settings.<br>
`*` Updated <a href="https://github.com/Infocatcher/Handy_Clicks#api-functions">notify() API</a> for better readability.<br>
`*` Increased delay to close notifications + spacial delay for warnings (<em>extensions.handyclicks.notifyOpenTimeWarnings</em> preference).<br>
`*` Rewritten code to update dependencies (and disable unsupported) in settings window.<br>
`*` Notification window: don't overlap dialog buttons (like for status bar).<br>
`+` Added %on% placeholder for enabled items, placeholder for disabled items renamed from %dis% to %off% (legacy variant is still supported).<br>
`*` Now used undoable way to prevent non-ASCII characters in field for internal id of custom type with nsIPlaintextEditor.undo() (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/25">#25</a>).<br>
`*` Allow edit mode in disabled state (just temporarily enable).<br>
`x` Fixed internal storage in settings and editor windows in Firefox 47+ (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/28">#28</a>).<br>
`*` Added indication for copy/paste using internal buffer.<br>
`*` Delayed action: show “Disabled” instead of “After 0 ms”.<br>
`*` External editor: fallback to Windows association for .txt, if .js associated with WScript.exe.<br>
`+` Added %open% placeholder to search for settings, that opened in editors.<br>
`+` Added context menu items to close editors.<br>
`x` Edit custom type: open only one editor for each type (if selected many items with the same custom type).<br>
`*` Switch to already opened editor: also select action/delayed action tab.<br>
`*` Slightly improved performance: code for “On top” button and for maximize/fullscreen hotkeys moved into setsUtils.js (not used in browser window).<br>
`*` Changed `handyClicksFuncs.getItemText()` function for unknown items: prefer .value (for XUL textbox).<br>
`+` API: added itemType argument to all custom functions and firstCall argument to custom type definition.<br>
`+` API: added <a href="https://github.com/Infocatcher/Handy_Clicks#api-functions">handyClicks.initCustomType()</a> function to override behavior of built-in functions to get item text and URI.<br>
`*` API: changed <a href="https://github.com/Infocatcher/Handy_Clicks#api-functions">handyClicksFuncs.getItemURI()</a>, added `event` argument.<br>
`+` Added ability to not ignore clicks on tab close buttons (“Exclude close button” checkbox in editor).<br>
`*` Improved warning for custom type disabling: show count of enabled related settings, which will be also disabled.<br>
`+` Added remembering of tree state (View – Remember tree state, <em>extensions.handyclicks.sets.rememberState</em> preference).<br>
`*` Make menu items to remove user backups configurable (<em>extensions.handyclicks.sets.backupUserRemoveDepth</em> and <em>extensions.handyclicks.sets.backupUserRemoveDepth2</em> preferences).<br>
`*` Optimized usage of “properties” attribute in XUL tree (≈1.5x faster tree drawing).<br>
`+` Added %delay% search placeholder to search for delayed actions.<br>
`*` Show file description (instead of product name and useless version) in tooltip for icon of external editor, also try show description in MacOS (not tested).<br>
`*` Optimized creation of container items in tree, don't use slow DOMParser (≈1.2x faster tree drawing).<br>
`*` Open not sibling menu (and close currently opened) after “mouseover” + delay (<em>extensions.handyclicks.ui.openMenuDelay</em> preference).<br>
`+` Added ability to search for placeholder string itself (e.g. “%%on%%” for “%on%”).<br>
`*` Optimized filter mode: hide items instead of remove them (≈2.5x faster filtration).<br>
`x` Correctly initialize delayed actions for not custom actions.<br>
`*` Simplified code to select items in tree using mouse move (press mouse button and then drag to select).<br>
`x` Fixed Ctrl+Up/Down in editor fields in Firefox 52+ (still doesn't work in another textboxes, but not so needed).<br>
`x` Fixed Ctrl+Tab/Ctrl+Shift+Tab and Ctrl+PageDown/Ctrl+PageUp tabs navigation in Firefox 52+: force navigate only inside focused tabs.<br>
`*` Rewritten and simplified trick to not focus read-only textboxes with functions arguments description.<br>
`*` Search: expand only to matched items (and don't expand all tree).<br>
`*` Find next down/up: select first search result, if it not visible inside collapsed tree, also start navigation from selection (instead of internal index).<br>
`*` Select all search results: ensure first item visible.<br>
`+` Added menu items and hotkeys to collapse/expand tree (now not only not intuitive click on “Shortcut and target” column).<br>
`*` Various internal code enhancements.<br>

##### 0.1.3pre6 (2017-04-16)
`x` Fixed hiding of special window that open options in non-modal window.<br>
`*` Improve “reload image” function: correct and remove image from cache before reloading.<br>
`+` Added ability to configure or disable “scroll to switch” feature (<em>extensions.handyclicks.sets.scrollLists</em> and <em>extensions.handyclicks.sets.scrollLists.onlyInActiveWindow</em> preferences).<br>
`+` Added ability to ignore image-like <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas">canvas</a> nodes (<em>extensions.handyclicks.types.images.canvas</em> preference, e.g. to disable in case of performance problems).<br>
`x` Fixed compatibility with future Firefox versions: don't use Application.* API (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1090880">bug 1090880</a>, <a href="https://github.com/Infocatcher/Handy_Clicks/issues/28">#28</a>).<br>
`+` Added `handyClicks.handledItem` API for another extensions.<br>
`x` Correctly decode URIs in Firefox 40+.<br>
`+` Added ability to store code in separate *.js files (using special comment like `//> %hc_PrefsDir%/scripts/example.js`) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/29">#29</a>).<br>
`x` Correctly disable: call destructors and clear all caches (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/30">#30</a>).<br>
`x` Edit mode: correctly open menus is Firefox 36+ (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/31">#31</a>).<br>
`*` Now used data:… URIs instead of resource://handyclicks-content/… to make extension invisible for pages scripts.<br>
`+` Added ability to duplicate tab in SeaMonkey (`handyClicksFuncs.cloneTab()`).<br>
`x` Fixed compatibility with future Firefox versions: don't use Array generics like `Array.forEach()` and String generics like `String.startsWith()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1222547">bug 1222547</a>, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1222552">bug 1222552</a>).<br>
`x` Fixed detection of links from CSS Inspector in Firefox 48+.<br>
`x` Fixed compatibility with future Firefox versions: don't use deprecated `Date.prototype.toLocaleFormat()` (<em>extensions.handyclicks.sets.dateFormat</em> preference will not work in Firefox 55+) (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=818634">bug 818634</a>).<br>
`+` Edit mode: also show URI in tooltip.<br>
`*` Small performance enhancements and various tweaks.<br>

##### 0.1.3pre5 (2014-09-09)
`*` Hide options about status bar in Firefox 29+ (only if status bar not restored by another extension).<br>
`x` Fixed support for <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">Browser Console</a> in Firefox 29+.<br>
`x` Added workaround for <a href="https://addons.mozilla.org/addon/multi-links/">Multi Links</a> extension (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/23">#23</a>).<br>
`+` Added “Move to Toolbar” and “Remove from Menu” items to button context menu, for menu-button in Firefox 29+ (Australis).<br>
`+` Added ability to override <em>browser.preferences.instantApply</em> for settings window (<em>extensions.handyclicks.sets.overrideInstantApply</em> preference) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/24">#24</a>).<br>
`x` Fixed charset menu in Firefox 32+ (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/26">#26</a>).<br>

##### 0.1.3pre4 (2014-04-29)
`*` Changed API: handyClicksFuncs.getItemText(item, event, noTrim) arguments is deprecated, use handyClicksFuncs.getItemText(item, <ins>itemType</ins>, event, noTrim) instead.<br>
`*` Don't use tabs in popup windows (<em>extensions.handyclicks.funcs.dontUseTabsInPopupWindows</em> preference, doesn't work with “moveTo” argument) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/8">#8</a>).<br>
`x` Fixed detection of “Open …” menu items in RSS bookmarks in Firefox 4+.<br>
`+` Added <em>extensions.handyclicks.ui.showMouseButton.restoreDelay</em> preference to configure “Change icon when click handling” feature.<br>
`x` Fixed default value for <em>extensions.handyclicks.key.editMode</em> preference (`access` modifier works, but isn't displayed in menu).<br>
`*` Redesigned edit mode tooltip.<br>
`*` Slightly improved performance of settings tree drawing.<br>
`*` Changed default value for <em>extensions.handyclicks.editor.external.path</em> preference: now used Scratchpad as default editor (if available).<br>
`*` Changed: use %profile%/handyclicks/temp/ folder for external editor and notify about not removed temp files after crash.<br>
`*` Improved performance (and compatibility with future browser versions): no longer mutate [[Prototype]] of already created objects, also now used lazy loading for prefSvc.js (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/18">#18</a>).<br>
`*` Improved startup performance: now used lazy loading for utils.js (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/19">#19</a>).<br>
`*` Slightly improved startup performance: load uninstaller after small delay (to not block browser startup).<br>
`x` Fixed error line numbers detection in Firefox 30+ (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/20">#20</a>).<br>
`+` Added “Close” button to notification popup window.<br>
`*` Copy URIs with `%20` instead of spaces by default (<em>extensions.handyclicks.funcs.decodeURIs.spaces</em> preference).<br>
`*` Improved startup performance in disabled mode: handyclicks.js will be loaded only after enabling (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/21">#21</a>).<br>
`+` Added support for <a href="https://addons.mozilla.org/addon/feed-sidebar/">Feed Sidebar</a> extension (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/22">#22</a>).<br>
`x` Fixed “command” event handling: don't stop “click” event, if action is configured for “command” event.<br>

##### 0.1.3pre3 (2014-02-01)
`*` Slightly improved startup performance: now styles for “blink” node feature are loaded just before first usage.<br>
`x` Fixed: correctly remember target directory during export from uninstall dialog.<br>
`*` Slightly improved startup performance: initialize uninstaller only after first window will be opened.<br>
`*` Added ability to show context menu after left-click on menu item.<br>
`*` Now used undoable way to reset controls behavior.<br>
`*` Improved way to open Unicode URIs in other applications (handyClicksFuncs.showOpenURIWithAppsPopup() API and <em>extensions.handyclicks.funcs.preferRunw</em> preference).<br>
`x` Fixed possible problems with lazy load optimization (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/10">#10</a>).<br>
`+` Added support for any tree with bookmarks/history items (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/15">#15</a>).<br>
`x` Correctly delete more than 12 items from click options.<br>
`+` Added ability to not save scroll position in click options (checkbox in View menu and <em>extensions.handyclicks.sets.rememberScrollPosition</em> preference).<br>
`*` Slightly improved performance of Import menu.<br>
`*` Preference <em>extensions.handyclicks.devMode</em> renamed to <em>extensions.handyclicks.debug</em>.<br>
`x` Fixed hotkeys for scripts/styles reloader (Ctrl+Alt+R and Ctrl+Alt+C with <em>extensions.handyclicks.debug</em> = true).<br>
`*` Load scripts/styles reloader after small delay to improve startup performance.<br>
`*` Updated icons: now used <a href="http://fatcow.com/free-icons/">Farm-fresh icons by FatCow Web Hosting</a>, also added 32x32 icons for Australis (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/16">#16</a>).<br>
`*` Improved performance of <em>extensions.handyclicks.precompileCustomTypes</em> option.<br>
`+` Added ability to cache already created custom functions to improve performance (<em>extensions.handyclicks.cacheCustomFunctions</em> preference).<br>
`+` Added support for <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">Browser Console</a> (but <a href="https://addons.mozilla.org/addon/console²/">Console²</a> will be used instaed, if available).<br>
`*` Improved performance, if used “move tab: relative” option (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/14">#14</a>).<br>
`+` Added hotkey for error console (Ctrl+Shift+J) to settings window.<br>
`*` Changed default actions for left- and middle-click on menu item (Settings – Organize – Controls behavior), be careful!<br>
`+` Added support for history menu inside Australis menu-button.<br>
`x` Fixed actions execution on “command” event.<br>
`*` Slightly improved startup performance of editor window (optimized creation of toolbars after tabs).<br>
`*` Improved performance: some read/write operations moved to separate thread (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/17">#17</a>).<br>
`*` Crop too long custom codes in settings tree to improve performance (<em>extensions.handyclicks.sets.codeLengthLimit</em> preference).<br>
`*` Changed default hotkeys to open settings (Shift+F2 → Ctrl+F2) and to start edit mode (Ctrl+F2 → Alt+F2) (<em>extensions.handyclicks.key.</em>* preferences), be careful!<br>
`*` Some minor improvements and fixes.<br>

##### 0.1.3pre2 (2013-12-28)
`x` Corrected settings tree appearance on Windows with Aero theme (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/4">#4</a>).<br>
`x` Correctly focus already opened Scratchpad with CodeMirror backend (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/7">#7</a>).<br>
`x` Fixed unwanted separator in toolbar button context menu on Firefox 29.0a1.<br>
`x` Imported some recent fixes from <a href="https://addons.mozilla.org/addon/right-links/">Right Links</a> extension (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/1">#1</a>).<br>
`+` Added support for OS modifier key (typically this is Windows key) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/5">#5</a>).<br>
`*` Removed hacks for async AddonManager (this should improve startup performance) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/6">#6</a>).<br>
`+` Added F1 hotkey to search field in settings window (shows tooltip with brief help).<br>
`*` Improved startup performance: now used lazy loading for some scripts (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/9">#9</a>, <a href="https://github.com/Infocatcher/Handy_Clicks/issues/10">#10</a>).<br>
`*` Improved navigation between search results: current row now placed at center of view.<br>
`*` Improved startup performance in disabled mode: now extension don't read settings file and don't handle clicks-related events (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/11">#11</a>).<br>
`*` Improved startup performance: now settings file loaded after small delay.<br>
`x` Fixed possible memory leak with settings data.<br>
`x` Fixed handling of private windows in SeaMonkey (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/12">#12</a>).<br>
`+` Added special styles for Test/Undo buttons in disabled mode.<br>
`+` Added ability to open settings menu from keyboard (<em>extensions.handyclicks.key.showSettingsPopup</em> preference).<br>
`*` Some minor improvements and fixes.<br>

##### 0.1.3pre (2013-12-18)
`*` Published on GitHub.<br>

##### Older versions
<a title="Available only in Russian, sorry" href="https://translate.google.com/translate?sl=ru&tl=en&u=http%3A%2F%2Finfocatcher.ucoz.net%2Fext%2Ffx%2Fhandy_clicks%2Fchangelog.txt">changelog.txt</a>
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
`+` Added export/import for separate *.js files (`//> %hc_ScriptsDir%/example.js` in code, also added %hc_ScriptsDir% alias for %profile%/handyclicks/scripts/ and %data% search placeholder, <em>extensions.handyclicks.sets.importPaths</em> preference to allow import/export: "D:\hcScripts|%CurProcD%\hcScripts") (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/32">#32</a>).<br>
`*` Restored window.handyClicks (as lazy getter) to detect Handy Clicks presence even in disabled mode.<br>
`*` Improved startup performance: load handyclicks.js after small delay, increased delay to preload settings.<br>
`*` Added special highlighting for custom files (`//> %hc_ScriptsDir%/example.js` in code).<br>
`*` UI tweaks and improved localization strings.<br>
`+` Added menu to insert search placeholders (like %custom%).<br>
`x` Correctly reset filter: fix possible rows disappearance.<br>
`*` Sort rows alphabetically: types in normal mode and parent rows in inverse mode.<br>
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
`*` Increased delay to close notifications + spacial delay for warnings (<em>extensions.handyclicks.notify.openTimeWarnings</em> preference).<br>
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
`+` Added ability to remember tree state (View – Remember tree state, <em>extensions.handyclicks.sets.rememberState</em> preference).<br>
`*` Make menu items to remove user backups configurable (<em>extensions.handyclicks.sets.backupUserRemoveDepth</em> and <em>extensions.handyclicks.sets.backupUserRemoveDepth2</em> preferences).<br>
`*` Optimized usage of “properties” attribute in XUL tree (≈1.5x faster tree drawing).<br>
`+` Added %delay% search placeholder to search for delayed actions.<br>
`*` Show file description (instead of product name and useless version) in tooltip for icon of external editor, also try show description in MacOS (not tested).<br>
`*` Optimized creation of container items in tree, don't use slow DOMParser (≈1.2x faster tree drawing).<br>
`*` Open not sibling menu (and close currently opened) after “mouseover” + delay (<em>extensions.handyclicks.ui.openMenuDelay</em> preference).<br>
`+` Added ability to search for placeholder string itself (e.g. “%%on%%” for “%on%”).<br>
`*` Optimized filter mode: hide items instead of remove them (≈2.5x faster filtration).<br>
`x` Correctly initialize delayed actions for not custom actions.<br>
`x` Fixed Ctrl+Down/Up in editor's text fields in Firefox 52+ (for navigation like Tab/Ctrl+Tab).<br>
`x` Fixed Ctrl+Tab/Ctrl+Shift+Tab and Ctrl+PageDown/Ctrl+PageUp tabs navigation in Firefox 52+: force navigate only inside focused tabs.<br>
`*` Rewritten and simplified trick to not focus read-only textboxes with functions arguments description.<br>
`*` Search: expand only to matched items (and don't expand all tree).<br>
`*` Find next down/up: select first search result, if it not visible inside collapsed tree, also start navigation from selection (instead of internal index).<br>
`*` Select all search results: scroll to nearest not visible item, if there is not visible items.<br>
`+` Added menu items and hotkeys to collapse/expand tree (now not only not intuitive click on “Shortcut and target” column).<br>
`x` Correctly reload settings in import mode (F5): will be stored source of imported data for future reloading.<br>
`*` Added icons to “Open backups directory”, “Restore…”, “Show file” and “Remove” menu items (<a href="https://www.fatcow.com/free-icons">Farm-Fresh Web Icons by FatCow Web Hosting</a>).
`x` Corrected selection handling in tree: fixed enabling/disabling for delayed action in case of selected normal (parent) action.<br>
`x` Fixed scripts reloader (Ctrl+Alt+R, <em>extensions.handyclicks.debug</em> = true): don't call g.shutdown(), fixed link to delete button in editor.<br>
`*` Updated and improved scripts and styles reloader (Ctrl+Alt+R, Ctrl+Alt+C, <em>extensions.handyclicks.debug</em> = true): also reload consts.js and data.js, simplified code.<br>
`*` Compatibility enhancements for Pale Moon and Basilisk.<br>
`+` Settings window: added ability to import settings using drag-and-drop (.ini/.js files, settings links or settings in plain text).<br>
`*` Restore scroll position in tree: workaround to force scroll to last row.<br>
`*` Editor: sort custom types alphabetically (by label), ability to also sort built-in types (<em>extensions.handyclicks.editor.ui.sortInternalTypes</em> preference, disabled by default).<br>
`+` Editor: added context menu to open saved shortcut.<br>
`*` Rewritten and corrected code to select items in tree using mouse move (press mouse button and then drag to select): correctly select from topmost and bottommost visible rows (also don't scroll after inaccurate click with small mouse movement), reduced autoscroll speed, optimized performance.<br>
`x` Fixed notification window: don't show outside of screen.<br>
`*` Rewritten notification window to better show very long messages (also introduced <em>extensions.handyclicks.notify.messageMaxWidth</em> and <em>extensions.handyclicks.notify.messageMaxHeight</em> preferences), also now used CSS transitions for closing timer visualization.<br>
`*` Always show error notification for compilation errors (and for linked file errors), not only first time.<br>
`*` Updated <a href="https://github.com/Infocatcher/Handy_Clicks#api-functions">notify() API</a>: used options argument for better readability, added ability to create buttons in notification window.<br>
`*` Changed behavior of notification windows: don't close after right-click (+ <em>extensions.handyclicks.notify.middleClickToClose</em> preference to close after middle-click), close (focused) notification window using Esc key, close all notification windows after click with any modifier or middle-click on close button, added context menu to copy selected or all text (and left-click action will not executed after text selection) and to close current or all notifications.<br>
`x` Fixed notification window: don't close under cursor in case of wrong order of mouse events (e.g. after “mouseup” outside of window).<br>
`*` Added ability to not open the same notification twice (<em>extensions.handyclicks.notify.dontOpenTwice</em> preference).<br>
`x` Fixed handyClicksFuncs.getItemURI() function for bookmarks/history tree (did not work without hc.event property).<br>
`x` Fixed edit mode tooltip for XUL tree (bookmarks, history items).<br>
`x` Correctly prevent context menu after delayed action.<br>
`*` Preferences for notification window was renamed from <em>extensions.handyclicks.notify<ins>Name</ins></em> to <em>extensions.handyclicks.notify<ins>.name</ins></em>.<br>
`x` Correctly reload auto-restored from backup settings (in case of broken settings file).<br>
`x` Changed auto-backups behavior (handyclicks_prefs_autobackup-<em>%date%</em>.js): create copy right after save (and not before: there is handyclicks_prefs_backup-<em>%number%</em>.js for that) and after delay (if pressed “Apply” button) for better performance.<br>
`*` Improved internal code for backups menu.<br>
`x` Fixed notifications from “on top” windows.<br>
`x` Fixed “Close” button icon in notification window in Firefox 28 and older, SeaMonkey 2.25 and older.<br>
`*` Improved “rearrange windows” for notifications (<em>extensions.handyclicks.notify.rearrangeWindows</em> preference): rearrange only windows with the same parent window and move all windows one by one (not just shift position).<br>
`x` Correctly open <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">Browser Console</a> in Firefox 56.<br>
`*` Optimized <em>extensions.handyclicks.ui.inheritToolbarContextMenu</em> preference: removed slow “node ~ *” CSS selector.<br>
`x` Fixed “Move to …”/“Remove from …” context menu items in Firefox 56 (<em>extensions.handyclicks.ui.inheritToolbarContextMenu</em> preference).<br>
`x` Fixed “scroll to switch” from tabs toolbar in editor (<em>extensions.handyclicks.sets.scrollLists</em> preference).<br>
`x` Fixed `handyClicksWinUtils.openSettingsPane()` in case of closed settings window.<br>
`-` Removed `handyClicksCleanupSvc.registerNodeCleanup()` API: too bad for performance and useless in most cases, removed `handyClicksCleanupSvc.registerCleanup(func, context, args)`, use `handyClicksRegSvc.registerCleanup(func, context)` instead (see <a href="https://github.com/Infocatcher/Handy_Clicks/issues/13">#13</a>).<br>
`*` Improved startup performance: don't load winUtils.js from uninstaller.js.<br>
`*` Changed API: `handyClicksUtils.storage(key, val)` replaced with `handyClicksGlobals.storage.get(key)/set(key, val)`.<br>
`x` Fixed `handyClicksGlobals.storage` in Firefox 57+.<br>
`x` Fixed ability to choose files in Firefox 57+ (used hack to make nsIFilePicker synchronous).<br>
`x` Fixed error line numbers in Firefox 56+ (looks like Firefox bug, now always decremented by 2).<br>
`x` Fixed preferences handling in Firefox 58+: now used nsIPrefBranch.getStringPref()/setStringPref().<br>
`x` Fixed Windows default theme detection in Firefox 58+ for correct tree styles.<br>
`x` Fixed close tabs warning in Firefox 29+ and Basilisk (<em>browser.tabs.warnOnClose</em> preference).<br>
`x` Fixed open in background window in new Firefox versions (added <em>extensions.handyclicks.funcs.backgroundWindowDelay</em> preference).<br>
`x` Restored default preferences in Firefox 58+.<br>
`x` Workaround to reload image in Firefox 44+ (imgICache.removeEntry() is gone… <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1202085#c39">bug 1202085</a>).<br>
`x` Force use 16×16 icons for toolbar button in Firefox 59+.<br>
`x` Restored settings window in Firefox 59+: used XBL bindings and styles from Firefox 58 to restore &lt;prefwindow&gt; (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1379338">bug 1379338</a>).<br>
`x` Fixed tabs toolbar detection in Firefox 58+.<br>
`*` Changed edit mode notification: close previous notification, open under cursor after click on unsupported element and close after exiting from edit mode.<br>
`+` Added ability to localize custom labels, example: “Function name @ru:Имя функции” (“default text @locale1:… @locale2:…”), also added <em>extensions.handyclicks.locale</em> preference to set override browser locale.<br>
`x` Fixed scripts reloader (Ctrl+Alt+R, <em>extensions.handyclicks.debug</em> = true) in Firefox 59+: chrome://…/_reloader.js doesn't work anymore, just renamed to reloader.js.<br>
`*` Edit mode tooltip: show URLs in multiple lines (e.g. for tab bar).<br>
`*` Improved code length limit to not show too long code in settings tree: <em>extensions.handyclicks.sets.codeLengthLimit</em> = 0 to not crop code, added <em>extensions.handyclicks.sets.codeLengthLimit.preserveLines</em> preference (max additional chars to show entire line).<br>
`*` Reload image: ignore data:… URIs (nothing to reload) + apply “blink” animation to image.<br>
`+` Editor: added context menu item to rename shortcut.<br>
`x` Fixed hotkeys to import from clipboard (Ctrl+V, Ctrl+Shift+V, Shift+Ins): now used separate command, which will never be disabled.<br>
`+` Import settings: show (and highlight) removed items in replace mode (available only “Edit saved” from context menu), also added %old% search placeholder (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/34">#34</a>).<br>
`*` Improved appearance of import statistics: aligned using grid, highlight non-zero values, link-like color to highlight hovered clickable rows.<br>
`*` Delete item: select next editable/deletable or last item.<br>
`*` Delete item: workaround to force restore scroll to last row.<br>
`*` Restore from backup menu: use short date format (if available modern `Date.prototype.toLocaleString(locale, options)`) and use acceltext to show file size for better alignment.<br>
`*` Updated checkbox icons in settings tree and added icon for “Toggle” context menu item (used icons from Windows 7).<br>
`*` Highlight hovered checkbox cells in settings tree.<br>
`+` Added blacklists for left- middle- and right-clicks without modifiers to disable click handling on user-defined sites (<em>extensions.handyclicks.blacklist.0</em>, …<em>1</em>, …<em>2</em> preferences).<br>
`*` Also remember current index in settings tree, not only selected items.<br>
`x` Compatibility fixes for SeaMonkey 2.55+.<br>
`x` Fixed missing overflow style for delayed function (for too many function arguments), also added min height for code textbox.<br>
`*` Disable “scroll to switch”, if detected scrollbar.<br>
`*` Used lazy loading for utils.js and prefSvc.js in settings and editor for better performance.<br>
`*` Moved I/O-related code from utils.js to separate io.js file with lazy loading (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/35">#35</a>).<br>
`*` Moved often used utils from utils.js to separate jsUtils.js file with lazy loading (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/36">#36</a>).<br>
`*` Changed execution context to initialize custom functions from this.fn to this.hc (to not load funcs.js on startup).<br>
`x` Fixed “on top” button, if opened in tab.<br>
`x` Correctly check for unsaved tree, if opened in tab.<br>
`+` Added favicons for editor and settings in tab.<br>
`+` Show custom types in settings tree (+ <em>extensions.handyclicks.sets.treeSortCustomTypes</em> preference: -1 – show before settings, 0 – sort with settings, 1 – show after settings) (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/37">#37</a>).<br>
`x` Delete item in tree: correctly handle unnamed items.<br>
`*` Confirm custom type deletion in case of related actions presence.<br>
`*` Don't draw tree, if settings opened in import mode.<br>
`*` Improved font color brightness detection for dark themes (based on code from <a href="https://github.com/bgrins/TinyColor">TinyColor</a>).<br>
`x` Fixed “custom type not used” tooltip in new Firefox versions.<br>
`*` Editor: auto-select custom type in list even if type was renamed (and also show localized labels).<br>
`*` Rewritten styles for iconized menu items + removed global.css (so, also improved performance).<br>
`*` Settings: improved localization for export/copy to clipboard menu items.<br>
`*` Improved behavior of “Close this menu after click” menu item: apply new logic right after click.<br>
`*` Changed title of editor window: used “button + modifiers” order, used separator from browser localization and added “Type:” prefix for custom type.<br>
`+` Added Ctrl+1…6 hotkeys to change settings tree draw mode.<br>
`+` Added menu item to remove duplicate backups (Import – Restore from backup – Remove duplicates), also improved backup process: files will be renamed in case of detected files removal and now used async way to remove backups after depth change.<br>
`*` Optimized items detection: don't call node.localName.toLowerCase() for XUL nodes (XUL tags should be always in lower case).<br>
`x` Correctly show unsaved state of settings tree after startup (e.g. due to settings format change).<br>
`x` Fixed settings preloading in case of fast disable/enable calls.<br>
`x` Settings for controls behavior: added “open editor” and “open types editor” commands.<br>
`+` Scripts reloader (<em>extensions.handyclicks.debug</em> = true): added Ctrl+Alt+W hotkey to reopen dialog window (settings, editor).<br>
`*` Scripts reloader (<em>extensions.handyclicks.debug</em> = true): flush internal browser caches in Firefox 3.6+ instead of .js?random_numbers hack.<br>
`+` Added ability to sort tree (click on column or from menu: View – Sort by), also added <em>extensions.handyclicks.sets.rememberSort</em> and <em>extensions.handyclicks.sets.treeSortAutoInlineDrawMode</em> preferences.<br>
`*` Compare current and saved settings: ignore version difference, if there is no actual changes (for forward compatibility).<br>
`*` Changed behavior for clicks on “Shortcut and target” column: hold Shift, Alt or Meta to collapse/expand tree, right-click to expand one tree level, middle-click (or Ctrl+left-click) to collapse one tree level.<br>
`*` Used sub-menu for “Remember …” menu items.<br>
`+` Highlight current row in tree, if search was wrapped (navigated from last to first search result or vice versa).<br>
`*` Improved <em>extensions.handyclicks.sets.treeExpandDelayedAction</em> = false: don't force collapse delayed actions and restore saved state.<br>
`*` Better autocompletion for “Scratchpad” in external editor path: ignore input after already autocompleted “Scratchpad”, autocomplete after any character, not only for “s” + typed “c”.
`*` Iterate over all backups and auto-restore newest appreciate file (especially useful in case of removed duplicate backups).<br>
`+` Editor: added “switch to settings tree” command (F3).<br>
`+` Editor: added “Settings” menu.<br>
`+` Editor: added UI for <em>extensions.handyclicks.editor.ui.invertWindowTitle</em> and <em>extensions.handyclicks.editor.ui.compact</em> preferences.<br>
`+` Editor: added menu item to open settings.<br>
`+` Settings, editor: added menu item to reload settings (for already existing F5/Ctrl+R hotkey).<br>
`*` Added confirmation for “reload settings” command (<em>extensions.handyclicks.ui.confirmReload</em> preference).<br>
`x` Reload settings + custom type: don't show unsaved warning.<br>
`x` Scroll to switch: correctly scroll radio menu items inside closed menu-buttons (dispatch fake “popupshowing” event to initialize).<br>
`*` Improve search/filter counter: also show total settings count.<br>
`+` Added %internal% search placeholder for built-in code/items.<br>
`*` Focus settings tree after execution of tree-related commands.<br>
`*` Edit only clicked row after middle-click (instead of all selected rows).<br>
`+` Added “focus tree” menu item (to show Ctrl+T hotkey).<br>
`*` Import from clipboard: added support for settings files.<br>
`*` Added menu to disable/restore warning messages.<br>
`+` Internal editor: added Ctrl+/ hotkey to comment code (like in Scratchpad).<br>
`x` Editor: fixed autocompletion for words with “-” (e.g. “background-color”) and with numbers (e.g. “Float32Array”).<br>
`*` Editor: autocompletion for “style” property.<br>
`*` Changed limits for editor preferences (<em>extensions.handyclicks.editor.autocompleteMinSymbols</em>: 30 -> 10, <em>extensions.handyclicks.editor.tabSize</em>: 100 -> 300, font size limit: 48 -> 64).<br>
`*` Make search/filter counter clickable: left/right-click – find next down/up, middle-click – select all search results/clear selection.<br>
`+` Editor: added F2 hotkey to open about:config for focused depended option.<br>
`+` Added ability to open temp directory from “Looks like browser was crashed: at least one temporary file for external editor wasn't removed” warning message.<br>
`x` Fixed test backups for <em>extensions.handyclicks.sets.backupTestDepth</em> = 1.<br>
`+` Ask to save settings before browser quit/restart.<br>
`*` Editor: better tricks to allow edit custom types with equals labels (but it's recommended to use unique labels).<br>
`x` Fixed `nsIProtocolHandler.newURI()` implementation for handyclicks://… protocol in Firefox 58+.<br>
`*` Improved import performance: re-use data, that was already parsed on validation step.<br>
`*` Controls behavior: force show context menu after right-click with any modifier.<br>
`*` External editor: added default command line arguments for Visual Studio Code, CudaText and updated for AkelPad (Windows only).<br>
`*` Settings: better handle I/O errors.<br>
`*` Open/close settings: ask to save changes.<br>
`*` Exit from import mode: ask to save in changed editors.<br>
`+` Settings: added menu items and hotkeys to separately reload clicks options / about:config preferences.<br>
`*` Editor: added note for Meta key (Mac OS only).<br>
`*` Editor: better handle unsaved custom type.<br>
`x` Fixed error line numbers in Pale Moon 28.5+ (looks like Pale Moon bug, now always decremented by 1).<br>
`*` Increased saving performance, optimized way to rename backup files (≈2.4x faster with default settings).<br>
`*` Changed handyClicksPrefSvc.registerDestructor(): also specify DESTROY_WINDOW_UNLOAD reason for last window (more intuitive).<br>
`*` Copy in HTML format: also add text/html data for WYSIWYG editors & Co.<br>
`*` Reopen edit mode tooltip to force make it topmost, if was opened another tooltip.<br>
`+` Added %+lng%/%-lng% search placeholders for custom functions with localized/not localized labels.<br>
`x` Correctly rename unloaded tabs.<br>
`*` Various internal code enhancements.<br>

##### 0.1.3pre8 (2019-03-04)
<em>(backported from master/HEAD)</em><br>
`*` Improved settings performance: used faster way to detect unsaved state (compare only settings data without hash calculations).<br>
`*` Compare current and saved settings: ignore version difference, if there is no actual changes (for forward compatibility).<br>
`x` Fixed hotkeys to import from clipboard (Ctrl+V, Ctrl+Shift+V, Shift+Ins): now used separate command, which will never be disabled.<br>
`x` Delete item in tree: correctly handle unnamed items.<br>
`x` Fixed Ctrl+Tab/Ctrl+Shift+Tab and Ctrl+PageDown/Ctrl+PageUp tabs navigation in Firefox 52+: force navigate only inside focused tabs.<br>

##### 0.1.3pre7 (2019-02-10)
<em>(backported from master/HEAD)</em><br>
`x` Editor: fixed autocomplete feature for properties of `window` object.<br>
`x` Fixed support for <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console">Browser Console</a> in Firefox 48+.<br>
`x` Fixed Scratchpad support in Firefox 56+.<br>
`x` Correctly reset filter: fix possible rows disappearance.<br>
`x` Fixed XSS in labels for custom types.<br>
`x` Fixed user backups highlighting in “Restore from backup” menu.<br>
`x` Correctly open all preferences in case of unloaded about:config tab presence.<br>
`x` Correctly import multiline <em>extensions.handyclicks.editor.external.args</em> preference.<br>
`x` Correctly set selection in Scratchpad in Firefox 44+.<br>
`x` Fixed trim trailing spaces (Alt+Backspace) in Firefox 49+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1108382">bug 1108382</a>).<br>
`x` Editor: fixed temp file name for delayed actions.<br>
`x` Fixed “scroll to switch” from tabs toolbar in editor (<em>extensions.handyclicks.sets.scrollLists</em> preference).<br>
`x` Fixed internal storage in settings and editor windows in Firefox 47+ (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/28">#28</a>).<br>
`x` Workaround to reload image in Firefox 44+ (imgICache.removeEntry() is gone… <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1202085#c39">bug 1202085</a>).<br>
`*` Compatibility enhancements for Pale Moon and Basilisk.<br>
`x` Fixed close tabs warning in Firefox 29+ and Basilisk (<em>browser.tabs.warnOnClose</em> preference).<br>
`x` Fixed error line numbers in Firefox 56+ (looks like Firefox bug, now always decremented by 2).<br>

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
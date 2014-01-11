#### Handy Clicks: Changelog

`+` – added<br>
`-` – deleted<br>
`x` – fixed<br>
`*` – improved<br>

##### master/HEAD
`*` Slightly improved startup performance: now styles for “blink” node feature are loaded just before first usage.<br>
`x` Fixed: correctly remember target directory during export from uninstall dialog.<br>
`*` Slightly improved startup performance: initialize uninstaller only after first window will be opened.<br>
`*` Added ability to show context menu after left-click on menu item.<br>
`*` Now used undoable way to reset controls behavior.<br>
`*` Improved way to open Unicode URIs in other applications (handyClicksFuncs.showOpenURIWithAppsPopup() API and <em>extensions.handyclicks.funcs.preferRunw</em> preference).<br>
`x` Fixed possible problems with lazy load optimization (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/10">#10</a>).<br>
`+` Added support for any tree with bookmarks/history items (<a href="https://github.com/Infocatcher/Handy_Clicks/issues/15">#15</a>).<br>
`x` Correctly delete more than 12 items from click options.<br>
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
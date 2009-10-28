// Description:
pref("extensions.handyclicks@infocatcher.description", "chrome://handyclicks/locale/hcs.properties");

pref("extensions.handyclicks.enabled", true);
pref("extensions.handyclicks.forceStopMousedownEvent", false);
pref("extensions.handyclicks.focusOnItems", true);
pref("extensions.handyclicks.disallowMousemoveButtons", "2");
pref("extensions.handyclicks.disallowMousemoveDist", 12);
pref("extensions.handyclicks.delayedActionTimeout", 500);

pref("extensions.handyclicks.notifyOpenTime", 3000);
pref("extensions.handyclicks.notifyInWindowCorner", false);
pref("extensions.handyclicks.notifyDontCloseUnderCursor", true);

pref("extensions.handyclicks.ui.showInToolsMenu", true);
pref("extensions.handyclicks.ui.showInStatusbar", true);

pref("extensions.handyclicks.funcs.loadJavaScriptLinks", true);
pref("extensions.handyclicks.funcs.notifyJavaScriptLinks", true);

pref("extensions.handyclicks.funcs.loadVoidLinksWithHandlers", true);
pref("extensions.handyclicks.funcs.notifyVoidLinksWithHandlers", true);

pref("extensions.handyclicks.funcs.filesLinksPolicy", -1);
pref("extensions.handyclicks.funcs.filesLinksMask", "^[^?&=#]+\.(?:zip|rar|7z|gz|tar|bz2|iso|cab|exe|msi|xpi|jar)$");

pref("extensions.handyclicks.funcs.decodeURIs", true);

pref("extensions.handyclicks.funcs.convertURIs", false); // for Windows
pref("extensions.handyclicks.funcs.convertURIsCharset", ""); // use defaults

pref("extensions.handyclicks.funcs.multipleTabsOpenDelay", 30);
pref("extensions.handyclicks.funcs.trimStrings", true);

pref("extensions.handyclicks.key.toggleStatus", "VK_F2");
pref("extensions.handyclicks.key.openSettings", "shift VK_F2");
pref("extensions.handyclicks.key.editMode", "accel VK_F2");
pref("extensions.handyclicks.key.importFromClipboard", "accel shift VK_F2");

pref("extensions.handyclicks.editor.tabSymbol", "	");

pref("extensions.handyclicks.sets.backupsDir", ""); // Allow import this value
pref("extensions.handyclicks.sets.backupDepth", 4);
pref("extensions.handyclicks.sets.importJSWarning", true);
pref("extensions.handyclicks.sets.openEditorsLimit", 5);
pref("extensions.handyclicks.sets.dateFormat", "_%Y-%m-%d_%H-%M"); // String for new Date().toLocaleFormat()

pref("extensions.handyclicks.prefsVersion", 0);
pref("extensions.handyclicks.devMode", true);
// Description:
pref("extensions.handyclicks@infocatcher.description", "chrome://handyclicks/locale/hcs.properties");

pref("extensions.handyclicks.enabled", true);
pref("extensions.handyclicks.focusOnItems", true);
pref("extensions.handyclicks.disallowMousemoveButtons", "02");
pref("extensions.handyclicks.disallowMousemoveDist", 12);
pref("extensions.handyclicks.delayedActionTimeout", 500);
pref("extensions.handyclicks.cacheCustomFunctions", true);
// true  - call new Function() only once (and cache result), better performance
// false - call new Function() each time, less memory usage
pref("extensions.handyclicks.precompileCustomTypes", false);

pref("extensions.handyclicks.types.links.CSSEditor", true);
pref("extensions.handyclicks.types.images.canvas", true);
pref("extensions.handyclicks.types.images.SpeedDial", false);

pref("extensions.handyclicks.notifyOpenTime", 4000);
pref("extensions.handyclicks.notifyOpenTimeWarnings", 10000);
pref("extensions.handyclicks.notifyInWindowCorner", false);
pref("extensions.handyclicks.notifyFocusAlreadyOpened", true);
pref("extensions.handyclicks.notifyDontCloseUnderCursor", true);
pref("extensions.handyclicks.notifyRearrangeWindows", true);
pref("extensions.handyclicks.notifyMessageMaxWidth", 480);
pref("extensions.handyclicks.notifyMessageMaxHeight", 240);

pref("extensions.handyclicks.notifyEditMode", 2);

pref("extensions.handyclicks.ui.showInToolsMenu", true);
pref("extensions.handyclicks.ui.showInAppMenu", true);
pref("extensions.handyclicks.ui.showAppMenuSeparator", false);
pref("extensions.handyclicks.ui.showInStatusbar", true);
pref("extensions.handyclicks.ui.customizableProgressBar", true);
pref("extensions.handyclicks.ui.showAllSettingsMenuitem", false);
pref("extensions.handyclicks.ui.showMouseButton", true);
pref("extensions.handyclicks.ui.showMouseButton.restoreDelay", 150);
pref("extensions.handyclicks.ui.inheritToolbarContextMenu", true);
pref("extensions.handyclicks.ui.actionMenuLeftClick", 1);
pref("extensions.handyclicks.ui.actionMenuMiddleClick", 0);
pref("extensions.handyclicks.ui.actionMenuRightClick", 2);
pref("extensions.handyclicks.ui.actionStatusbarLeftClick", 0);
pref("extensions.handyclicks.ui.actionStatusbarMiddleClick", 1);
pref("extensions.handyclicks.ui.actionStatusbarRightClick", 2);
pref("extensions.handyclicks.ui.actionToolbarLeftClick", 0);
pref("extensions.handyclicks.ui.actionToolbarMiddleClick", 1);
pref("extensions.handyclicks.ui.actionToolbarRightClick", 2);
pref("extensions.handyclicks.ui.onTopButton", true);
pref("extensions.handyclicks.ui.onTopButtonLabel", true);
pref("extensions.handyclicks.ui.onTopBorderColor", "orange");
pref("extensions.handyclicks.ui.reverseScrollDirection", false);
pref("extensions.handyclicks.ui.dragSwitchDelay", 250);
pref("extensions.handyclicks.ui.openMenuDelay", 300);
pref("extensions.handyclicks.ui.notifyUnsaved", true);

pref("extensions.handyclicks.funcs.loadJavaScriptLinks", true);
pref("extensions.handyclicks.funcs.notifyJavaScriptLinks", true);

pref("extensions.handyclicks.funcs.loadVoidLinksWithHandlers", true);
pref("extensions.handyclicks.funcs.notifyVoidLinksWithHandlers", true);

pref("extensions.handyclicks.funcs.filesLinksPolicy", -1);
pref("extensions.handyclicks.funcs.filesLinksMask", "^[^?&=#]+\.(?:zip|rar|7z|gz|tar|bz2|iso|cab|exe|msi|msu|xpi|jar)$");

pref("extensions.handyclicks.funcs.decodeURIs", true);
pref("extensions.handyclicks.funcs.decodeURIs.unknownProtocols", false);
pref("extensions.handyclicks.funcs.decodeURIs.spaces", false);

pref("extensions.handyclicks.funcs.convertURIs", false); // for Windows
pref("extensions.handyclicks.funcs.convertURIsCharset", ""); // use defaults
pref("extensions.handyclicks.funcs.preferRunw", true); // Use Unicode nsIProcess.runw(), if available

pref("extensions.handyclicks.funcs.multipleTabsOpenDelay", 200);
pref("extensions.handyclicks.funcs.openOnlyVisibleLinks", true);
pref("extensions.handyclicks.funcs.trimStrings", true);

pref("extensions.handyclicks.funcs.workaroundForMousedownImitation", true);
pref("extensions.handyclicks.funcs.dontUseTabsInPopupWindows", true);

pref("extensions.handyclicks.key.toggleStatus", "VK_F2");
pref("extensions.handyclicks.key.openSettings", "accel VK_F2");
pref("extensions.handyclicks.key.openAboutConfig", "");
pref("extensions.handyclicks.key.editMode", "alt VK_F2");
pref("extensions.handyclicks.key.importFromClipboard", "accel shift VK_F2");
pref("extensions.handyclicks.key.showSettingsPopup", "");

pref("extensions.handyclicks.sets.backupsDir", ""); // Allow import empty value
pref("extensions.handyclicks.sets.backupDepth", 5);
pref("extensions.handyclicks.sets.backupAutoDepth", 10);
pref("extensions.handyclicks.sets.backupAutoInterval", 86400); // 24*60*60
pref("extensions.handyclicks.sets.backupTestDepth", 5);
pref("extensions.handyclicks.sets.backupCorruptedDepth", 15);
pref("extensions.handyclicks.sets.backupUserRemoveDepth", 1);
pref("extensions.handyclicks.sets.backupUserRemoveDepth2", 10);
pref("extensions.handyclicks.sets.removeBackupConfirm", true);
pref("extensions.handyclicks.sets.importJSWarning", true);
pref("extensions.handyclicks.sets.incompleteImportWarning", true);
pref("extensions.handyclicks.sets.openEditorsLimit", 5);
pref("extensions.handyclicks.sets.dateFormat", "_%Y-%m-%d_%H-%M"); // String for new Date().toLocaleFormat(), Firefox 54 and older
pref("extensions.handyclicks.sets.treeDrawMode", 0);
pref("extensions.handyclicks.sets.treeExpandDelayedAction", true);
pref("extensions.handyclicks.sets.localizeArguments", true);
pref("extensions.handyclicks.sets.codeLengthLimit", 1000); // Crop too long custom codes to improve performance
pref("extensions.handyclicks.sets.closeTreeViewMenu", true);
pref("extensions.handyclicks.sets.rememberSearchQuery", true);
pref("extensions.handyclicks.sets.rememberScrollPosition", true);
pref("extensions.handyclicks.sets.rememberState", true);
pref("extensions.handyclicks.sets.overrideInstantApply", -1);
// Override browser.preferences.instantApply behavior:
// -1 - don't change (use browser defaults)
//  0 - override to false
//  1 - override to true
pref("extensions.handyclicks.sets.scrollLists", true);
pref("extensions.handyclicks.sets.scrollLists.onlyInActiveWindow", false);

pref("extensions.handyclicks.editor.tabSize", 4);
pref("extensions.handyclicks.editor.tabSpaces", false);
pref("extensions.handyclicks.editor.autocomplete", true);
pref("extensions.handyclicks.editor.autocompleteMinSymbols", 2);
pref("extensions.handyclicks.editor.testFocusMainWindow", true);
pref("extensions.handyclicks.editor.unsavedSwitchWarning", true);
pref("extensions.handyclicks.editor.ui.showCustomFuncsNotes", true);
pref("extensions.handyclicks.editor.ui.sortInternalTypes", false);
pref("extensions.handyclicks.editor.ui.compact", false);
pref("extensions.handyclicks.editor.ui.invertWindowTitle", false);
pref("extensions.handyclicks.editor.external.path", "Scratchpad");
pref("extensions.handyclicks.editor.external.args", "");
pref("extensions.handyclicks.editor.external.extension", "js");
pref("extensions.handyclicks.editor.external.labelInFileName", true);
pref("extensions.handyclicks.editor.external.saveWithBOM", true);

pref("extensions.handyclicks.prefsVersion", 0);

pref("extensions.handyclicks.debug", false);
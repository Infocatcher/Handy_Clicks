// Description:
pref("extensions.handyclicks@infocatcher.ucoz.net.description", "chrome://handyclicks/locale/hcs.properties");

pref("extensions.handyclicks.enabled", true);
pref("extensions.handyclicks.stopMousedownEvent", false);
pref("extensions.handyclicks.forceHideContextMenu", true); // for Linux (mousedown -> contextmenu -> click)
pref("extensions.handyclicks.disallowMousemoveForButtons", "2");
pref("extensions.handyclicks.disallowMousemoveDist", 12);
pref("extensions.handyclicks.convertURIs", true); // for Windows
pref("extensions.handyclicks.convertURIsTo", ""); // use defaults
pref("extensions.handyclicks.showContextMenuTimeout", 500);

pref("extensions.handyclicks.notifyOpenTime", 3000);
pref("extensions.handyclicks.notifyInWindowCorner", false);

pref("extensions.handyclicks.loadJavaScriptLinks", true);
pref("extensions.handyclicks.notifyJavaScriptLinks", true);

pref("extensions.handyclicks.loadVoidLinksWithHandlers", true);
pref("extensions.handyclicks.notifyVoidLinksWithHandlers", true);

pref("extensions.handyclicks.filesLinksPolicy", -1);
pref("extensions.handyclicks.filesLinksMask", "^[^\\?]*\.(zip|rar|7z|gz|tar|bz2|iso|cab|exe|msi|xpi|jar)$");

pref("extensions.handyclicks.key.toggleStatus", "VK_F2");
pref("extensions.handyclicks.key.openSettings", "shift VK_F2");
pref("extensions.handyclicks.key.editMode", "accel VK_F2");

pref("extensions.handyclicks.devMode", true);
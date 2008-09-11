// Description:
pref("extensions.handyclicks@infocatcher.ucoz.net.description", "chrome://handyclicks/locale/hcs.properties");

pref("handyclicks.enabled", true);
pref("handyclicks.forceHideContextMenu", true); // for Linux (mousedown -> contextmenu -> click)
pref("handyclicks.disallowMousemoveForButtons", "2");
pref("handyclicks.convertURIs", true); // for Windows
pref("handyclicks.convertURIsTo", ""); // use defaults
pref("handyclicks.showContextMenuTimeout", 500);

pref("handyclicks.notifyOpenTime", 3000);
pref("handyclicks.notifyInWindowCorner", false);
pref("handyclicks.notifyVoidLinksWithHandlers", true);
pref("handyclicks.notifyJavaScriptLinks", true);

pref("handyclicks.filesLinksPolicy", -1);
pref("handyclicks.filesLinksMask", "^[^\\?]*\.(zip|rar|7z|gz|tar|iso|cab|exe|msi|xpi|jar)$");
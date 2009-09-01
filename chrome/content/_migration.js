(function() {
var guid = "handyclicks@infocatcher.ucoz.net";
var em = Components.classes["@mozilla.org/extensions/manager;1"]
	.getService(Components.interfaces.nsIExtensionManager);
if(!em.getInstallLocation(guid))
	return;
em.uninstallItem(guid);
alert("Handy Clicks updated and will try to uninstall previous version.\nWe apologize for any inconvenience...");
var appSt = Components.interfaces.nsIAppStartup;
Components.classes["@mozilla.org/toolkit/app-startup;1"]
	.getService(appSt)
	.quit(appSt.eForceQuit | appSt.eRestart);
})();
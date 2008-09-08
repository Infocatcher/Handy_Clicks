var handyClicksUtils = {
	strings: {}, // cache of strings from stringbundle
	consoleServ: Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService),
	_log: function(msg) {
		msg = "[Handy Clicks]: " + msg + "\n";
		this.consoleServ.logStringMessage(msg);
	},
	_error: Components.utils.reportError,
	getLocalised: function(name) {
		if(!this.strings[name])
			this.strings[name] = document.getElementById("handyClicks-strings").getString(name);
		return this.strings[name];
	}
};
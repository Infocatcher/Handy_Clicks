var handyClicksUtils = {
	consoleServ: Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService),
	prefsServ: Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefBranch),
	suppStr: Components.interfaces.nsISupportsString,
	_log: function(msg) {
		msg = "[Handy Clicks]: " + msg + "\n";
		this.consoleServ.logStringMessage(msg);
	},
	_error: Components.utils.reportError,
	pref: function(prefName) {
		var propName = "pref_" + prefName;
		if(typeof this[propName] == "undefined")
			this.readPref(prefName);
		return this[propName];
	},
	readPref: function(prefName) {
		this["pref_" + prefName] = this.getPref("extensions.handyclicks." + prefName);
	},
	getPref: function(prefName) {
		return this.isStringPref(prefName) ? this.getUnicharPref(prefName) : navigator.preference(prefName);
	},
	setPref: function(prefName, prefVal) {
		if(this.isStringPref(prefName))
			this.setUnicharPref(prefName, prefVal);
		else
			navigator.preference(prefName, prefVal);
	},
	isStringPref: function(prefName) {
		try {
			return this.prefsServ.getPrefType(prefName) == Components.interfaces.nsIPrefBranch.PREF_STRING;
		}
		catch(e) {
			alert(e);
			return false;
		}
	},
	getUnicharPref: function(prefName) {
		try {
			return this.prefsServ.getComplexValue(prefName, this.suppStr).data;
		}
		catch(e) {
			return "";
		}
	},
	setUnicharPref: function(prefName, prefVal) {
		try {
			var str = Components.classes["@mozilla.org/supports-string;1"]
				.createInstance(this.suppStr);
			str.data = prefVal;
			this.prefsServ.setComplexValue(prefName, this.suppStr, str);
		}
		catch(e) {
		}
	},

	_strings: {}, // cache of strings from stringbundle
	get localeBundle() {
		if("_localeBundle" in this == false)
			this._localeBundle = this.$("handyclicks-strings");
		return this._localeBundle;
	},
	get enBundle() {
		if("_enBundle" in this == false)
			this._enBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
				.getService(Components.interfaces.nsIStringBundleService)
				.createBundle("chrome://handyclicks/locale/en-US/hcs.properties");
		return this._enBundle;
	},
	getLocalised: function(name) {
		//~ temp
		if(name in this._strings == false)
			try { this._strings[name] = this.localeBundle(name) || this.enBundle(name) || name; }
			catch(e) { this._strings[name] = name }
		return this._strings[name];
		//~ temp end

		if(name in this._strings == false)
			this._strings[name] = this.localeBundle(name) || this.enBundle(name) || name;
		return this._strings[name];
	},
	isNoChromeDoc: function(doc) { // Except items in chrome window
		doc = doc || handyClicks.item.ownerDocument;
		return doc.defaultView.toString().indexOf("[object Window]") > -1; // [object XPCNativeWrapper [object Window]]
	}
};
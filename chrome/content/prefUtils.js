var handyClicksPrefUtils = {
	__proto__: handyClicksObservers, // Add observers interface
	observers: [],

	// Preferences:
	nPrefix: "extensions.handyclicks.",

	get prefBr() {
		delete this.prefBr;
		return this.prefBr = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefBranch2);
	},

	// Initialization:
	init: function() {
		window.addEventListener("unload", this, false); // destroy
		this.prefBr.addObserver(this.nPrefix, this, false);
		this.nLength = this.nPrefix.length;
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);
		this.prefBr.removeObserver(this.nPrefix, this);
	},
	handleEvent: function(e) {
		if(e.type == "unload")
			this.destroy();
	},

	// Preferences observer:
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		pName = pName.substring(this.nLength);
		this.readPref(pName);
		this.notifyObservers(pName);
	},

	// API functions:
	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
	},
	get ss() { return Components.interfaces.nsISupportsString; },
	_prefs: { __proto__: null }, // Prefs cache
	pref: function(pName, pVal) {
		if(typeof pVal != "undefined")
			return this.setPref(this.nPrefix + pName, pVal);
		if(!(pName in this._prefs))
			this.readPref(pName);
		return this._prefs[pName];
	},
	readPref: function(pName) {
		this._prefs[pName] = this.getPref(this.nPrefix + pName);
	},
	getPref: function(pName) {
		var pbr = Components.interfaces.nsIPrefBranch;
		switch(this.prefBr.getPrefType(pName)) {
			case pbr.PREF_STRING: return this.prefBr.getComplexValue(pName, this.ss).data;
			case pbr.PREF_INT:    return this.prefBr.getIntPref(pName);
			case pbr.PREF_BOOL:   return this.prefBr.getBoolPref(pName);
			default:              return null;
		}
	},
	setPref: function(pName, pVal) {
		var pbr = Components.interfaces.nsIPrefBranch;
		var pType = this.prefBr.getPrefType(pName);
		var isNew = pType == 0;
		var vType = typeof pVal;
		if(pType == pbr.PREF_BOOL || (isNew && vType == "boolean"))
			this.prefBr.setBoolPref(pName, pVal);
		else if(pType == pbr.PREF_INT || (isNew && vType == "number"))
			this.prefBr.setIntPref(pName, pVal);
		else if(pType == pbr.PREF_STRING || isNew) {
			var ss = this.ss;
			var str = Components.classes["@mozilla.org/supports-string;1"]
				.createInstance(ss);
			str.data = pVal;
			this.prefBr.setComplexValue(pName, ss, str);
		}
		return this;
	},
	resetPref: function(pName) {
		if(this.prefBr.prefHasUserValue(pName))
			this.prefBr.clearUserPref(pName);
		return this;
	},
	savePrefFile: function() {
		this.prefSvc.savePrefFile(null);
	}
};
handyClicksPrefUtils.init();
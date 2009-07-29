var handyClicksPrefUtils = {
	__proto__: handyClicksObservers, // Add observers interface
	observers: [],

	cs: handyClicksCleanupSvc,

	// Preferences:
	nPrefix: "extensions.handyclicks.",

	get prefBr() {
		delete this.prefBr;
		return this.prefBr = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefBranch2);
	},
	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
	},
	get ss() { return Components.interfaces.nsISupportsString; },

	// Initialization:
	init: function() {
		this.prefBr.addObserver(this.nPrefix, this, false);
		this.nLength = this.nPrefix.length;
		this.cs.registerCleanup(this.destroy, this);
	},
	destroy: function() {
		this.prefBr.removeObserver(this.nPrefix, this);
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
	_prefs: { __proto__: null }, // Prefs cache
	pref: function(pName, pVal) {
		if(pVal !== undefined)
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
		var isNew = pType == pbr.PREF_INVALID;
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
	existPref: function(pName) {
		return this.prefBr.getPrefType(pName) != Components.interfaces.nsIPrefBranch.PREF_INVALID;
	},
	savePrefFile: function() {
		this.prefSvc.savePrefFile(null);
	}
};
handyClicksPrefUtils.init();
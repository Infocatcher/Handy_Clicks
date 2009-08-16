var handyClicksPrefUtils = {
	oSvc: new HandyClicksObservers(),

	// Preferences:
	nPrefix: "extensions.handyclicks.",

	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.QueryInterface(Components.interfaces.nsIPrefBranch2);
	},
	pBr: Components.interfaces.nsIPrefBranch,
	ss: Components.interfaces.nsISupportsString,

	// Initialization:
	init: function() {
		this.prefSvc.addObserver(this.nPrefix, this, false);
		this.nLength = this.nPrefix.length;
	},
	destroy: function() {
		this.prefSvc.removeObserver(this.nPrefix, this);
	},

	// Preferences observer:
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		pName = pName.substring(this.nLength);
		this.readPref(pName);
		this.oSvc.notifyObservers(pName);
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
	getPref: function(pName, defaultVal) {
		var pbr = this.pBr;
		switch(this.prefSvc.getPrefType(pName)) {
			case pbr.PREF_STRING: return this.prefSvc.getComplexValue(pName, this.ss).data;
			case pbr.PREF_INT:    return this.prefSvc.getIntPref(pName);
			case pbr.PREF_BOOL:   return this.prefSvc.getBoolPref(pName);
			default:              return defaultVal;
		}
	},
	setPref: function(pName, pVal) {
		var pbr = this.pBr;
		var pType = this.prefSvc.getPrefType(pName);
		var isNew = pType == pbr.PREF_INVALID;
		var vType = typeof pVal;
		if(pType == pbr.PREF_BOOL || (isNew && vType == "boolean"))
			this.prefSvc.setBoolPref(pName, pVal);
		else if(pType == pbr.PREF_INT || (isNew && vType == "number"))
			this.prefSvc.setIntPref(pName, pVal);
		else if(pType == pbr.PREF_STRING || isNew) {
			var ss = this.ss;
			var str = Components.classes["@mozilla.org/supports-string;1"]
				.createInstance(ss);
			str.data = pVal;
			this.prefSvc.setComplexValue(pName, ss, str);
		}
		return this;
	},
	resetPref: function(pName) {
		if(this.prefSvc.prefHasUserValue(pName))
			this.prefSvc.clearUserPref(pName);
		return this;
	},
	existPref: function(pName) {
		return this.prefSvc.getPrefType(pName) != this.pBr.PREF_INVALID;
	},
	savePrefFile: function() {
		this.prefSvc.savePrefFile(null);
	}
};
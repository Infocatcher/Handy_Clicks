var handyClicksObservers = {
	observers: [],
	notifyObservers: function() {
		var obs = this.observers;
		for(var i = 0, len = obs.length; i < len; i++)
			if(i in obs)
				obs[i][0].apply(obs[i][1] || this, arguments);
	},
	addPrefsObserver: function(fnc, context) {
		this.observers.push([fnc, context]);
		return this.observers.length - 1;
	},
	removePrefsObserver: function(oId) {
		delete(this.observers[oId]);
	}
};
var handyClicksUtils = {
	__proto__: handyClicksObservers,
	consoleSvc: Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService),
	_log: function(msg) {
		this.consoleSvc.logStringMessage("[Handy Clicks]: " + msg + "\n");
	},
	_err: Components.utils.reportError,

	notify: function(nTitle, msg, fnc, extEnabled, inWindowCorner) {
		var dur = this.pref("notifyOpenTime");
		if(dur <= 0)
			 return;
		extEnabled = typeof extEnabled == "boolean" ? extEnabled : true;
		inWindowCorner = typeof inWindowCorner == "boolean"
			? inWindowCorner
			: this.pref("notifyInWindowCorner");
		window.openDialog(
			 "chrome://handyclicks/content/notify.xul",
			 "",
			 "chrome,dialog=1,nTitlebar=0,popup=1",
			 {
			 	dur: dur,
			 	nTitle: nTitle || "", msg: msg || "",
			 	fnc: fnc, extEnabled: extEnabled, inWindowCorner: inWindowCorner,
			 	__proto__: null
			 }
		);
	},
	get promptsSvc() {
		if(!this._promptsSvc)
			this._promptsSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
		return this._promptsSvc;
	},
	alertEx: function(ttl, txt) {
		this.promptsSvc.alert(window, ttl, txt);
	},
	promptEx: function(ttl, txt, defVal) {
		var ret = { value: defVal };
		var res = this.promptsSvc.prompt(window, ttl, txt, ret, null, {});
		return res ? ret.value : null;
	},

	// Preferences:
	nPrefix: "extensions.handyclicks.",

	// Initialization:
	get nsIPref() {
		return Components.classes["@mozilla.org/preferences;1"]
			.createInstance(Components.interfaces.nsIPref);
	},
	init: function() {
		window.addEventListener("unload", this, false); // destroy
		this.nsIPref.addObserver(this.nPrefix, this, false);
		this.nLength = this.nPrefix.length;
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);
		this.nsIPref.removeObserver(this.nPrefix, this);
	},
	handleEvent: function(e) {
		this.destroy();
	},

	// Preferences observer:
	observe: function(subject, topic, pName) { // prefs observer
		if(topic != "nsPref:changed")
			return;
		pName = pName.substring(this.nLength);
		this.readPref(pName);
		this.notifyObservers(pName);
	},

	// API functions:
	get prefSvc() {
		if(!this._prefSvc)
			this._prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefBranch);
		return this._prefSvc;
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
		switch(this.prefSvc.getPrefType(pName)) {
			case pbr.PREF_STRING: return this.prefSvc.getComplexValue(pName, this.ss).data;
			case pbr.PREF_INT:    return this.prefSvc.getIntPref(pName);
			case pbr.PREF_BOOL:   return this.prefSvc.getBoolPref(pName);
			default:              return null;
		}
	},
	setPref: function(pName, pVal) {
		var pbr = Components.interfaces.nsIPrefBranch;
		var pType = this.prefSvc.getPrefType(pName);
		var isNew = pType == 0;
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
	},

	// Localised strings:
	_strings: { __proto__: null }, // cache of strings from stringbundle
	getLocaleStr: function(name) {
		if(!("_localeBundle" in this))
			this._localeBundle = document.getElementById("handyClicks-strings");
		try { name = this._localeBundle.getString(name); }
		catch(e) { name = "[" + name + "]"; }
		return name;
	},
	getLocalised: function(name) {
		if(name in this._strings == false)
			this._strings[name] = this.getLocaleStr(name);
		return this._strings[name];
	},

	isNoChromeDoc: function(doc) { // Except items in chrome window
		doc = doc || handyClicks.item.ownerDocument;
		return doc.defaultView.toString().indexOf("[object Window]") > -1; // [object XPCNativeWrapper [object Window]]
	}
};
handyClicksUtils.init();
var handyClicksPrefUtils = {
	oSvc: new HandyClicksObservers(),

	// Preferences:
	prefNS: "extensions.handyclicks.",
	prefVer: 4,

	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.QueryInterface(Components.interfaces.nsIPrefBranch2);
	},
	pBr: Components.interfaces.nsIPrefBranch,
	ss: Components.interfaces.nsISupportsString,

	// Initialization:
	instantInit: function(reloadFlag) {
		this.prefsMigration();
		const pns = this.prefNS;
		this.prefSvc.addObserver(pns, this, false);
		this.prefNSL = pns.length;
	},
	prefsMigration: function(dontSave) {
		const v = this.pref("prefsVersion") || 0;
		if(v >= this.prefVer)
			return false;

		const pns = this.prefNS;
		if(v < 1) { // Added 2009-09-24
			// Move prefs to "extensions.handyclicks.funcs." branch:
			[
				"loadJavaScriptLinks", "notifyJavaScriptLinks",
				"loadVoidLinksWithHandlers", "notifyVoidLinksWithHandlers",
				"filesLinksPolicy", "filesLinksMask",
				"decodeURIs",
				"convertURIs", "convertURIsCharset"
			].forEach(
				function(pId) {
					const fullId = pns + pId;
					if(this.existPref(fullId))
						this.pref("funcs." + pId, this.getPref(fullId))
							.prefSvc.deleteBranch(fullId);
				},
				this
			);
		}
		if(v < 2) // Added 2009-11-13
			this.pu.prefSvc.deleteBranch(pns + "forceStopMousedownEvent");
		if(v < 3) { // Added 2010-02-04
			var dm = this.pref("sets.treeDrawMode") || 0;
			if(dm >= 2)
				this.pref("sets.treeDrawMode", dm + 1);
		}
		if(v < 4) { // Added 2010-03-31
			var pn = "sets.backupDepth";
			if(this.prefSvc.prefHasUserValue(this.prefNS + pn))
				this.pref(pn, (this.pref(pn) || 0) + 1);
		}
		this.pref("prefsVersion", this.prefVer);
		!dontSave && this.savePrefFile();
		this.ut._log("Format of about:config prefs updated: " + v + " => " + this.prefVer);
		return true;
	},
	destroy: function(reloadFlag) {
		this.prefSvc.removeObserver(this.prefNS, this);
	},

	// Preferences observer:
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		pName = pName.substr(this.prefNSL);
		this.oSvc.notifyObservers(pName, this.readPref(pName));
	},

	// API functions:
	_prefs: { __proto__: null }, // Prefs cache
	pref: function(pName, pVal) {
		if(arguments.length == 2)
			return this.setPref(this.prefNS + pName, pVal);
		if(pName in this._prefs)
			return this._prefs[pName];
		return this.readPref(pName);
	},
	readPref: function(pName) {
		return this._prefs[pName] = this.getPref(this.prefNS + pName);
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
	},

	openAboutConfig: function(filter) {
		var brWin = this.wu.wm.getMostRecentWindow("navigator:browser");
		if(brWin) {
			this.openAboutConfigFilter(brWin, filter);
			return;
		}
		brWin = window.openDialog(
			this.pu.getPref("browser.chromeURL") || "chrome://browser/content/",
			"_blank", "chrome,all,dialog=no",
			"about:blank",
			null, null, null, false
		);
		var _this = this;
		brWin.addEventListener(
			"load",
			function f(e) {
				brWin.removeEventListener("load", f, true);
				_this.openAboutConfigFilter(brWin, filter);
			},
			true
		);
	},
	openAboutConfigFilter: function(brWin, filter) {
		brWin.focus();
		var br = brWin.gBrowser || brWin.getBrowser();
		if(br.currentURI.spec == "about:blank" && !br.webProgress.isLoadingDocument) {
			var tab = br.selectedTab;
			br.loadURI("about:config");
		}
		else
			var tab = br.selectedTab = br.addTab("about:config");
		var win = tab.linkedBrowser;
		filter = filter || this.prefNS;
		var oldFx = this.ut.fxVersion <= 3.0;
		var _this = this;
		win.addEventListener(
			"load",
			function _l(e) {
				win.removeEventListener("load", _l, true);
				var cWin = win.contentWindow;
				(function setFilter() {
					var tb = cWin.document.getElementById("textbox");
					if(!tb) {
						setTimeout(setFilter, 5);
						return;
					}
					tb.setAttribute("value", filter);
					if(oldFx) try {
						cWin.wrappedJSObject.FilterPrefs();
						tb.focus();
					}
					catch(e) {
						_this.ut._err(new Error("FilterPrefs() failed"));
						_this.ut._err(e);
						setTimeout(setFilter, 5);
					}
				})();
			},
			true
		);
	}
};
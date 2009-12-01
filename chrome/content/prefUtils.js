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
	instantInit: function(reloadFlag) {
		var np = this.nPrefix;

		var v = this.pref("prefsVersion") || 0;
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
					var fullId = np + pId;
					if(!this.existPref(fullId))
						return;
					this.pref("funcs." + pId, this.getPref(fullId));
					this.prefSvc.deleteBranch(fullId);
				},
				this
			);
			this.pref("prefsVersion", 1);
			this.savePrefFile();
		}

		this.prefSvc.addObserver(np, this, false);
		this.nLength = np.length;
	},
	destroy: function(reloadFlag) {
		this.prefSvc.removeObserver(this.nPrefix, this);
	},

	// Preferences observer:
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		pName = pName.substring(this.nLength);
		this.oSvc.notifyObservers(pName, this.readPref(pName));
	},

	// API functions:
	_prefs: { __proto__: null }, // Prefs cache
	pref: function(pName, pVal) {
		if(arguments.length == 2)
			return this.setPref(this.nPrefix + pName, pVal);
		if(pName in this._prefs)
			return this._prefs[pName];
		return this.readPref(pName);
	},
	readPref: function(pName) {
		return this._prefs[pName] = this.getPref(this.nPrefix + pName);
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
			"chrome://browser/content/", "_blank", "chrome,all,dialog=no",
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
		var br = brWin.gBrowser;
		if(br.currentURI.spec == "about:blank" && !br.webProgress.isLoadingDocument) {
			var tab = br.mCurrentTab;
			br.loadURI("about:config");
		}
		else
			var tab = br.selectedTab = br.addTab("about:config");
		var win = tab.linkedBrowser;
		filter = filter || this.pu.nPrefix;
		var oldFx = this.ut.fxVersion <= 3.0;
		win.addEventListener(
			"load",
			function f(e) {
				win.removeEventListener("load", f, true);
				var cWin = win.contentWindow;
				var tb = cWin.document.getElementById("textbox");
				tb && tb.setAttribute("value", filter);
				oldFx && setTimeout(function() {
					cWin.wrappedJSObject.FilterPrefs();
				}, 0);
			},
			true
		);
	}
};
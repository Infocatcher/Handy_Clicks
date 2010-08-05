var handyClicksPrefUtils = {
	oSvc: new HandyClicksObservers(),

	// Preferences:
	prefNS: "extensions.handyclicks.",
	prefsVersion: 5,

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
		var vers = this.pref("prefsVersion") || 0;
		if(vers < this.prefsVersion)
			this.prefsMigration(true, vers);
		const pns = this.prefNS;
		this.prefSvc.addObserver(pns, this, false);
		this.prefNSL = pns.length;
	},
	get prefsMigration() { // function(allowSave, vers)
		var temp = {};
		this.rs.loadSubScript("chrome://handyclicks/content/convPrefs.js", temp);
		return temp.prefsMigration;
	},
	destroy: function(reloadFlag) {
		this.prefSvc.removeObserver(this.prefNS, this);
		this.oSvc.destroy();
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
		filter = filter || this.prefNS;
		const wm = this.wu.wm;

		// Search already opened tab:
		var ws = wm.getEnumerator("navigator:browser");
		var brWin, tbr;
		while(ws.hasMoreElements()) {
			brWin = ws.getNext();
			tbr = brWin.gBrowser || brWin.getBrowser();
			if(
				Array.some(
					tbr.tabContainer.childNodes,
					function(tab) {
						var br = tab.linkedBrowser;
						if(br.currentURI.spec != "about:config")
							return false;
						var tb = br.contentDocument.getElementById("textbox");
						if(tb && tb.wrappedJSObject.value == filter) {
							//brWin.focus();
							tbr.selectedTab = tab;
							br.contentWindow.focus();
							return true;
						}
						return false;
					}
				)
			)
				return;
		}

		// Search already opened browser window:
		var brWin = wm.getMostRecentWindow("navigator:browser");
		if(brWin) {
			this.openAboutConfigFilter(brWin, filter);
			return;
		}

		// Open new browser window:
		brWin = window.openDialog(
			this.pu.getPref("browser.chromeURL") || "chrome://browser/content/",
			"_blank", "chrome,all,dialog=no",
			"about:blank",
			null, null, null, false
		);
		var _this = this;
		brWin.addEventListener(
			"load",
			function _l(e) {
				brWin.removeEventListener("load", _l, true);
				_this.openAboutConfigFilter(brWin, filter);
			},
			true
		);
	},
	openAboutConfigFilter: function(brWin, filter) {
		brWin.focus();
		var tbr = brWin.gBrowser || brWin.getBrowser();
		if(tbr.currentURI.spec == "about:blank" && !tbr.webProgress.isLoadingDocument) {
			var tab = tbr.selectedTab;
			tbr.loadURI("about:config");
		}
		else
			var tab = tbr.selectedTab = tbr.addTab("about:config");
		var br = tab.linkedBrowser;
		var oldFx = this.ut.fxVersion <= 3.0;
		var _this = this;
		br.addEventListener(
			"load",
			function _l(e) {
				br.removeEventListener("load", _l, true);
				var cWin = br.contentWindow;
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
						_this.ut._warn("openAboutConfigFilter: FilterPrefs() failed");
						_this.ut._err(e);
						setTimeout(setFilter, 5);
					}
				})();
			},
			true
		);
	}
};
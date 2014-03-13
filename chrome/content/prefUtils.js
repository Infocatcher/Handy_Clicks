var handyClicksPrefUtils = {
	__proto__: handyClicksGlobals,

	oSvc: new HandyClicksObservers(),

	// Preferences:
	prefNS: "extensions.handyclicks.",
	prefsVersion: 9,

	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.QueryInterface(Components.interfaces.nsIPrefBranch2 || Components.interfaces.nsIPrefBranch);
	},

	// Initialization:
	instantInit: function(reloadFlag) {
		var vers = this.pref("prefsVersion") || 0;
		if(vers < this.prefsVersion)
			this.prefsMigration(true, vers);
		this.prefSvc.addObserver(this.prefNS, this, false);
	},
	get prefsMigration() { // function(allowSave, vers)
		var temp = {};
		this.jsLoader.loadSubScript("chrome://handyclicks/content/convPrefs.js", temp);
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
		pName = pName.substr(this.prefNS.length);
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
	getPref: function(pName, defaultVal, prefBranch) {
		var ps = prefBranch || this.prefSvc;
		switch(ps.getPrefType(pName)) {
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
		}
		return defaultVal;
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || this.prefSvc;
		var pType = ps.getPrefType(pName);
		if(pType == ps.PREF_INVALID)
			pType = this.getValueType(val);
		switch(pType) {
			case ps.PREF_BOOL:   ps.setBoolPref(pName, val); break;
			case ps.PREF_INT:    ps.setIntPref(pName, val);  break;
			case ps.PREF_STRING:
				var ss = Components.interfaces.nsISupportsString;
				var str = Components.classes["@mozilla.org/supports-string;1"]
					.createInstance(ss);
				str.data = val;
				ps.setComplexValue(pName, ss, str);
		}
		return this;
	},
	getValueType: function(val) {
		switch(typeof val) {
			case "boolean": return this.prefSvc.PREF_BOOL;
			case "number":  return this.prefSvc.PREF_INT;
		}
		return this.prefSvc.PREF_STRING;
	},
	prefChanged: function(pName) {
		return this.prefSvc.prefHasUserValue(this.prefNS + pName);
	},
	resetPref: function(pName) {
		if(this.prefChanged(pName))
			this.prefSvc.clearUserPref(this.prefNS + pName);
	},

	existPref: function(pName) {
		return this.prefSvc.getPrefType(pName) != this.prefSvc.PREF_INVALID;
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
					tbr.tabs || tbr.tabContainer.childNodes,
					function(tab) {
						// For Firefox 4 see "visibleTabs" property in chrome://browser/content/tabbrowser.xml
						if("_removingTabs" in tbr && tbr._removingTabs.indexOf(tab) != -1)
							return false;
						//~ todo: add pref?
						//if(tab.hidden)
						//	return;
						var br = tab.linkedBrowser;
						if(!/^about:config\??/.test(br.currentURI.spec))
							return false;
						var tb = br.contentDocument.getElementById("textbox");
						if(!tb || (tb.wrappedJSObject || tb).value != filter)
							return false;
						//brWin.focus();
						tbr.selectedTab = tab;
						br.contentWindow.focus();
						return true;
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
			"_blank", "chrome,all,dialog=0",
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

		var configURI = "about:config";
		var builtInFilter = this.ut.fxVersion >= 8;
		if(builtInFilter)
			configURI += "?filter=" + encodeURIComponent(filter);

		var tbr = brWin.gBrowser || brWin.getBrowser();
		if(this.ut.isBlankPageURL(tbr.currentURI.spec) && !tbr.webProgress.isLoadingDocument) {
			var tab = tbr.selectedTab;
			tbr.loadURI(configURI);
		}
		else
			var tab = tbr.selectedTab = tbr.addTab(configURI);
		if(builtInFilter)
			return;

		var br = tab.linkedBrowser;
		var oldFx = this.ut.fxVersion <= 3.0;
		var _this = this;
		br.addEventListener("load", function _l(e) {
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
		}, true);
	}
};
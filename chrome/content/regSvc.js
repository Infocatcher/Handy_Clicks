var handyClicksRegSvc = {
	instantInit: function(reloadFlag) {
		window.addEventListener("load", this, false);
		Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader)
			.loadSubScript("chrome://handyclicks/content/_reloader.js");
		this.registerShortcuts(true);
		this.callMethods("instantInit", reloadFlag);
	},
	init: function(reloadFlag) { // window "load"
		window.removeEventListener("load", this, false);
		window.addEventListener("unload", this, false);
		this.callMethods("init", reloadFlag);
		window._handyClicksInitialized = true;
	},
	destroy: function(reloadFlag) { // window "unlod"
		window.removeEventListener("unload", this, false);
		this.callMethods("destroy", reloadFlag);
		this.registerShortcuts(false);
		delete window._handyClicksInitialized;
	},
	globals: {
		_elts: { __proto__: null },
		$: function(id) {
			return this._elts[id] || (this._elts[id] = document.getElementById(id));
		},
		e: function(id) {
			return document.getElementById(id);
		},
		get _devMode() {
			return this.pu.pref("devMode");
		}
	},
	get s() {
		var _s = {
			cn: "handyClicksConsole",
			cs: "handyClicksCleanupSvc",
			ed: "handyClicksEditor",
			eh: "handyClicksExtensionsHelper",
			fn: "handyClicksFuncs",
			hc: "handyClicks",
			ps: "handyClicksPrefSvc",
			pu: "handyClicksPrefUtils",
			rs: "handyClicksRegSvc",
			rl: "handyClicksReloader",
			st: "handyClicksSets",
			su: "handyClicksSetsUtils",
			ut: "handyClicksUtils",
			wu: "handyClicksWinUtils",
			__proto__: null
		};
		var s = {
			__proto__: this.globals
		};
		var oName;
		for(var p in _s) {
			oName = _s[p];
			if(oName in window)
				s[p] = window[oName];
		}
		delete this.s;
		return this.s = s;
	},
	registerShortcuts: function(regFlag) {
		if(regFlag) {
			var s = this.s;
			for(var p in s) if(s.hasOwnProperty(p))
				s[p].__proto__ = s;
			return;
		}
		this.s = null;
	},
	callMethods: function(methName, reloadFlag) {
		var s = this.s, o;
		for(var p in s) if(s.hasOwnProperty(p)) {
			o = s[p];
			if(o !== this && methName in o)
				o[methName](reloadFlag);
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
	}
};
handyClicksRegSvc.instantInit();
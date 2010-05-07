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
		delete this.s;
		delete window._handyClicksInitialized;
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
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
			rl: "handyClicksReloader",
			rs: "handyClicksRegSvc",
			st: "handyClicksSets",
			su: "handyClicksSetsUtils",
			ui: "handyClicksUI",
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
		var s = this.s;
		var proto = regFlag ? s : ({}).__proto__;
		for(var p in s) if(s.hasOwnProperty(p))
			s[p].__proto__ = s;
	},
	callMethods: function(methName, reloadFlag) {
		var s = this.s, o;
		for(var p in s) if(s.hasOwnProperty(p)) {
			o = s[p];
			if(o !== this && o.hasOwnProperty(methName))
				o[methName](reloadFlag);
		}
	}
};
handyClicksRegSvc.instantInit();
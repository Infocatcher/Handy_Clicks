var handyClicksRegSvc = {
	init: function(reloadFlag) { // window "load"
		window.removeEventListener("load", this, false);
		this.registerServices(true, reloadFlag);
		window.addEventListener("unload", this, false);
		window._handyClicksInitialized = true;
		if(!("handyClicksReloadScripts" in window))
			Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Components.interfaces.mozIJSSubScriptLoader)
				.loadSubScript("chrome://handyclicks/content/_devMode.js");
	},
	destroy: function(reloadFlag) { // window "unlod"
		window.removeEventListener("unload", this, false);
		this.registerServices(false, reloadFlag);
		delete window._handyClicksInitialized;
	},
	get s() {
		var s = {
			cn: "handyClicksConsole",
			cs: "handyClicksCleanupSvc",
			ed: "handyClicksEditor",
			fn: "handyClicksFuncs",
			hc: "handyClicks",
			ps: "handyClicksPrefSvc",
			pu: "handyClicksPrefUtils",
			rs: "handyClicksRegSvc",
			st: "handyClicksSets",
			ut: "handyClicksUtils",
			wu: "handyClicksWinUtils",
			__proto__: null
		};
		var _s = {}, oName;
		for(p in s) {
			oName = s[p];
			if(oName in window)
				_s[p] = window[oName];
		}
		return _s;
	},
	registerServices: function(regFlag, reloadFlag) {
		var s = this.s;
		if(regFlag) {
			this.registerShortcuts(s, true);
			this.callMethods(s, "init", reloadFlag);
		}
		else {
			this.callMethods(s, "destroy", reloadFlag);
			this.registerShortcuts(s, false);
		}
	},
	registerShortcuts: function(s, regFlag) {
		var proto = regFlag ? s : Object.prototype;
		for(var p in s) if(s.hasOwnProperty(p))
			s[p].__proto__ = proto;
	},
	callMethods: function(s, meth, reloadFlag) {
		var o;
		for(var p in s) if(s.hasOwnProperty(p)) {
			o = s[p];
			if(o !== this && meth in o)
				o[meth](reloadFlag);
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
	}
};
window.addEventListener("load", handyClicksRegSvc, false);
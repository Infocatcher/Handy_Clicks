var handyClicksRegSvc = {
	instantInit: function(reloadFlag) {
		window.addEventListener("load", this, false);
		this.loadSubScript("chrome://handyclicks/content/consts.js");
		this.loadSubScript("chrome://handyclicks/content/_reloader.js");
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
		this.s = this.globals._elts = null; // We can't undo this!
		delete window._handyClicksInitialized;
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
	},
	get jsLoader() {
		delete this.jsLoader;
		return this.jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
	},
	loadSubScript: function(/*path, obj*/) {
		var jsl = this.jsLoader;
		return jsl.loadSubScript.apply(jsl, arguments);
	},
	globals: {
		_elts: { __proto__: null },
		$: function(id) {
			return this._elts[id] || (this._elts[id] = document.getElementById(id));
		},
		e: function(id) {
			return document.getElementById(id);
		},
		get fn() {
			return this.rs.lazyLoad("fn", "handyClicksFuncs", "funcs.js");
		},
		get wu() {
			return this.rs.lazyLoad("wu", "handyClicksWinUtils", "winUtils.js");
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
			hc: "handyClicks",
			ps: "handyClicksPrefSvc",
			pu: "handyClicksPrefUtils",
			rl: "handyClicksReloader",
			rs: "handyClicksRegSvc",
			st: "handyClicksSets",
			su: "handyClicksSetsUtils",
			ui: "handyClicksUI",
			ut: "handyClicksUtils",
			ct: "handyClicksConst",
			__proto__: null
		};
		var s = {
			__proto__: this.globals
		};
		for(var p in _s) {
			var oName = _s[p];
			if(oName in window)
				s[p] = window[oName];
		}
		delete this.s;
		return this.s = s;
	},
	lazyLoad: function(shortcut, objName, file) {
		if(!(objName in window)) {
			// Note: we don't load utils.js from console.xul overlay
			this.ut && this.ut._log("Load " + file + " into " + document.documentURI + "\n" + new Error().stack);
			this.loadSubScript("chrome://handyclicks/content/" + file);
		}
		var o = window[objName];
		o.__proto__ = this.s;
		delete this.globals[shortcut];
		return this.globals[shortcut] = o;
	},
	lazyUnload: function(shortcut, objName) {
		if(objName in window)
			this.globals[shortcut].__proto__ = Object.prototype;
	},
	registerShortcuts: function(regFlag) {
		if(!regFlag) {
			this.lazyUnload("fn", "handyClicksFuncs");
			this.lazyUnload("wu", "handyClicksWinUtils");
		}
		var s = this.s;
		var proto = regFlag
			? s
			: Object.prototype; // ({}).__proto__
		for(var p in s) if(s.hasOwnProperty(p))
			s[p].__proto__ = proto;
	},
	callMethods: function(methName, reloadFlag) {
		var s = this.s;
		for(var p in s) if(s.hasOwnProperty(p)) {
			var o = s[p];
			if(o !== this && o.hasOwnProperty(methName))
				o[methName](reloadFlag);
		}
	}
};
handyClicksRegSvc.instantInit();
(function(window) {

var inWindow = "document" in window;
var document = inWindow ? window.document : {
	documentURI: new Error().fileName
};
var g = window.handyClicksGlobals = {
	errPrefix: "[Handy Clicks] ",

	now: now,
	_startTime: now(),
	path: /[^\\\/]+$/.test(document.documentURI) && RegExp.lastMatch,

	get appInfo() {
		delete g.appInfo;
		return g.appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo)
			.QueryInterface(Components.interfaces.nsIXULRuntime);
	},
	get appVersion() {
		delete g.appVersion;
		return g.appVersion = parseFloat(g.appInfo.version);
	},
	get appName() {
		delete g.appName;
		return g.appName = g.appInfo.name;
	},
	get fxVersion() {
		var ver = g.appVersion;
		if(g.isPaleMoon || g.isBasilisk)
			ver = parseFloat(g.appInfo.platformVersion) >= 4.1 ? 56 : 28;
		// https://developer.mozilla.org/en-US/docs/Mozilla/Gecko/Versions
		else if(g.isSeaMonkey) switch(ver) {
			case 2:   ver = 3.5; break;
			case 2.1: ver = 4;   break;
			default:  ver = parseFloat(g.appInfo.platformVersion);
		}
		delete g.fxVersion;
		return g.fxVersion = ver;
	},
	get osVersion() {
		delete g.osVersion; // String like "Windows NT 6.1"
		return g.osVersion = /\S\s+(\d.*)/.test(navigator.oscpu) ? parseFloat(RegExp.$1) : 0;
	},

	_elts: { __proto__: null },
	$: function(id) {
		return g._elts[id] || (g._elts[id] = document.getElementById(id));
	},
	e: function(id) {
		return document.getElementById(id);
	},
	attribute: function(node, attr, val, allowEmpty) {
		if(val || allowEmpty && val === "")
			node.setAttribute(attr, val);
		else
			node.removeAttribute(attr);
	},
	hasModifier: function(e) {
		return e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
	},
	get storage() {
		delete g.storage;
		return g.storage = initStorage();
	},

	get jsLoader() {
		delete g.jsLoader;
		return g.jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
	},
	timeout: function(func, context, args, delay) { //= Added: 2015-12-17
		g.ut._deprecated("handyClicksGlobals.timeout() is deprecated. Use handyClicksGlobals.delay() instead.");
		return setTimeout(function() {
			func.apply(context, args);
		}, delay || 0);
	},
	delay: function(func, context, delay, args) {
		return setTimeout(function() {
			func.apply(context, args);
		}, delay || 0);
	},

	_strings: { __proto__: null },
	_bundles: { __proto__: null },
	get sbs() {
		delete g.sbs;
		return g.sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService);
	},
	getStr: function(src, sName, defaultStr, _callerLevel) {
		try {
			var sb = g._bundles[src] || (g._bundles[src] = g.sbs.createBundle(src));
			return sb.GetStringFromName(sName);
		}
		catch(e) {
			if(_callerLevel == -1)
				return defaultStr || "";
			for(var c = Components.stack.caller; c && _callerLevel--; c = c.caller);
			g.ut._warn('Can\'t get localized string "' + sName + '" from "' + src + '"', c.filename, c.lineNumber);
		}
		return defaultStr || "";
	},
	getLocalized: function(sName) {
		return g._strings[sName] || (
			g._strings[sName] = g.getStr("chrome://handyclicks/locale/hcs.properties", sName, "", 1)
				|| g.getStr("chrome://handyclicks-locale/content/hcs.properties", sName, "", 1)
				|| g.ut.makeBuggyStr(sName)
		);
	},

	get _debug() {
		if(!g.pu || !inWindow) try {
			return Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefBranch)
				.getBoolPref("extensions.handyclicks.debug");
		}
		catch(e) {
			return false;
		}
		g.pu.oSvc.addObserver(function(pName, pVal) {
			if(pName == "debug")
				g._debug = pVal;
		});
		delete g._debug;
		return g._debug = g.pu.get("debug");
	},
	get consoleSvc() {
		delete g.consoleSvc;
		return g.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	ts: function() {
		var d = new Date();
		var ms = d.getMilliseconds();
		return d.toTimeString().replace(/^.*\d+:(\d+:\d+).*$/, "$1") + ":" + "000".substr(("" + ms).length) + ms + " ";
	},
	_info: function(s) {
		g.consoleSvc.logStringMessage(g.errPrefix + g.ts() + g.safeToString(s));
	},
	_log: function(s) {
		g._debug && g._info(s);
	},
	safeToString: function(o) { // var o = { __proto__: null }; => o.valueOf() and o.toString() is missing
		try { return "" + o; }
		catch(e) { return "" + e; }
	},
	_timers: { __proto__: null },
	timer: function(key, div) {
		var ts = this._timers;
		if(!(key in ts))
			return ts[key] = now();
		var dt = this.now() - ts[key];
		if(div)
			dt /= div;
		this._log("[timer] " + key + ": " + (Math.floor(dt) == dt ? dt : dt.toFixed(2)) + " ms");
		delete ts[key];
		return dt;
	},

	get cn() { return lazy("cn", "handyClicksConsole");    },
	get ed() { return lazy("ed", "handyClicksEditor");     },
	get pu() { return lazy("pu", "handyClicksPrefUtils");  },
	get rs() { return lazy("rs", "handyClicksRegSvc");     },
	get st() { return lazy("st", "handyClicksSets");       },
	get su() { return lazy("su", "handyClicksSetsUtils");  },
	get ui() { return lazy("ui", "handyClicksUI");         },

	get ct() { return lazy("ct", "handyClicksConst",      "consts.js");      },
	get dt() { return lazy("dt", "handyClicksData",       "data.js");        },
	get fn() { return lazy("fn", "handyClicksFuncs",      "funcs.js");       },
	get hc() { return lazy("hc", "handyClicks",           "handyclicks.js"); },
	get io() { return lazy("io", "handyClicksIO",         "io.js");          },
	get ju() { return lazy("ju", "handyClicksJsUtils",    "jsUtils.js");     },
	get pe() { return lazy("pe", "handyClicksPrefSvcExt", "prefSvcExt.js");  },
	get ps() { return lazy("ps", "handyClicksPrefSvc",    "prefSvc.js");     },
	get ut() { return lazy("ut", "handyClicksUtils",      "utils.js");       },
	get wu() { return lazy("wu", "handyClicksWinUtils",   "winUtils.js");    },

	objects: {
		handyClicks:           "hc",
		handyClicksConsole:    "cn",
		handyClicksConst:      "ct",
		handyClicksData:       "dt",
		handyClicksEditor:     "ed",
		handyClicksFuncs:      "fn",
		handyClicksJsUtils:    "ju",
		handyClicksPrefSvc:    "ps",
		handyClicksPrefSvcExt: "pe",
		handyClicksPrefUtils:  "pu",
		handyClicksRegSvc:     "rs",
		handyClicksSets:       "st",
		handyClicksSetsUtils:  "su",
		handyClicksUI:         "ui",
		handyClicksUtils:      "ut",
		handyClicksWinUtils:   "wu",
		__proto__: null
	},
	get callable() {
		var callable = [];
		var objects = g.objects;
		for(var p in objects)
			if(p in window && !window.__lookupGetter__(p))
				callable.push(window[p]);
		return callable;
	},
	shutdown: function() {
		// Remove all cycle references to simplify garbage collection
		// Be careful, we can't undo this!
		var objects = g.objects;
		for(var p in objects)
			delete g[objects[p]];
		delete g.g;
		g._elts = null;
	}
};
g.g = g;

var apps = {
	isSeaMonkey: "SeaMonkey",
	isFirefox:   "Firefox",
	isPaleMoon:  "Pale Moon",
	isBasilisk:  "Basilisk",
	__proto__: null
};
for(var p in apps) (function(p, n) {
	g.__defineGetter__(p, function() {
		delete g[p];
		return g[p] = g.appName == n;
	});
})(p, apps[p]);
apps = null;

function lazy(s, p, file) {
	var has = p in window && !window.__lookupGetter__(p);
	if(!has && file) {
		var t = now();
		delete window[p];
		g.jsLoader.loadSubScript("chrome://handyclicks/content/" + file, window, "UTF-8");
		g._log(
			"Load " + file + " into " + g.path
			+ ": " + (now() - t).toFixed(2) + " ms"
			+ (s == "ut" || s == "io" ? "\n" + new Error().stack : "")
		);
		has = p in window;
	}
	if(!has)
		return null;
	delete g[s];
	return g[s] = window[p];
}
function now() {
	now = "performance" in window && "now" in performance
		? function() { return performance.now(); }
		: function() { return Date.now(); };
	return now();
}
function initStorage() {
	var out = function(key, val) {
		g.ut._deprecated( //= Added: 2019-01-21
			"handyClicksUtils.storage(key, val) is deprecated. "
			+ "Use handyClicksGlobals.storage.get(key)/set(key, val) instead."
		);
		if(arguments.length == 1)
			return g.storage.get(key);
		return g.storage.set(key, val);
	};
	out._storage = getStorage();
	out.get = function(key) {
		return key in this._storage ? this._storage[key] : undefined;
	};
	out.set = function(key, val) {
		if(val === undefined)
			delete this._storage[key];
		else
			this._storage[key] = val;
	};
	initStorage = getStorage = null;
	return out;
}
function getStorage() {
	const ns = "_handyClicksStorage";
	if("create" in Object) { // Firefox 4+
		// Ensure, that we have global object (because window.Services may be overwritten)
		var g = Components.utils.getGlobalForObject( // For Firefox 57+
			Components.utils["import"]("resource://gre/modules/Services.jsm", {})
		);
		return g[ns] || (g[ns] = g.Object.create(null));
	}
	var hw = Components.classes["@mozilla.org/appshell/appShellService;1"]
		.getService(Components.interfaces.nsIAppShellService)
		.hiddenDOMWindow;
	if(ns in hw)
		return hw[ns];
	var st = hw[ns] = new hw.Function("return { __proto__: null };")();
	var destroy;
	hw.addEventListener("unload", destroy = function destroy(e) {
		var w = e.target.defaultView || e.target;
		if(w != destroy.hw)
			return;
		w.removeEventListener(e.type, destroy, true);
		destroy.hw = destroy.ns = w[destroy.ns] = null;
	}, true);
	destroy.ns = ns;
	destroy.hw = hw;
	return st;
}

})(this);

function HandyClicksObservers() {
	this.observers = [];
}
HandyClicksObservers.prototype = {
	notifyObservers: function() {
		var args = arguments;
		this.observers.forEach(function(ob) {
			ob[0].apply(ob[1] || window, args);
		});
	},
	addObserver: function(func, context) {
		return this.observers.push([func, context]) - 1;
	},
	removeObserver: function(oId) {
		delete this.observers[oId];
	},
	destroy: function() {
		this.observers.length = 0;
	}
};
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

	_strings: { __proto__: null }, // cache of strings from stringbundle
	_bundles: { __proto__: null },
	getBundle: function(src) {
		return g._bundles[src] || (
			g._bundles[src] = Components.classes["@mozilla.org/intl/stringbundle;1"]
				.getService(Components.interfaces.nsIStringBundleService)
				.createBundle(src)
		);
	},
	getStr: function(src, sName, defaultStr, _callerLevel) {
		try {
			return g.getBundle(src).GetStringFromName(sName);
		}
		catch(e) {
			if(_callerLevel == -1)
				return defaultStr || "";
			var caller = Components.stack.caller;
			while(caller && _callerLevel--)
				caller = caller.caller;
			g.ut._warn(
				'Can\'t get localized string "' + sName + '" from "' + src + '"',
				caller.filename,
				caller.lineNumber
			);
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

	get cn() { return lazy("cn", "handyClicksConsole");    },
	get ed() { return lazy("ed", "handyClicksEditor");     },
	get pu() { return lazy("pu", "handyClicksPrefUtils");  },
	get rs() { return lazy("rs", "handyClicksRegSvc");     },
	get st() { return lazy("st", "handyClicksSets");       },
	get su() { return lazy("su", "handyClicksSetsUtils");  },
	get ui() { return lazy("ui", "handyClicksUI");         },

	get ct() { return lazy("ct", "handyClicksConst",      "consts.js");      },
	get fn() { return lazy("fn", "handyClicksFuncs",      "funcs.js");       },
	get hc() { return lazy("hc", "handyClicks",           "handyclicks.js"); },
	get ps() { return lazy("ps", "handyClicksPrefSvc",    "prefSvc.js");     },
	get pe() { return lazy("pe", "handyClicksPrefSvcExt", "prefSvcExt.js");  },
	get ut() { return lazy("ut", "handyClicksUtils",      "utils.js");       },
	get wu() { return lazy("wu", "handyClicksWinUtils",   "winUtils.js");    },
	get dt() { return lazy("dt", "handyClicksData",       "data.js");        },

	objects: {
		handyClicksConsole:    "cn",
		handyClicksEditor:     "ed",
		handyClicks:           "hc",
		handyClicksPrefUtils:  "pu",
		handyClicksRegSvc:     "rs",
		handyClicksSets:       "st",
		handyClicksSetsUtils:  "su",
		handyClicksUI:         "ui",
		handyClicksUtils:      "ut",
		handyClicksConst:      "ct",
		handyClicksFuncs:      "fn",
		handyClicksPrefSvc:    "ps",
		handyClicksPrefSvcExt: "pe",
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

function lazy(s, p, file) {
	var has = p in window && !window.__lookupGetter__(p);
	if(!has && file) {
		var t = now();
		delete window[p];
		g.jsLoader.loadSubScript("chrome://handyclicks/content/" + file, window, "UTF-8");
		g._log(
			"Load " + file + " into " + g.path
			+ ": " + (now() - t).toFixed(2) + " ms"
			+ (s == "ut" ? "\n" + new Error().stack : "")
		);
		has = p in window; // = true ?
	}
	if(has) {
		delete g[s];
		return g[s] = window[p];
	}
	return null;
}
function now() {
	now = "performance" in window && "now" in performance
		? function() { return performance.now(); }
		: function() { return Date.now(); };
	return now();
}
function initStorage() {
	const ns = "_handyClicksStorage";
	if("create" in Object) { // Firefox 4.0+
		// Simple replacement for Application.storage
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=1090880
		// Ensure, that we have global object (because window.Services may be overwritten)
		var global = Components.utils["import"]("resource://gre/modules/Services.jsm", {});
		var storage = global[ns] || (global[ns] = global.Object.create(null));
	}
	else { // For old versions
		var hw = Components.classes["@mozilla.org/appshell/appShellService;1"]
			.getService(Components.interfaces.nsIAppShellService)
			.hiddenDOMWindow;
		if(!(ns in hw)) {
			hw[ns] = new hw.Function("return { __proto__: null };")();
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
		}
		var storage = hw[ns];
	}
	return {
		_storage: storage,
		get: function(key) {
			return key in this._storage ? this._storage[key] : undefined;
		},
		set: function(key, val) {
			if(val === undefined)
				delete this._storage[key];
			else
				this._storage[key] = val;
		}
	};
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
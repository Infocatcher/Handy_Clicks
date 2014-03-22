(function(window) {

var inWindow = "document" in window;
var document = inWindow ? window.document : {
	documentURI: new Error().fileName
};
var g = window.handyClicksGlobals = {
	errPrefix: "[Handy Clicks] ",
	get g() {
		delete g.g;
		return g.g = g;
	},

	now: now,
	_startTime: now(),

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

	get jsLoader() {
		delete g.jsLoader;
		return g.jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
	},
	timeout: function(func, context, args, delay) {
		return setTimeout(
			function(func, context, args) {
				func.apply(context, args);
			},
			delay || 0, func, context, args || []
		);
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
		return g._debug = g.pu.pref("debug");
	},
	get consoleSvc() {
		delete g.consoleSvc;
		return g.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	ts: function() {
		var d = new Date();
		var ms = d.getMilliseconds();
		return d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms;
	},
	_info: function(s) {
		g.consoleSvc.logStringMessage(g.errPrefix + g.ts() + " " + g.safeToString(s));
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

	get cs() { return lazy("cs", "handyClicksCleanupSvc", "utils.js");  },
	get ct() { return lazy("ct", "handyClicksConst",    "consts.js");   },
	get fn() { return lazy("fn", "handyClicksFuncs",    "funcs.js");    },
	get hc() { return lazy("hc", "handyClicks",         "handyclicks.js"); },
	get ps() { return lazy("ps", "handyClicksPrefSvc",  "prefSvc.js");  },
	get ut() { return lazy("ut", "handyClicksUtils",    "utils.js");    },
	get wu() { return lazy("wu", "handyClicksWinUtils", "winUtils.js"); },

	objects: {
		handyClicksConsole:    "cn",
		handyClicksCleanupSvc: "cs",
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
		handyClicksWinUtils:   "wu",
		__proto__: null
	},
	get callable() {
		var callable = [];
		var objects = g.objects;
		for(var p in objects)
			if(p in window)
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

function lazy(s, p, file) {
	var has = p in window;
	if(!has && file) {
		var t = now();
		g.jsLoader.loadSubScript("chrome://handyclicks/content/" + file, window, "UTF-8");
		g._log(
			"Load " + file + " into " + document.documentURI
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

})(this);

function HandyClicksObservers() {
	this.observers = [];
}
HandyClicksObservers.prototype = {
	notifyObservers: function() {
		var args = arguments;
		this.observers.forEach(function(ob) {
			ob[0].apply(ob[1], args);
		});
	},
	addObserver: function(func, context) {
		return this.observers.push(arguments) - 1;
	},
	removeObserver: function(oId) {
		delete this.observers[oId];
	},
	destroy: function() {
		delete this.observers;
	}
};
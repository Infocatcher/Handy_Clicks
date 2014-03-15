(function() {

var g = window.handyClicksGlobals = {
	get g() {
		delete g.g;
		return g.g = g;
	},

	_elts: { __proto__: null },
	$: function(id) {
		return g._elts[id] || (g._elts[id] = document.getElementById(id));
	},
	e: function(id) {
		return document.getElementById(id);
	},
	get jsLoader() {
		delete g.jsLoader;
		return g.jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
	},
	get _debug() {
		if(!g.pu)
			return false;
		g.pu.oSvc.addObserver(function(pName, pVal) {
			if(pName == "debug")
				g._debug = pVal;
		});
		delete g._debug;
		return g._debug = g.pu.pref("debug");
	},
	_log: function(s) {
		// Note: we don't load utils.js from console.xul overlay
		g.ut && g.ut._log(s);
	},

	get cn() { return lazy("cn", "handyClicksConsole");    },
	get cs() { return lazy("cs", "handyClicksCleanupSvc"); },
	get ed() { return lazy("ed", "handyClicksEditor");     },
	get hc() { return lazy("hc", "handyClicks");           },
	get pu() { return lazy("pu", "handyClicksPrefUtils");  },
	get rs() { return lazy("rs", "handyClicksRegSvc");     },
	get st() { return lazy("st", "handyClicksSets");       },
	get su() { return lazy("su", "handyClicksSetsUtils");  },
	get ui() { return lazy("ui", "handyClicksUI");         },
	get ut() { return lazy("ut", "handyClicksUtils");      },

	get ct() { return lazy("ct", "handyClicksConst",    "consts.js");   },
	get fn() { return lazy("fn", "handyClicksFuncs",    "funcs.js");    },
	get ps() { return lazy("ps", "handyClicksPrefSvc",  "prefSvc.js");  },
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
		var objects = this.objects;
		for(var p in objects)
			if(p in window)
				callable.push(window[p]);
		return callable;
	},
	shutdown: function() {
		// Remove all cycle references to simplify garbage collection
		// Be careful, we can't undo this!
		var objects = this.objects;
		for(var p in objects)
			delete g[objects[p]];
		delete g.g;
		g._elts = null;
	}
};

function lazy(s, p, file) {
	var has = p in window;
	if(!has && file) {
		g._log("Load " + file + " into " + document.documentURI);
		g.jsLoader.loadSubScript("chrome://handyclicks/content/" + file, window, "UTF-8");
		has = p in window; // = true ?
	}
	if(has) {
		delete g[s];
		return g[s] = window[p];
	}
	return null;
}

})();
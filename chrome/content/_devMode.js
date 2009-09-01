function handyClicksReloadScripts() {
	var jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	var path = "chrome://handyclicks/content/";
	var files = {
		"console.js":     "handyClicksConsole",
		"editor.js":      "handyClicksEditor",
		"funcs.js":       "handyClicksFuncs",
		"handyclicks.js": "handyClicks",
		"prefSvc.js":     "handyClicksPrefSvc",
		"prefUtils.js":   "handyClicksPrefUtils",
		"sets.js":        "handyClicksSets",
		"utils.js":       "handyClicksUtils",
		"winUtils.js":    "handyClicksWinUtils",
		"regSvc.js":      "handyClicksRegSvc",
		__proto__: null
	};
	function _log(msg) {
		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("[Handy Clicks]: " + msg);
	}
	try {
		handyClicksRegSvc.destroy(true);
		var t = Date.now(), p;
		for(var f in files) {
			p = files[f];
			if(p in window)
				jsLoader.loadSubScript(path + f);
		}
		handyClicksRegSvc.init(true);
		_log("Scripts from " + location.href + " was successfully reloaded! " + (Date.now() - t) + "ms");
	}
	catch(e) {
		_log("Can't reload scripts");
		throw e;
	}
}
window.addEventListener(
	"keydown",
	function(e) {
		if( // Ctrl+Alt+R
			String.fromCharCode(e.keyCode) == "R"
			&& e.ctrlKey && !e.shiftKey && e.altKey && !e.metaKey
			&& navigator.preference("extensions.handyclicks.devMode")
		) {
			e.preventDefault();
			e.stopPropagation();
			handyClicksReloadScripts();
		}
	},
	true
);
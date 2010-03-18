var handyClicksReloader = {
	init: function(reloadFlag) {
		window.addEventListener("keydown", this, true);
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("keydown", this, true);
	},
	reloadScripts: function() {
		const jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
		const path = "chrome://handyclicks/content/";
		const files = {
			"console.js":     "handyClicksConsole",
			"editor.js":      "handyClicksEditor",
			"funcs.js":       "handyClicksFuncs",
			"handyclicks.js": "handyClicks",
			"prefSvc.js":     "handyClicksPrefSvc",
			"prefUtils.js":   "handyClicksPrefUtils",
			"sets.js":        "handyClicksSets",
			"utils.js":       "handyClicksUtils",
			"winUtils.js":    "handyClicksWinUtils",
			"setsUtils.js":   "handyClicksSetsUtils",
			// Must be last:
			"regSvc.js":      "handyClicksRegSvc",
			__proto__: null
		};
		try {
			handyClicksRegSvc.destroy(true);
			var t = Date.now(), p;
			for(var f in files) {
				p = files[f];
				if(p in window)
					jsLoader.loadSubScript(path + f);
			}
			handyClicksRegSvc.init(true);
			var h = /\/[^\/]+$/.test(location.href) ? RegExp.lastMatch : location.href;
			this._log("Scripts from " + h + " was successfully reloaded! " + (Date.now() - t) + " ms");
		}
		catch(e) {
			this._log("Can't reload scripts");
			throw e;
		}
	},
	reloadStyles: function() {
		const ns = "chrome://handyclicks/";

		var sheets = [];
		var nodes = document.childNodes;
		for(var i = nodes.length - 1; i >= 0; i--) {
			var node = nodes[i];
			if(
				node instanceof XMLStylesheetProcessingInstruction
				&& "sheet" in node
			) {
				var href = node.sheet.href;
				if(href.indexOf(ns) == 0) {
					sheets.push(href);
					node.parentNode.removeChild(node);
				}
			}
		}

		var h = /\/[^\/]+$/.test(location.href) ? RegExp.lastMatch : location.href;
		if(!sheets.length) {
			this._log("Styles not found in " + h);
			return;
		}

		document.loadOverlay("data:application/vnd.mozilla.xul+xml," + encodeURIComponent(
			'<?xml version="1.0"?>\n'
			+ sheets.map(
				function(href) {
					return '<?xml-stylesheet href="' + href + '" type="text/css"?>';
				}
			).join("\n")
			+ '<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" />'
		), null);

		this._log("Styles from " + h + " [" + sheets.length+ "]" + " was successfully reloaded!");
	},
	_lastKeydown: 0,
	keydownHandler: function(e) {
		if(e.ctrlKey && !e.shiftKey && e.altKey && !e.metaKey && this.devMode) {
			var now = Date.now();
			if(now - this._lastKeydown < 100)
				return;
			this._lastKeydown = now;
			var key = String.fromCharCode(e.keyCode);
			if(key == "R") { // Ctrl+Alt+R
				this.stopEvent(e);
				this.reloadScripts();
			}
			else if(key == "C") { // Ctrl+Alt+C
				this.stopEvent(e);
				this.reloadStyles();
			}
		}
	},
	get devMode() {
		return navigator.preference("extensions.handyclicks.devMode");
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	_log: function(msg) {
		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("[Handy Clicks]: " + msg);
	},
	handleEvent: function(e) {
		if(e.type == "keydown")
			this.keydownHandler(e);
	}
};
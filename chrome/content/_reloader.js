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
			"globals.js":       "handyClicksGlobals", // Should be first
			"console.js":       "handyClicksConsole",
			"consts.js":        "handyClicksConst",
			"data.js":          "handyClicksData",
			"editor.js":        "handyClicksEditor",
			"funcs.js":         "handyClicksFuncs",
			"handyclicks.js":   "handyClicks",
			"handyclicksUI.js": "handyClicksUI",
			"prefSvc.js":       "handyClicksPrefSvc",
			"prefSvcExt.js":    "handyClicksPrefSvcExt",
			"prefUtils.js":     "handyClicksPrefUtils",
			"sets.js":          "handyClicksSets",
			"setsUtils.js":     "handyClicksSetsUtils",
			"utils.js":         "handyClicksUtils",
			"winUtils.js":      "handyClicksWinUtils",
			"regSvc.js":        "handyClicksRegSvc", // Should be last
			__proto__: null
		};
		try {
			var t = Date.now();
			handyClicksRegSvc.destroy(true);
			for(var f in files) {
				var p = files[f];
				if(p in window)
					jsLoader.loadSubScript(path + f + "?" + Date.now());
			}
			handyClicksRegSvc.init(true);
			this._log("js reloaded (" + (Date.now() - t) + " ms)");
		}
		catch(e) {
			this._log("Can't reload scripts!");
			throw e;
		}
	},
	reloadStyles: function() {
		const ns = "chrome://handyclicks/";

		Array.prototype.forEach.call( // Save text in textboxes with custom bindings
			document.getElementsByTagName("textbox"),
			function(tb) {
				var binding = window.getComputedStyle(tb, null).MozBinding || "";
				if(binding.indexOf(ns) != -1)
					tb.setAttribute("value", tb.value);
			}
		);

		var sheetsHrefs = [];
		var nodes = document.childNodes;
		for(var i = nodes.length - 1; i >= 0; --i) {
			var node = nodes[i];
			if(
				node instanceof XMLStylesheetProcessingInstruction
				&& "sheet" in node
			) {
				var href = node.sheet.href;
				if(href.indexOf(ns) == 0) {
					sheetsHrefs.push(href);
					node.parentNode.removeChild(node);
				}
			}
		}

		if(!sheetsHrefs.length) {
			// Firefox 1.5 and 2.0
			var sh = "__handyClicks__sheetsHrefs";
			if(sh in document)
				sheetsHrefs = document[sh];
			else {
				var sheets = document.styleSheets;
				for(var i = sheets.length - 1; i >= 0; --i) {
					var sheet = sheets[i];
					var rules = sheet.cssRules;
					var href = sheet.href;
					if(href.indexOf(ns) == 0) {
						sheetsHrefs.push(href);
						for(var j = rules.length - 1; j >= 0; --j)
							sheet.deleteRule(rules[j]);
					}
				}
				document[sh] = sheetsHrefs;
			}
			if(sheetsHrefs.length)
				this._log("Can't completely remove styles!");
		}

		if(!sheetsHrefs.length) {
			this._log("css not found!");
			return;
		}

		var rnd = "?" + Date.now();
		document.loadOverlay(
			"data:application/vnd.mozilla.xul+xml," + encodeURIComponent(
				'<?xml version="1.0"?>\n'
				+ sheetsHrefs.map(function(href, indx) {
					return '<?xml-stylesheet href="' + href.replace(/\?\d+$/, "") + rnd + '" type="text/css"?>';
				}).join("\n")
				+ '<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" />'
			),
			null
		);

		this._log("css [" + sheetsHrefs.length + "] reloaded");
	},
	_lastAction: 0,
	keydownHandler: function(e) {
		if(e.ctrlKey && !e.shiftKey && e.altKey && !e.metaKey && this.debug) {
			if(Date.now() - this._lastAction < 300)
				return;
			switch(String.fromCharCode(e.keyCode).toLowerCase()) {
				case "r": this.reloadScripts(); break;
				case "c": this.reloadStyles();  break;
				default: return;
			}
			this._lastAction = Date.now();
			this.stopEvent(e);
		}
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	get prefSvc() {
		delete this.prefSvc;
		return this.prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefBranch2 || Components.interfaces.nsIPrefBranch);
	},
	get debug() {
		return this.prefSvc.getBoolPref("extensions.handyclicks.debug");
	},
	get path() {
		return /[^\\\/]+$/.test(location.href) ? RegExp.lastMatch : location.href;
	},
	ts: function() {
		var d = new Date();
		var ms = d.getMilliseconds();
		return d.toTimeString().replace(/^.*\d+:(\d+:\d+).*$/, "$1") + ":" + "000".substr(("" + ms).length) + ms + " ";
	},
	_log: function(msg) {
		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("[Handy Clicks] " + this.ts() + " " + this.path + ": " + msg);
	},
	handleEvent: function(e) {
		if(e.type == "keydown")
			this.keydownHandler(e);
	}
};
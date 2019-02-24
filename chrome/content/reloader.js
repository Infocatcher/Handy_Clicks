var handyClicksReloader = {
	__proto__: handyClicksGlobals,

	init: function(reloadFlag) {
		window.addEventListener("keydown", this, true);
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("keydown", this, true);
	},
	reloadScripts: function() {
		const jsLoader = this.jsLoader;
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
			"io.js":            "handyClicksIO",
			"jsUtils.js":       "handyClicksJsUtils",
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
			var t = this.now();
			handyClicksRegSvc.destroy(true);
			for(var f in files) {
				var p = files[f];
				if(p in window && !window.__lookupGetter__(p))
					jsLoader.loadSubScript(path + f + "?" + Date.now());
			}
			handyClicksRegSvc.init(true);
			this._log("js reloaded (" + (this.now() - t).toFixed(2) + " ms)");
		}
		catch(e) {
			this._log("Can't reload scripts!");
			Components.utils.reportError(e);
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

		if(!sheetsHrefs.length) { // Firefox 1.5 and 2.0
			var sh = "__handyClicks__sheetsHrefs";
			var hasHrefs = sh in document;
			if(hasHrefs)
				sheetsHrefs = document[sh];
			else
				sheetsHrefs = document[sh] = [];
			var sheets = document.styleSheets;
			for(var i = sheets.length - 1; i >= 0; --i) {
				var sheet = sheets[i];
				var href = sheet.href;
				if(href.indexOf(ns) == 0) {
					if(!hasHrefs)
						sheetsHrefs.push(href);
					sheet.disabled = true;
					//var rules = sheet.cssRules;
					//for(var j = rules.length - 1; j >= 0; --j)
					//	sheet.deleteRule(rules[j]);
				}
			}
			this._log("Can't completely remove styles!");
		}

		if(!sheetsHrefs.length) {
			this._log("css not found!");
			return;
		}

		var rnd = "?" + Date.now();
		document.loadOverlay("data:application/vnd.mozilla.xul+xml," + encodeURIComponent(
			'<?xml version="1.0"?>\n'
			+ sheetsHrefs.map(function(href, indx) {
				return '<?xml-stylesheet href="' + href.replace(/\?\d+$/, "") + rnd + '" type="text/css"?>';
			}).join("\n")
			+ '<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" />'
		), null);

		this._log("css [" + sheetsHrefs.length + "] reloaded");
	},
	reopenDialog: function() {
		var de = document.documentElement;
		if(!("cancelDialog" in de) || !de.cancelDialog())
			return;
		var args = [location.href, "",
			"chrome,all,resizable,dialog=0" + ",left=" + window.screenX + ",top=" + window.screenY
		];
		"arguments" in window && args.push.apply(args, window.arguments);
		window.openDialog.apply(window, args)
			.focus();
	},
	_lastAction: 0,
	keydownHandler: function(e) {
		if(e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && this._debug) {
			if(Date.now() - this._lastAction < 300)
				return;
			switch(e.keyCode) {
				case e.DOM_VK_R: this.reloadScripts(); break;
				case e.DOM_VK_C: this.reloadStyles();  break;
				case e.DOM_VK_W: this.reopenDialog();  break;
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
	get path() {
		delete this.path;
		return this.path = /[^\\\/]+$/.test(location.href) ? RegExp.lastMatch : location.href;
	},
	_log: function(s) {
		this.g._log(this.path + ": " + s);
	},
	handleEvent: function(e) {
		if(e.type == "keydown")
			this.keydownHandler(e);
	}
};
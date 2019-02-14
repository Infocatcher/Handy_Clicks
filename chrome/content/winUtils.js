var handyClicksWinUtils = {
	__proto__: handyClicksGlobals,

	get wm() {
		delete this.wm;
		return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
	},
	get ww() {
		delete this.ww;
		return this.ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher);
	},
	get opener() {
		return typeof top == "undefined" ? null : top;
	},
	openWindowByType: function _ow(uri, type, features, args, closeOpened) {
		var w = this.wm.getMostRecentWindow(type);
		_ow.alreadyOpened = !!w;
 		if(w) {
 			if(closeOpened)
 				w.close();
 			else
 				w.focus();
 			return w;
 		}
		w = this.ww.openWindow(
			this.opener, uri, "_blank",
			features || "chrome,all,toolbar,centerscreen,resizable,dialog=0", null
		);
		if(args)
			w.arguments = args;
		return w;
	},
	forEachWindow: function(winTypes, fn, context) {
		var wm = this.wm;
		return (typeof winTypes == "string" ? [winTypes] : winTypes || [null]).some(function(winType) {
			var ws = wm.getEnumerator(winType);
			while(ws.hasMoreElements()) {
				var w = ws.getNext();
				if(fn.call(context || w, w))
					return true;
			}
			return false;
		});
	},
	forEachBrowserWindow: function(fn, context) {
		// Note: private windows doesn't have "windowtype" in SeaMonkey
		return this.forEachWindow(this.isSeaMonkey ? null : "navigator:browser", function(w) {
			return "handyClicksUI" in w && fn.call(context || w, w);
		});
	},

	getXulWin: function(win) {
		var ci = Components.interfaces;
		return win.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIWebNavigation)
			.QueryInterface(ci.nsIDocShellTreeItem)
			.treeOwner
			.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIXULWindow);
	},

	winIdProp: "__handyClicks__winId",
	getWinId: function(pSrc, mode, shortcut, itemType, isDelayed) {
		return (mode == this.ct.EDITOR_MODE_TYPE ? itemType : shortcut + "-" + itemType)
			+ (pSrc ? this.ct.OTHER_SRC_POSTFIX : "");
	},
	getEditorById: function(winId) {
		var wProp = this.winIdProp;
		var ws = this.wm.getEnumerator("handyclicks:editor");
		while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if(wProp in w && w[wProp] == winId)
				return w;
		}
		return null;
	},
	getEditorsById: function(winIds) {
		var wProp = this.winIdProp;
		var ws = this.wm.getEnumerator("handyclicks:editor");
		var wins = [];
		while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if(wProp in w && w[wProp] in winIds)
				wins.push(w);
		}
		return wins;
	},
	openEditor: function _oe(pSrc, mode, shortcut, itemType, isDelayed) {
		var winId = this.getWinId.apply(this, arguments);
		var w = this.getEditorById(winId);
		_oe.alreadyOpened = !!w;
		if(w) {
			w.focus();
			if(mode == this.ct.EDITOR_MODE_SHORTCUT)
				w.handyClicksEditor.selectFuncTab(isDelayed);
			return w;
		}
		w = this.ww.openWindow(
			this.opener, "chrome://handyclicks/content/editor.xul", "_blank",
			"chrome,all,toolbar,centerscreen,resizable,dialog=0", null
		);
		w.arguments = [pSrc, mode || this.ct.EDITOR_MODE_SHORTCUT, shortcut, itemType, isDelayed];
		w[this.winIdProp] = winId;
		this.markOpenedEditors(winId, true, !!pSrc);
		return w;
	},
	openEditorEx: function(pSrc, mode, shortcut, itemType, isDelayed, src, line) {
		var w = this.openEditor(pSrc, mode, shortcut, itemType, isDelayed);
		(function _oe() {
			if("_handyClicksInitialized" in w)
				w.handyClicksEditor.selectTargetTab(isDelayed, src, line);
			else
				setTimeout(_oe, 5);
		})();
		return w;
	},
	openEditorLink: function(href, line) {
		const ed = this.ct.PROTOCOL_EDITOR;
		if(!href || !this.hasPrefix(href, ed))
			return null;
		href = href.replace(/\?(.*)$/, "");
		var args = RegExp.$1;
		if(args && typeof line != "number" && /(?:^|&)line=(\d+)(?:&|$)/.test(args))
			line = +RegExp.$1;
		var tokens = href.substr(ed.length).split("/");
		var mode = tokens[0];
		if(mode == this.ct.EDITOR_MODE_SHORTCUT) {
			var shortcut = tokens[1];
			var itemType = tokens[2];
			var isDelayed = tokens[3] == this.ct.EDITOR_SHORTCUT_DELAYED;
			var src = tokens[4];
		}
		else if(mode == this.ct.EDITOR_MODE_TYPE) {
			var shortcut = null;
			var itemType = tokens[1];
			var isDelayed = false;
			var src = tokens[2];
		}
		return this.openEditorEx(null, mode, shortcut, itemType, isDelayed, src, line);
	},
	getOpenEditorLink: function(href, line) {
		var _this = this;
		return function() {
			_this.openEditorLink(href, line);
		};
	},
	markOpenedEditors: function(winId, editStat, otherSrc) {
		var wSet = this.wm.getMostRecentWindow("handyclicks:settings");
		if(!wSet || !("_handyClicksInitialized" in wSet))
			return;
		var st = wSet.handyClicksSets;
		if(!arguments.length)
			st.markOpenedEditors();
		else if(st.ps.otherSrc == otherSrc)
			st.setItemStatus(winId, editStat);
		st.ensureStatusSearchUpdated();
	},
	shortcutRenamed: function(oldHash, newHash) {
		var wSet = this.wm.getMostRecentWindow("handyclicks:settings");
		if(!wSet || !("_handyClicksInitialized" in wSet))
			return;
		var st = wSet.handyClicksSets;
		if(st.ps.otherSrc == this.ps.otherSrc)
			st.shortcutRenamed(oldHash, newHash);
	},

	openSettings: function(closeOpened) {
		return this.openWindowByType(
			"chrome://handyclicks/content/sets.xul",
			"handyclicks:settings",
			null, null, closeOpened
		);
	},
	openSettingsImport: function(/* importArgs */) {
		var w = this.openSettings();
		var args = arguments;
		args.length && (function _imp() {
			if("_handyClicksInitialized" in w)
				w.handyClicksSets.importSets.apply(w.handyClicksSets, args);
			else
				setTimeout(_imp, 5);
		})();
		return w;
	},
	openSettingsPane: function(paneId) {
		const idPrefix = "hc-sets-pane-";
		if(!this.hasPrefix(paneId, idPrefix))
			paneId = idPrefix + paneId;
		var w = this.openSettings();
		var showPane = function(e) {
			e && w.removeEventListener(e.type, showPane, false);
			var doc = w.document;
			var pane = doc.getElementById(paneId);
			pane && doc.documentElement.showPane(pane);
		};
		if(this.openWindowByType.alreadyOpened)
			showPane();
		else
			w.addEventListener("load", showPane, false);
		return w;
	},
	openSettingsLink: function(uri) {
		if(this.hasPrefix(uri, this.ct.PROTOCOL_SETTINGS_ADD))
			this.openSettingsImport(true, this.ct.IMPORT_STRING, uri);
		else if(this.hasPrefix(uri, this.ct.PROTOCOL_SETTINGS_PANE))
			this.openSettingsPane(uri.substr(this.ct.PROTOCOL_SETTINGS_PANE.length));
		else if(this.hasPrefix(uri, this.ct.PROTOCOL_SETTINGS))
			this.openSettings();
	},

	// See the same function in utils.js (winUtils.js is global, but utils.js - not)
	// Used from components/hcComponent.js and from console.js
	//~ todo: use global utils
	hasPrefix: function(str, prefix) {
		var f = this.hasPrefix = "startsWith" in String.prototype
			? String.prototype.startsWith.call.bind(String.prototype.startsWith)
			: function(str, prefix) {
				return str.substr(0, prefix.length) == prefix;
			};
		return f.apply(this, arguments);
	}
};
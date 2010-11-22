var handyClicksWinUtils = {
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
			features || "chrome,titlebar=1,toolbar=1,centerscreen,resizable,dialog=0", null
		);
		if(args)
			w.arguments = args;
		return w;
	},
	forEachWindow: function(winTypes, func, context) {
		var wm = this.wm;
		Array.concat(winTypes).forEach(
			function(winType) {
				var ws = wm.getEnumerator(winType), w;
				while(ws.hasMoreElements()) {
					w = ws.getNext();
					func.call(context || w, w);
				}
			}
		);
	},
	maximizeWindow: function(win) {
		win = win || top;
		if("fullScreen" in win)
			win.fullScreen = false;
		switch(win.windowState) {
			case win.STATE_MAXIMIZED: win.restore();  break;
			case win.STATE_NORMAL:    win.maximize();
		}
	},
	toggleFullscreen: function(win) {
		win = win || top;
		if("fullScreen" in win)
			win.fullScreen = !win.fullScreen; // Firefox 3.0+
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
	toggleOnTop: function(forcedOnTop) {
		var xulWin = this.getXulWin(top);
		var onTop = forcedOnTop || xulWin.zLevel <= xulWin.normalZ;
		xulWin.zLevel = onTop ? xulWin.highestZ : xulWin.normalZ;
		this.showOnTopStatus(onTop);
	},
	showOnTopStatus: function(onTop) {
		if(onTop === undefined) {
			var xulWin = this.getXulWin(top);
			onTop = xulWin.zLevel == xulWin.highestZ;
		}
		var buttonVisible = this.pu.pref("ui.onTopButton");
		var butt = this.$("hc-sets-onTop");
		butt.hidden = !buttonVisible;
		if(buttonVisible) {
			butt.setAttribute("checked", onTop); // + autoCheck="false"
			butt.setAttribute("hc_hideLabel", !this.pu.pref("ui.onTopButtonLabel"));
		}
		var de = top.document.documentElement;
		var s = de.style;
		if(onTop && !buttonVisible) {
			s.outline = "2px groove " + (this.pu.pref("ui.onTopBorderColor") || "orange");
			s.outlineOffset = "-2px";
		}
		else {
			s.outline = "";
			s.outlineOffset = "";
		}
		de.setAttribute("hc_onTop", onTop);
		de.id && document.persist(de.id, "hc_onTop");
	},
	toggleOnTopButton: function() {
		const p = "ui.onTopButton";
		this.pu.pref(p, !this.pu.pref(p));
	},

	winIdProp: "__handyClicks__winId",
	openEditor: function _oe(pSrc, mode, shortcut, itemType, isDelayed) {
		var winId = (mode == this.ct.EDITOR_MODE_TYPE ? itemType : shortcut + "-" + itemType)
			+ (pSrc ? this.ct.OTHER_SRC_POSTFIX : "");
		var wProp = this.winIdProp;
		var ws = this.wm.getEnumerator("handyclicks:editor");
		var w;
		while(ws.hasMoreElements()) {
			w = ws.getNext();
			if(wProp in w && w[wProp] == winId) {
				_oe.alreadyOpened = true;
				w.focus();
				return w;
			}
		}

		_oe.alreadyOpened = false;
		w = this.ww.openWindow(
			this.opener, "chrome://handyclicks/content/editor.xul", "_blank",
			"chrome,resizable,centerscreen,dialog=0", null
		);
		w.arguments = [pSrc, mode || "shortcut", shortcut, itemType, isDelayed];
		w[wProp] = winId;
		this.markOpenedEditors(winId, true);
		return w;
	},
	openEditorEx: function(pSrc, mode, shortcut, itemType, isDelayed, src, line) {
		var w = this.openEditor(null, mode, shortcut, itemType, isDelayed);
		(function _oe() {
			if("_handyClicksInitialized" in w) {
				w.handyClicksEditor.selectTargetTab(isDelayed, src, line);
				return;
			}
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
			line = Number(RegExp.$1);
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
	markOpenedEditors: function(winId, editStat) {
		var wSet = this.wm.getMostRecentWindow("handyclicks:settings");
		if(!wSet)
			return;
		if(arguments.length)
			wSet.handyClicksSets.setItemStatus(winId, editStat);
		else
			wSet.handyClicksSets.markOpenedEditors();
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
			if("_handyClicksInitialized" in w) {
				w.handyClicksSets.importSets.apply(w.handyClicksSets, args);
				return;
			}
			setTimeout(_imp, 5);
		})();
		return w;
	},
	openSettingsPane: function(paneId) {
		const idPrefix = "hc-sets-pane-";
		if(!this.hasPrefix(paneId, idPrefix))
			paneId = idPrefix + paneId;
		var w = this.openSettings();
		var showPane = function _sp(e) {
			e && w.removeEventListener(e.type, _sp, false);
			var doc = w.document;
			var pane = doc.getElementById(paneId);
			pane && doc.documentElement.showPane(pane);
		};
		if(this.openWindowByType.alreadyOpened)
			showPane();
		else
			w.addEventListener("resize", showPane, false); //~ todo: test
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

	// See same function in utils.js (winUtils.js are global, but utils.js - not)
	//~ todo: use global utils
	hasPrefix: function(str, prefix) {
		return str.substr(0, prefix.length) == prefix;
	}
};
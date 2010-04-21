var handyClicksWinUtils = {
	IMPORT_FILEPICKER: 0,
	IMPORT_CLIPBOARD: 1,
	IMPORT_STRING: 2,
	IMPORT_BACKUP: 3,

	EXPORT_FILEPICKER: 0,
	EXPORT_CLIPBOARD_STRING: 1,
	EXPORT_CLIPBOARD_URI: 2,

	PROTOCOL_SETTINGS: "handyclicks://settings/",
	PROTOCOL_SETTINGS_ADD: "handyclicks://settings/add/",
	PROTOCOL_EDITOR: "handyclicks://editor/",
	PROTOCOL_EDITOR_SHORTCUT: "handyclicks://editor/shortcut/",
	PROTOCOL_EDITOR_ITEM_TYPE: "handyclicks://editor/itemType/",

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
		return typeof window == "undefined" ? null : window;
	},
	openWindowByType: function _ow(uri, type, features, args) {
		var w = this.wm.getMostRecentWindow(type);
		_ow.alreadyOpened = !!w;
 		if(w) {
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
		var winId = (mode == "itemType" ? itemType : shortcut + "-" + itemType) + (pSrc ? "@otherSrc" : "");
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
	openEditorEx: function(pSrc, mode, shortcut, itemType, delayed, src, line) {
		var w = this.openEditor(null, mode, shortcut, itemType);
		(function _oe() {
			if("_handyClicksInitialized" in w) {
				w.handyClicksEditor.selectTargetTab(delayed, src, line);
				return;
			}
			setTimeout(_oe, 5);
		})();
		return w;
	},
	openEditorLink: function(href, line) {
		const ed = this.PROTOCOL_EDITOR;
		if(!href || href.indexOf(ed) != 0)
			return;
		href = href.replace(/\?(.*)$/, "");
		var args = RegExp.$1;
		if(args && typeof line != "number" && /(?:^|&)line=(\d+)(?:&|$)/.test(args))
			line = Number(RegExp.$1);
		var tokens = href.substr(ed.length).split("/");
		var mode = tokens[0];
		if(mode == "shortcut") {
			var shortcut = tokens[1];
			var itemType = tokens[2];
			var delayed = tokens[3] == "delayed";
			var src = tokens[4];
		}
		else if(mode == "itemType") {
			var shortcut = null;
			var itemType = tokens[1];
			var delayed = false;
			var src = tokens[2];
		}
		this.openEditorEx(null, mode, shortcut, itemType, delayed, src, line);
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

	openSettings: function(/* importArgs */) {
		var w = this.openWindowByType(
			"chrome://handyclicks/content/sets.xul",
			"handyclicks:settings"
		);
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
	openSettingsLink: function(uri) {
		if(uri.indexOf(this.PROTOCOL_SETTINGS_ADD) == 0)
			this.openSettings(true, this.IMPORT_STRING, uri);
		else if(uri.indexOf(this.PROTOCOL_SETTINGS) == 0)
			this.openSettings();
	}
};
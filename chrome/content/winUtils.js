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
			features || "chrome,centerscreen,resizable,dialog=0", null
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
	toggleOnTop: function(inherit, forcedOnTop) {
		if(inherit && !opener)
			return;
		var xulWin = this.getXulWin(top);
		var onTop = forcedOnTop
			? true
			: inherit
				? this.getXulWin(opener).zLevel > xulWin.normalZ
				: xulWin.zLevel <= xulWin.normalZ;
		xulWin.zLevel = onTop ? xulWin.highestZ : xulWin.normalZ;

		this.showOnTopStatus(onTop);
	},
	showOnTopStatus: function(onTop, buttonVisible) {
		if(buttonVisible === undefined)
			buttonVisible = this.pu.pref("ui.onTopButton");

		var butt = this.$("hc-sets-onTop");
		butt.hidden = !buttonVisible;
		if(buttonVisible) {
			butt.setAttribute("checked", onTop);
			butt.style.textDecoration = onTop ? "underline" : "";
		}

		if(buttonVisible)
			onTop = false;
		else if(onTop === undefined) {
			var xulWin = this.getXulWin(top);
			onTop = xulWin.zLevel == xulWin.highestZ;
		}

		var s = top.document.documentElement.style;
		if(onTop) {
			s.outline = "2px groove " + (this.pu.pref("ui.onTopBorderColor") || "orange");
			s.outlineOffset = "-2px";
		}
		else {
			s.outline = "";
			s.outlineOffset = "";
		}

		document.documentElement.setAttribute("hc_onTop", onTop);
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
	},
	openLink: function(href, line) {
		const ed = "handyclicks://editor/";
		if(!href || href.indexOf(ed) != 0)
			return false;
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
		return true;
	},
	getOpenLink: function(href, line) {
		var _this = this;
		return function() {
			_this.openLink(href, line);
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
			"handyclicks:settings",
			"chrome,titlebar,toolbar,centerscreen,resizable,dialog=0"
		);
		var args = arguments;
		args.length && (function _imp() {
			if("_handyClicksInitialized" in w) {
				w.handyClicksSets.importSets.apply(w.handyClicksSets, args);
				return;
			}
			setTimeout(_imp, 5);
		})();
	}
};
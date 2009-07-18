var handyClicksWinUtils = {
	get wm() {
		delete this.wm;
		return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
	},
	openWindowByType: function(win, uri, type, features/*, arg0, arg1, ...*/) {
		var w = this.wm.getMostRecentWindow(type);
 		if(w) {
 			w.focus();
 			return w;
 		}
		else {
			var args = [uri, "_blank", features || "chrome,centerscreen,resizable,dialog=0"];
			for(var i = 4, len = arguments.length; i < len; i++)
				args.push(arguments[i]);
			win = win || window;
			return win.openDialog.apply(win, args);
		}
	},
	winIdProp: "__handyClicksWinId",
	openEditor: function(mode, shortcut, itemType) {
		var winId = mode == "itemType" ? itemType : shortcut + "-" + itemType;
		var wProp = this.winIdProp;
		var ws = this.wm.getEnumerator("handyclicks:editor");
		var w;
		while(ws.hasMoreElements()) {
			w = ws.getNext();
			if(wProp in w && w[wProp] == winId) {
				w.focus();
				return w;
			}
		}
		w = window.openDialog(
			"chrome://handyclicks/content/editor.xul",
			"_blank",
			"chrome,resizable,centerscreen,dialog=0",
			mode || "shortcut", shortcut, itemType
		);
		w[wProp] = winId;
		this.highlightOpened(winId, true);
		return w;
	},
	highlightOpened: function(winId, editStat) {
		var wSet = this.wm.getMostRecentWindow("handyclicks:settings");
		if(wSet)
			wSet.handyClicksSets.setRowStatus(winId, editStat);
	},
	highlightAllOpened: function() {
		var wSet = this.wm.getMostRecentWindow("handyclicks:settings");
		if(wSet)
			wSet.handyClicksSets.highlightAllOpened();
	}
};
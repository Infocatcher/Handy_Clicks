var handyClicksWinUtils = {
	get wm() {
		delete this.wm;
		return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
	},
	openWindowByType: function(uri, type, features, win) {
		var w = this.wm.getMostRecentWindow(type);
 		if(w)
 			w.focus();
		else
			w = (win || window).openDialog(
				uri, "", features || "chrome,centerscreen,resizable,dialog=0"
			);
		return w;
	},
	openEditor: function(mode, shortcut, itemType) {
		var winId = mode == "itemType" ? itemType : shortcut + "-" + itemType;
		var pId = "__handyClicksWinId";
		var ws = this.wm.getEnumerator("handyclicks:editor");
		var w;
		while(ws.hasMoreElements()) {
			w = ws.getNext();
			if(pId in w && w[pId] == winId) {
				w.focus();
				return w;
			}
		}
		w = window.openDialog(
			"chrome://handyclicks/content/editor.xul",
			"",
			"chrome,resizable,centerscreen,dialog=0",
			mode || "shortcut", shortcut, itemType
		);
		w[pId] = winId;
		return w;
	}
};
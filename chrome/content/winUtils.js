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
	}
};
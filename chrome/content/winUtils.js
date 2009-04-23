var handyClicksWinUtils = {
	get wm() {
		if(!this._wm)
			this._wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
		return this._wm;
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
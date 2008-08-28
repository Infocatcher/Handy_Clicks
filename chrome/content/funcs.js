var totalClicksFuncs = {
	tc: totalClicks,
	copyItemText: function(stopEvt) { // for all
		var tc = this.tc;
		// tc.stopEvent(e);
		stopEvt();
		var it = tc.item;
		var txt = it.textContent || it.label;
		// alert("<" + txt + ">");
		this.copyStr(txt);
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	}
};
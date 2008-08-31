var totalClicksFuncs = {
	tc: totalClicks,
	copyItemText: function(e) { // for all
		var tc = this.tc;
		tc.stopEvent(e);
		// stopEvt();
		var it = tc.item;
		var txt = it.textContent || it.label;
		// alert("<" + txt + ">");
		this.copyStr(txt);
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	get popup() {
		var pSet = document.getElementById("mainPopupSet");
		var id = "totalClicks-generatedPopup";
		var popup = document.getElementById(id);
		if(popup)
			pSet.removeChild(popup);
		popup = document.createElement("popup");
		popup.id = id;
		var mp = document.createElement("menupopup");
		mp.id = "totalClicks-generatedMenupopup";
		popup.appendChild(mp);
		pSet.appendChild(popup);
		return mp;
	},
	createPopup: function(items) {
		/***
		[
			{ label: "123", oncommand: "alert(0);", tooltiptext: "", image: "" }
			// , ...
		]
		***/
		var mPopup = this.popup;
		var it, mi;
		for(var i = 0; i < items.length; i++) {
			it = items[i];
			mi = document.createElement(it.label ? "menuitem" : "menuseparator");
			for(var p in it) {
				if(!p)
					continue;
				if(p.indexOf("on") == 0 && typeof it[p] != "function") // oncommand, onclick, etc.
					mi.setAttribute(p, it[p]);
				else
					mi[p] = it[p]; //~ todo: test!
			}
			mPopup.appendChild(mi);
		}
		return mPopup.parentNode; // popup
	},
	showGeneratedPopup: function(items) {
		var popup = this.createPopup(items);

		document.popupNode = node;
		popup.showPopup(node, x, y, "popup", null, null);
	}
};
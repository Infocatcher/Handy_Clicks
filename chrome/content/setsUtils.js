var handyClicksSetsUtils = {
	init: function(reloadFlag) {
		window.addEventListener("DOMMouseScroll", this, true);
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("DOMMouseScroll", this, true);
	},
	handleEvent: function(e) {
		if(e.type == "DOMMouseScroll")
			this.listScroll(e);
	},
	listScroll: function(e) {
		var ml = e.target;
		var tn = ml.tagName;
		if(tn == "menuitem" || tn == "menuseparator") {
			ml = ml.parentNode.parentNode;
			tn = ml.tagName;
		}
		if(tn != "menulist" || ml.disabled)
			return;
		var mp = ml.menupopup;
		var si = ml.selectedItem;
		var plus = e.detail > 0;
		si = plus
			? !si || si == mp.lastChild
				? mp.firstChild
				: si.nextSibling
			: !si || si == mp.firstChild
				? mp.lastChild
				: si.previousSibling;
		var win = si.ownerDocument.defaultView;
		while(
			si && (
				si.getAttribute("disabled") == "true"
				|| si.tagName != "menuitem"
				|| !this.ut.isElementVisible(si)
			)
		)
			si = plus ? si.nextSibling : si.previousSibling;
		ml.selectedItem = si || (plus ? mp.firstChild : mp.lastChild);
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
	}
};
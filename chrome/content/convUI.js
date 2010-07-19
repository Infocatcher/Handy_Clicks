// This file is loaded from handyclicksUI.js with handyClicksUI.uiMigration getter
// this === handyClicksUI
function uiMigration(vers) {
	if(vers === undefined)
		vers = this.pu.pref("uiVersion") || 0;
	if(vers >= this.uiVersion)
		return;

	if(vers < 1) { //= Added: 2009-11-13
		// New id for toolbarbutton
		if(!this.$(this.toolbarButtonId)) {
			var tbm = /(?:^|,)handyClicks-toggleStatus-tbButton(?:,|$)/;
			Array.some(
				document.getElementsByTagName("toolbar"),
				function(tb) {
					var cs = tb.getAttribute("currentset");
					if(!cs || !tbm.test(cs))
						return false;
					// Add toolbarbutton manually:
					var newItem = this.paletteButton;
					if(newItem)
						tb.insertBefore(newItem, /,*([^,]+)/.test(RegExp.rightContext) && this.e(RegExp.$1) || null);
					// Fix "currentset" of toolbar:
					cs = cs.replace(tbm, "," + this.toolbarButtonId + ",")
						.replace(/^,+|,+$/g, "")
						.replace(/,+/g, ",");
					tb.setAttribute("currentset", cs);
					tb.currentSet = cs;
					document.persist(tb.id, "currentset");
					try { BrowserToolboxCustomizeDone(true); }
					catch(e) {}
					return true;
				},
				this
			);
		}
	}
	this.pu.pref("uiVersion", this.uiVersion).savePrefFile();
	this.ut._log("UI updated: " + vers + " => " + this.uiVersion);
}
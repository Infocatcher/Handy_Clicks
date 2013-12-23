// This file is loaded from prefUtils.js with handyClicksPrefUtils.prefsMigration getter
// this === handyClicksPrefUtils
function prefsMigration(allowSave, vers) {
	if(vers === undefined)
		vers = this.pref("prefsVersion") || 0;
	if(vers >= this.prefsVersion)
		return false;

	const pns = this.prefNS;
	if(vers < 1) { //= Added: 2009-09-24
		// Move prefs to "extensions.handyclicks.funcs." branch:
		[
			"loadJavaScriptLinks", "notifyJavaScriptLinks",
			"loadVoidLinksWithHandlers", "notifyVoidLinksWithHandlers",
			"filesLinksPolicy", "filesLinksMask",
			"decodeURIs",
			"convertURIs", "convertURIsCharset"
		].forEach(
			function(pId) {
				const fullId = pns + pId;
				if(this.existPref(fullId))
					this.pref("funcs." + pId, this.getPref(fullId))
						.prefSvc.deleteBranch(fullId);
			},
			this
		);
	}
	if(vers < 2) //= Added: 2009-11-13
		this.pu.prefSvc.deleteBranch(pns + "forceStopMousedownEvent");
	if(vers < 3) { //= Added: 2010-02-04
		var dm = this.pref("sets.treeDrawMode") || 0;
		if(dm >= 2)
			this.pref("sets.treeDrawMode", dm + 1);
	}
	if(vers < 4) { //= Added: 2010-03-31
		var pn = "sets.backupDepth";
		if(this.prefChanged(pn))
			this.pref(pn, (this.pref(pn) || 0) + 1);
	}
	if(vers < 5) { //= Added: 2010-04-08
		var pn = pns + "ui.showCustomizeToolbars";
		if(this.existPref(pn))
			this.pref("ui.inheritToolbarContextMenu", this.getPref(pn))
				.prefSvc.deleteBranch(pn);
	}
	if(vers < 6) { //= Added: 2011-06-27
		var pn = pns + "editor.tabSymbol";
		if(this.existPref(pn)) {
			var tabSymbol = this.getPref(pn);
			if(/^ +$/.test(tabSymbol))
				this.pref("editor.tabSize", Math.min(this.pref("editor.tabSize"), tabSymbol.length));
			this.prefSvc.deleteBranch(pn);
		}
	}
	if(vers < 7) { //= Added: 2012-12-19
		// Move prefs from editor.externalEditor* to editor.external.* branch
		var ns = "editor.externalEditor";
		this.prefSvc.getBranch(pns + ns)
			.getChildList("", {})
			.forEach(function(pName) {
				const fullId = pns + ns + pName;
				this.setPref( // We use setPref() to don't cache preferences
					pns + "editor.external." + pName.charAt(0).toLowerCase() + pName.substr(1),
					this.getPref(fullId)
				);
				this.prefSvc.deleteBranch(fullId);
			}, this);
	}
	if(vers < 8) //= Added: 2013-12-23
		this.prefSvc.deleteBranch(pns + "uiVersion");
	this.pref("prefsVersion", this.prefsVersion);
	allowSave && this.ut.timeout(this.savePrefFile, this);
	this.ut._info("Format of about:config prefs updated: " + vers + " => " + this.prefsVersion);
	return true;
}
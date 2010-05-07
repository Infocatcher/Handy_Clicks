// This file loaded from components/hcComponent.js
handyClicksUninstaller = {
	get oSvc() {
		return Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	},
	initUninstallObserver: function() {
		this.oSvc.addObserver(this, "em-action-requested", false);
		this.oSvc.addObserver(this, "quit-application", false);
	},
	destroyUninstallObserver: function() {
		this.oSvc.removeObserver(this, "em-action-requested");
		this.oSvc.removeObserver(this, "quit-application");
	},
	observe: function(subject, topic, data) {
		if(topic == "quit-application")
			this.destroyUninstallObserver();
		else if(
			topic == "em-action-requested"
			&& subject instanceof Components.interfaces.nsIUpdateItem
			&& subject.id == "handyclicks@infocatcher"
			&& data == "item-uninstalled"
		) {
			this.startup();
			this.uninstall();
			this.clear();
		}
	},
	startup: function() {
		// Simple way for get some required functions
		var temp = {};
		jsLoader.loadSubScript("chrome://handyclicks/content/utils.js", temp);
		jsLoader.loadSubScript("chrome://handyclicks/content/winUtils.js", temp);
		jsLoader.loadSubScript("chrome://handyclicks/content/prefUtils.js", temp);
		jsLoader.loadSubScript("chrome://handyclicks/content/prefSvc.js", temp);
		this.ut = temp.handyClicksUtils;
		this.wu = temp.handyClicksWinUtils;
		this.pu = temp.handyClicksPrefUtils;
		this.ps = temp.handyClicksPrefSvc;
	},
	clear: function() {
		delete this.ut;
		delete this.wu;
		delete this.pu;
		delete this.ps;
	},
	uninstall: function() {
		var prefsDir = this.ps._prefsDir;
		if(
			!prefsDir.exists()
			|| !this.ut.confirmEx(
				this.ut.getLocalized("title"),
				this.ut.getLocalized("removeSettingsConfirm"),
				this.ut.getLocalized("removeSettings"),
				false, // Cancel button is default
				this.wu.wm.getMostRecentWindow("Extension:Manager") || window
			)
		)
			return;

		//this.pu.prefSvc.deleteBranch(this.pu.prefNS);
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(
				function(pName) {
					this.pu.resetPref(this.pu.prefNS + pName);
				},
				this
			);

		//this.ps._prefsDir.remove(true);
		// Based on components/nsExtensionManager.js from Firefox 3.6
		(function removeDirRecursive(dir) {
			try {
				dir.remove(true);
				return;
			}
			catch(e) {
			}
			var dirEntries = dir.directoryEntries;
			while(dirEntries.hasMoreElements()) {
				var entry = dirEntries.getNext().QueryInterface(Components.interfaces.nsIFile);
				if(entry.isDirectory())
					removeDirRecursive(entry);
				else {
					entry.permissions = 0644;
					entry.remove(false);
				}
			}
			dir.permissions = 0755;
			dir.remove(true);
		})(prefsDir);
	}
};
handyClicksUninstaller.initUninstallObserver();
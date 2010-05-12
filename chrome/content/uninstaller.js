// This file loaded from components/hcComponent.js
handyClicksUninstaller = {
	isUninstall: false,
	uninstallConfirmed: false,
	guid: "handyclicks@infocatcher",
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
		if(topic == "quit-application") {
			this.destroyUninstallObserver();
			if(this.isUninstall && this.uninstallConfirmed) {
				this.include();
				this.uninstall();
			}
		}
		else if(
			topic == "em-action-requested"
			&& subject instanceof Components.interfaces.nsIUpdateItem
			&& subject.id == this.guid
		) {
			if(data == "item-uninstalled") {
				this.isUninstall = true;
				this.include();
				this.uninstallConfirm();
				this.exclude();
			}
			else if(data == "item-cancel-action")
				this.isUninstall = false;
		}
	},
	include: function() {
		// Simple way for get some required functions
		const path = "chrome://handyclicks/content/";
		var temp = {};
		jsLoader.loadSubScript(path + "utils.js",     temp); this.ut = temp.handyClicksUtils;
		jsLoader.loadSubScript(path + "winUtils.js",  temp); this.wu = temp.handyClicksWinUtils;
		jsLoader.loadSubScript(path + "prefUtils.js", temp); this.pu = temp.handyClicksPrefUtils;
		jsLoader.loadSubScript(path + "prefSvc.js",   temp); this.ps = temp.handyClicksPrefSvc;
	},
	exclude: function() {
		delete this.ut;
		delete this.wu;
		delete this.pu;
		delete this.ps;
	},
	uninstallConfirm: function() {
		this.uninstallConfirmed = this.ut.confirmEx(
			this.ut.getLocalized("title"),
			this.ut.getLocalized("removeSettingsConfirm"),
			this.ut.getLocalized("removeSettings"),
			false, // Cancel button is default
			this.wu.wm.getMostRecentWindow("Extension:Manager") || window
		);
	},
	uninstall: function() {
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
		})(this.ps._prefsDir);
	}
};
handyClicksUninstaller.initUninstallObserver();
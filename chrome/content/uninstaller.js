// This file is loaded from components/hcComponent.js
handyClicksUninstaller = {
	guid: "handyclicks@infocatcher",
	isUninstall: false,
	uninstallConfirmed: false,
	get oSvc() {
		delete this.oSvc;
		return this.oSvc = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	},
	get newAddonManager() {
		delete this.newAddonManager;
		return this.newAddonManager = "@mozilla.org/extensions/manager;1" in Components.classes;
	},
	initUninstallObserver: function() {
		this.oSvc.addObserver(this, "quit-application", false);
		this.oSvc.addObserver(
			this,
			this.newAddonManager
				? "em-action-requested"
				: "final-ui-startup", // Wait for AddonManager startup
			false
		);
	},
	destroyUninstallObserver: function() {
		this.oSvc.removeObserver(this, "quit-application");
		if(this.newAddonManager)
			this.oSvc.removeObserver(this, "em-action-requested");
		else
			AddonManager.removeAddonListener(this);
	},
	observe: function(subject, topic, data) {
		if(topic == "final-ui-startup") {
			this.oSvc.removeObserver(this, "final-ui-startup");
			// Firefox 3.7a5pre+:
			Components.utils.import("resource://gre/modules/AddonManager.jsm");
			//AddonManagerPrivate.startup();
			AddonManager.addAddonListener(this);
		}
		else if(topic == "quit-application") {
			this.destroyUninstallObserver();
			if(this.isUninstall && this.uninstallConfirmed) {
				this.include();
				this.uninstall();
				this.exclude();
			}
		}
		else if(
			topic == "em-action-requested"
			&& subject instanceof Components.interfaces.nsIUpdateItem
			&& subject.id == this.guid
		) {
			if(data == "item-uninstalled")
				this.handleUninstalling();
			else if(data == "item-cancel-action")
				this.isUninstall = false;
		}
	},
	onUninstalling: function(ext, requiresRestart) {
		if(ext.id == this.guid)
			this.handleUninstalling();
	},
	onOperationCancelled: function(ext) {
		if(
			ext.id == this.guid
			&& !(ext.pendingOperations & AddonManager.PENDING_UNINSTALL)
		)
			this.isUninstall = false;
	},
	handleUninstalling: function() {
		this.isUninstall = true;
		this.include();
		this.uninstallConfirm();
		this.exclude();
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
			this.wu.wm.getMostRecentWindow(null) //this.wu.wm.getMostRecentWindow("Extension:Manager")
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
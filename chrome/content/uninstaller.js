// This file is loaded from components/hcComponent.js
var handyClicksUninstaller = {
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
		return this.newAddonManager = !("@mozilla.org/extensions/manager;1" in Components.classes);
	},
	initUninstallObserver: function() {
		this.oSvc.addObserver(this, "quit-application-granted", false);
		if(this.newAddonManager) {
			// Firefox 3.7a5pre+:
			// In Firefox 1.5 we can't use "import" keyword (we get syntax error)
			Components.utils["import"]("resource://gre/modules/AddonManager.jsm");
			AddonManager.addAddonListener(this);
		}
		else
			this.oSvc.addObserver(this, "em-action-requested", false);
	},
	destroyUninstallObserver: function() {
		this.oSvc.removeObserver(this, "quit-application-granted");
		if(this.newAddonManager)
			AddonManager.removeAddonListener(this);
		else
			this.oSvc.removeObserver(this, "em-action-requested");
	},
	observe: function(subject, topic, data) {
		if(topic == "quit-application-granted") {
			this.destroyUninstallObserver();
			if(this.isUninstall && this.uninstallConfirmed)
				this.execInContext(this.uninstall);
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
		this.execInContext(this.uninstallConfirm);
	},
	execInContext: function(func) {
		this.createContext();
		func.apply(this);
		this.destroyContext();
	},
	createContext: function() {
		// Simple way for get some required functions
		const path = "chrome://handyclicks/content/";
		var temp = {};
		jsLoader.loadSubScript(path + "sets.js",      temp); this.st = temp.handyClicksSets;
		jsLoader.loadSubScript(path + "utils.js",     temp); this.ut = this.st.ut = temp.handyClicksUtils;
		jsLoader.loadSubScript(path + "winUtils.js",  temp); this.wu = this.st.wu = temp.handyClicksWinUtils;
		jsLoader.loadSubScript(path + "prefUtils.js", temp); this.pu = this.st.pu = temp.handyClicksPrefUtils;
		jsLoader.loadSubScript(path + "prefSvc.js",   temp); this.ps = this.st.ps = temp.handyClicksPrefSvc;
		jsLoader.loadSubScript(path + "consts.js",    temp); this.ct = this.st.ct = temp.handyClicksConst;
	},
	destroyContext: function() {
		this.st = this.ut = this.wu = this.pu = this.ps = this.ct = null;
	},
	uninstallConfirm: function() {
		var exportAllSets = { value: true };
		var confirmed = this.uninstallConfirmed = this.ut.confirmEx(
			this.ut.getLocalized("title"),
			this.ut.getLocalized("removeSettingsConfirm"),
			this.ut.getLocalized("removeSettings"),
			false, // Cancel button is default
			this.ut.getLocalized("exportAllSettings"), exportAllSets,
			this.wu.wm.getMostRecentWindow(null) //this.wu.wm.getMostRecentWindow("Extension:Manager")
		);
		if(confirmed && exportAllSets.value) {
			this.st.exportPrefs();
			this.st.exportSets(false, this.ct.EXPORT_FILEPICKER);
		}
	},
	uninstall: function() {
		//this.pu.prefSvc.resetBranch(this.pu.prefNS);
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(this.pu.resetPref, this.pu);

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
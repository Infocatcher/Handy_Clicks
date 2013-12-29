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
		// Simple way to get some required functions
		const path = "chrome://handyclicks/content/";
		var temp = {};
		jsLoader.loadSubScript(path + "sets.js",      temp);
		jsLoader.loadSubScript(path + "utils.js",     temp);
		jsLoader.loadSubScript(path + "winUtils.js",  temp);
		jsLoader.loadSubScript(path + "prefUtils.js", temp);
		jsLoader.loadSubScript(path + "prefSvc.js",   temp);
		jsLoader.loadSubScript(path + "consts.js",    temp);
		var shortcuts = {
			un: this,
			st: temp.handyClicksSets,
			ut: temp.handyClicksUtils,
			wu: temp.handyClicksWinUtils,
			pu: temp.handyClicksPrefUtils,
			ps: temp.handyClicksPrefSvc,
			ct: temp.handyClicksConst,
			__proto__: null
		};
		for(var p in shortcuts) {
			var o = shortcuts[p];
			for(var p in shortcuts)
				o[p] = shortcuts[p];
		}
		this.pu.instantInit();
	},
	destroyContext: function() {
		this.pu.destroy();
		this.un = this.st = this.ut = this.wu = this.pu = this.ps = this.ct = null;
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

		//this.ps.prefsDir.remove(true);
		// Based on components/nsExtensionManager.js from Firefox 3.6
		var ut = this.ut;
		(function removeDirRecursive(dir) {
			try {
				ut.removeFile(dir, true);
				return;
			}
			catch(e) {
			}
			var dirEntries = dir.directoryEntries;
			while(dirEntries.hasMoreElements()) {
				var entry = dirEntries.getNext().QueryInterface(Components.interfaces.nsIFile);
				if(entry.isDirectory())
					removeDirRecursive(entry);
				else
					ut.removeFile(entry, false);
			}
			ut.removeFile(dir, true);
		})(this.ps.prefsDir);
	}
};
handyClicksUninstaller.initUninstallObserver();
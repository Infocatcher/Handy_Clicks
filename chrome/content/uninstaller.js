// This file is loaded from components/hcComponent.js
var handyClicksUninstaller = {
	__proto__: handyClicksGlobals,

	guid: "handyclicks@infocatcher",
	isUninstall: false,
	uninstallConfirmed: false,
	get oSvc() {
		delete this.oSvc;
		return this.oSvc = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	},
	get wm() {
		delete this.wm;
		return this.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
	},
	get newAddonManager() {
		delete this.newAddonManager;
		return this.newAddonManager = !("@mozilla.org/extensions/manager;1" in Components.classes);
	},
	lazyInit: function() {
		// User can't remove our extensino without any UI windows, so it's better to wait for
		// any window before import AddonManager.jsm
		this.oSvc.addObserver(this, "domwindowopened", false);
		var win = this.wm.getMostRecentWindow(null);
		win && this.onWindowLoaded(win, 50);
	},
	lazyDestroy: function() {
		this.lazyDestroy = function() {};
		this.oSvc.removeObserver(this, "domwindowopened");
		return true;
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
		if(topic == "domwindowopened") {
			var _this = this;
			subject.addEventListener("load", function load(e) {
				subject.removeEventListener("load", load, false);
				_this.onWindowLoaded(subject);
			}, false);
		}
		else if(topic == "quit-application-granted") {
			this.lazyDestroy();
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
	onWindowLoaded: function(win, delay) {
		win.setTimeout(function(_this) {
			if(_this.lazyDestroy())
				_this.initUninstallObserver();
		}, delay || 0, this);
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
		this._log("[uninstaller] createContext()");
		const path = "chrome://handyclicks/content/";
		const jsLoader = this.jsLoader;
		var temp = this._temp = { __proto__: null };
		jsLoader.loadSubScript(path + "sets.js",       temp);
		jsLoader.loadSubScript(path + "utils.js",      temp);
		jsLoader.loadSubScript(path + "prefUtils.js",  temp);
		jsLoader.loadSubScript(path + "prefSvc.js",    temp);
		jsLoader.loadSubScript(path + "prefSvcExt.js", temp);
		var g = this.g;
		var objects = g.objects;
		for(var name in temp) if(name in objects) {
			var p = objects[name];
			delete g[p];
			g[p] = temp[name];
		}
		this.pu.instantInit();
	},
	destroyContext: function() {
		this._log("[uninstaller] destroyContext()");
		this.pu.destroy();
		var temp = this._temp;
		delete this._temp;
		var g = this.g;
		var objects = g.objects;
		for(var name in temp) {
			delete global[name];
			if(name in objects) {
				var p = objects[name];
				delete g[p];
			}
		}
		this._log("[uninstaller] destroyContext(): done");
	},
	uninstallConfirm: function() {
		this._log("[uninstaller] uninstallConfirm()");
		var exportAllSets = { value: true };
		var confirmed = this.uninstallConfirmed = this.ut.confirmEx(
			this.getLocalized("title"),
			this.getLocalized("removeSettingsConfirm"),
			this.getLocalized("removeSettings"),
			false, // Cancel button is default
			this.getLocalized("exportAllSettings"), exportAllSets,
			this.wm.getMostRecentWindow(null)
		);
		if(confirmed && exportAllSets.value) {
			this.st.exportPrefs();
			this.ps.loadSettings(); // Not just file copy... also export linked files
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
handyClicksUninstaller.lazyInit();
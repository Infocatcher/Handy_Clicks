var handyClicksPrefSvc = {
	__proto__: handyClicksObservers, // Add observers interface
	observers: [],

	// Shortcuts:
	ut: handyClicksUtils,
	pu: handyClicksPrefUtils,
	wu: handyClicksWinUtils,

	version: 0.11,
	get currentVersion() {
		return "handyClicksPrefsVersion" in window ? handyClicksPrefsVersion : 0;
	},
	backupDepth: 4,
	warnComment: "// Preferences of Handy Clicks extension.\n// Do not edit this file.\n\n",
	get versionInfo() {
		delete this.versionInfo;
		return this.versionInfo = "var handyClicksPrefsVersion = " + this.version + ";\n";
	},
	defaultPrefs: "var handyClicksCustomTypes = {};\nvar handyClicksPrefs = {};",
	prefsDirName: "handyclicks",
	prefsFileName: "handyclicks_prefs",
	okShortcut: /^button=[0-2],ctrl=(?:true|false),shift=(?:true|false),alt=(?:true|false),meta=(?:true|false)$/,
	_restoringCounter: 0,
	get profileDir() {
		var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);
		return dirSvc.get("ProfD", Components.interfaces.nsILocalFile);
	},
	get prefsDir() {
		if(!this._prefsDir) {
			var dir = this.profileDir;
			dir.append(this.prefsDirName);
			if(!dir.exists()) {
				try { dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755); }
				catch(e) { this.ut._err(this.ut.errPrefix + "Can't create directory\n" + e); }
			}
			this._prefsDir = dir;
		}
		return this._prefsDir.clone();
	},
	getFile: function(fName) {
		var file = this.prefsDir;
		file.append(fName);
		return file;
	},
	get prefsFile() {
		if(!this._prefsFile)
			return this._prefsFile = this.getFile(this.prefsFileName + ".js");
		return this._prefsFile.clone();
	},
	loadSettings: function() {
		var pFile = this.prefsFile;
		if(!pFile.exists())
			this.saveSettings(this.warnComment + this.versionInfo + this.defaultPrefs);
		var ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		var jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
		try {
			jsLoader.loadSubScript(ioSvc.newFileURI(pFile).spec);
		}
		catch(e) {
			this.ut._err(this.ut.errPrefix + "Error in Handy Clicks prefs: bad js file\n" + e);
			this.ut._err(e);
			this.loadSettingsBackup();
			return;
		}
		if(typeof window.handyClicksPrefs != "object" || typeof window.handyClicksCustomTypes != "object") {
			this.loadSettingsBackup();
			return;
		}
		var vers = this.currentVersion;
		if(vers < this.version) {
			this.convertSetsFormat(vers);
			this.saveSettingsObjects();
		}
		this._restoringCounter = 0;
		if(window.location.href.indexOf("chrome://browser/content/browser.xul") != 0)
			return;
		this.loadCystomTypes();
		this.initCustomFuncs();
	},
	loadSettingsBackup: function() {
		var pFile = this.prefsFile;
		this._cPath = this.moveFiles(pFile, "-corrupted-") || this._cPath;
		if(this._restoringCounter <= this.backupDepth) {
			var bName = this.prefsFileName + "-backup-" + this._restoringCounter + ".js";
			var bFile = this.getFile(bName);
			var hasBak = bFile.exists();
			if(!hasBak) {
				this._restoringCounter++;
				this.loadSettingsBackup();
				return;
			}
			else {
				bFile.copyTo(null, this.prefsFileName + ".js");
				this.moveFiles(bFile, "-restored-");
			}
			this.ut.alertEx(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("badJSFile").replace("%f", this._cPath)
					+ (hasBak ? this.ut.getLocalized("restoredFromBackup").replace("%b", bFile.path) : "")
			);
			this._restoringCounter++;
		}
		this.loadSettings();
	},
	convertSetsFormat: function(vers) {
		this.prefsFile.moveTo(null, this.prefsFileName + "-version-" + vers + ".js");
		if(vers < 0.11) { // "closePopups" instead of "hidePopup" in arguments
			//= Expires after 2009.08.20
			var p = handyClicksPrefs;
			var sh, so, type, to, pName, pVal;
			for(sh in p) {
				if(!p.hasOwnProperty(sh) || !this.isOkShortcut(sh))
					continue;
				so = p[sh];
				if(typeof so != "object")
					continue;
				for(type in so) {
					if(!so.hasOwnProperty(type))
						continue;
					to = so[type];
					if(typeof to != "object")
						continue;
					for(pName in to) {
						if(!to.hasOwnProperty(pName) || pName != "arguments")
							continue;
						pVal = to[pName];
						if(pVal.hasOwnProperty("hidePopup")) {
							pVal.closePopups = !!pVal.hidePopup;
							delete pVal.hidePopup;
						}
					}
				}
			}
		}
		this.ut._log("Format of prefs file updated: " + vers + " => " + this.version);
	},
	loadCystomTypes: function() {
		var cts = handyClicksCustomTypes, ct;
		var df, cm;
		for(var type in cts) {
			if(!cts.hasOwnProperty(type))
				continue;
			if(!this.isOkCustomType(type)) {
				this.ut._err(this.ut.errPrefix + "Invalid custom type: " + type);
				continue;
			}
			ct = cts[type];
			if(!ct.enabled)
				continue;
			try {
				df = cts[type].define;
				cm = cts[type].contextMenu;
				ct._define = new Function("event,item", this.dec(df));
				ct._contextMenu = cm ? new Function("event,item,origItem", this.dec(cm)) : null;
				ct._initialized = true;
			}
			catch(e) {
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					this.ut.getLocalized("customTypeCompileError")
						.replace("%l", this.dec(ct.label))
						.replace("%id", type)
						.replace("%e", e)
					+ this.ut.getLocalized("openConsole"),
					toErrorConsole
				);
				this.ut._err(this.ut.errPrefix + "Error in custom type " + type);
				this.ut._err(e);
			}
		}
	},
	initCustomFuncs: function() {
		this.ut.timer("initCustomFuncs"); //~ temp
		var p = handyClicksPrefs;
		var sh, so, type, to, da;
		var errors = [];
		for(sh in p) {
			if(!p.hasOwnProperty(sh) || !this.isOkShortcut(sh))
				continue;
			so = p[sh];
			if(typeof so != "object")
				continue;
			for(type in so) {
				if(!so.hasOwnProperty(type))
					continue;
				to = so[type];
				if(!this.ut.getOwnProperty(to, "enabled") || !this.ut.getOwnProperty(to, "custom"))
					continue;
				this.initCustomFunc(this.ut.getOwnProperty(to, "init"), errors);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(!da)
					continue;
				if(!this.ut.getOwnProperty(da, "enabled") || !this.ut.getOwnProperty(da, "custom"))
					continue;
				this.initCustomFunc(this.ut.getOwnProperty(da, "init"), errors);
			}
		}
		this.ut.timer("initCustomFuncs"); //~ temp
		if(!errors.length)
			return;
		//~ todo
	},
	initCustomFunc: function(rawCode, errors) {
		if(!rawCode)
			return null;
		try {
			new Function(this.dec(rawCode)).call(this.ut);
		}
		catch(e) {
			errors.push(e);
			this.ut._err(e);
			return e;
		}
		return null;
	},
	saveSettingsObjects: function(reloadAll) {
 		var res = this.warnComment + this.versionInfo;
		var sh, so, type, to, pName, pVal, dName;
		var forcedDisByType = { __proto__: null };
		var forcedDis;

		res += "var handyClicksCustomTypes = {\n";
		var cts = handyClicksCustomTypes;
		this.sortObj(cts);
		for(type in cts) {
			if(!cts.hasOwnProperty(type) || type.indexOf("custom_") != 0)
				continue;
			to = cts[type];
			if(typeof to != "object")
				continue;
			res += "\t" + this.fixPropName(type) + ": {\n";
			for(pName in to) {
				if(!to.hasOwnProperty(pName) || pName.indexOf("_") == 0)
					continue;
				pVal = to[pName];
				res += "\t\t" + pName + ": " + this.objToSource(pVal) + ",\n";
				if(pName == "enabled" && pVal == false)
					forcedDisByType[type] = true;
			}
			res = this.delLastComma(res) + "\t},\n";
		}
		res = this.delLastComma(res) + "};\n";

		res += "var handyClicksPrefs = {\n";
		var p = handyClicksPrefs;
		this.sortObj(p);
		for(sh in p) {
			if(!p.hasOwnProperty(sh) || !this.isOkShortcut(sh))
				continue;
			so = p[sh];
			if(!this.sortObj(so))
				continue;
			res += '\t"' + sh + '": {\n';
			forcedDis = this.ut.getOwnProperty(p, sh, "$all", "enabled") == true;
			for(type in so) {
				if(!so.hasOwnProperty(type))
					continue;
				to = so[type];
				if(typeof to != "object")
					continue;
				res += "\t\t" + this.fixPropName(type) + ": {\n";
				for(pName in to) {
					if(!to.hasOwnProperty(pName))
						continue;
					pVal = to[pName];
					if(
						pName == "enabled"
						&& (
							type in forcedDisByType
							|| (type != "$all" && forcedDis)
						)
					)
						pVal = false;
					if(pName == "delayedAction") {
						if(typeof pVal != "object")
							continue;
						res += "\t\t\t" + pName + ": {\n";
						for(dName in pVal) {
							if(pVal.hasOwnProperty(dName))
								res += "\t\t\t\t" + this.fixPropName(dName) + ": " + this.objToSource(pVal[dName]) + ",\n";
						}
						res = this.delLastComma(res) + "\t\t\t},\n";
					}
					else
						res += "\t\t\t" + this.fixPropName(pName) + ": " + this.objToSource(pVal) + ",\n";
				}
				res = this.delLastComma(res) + "\t\t},\n";
			}
			res = this.delLastComma(res) + "\t},\n";
		}
		res = this.delLastComma(res) + "};";

		this.saveSettings(res);
		this.reloadSettings(reloadAll);
	},
	objToSource: function(obj) {
		return uneval(obj).replace(/^\(|\)$/g, "");
	},
	fixPropName: function(pName) {
		var o = {}; o[pName] = true;
		return /'|"/.test(uneval(o)) ? '"' + pName + '"' : pName;
	},
	delLastComma: function(str) {
		return str.replace(/,\n$/, "\n");
	},
	sortObj: function(obj) {
		if(!this.ut.isObject(obj))
			return false;
		var arr = [], ex = {}, p;
		for(p in obj) {
			if(!obj.hasOwnProperty(p))
				continue;
			arr.push(p);
			ex[p] = obj[p];
			delete obj[p];
		}
		arr.sort().forEach(
			function(p) { obj[p] = ex[p]; }
		);
		return true;
	},
	reloadSettings: function(reloadAll) {
		var wm = this.wu.wm;
		var pSvc = "handyClicksPrefSvc";
		["navigator:browser", "handyclicks:settings", "handyclicks:editor"].forEach(
			function(winType) {
				var ws = wm.getEnumerator(winType), w;
				while(ws.hasMoreElements()) {
					w = ws.getNext();
					if(!(pSvc in w) || (!reloadAll && w === window))
						continue;
					w[pSvc].loadSettings();
					w[pSvc].notifyObservers();
				}
			}
		);
	},
	moveFiles: function(mFile, nAdd, maxNum) {
		maxNum = typeof maxNum == "number" ? maxNum : this.backupDepth;
		if(maxNum < 0)
			return null;
		if(!mFile.exists())
			return null;
		var fName = this.prefsFileName + nAdd;
		var pDir = this.prefsDir;
		var file;
		while(--maxNum >= 0) {
			file = this.getFile(fName + maxNum + ".js");
			if(file.exists())
				file.moveTo(pDir, fName + (maxNum + 1) + ".js");
		}
		mFile = mFile.clone();
		mFile.moveTo(pDir, fName + "0.js");
		return mFile.path;
	},
	_savedStr: null,
	saveSettings: function(str) {
		if(str == this._savedStr)
			return;
		var pFile = this.prefsFile;
		this.moveFiles(pFile, "-backup-");
		this.writeToFile(str, pFile);
		this._savedStr = str;
	},
	writeToFile: function(str, file) {
		var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		stream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		stream.write(str, str.length);
		stream.close();
	},

	isOkShortcut: function(s) {
		return s && this.okShortcut.test(s);
	},
	isOkFuncObj: function(fObj) {
		return typeof fObj == "object"
			&& typeof fObj.enabled == "boolean"
			&& typeof fObj.eventType == "string"
			&& typeof fObj.action == "string";
	},
	isOkCustomType: function(cType) {
		var cts = handyClicksCustomTypes;
		if(!cts.hasOwnProperty(cType))
			return false;
		var ct = cts[cType];
		return typeof ct == "object"
			&& ct.hasOwnProperty("enabled")
			&& ct.hasOwnProperty("define")
			&& typeof ct.define == "string"
			&& ct.hasOwnProperty("contextMenu");
	},
	enc: function(s) {
		return encodeURIComponent(s || "");
	},
	dec: function(s) {
		try {
			return decodeURIComponent(s || "");
		}
		catch(e) {
			this.ut._err(this.ut.errPrefix + "Can't decode: " + s + "\n" + e);
			return "[invalid value]";
		}
	},
	getButtonStr: function(sh, _short) {
		return /button=([0-2])/.test(sh) ? "button" + RegExp.$1 + (_short ? "short" : "") : "?";
	},
	getLocaleButtonStr: function(sh, _short) {
		return this.ut.getLocalized(this.getButtonStr(sh, _short));
	},
	getModifiersStr: function(sh) {
		sh = sh
			.replace(/^button=[0-2],|,?[a-z]+=false/g, "")
			.replace(/([a-z])([a-z]+)=true/g, function($0, $1, $2) { return $1.toUpperCase() + $2 })
			.replace(/^,|,$/g, "")
			.replace(/,/g, "+");
		return sh ? sh : this.ut.getLocalized("none");
	}
};
handyClicksPrefSvc.loadSettings();
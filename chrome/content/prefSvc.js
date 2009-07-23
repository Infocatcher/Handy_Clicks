var handyClicksPrefSvc = {
	__proto__: handyClicksObservers, // Add observers interface
	observers: [],

	ut: handyClicksUtils, // shortcut

	version: 0.11,
	get currentVersion() {
		return "handyClicksPrefsVersion" in window ? handyClicksPrefsVersion : 0;
	},
	backupDepth: 4,
	warnComment: "// Preferences of Handy Clicks extension\n// Do not edit this file.\n\n",
	get versionInfo() {
		delete this.versionInfo;
		return this.versionInfo = "var handyClicksPrefsVersion = " + this.version + ";\n";
	},
	defaultPrefs: "var handyClicksCustomTypes = {};\nvar handyClicksPrefs = {};",
	prefsDirName: "handyclicks",
	prefsFileName: "handyclicks_prefs",
	okShortcut: /^button=[0-2],ctrl=(?:true|false),shift=(?:true|false),alt=(?:true|false),meta=(?:true|false)$/,
	_doNotReload: false,
	_isReloader: false,
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
		if(window.location.href.indexOf("chrome://browser/content/browser.xul") == 0)
			this.loadCystomTypes();
		this._restoringCounter = 0;
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
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("badJSFile").replace("%f", this._cPath)
					+ (hasBak ? this.ut.getLocalised("restoredFromBackup").replace("%b", bFile.path) : "")
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
					this.ut.getLocalised("errorTitle"),
					this.ut.getLocalised("customTypeCompileError")
						.replace("%l", this.dec(ct.label))
						.replace("%id", type)
						.replace("%e", e)
					+ this.ut.getLocalised("openConsole"),
					toErrorConsole
				);
				this.ut._err(this.ut.errPrefix + "Error in custom type " + type);
				this.ut._err(e);
			}
		}
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
			forcedDis = this.ut.getProperty(p, sh, "$all", "enabled") == true;
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
		var o = {}; o[pName] = 0;
		return /'|"/.test(uneval(o)) ? '"' + pName + '"' : pName;
	},
	delLastComma: function(str) {
		return str.replace(/,\n$/, "\n");
	},
	sortObj: function(obj) {
		if(typeof obj != "object")
			return false;
		var tmp = [];
		var p;
		var res = {};
		for(p in obj)
			if(obj.hasOwnProperty(p)) {
				tmp.push(p);
				res[p] = obj[p];
				delete obj[p];
			}
		tmp.sort();
		for(var i = 0, len = tmp.length; i < len; i++) {
			p = tmp[i];
			obj[p] = res[p];
		}
		return true;
	},
	reloadSettings: function(reloadAll) {
		this._doNotReload = reloadAll ? false : true;
		this._isReloader = true;

		var wTypes = ["navigator:browser", "handyclicks:settings", "handyclicks:editor"];
		var wm = handyClicksWinUtils.wm;
		var ws, w;
		for(var i = 0, len = wTypes.length; i < len; i++) {
			ws = wm.getEnumerator(wTypes[i]);
			while(ws.hasMoreElements()) {
				w = ws.getNext();
				if("handyClicksPrefSvc" in w && !w.handyClicksPrefSvc._doNotReload) {
					w.handyClicksPrefSvc.loadSettings();
					w.handyClicksPrefSvc.notifyObservers();
				}
			}
		}

		this._doNotReload = false;
		this._isReloader = false;
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
	getButtonStr: function(sh, short) {
		return /button=([0-2])/.test(sh) ? "button" + RegExp.$1 + (short ? "short" : "") : "?";
	},
	getLocaleButtonStr: function(sh, short) {
		return this.ut.getLocalised(this.getButtonStr(sh, short));
	},
	getModifiersStr: function(sh) {
		sh = sh
			.replace(/^button=[0-2],|,?[a-z]+=false/g, "")
			.replace(/([a-z])([a-z]+)=true/g, function($0, $1, $2) { return $1.toUpperCase() + $2 })
			.replace(/^,|,$/g, "")
			.replace(/,/g, "+");
		return sh ? sh : this.ut.getLocalised("none");
	}
};
handyClicksPrefSvc.loadSettings();
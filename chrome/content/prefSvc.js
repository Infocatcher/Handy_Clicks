var handyClicksPrefSvc = {
	version: 0.12,
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
	names: {
		backup: "_backup-",
		corrupted: "_corrupted-",
		restored: "_restored-",
		version: "_version-",
		beforeImport: "_before_import-"
	},

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
				catch(e) { this.ut._err(new Error("Can't create directory\n" + e)); }
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
			this.ut._err(new Error("Error in prefs: bad js file"));
			this.ut._err(e);
			this.loadSettingsBackup();
			return;
		}
		if(
			!("handyClicksPrefs" in window) || !this.ut.isObject(handyClicksPrefs)
			|| !("handyClicksCustomTypes" in window) || !this.ut.isObject(handyClicksCustomTypes)
		) {
			this.loadSettingsBackup();
			return;
		}
		this.prefs = handyClicksPrefs;
		this.types = handyClicksCustomTypes;
		var vers = this.currentVersion;
		if(vers < this.version) {
			this.convertSetsFormat(vers);
			this.saveSettingsObjects();
		}
		this._restoringCounter = 0;
		if(window.location.href.indexOf("chrome://browser/content/browser.xul") != 0)
			return;
		this.compileCystomTypes();
		this.initCustomFuncs();
	},
	loadSettingsBackup: function() {
		var pFile = this.prefsFile;
		this._cPath = this.moveFiles(pFile, this.names.corrupted) || this._cPath;
		if(this._restoringCounter <= this.backupDepth) {
			var bName = this.prefsFileName + this.names.backup + this._restoringCounter + ".js";
			var bFile = this.getFile(bName);
			var hasBak = bFile.exists();
			if(!hasBak) {
				this._restoringCounter++;
				this.loadSettingsBackup();
				return;
			}
			else {
				bFile.copyTo(null, this.prefsFileName + ".js");
				this.moveFiles(bFile, this.names.restored);
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
		this.prefsFile.moveTo(null, this.prefsFileName + this.names.version + vers + ".js");
		if(vers < 0.11) { // "closePopups" instead of "hidePopup" in arguments
			//= Expires after 2009.08.30
			var p = this.prefs;
			var sh, so, type, to, pName, pVal;
			for(sh in p) if(p.hasOwnProperty(sh)) {
				if(!this.isOkShortcut(sh))
					continue;
				so = p[sh];
				if(typeof so != "object")
					continue;
				for(type in so) if(so.hasOwnProperty(type)) {
					to = so[type];
					if(typeof to != "object")
						continue;
					for(pName in to) if(to.hasOwnProperty(pName)) {
						if(pName != "arguments")
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
		if(vers < 0.12) { // New file names format
			//= Expires after 2009.09.10
			var convertName = function(s) {
				return s.replace(/^(handyclicks_prefs)-(\w+-\d+(?:\.\d+)?\.js)$/, "$1_$2");
			};
			var entries = this.prefsDir.directoryEntries;
			var entry, newName;
			while(entries.hasMoreElements()) {
				entry = entries.getNext();
				entry.QueryInterface(Components.interfaces.nsIFile);
				if(!entry.isFile())
					continue;
				newName = convertName(entry.leafName);
				if(newName != entry.leafName)
					entry.moveTo(null, newName);
			}
		}
		this.ut._log("Format of prefs file updated: " + vers + " => " + this.version);
	},
	compileCystomTypes: function() {
		var cts = this.types, ct;
		var df, cm;
		for(var type in cts) if(cts.hasOwnProperty(type)) {
			if(!this.isOkCustomType(type)) {
				this.ut._err(new Error("Invalid custom type: " + type), true);
				continue;
			}
			ct = cts[type];
			if(!ct.enabled)
				continue;
			try {
				df = cts[type].define;
				cm = cts[type].contextMenu;
				ct._defineLine = new Error().lineNumber + 1;
				ct._define = new Function("event,item", this.dec(df));
				ct._contextMenuLine = new Error().lineNumber + 1;
				ct._contextMenu = cm ? new Function("event,item,origItem", this.dec(cm)) : null;
				ct._initialized = true;
			}
			catch(e) {
				var line = ct._contextMenuLine || ct._defineLine;
				this.ut._log("[type compile] Line: " + (e.lineNumber - line + 1));
				var eLine = this.ut.mmLine(e.lineNumber - line + 1);
				var href = "handyclicks://editor/itemType/" + type + "/" + ("_contextMenuLine" in ct ? "context" : "define");
				var eMsg = this.ut.getLocalized("customTypeCompileError")
					+ this.ut.getLocalized("errorDetails")
						.replace("%l", this.dec(ct.label))
						.replace("%id", type)
						.replace("%e", e);
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					eMsg + this.ut.getLocalized("openConsole"),
					this.ut.console, this.wu.getOpenLink(href, eLine),
					true, true
				);
				this.ut._err(new Error(eMsg), false, href, eLine);
				this.ut._err(e);
			}
		}
	},
	initCustomFuncs: function() {
		var p = this.prefs;
		var sh, so, type, to, da;
		for(sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = p[sh];
			if(typeof so != "object")
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.isOkFuncObj(to) || !to.enabled || !this.ut.getOwnProperty(to, "custom"))
					continue;
				this.initCustomFunc(this.ut.getOwnProperty(to, "init"), to, sh, type, false);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(!this.isOkFuncObj(da) || !da.enabled || !this.ut.getOwnProperty(da, "custom"))
					continue;
				this.initCustomFunc(this.ut.getOwnProperty(da, "init"), da, sh, type, true);
			}
		}
	},
	initCustomFunc: function(rawCode, fObj, sh, type, delayed) {
		if(!rawCode)
			return;
		try {
			var line = new Error().lineNumber + 1;
			new Function(this.dec(rawCode)).call(this.ut);
		}
		catch(e) {
			this.ut._log("[func init] Line: " + (e.lineNumber - line + 1));
			var eLine = this.ut.mmLine(e.lineNumber - line + 1);
			var href = "handyclicks://editor/shortcut/" + sh + "/" + type + "/" + (delayed ? "delayed" : "normal") + "/init";
			var eMsg = this.ut.getLocalized("funcInitError")
				+ this.ut.getLocalized("errorDetails")
					.replace("%l", this.dec(fObj.label))
					.replace("%id", type)
					.replace("%e", e);
			this.ut.notify(
				this.ut.getLocalized("errorTitle"),
				eMsg + this.ut.getLocalized("openConsole"),
				this.ut.console, this.wu.getOpenLink(href, eLine),
				true, true
			);
			this.ut._err(eMsg, false, href, eLine);
			this.ut._err(e);
		}
	},
	saveSettingsObjects: function(reloadAll) {
 		var res = this.warnComment + this.versionInfo;
		var sh, so, type, to, pName, pVal, dName;
		var forcedDisByType = { __proto__: null };
		var forcedDis;

		res += "var handyClicksCustomTypes = {\n";
		var cts = this.types;
		this.sortObj(cts);
		for(type in cts) if(cts.hasOwnProperty(type)) {
			if(type.indexOf("custom_") != 0)
				continue;
			to = cts[type];
			if(typeof to != "object")
				continue;
			res += "\t" + this.fixPropName(type) + ": {\n";
			for(pName in to) if(to.hasOwnProperty(pName)) {
				if(pName.indexOf("_") == 0)
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
		var p = this.prefs;
		this.sortObj(p);
		for(sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = p[sh];
			if(!this.sortObj(so))
				continue;
			res += '\t"' + sh + '": {\n';
			forcedDis = this.ut.getOwnProperty(p, sh, "$all", "enabled") == true;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(typeof to != "object")
					continue;
				res += "\t\t" + this.fixPropName(type) + ": {\n";
				for(pName in to) if(to.hasOwnProperty(pName)) {
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
						for(dName in pVal) if(pVal.hasOwnProperty(dName))
								res += "\t\t\t\t" + this.fixPropName(dName) + ": " + this.objToSource(pVal[dName]) + ",\n";
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
		for(p in obj) if(obj.hasOwnProperty(p)) {
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
		var pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			["navigator:browser", "handyclicks:settings", "handyclicks:editor"],
			function(w) {
				if(!(pSvc in w) || (!reloadAll && w === window))
					return;
				w[pSvc].loadSettings();
				w[pSvc].notifyObservers();
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
	__savedStr: null,
	get _savedStr() {
		return this.__savedStr;
	},
	set _savedStr(str) {
		var pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			["handyclicks:settings", "handyclicks:editor"],
			function(w) {
				if(pSvc in w)
					w[pSvc].__savedStr = str;
			}
		);
	},
	saveSettings: function(str) {
		if(str == this._savedStr)
			return;
		var pFile = this.prefsFile;
		this.moveFiles(pFile, this.names.backup);
		this.writeToFile(str, pFile);
		this._savedStr = str;
	},
	writeToFile: function(str, file) { // Write as ANSI (mozIJSSubScriptLoader can't read non-ASCII characters)
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		fos.write(str, str.length);
		fos.close();
	},

	isOkShortcut: function(s) {
		return s && this.okShortcut.test(s);
	},
	isOkFuncObj: function(fObj) {
		return typeof fObj == "object"
			&& fObj !== null
			&& "hasOwnProperty" in fObj
			&& fObj.hasOwnProperty("enabled")
			&& typeof fObj.enabled == "boolean"
			&& fObj.hasOwnProperty("eventType")
			&& typeof fObj.eventType == "string"
			&& fObj.hasOwnProperty("action")
			&& typeof fObj.action == "string";
	},
	isOkCustomType: function(cType) {
		var cts = this.types;
		if(!("hasOwnProperty" in cts) || !cts.hasOwnProperty(cType))
			return false;
		var ct = cts[cType];
		return typeof ct == "object"
			&& ct !== null
			&& "hasOwnProperty" in ct
			&& ct.hasOwnProperty("enabled")
			&& typeof ct.enabled == "boolean"
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
			this.ut._err(new Error("Can't decode: " + s));
			this.ut._err(e);
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
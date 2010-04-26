var handyClicksPrefSvc = {
	oSvc: new HandyClicksObservers(),

	version: 0.14,
	prefsHeader: "// Preferences of Handy Clicks extension.\n// Do not edit.\n",
	get requiredHeader() {
		delete this.requiredHeader;
		return this.requiredHeader = this.prefsHeader.match(/^([^\n]+?)\.?\n/)[1];
	},
	get versionInfo() {
		delete this.versionInfo;
		return this.versionInfo = "var handyClicksPrefsVersion = " + this.version + ";\n";
	},
	prefsDirName: "handyclicks",
	prefsFileName: "handyclicks_prefs",
	names: {
		backup: "_backup-",
		corrupted: "_corrupted-",
		restored: "_restored-",
		version: "_version-",
		beforeImport: "_before_import-",
		userBackup: "_user_backup-",
		testBackup: "_test_backup-"
	},
	okShortcut: /^button=[0-2],ctrl=(?:true|false),shift=(?:true|false),alt=(?:true|false),meta=(?:true|false)$/,

	otherSrc: false,
	_restoringCounter: 0,

	get _profileDir() {
		delete this._profileDir;
		return this._profileDir = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsILocalFile);
	},
	get profileDir() {
		return this._profileDir.clone();
	},
	get _prefsDir() {
		var dir = this.profileDir;
		dir.append(this.prefsDirName);
		if(!dir.exists()) {
			try {
				dir.create(dir.DIRECTORY_TYPE, 0755);
			}
			catch(e) {
				this.ut._err(new Error("Can't create directory\n" + e));
			}
		}
		delete this._prefsDir;
		return this._prefsDir = dir;
	},
	get prefsDir() {
		return this._prefsDir.clone();
	},
	getFile: function(fName) {
		var file = this.prefsDir;
		file.append(fName);
		return file;
	},
	get _prefsFile() {
		delete this._prefsFile;
		return this._prefsFile = this.getFile(this.prefsFileName + ".js");
	},
	get prefsFile() {
		return this._prefsFile.clone();
	},

	_prefVars: {
		currentVersion: "handyClicksPrefsVersion",
		types: "handyClicksCustomTypes",
		prefs: "handyClicksPrefs",
		__proto__: null
	},
	get currentSrc() {
		if(!this.otherSrc)
			return null;
		var ret = {};
		for(var p in this._prefVars)
			ret[this._prefVars[p]] = this[p];
		return ret;
	},
	importSrc: function(tar, src) {
		for(var p in this._prefVars)
			tar[p] = this.ut.getOwnProperty(src, this._prefVars[p]);
	},
	_loadError: 0,
	_skippedLoad: false,
	loadSettings: function(pSrc) {
		if(this.isMainWnd) {
			if(!this.hc.enabled) {
				this._devMode && this.ut._log("loadSettings() -> disabled");
				this._skippedLoad = true;
				return;
			}
			this._skippedLoad = false;
			this._devMode && this.ut._log("loadSettings()");
		}
		this.otherSrc = !!pSrc;
		this._loadError = 0;
		pSrc = pSrc || this.prefsFile;
		var fromProfile = false;
		if(pSrc instanceof Components.interfaces.nsILocalFile) {
			fromProfile = pSrc.equals(this._prefsFile);
			if(fromProfile && !pSrc.exists()) // Save default (empty) settings
				this.saveSettings(this.getSettingsStr({}, {}));
			pSrc = this.ut.readFromFile(pSrc);
			if(fromProfile && !this.isMainWnd)
				this._savedStr = pSrc;
		}
		if(typeof pSrc == "string") {
			// Uses sandbox instead mozIJSSubScriptLoader for security purposes
			var sandbox = new Components.utils.Sandbox("about:blank");
			try {
				Components.utils.evalInSandbox(pSrc, sandbox);
			}
			catch(e) {
				this._loadError = 1;
				this.ut._err(new Error("Invalid prefs: evalInSandbox() failed"));
				this.ut._err(e);
				if(this.otherSrc) {
					this.ut.alertEx(
						this.ut.getLocalized("errorTitle"),
						this.ut.getLocalized("invalidConfigFormat")
					);
					return;
				}
				this.loadSettingsBackup();
				return;
			}
		}
		else
			var sandbox = pSrc;

		var tmp = {};
		this.importSrc(tmp, sandbox);

		if(!this.ut.isObject(tmp.prefs) || !this.ut.isObject(tmp.types)) {
			this._loadError = 2;
			this.ut._err(new Error("Loaded prefs or types is not object"));
			if(this.otherSrc) {
				this.ut.alertEx(
					this.ut.getLocalized("errorTitle"),
					this.ut.getLocalized("invalidConfigFormat")
				);
				return;
			}
			this.loadSettingsBackup();
			return;
		}
		this.importSrc(this, sandbox);

		var vers = this.currentVersion = this.currentVersion || 0;
		if(vers < this.version)
			this.convertSetsFormat(vers, fromProfile);
		this._restoringCounter = 0;
		if(this.isMainWnd) {
			this.compileCystomTypes();
			this.initCustomFuncs();
		}
	},
	loadSettingsBackup: function() {
		var pFile = this.prefsFile;
		this._cPath = this.moveFiles(pFile, this.names.corrupted) || this._cPath;
		if(this._restoringCounter < this.pu.pref("sets.backupDepth")) {
			var bName = this.prefsFileName + this.names.backup + this._restoringCounter + ".js";
			var bFile = this.getFile(bName);
			var hasBak = bFile.exists();
			if(!hasBak) {
				this._restoringCounter++;
				this.loadSettingsBackup();
				return;
			}
			bFile.copyTo(null, this.prefsFileName + ".js");
			this.moveFiles(bFile, this.names.restored);

			var errTitle = this.ut.getLocalized("errorTitle");
			var errMsg = this.ut.getLocalized("badJSFile").replace("%f", this._cPath)
				+ (hasBak ? this.ut.getLocalized("restoredFromBackup").replace("%b", bFile.path) : "");
			setTimeout(function(_this, t, m) {
				_this.ut.alertEx(t, m);
			}, 0, this, errTitle, errMsg);

			this._restoringCounter++;
		}
		this.loadSettings();
	},
	convertSetsFormat: function(vers, allowSave) {
		if(allowSave)
			this.prefsFile.moveTo(null, this.prefsFileName + this.names.version + vers + ".js");
		if(vers < 0.12) { // New file names format
			//= Expires after 2009-09-15
			var convertName = function(s) {
				return s.replace(/^(handyclicks_prefs)-(\w+-\d+(?:\.\d+)?\.js)$/, "$1_$2");
			};
			var entries = this.prefsDir.directoryEntries;
			var entry, newName;
			while(entries.hasMoreElements()) {
				entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
				if(!entry.isFile())
					continue;
				newName = convertName(entry.leafName);
				if(newName != entry.leafName)
					entry.moveTo(null, newName);
			}
		}
		if(vers < 0.13) {
			//= [Not critical]
			// Arguments:
			//   "hidePopup" -> "closePopups" (old)
			//   "inWin"     -> "winRestriction"
			//   "toNewWin"  -> "target"
			// Functions:
			//   submitFormToNewDoc -> submitForm
			//= Expires after 2009-09-15
			function changeArg(args, curName, newName, valConv) {
				var a = {}, aName;
				for(aName in args) if(args.hasOwnProperty(aName)) {
					a[aName] = args[aName];
					delete args[aName];
				}
				var aVal;
				for(aName in a) if(a.hasOwnProperty(aName)) {
					aVal = a[aName];
					if(aName == curName)
						args[newName] = valConv ? valConv(aVal) : aVal;
					else
						args[aName] = aVal;
				}
			}
			var p = this.prefs;
			var sh, so, type, to, pName, pVal;
			for(sh in p) if(p.hasOwnProperty(sh)) {
				if(!this.isOkShortcut(sh))
					continue;
				so = p[sh];
				if(!this.ut.isObject(so))
					continue;
				for(type in so) if(so.hasOwnProperty(type)) {
					to = so[type];
					if(!this.ut.isObject(to))
						continue;
					for(pName in to) if(to.hasOwnProperty(pName)) {
						pVal = to[pName];
						if(pName == "action") {
							if(pVal == "submitFormToNewDoc")
								to.action = "submitForm";
							else if(pVal == "openUriInWindow")
								try { delete to.arguments.loadJSInBackground; } catch(e) {}
						}
						if(pName != "arguments")
							continue;
						if(pVal.hasOwnProperty("hidePopup"))
							changeArg(pVal, "hidePopup", "closePopups");
						if(pVal.hasOwnProperty("inWin"))
							changeArg(pVal, "inWin", "winRestriction");
						if(pVal.hasOwnProperty("toNewWin"))
							changeArg(pVal, "toNewWin", "target", function(v) { return v ? "win" : "tab"; });
					}
				}
			}
		}
		if(vers < 0.14) {
			//= [Not critical]
			// Functions:
			//   openIn => openURIIn
			//   openUriIn => openURIIn
			//= Expires after 2010-05-20
			var p = this.prefs;
			var sh, so, type, to;
			var act;
			for(sh in p) if(p.hasOwnProperty(sh)) {
				if(!this.isOkShortcut(sh))
					continue;
				so = p[sh];
				if(!this.ut.isObject(so))
					continue;
				for(type in so) if(so.hasOwnProperty(type)) {
					to = so[type];
					if(!this.ut.isObject(to))
						continue;
					act = this.ut.getOwnProperty(to, "action");
					if(act)
						to.action = act // openIn => openURIIn, openUriIn => openURIIn
							.replace(/^(_?)open(?:Uri)?In/, "$1openURIIn");
				}
			}
		}
		this.ut._log("Format of prefs file updated: " + vers + " => " + this.version);
		if(allowSave)
			this.saveSettingsObjects();
	},
	compileCystomTypes: function() {
		var cts = this.types, ct;
		var df, cm;
		for(var type in cts) if(cts.hasOwnProperty(type)) {
			if(!this.isOkCustomType(type)) {
				this.ut._warn(new Error("Invalid custom type: " + type));
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
				var eLine = this.ut.mmLine(this.ut.getProperty(e, "lineNumber") - line + 1);
				var href = this.wu.PROTOCOL_EDITOR_ITEM_TYPE + type + "/"
					+ ("_contextMenuLine" in ct ? "context" : "define")
					+ "?line=" + eLine;
				var eMsg = this.ut.errInfo("customTypeCompileError", this.dec(ct.label), type, e);
				this.ut.notifyInWindowCorner(
					eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
					this.ut.getLocalized("errorTitle"),
					this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine)
				);
				this.ut._err(new Error(eMsg), href, eLine);
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
			if(!this.ut.isObject(so))
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
			var eLine = this.ut.mmLine(this.ut.getProperty(e, "lineNumber") - line + 1);
			var href = this.wu.PROTOCOL_EDITOR_SHORTCUT + sh + "/" + type + "/"
				+ (delayed ? "delayed" : "normal") + "/init"
				+ "?line=" + eLine;
			var eMsg = this.ut.errInfo("funcInitError", this.dec(fObj.label), type, e);
			this.ut.notifyInWindowCorner(
				eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
				this.ut.getLocalized("errorTitle"),
				this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine)
			);
			this.ut._err(eMsg, href, eLine);
			this.ut._err(e);
		}
	},
	getSettingsStr: function(types, prefs) {
		types = types || this.types;
		prefs = prefs || this.prefs;

		var res = this.versionInfo;
		var sh, so, type, to, pName, pVal, dName;
		var forcedDisByType = { __proto__: null };
		var forcedDis;

		res += "var handyClicksCustomTypes = {\n";
		this.sortObj(types);
		for(type in types) if(types.hasOwnProperty(type)) {
			if(!this.isCustomType(type))
				continue;
			to = types[type];
			if(!this.isOkCustomObj(to))
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
		this.sortObj(prefs);
		for(sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = prefs[sh];
			if(!this.sortObj(so))
				continue;
			res += '\t"' + sh + '": {\n';
			forcedDis = this.ut.getOwnProperty(so, "$all", "enabled") == true;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.isOkFuncObj(to))
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
						if(!this.isOkFuncObj(pVal))
							continue;
						if(to.eventType == "mousedown")
							pVal.enabled = false;
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

		const hashFunc = "SHA256";
		return this.prefsHeader
			+ "// " + hashFunc + ": " + this.getHash(res, hashFunc) + "\n"
			+ res;
	},
	saveSettingsObjects: function(reloadFlag) {
		this.saveSettings(this.getSettingsStr());
		this.reloadSettings(reloadFlag);
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
			function(p) {
				obj[p] = ex[p];
			}
		);
		return arr.length > 0;
	},
	getHash: function(str, hashFunc) {
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = "UTF-8";
		var result = {};
		var data = suc.convertToByteArray(str, result);
		var ch = Components.classes["@mozilla.org/security/hash;1"]
			.createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch[hashFunc]);
		ch.update(data, data.length);
		var hash = ch.finish(false);
		return Array.map(
			hash,
			function(chr) {
				return ("0" + chr.charCodeAt(0).toString(16)).slice(-2);
			}
		).join("");
	},
	reloadSettings: function(reloadAll) {
		const pSvc = "handyClicksPrefSvc";
		var curSrc = this.currentSrc;
		this.wu.forEachWindow(
			["navigator:browser", "handyclicks:settings", "handyclicks:editor"],
			function(w) {
				if(!(pSvc in w) || (!reloadAll && w === window))
					return;
				var p = w[pSvc];
				if(curSrc && !p.otherSrc) //~ ?
					return;
				p.loadSettings(curSrc);
				p.oSvc.notifyObservers();
			}
		);
	},

	testSettings: function() {
		var src = this.getSettingsStr();
		this.createTestBackup(src);

		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			"navigator:browser",
			function(w) {
				if(!(pSvc in w))
					return;
				var p = w[pSvc];
				p.loadSettings(src);
				p.oSvc.notifyObservers();
			}
		);
	},
	createTestBackup: function(pStr) {
		var num = this.pu.pref("sets.backupTestDepth") - 1;
		if(num < 0)
			return;
		var fName = this.prefsFileName + this.names.testBackup;
		var file, bakFile;
		var eal = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
			.getService(Components.interfaces.nsPIExternalAppLauncher);
		while(--num >= 0) {
			file = this.getFile(fName + num + ".js");
			if(num == 0)
				bakFile = file.clone();
			if(file.exists()) {
				file.moveTo(null, fName + (num + 1) + ".js");
				eal.deleteTemporaryFileOnExit(file);
			}
		}
		this.ut.writeToFile(pStr, bakFile);
		eal.deleteTemporaryFileOnExit(bakFile);

		this.ut.storage("testBackupCreated", true);
	},

	moveFiles: function(mFile, nAdd, depth, leaveOriginal) {
		depth = typeof depth == "number" ? depth : this.pu.pref("sets.backupDepth");
		if(depth <= 0 || !mFile.exists())
			return null;
		var num = depth - 1;
		var fName = this.prefsFileName + nAdd;
		var pDir = this.prefsDir;
		var file;
		while(--num >= 0) {
			file = this.getFile(fName + num + ".js");
			if(file.exists())
				file.moveTo(pDir, fName + (num + 1) + ".js");
		}
		mFile = mFile.clone();
		mFile[leaveOriginal ? "copyTo" : "moveTo"](pDir, fName + "0.js");
		return mFile.path;
	},
	__savedStr: null,
	get _savedStr() {
		return this.__savedStr;
	},
	set _savedStr(str) {
		const pSvc = "handyClicksPrefSvc";
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
		this.ut.writeToFile(str, pFile);
		this._savedStr = str;
	},

	get isMainWnd() {
		delete this.isMainWnd;
		return this.isMainWnd = "handyClicks" in window;
	},
	getEvtStr: function(e) {
		return "button=" + (e.button || 0)
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey;
	},
	isOkShortcut: function(s) {
		return s && this.okShortcut.test(s);
	},
	isOkFuncObj: function(fObj) {
		return this.ut.isObject(fObj)
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
		return this.isOkCustomObj(cts[cType]);
	},
	isOkCustomObj: function(ct) {
		return this.ut.isObject(ct)
			&& "hasOwnProperty" in ct
			&& ct.hasOwnProperty("enabled")
			&& typeof ct.enabled == "boolean"
			&& ct.hasOwnProperty("define")
			&& typeof ct.define == "string"
			&& ct.hasOwnProperty("contextMenu");
	},
	customPrefix: "custom_",
	customMask: /^custom_/,
	extPrefix: "ext_",
	isCustomType: function(type) {
		return typeof type == "string" && type.indexOf(this.customPrefix) == 0;
	},
	removeCustomPrefix: function(type) {
		return type.replace(this.customMask, "");
	},
	isExtType: function(type) {
		return typeof type == "string" && type.indexOf(this.extPrefix) == 0;
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
	getButtonId: function(sh, _short) {
		return /button=([0-2])/.test(sh) ? "button" + RegExp.$1 + (_short ? "short" : "") : "?";
	},
	getButtonStr: function(sh, _short) {
		return this.ut.getLocalized(this.getButtonId(sh, _short));
	},
	get keys() {
		delete this.keys;
		const src = "chrome://global-platform/locale/platformKeys.properties";
		return this.keys = {
			ctrl:  this.ut.getStr(src, "VK_CONTROL")         || "Ctrl",
			shift: this.ut.getStr(src, "VK_SHIFT")           || "Shift",
			alt:   this.ut.getStr(src, "VK_ALT")             || "Alt",
			meta:  this.ut.getStr(src, "VK_META")            || "Meta",
			sep:   this.ut.getStr(src, "MODIFIER_SEPARATOR") || "+",
			__proto__: null
		};
	},
	getModifiersStr: function(sh, _short) { // "button=0,ctrl=true,shift=true,alt=false,meta=false"
		var _this = this;
		sh = sh
			.replace(/[a-z]+=(?:false|\d),?/g, "")
			.replace(/,+$/g, "")
			.replace(/([a-z]+)=true/g, function($0, $1) { return _this.keys[$1]; })
			.replace(/,+/g, this.keys.sep);
		return sh || (_short ? "" : this.ut.getLocalized("none"));
	},
	getPrefsStr: function(str) {
		const add = this.wu.PROTOCOL_SETTINGS_ADD;
		return str.indexOf(add) == 0
			? this.dec(str.substr(add.length))
			: str;
	},
	_hashError: false,
	_hashMissing: false,
	checkPrefsStr: function(str) {
		this._hashError = false;
		this._hashMissing = true;
		str = this.getPrefsStr(str);
		if(str.indexOf(this.requiredHeader) != 0) // Support for old header
			return false;
		const hc = /^var handyClicks[\w$]+\s*=.*$/mg;
		if(!hc.test(str))
			return false;

		const hashRe = /(?:\r\n|\n|\r)\/\/[ \t]?(MD2|MD5|SHA1|SHA512|SHA256|SHA384):[ \t]?([a-f0-9]+)(?=[\n\r]|$)/;
		if(hashRe.test(str)) { // Added: 2009-12-18, todo: return false, if hash check failed
			this._hashMissing = false;
			var hashFunc = RegExp.$1;
			var hash = RegExp.$2;
			str = str.replace(hashRe, "");
			str = str.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/, ""); // Replace comments
			if(hash != this.getHash(str, hashFunc)) {
				this._hashError = true;
				return false;
			}
		}

		str = str.replace(hc, ""); // Replace handyClicks* vars
		str = str.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/, ""); // Replace comments
		if(/\/\/|\/\*|\*\//.test(str)) // No other comments
			return false;
		str = str.replace(/"[^"]*"/g, "_dummy_"); // Replace strings
		if(/\Wvar\s+/.test(str)) // No other vars
			return false;
		if(/['"()=]/.test(str))
			return false;
		if(/\W(?:[Ff]unction|eval|Components)\W/.test(str))
			return false;
		return true;
	}
};
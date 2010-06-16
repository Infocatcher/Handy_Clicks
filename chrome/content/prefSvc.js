var handyClicksPrefSvc = {
	oSvc: new HandyClicksObservers(),

	SETS_BEFORE_RELOAD: 1,
	SETS_RELOADED: 2,
	SETS_TEST: 4,
	SETS_TEST_UNDO: 8,

	DESTROY_REBUILD: 1,
	DESTROY_WINDOW_UNLOAD: 2,
	DESTROY_LAST_WINDOW_UNLOAD: 4,

	setsVersion: 0.2,
	setsHeader: "// Preferences of Handy Clicks extension.\n// Do not edit.\n",
	get requiredHeader() {
		delete this.requiredHeader;
		return this.requiredHeader = this.setsHeader.match(/^([^\n]+?)\.?\n/)[1];
	},
	get versionInfo() {
		delete this.versionInfo;
		return this.versionInfo = "var handyClicksPrefsVersion = " + this.setsVersion + ";\n";
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

	destroy: function(reloadFlag) {
		if(this.isMainWnd) {
			var reason;
			if(reloadFlag)
				reason = this.DESTROY_REBUILD;
			else {
				var count = 0;
				var ws = this.wu.wm.getEnumerator("navigator:browser");
				while(ws.hasMoreElements())
					if("_handyClicksInitialized" in ws.getNext()) // ?
						count++;
				reason = count == 0 ? this.DESTROY_LAST_WINDOW_UNLOAD : this.DESTROY_WINDOW_UNLOAD;
			}
			this.destroyCustomFuncs(reason);
		}
		this.oSvc.destroy();
	},

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
				this.ut._err(new Error("Can't create directory: " + dir.path));
				this.ut._err(e);
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
		loadedVersion: "handyClicksPrefsVersion",
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
					this.ut.alert(
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
				this.ut.alert(
					this.ut.getLocalized("errorTitle"),
					this.ut.getLocalized("invalidConfigFormat")
				);
				return;
			}
			this.loadSettingsBackup();
			return;
		}
		this.importSrc(this, sandbox);
		var vers = this.loadedVersion || 0;
		if(vers < this.setsVersion)
			this.setsMigration(fromProfile, vers);
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
				+ (hasBak ? this.ut.getLocalized("restoredFromBackup").replace("%f", bFile.path) : "");
			setTimeout(function(_this, t, m) {
				_this.ut.alert(t, m);
			}, 0, this, errTitle, errMsg);

			this._restoringCounter++;
		}
		this.loadSettings();
	},
	get setsMigration() { // function(allowSave, vers)
		var temp = {};
		this.rs.loadSubScript("chrome://handyclicks/content/convSets.js", temp);
		return temp.setsMigration;
	},

	compileCystomTypes: function() {
		var cts = this.types, ct;
		var df, cm;
		for(var type in cts) if(cts.hasOwnProperty(type)) {
			if(!this.isOkCustomType(type)) {
				this.ut._warn(new Error("Invalid custom type: \"" + type + "\""));
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
				var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
					+ ("_contextMenuLine" in ct ? this.ct.EDITOR_TYPE_CONTEXT : this.ct.EDITOR_TYPE_DEFINE)
					+ "?line=" + eLine;
				var eMsg = this.ut.errInfo("customTypeCompileError", this.dec(ct.label), type, e);
				this.ut.notifyInWindowCorner(
					eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
					this.ut.getLocalized("errorTitle"),
					this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
					this.ut.NOTIFY_ICON_ERROR
				);
				this.ut._err(eMsg, href, eLine);
				this.ut._err(e);
			}
		}
	},
	initCustomFuncs: function() {
		this.destroyCustomFuncs(this.DESTROY_REBUILD);
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
				this.initCustomFunc(to, sh, type, false);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(!this.isOkFuncObj(da) || !da.enabled || !this.ut.getOwnProperty(da, "custom"))
					continue;
				this.initCustomFunc(da, sh, type, true);
			}
		}
		this.cleanupDestructors();
	},
	initCustomFunc: function(fObj, sh, type, isDelayed) {
		var rawCode = this.ut.getOwnProperty(fObj, "init");
		if(!rawCode)
			return;
		try {
			var line = new Error().lineNumber + 2;
			this.saveDestructorContext(line, fObj, sh, type, isDelayed);
			var legacyDestructor = new Function(this.dec(rawCode)).call(this.ut);
		}
		catch(e) {
			this.handleCustomFuncError(e, line, fObj, sh, type, isDelayed, true);
		}
		if(typeof legacyDestructor == "function") { // Added: 2010-06-15
			this.ut._warn(new Error(
				"Construction \"return destructorFunction;\" is deprecated, use "
				+ "\"void handyClicksPrefSvc.registerDestructor"
				+ "(in function destructor, in object context, in unsigned long notifyFlags)\" "
				+ "instead"
			));
			this.registerDestructor(
				this.ut.bind(
					legacyDestructor,
					this.ut.getOwnProperty(legacyDestructor, "context"),
					this.ut.getOwnProperty(legacyDestructor, "args")
				),
				null,
				this.ut.getOwnProperty(legacyDestructor, "handleUnload") === false
					? this.DESTROY_REBUILD
					: 0
			);
		}
	},

	saveDestructorContext: function(baseLine, fObj, sh, type, isDelayed) {
		this._destructorContext = {
			baseLine: baseLine,
			funcObj: fObj,
			shortcut: sh,
			type: type,
			isDelayed: isDelayed
		};
	},
	cleanupDestructors: function() {
		delete this._destructorContext;
	},
	_destructors: [],
	registerDestructor: function(destructor, context, notifyFlags) {
		var dc = this._destructorContext;
		this._destructors.push([
			destructor,
			context,
			notifyFlags,
			dc.baseLine,
			dc.funcObj,
			dc.shortcut,
			dc.type,
			dc.isDelayed
		]);
	},

	destroyCustomFuncs: function(reason) {
		//this._devMode && this.ut._log("destroyCustomFuncs() [" + this._destructors.length + "]");
		this._destructors.forEach(
			function(destructorArr) {
				this.destroyCustomFunc.apply(this, destructorArr.concat(reason));
			},
			this
		);
		this._destructors = [];
	},
	destroyCustomFunc: function(destructor, context, notifyFlags, baseLine, fObj, sh, type, isDelayed, reason) {
		if(notifyFlags && !(notifyFlags & reason))
			return;
		try {
			destructor.call(context, reason);
		}
		catch(e) {
			this.handleCustomFuncError(e, baseLine, fObj, sh, type, isDelayed, false);
		}
	},
	handleCustomFuncError: function(e, baseLine, fObj, sh, type, isDelayed, isInit) {
		var eLine = this.ut.mmLine(this.ut.getProperty(e, "lineNumber") - baseLine + 1);
		var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_SHORTCUT + "/" + sh + "/" + type + "/"
			+ (isDelayed ? this.ct.EDITOR_SHORTCUT_DELAYED : this.ct.EDITOR_SHORTCUT_NORMAL) + "/"
			+ this.ct.EDITOR_SHORTCUT_INIT
			+ "?line=" + eLine;
		var eMsg = this.ut.errInfo(
			isInit ? "funcInitError" : "funcDestroyError",
			this.dec(this.ut.getOwnProperty(fObj, "label")),
			type, e
		);
		this.ut.notifyInWindowCorner(
			eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
			this.ut.getLocalized("errorTitle"),
			this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
			this.ut.NOTIFY_ICON_ERROR
		);
		this.ut._err(eMsg, href, eLine);
		this.ut._err(e);
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
				if(pName.charAt(0) == "_")
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
							|| forcedDis && type != "$all"
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
		return this.setsHeader
			+ "// " + hashFunc + ": " + this.getHash(res, hashFunc) + "\n"
			+ res;
	},
	saveSettingsObjects: function(reloadFlag) {
		this.saveSettings(this.getSettingsStr());
		this.reloadSettings(reloadFlag);
	},
	objToSource: function(obj) {
		return typeof obj == "string"
			? '"' + this.encForWrite(obj) + '"'
			: uneval(obj).replace(/^\(|\)$/g, "");
	},
	fixPropName: function(pName) {
		var o = {}; o[pName] = 0;
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
				p.oSvc.notifyObservers(this.SETS_BEFORE_RELOAD);
				p.loadSettings(curSrc);
				p.oSvc.notifyObservers(this.SETS_RELOADED);
			},
			this
		);
	},

	testSettings: function(isTest) {
		var src, notifyFlags = this.SETS_TEST;
		if(isTest) {
			src = this.getSettingsStr();
			this.createTestBackup(src);
			notifyFlags |= this.SETS_TEST_UNDO;
		}
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			"navigator:browser",
			function(w) {
				if(!(pSvc in w))
					return;
				var p = w[pSvc];
				p.oSvc.notifyObservers(notifyFlags | this.SETS_BEFORE_RELOAD);
				p.loadSettings(src);
				p.oSvc.notifyObservers(notifyFlags | this.SETS_RELOADED);
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
	extPrefix: "ext_",
	isCustomType: function(type) {
		return this.ut.hasPrefix(type, this.customPrefix);
	},
	removeCustomPrefix: function(type) {
		return this.ut.removePrefix(type, this.customPrefix);
	},

	encForWrite: function(s) {
		return s
			? s
				.replace(/["'\\]/g, "\\$&")

				.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")

				.replace(/\u2028/g, "\\u2028")
				.replace(/\u2029/g, "\\u2028")
			: "";
	},
	enc: function(s) {
		return s; // Not used now
	},
	dec: function(s) {
		return s || "";
	},
	encURI: function(s) {
		return encodeURIComponent(s || "");
	},
	decURI: function(s) {
		try {
			return decodeURIComponent(s || "");
		}
		catch(e) {
			this.ut._err(new Error("Can't decode URI: " + s));
			this.ut._err(e);
			return "[invalid URI]";
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
			.replace(/([a-z]+)=true/g, function($0, $1) { return _this.keys[$1] || $1; })
			.replace(/,+/g, this.keys.sep);
		return sh || (_short ? "" : this.ut.getLocalized("none"));
	},
	getPrefsStr: function(str) {
		const add = this.ct.PROTOCOL_SETTINGS_ADD;
		return str.indexOf(add) == 0
			? this.decURI(str.substr(add.length))
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
		if(hashRe.test(str)) { // Added: 2009-12-18
			this._hashMissing = false;
			var hashFunc = RegExp.$1;
			var hash = RegExp.$2;
			str = str.replace(hashRe, "");
			str = str.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/, ""); // Remove comments
			if(hash != this.getHash(str, hashFunc)) {
				this._hashError = true;
				return false;
			}
		}

		str = str.replace(/"(?:\\"|[^"\n\r\u2028\u2029])*"/g, "__dummy__") // Replace strings
		str = str.replace(hc, ""); // Remove handyClicks* vars
		str = str.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/, ""); // Remove comments
		if(/\/\/|\/\*|\*\//.test(str)) // No other comments
			return false;
		if(/\Wvar\s+/.test(str)) // No other vars
			return false;
		if(/['"()=]/.test(str))
			return false;
		if(/\W(?:[Ff]unction|eval|Components)\W/.test(str))
			return false;
		return true;
	}
};
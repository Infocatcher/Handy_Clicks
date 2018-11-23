var handyClicksPrefSvc = {
	__proto__: handyClicksGlobals,

	oSvc: new HandyClicksObservers(),

	SETS_BEFORE_RELOAD: 1,
	SETS_RELOADED:      2,
	SETS_TEST:          4,
	SETS_TEST_UNDO:     8,

	DESTROY_REBUILD:            1,
	DESTROY_WINDOW_UNLOAD:      2,
	DESTROY_LAST_WINDOW_UNLOAD: 4,

	setsVersion: 0.3,
	setsHeader: "// Preferences of Handy Clicks extension.\n// Do not edit.\n",
	get requiredHeader() {
		delete this.requiredHeader;
		// Support for old header format (only first line without ending ".")
		return this.requiredHeader = this.setsHeader.replace(/\.?[\n\r][\s\S]*$/, "");
	},
	prefsDirName: "handyclicks",
	prefsFileName: "handyclicks_prefs",
	backupsDirName: "backups",
	tempDirName: "temp",
	corruptedDirName: "corrupted",
	names: {
		backup:       "_backup-",
		autoBackup:   "_autobackup-",
		corrupted:    "_corrupted-",
		restored:     "_restored-",
		version:      "_version-",
		beforeImport: "_before_import-",
		userBackup:   "_user_backup-",
		testBackup:   "_test_backup-"
	},
	okShortcut: /^button=[0-2](?:,(?:ctrl|shift|alt|meta|os)=(?:true|false))*$/,

	otherSrc: false,
	_restoringCounter: 0,

	destroy: function(reloadFlag, disable) {
		if(this.isMainWnd) {
			var reason;
			if(reloadFlag || disable)
				reason = this.DESTROY_REBUILD;
			else {
				reason = this.DESTROY_LAST_WINDOW_UNLOAD;
				// Note: private windows doesn't have "windowtype" in SeaMonkey
				var ws = this.wu.wm.getEnumerator(this.ut.isSeaMonkey ? null : "navigator:browser");
				while(ws.hasMoreElements()) {
					var w = ws.getNext();
					if("handyClicksUI" in w && "_handyClicksInitialized" in w) {
						reason = this.DESTROY_WINDOW_UNLOAD;
						break;
					}
				}
			}
			this.destroyCustomFuncs(reason);
		}
		// Force unload prefs to avoid memory leaks
		this.types = this.prefs = this.files = {};
		this._typesCache = { __proto__: null };
		this._loadStatus = this.SETS_LOAD_UNKNOWN;
		if(!disable)
			this.oSvc.destroy();
	},
	disable: function() {
		this._log("Unload settings");
		this.destroy(false, true);
	},

	get profileDir() {
		delete this.profileDir;
		return this.profileDir = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
	},
	get prefsDir() {
		delete this.prefsDir;
		return this.prefsDir = this.getSubDir(this.profileDir, this.prefsDirName);
	},
	get prefsFile() {
		var file = this.prefsDir.clone();
		file.append(this.prefsFileName + ".js");
		delete this.prefsFile;
		return this.prefsFile = file;
	},
	get backupsDir() {
		delete this.backupsDir;
		return this.backupsDir = this.getSubDir(this.prefsDir, this.backupsDirName);
	},
	get tempDir() {
		delete this.tempDir;
		return this.tempDir = this.getSubDir(this.prefsDir, this.tempDirName);
	},
	get _tempDir() { // Don't create directory automatically
		var tempDir = this.prefsDir.clone();
		tempDir.append(this.tempDirName);
		if(tempDir.exists() && tempDir.isDirectory())
			return tempDir;
		return null;
	},
	get corruptedDir() {
		delete this.corruptedDir;
		return this.corruptedDir = this.getSubDir(this.prefsDir, this.corruptedDirName);
	},
	getSubDir: function(parentDir, dirName) {
		var dir = parentDir.clone();
		dir.append(dirName);
		if(dir.exists() && !dir.isDirectory()) {
			var tmp = dir.clone(), i = -1;
			do tmp.leafName = dir.leafName + "-moved-" + ++i;
			while(tmp.exists());
			this.ut.moveFileTo(dir.clone(), null, tmp.leafName);
		}
		if(!dir.exists()) {
			try {
				dir.create(dir.DIRECTORY_TYPE, this.ut.PERMS_DIRECTORY);
			}
			catch(e) {
				this.ut._err('Can\'t create directory: "' + dir.path + '"');
				this.ut._err(e);
			}
		}
		return dir;
	},
	getBackupFile: function(fName, parentDir) {
		if(!parentDir)
			parentDir = this.backupsDir;
		var file = parentDir.clone();
		file.append(fName);
		return file;
	},

	loadedVersion: -1,
	types: {},
	prefs: {},
	files: {}, // Imported files data
	get currentSrc() {
		return {
			version: this.loadedVersion,
			types:   this.types,
			prefs:   this.prefs
		};
	},
	get currentOtherSrc() {
		if(!this.otherSrc)
			return null;
		return this.currentSrc;
	},

	SETS_LOAD_UNKNOWN:     -1,
	SETS_LOAD_OK:           0,
	SETS_LOAD_DECODE_ERROR: 1,
	SETS_LOAD_INVALID_DATA: 2,
	_loadStatus: -1, // SETS_LOAD_UNKNOWN
	loadSettingsAsync: function(callback, context) {
		var pFile = this.prefsFile;
		this.ut.readFromFileAsync(pFile, function(data, status) {
			if(Components.isSuccessCode(status))
				this.loadSettings(data, true);
			else if(status == Components.results.NS_ERROR_FILE_NOT_FOUND) {
				this._log("loadSettingsAsync() -> save default settings");
				this.loadSettings(this.defaultSettings(), true);
				status = Components.results.NS_OK;
			}
			callback && callback.call(context, status);
		}, this);
	},
	loadSettings: function(pSrc, fromProfile) {
		this._loadStatus = this.SETS_LOAD_UNKNOWN;
		if(this.isMainWnd)
			this._log(fromProfile ? "loadSettingsAsync()" : "loadSettings()");
		//this.otherSrc = !!pSrc;
		pSrc = pSrc || this.prefsFile;
		if(pSrc instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)) {
			fromProfile = pSrc.equals(this.prefsFile);
			pSrc = fromProfile && !pSrc.exists()
				? this.defaultSettings()
				: this.ut.readFromFile(pSrc);
			if(fromProfile && !this.isMainWnd)
				this._savedStr = pSrc;
		}
		this.otherSrc = !fromProfile;

		var scope;
		if(typeof pSrc != "string")
			scope = pSrc;
		else {
			pSrc = this.convertToJSON(this.removePrefsDesription(pSrc));
			try {
				scope = this.JSON.parse(pSrc);
			}
			catch(e) {
				this._loadStatus = this.SETS_LOAD_DECODE_ERROR;
				this.ut._err("Invalid prefs: JSON.parse() failed:\n" + pSrc);
				this.ut._err(e);
				if(this.otherSrc) {
					this.ut.alert(
						this.getLocalized("errorTitle"),
						this.getLocalized("invalidConfigFormat")
					);
					return;
				}
				this.loadSettingsBackup();
				return;
			}
		}

		if(!this.isValidPrefs(scope)) {
			this._loadStatus = this.SETS_LOAD_INVALID_DATA;
			this.ut._err("Loaded prefs or types is not object or invalid \"version\" property");
			if(this.otherSrc) {
				this.ut.alert(
					this.getLocalized("errorTitle"),
					this.getLocalized("invalidConfigFormat")
				);
				return;
			}
			this.loadSettingsBackup();
			return;
		}

		this.prefs = scope.prefs;
		this.types = scope.types;
		this.files = scope.files || {};
		var vers = this.loadedVersion = scope.version || 0;

		if(vers < this.setsVersion)
			this.setsMigration(fromProfile, vers);
		this._restoringCounter = 0;
		if(this.isMainWnd) {
			this._typesCache = { __proto__: null };
			if(this.pu.get("precompileCustomTypes"))
				this.delay(this.compileCustomTypes, this);
			this.initCustomFuncs();
		}
		this._loadStatus = this.SETS_LOAD_OK;
	},
	convertToJSON: function(s, silent) {
		if(s.substr(0, 4) != "var ") //= Added: 2012-01-13
			return s;
		if(!silent)
			this._log("Prefs in old format, try convert to JSON");

		// Note: supported only features used in old settings format
		return "{\n"
			+ s
				// Reencode strings
				.replace(/"(?:\\"|[^"\n\r])*"/g, function(s) {
					return s
						.replace(/(\\+)'/g, function(s, bs) {
							return bs.length & 1
								? s.substr(1)
								: s;
						})
						.replace(/\t/g, "\\t");
				})
				// Convert vars to properties
				.replace(/^var (\w+) = /, '"$1": ')
				.replace(/;([\n\r]+)var (\w+) = /g, ',$1"$2": ')
				// Recode arguments object
				.replace(/^\s*arguments: .*$/mg, function(s) {
					return s.replace(/(\w+):/g, '"$1":');
				})
				// Add commas to each property name
				.replace(/^(\s*)(\w+): /mg, '$1"$2": ')
				.replace(/;\s*$/, "")
				//.replace(/^\s+/mg, "")
				//.replace(/[\n\r]+/g, "")

				// Rename properties:
				.replace(/^(\s*)"handyClicksPrefsVersion":/m, '$1"version":')
				.replace(/^(\s*)"handyClicksCustomTypes":/m,  '$1"types":')
				.replace(/^(\s*)"handyClicksPrefs":/m,        '$1"prefs":')
			+ "\n}";
	},
	loadSettingsBackup: function() {
		var pFile = this.prefsFile;
		var corruptedPath = this.moveFiles(
			pFile,
			this.names.corrupted,
			false,
			false,
			this.pu.get("sets.backupCorruptedDepth")
		);
		if(pFile.exists()) { // Backups disabled
			var tmp = pFile.clone();
			// But save backup anyway :)
			this.ut.moveFileTo(tmp, this.backupsDir, this.prefsFileName + this.names.corrupted.replace(/-$/, "") + ".js");
			corruptedPath = tmp.path;
		}
		while(++this._restoringCounter <= this.pu.get("sets.backupDepth")) {
			var bName = this.prefsFileName + this.names.backup + (this._restoringCounter - 1) + ".js";
			var bFile = this.getBackupFile(bName);
			if(bFile.exists()) {
				var bakPath = this.moveFiles(bFile, this.names.restored, true);
				this.ut.moveFileTo(bFile, pFile.parent, pFile.leafName);
				break;
			}
		}
		var errTitle = this.getLocalized("errorTitle");
		var errMsg = this.getLocalized("badJSFile").replace("%f", corruptedPath)
			+ (bakPath ? this.getLocalized("restoredFromBackup").replace("%f", bakPath) : "")
		this.delay(function() {
			this.ut.alert(errTitle, errMsg);
		}, this);
		this.loadSettings();
	},
	get setsMigration() { // function(allowSave, vers)
		var temp = {};
		this.jsLoader.loadSubScript("chrome://handyclicks/content/convSets.js", temp);
		return temp.setsMigration;
	},

	initCustomType: function(type) {
		var cache = this._typesCache;
		if(type in cache)
			return cache[type];

		if(!this.isOkCustomType(type)) {
			this.ut._warn('Invalid custom type: "' + type + '"');
			this._log('! Type "' + type + '" => invalid');
			return cache[type] = false;
		}
		var ct = this.types[type];
		if(!ct.enabled) {
			this._log('Type "' + type + '" => disabled');
			return cache[type] = false;
		}
		try {
			var df = ct.define;
			var cm = ct.contextMenu;
			ct._defineLine = new Error().lineNumber + 1;
			ct._define = new Function("event,item", this.expandCode(df));
			ct._contextMenuLine = new Error().lineNumber + 1;
			ct._contextMenu = cm ? new Function("event,item,origItem", this.expandCode(cm)) : null;
			this._log('Type "' + type + '" => initialized');
			return cache[type] = true;
		}
		catch(e) {
			ct._invalid = true;
			var eLine = this.ut.getRealLineNumber(e, ct._contextMenuLine || ct._defineLine);
			var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
				+ ("_contextMenuLine" in ct ? this.ct.EDITOR_TYPE_CONTEXT : this.ct.EDITOR_TYPE_DEFINE)
				+ "?line=" + eLine;
			var eMsg = this.ut.errInfo("customTypeCompileError", ct.label, type, e);
			this.ut.notifyInWindowCorner(
				eMsg + this.getLocalized("openConsole") + this.getLocalized("openEditor"),
				this.getLocalized("errorTitle"),
				this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
				this.ut.NOTIFY_ICON_ERROR
			);
			this.ut._err(eMsg, href, eLine);
			this.ut._err(e);
		}
		this._log('! Type "' + type + '" => initialization error');
		return cache[type] = false;
	},
	compileCustomTypes: function() {
		var types = this.types;
		for(var type in types) if(types.hasOwnProperty(type))
			this.delay(this.initCustomType, this, 0, [type]);
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
			var legacyDestructor = new Function(this.expandCode(rawCode)).call(this.ut);
		}
		catch(e) {
			this.handleCustomFuncError(e, line, fObj, sh, type, isDelayed, true);
		}
		if(typeof legacyDestructor == "function") { // Added: 2010-06-15
			this.ut._deprecated(
				"Construction \"return destructorFunction;\" is deprecated, use "
				+ "\"void handyClicksPrefSvc.registerDestructor"
				+ "(in function destructor, in object context, in unsigned long notifyFlags)\" "
				+ "instead"
			);
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
	getCustomFunc: function(fObj) {
		var useCache = this.pu.get("cacheCustomFunctions");
		if(useCache && "_function" in fObj) {
			var fn = fObj._function;
			if(!fn)
				this.ut._err("Syntax error in function: " + fObj.label, fObj._editorLink, fObj._errorLine);
			return fn;
		}
		this._log("Compile: " + fObj.label);
		try {
			var line = fObj._line = new Error().lineNumber + 1;
			var fn = new Function("event,item,origItem", this.expandCode(fObj.action));
		}
		catch(err) {
			var eLine = fObj._errorLine = this.ut.getRealLineNumber(err, line);
			var href = fObj._editorLink = this.hc.getEditorLink() + "?line=" + eLine;
			var eMsg = this.ut.errInfo("customFunctionCompileError", fObj.label, this.hc.itemType, err);
			this.ut.notify(
				eMsg + this.getLocalized("openConsole") + this.getLocalized("openEditor"),
				this.getLocalized("errorTitle"),
				this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
				this.ut.NOTIFY_ICON_ERROR
			);
			this.ut._err(eMsg, href, eLine);
			this.ut._err(err);
		}
		if(useCache)
			fObj._function = fn;
		return fn;
	},
	getSourcePath: function(code) {
		// Usage: "//> path/to/file.js"
		return /^\/\/>\s*([^\n\r]+\.js)$/.test(code) && RegExp.$1;
	},
	expandCode: function(code) {
		var path = this.getSourcePath(code);
		if(!path)
			return code;
		var file = this.ut.getLocalFile(path);
		var data = file && this.ut.readFromFile(file);
		if(!data)
			throw this.ut.getLocalized("fileNotFound").replace("%f", file ? file.path : path);
		return data;
	},
	exportFileData: function(files, code) {
		var path = this.getSourcePath(code);
		if(!path || (path in files))
			return;
		var file = this.ut.getLocalFile(path);
		if(!file)
			return;
		if(!this.importAllowed(file)) //~ todo: add pref + warning?
			return;
		var data = this.ut.readFromFile(file);
		if(!data) //~ todo: show warning?
			return;
		files[path] = {
			lastModified: file.lastModifiedTime,
			data: data
		};
	},
	importAllowed: function(file) {
		return this.prefsDir.contains(file, false /* aRecurse, for Firefox 31 and older */);
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
		var ds = [
			destructor,
			context,
			notifyFlags,
			dc.baseLine,
			dc.funcObj,
			dc.shortcut,
			dc.type,
			dc.isDelayed
		];
		return this._destructors.push(ds) - 1;
	},
	unregisterDestructor: function(uid) {
		delete this._destructors[uid];
	},

	destroyCustomFuncs: function(reason) {
		//this._log("destroyCustomFuncs() [" + this._destructors.length + "]");
		this._destructors.forEach(function(destructorArr) {
			this.destroyCustomFunc.apply(this, destructorArr.concat(reason));
		}, this);
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
		var eLine = this.ut.getRealLineNumber(e, baseLine);
		var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_SHORTCUT + "/" + sh + "/" + type + "/"
			+ (isDelayed ? this.ct.EDITOR_SHORTCUT_DELAYED : this.ct.EDITOR_SHORTCUT_NORMAL) + "/"
			+ this.ct.EDITOR_SHORTCUT_INIT
			+ "?line=" + eLine;
		var eMsg = this.ut.errInfo(
			isInit ? "funcInitError" : "funcDestroyError",
			this.ut.getOwnProperty(fObj, "label"),
			type, e
		);
		this.ut.notifyInWindowCorner(
			eMsg + this.getLocalized("openConsole") + this.getLocalized("openEditor"),
			this.getLocalized("errorTitle"),
			this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
			this.ut.NOTIFY_ICON_ERROR
		);
		this.ut._err(eMsg, href, eLine);
		this.ut._err(e);
	},

	defaultSettings: function() {
		var data = this.getSettingsStr({}, {});
		this.saveSettingsAsync(data);
		return data;
	},
	correctSettings: function(types, prefs/*, force*/) {
		types = types || this.types;
		prefs = prefs || this.prefs;
		//~ todo: test

		//var corrected = false;
		//function del(o, p) {
		//	delete o[p];
		//	corrected = true;
		//}
		var forcedDisByType = { __proto__: null };

		for(type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			if(!this.isCustomType(type) || !this.isOkCustomObj(to)) {
				delete types[type];
				continue;
			}
			if(to.hasOwnProperty("enabled") && !to.enabled)
				forcedDisByType[type] = true;
			//if(force) for(var pName in to) if(to.hasOwnProperty(pName))
			//	if(pName.charAt(0) == "_")
			//		delete to[pName];
		}

		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(!this.isOkShortcut(sh) || !this.ut.isObject(so)) {
				delete prefs[sh];
				continue;
			}
			var forcedDis = this.ut.getOwnProperty(so, "$all", "enabled") == true;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.isOkFuncObj(to)) {
					delete so[type];
					continue;
				}
				for(var pName in to) if(to.hasOwnProperty(pName)) {
					if(
						pName == "enabled"
						&& (
							type in forcedDisByType
							|| forcedDis && type != "$all"
						)
					)
						to.enabled = false;
					var pVal = to[pName];
					if(pName == "delayedAction") {
						if(!this.isOkFuncObj(pVal)) {
							delete to[pName];
							continue;
						}
						if(to.eventType == "mousedown")
							pVal.enabled = false;
					}
				}
			}
		}
	},
	sortSettings: function(o) {
		//~ todo: use "logical" sort? Place "enabled" first, etc.
		return this.ut.sortObj(o, true, ["arguments"]);
	},
	settingsEquals: function() {
		Array.prototype.forEach.call(arguments, this.sortSettings, this);
		return this.ut.objEqualsRaw.apply(this.ut, arguments);
	},
	getSettingsStr: function(types, prefs, exportLinkedFiles) {
		types = types || this.types;
		prefs = prefs || this.prefs;

		this.correctSettings(types, prefs);
		this.sortSettings(types);
		this.sortSettings(prefs);

		var o = {
			version: this.setsVersion,
			types:   types,
			prefs:   prefs
		};
		if(exportLinkedFiles)
			o.files = {};

		var _this = this;
		var json = this.JSON.stringify(o, function censor(key, val) {
			if(key.charAt(0) == "_")
				return undefined;
			if(exportLinkedFiles && key != "label" && typeof val == "string")
				_this.exportFileData(o.files, val);
			return val;
		}, "\t");

		const hashFunc = "SHA256";
		return this.setsHeader
			+ "// " + hashFunc + ": " + this.getHash(json, hashFunc) + "\n"
			+ json;
	},
	get JSON() { // For Firefox < 3.5
		delete this.JSON;
		if("JSON" in window)
			this.JSON = JSON;
		else
			this.jsLoader.loadSubScript("chrome://handyclicks/content/json.js", this);
		return this.JSON;
	},
	saveSettingsObjects: function(reloadAll) {
		this.saveSettings(this.getSettingsStr());
		this.reloadSettings(reloadAll);
	},
	saveSettingsObjectsAsync: function(reloadAll, callback, context) {
		this.delay(function() {
			this.saveSettingsAsync(this.getSettingsStr(), function(status) {
				if(Components.isSuccessCode(status))
					this.reloadSettings(reloadAll);
				callback && callback.call(context || this, status);
			}, this);
		}, this);
	},
	getHash: function(str, hashFunc) {
		var uc = this.ut.utf8Converter;
		var result = {};
		var data = uc.convertToByteArray(str, result);
		var ch = Components.classes["@mozilla.org/security/hash;1"]
			.createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch[hashFunc]);
		ch.update(data, data.length);
		var hash = ch.finish(false);
		return Array.prototype.map.call(
			hash,
			function(chr) {
				return ("0" + chr.charCodeAt(0).toString(16)).slice(-2);
			}
		).join("");
	},
	reloadSettings: function(reloadAll) {
		const pSvc = "handyClicksPrefSvc";
		var curOtherSrc = this.currentOtherSrc;
		var types = ["handyclicks:settings", "handyclicks:editor"];
		if(!curOtherSrc) {
			if(this.ut.isSeaMonkey)
				types = null;
			else
				types.push("navigator:browser");
		}
		this.wu.forEachWindow(
			types,
			function(w) {
				if(!(pSvc in w) || (!reloadAll && w === window))
					return;
				// Note: we don't need special checks for SeaMonkey, "pSvc in w" should be enough
				var p = w[pSvc];
				if(!curOtherSrc && p.otherSrc && "handyClicksSets" in w) {
					var s = w.handyClicksSets;
					//~ todo: may be deleted via garbage collector in old Firefox versions?
					s._savedPrefs = this.prefs;
					s._savedTypes = this.types;
					s.updTree();
					return;
				}
				p.oSvc.notifyObservers(this.SETS_BEFORE_RELOAD);
				p.loadSettings(curOtherSrc && p.otherSrc ? curOtherSrc : p.currentOtherSrc);
				p.oSvc.notifyObservers(this.SETS_RELOADED);
			},
			this
		);
	},

	testSettings: function(isTest) {
		var src = null;
		var notifyFlags = this.SETS_TEST;
		if(isTest) {
			src = this.getSettingsStr();
			this.createTestBackup(src);
		}
		else {
			notifyFlags |= this.SETS_TEST_UNDO;
		}
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			this.ut.isSeaMonkey ? null : "navigator:browser",
			function(w) {
				if(
					!(pSvc in w)
					|| !("handyClicksUI" in w) // Make sure it's a browser window, for SeaMonkey
				)
					return;
				var p = w[pSvc];
				p.oSvc.notifyObservers(notifyFlags | this.SETS_BEFORE_RELOAD);
				p.loadSettings(src);
				p.oSvc.notifyObservers(notifyFlags | this.SETS_RELOADED);
			},
			this
		);
	},
	get hasTestSettings() {
		const pSvc = "handyClicksPrefSvc";
		var ws = this.wu.wm.getEnumerator(this.ut.isSeaMonkey ? null : "navigator:browser");
		while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if("handyClicksUI" in w && pSvc in w && w[pSvc].otherSrc)
				return true;
		}
		return false;
	},
	createTestBackup: function(pStr) {
		var num = this.pu.get("sets.backupTestDepth") - 1;
		if(num < 0)
			return;
		var fName = this.prefsFileName + this.names.testBackup;
		var file, bakFile;
		while(--num >= 0) {
			file = this.getBackupFile(fName + num + ".js");
			if(num == 0)
				bakFile = file.clone();
			if(file.exists()) {
				this.ut.moveFileTo(file, this.backupsDir, fName + (num + 1) + ".js");
				this.ut.deleteTemporaryFileOnExit(file);
			}
		}
		this.ut.writeToFile(pStr, bakFile);
		this.ut.deleteTemporaryFileOnExit(bakFile);

		this.ut.storage("testBackupCreated", true);
	},

	moveFiles: function(firstFile, nameAdd, leaveOriginal, noFirstNum, depth) {
		if(!firstFile.exists())
			return null;
		if(depth === undefined)
			depth = this.pu.get("sets.backupDepth");
		var pDir = nameAdd == this.names.corrupted
			? this.corruptedDir
			: this.backupsDir;
		var maxNum = depth - 1;
		var fName = this.prefsFileName + nameAdd;
		function getName(n) {
			if(noFirstNum && n == 0)
				return fName.replace(/-$/, "") + ".js";
			return fName + n + ".js";
		}
		var num, file;
		num = maxNum;
		for(;;) {
			file = this.getBackupFile(getName(++num), pDir);
			if(!file.exists())
				break;
			this.ut.removeFile(file, true);
		}
		if(depth <= 0)
			return null;
		num = maxNum;
		while(--num >= 0) {
			file = this.getBackupFile(getName(num), pDir);
			if(file.exists())
				this.ut.moveFileTo(file, pDir, getName(num + 1));
		}
		var tmp = firstFile.clone();
		var name = getName(0);
		if(!leaveOriginal)
			this.ut.moveFileTo(tmp, pDir, name);
		else {
			this.ut.copyFileTo(firstFile, pDir, name);
			tmp.leafName = name;
		}
		return tmp.path;
	},
	get minBackupInterval() {
		return (this.pu.get("sets.backupAutoInterval") || 24*60*60)*1000;
	},
	checkForBackup: function() {
		if(!this.prefsFile.exists())
			return;
		var backupsDir = this.backupsDir;
		var entries = backupsDir.directoryEntries;
		var entry, fName, fTime;
		var _fTimes = [], _files = {};
		const namePrefix = this.ps.prefsFileName + this.names.autoBackup;
		while(entries.hasMoreElements()) {
			entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			fName = entry.leafName;
			if(
				!entry.isFile()
				|| !/\.js$/i.test(fName)
				|| !this.ut.hasPrefix(fName, namePrefix)
				|| !/-(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\.js$/.test(fName)
			)
				continue;
			fTime = new Date(RegExp.$1, RegExp.$2 - 1, RegExp.$3, RegExp.$4, RegExp.$5, RegExp.$6).getTime();
			_fTimes.push(fTime);
			_files[fTime] = entry; // fTime must be unique
		}
		this.ut.sortAsNumbers(_fTimes);

		var max = this.pu.get("sets.backupAutoDepth");

		var now = Date.now();
		if(max > 0 && (!_fTimes.length || now >= _fTimes[_fTimes.length - 1] + this.minBackupInterval)) {
			_fTimes.push(now);
			fName = namePrefix + this.getTimeString(now) + ".js";
			this.ut.copyFileTo(this.prefsFile, backupsDir, fName);
			_files[now] = this.getBackupFile(fName);
			this._log("Backup: " + _files[now].leafName);
		}
		else
			this._log("checkForBackup: No backup");

		while(_fTimes.length > max)
			this.ut.removeFile(_files[_fTimes.shift()], false);
	},
	getTimeString: function(date) {
		var d = date ? new Date(date) : new Date();
		if("toISOString" in d) { // Firefox 3.5+
			// toISOString() uses zero UTC offset, trick to use locale offset
			d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
			return d.toISOString() // Example: 2017-01-02T03:04:05.006Z
				.replace(/[-T:]|\..*$/g, "");
		}
		return d.toLocaleFormat("%Y%m%d%H%M%S");
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
	saveSettings: function(str, async, callback, context) {
		if(str == this._savedStr) {
			callback && callback.call(context || this, Components.results.NS_OK);
			return;
		}
		this.checkForBackup();
		var pFile = this.prefsFile;
		this.moveFiles(pFile, this.names.backup);
		if(async) {
			this.ut.writeToFileAsync(str, pFile, this.ut.bind(function(status) {
				if(Components.isSuccessCode(status))
					this._savedStr = str;
				else
					this.saveError(status);
				callback && callback.call(context || this, status);
			}, this));
		}
		else {
			var err = {};
			if(this.ut.writeToFile(str, pFile, err))
				this._savedStr = str;
			else
				this.saveError(this.ut.getErrorCode(err.value));
		}
	},
	saveSettingsAsync: function(str, callback, context) {
		this.saveSettings(str, true, callback, context);
	},
	saveError: function(status) {
		this.ut.alert(
			this.getLocalized("errorTitle"),
			this.getLocalized("saveError")
				.replace("%f", this.prefsFile.path)
				.replace("%e", this.ut.getErrorName(status))
		);
		this.ut.reveal(this.prefsFile);
	},

	get isMainWnd() {
		delete this.isMainWnd;
		return this.isMainWnd = "handyClicksUI" in window;
	},
	getEvtStr: function(e) {
		return "button=" + (e.button || 0)
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey
			+ (e.getModifierState && e.getModifierState("OS") ? ",os=true" : "");
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
		return "hasOwnProperty" in cts && cts.hasOwnProperty(cType) && this.isOkCustomObj(cts[cType]);
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
		return type && this.ut.hasPrefix(type, this.customPrefix);
	},
	removeCustomPrefix: function(type) {
		return this.ut.removePrefix(type, this.customPrefix);
	},
	isExtType: function(type) {
		return type && this.ut.hasPrefix(type, this.extPrefix);
	},

	getTypeLabel: function(type, isCustomType) {
		return (isCustomType === undefined ? this.isCustomType(type) : isCustomType)
				? this.getCustomTypeLabel(type)
				: this.getLocalized(type);
	},
	getCustomTypeLabel: function(type) {
		var label = this.ut.getOwnProperty(this.types, type, "label");
		label = label ? label + " " : "";
		return label + "[" + this.removeCustomPrefix(type) + "]";
	},

	enc: function(s) { //~todo: Not needed, but still used in editor
		this.ut._deprecated("handyClicksPrefSvc.enc() is deprecated and not needed anymore");
		return s;
	},
	dec: function(s) { //~todo: Not needed, but still used in sets and editor
		this.ut._deprecated("handyClicksPrefSvc.dec() is deprecated and not needed anymore");
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
			this.ut._err('Can\'t decode URI: "' + s + '"');
			this.ut._err(e);
			return "[invalid URI]";
		}
	},
	getButtonId: function(sh, _short) {
		return /button=([0-2])/.test(sh) ? "button" + RegExp.$1 + (_short ? "short" : "") : "?";
	},
	getButtonStr: function(sh, _short) {
		return this.getLocalized(this.getButtonId(sh, _short));
	},
	get keys() {
		const src = "chrome://global-platform/locale/platformKeys.properties";
		delete this.keys;
		return this.keys = {
			ctrl:  this.ut.getStr(src, "VK_CONTROL", "Ctrl"),
			shift: this.ut.getStr(src, "VK_SHIFT", "Shift"),
			alt:   this.ut.getStr(src, "VK_ALT", "Alt"),
			meta:  this.ut.getStr(src, "VK_META", "Meta"),
			os:    this.ut.getStr(src, "VK_WIN", "Win", this.ut.fxVersion > 3.6 ? undefined : -1),
			sep:   this.ut.getStr(src, "MODIFIER_SEPARATOR", "+"),
			__proto__: null
		};
	},
	getModifiersStr: function(sh, _short) { // "button=0,ctrl=true,shift=true,alt=false,meta=false"
		var keys = this.keys;
		sh = sh
			.replace(/[a-z]+=(?:false|\d),?/g, "")
			.replace(/,+$/g, "")
			.replace(/([a-z]+)=true/g, function($0, $1) {
				return keys[$1] || $1;
			})
			.replace(/,+/g, keys.sep);
		return sh || (_short ? "" : this.getLocalized("none"));
	},
	checkPrefs: function(pSrc) {
		return this.checkPrefsStr(
			pSrc instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)
				? this.ut.readFromFile(pSrc)
				: this.getPrefsStr(pSrc)
		);
	},
	getPrefsStr: function(str) {
		const add = this.ct.PROTOCOL_SETTINGS_ADD;
		if(this.ut.hasPrefix(str, add))
			return this.decURI(str.substr(add.length));
		return str;
	},
	removePrefsDesription: function(str) {
		return str.replace(/^(?:\/\/[^\n\r]+[\n\r]+)+/, "");
	},
	isValidPrefs: function(obj) {
		return this.ut.isObject(obj)
			&& this.ut.isObject(obj.prefs)
			&& this.ut.isObject(obj.types)
			&& (
				!("version" in obj) // Support for old format
				|| typeof obj.version == "number" && isFinite(obj.version)
			);
	},
	checkPrefsStr: function _cps(str, silent) {
		var checkCustom = _cps.hasOwnProperty("checkCustomCode");
		delete _cps.checkCustomCode;
		this._hashError = false;
		this._hashMissing = true;
		this._hasCustomCode = checkCustom ? false : undefined;

		if(!this.ut.hasPrefix(str, this.requiredHeader)) {
			!silent && this.ut._err("Invalid prefs: wrong header");
			return false;
		}

		const hashRe = /(?:\r\n|\n|\r)\/\/[ \t]?(MD2|MD5|SHA1|SHA512|SHA256|SHA384):[ \t]?([a-f0-9]+)(?=[\n\r]|$)/;
		if(hashRe.test(str)) { //= Added: 2009-12-18
			this._hashMissing = false;
			var hashFunc = RegExp.$1;
			var hash = RegExp.$2;
			str = RegExp.leftContext + RegExp.rightContext; // str = str.replace(hashRe, "");
			str = this.removePrefsDesription(str);
			if(hash != this.getHash(str, hashFunc)) {
				this._hashError = true;
				!silent && this.ut._warn("Invalid prefs: wrong checksum");
				return false;
			}
		}
		else {
			str = this.removePrefsDesription(str);
		}

		str = this.convertToJSON(str, silent);
		try {
			var prefsObj = this.JSON.parse(str);
		}
		catch(e) {
			if(!silent) {
				this.ut._err("Invalid prefs: JSON.parse() failed:\n" + str);
				this.ut._err(e);
			}
			return false;
		}
		if(!this.isValidPrefs(prefsObj)) {
			!silent && this.ut._err("Invalid prefs: prefs object doesn't contains required fields");
			return false;
		}
		if(checkCustom)
			this._hasCustomCode = this.hasCustomCode(prefsObj);
		return true;
	},
	hasCustomCode: function(prefsObj) {
		var types = prefsObj.types;
		for(var type in types) if(types.hasOwnProperty(type))
			if(this.ut.isObject(types[type]))
				return true;
		var prefs = prefsObj.prefs;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(
					this.ut.isObject(to)
					&& (
						this.ut.getOwnProperty(to, "custom")
						|| this.ut.getOwnProperty(to, "delayedAction", "custom")
					)
				)
					return true;
			}
		}
		return false;
	},
	get clipboardPrefs() {
		var cb = this.ut.cb;
		var cbStr = this.getPrefsStr(this.ut.readFromClipboard(true, cb.kGlobalClipboard));
		if(this.checkPrefsStr(cbStr, true))
			return cbStr;
		if(!cb.supportsSelectionClipboard())
			return "";
		cbStr = this.getPrefsStr(this.ut.readFromClipboard(true, cb.kSelectionClipboard));
		if(this.checkPrefsStr(cbStr, true))
			return cbStr;
		return "";
	}
};
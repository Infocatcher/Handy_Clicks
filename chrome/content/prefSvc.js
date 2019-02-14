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
	DESTROY_FORCE_PURGE_CACHES: 8,

	setsVersion: 0.4,
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
	scriptsDirName: "scripts",
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
	modifiersMask: /(?:(?:^|,)(?:ctrl|shift|alt|meta|os)=(?:true|false))+/,

	otherSrc: false,

	destroy: function(reloadFlag, disable) {
		if(this.isMainWnd) {
			var reason;
			if(reloadFlag || disable)
				reason = this.DESTROY_REBUILD;
			else {
				var hasBrowserWindow = this.wu.forEachBrowserWindow(function(w) {
					return "_handyClicksInitialized" in w;
				});
				reason = hasBrowserWindow
					? this.DESTROY_WINDOW_UNLOAD
					: this.DESTROY_LAST_WINDOW_UNLOAD;
			}
			this.destroyCustomFuncs(reason);
		}
		// Force unload prefs to avoid memory leaks
		this.types = this.prefs = this.files = {};
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
	get scriptsDir() {
		delete this.scriptsDir;
		return this.scriptsDir = this.getSubDir(this.prefsDir, this.scriptsDirName);
	},
	get tempDir() {
		delete this.tempDir;
		return this.tempDir = this.getSubDir(this.prefsDir, this.tempDirName);
	},
	get _scriptsDir() { // Don't create directory automatically
		var dir = this.prefsDir.clone();
		dir.append(this.scriptsDirName);
		delete this._scriptsDir;
		return this._scriptsDir = dir;
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
				dir.create(dir.DIRECTORY_TYPE, this.io.PERMS_DIRECTORY);
			}
			catch(e) {
				this.ut._err('Can\'t create directory: "' + dir.path + '"');
				this.ut._err(e);
			}
		}
		return dir;
	},

	loadedVersion: -1,
	types: {},
	prefs: {},
	files: {}, // Imported files data
	get currentSrc() {
		return {
			version: this.loadedVersion,
			types:   this.types,
			prefs:   this.prefs,
			files:   this.files
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
	_restoringCounter: 0,
	loadSettingsAsync: function(callback, context) {
		var pFile = this.prefsFile;
		this.io.readFromFileAsync(pFile, function(data, status) {
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
	loadSettings: function(pSrc, fromPrefs) {
		this._loadStatus = this.SETS_LOAD_UNKNOWN;
		if(this.isMainWnd)
			this._log(fromPrefs ? "loadSettingsAsync()" : "loadSettings()");
		//this.otherSrc = !!pSrc;
		pSrc = pSrc || this.prefsFile;
		if(pSrc instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)) {
			fromPrefs = pSrc.equals(this.prefsFile);
			pSrc = fromPrefs && !pSrc.exists()
				? this.defaultSettings()
				: this.io.readFromFile(pSrc);
			if(fromPrefs && !this.isMainWnd)
				this._savedStr = pSrc;
		}
		this.otherSrc = !fromPrefs;

		var scope;
		if(typeof pSrc != "string")
			scope = pSrc;
		else {
			pSrc = this.removePrefsDesription(pSrc);
			if(this.isLegacyJs(pSrc))
				pSrc = this.pe.convertToJSON(pSrc);
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
				this.pe.loadSettingsBackup();
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
			this.pe.loadSettingsBackup();
			return;
		}

		this.prefs = scope.prefs;
		this.types = scope.types;
		this.files = !fromPrefs && "files" in scope
			&& this.pe.filterFilesData(scope.files)
			|| {};
		var vers = this.loadedVersion = scope.version || 0;

		if(vers < this.setsVersion)
			this.setsMigration(fromPrefs, vers);
		this._restoringCounter = 0;
		if(this.isMainWnd) {
			this.initCustomFuncs();
			if(this.pu.get("precompileCustomTypes"))
				this.delay(this.compileCustomTypes, this);
		}
		this._loadStatus = this.SETS_LOAD_OK;
	},
	reinitSettingsInBrowsers: function() {
		this._log("reinitSettingsInBrowsers()");
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachBrowserWindow(function(w) {
			if(!(pSvc in w))
				return;
			this._log("reinitSettingsInBrowsers() -> clear caches and reinitialize");
			w[pSvc].initCustomFuncs(this.DESTROY_FORCE_PURGE_CACHES);
		}, this);
	},
	isLegacyJs: function(s) {
		return s.substr(0, 4) == "var ";
	},
	get setsMigration() { // function(allowSave, vers)
		var temp = {};
		this.jsLoader.loadSubScript("chrome://handyclicks/content/convSets.js", temp);
		return temp.setsMigration;
	},

	initCustomType: function(type) {
		var state = this._typesInitState;
		if(type in state)
			return state[type];

		if(!this.isOkCustomType(type)) {
			this.ut._warn('Invalid custom type: "' + type + '"');
			return state[type] = false;
		}
		var ct = this.types[type];
		if(!ct.enabled) {
			this._log('Type "' + type + '" => disabled');
			return state[type] = false;
		}
		try {
			var df = ct.define;
			var cm = ct.contextMenu;
			ct._defineLine = new Error().lineNumber + 1;
			ct._define = new Function("event,item,itemType,firstCall", this.expandCode(df));
			ct._contextMenuLine = new Error().lineNumber + 1;
			ct._contextMenu = cm ? new Function("event,item,origItem,itemType", this.expandCode(cm)) : null;
			ct._firstCall = true;
			this._log('Type "' + type + '" => initialized');
			return state[type] = true;
		}
		catch(e) {
			ct._invalid = true;
			var eLine = this.ut.getRealLineNumber(e, ct._contextMenuLine || ct._defineLine);
			var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
				+ ("_contextMenuLine" in ct ? this.ct.EDITOR_TYPE_CONTEXT : this.ct.EDITOR_TYPE_DEFINE)
				+ "?line=" + eLine;
			var eMsg = this.errInfo("customTypeCompileError", e, type);
			this.ut.notifyError(eMsg, {
				buttons: {
					$openEditor: this.wu.getOpenEditorLink(href, eLine),
					$openConsole: this.ut.toErrorConsole
				},
				inWindowCorner: true
			});
			this.ut._err(eMsg, href, eLine);
			this.ut._err(e);
		}
		return state[type] = false;
	},
	compileCustomTypes: function() {
		var types = this.types;
		for(var type in types) if(types.hasOwnProperty(type))
			this.delay(this.initCustomType, this, 0, [type]);
	},
	initCustomFuncs: function(reason) {
		this.destroyCustomFuncs(reason | this.DESTROY_REBUILD);
		var p = this.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			var so = p[sh];
			if(!this.ut.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.isOkFuncObj(to) || !to.enabled)
					continue;
				if(this.ut.getOwnProperty(to, "custom"))
					this.initCustomFunc(to, sh, type, false);
				var da = this.ut.getOwnProperty(to, "delayedAction");
				if(this.isOkFuncObj(da) && da.enabled && this.ut.getOwnProperty(da, "custom"))
					this.initCustomFunc(da, sh, type, true);
			}
		}
		this._destructorContext = null;
	},
	initCustomFunc: function(fObj, sh, type, isDelayed) {
		var rawCode = this.ut.getOwnProperty(fObj, "init");
		if(!rawCode)
			return;
		try {
			var line = new Error().lineNumber + 2;
			this._destructorContext = [line, fObj, sh, type, isDelayed];
			var legacyDestructor = new Function("itemType", this.expandCode(rawCode)).call(this.ut, type);
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
	getCustomFunc: function(fObj, isDeleyed) {
		var useCache = this.pu.get("cacheCustomFunctions");
		if(useCache && "_function" in fObj)
			return fObj._function;
		this._log("Compile: " + fObj.label);
		try {
			var code = this.expandCode(fObj.action);
			var path = this.expandCode._path;
			if(typeof code == "function")
				this._log("Will use already created function for " + path);
			var line = fObj._line = new Error().lineNumber + 1;
			var fn = typeof code == "function" ? code : new Function("event,item,origItem,itemType", code);
			if(useCache && path && !(path in this._fnCache)) {
				this._log("Cache function for " + path);
				this._fnCache[path] = fn;
			}
		}
		catch(err) {
			var eLine = fObj._errorLine = code ? this.ut.getRealLineNumber(err, line) : 0;
			var href = fObj._editorLink = this.hc.getEditorLink() + "?line=" + eLine;
			var eKey = code ? "customFunctionCompileError" : "customFunctionLinkedFileError";
			var eMsg = this.errInfo(eKey, err, this.hc.itemType, isDeleyed, fObj.label || "");
			this.ut.notifyError(eMsg, { buttons: {
				$openEditor: this.wu.getOpenEditorLink(href, eLine),
				$openConsole: this.ut.toErrorConsole
			}});
			this.ut._err(eMsg, href, eLine);
			this.ut._err(err);
		}
		if(fn && useCache)
			fObj._function = fn;
		return fn;
	},
	getSourcePath: function(code) {
		// Usage: "//> path/to/file.js"
		return /^\/\/>\s*([^\n\r]+\.\w+)$/.test(code) && RegExp.$1;
	},
	_fnCache: { __proto__: null },
	expandCode: function expandCode(code) {
		expandCode._path = undefined;
		var path = this.getSourcePath(code);
		if(!path)
			return code;
		if(path in this._fnCache)
			return this._fnCache[expandCode._path = path];
		var file = this.ut.getLocalFile(path);
		if(!file)
			throw this.getLocalized("invalidFilePath").replace("%p", path);
		var data = this.io.readFromFile(file);
		if(!data)
			throw this.getLocalized("fileNotFound").replace("%f", file.path);
		expandCode._path = path;
		return data;
	},
	isValidFileData: function(fo) {
		return this.ut.isObject(fo) && !!fo.data;
	},

	_destructors: [],
	_destructorContext: null,
	registerDestructor: function(destructor, context, notifyFlags) {
		var ds = [destructor, context, notifyFlags].concat(this._destructorContext);
		return this._destructors.push(ds) - 1;
	},
	unregisterDestructor: function(uid) {
		delete this._destructors[uid];
	},

	destroyCustomFuncs: function(reason) {
		this.clearFnCaches(reason);
		this._destructors.forEach(function(destructorArr) {
			this.destroyCustomFunc.apply(this, destructorArr.concat(reason));
		}, this);
		this._destructors.length = 0;
	},
	clearFnCaches: function(reason) {
		this.hc.destroyCustomTypes();
		this._typesInitState = { __proto__: null };
		this._fnCache = { __proto__: null };
		if(reason & this.DESTROY_FORCE_PURGE_CACHES) {
			this._log("clearFnCaches(DESTROY_FORCE_PURGE_CACHES)");
			this.removeCached(this.types);
			this.removeCached(this.prefs);
		}
	},
	removeCached: function(o) {
		for(var p in o) if(o.hasOwnProperty(p)) {
			if(p.charAt(0) == "_") {
				delete o[p];
				continue;
			}
			var v = o[p];
			if(this.ut.isObject(v))
				this.removeCached(v);
		}
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
		var eMsg = this.errInfo(isInit ? "funcInitError" : "funcDestroyError", e, type, isDelayed, fObj.label || "");
		this.ut.notifyError(eMsg, {
			buttons: {
				$openEditor: this.wu.getOpenEditorLink(href, eLine),
				$openConsole: this.ut.toErrorConsole
			},
			inWindowCorner: true
		});
		this.ut._err(eMsg, href, eLine);
		this.ut._err(e);
	},

	_defaultData: undefined,
	defaultSettings: function() {
		var data = this._defaultData = this.getSettingsStr({}, {});
		this.pe.saveSettingsAsync(data);
		return data;
	},
	correctSettings: function(types, prefs/*, force*/) {
		types = types || this.types;
		prefs = prefs || this.prefs;

		var forcedDisByType = { __proto__: null };

		for(type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			if(!this.isCustomType(type) || !this.isOkCustomObj(to)) {
				delete types[type];
				continue;
			}
			if(to.hasOwnProperty("enabled") && !to.enabled)
				forcedDisByType[type] = true;
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
	getSettingsStr: function(types, prefs, exportLinkedFiles, noHash) {
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
			if(exportLinkedFiles && key in _this.codeKeys)
				_this.pe.exportFileData(o.files, val);
			return val;
		}, "\t");

		const hashFunc = "SHA256";
		var hashData = noHash ? "" : "// " + hashFunc + ": " + this.getHash(json, hashFunc) + "\n";
		return this.setsHeader + hashData + json;
	},
	codeKeys: {
		contextMenu: true,
		define: true,
		init: true,
		action: true,
		__proto__: null
	},
	get JSON() { // For Firefox < 3.5
		delete this.JSON;
		if(typeof JSON != "undefined")
			this.JSON = JSON;
		else
			this.jsLoader.loadSubScript("chrome://handyclicks/content/json.js", this);
		return this.JSON;
	},
	getHash: function(str, hashFunc) {
		var data = this.io.utf8Converter.convertToByteArray(str, {});
		var ch = Components.classes["@mozilla.org/security/hash;1"]
			.createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch[hashFunc]);
		ch.update(data, data.length);
		var hash = ch.finish(false);
		return Array.prototype.map.call(hash, function(chr) {
			return ("0" + chr.charCodeAt(0).toString(16)).slice(-2);
		}).join("");
	},

	get hasTestSettings() {
		const pSvc = "handyClicksPrefSvc";
		return this.wu.forEachBrowserWindow(function(w) {
			return pSvc in w && w[pSvc].otherSrc;
		});
	},

	get hasUnsaved() {
		return this.getSettingsStr(null, null, false, true)
			!= this.__savedStr.replace(this.hashRe, "");
	},
	__savedStr: "",
	get _savedStr() {
		return this.__savedStr;
	},
	set _savedStr(str) {
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(["handyclicks:settings", "handyclicks:editor"], function(w) {
			if(pSvc in w)
				w[pSvc].__savedStr = str;
		});
	},

	get isMainWnd() {
		delete this.isMainWnd;
		return this.isMainWnd = typeof handyClicksUI != "undefined";
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
	isOkCustomType: function(cType, types) {
		if(!types)
			types = this.types;
		return "hasOwnProperty" in types
			&& types.hasOwnProperty(cType)
			&& this.isOkCustomObj(types[cType]);
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

	getTypeLabel: function(type, isCustomType, types) {
		return (isCustomType === undefined ? this.isCustomType(type) : isCustomType)
				? this.getCustomTypeLabel(type, types)
				: this.getLocalized(type);
	},
	getCustomTypeLabel: function(type, types) {
		var label = this.ut.getOwnProperty(types || this.types, type, "label");
		if(label == undefined)
			this.ut._warn('Custom type not found: "' + type + '"');
		label = label ? this.localize(label) + " " : "";
		return label + "[" + this.removeCustomPrefix(type) + "]";
	},
	localize: function(data) {
		if(!data)
			return data;
		// "String in english @ru: String in Russian @xx: ..."
		var locale = this.ut.xcr.getSelectedLocale("global");
		var locales = { __proto__: null };
		var pos = 0;
		data = data.replace(/ *@([a-z]{2,3}(?:-[A-Z]{2})?): *(?=\S)/g, function(sep, locale) {
			locales[locale] = ++pos;
			return "\x00";
		});
		if(!pos)
			return data;
		var localized = data.split("\x00");
		var localize = function(locale) {
			return locales[locale] && localized[locales[locale]];
		};
		return localize(locale)
			|| /^([a-z]+)-/.test(locale) && localize(RegExp.$1)
			|| localized[0]
			|| localize("en-US")
			|| localize("en");
	},

	errInfo: function(errMsgId, err, type, isDelayed, fnLabel) {
		var typeLabel = this.getTypeLabel(type)
			+ (isDelayed ? " \u21d2 " /* " => " */ + this.getLocalized("delayed") : "");
		return this.getLocalized(errMsgId)
			+ (
				(fnLabel !== undefined ? this.getLocalized("errorLabel") : "")
				+ this.getLocalized("errorDetails")
			)
			.replace("%label", this.localize(fnLabel))
			.replace("%type", typeLabel)
			.replace("%err", err);
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
			ctrl:  this.getStr(src, "VK_CONTROL", "Ctrl"),
			shift: this.getStr(src, "VK_SHIFT", "Shift"),
			alt:   this.getStr(src, "VK_ALT", "Alt"),
			meta:  this.getStr(src, "VK_META", "Meta"),
			os:    this.getStr(src, "VK_WIN", "Win", this.ut.fxVersion > 3.6 ? undefined : -1),
			sep:   this.getStr(src, "MODIFIER_SEPARATOR", "+"),
			__proto__: null
		};
	},
	get spacedSep() {
		delete this.spacedSep;
		return this.spacedSep = " " + this.keys.sep + " ";
	},
	getModifiersStr: function(sh, _short) { // "button=0,ctrl=true,shift=true,alt=false,meta=false"
		var mfds = [];
		var keys = this.keys;
		sh.replace(/(\w+)=true/g, function(s, mdf) {
			mfds.push(keys[mdf]);
		});
		return mfds.length ? mfds.join(keys.sep) : (_short ? "" : this.getLocalized("none"));
	},
	getShortcutStr: function(sh, _short) {
		var button = this.getButtonStr(sh, _short);
		var modifiers = this.getModifiersStr(sh, _short);
		return button + (modifiers ? this.spacedSep + modifiers : "");
	},
	checkPrefs: function(pSrc) {
		return this.checkPrefsStr(
			pSrc instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)
				? this.io.readFromFile(pSrc)
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
	hashRe: /(?:\r\n|\n|\r)\/\/[ \t]?(MD2|MD5|SHA1|SHA512|SHA256|SHA384):[ \t]?([a-f0-9]+)(?=[\n\r]|$)/,
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

		str = this.removePrefsDesription(str);
		var header = RegExp.lastMatch;

		if(this.hashRe.test(header)) { //= Added: 2009-12-18
			this._hashMissing = false;
			var hashFunc = RegExp.$1;
			var hash = RegExp.$2;
			if(hash != this.getHash(str, hashFunc)) {
				this._hashError = true;
				!silent && this.ut._warn("Invalid prefs: wrong checksum");
				return false;
			}
		}

		if(this.isLegacyJs(str))
			str = this.pe.convertToJSON(str, silent);
		try {
			var sets = this.JSON.parse(str);
		}
		catch(e) {
			if(!silent) {
				this.ut._err("Invalid prefs: JSON.parse() failed:\n" + str);
				this.ut._err(e);
			}
			return false;
		}
		if(!this.isValidPrefs(sets)) {
			!silent && this.ut._err("Invalid prefs: prefs object doesn't contains required fields");
			return false;
		}
		if(checkCustom)
			this._hasCustomCode = this.pe.hasCustomCode(sets);
		return true;
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
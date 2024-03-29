var handyClicksPrefSvcExt = {
	__proto__: handyClicksPrefSvc,

	saveSettingsObjects: function(reloadAll) {
		this.saveSettings(this.stringifySettings());
		this.reloadSettings(reloadAll);
	},
	saveSettingsObjectsAsync: function(reloadAll, callback, context) {
		this.delay(function() {
			this.saveSettingsAsync(this.stringifySettings(), function(status) {
				if(Components.isSuccessCode(status))
					this.reloadSettings(reloadAll);
				callback && callback.call(context || this, status);
			}, this);
		}, this);
	},
	saveSettings: function(str, async, callback, context) {
		if(str == this.ps._savedStr) {
			callback && callback.call(context || this, Components.results.NS_OK);
			return;
		}
		var pFile = this.ps.prefsFile;
		this.moveFiles(pFile, this.names.backup);
		if(async) {
			this.io.writeToFileAsync(str, pFile, this.ju.bind(function(status) {
				if(Components.isSuccessCode(status))
					this.settingsSaved(str, true);
				else
					this.saveError(status);
				callback && callback.call(context || this, status);
			}, this));
		}
		else {
			var err = {};
			if(this.io.writeToFile(str, pFile, err))
				this.settingsSaved(str);
			else
				this.saveError(this.ut.getErrorCode(err.value));
		}
	},
	saveSettingsAsync: function(str, callback, context) {
		this.saveSettings(str, true, callback, context);
	},
	settingsSaved: function(str, async) {
		this.ps._savedStr = str;
		if(str == this.ps._defaultData)
			return;
		if(async)
			this.delay(this.checkForBackup, this, 50);
		else
			this.checkForBackup();
	},
	loadError: function() {
		this.loadError = function() {}; // Notify only once
		this.delay(function() { // Avoid "Cannot call openModalWindow on a hidden window" error
			this.ut.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("loadError")
					.replace("%f", this.ps.prefsFile.path)
			);
		}, this);
	},
	saveError: function(status) {
		this.ut.alert(
			this.getLocalized("errorTitle"),
			this.getLocalized("saveError")
				.replace("%f", this.ps.prefsFile.path)
				.replace("%e", this.ut.getErrorName(status))
		);
		this.ut.reveal(this.ps.prefsFile);
	},

	reloadSettings: function(reloadAll) {
		const pSvc = "handyClicksPrefSvc";
		var curOtherSrc = this.currentOtherSrc;
		var types = ["handyclicks:settings", "handyclicks:editor"];
		if(!curOtherSrc) {
			if(this.isSeaMonkey)
				types = null;
			else
				types.push("navigator:browser");
		}
		this.wu.forEachWindow(types, function(w) {
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
		}, this);
	},

	getBackupFile: function(fName, parentDir) {
		if(!parentDir)
			parentDir = this.ps.backupsDir;
		var file = parentDir.clone();
		file.append(fName);
		return file;
	},
	moveFiles: function(firstFile, nameAdd, keepOriginal, noFirstNum, depth) {
		if(!firstFile.exists())
			return null;
		if(depth === undefined)
			depth = this.pu.get("sets.backupDepth");
		var pDir = nameAdd == this.names.corrupted
			? this.ps.corruptedDir
			: this.ps.backupsDir;
		var maxNum = depth - 1;
		var fName = this.prefsFileName + nameAdd;
		function getName(i) {
			if(noFirstNum && i == 0)
				return fName.replace(/-$/, "") + ".js";
			return fName + i + ".js";
		}
		function getFile(i) {
			var file = pDir.clone();
			file.append(getName(i));
			return file;
		}
		var timer = Components.classes["@mozilla.org/timer;1"]
			.createInstance(Components.interfaces.nsITimer);
		timer.init({observe: function() { // Async + handle even if window was closed
			for(var i = maxNum, maxNotExists = 5; ; ) { // Was reduced backups depth?
				var file = getFile(++i);
				if(file.exists())
					file.remove(false);
				else if(!--maxNotExists) // Some files was removed and not renamed?
					break;
			}
		}}, 20, timer.TYPE_ONE_SHOT);
		if(depth <= 0)
			return null;

		var files = [];
		for(var i = 0, di = 0, max = maxNum; i < max; ++i) {
			var file = getFile(i);
			if(!file.exists()) {
				if(++di == 2) // Also rename last file
					max = maxNum + 1;
				continue;
			}
			di && this.ut.moveFileTo(file, pDir, getName(i - di));
			files.push(file);
		}
		for(var i = files.length - 1; i >= 0; --i)
			this.ut.moveFileTo(files[i], pDir, getName(i + 1));

		var tmp = firstFile.clone();
		var name = getName(0);
		if(!keepOriginal)
			this.ut.moveFileTo(tmp, pDir, name);
		else {
			this.ut.copyFileTo(firstFile, pDir, name);
			tmp.leafName = name;
		}
		return tmp.path;
	},
	checkForBackup: function() {
		var prefsFile = this.ps.prefsFile;
		if(!prefsFile.exists())
			return;
		var max = this.pu.get("sets.backupAutoDepth");
		var minInterval = (this.pu.get("sets.backupAutoInterval") || 24*60*60)*1000;
		var bakFiles = [];
		const namePrefix = this.prefsFileName + this.names.autoBackup;
		var backupsDir = this.ps.backupsDir;
		var entries = backupsDir.directoryEntries;
		var r = RegExp;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(
				entry.isFile()
				&& this.ju.startsWith(fName, namePrefix)
				&& /-(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\.js$/i.test(fName)
			) {
				bakFiles.push({
					file: entry,
					time: new Date(r.$1, r.$2 - 1, r.$3, r.$4, r.$5, r.$6).getTime()
				});
			}
		}
		bakFiles.sort(function(a, b) {
			return a.time - b.time;
		});
		var now = Date.now();
		if(max > 0 && (!bakFiles.length || now >= bakFiles[bakFiles.length - 1].time + minInterval)) {
			var fName = namePrefix + this.getTimeString(now) + ".js";
			this.ut.copyFileTo(prefsFile, backupsDir, fName);
			bakFiles.push(null); // Dummy...
			this._log("checkForBackup(): " + fName);
		}
		else {
			this._log("checkForBackup(): No backup");
		}
		while(bakFiles.length > max)
			this.ut.removeFile(bakFiles.shift().file, false);
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
	loadSettingsBackup: function() {
		var pFile = this.ps.prefsFile;
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
			this.ut.moveFileTo(tmp, this.ps.corruptedDir, this.prefsFileName + this.names.corrupted.replace(/-$/, "") + ".js");
			corruptedPath = tmp.path;
		}
		var errTitle = this.getLocalized("errorTitle");
		var errMsg = this.getLocalized("badJSFile").replace("%f", corruptedPath);
		var bFile = this.getBackup();
		if(bFile) {
			var bakPath = bFile.path;
			this.ps._restoredFromBackup = true;
			var restoredPath = this.moveFiles(bFile, this.names.restored, true);
			this.ut.moveFileTo(bFile, pFile.parent, pFile.leafName);
			errMsg += this.getLocalized("restoredFromBackup")
				.replace("%b", bakPath)
				.replace("%r", restoredPath);
		}
		this.delay(function() {
			this.ut.alert(errTitle, errMsg);
		}, this);
		bFile && this.reloadSettings(true);
	},
	getBackup: function() {
		if("_backups" in this)
			return this._backups.pop();
		var bakFiles = this._backups = [];
		const fPrefix = this.ps.prefsFileName;
		var names = this.ps.names;
		const prefixes = [names.backup, names.autoBackup, names.beforeImport];
		var entries = this.ps.backupsDir.directoryEntries;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(!entry.isFile() || !/\.js$/i.test(fName) || !this.ju.startsWith(fName, fPrefix))
				continue;
			var checkName = fName.substr(fPrefix.length);
			if(prefixes.some(function(prefix) { return this.ju.startsWith(checkName, prefix); }, this))
				bakFiles.push(entry);
		}
		bakFiles.sort(function(a, b) {
			return a.lastModifiedTime - b.lastModifiedTime; // oldest ... newest
		});
		this._info("getBackup():\n" + bakFiles.map(function(f) { return f.leafName; }).join("\n"));
		return bakFiles.pop();
	},

	testSettings: function(isTest) {
		var src = null;
		var notifyFlags = this.SETS_TEST;
		if(isTest) {
			src = this.stringifySettings();
			this.delay(function() {
				this.createTestBackup(src);
			}, this);
		}
		else {
			notifyFlags |= this.SETS_TEST_UNDO;
		}
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachBrowserWindow(function(w) {
			if(!(pSvc in w))
				return;
			var p = w[pSvc];
			p.oSvc.notifyObservers(notifyFlags | this.SETS_BEFORE_RELOAD);
			p.loadSettings(src);
			p.oSvc.notifyObservers(notifyFlags | this.SETS_RELOADED);
		}, this);
	},
	createTestBackup: function(pStr) {
		var depth = this.pu.get("sets.backupTestDepth");
		if(depth < 1)
			return;
		var fName = this.prefsFileName + this.names.testBackup;
		for(var num = Math.max(0, depth - 2); num >= 0; --num) {
			var file = this.getBackupFile(fName + num + ".js");
			if(num == 0)
				var bakFile = file.clone();
			if(depth > 1 && file.exists()) {
				this.ut.moveFileTo(file, this.ps.backupsDir, fName + (num + 1) + ".js");
				this.ut.deleteTemporaryFileOnExit(file);
			}
		}
		this.io.writeToFileAsync(pStr, bakFile);
		this.ut.deleteTemporaryFileOnExit(bakFile);
		this.storage.set("testBackupCreated", true);
	},

	hasCustomCode: function(sets) {
		return this.forEachCode(sets, function() {
			return true;
		});
	},

	exportFileData: function(files, code) {
		var path = this.getSourcePath(code);
		if(!path)
			return "";
		var exported = files._exported || (files._exported = { __proto__: null });
		if(path in exported)
			return "";
		exported[path] = true;
		var file = this.ut.getLocalFile(path);
		if(!file) {
			this.ut._warn("Export skipped, invalid path: " + path);
			return path;
		}
		if(!this.importAllowed(file)) {
			this.ut._warn("Export not allowed for " + path + "\n=> " + file.path + this._importPathsInfo);
			return path + "\n=> " + file.path;
		}
		var data = this.io.readFromFile(file);
		if(!data) {
			this.ut._warn("Export skipped, file is empty or missing: " + path + "\n=> " + file.path);
			return path + "\n=> " + file.path;
		}
		files[path] = {
			lastModified: file.lastModifiedTime,
			size: file.fileSize,
			data: data
		};
		return "";
	},
	importAllowed: function(file) {
		if(this.ps._scriptsDir.contains(file, false /* aRecurse, for Firefox 31 and older */))
			return true;
		var paths = this.pu.get("sets.importPaths");
		return paths && paths.split(/\s*\|\s*/).some(function(path) {
			var dir = this.ut.getLocalFile(path);
			return dir && dir.contains(file, false /* aRecurse, for Firefox 31 and older */);
		}, this);
	},
	get _importPathsInfo() {
		var paths = this.pu.get("sets.importPaths");
		return "\nAllowed path:"
			+ "\n  " + this.ps._scriptsDir.path + " (%hc_ScriptsDir%/…)"
			+ '\nUser-defined allowed paths, "' + this.pu.prefNS
			+ 'sets.importPaths" preference (example: "D:\\hcScripts|%CurProcD%\\hcScripts"):'
			+ "\n  " + (paths ? paths.replace(/\s*\|\s*/g, "\n  ") : "(not specified)");
	},
	filterFilesData: function(files) {
		if(!files)
			return false;
		var filtered = false;
		var linkedPaths = { __proto__: null };
		this.forEachCode(this, function(code) {
			var path = code && this.getSourcePath(code);
			if(path)
				linkedPaths[path] = true;
		}, this);
		for(var path in files) if(files.hasOwnProperty(path)) {
			var fd = files[path];
			if(fd && fd._locked || false) {
				this._log("filterFilesData(): locked path: " + path);
				continue;
			}
			if(!this.isValidFileData(fd)) {
				this.ut._warn("[Import] Ignore invalid or empty file data: " + path);
				delete files[path];
				filtered = true;
			}
			if(!(path in linkedPaths)) {
				this.ut._warn("[Import] Ignore not linked path in files object: " + path);
				delete files[path];
				filtered = true;
			}
		}
		return filtered;
	},
	isValidFileData: function(fo) {
		return this.ju.isObject(fo) && !!fo.data;
	},
	forEachCode: function(sets, callback, context) {
		var getCode = this.ju.bind(function(o, key) {
			var code = this.ju.getOwnProperty(o, key);
			return callback.call(context, code, o, key);
		}, this);
		var prefs = sets.prefs;
		var types = sets.types;
		for(var type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			if(getCode(to, "define") || getCode(to, "contextMenu"))
				return true;
		}
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(this.ju.getOwnProperty(to, "custom")) {
					if(getCode(to, "init") || getCode(to, "action"))
						return true;
				}
				var da = this.ju.getOwnProperty(to, "delayedAction");
				if(da && this.ju.getOwnProperty(da, "custom")) {
					if(getCode(da, "init") || getCode(da, "action"))
						return true;
				}
			}
		}
		return false;
	},

	convertToJSON: function(s, silent) { //= Added: 2012-01-13
		if(s.substr(0, 4) != "var ")
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
				.replace(/^(\s*)(\$?\w+): /mg, '$1"$2": ')
				.replace(/;\s*$/, "")
				//.replace(/^\s+/mg, "")
				//.replace(/[\n\r]+/g, "")

				// Rename properties:
				.replace(/^(\s*)"handyClicksPrefsVersion":/m, '$1"version":')
				.replace(/^(\s*)"handyClicksCustomTypes":/m,  '$1"types":')
				.replace(/^(\s*)"handyClicksPrefs":/m,        '$1"prefs":')
			+ "\n}";
	}
};
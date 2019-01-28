var handyClicksPrefSvcExt = {
	__proto__: handyClicksPrefSvc,

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
	saveSettings: function(str, async, callback, context) {
		if(str == this.ps._savedStr) {
			callback && callback.call(context || this, Components.results.NS_OK);
			return;
		}
		var pFile = this.ps.prefsFile;
		this.moveFiles(pFile, this.names.backup);
		if(async) {
			this.ut.writeToFileAsync(str, pFile, this.ut.bind(function(status) {
				if(Components.isSuccessCode(status))
					this.settingsSaved(str, true);
				else
					this.saveError(status);
				callback && callback.call(context || this, status);
			}, this));
		}
		else {
			var err = {};
			if(this.ut.writeToFile(str, pFile, err))
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
		if(async)
			this.delay(this.checkForBackup, this, 50);
		else
			this.checkForBackup();
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
			if(this.ut.isSeaMonkey)
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
	moveFiles: function(firstFile, nameAdd, leaveOriginal, noFirstNum, depth) {
		if(!firstFile.exists())
			return null;
		if(depth === undefined)
			depth = this.pu.get("sets.backupDepth");
		var pDir = nameAdd == this.names.corrupted
			? this.ps.corruptedDir
			: this.ps.backupsDir;
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
				&& this.ut.hasPrefix(fName, namePrefix)
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
			this.ut.moveFileTo(tmp, this.ps.backupsDir, this.prefsFileName + this.names.corrupted.replace(/-$/, "") + ".js");
			corruptedPath = tmp.path;
		}
		while(++this.ps._restoringCounter <= this.pu.get("sets.backupDepth")) {
			var bName = this.prefsFileName + this.names.backup + (this.ps._restoringCounter - 1) + ".js";
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
		bakPath && this.reloadSettings(true);
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
				this.ut.moveFileTo(file, this.ps.backupsDir, fName + (num + 1) + ".js");
				this.ut.deleteTemporaryFileOnExit(file);
			}
		}
		this.ut.writeToFile(pStr, bakFile);
		this.ut.deleteTemporaryFileOnExit(bakFile);

		this.ut.storage("testBackupCreated", true);
	},

	exportFileData: function(files, code) {
		var path = this.getSourcePath(code);
		if(!path)
			return;
		var exported = files._exported || (files._exported = { __proto__: null });
		if(path in exported)
			return;
		exported[path] = true;
		var file = this.ut.getLocalFile(path);
		if(!file) {
			this.ut._warn("Export skipped, invalid path: " + path);
			return;
		}
		if(!this.importAllowed(file)) {
			this.ut._warn("Export not allowed for " + path + " -> " + file.path);
			return;
		}
		var data = this.ut.readFromFile(file);
		if(!data) {
			this.ut._warn("Export skipped, file is empty or missing: " + path + " -> " + file.path);
			return;
		}
		files[path] = {
			lastModified: file.lastModifiedTime,
			size: file.fileSize,
			data: data
		};
	},
	importAllowed: function(file) { //~ todo: add pref?
		return this.ps._scriptsDir.contains(file, false /* aRecurse, for Firefox 31 and older */);
	},
	filterFilesData: function(files, prefs, types) {
		if(!files)
			return null;
		var linkedPaths = { __proto__: null };
		var addPath = this.ut.bind(function() {
			var code = this.ut.getOwnProperty.apply(this.ut, arguments);
			var path = code && this.getSourcePath(code);
			if(path)
				linkedPaths[path] = true;
		}, this);
		for(var type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			addPath(to, "define");
			addPath(to, "contextMenu");
		}
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				addPath(to, "init");
				addPath(to, "action");
				var da = this.ut.getOwnProperty(to, "delayedAction");
				if(da) {
					addPath(da, "init");
					addPath(da, "action");
				}
			}
		}
		for(var path in files) if(files.hasOwnProperty(path)) {
			if(!(path in linkedPaths)) {
				this.ut._warn("[Import] Ignore not linked path in files object: " + path);
				delete files[path];
			}
		}
		return files;
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
				.replace(/^(\s*)(\w+): /mg, '$1"$2": ')
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
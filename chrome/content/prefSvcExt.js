var handyClicksPrefSvcExt = {
	__proto__: handyClicksGlobals,

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
		var pDir = nameAdd == this.ps.names.corrupted
			? this.ps.corruptedDir
			: this.ps.backupsDir;
		var maxNum = depth - 1;
		var fName = this.ps.prefsFileName + nameAdd;
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
		if(!this.ps.prefsFile.exists())
			return;
		var minBackupInterval = (this.pu.get("sets.backupAutoInterval") || 24*60*60)*1000;
		var backupsDir = this.ps.backupsDir;
		var entries = backupsDir.directoryEntries;
		var entry, fName, fTime;
		var _fTimes = [], _files = {};
		const namePrefix = this.ps.prefsFileName + this.ps.names.autoBackup;
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
		if(max > 0 && (!_fTimes.length || now >= _fTimes[_fTimes.length - 1] + minBackupInterval)) {
			_fTimes.push(now);
			fName = namePrefix + this.getTimeString(now) + ".js";
			this.ut.copyFileTo(this.ps.prefsFile, backupsDir, fName);
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
	loadSettingsBackup: function() {
		var pFile = this.ps.prefsFile;
		var corruptedPath = this.moveFiles(
			pFile,
			this.ps.names.corrupted,
			false,
			false,
			this.pu.get("sets.backupCorruptedDepth")
		);
		if(pFile.exists()) { // Backups disabled
			var tmp = pFile.clone();
			// But save backup anyway :)
			this.ut.moveFileTo(tmp, this.ps.backupsDir, this.ps.prefsFileName + this.ps.names.corrupted.replace(/-$/, "") + ".js");
			corruptedPath = tmp.path;
		}
		while(++this.ps._restoringCounter <= this.pu.get("sets.backupDepth")) {
			var bName = this.ps.prefsFileName + this.ps.names.backup + (this.ps._restoringCounter - 1) + ".js";
			var bFile = this.getBackupFile(bName);
			if(bFile.exists()) {
				var bakPath = this.moveFiles(bFile, this.ps.names.restored, true);
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
		this.ps.loadSettings();
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
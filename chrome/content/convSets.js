// This file is loaded from prefSvc.js with handyClicksPrefSvc.setsMigration getter
// this === handyClicksPrefSvc
function setsMigration(allowSave, vers) {
	if(vers === undefined)
		vers = this.loadedVersion || 0;
	if(vers >= this.setsVersion)
		return;

	if(vers < 0.12 && allowSave) { //= Added: 2009-07-29
		// New file names format
		var convertName = function(s) {
			return s.replace(/^(handyclicks_prefs)-(\w+-\d+(?:\.\d+)?\.js)$/, "$1_$2");
		};
		var entries = this.prefsDir.directoryEntries;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(!entry.isFile())
				continue;
			var newName = convertName(entry.leafName);
			if(newName == entry.leafName)
				continue;
			//entry.moveTo(null, newName);
			var newFile = entry.parent.clone();
			newFile.append(newName);
			// Simple way to get unique file name
			newFile.createUnique(newFile.NORMAL_FILE_TYPE, this.io.PERMS_FILE_WRITE);
			entry.moveTo(null, newFile.leafName);
		}
	}
	if(vers < 0.13) { //= Added: 2009-08-10
		// Arguments:
		//   "hidePopup" -> "closePopups" (old)
		//   "inWin"     -> "winRestriction"
		//   "toNewWin"  -> "target"
		// Functions:
		//   submitFormToNewDoc -> submitForm
		var changeArg = function(obj, curName, newName, valConv) {
			// { p0: 0, curName: 1, p2: 2 } => { p0: 0, newName: 1, p2: 2 }
			if(!obj.hasOwnProperty(curName))
				return;
			var a = { __proto__: null };
			for(var aName in obj) if(obj.hasOwnProperty(aName)) {
				var aVal = obj[aName];
				a[aName == curName ? newName : aName] = valConv ? valConv(aVal) : aVal;
				delete obj[aName];
			}
			for(aName in a)
				obj[aName] = a[aName];
		};
		var changeTypeObj = this.ju.bind(function(to) {
			if(this.ju.getOwnProperty(to, "custom"))
				return;
			var act = this.ju.getOwnProperty(to, "action");
			if(act == "submitFormToNewDoc")
				to.action = "submitForm";
			else if(act == "openUriInWindow")
				try { delete to.arguments.loadJSInBackground; } catch(e) {}

			var args = this.ju.getOwnProperty(to, "arguments");
			if(!this.ju.isObject(args))
				return;
			changeArg(args, "hidePopup", "closePopups");
			changeArg(args, "inWin", "winRestriction");
			changeArg(args, "toNewWin", "target", function(v) { return v ? "win" : "tab"; });
		}, this);
		var prefs = this.prefs;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.ju.isObject(to))
					continue;
				changeTypeObj(to);
				var da = this.ju.getOwnProperty(to, "delayedAction");
				if(this.ju.isObject(da))
					changeTypeObj(da);
			}
		}
	}
	if(vers < 0.14) { //= Added: 2010-01-27
		// Functions:
		//   openIn => openURIIn
		//   openUriIn => openURIIn
		var convAct = this.ju.bind(function(to) {
			if(this.ju.getOwnProperty(to, "custom"))
				return;
			var act = this.ju.getOwnProperty(to, "action");
			if(act)
				to.action = act.replace(/^(_?)open(?:Uri)?In/, "$1openURIIn");
		}, this);
		var prefs = this.prefs;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.ju.isObject(to))
					continue;
				convAct(to);
				var da = this.ju.getOwnProperty(to, "delayedAction");
				if(this.ju.isObject(da))
					convAct(da);
			}
		}
	}
	if(vers < 0.2) { //= Added: 2010-05-14
		// Strings are not encoded anymore
		var recode = this.ju.bind(function(obj, pName) {
			var pVal = this.ju.getOwnProperty(obj, pName);
			if(!pVal)
				return;
			try {
				pVal = decodeURIComponent(pVal || "");
			}
			catch(e) {
				this.ut._err("Can't decode \"" + pName + "\"\n" + pVal);
				this.ut._err(e);
				pVal = "[invalid value]";
			}
			obj[pName] = pVal;
		}, this);
		var recodeTypeObj = this.ju.bind(function(to) {
			if(!this.ju.getOwnProperty(to, "custom"))
				return;
			recode(to, "label");
			recode(to, "action");
			recode(to, "init");
		}, this);

		var prefs = this.prefs;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.ju.isObject(to))
					continue;
				recodeTypeObj(to);
				var da = this.ju.getOwnProperty(to, "delayedAction");
				if(!this.ju.isObject(da))
					continue;
				recodeTypeObj(da);
			}
		}

		var types = this.types;
		for(var type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			if(!this.ju.isObject(to))
				continue;
			recode(to, "label");
			recode(to, "define");
			recode(to, "contextMenu");
		}
	}
	if(vers < 0.3) { //= Added: 2012-01-13
		// See converter in handyClicksPrefSvc.loadSettings() and handyClicksPrefSvcExt.convertToJSON().
		// So just resave settings.

		// Store backups in separate directory
		if(allowSave) {
			var entries = this.prefsDir.directoryEntries;
			var backupsDir = this.backupsDir;
			const fPrefix = this.prefsFileName;
			const mainFile = fPrefix + ".js";
			while(entries.hasMoreElements()) {
				var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
				var fName = entry.leafName;
				if(
					!entry.isFile()
					|| !this.ju.startsWith(fName, fPrefix)
					|| !/\.js$/i.test(fName)
					|| fName == mainFile
				)
					continue;
				//entry.moveTo(backupsDir, fName);
				var newFile = this.pe.getBackupFile(fName);
				// Simple way to get unique file name
				newFile.createUnique(newFile.NORMAL_FILE_TYPE, this.io.PERMS_FILE_WRITE);
				entry.moveTo(backupsDir, newFile.leafName);
			}
		}
	}
	if(vers < 0.4) { //= Added: 2018-12-28
		var prefs = this.prefs;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			if(so.hasOwnProperty("img") && this.ju.isObject(so.img)) {
				so.img.ignoreLinks = so.img.ignoreLinks || false;
				so.img.ignoreSingle = so.img.ignoreSingle || false;
			}
			if(
				so.hasOwnProperty("tab")
				&& this.ju.isObject(so.tab)
				&& !so.tab.hasOwnProperty("excludeCloseButton")
			)
				so.tab.excludeCloseButton = true;
			if(
				so.hasOwnProperty("ext_mulipletabs")
				&& this.ju.isObject(so.ext_mulipletabs)
				&& !so.ext_mulipletabs.hasOwnProperty("excludeCloseButton")
			)
				so.ext_mulipletabs.excludeCloseButton = true;
		}
	}

	if(!allowSave)
		this.loadedVersion = this.setsVersion;
	else {
		this.pe.moveFiles(this.prefsFile, this.names.version + vers + "-", true, true);
		this.pe.saveSettingsObjectsAsync();
	}
	this._info("Format of prefs file updated: " + vers + " => " + this.setsVersion);
}
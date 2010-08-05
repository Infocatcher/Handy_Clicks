// This file is loaded from prefSvc.js with handyClicksPrefSvc.setsMigration getter
// this === handyClicksPrefSvc
function setsMigration(allowSave, vers) {
	if(vers === undefined)
		vers = this.loadedVersion || 0;
	if(vers >= this.setsVersion)
		return;

	if(allowSave)
		this.prefsFile.moveTo(null, this.prefsFileName + this.names.version + vers + ".js");
	if(vers < 0.12) { //= Added: 2009-07-29
		// New file names format
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
			var a = { __proto__: null }, aName, aVal;
			for(aName in obj) if(obj.hasOwnProperty(aName)) {
				aVal = obj[aName];
				a[aName == curName ? newName : aName] = valConv ? valConv(aVal) : aVal;
				delete obj[aName];
			}
			for(aName in a)
				obj[aName] = a[aName];
		}
		var changeTypeObj = this.ut.bind(function(to) {
			if(this.ut.getOwnProperty(to, "custom"))
				return;
			var act = this.ut.getOwnProperty(to, "action");
			if(act == "submitFormToNewDoc")
				to.action = "submitForm";
			else if(act == "openUriInWindow")
				try { delete to.arguments.loadJSInBackground; } catch(e) {}

			var args = this.ut.getOwnProperty(to, "arguments");
			if(!this.ut.isObject(args))
				return;
			changeArg(args, "hidePopup", "closePopups");
			changeArg(args, "inWin", "winRestriction");
			changeArg(args, "toNewWin", "target", function(v) { return v ? "win" : "tab"; });
		}, this);
		var prefs = this.prefs;
		var sh, so, type, to, da;
		for(sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.ut.isObject(to))
					continue;
				changeTypeObj(to);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(this.ut.isObject(da))
					changeTypeObj(da);
			}
		}
	}
	if(vers < 0.14) { //= Added: 2010-01-27
		// Functions:
		//   openIn => openURIIn
		//   openUriIn => openURIIn
		var convAct = this.ut.bind(function(to) {
			if(this.ut.getOwnProperty(to, "custom"))
				return;
			var act = this.ut.getOwnProperty(to, "action");
			if(act)
				to.action = act.replace(/^(_?)open(?:Uri)?In/, "$1openURIIn");
		}, this);
		var prefs = this.prefs;
		var sh, so, type, to, da;
		var act, dAct;
		for(sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.ut.isObject(to))
					continue;
				convAct(to);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(this.ut.isObject(da))
					convAct(da);
			}
		}
	}
	if(vers < 0.2) { //= Added: 2010-05-14
		// Strings are not encoded anymore
		var recode = this.ut.bind(function(obj, pName) {
			var pVal = this.ut.getOwnProperty(obj, pName);
			if(!pVal)
				return;
			try {
				pVal = decodeURIComponent(pVal || "");
			}
			catch(e) {
				this.ut._err(<>Can't decode "{pName}":{"\n" + pVal}</>);
				this.ut._err(e);
				pVal = "[invalid value]";
			}
			obj[pName] = pVal;
		}, this);
		var recodeTypeObj = this.ut.bind(function(to) {
			if(!this.ut.getOwnProperty(to, "custom"))
				return;
			recode(to, "label");
			recode(to, "action");
			recode(to, "init");
		}, this);

		var prefs = this.prefs;
		var sh, so, type, to, da;
		for(sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.isOkShortcut(sh))
				continue;
			so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.ut.isObject(to))
					continue;
				recodeTypeObj(to);
				da = this.ut.getOwnProperty(to, "delayedAction");
				if(!this.ut.isObject(da))
					continue;
				recodeTypeObj(da);
			}
		}

		var types = this.types;
		var type, to;
		for(var type in types) if(types.hasOwnProperty(type)) {
			to = types[type];
			if(!this.ut.isObject(to))
				continue;
			recode(to, "label");
			recode(to, "define");
			recode(to, "contextMenu");
		}
	}
	this.ut._info("Format of prefs file updated: " + vers + " => " + this.setsVersion);
	if(allowSave)
		this.saveSettingsObjects();
	else
		this.loadedVersion = this.setsVersion;
}
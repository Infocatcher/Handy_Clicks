//~ todo: UTF-8
var handyClicksPrefServ = {
	ut: handyClicksUtils, // shortcut
	warnComment: "// Preferences of Handy Clicks extension\n// Do not edit this file.\n\n",
	defaultPrefs: "var handyClicksPrefs = {};\nvar handyClicksCustomTypes = {};",
	prefsFileName: "handyclicks_prefs.js",
	get profileDir() {
		var dirServ = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);
		return dirServ.get("ProfD", Components.interfaces.nsILocalFile);
	},
	get prefsFile() {
		var pFile = this.profileDir;
		pFile.append(this.prefsFileName);
		return pFile;
	},
	loadSettings: function() {
		var prefsFile = this.prefsFile;
		if(!prefsFile.exists())
			this.saveSettings(this.warnComment + this.defaultPrefs, prefsFile);

		var ioServ = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		var jsLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);

		try {
			jsLoader.loadSubScript(ioServ.newFileURI(prefsFile).spec);
		}
		catch(e) {
			// Bug 418356 ( https://bugzilla.mozilla.org/show_bug.cgi?id=418356 )
			alert("Bug 418356\nTry eval()");
			var fiStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Components.interfaces.nsIFileInputStream);
			var siStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance(Components.interfaces.nsIScriptableInputStream);
			fiStream.init(prefsFile, -1, 0, 0);
			siStream.init(fiStream);

			var data = siStream.read(siStream.available());
			siStream.close();
			fiStream.close();
			eval(data);
			window.handyClicksPrefs = handyClicksPrefs;
			window.handyClicksCustomTypes = handyClicksCustomTypes;
		}
		if(typeof handyClicksPrefs != "object")
			window.handyClicksPrefs = {};
		if(typeof handyClicksCustomTypes != "object")
			window.handyClicksCustomTypes = {};
		else
			this.convertCystomTypes();
	},
	convertCystomTypes: function() {
		for(var type in handyClicksCustomTypes) {
			try {
				handyClicksCustomTypes[type]._define = this.compileStr(handyClicksCustomTypes[type].define);
				handyClicksCustomTypes[type]._contextMenu = this.compileStr(handyClicksCustomTypes[type].contextMenu);
			}
			catch(e) {
				this.ut._error("[Handy Clicks]: error in custom type " + type + "\n" + e);
			}
		}
	},
	compileStr: function(str) {
		return !str ? null : new Function(decodeURIComponent(str));
	},
	saveSettingsObjects: function() {
 		var res = this.warnComment + "var handyClicksPrefs = {\n";
		var shortcutObj, itemTypeObj, propVal;
		for(var shortcut in handyClicksPrefs) { // test for Ok?
			shortcutObj = handyClicksPrefs[shortcut];
			res += '\t"' + shortcut + '": {\n';
			for(var itemType in shortcutObj) {
				itemTypeObj = shortcutObj[itemType];
				res += "\t\t" + itemType + ": {\n";
				for(var propName in itemTypeObj) {
					propVal = itemTypeObj[propName];
					res += "\t\t\t" + propName + ": " + this.objToSource(propVal) + ",\n";
				}
				res = this.delLastComma(res) + "\t\t},\n";
			}
			res = this.delLastComma(res) + "\t},\n";
		}
		res = this.delLastComma(res) + "};\n";

		res += "var handyClicksCustomTypes = {\n";
		for(var itemType in handyClicksCustomTypes) {
			itemTypeObj = handyClicksCustomTypes[itemType];
			res += "\t" + itemType + ": {\n";
			for(var propName in itemTypeObj) {
				propVal = itemTypeObj[propName];
				if(propName.indexOf("_") != 0)
					res += "\t\t" + propName + ": " + this.objToSource(propVal) + ",\n";
			}
			res = this.delLastComma(res) + "\t},\n";
		}
		res = this.delLastComma(res) + "};";

		if(confirm("Save?"))
			this.saveSettings(res);
	},
	objToSource: function(obj) {
		return uneval(obj).replace(/^\(|\)$/g, "");
	},
	delLastComma: function(str) {
		return str.replace(/,\n$/, "\n");
	},
	saveSettings: function(str, prefsFile) {
		prefsFile = prefsFile || this.prefsFile;
		if(prefsFile.exists()) {
			prefsFile.moveTo(this.profileDir, this.prefsFileName + ".bak");
			prefsFile = this.prefsFile;
		}
		this.writeToFile(str, prefsFile);
	},
	writeToFile: function(str, file) {
		var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		stream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		stream.write(str, str.length);
		stream.close();
	}
};
handyClicksPrefServ.loadSettings();
// setInterval("handyClicksPrefServ.loadSettings();", 2000);
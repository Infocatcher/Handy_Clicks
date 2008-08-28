var totalClicksPrefServ = {
	defaultPrefs: "var totalClicksPrefs = {};",
	prefsFileName: "totalclicks.js",
	dirServ: Components.classes["@mozilla.org/file/directory_service;1"]
		.getService(Components.interfaces.nsIProperties),
	jsLoader: Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader),
	get prefsFile() {
		var pFile = this.dirServ.get("ProfD", Components.interfaces.nsILocalFile);
		pFile.append(this.prefsFileName);
		return pFile;
	},
	loadSettings: function() {
		var prefsFile = this.prefsFile;
		if(!prefsFile.exists()) {
			this.writeToFile(this.defaultPrefs, prefsFile);
		}

		var ioServ = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);

		try {
			this.jsLoader.loadSubScript(ioServ.newFileURI(prefsFile).spec);
		}
		catch(e) {
			// Bug 418356
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
			window.totalClicksPrefs = totalClicksPrefs;
		}
	},
	saveSettings: function() {
		// totalClicksPrefs => save
		// str => save
		this.writeToFile(str, this.prefsFile);
	},
	writeToFile: function(str, file) {
		var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		stream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		stream.write(str, str.length);
		stream.close();
	}
};
totalClicksPrefServ.loadSettings();
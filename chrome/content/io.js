var handyClicksIO = {
	__proto__: handyClicksGlobals,

	// File I/O (only UTF-8):
	PERMS_FILE_READ:        parseInt("0444", 8),
	PERMS_FILE_WRITE:       parseInt("0644", 8),
	PERMS_FILE_OWNER_READ:  parseInt("0400", 8),
	PERMS_FILE_OWNER_WRITE: parseInt("0600", 8),
	PERMS_DIRECTORY:        parseInt("0755", 8),

	writeToFile: function(str, file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.ut.getLocalFile(file);
		this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		try {
			fos.init(file, 0x02 | 0x08 | 0x20, this.PERMS_FILE_WRITE, 0);
		}
		catch(e) {
			this.ut._err("Can't write string to file " + this.ut._fileInfo(file));
			this.ut._err(e);
			fos.close();
			if(outErr)
				outErr.value = e;
			return false;
		}
		var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		cos.init(fos, "UTF-8", 0, 0);
		cos.writeString(str);
		cos.close(); // this closes fos
		return true;
	},
	get textEncoder() {
		delete this.textEncoder;
		if(typeof TextEncoder != "undefined") // Firefox 18+
			return this.textEncoder = new TextEncoder();
		return this.textEncoder = null;
	},
	writeToFileAsync: function(str, file, callback, context) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.ut.getLocalFile(file);

		var encoder = this.textEncoder;
		if(encoder && this.fxVersion >= 20) {
			this._log("writeToFileAsync(): will use OS.File.writeAtomic()");
			Components.utils["import"]("resource://gre/modules/osfile.jsm");
			var onFailure = function(err) {
				err && this.ut._err(err);
				this.ut._err("Can't write string to file " + this.ut._fileInfo(file));
				callback && callback.call(context || this, Components.results.NS_ERROR_FAILURE);
			}.bind(this);
			try {
				var arr = encoder.encode(str);
			}
			catch(e) {
				onFailure(e);
				return false;
			}
			// Note: we move file into backups directory first, so "tmpPath" parameter isn't needed
			var options = {};
			if(
				this.fxVersion < 25
				|| this.isPaleMoon && this.appVersion < 27
			)
				options.tmpPath = file.path + ".tmp";
			OS.File.writeAtomic(file.path, arr, options).then(
				function onSuccess() {
					callback && callback.call(context || this, Components.results.NS_OK, str);
				}.bind(this),
				onFailure
			).then(null, Components.utils.reportError);
			return true;
		}

		try {
			Components.utils["import"]("resource://gre/modules/NetUtil.jsm");
			Components.utils["import"]("resource://gre/modules/FileUtils.jsm");
		}
		catch(e) {
			this._log("writeToFileAsync: asynchronous API not available");
			this.writeToFileAsync = function(str, file, callback, context) {
				var err = { value: undefined };
				this.writeToFile(str, file, err);
				err = err.value;
				callback && callback.call(context || this, this.ut.getErrorCode(err), err ? undefined : str);
				return !err;
			};
			return this.writeToFileAsync.apply(this, arguments);
		}
		this._log("writeToFileAsync(): will use NetUtil.asyncCopy()");
		try {
			this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
			var ostream = FileUtils.openSafeFileOutputStream(file);
			var uc = this.utf8Converter;
			var istream = uc.convertToInputStream(str);
			NetUtil.asyncCopy(istream, ostream, this.ju.bind(function(status) {
				var err = !Components.isSuccessCode(status);
				if(err)
					this.ut._err("NetUtil.asyncCopy() failed: " + this.ut.getErrorName(status));
				callback && callback.call(context || this, status, err ? undefined : str);
			}, this));
		}
		catch(e) {
			this.ut._err("Can't write string to file " + this.ut._fileInfo(file));
			this.ut._err(e);
			callback && callback.call(context || this, this.ut.getErrorCode(e));
			return false;
		}
		return true;
	},
	readFromFile: function(file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.ut.getLocalFile(file);
		// Don't check permissions: this is slow
		//this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_READ);
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, this.PERMS_FILE_READ, 0);
		}
		catch(e) {
			if(outErr && ("" + e).indexOf("NS_ERROR_FILE_NOT_FOUND") != -1)
				this._log("readFromFile(): file not found:\n" + this.ut._fileInfo(file));
			else {
				this.ut._err("Can't read string from file " + this.ut._fileInfo(file));
				this.ut._err(e);
			}
			fis.close();
			if(outErr)
				outErr.value = e;
			return "";
		}
		var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
			.createInstance(Components.interfaces.nsIScriptableInputStream);
		sis.init(fis);
		var str = sis.read(fis.available());
		sis.close();
		fis.close();
		return this.convertToUnicode(str);
	},
	readLineFromFile: function(file, outErr, callback, context) {
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, this.PERMS_FILE_READ, 0);
		}
		catch(e) {
			if(outErr)
				outErr.value = e;
			this._log("Can't read line(s) from file " + this.ut._fileInfo(file));
			Components.utils.reportError(e);
			fis.close();
			return "";
		}
		var cis = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		// This assumes that fis is the nsIInputStream you want to read from
		cis.init(fis, "UTF-8", 1024, cis.DEFAULT_REPLACEMENT_CHARACTER);
		if(!(cis instanceof Components.interfaces.nsIUnicharLineInputStream)) {
			this.ut._err("readLineFromFile(): missed nsIUnicharLineInputStream");
			fis.close();
			cis.close();
			return "";
		}
		var line = {};
		for(; cis.readLine(line); ) {
			var lv = line.value;
			if(!callback || callback.call(context, lv))
				break;
		}
		fis.close();
		cis.close();
		return lv || "";
	},
	get textDecoder() {
		delete this.textDecoder;
		if(typeof TextDecoder != "undefined") // Firefox 18+
			return this.textDecoder = new TextDecoder();
		return this.textDecoder = null;
	},
	readFromFileAsync: function(file, callback, context) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.ut.getLocalFile(file);

		var decoder = this.textDecoder;
		if(decoder && this.fxVersion >= 20) {
			this._log("readFromFileAsync(): will use OS.File.read()");
			Components.utils["import"]("resource://gre/modules/osfile.jsm");
			var onFailure = function(err) {
				var noSuchFile = err && err instanceof OS.File.Error && err.becauseNoSuchFile;
				if(!noSuchFile) {
					err && Components.utils.reportError(err);
					this.ut._err("Can't read string from file " + this.ut._fileInfo(file));
				}
				var status = noSuchFile
					? Components.results.NS_ERROR_FILE_NOT_FOUND
					: /out of memory/i.test(err)
						? Components.results.NS_ERROR_OUT_OF_MEMORY
						: Components.results.NS_ERROR_FAILURE;
				callback.call(context || this, "", status);
			}.bind(this);
			OS.File.read(file.path).then(
				function onSuccess(arr) {
					try {
						var data = decoder.decode(arr);
						callback.call(context || this, data, Components.results.NS_OK);
					}
					catch(e) {
						onFailure(e);
					}
				}.bind(this),
				onFailure
			).then(null, Components.utils.reportError);
			return true;
		}

		try {
			Components.utils["import"]("resource://gre/modules/NetUtil.jsm");
			if(!("newChannel" in NetUtil))
				throw "Firefox 3.6";
		}
		catch(e) {
			this._log("readFromFileAsync(): asynchronous API not available");
			this.readFromFileAsync = function(file, callback, context) {
				var err = { value: undefined };
				var data = this.readFromFile(file, err);
				err = err.value;
				callback.call(context || this, data, this.ut.getErrorCode(err));
				return !err;
			};
			return this.readFromFileAsync.apply(this, arguments);
		}
		this._log("readFromFileAsync(): will use NetUtil.asyncFetch()");
		try {
			// Don't check permissions: this is slow
			//this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_READ);
			NetUtil.asyncFetch(file, this.ju.bind(function(istream, status) {
				var data = "";
				if(Components.isSuccessCode(status)) {
					try { // Firefox 7.0a1+ throws after istream.available() on empty files
						data = NetUtil.readInputStreamToString(
							istream,
							istream.available(),
							{ charset: "UTF-8", replacement: "\ufffd" } // Only Gecko 11.0+
						);
						if(NetUtil.readInputStreamToString.length < 3)
							data = this.convertToUnicode(data);
					}
					catch(e) {
						if(this.ut.getErrorCodeString(e) != "NS_BASE_STREAM_CLOSED")
							Components.utils.reportError(e);
					}
				}
				else {
					if(status == Components.results.NS_ERROR_FILE_NOT_FOUND)
						this._log("NetUtil.asyncFetch(): file not found:\n" + this.ut._fileInfo(file));
					else
						this._err("NetUtil.asyncFetch() failed: " + this.ut.getErrorName(status));
				}
				callback.call(context || this, data, status);
			}, this));
		}
		catch(e) {
			this.ut._err("Can't read string from file " + this.ut._fileInfo(file));
			this.ut._err(e);
			callback && callback.call(context || this, "", this.ut.getErrorCode(e));
			return false;
		}
		return true;
	},
	convertToUnicode: function(str) {
		var uc = this.utf8Converter;
		try {
			return uc.ConvertToUnicode(str);
		}
		catch(e) {
			this.ut._err("Can't convert UTF-8 to unicode");
			this.ut._err(e);
		}
		return str;
	},
	unicodeConverter: function(charset) {
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = charset;
		return suc;
	},
	get utf8Converter() {
		delete this.utf8Converter;
		return this.utf8Converter = this.unicodeConverter("UTF-8");
	},

	ensureFilePermissions: function(file, mask) {
		try {
			if(file.exists())
				file.permissions |= mask;
		}
		catch(e) {
			this.ut._err("Can't change file permissions: " + file.path);
			Components.utils.reportError(e);
		}
	},

	get lineBreak() {
		delete this.lineBreak;
		return this.lineBreak = this.appInfo.OS == "WINNT" ? "\r\n" : "\n";
	},
	platformLineBreaks: function(str, lineBreak) {
		return str.replace(/\r\n?|\n\r?/g, lineBreak || this.lineBreak);
	},
	internalLineBreaks: function(str) {
		return str.replace(/\r\n?|\n\r?/g, "\n");
	},
	get BOM() {
		return this.pu.get("editor.external.saveWithBOM") ? "\ufeff" : "";
	}
};
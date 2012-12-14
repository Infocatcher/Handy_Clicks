var handyClicksUtils = {
	errPrefix: "[Handy Clicks]: ",
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

	get consoleSvc() {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	_info: function() {
		this.consoleSvc.logStringMessage(
			this.errPrefix
			+ Array.map(arguments, this.safeToString).join("\n")
		);
	},
	_log: function() {
		this._devMode && this._info.apply(this, arguments);
	},
	_err: function(e, fileName, lineNumber, isWarning) {
		if(this.isPrimitive(e) || typeof e == "xml") {
			var caller = Components.stack.caller;
			if(arguments.callee.caller == this._warn)
				caller = caller.caller;
			e = new Error(e, fileName || caller.filename, lineNumber || caller.lineNumber);
		}
		else {
			var g = this.getGlobalForObject(e);
			if(!e || e.constructor !== (g ? g.Error : Error)) {
				//setTimeout(function() { throw e; }, 0);
				Components.utils.reportError(e);
				return;
			}
		}
		var cErr = Components.classes["@mozilla.org/scripterror;1"]
			.createInstance(Components.interfaces.nsIScriptError);
		cErr.init(
			this.errPrefix + e.message,
			fileName || e.fileName,
			null,
			lineNumber || e.lineNumber || 0,
			e.columnNumber || 0,
			isWarning ? cErr.warningFlag : cErr.errorFlag,
			null
		);
		this.consoleSvc.logMessage(cErr);
	},
	_warn: function(e, fileName, lineNumber) {
		// Bug: any string are shown as 1 line
		// Bug: can't show message with custom fileName
		this._err(e, fileName, lineNumber, true);
	},
	_deprecated: function(msg) {
		var caller = Components.stack.caller.caller;
		this._warn(msg, caller.filename, caller.lineNumber);
	},
	_stack: function(isWarning) {
		for(
			var stackFrame = Components.stack.caller, funcCaller = arguments.callee.caller, i = 0;
			stackFrame && stackFrame.filename;
			stackFrame = stackFrame.caller, funcCaller = funcCaller ? funcCaller.caller : null, ++i
		) {
			var line = "";
			var req = new XMLHttpRequest();
			req.onload = function() {
				line = (req.responseText.split(/\r\n?|\n\r?/)[stackFrame.lineNumber - 1] || "")
					.replace(/^\s+/, "");
			};
			req.open("GET", stackFrame.filename, false);
			try {
				req.send(null);
			}
			catch(e) {
			}
			var funcDesc = String(funcCaller).match(/^.*/)[0].substr(0, 100)
				+ " \u2026\n"
				+ line;
			this._err(" [stack: " + i + "] " + funcDesc, stackFrame.filename, stackFrame.lineNumber, isWarning);
		}
	},
	objProps: function(o, filter, skipNativeFuncs) {
		if(this.isPrimitive(o))
			return String(o);

		var skip = function() {
			return false;
		};
		if(typeof filter == "string") {
			filter = this.trim(filter).toLowerCase().split(/\s+/);
			skip = function(p) {
				p = p.toLowerCase();
				return filter.some(function(s) {
					return p.indexOf(s) == -1;
				});
			};
		}
		else if(filter) {
			skip = function(p) {
				return !filter.test(p);
			};
		}

		var r = [];
		for(var p in o) {
			if(skip(p))
				continue;

			var prefix = p + " = " + (Object.hasOwnProperty.call(o, p) ? "" : "[inherited] ");
			var getter = Object.__lookupGetter__.call(o, p);
			var setter = Object.__lookupSetter__.call(o, p);
			var value = this.safeGet(o, p);

			if(
				skipNativeFuncs
				&& (
					typeof value == "function" && this.isNativeFunction(value)
					|| typeof getter == "function" && this.isNativeFunction(getter)
					|| typeof setter == "function" && this.isNativeFunction(setter)
				)
			)
				continue;

			r.push(prefix + (this.safeToString(value) || '""'));
			getter && r.push(prefix + "[getter] " + this.safeToString(getter));
			setter && r.push(prefix + "[setter] " + this.safeToString(setter));
		}
		return r.join("\n");
	},
	safeGet: function(o, p) {
		try { return o[p]; }
		catch(e) { return e; }
	},
	safeToString: function(object) { // var obj = { __proto__: null }; => obj.valueOf() and obj.toString() is missing
		try { return String(object); }
		catch(e) { return String(e); }
	},

	_timers: { __proto__: null },
	get now() {
		delete this.now;
		return this.now = "performance" in window && "now" in performance
			? function() { return performance.now(); }
			: function() { return Date.now(); };
	},
	timer: function(tId, division) {
		var ts = this._timers;
		if(tId in ts) {
			var dt = this.now() - ts[tId];
			if(division)
				dt /= division;
			this._log("[timer] " + tId + " -> " + dt + " ms");
			delete ts[tId];
			return dt;
		}
		return ts[tId] = this.now();
	},

	hasPrefix: function(str, prefix) {
		return str.substr(0, prefix.length) == prefix;
	},
	removePrefix: function(str, prefix, forced) {
		if(forced || this.hasPrefix(str, prefix))
			return str.substr(prefix.length);
		return str;
	},
	hasPostfix: function(str, postfix) {
		return str.substr(-postfix.length) == postfix;
	},
	removePostfix: function(str, postfix, forced) {
		if(forced || this.hasPostfix(str, postfix))
			return str.substr(0, str.length - postfix.length);
		return str;
	},

	NOTIFY_ICON_NORMAL: "normal",
	NOTIFY_ICON_DISABLED: "disabled",
	NOTIFY_ICON_WARNING: "warning",
	NOTIFY_ICON_ERROR: "error",
	notify: function(msg, header, funcLeftClick, funcMiddleClick, icon, parentWindow, inWindowCorner) {
		var dur = this.pu.pref("notifyOpenTime");
		if(dur <= 0)
			 return null;
		return window.openDialog(
			 "chrome://handyclicks/content/notify.xul",
			 "_blank",
			 "chrome,dialog=1,titlebar=0,popup=1",
			 {
			 	dur: dur,
			 	header: header || this.getLocalized("title"),
			 	msg: msg || "",
			 	funcLeftClick: funcLeftClick,
			 	funcMiddleClick: funcMiddleClick,
			 	icon: icon === undefined ? this.NOTIFY_ICON_NORMAL : icon,
			 	inWindowCorner: inWindowCorner === undefined ? this.pu.pref("notifyInWindowCorner") : inWindowCorner,
			 	dontCloseUnderCursor: this.pu.pref("notifyDontCloseUnderCursor"),
			 	rearrangeWindows: this.pu.pref("notifyRearrangeWindows"),
			 	parentWindow: parentWindow || window,
			 	__proto__: null
			 }
		);
	},
	notifyInWindowCorner: function(msg, header, funcLeftClick, funcMiddleClick, icon, parentWindow) {
		return this.notify(msg, header, funcLeftClick, funcMiddleClick, icon, parentWindow, true);
	},

	get toErrorConsole() {
		delete this.toErrorConsole;
		return this.toErrorConsole = this.bind(this.openErrorConsole, this);
	},
	openErrorConsole: function() {
		if("toErrorConsole" in top)
			return top.toErrorConsole();
		if("toJavaScriptConsole" in top)
			return top.toJavaScriptConsole();
		var consoleURI = "@zeniko/console2-clh;1" in Components.classes
			|| "@mozilla.org/commandlinehandler/general-startup;1?type=console2" in Components.classes // Firefox <= 3.6
			? "chrome://console2/content/console2.xul"
			: "chrome://global/content/console.xul";
		return this.wu.openWindowByType(consoleURI, "global:console");
	},

	get promptsSvc() {
		delete this.promptsSvc;
		return this.promptsSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
	},
	alert: function(title, text, win) {
		this.fixMinimized(win);
		this.promptsSvc.alert(win || window, title, text);
	},
	prompt: function(title, text, defVal, win) {
		this.fixMinimized(win);
		var ret = { value: defVal };
		var res = this.promptsSvc.prompt(win || window, title, text, ret, null, {});
		return res ? ret.value : null;
	},
	confirm: function(title, text, win) {
		this.fixMinimized(win);
		return this.promptsSvc.confirm(win || window, title, text);
	},
	confirmEx: function(title, text, buttonOkText, buttonOkDefault, checkText, checkObj, win) {
		this.fixMinimized(win);
		var ps = this.promptsSvc;
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		return ps.confirmEx(
			win || window,
			title, text,
			  ps.BUTTON_POS_0 * (buttonOkText ? ps.BUTTON_TITLE_IS_STRING : ps.BUTTON_TITLE_OK)
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps["BUTTON_POS_" + (buttonOkDefault ? 0 : 1) + "_DEFAULT"],
			buttonOkText, "", "",
			checkText || null, checkObj || {}
		) != 1;
	},
	fixMinimized: function(win) {
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=350299
		win = win || window;
		if(win.windowState == win.STATE_MINIMIZED)
			win.focus();
	},

	bind: function(func, context, args) {
		return function() {
			return func.apply(context, args || arguments);
		};
	},
	timeout: function(func, context, args, delay) {
		//return setTimeout(this.bind(func, context, args), delay || 0);
		return setTimeout(
			function(func, context, args) {
				func.apply(context, args);
			},
			delay || 0, func, context, args || []
		);
	},

	// Localized strings:
	_strings: { __proto__: null }, // cache of strings from stringbundle
	_bundles: { __proto__: null },
	getBundle: function(src) {
		return this._bundles[src] || (
			this._bundles[src] = Components.classes["@mozilla.org/intl/stringbundle;1"]
				.getService(Components.interfaces.nsIStringBundleService)
				.createBundle(src)
		);
	},
	getStr: function(src, sName) {
		try {
			return this.getBundle(src).GetStringFromName(sName);
		}
		catch(e) {
			this._warn('Can\'t get localized string "' + sName + '" from "' + src + '"');
			return "";
		}
	},
	getLocalized: function(sName) {
		return this._strings[sName] || (
			this._strings[sName] = this.getStr("chrome://handyclicks/locale/hcs.properties", sName)
				|| this.getStr("chrome://handyclicks-locale/content/hcs.properties", sName)
				|| this.makeBuggyStr(sName)
		);
	},

	_entities: { __proto__: null }, // cache of strings from *.dtd files
	getEntity: function(eName, dtds, contentType) {
		// Strange bug with Greasemonkey 0.8.20100408.6:
		// getEntity("statusbar.enabled", "chrome://greasemonkey/locale/greasemonkey.dtd");
		dtds = dtds
			? "<!DOCTYPE page [\n"
				+ Array.concat(dtds).map(
					function(dtd, indx) {
						return '<!ENTITY % dtd' + indx + ' SYSTEM "' + dtd + '">\n%dtd' + indx + ';';
					}
				).join("\n")
				+ "\n]>\n"
			: "";
		var node = this.parseFromString(
			dtds + '<page xmlns="' + this.XULNS + '">&' + eName + ';</page>',
			contentType
		);
		if(node.namespaceURI == "http://www.mozilla.org/newlayout/xml/parsererror.xml") {
			this._warn('Invalid XML entity: "' + eName + '"');
			return "";
		}
		return node.textContent;
	},
	getLocalizedEntity: function(eName, dtds, contentType) {
		return this._entities[eName] || (
			this._entities[eName] = this.getEntity(eName, dtds) || this.makeBuggyStr(eName)
		);
	},

	makeBuggyStr: function(s) {
		return "(" + s + ")\u034f";
	},
	isBuggyStr: function(s) {
		return s && /^\(.*\)\u034f$/.test(s);
	},

	errInfo: function(textId, label, type, err) {
		return this.getLocalized(textId)
			+ this.getLocalized("errorDetails")
				.replace("%label", label)
				.replace("%type", type)
				.replace("%err", err);
	},

	getFileParent: function(file) {
		try {
			return file.parent;
		}
		catch(e) {
			// Firefox 1.5 and 2.0 says:
			// Component returned failure code: 0x80520001 (NS_ERROR_FILE_UNRECOGNIZED_PATH) [nsIFile.parent]
			// for root directories
		}
		return null;
	},
	getFileRoot: function(file) {
		var tmp = file;
		for(; tmp = this.getFileParent(tmp);)
			file = tmp;
		return file;
	},
	getLocalFileRoot: function(file) {
		file = this.getFileRoot(file);
		return file && file.QueryInterface(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
	},
	getFileByAlias: function(alias, dontShowErrors) {
		if(alias == "_ProfDrv" || alias == "_SysDrv") { //= added 2012-01-10
			this._deprecated('Alias "' + alias + '" is deprecated. Use "hc' + alias + '" instead.');
			alias = "hc" + alias;
		}
		if(alias == "hc_ProfDrv")
			return this.getLocalFileRoot(this.ps.profileDir);
		if(alias == "hc_CurProcDrv")
			return this.getLocalFileRoot(this.getFileByAlias("CurProcD"));
		if(alias == "hc_SysDrv")
			return this.getLocalFileRoot(this.getFileByAlias("SysD"));
		try {
			return Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get(alias, Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
		}
		catch(e) {
			if(dontShowErrors)
				return null;
			this._err('Invalid directory alias: "' + alias + '"');
			this._err(e);
		}
		return null;
	},
	expandVariables: function(str) {
		// Use %ProfD% for internal and %PROFD% (or any other different case) for environment variable
		return this.expandEnvironmentVariables(this.expandInternalVariables(str));
	},
	expandEnvironmentVariables: function(str) {
		var env = Components.classes["@mozilla.org/process/environment;1"]
			.getService(Components.interfaces.nsIEnvironment);
		return str.replace(
			/%([^%]+)%/g,
			function(s, alias) {
				return env.exists(alias) ? env.get(alias) : s;
			}
		);
	},
	expandInternalVariables: function (str) {
		return str.replace(
			/^%([^%]+)%/, //~ todo: may conflict with environment variables => [ProfD]/dir like Thunderbird or some other
			this.bind(function(s, alias) {
				if(alias.toLowerCase() == "profile" || alias == "ProfD")
					return this.ps.profileDir.path;
				var aliasFile = this.getFileByAlias(alias, true);
				return aliasFile ? aliasFile.path : s;
			}, this)
		);
	},
	getLocalFile: function(path) {
		if(!path)
			return path;
		path = this.expandVariables(path);
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
		try {
			file.initWithPath(path);
		}
		catch(e) {
			this._err('Invalid path: "' + path + '"');
			this._err(e);
			return null;
		}
		try {
			file.normalize(); // dir1/dir2/../file -> dir1/file
		}
		catch(e) {
		}
		return file;
	},
	getLocalPath: function(path) {
		var file = this.getLocalFile(path);
		return file ? file.path : path;
	},
	startProcess: function(path, args, w) {
		args = args || [];
		var file = this.getLocalFile(path);
		if(!file) {
			this.notifyInWindowCorner(
				this.getLocalized("invalidFilePath").replace("%p", path)
					+ this.getLocalized("openConsole"),
				this.getLocalized("errorTitle"),
				this.toErrorConsole, null,
				this.NOTIFY_ICON_ERROR
			);
			return false;
		}
		if(!file.exists()) {
			this.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("fileNotFound").replace("%f", path)
			);
			return false;
		}
		var process = Components.classes["@mozilla.org/process/util;1"]
			.createInstance(Components.interfaces.nsIProcess);
		try {
			process.init(file);
			process[w && process.hasOwnProperty("runw") ? "runw" : "run"](false, args, args.length);
			return true;
		}
		catch(e) {
			this.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("fileCantRun").replace("%f", path).replace("%err", e)
			);
			return false;
		}
	},

	// File I/O (only UTF-8):
	PERMS_FILE_READ:  parseInt("0444", 8),
	PERMS_FILE_WRITE: parseInt("0644", 8),
	PERMS_DIRECTORY:  parseInt("0755", 8),
	get fp() {
		delete this.fp;
		return this.fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
	},
	writeToFile: function(str, file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		try {
			fos.init(file, 0x02 | 0x08 | 0x20, this.PERMS_FILE_WRITE, 0);
		}
		catch(e) {
			this._err('Can\'t write string to file "' + (file instanceof Components.interfaces.nsIFile ? file.path : file) + '"');
			this._err(e);
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
	writeToFileAsync: function(str, file, callback, context) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
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
				callback && callback.call(context || this, this.getErrorCode(err));
				return !err;
			};
			return this.writeToFileAsync.apply(this, arguments);
		}
		try {
			var ostream = FileUtils.openSafeFileOutputStream(file);
			var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			suc.charset = "UTF-8";
			var istream = suc.convertToInputStream(str);
			NetUtil.asyncCopy(istream, ostream, this.bind(function(status) {
				if(!Components.isSuccessCode(status))
					this._err("NetUtil.asyncCopy failed: " + this.getErrorName(status) + " (" + status + ")");
				callback && callback.call(context || this, status);
			}, this));
		}
		catch(e) {
			this._err('Can\'t write string to file "' + (file instanceof Components.interfaces.nsIFile ? file.path : file) + '"');
			this._err(e);
			callback && callback.call(context || this, this.getErrorCode(e));
			return false;
		}
		return true;
	},
	readFromFile: function(file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, this.PERMS_FILE_READ, 0);
		}
		catch(e) {
			this._err('Can\'t read string from file "' + (file instanceof Components.interfaces.nsIFile ? file.path : file) + '"');
			this._err(e);
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
	readFromFileAsync: function(file, callback, context) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
		try {
			Components.utils["import"]("resource://gre/modules/NetUtil.jsm");
			if(!("newChannel" in NetUtil))
				throw "Firefox 3.6";
		}
		catch(e) {
			this._log("readFromFileAsync: asynchronous API not available");
			this.readFromFileAsync = function(file, callback, context) {
				var err = { value: undefined };
				var data = this.readFromFile(file, err);
				err = err.value;
				callback.call(context || this, data, this.getErrorCode(err));
				return !err;
			};
			return this.readFromFileAsync.apply(this, arguments);
		}
		try {
			NetUtil.asyncFetch(file, this.bind(function(istream, status) {
				var data = "";
				if(Components.isSuccessCode(status))
					data = this.convertToUnicode(NetUtil.readInputStreamToString(istream, istream.available()));
				else
					this._err("NetUtil.asyncFetch failed: " + this.getErrorName(status) + " (" + status + ")");
				callback.call(context || this, data, status);
			}, this));
		}
		catch(e) {
			this._err('Can\'t read string from file "' + (file instanceof Components.interfaces.nsIFile ? file.path : file) + '"');
			this._err(e);
			callback && callback.call(context || this, "", this.getErrorCode(e));
			return false;
		}
		return true;
	},
	convertToUnicode: function(str) {
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = "utf8";
		try {
			return suc.ConvertToUnicode(str);
		}
		catch(e) {
			this._err("Can't convert UTF-8 to unicode");
			this._err(e);
		}
		return str;
	},
	getErrorCode: function(err, defaultCode) {
		return Components.results[this.getErrorCodeString(err, defaultCode || "NS_OK")];
	},
	getErrorCodeString: function(err, defaultCode) {
		return err
			? /0x[0-9a-fA-F]+\s\((NS_[A-Z_]+)\)/.test(err)
				? RegExp.$1
				: defaultCode || "NS_ERROR_FILE_ACCESS_DENIED"
			: "NS_OK";
	},
	getErrorName: function(code) {
		var cr = Components.results;
		for(var errName in cr)
			if(cr[errName] == code)
				return errName;
		return String(code);
	},

	// Clipboard utils:
	get cb() {
		delete this.cb;
		return this.cb = Components.classes["@mozilla.org/widget/clipboard;1"]
			.getService(Components.interfaces.nsIClipboard);
	},
	get cbHelper() {
		delete this.cbHelper;
		return this.cbHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper);
	},
	get transferableInstance() {
		return Components.classes["@mozilla.org/widget/transferable;1"]
			.createInstance(Components.interfaces.nsITransferable);
	},
	setClipboardData: function(dataObj, clipId) {
		var ta = this.transferableInstance;
		for(var flavor in dataObj) if(dataObj.hasOwnProperty(flavor)) {
			var value = dataObj[flavor];
			var str = Components.classes["@mozilla.org/supports-string;1"]
		    	.createInstance(Components.interfaces.nsISupportsString);
		    str.data = value;
			ta.addDataFlavor(flavor);
			ta.setTransferData(flavor, str, value.length * 2);
		}
		var cb = this.cb;
		cb.setData(ta, null, clipId === undefined ? cb.kGlobalClipboard : clipId);
	},
	getClipboardData: function(flavor, clipId) {
		if(!flavor)
			flavor = "text/unicode";
		var ta = this.transferableInstance;
		ta.addDataFlavor(flavor);
		var cb = this.cb;
		cb.getData(ta, clipId === undefined ? cb.kGlobalClipboard : clipId);
		var data = {}, len = {};
		try {
			ta.getTransferData(flavor, data, len);
			return data.value
				.QueryInterface(Components.interfaces.nsISupportsString)
				.data
				.substr(0, len.value/2);
		}
		catch(e) {
			return "";
		}
	},
	copyStr: function(str, clipId) {
		this.cbHelper.copyStringToClipboard(str, clipId === undefined ? this.cb.kGlobalClipboard : clipId);
	},
	readFromClipboard: function(trimFlag, clipId) {
		var clipStr = this.getClipboardData("text/unicode", clipId);
		return trimFlag ? this.trim(clipStr) : clipStr;
	},

	isChromeWin: function(win) {
		//return win.toString() == "[object ChromeWindow]";
		return win instanceof Components.interfaces.nsIDOMChromeWindow;
	},
	isChromeDoc: function(doc) {
		doc = doc || this.hc.item.ownerDocument;
		return this.isChromeWin(doc.defaultView);
	},

	get appInfo() {
		delete this.appInfo;
		return this.appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo)
			.QueryInterface(Components.interfaces.nsIXULRuntime);
	},
	get isSeaMonkey() {
		delete this.isSeaMonkey;
		return this.isSeaMonkey = this.appInfo.name == "SeaMonkey";
	},
	get fxVersion() {
		var ver = parseFloat(this.appInfo.version); // 3.0 for "3.0.10"
		if(this.isSeaMonkey) switch(ver) {
			case 2:            ver = 3.5; break;
			case 2.1: default: ver = 4;
		}
		delete this.fxVersion;
		return this.fxVersion = ver;
	},

	get lineBreak() {
		// Based on code of Adblock Plus 1.2.1: chrome\adblockplus.jar\content\utils.js
		// In newer versions: modules\Utils.jsm
		// Platform's line breaks by reading prefs.js
		var br = "\n";
		try {
			var prefFile = this.getFileByAlias("PrefF");
			var is = Components.classes["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Components.interfaces.nsIFileInputStream);
			is.init(prefFile, 0x01, this.PERMS_FILE_READ, 0);
			var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance(Components.interfaces.nsIScriptableInputStream);
			sis.init(is);
			var data = sis.read(256);
			sis.close();
			if(/\r\n?|\n\r?/.test(data))
				br = RegExp.lastMatch;
		}
		catch (e) {
		}
		delete this.lineBreak;
		return this.lineBreak = br;
	},
	platformLineBreaks: function(str, lineBreak) {
		return str.replace(/\r\n?|\n\r?/g, lineBreak || this.lineBreak);
	},
	internalLineBreaks: function(str) {
		return str.replace(/\r\n?|\n\r?/g, "\n");
	},

	get isArray() { // function(arr)
		delete this.isArray;
		return this.isArray = this.hasNativeMethod(Array, "isArray")
			? Array.isArray
			: function(arr) {
				return arr instanceof Array
					|| Object.prototype.toString.call(arr) == "[object Array]";
			};
	},
	isObject: function(obj) {
		return typeof obj == "object" && obj !== null;
	},
	isEmptyObj: function(o) {
		// obj.__count__ is deprecated and removed in Firefox 4.0
		// Object.keys(o).length
		for(var p in o) if(Object.hasOwnProperty.call(o, p))
			return false;
		return true;
	},
	isPrimitive: function(v) {
		if(v === null || v === undefined)
			return true;
		var t = typeof v;
		return t == "string" || t == "number" || t == "boolean";
	},
	isNativeFunction: function(func) {
		// Example: function alert() {[native code]}
		return /^function\s+[^()\s]+\s*\(\)\s*\{\s*\[native code\]\s*\}$/
			.test(Function.prototype.toString.call(func));
	},
	hasNativeMethod: function(obj, methName) {
		return methName in obj && typeof obj[methName] == "function" && this.isNativeFunction(obj[methName]);
	},

	getOwnProperty: function(obj) { // this.getOwnProperty(obj, "a", "b", "propName") instead of obj.a.b.propName
		var u;
		if(this.isPrimitive(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; ++i) {
			p = a[i];
			if(!Object.hasOwnProperty.call(obj, p))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(this.isPrimitive(obj))
				return u;
		}
		return u;
	},
	getProperty: function(obj) {
		var u;
		if(this.isPrimitive(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; ++i) {
			p = a[i];
			if(!(p in obj))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(this.isPrimitive(obj))
				return u;
		}
		return u;
	},
	setOwnProperty: function(obj) { // obj, "x", "y", value
		var a = arguments, p;
		for(var i = 1, len = a.length - 2; i <= len; ++i) {
			p = a[i];
			if(!Object.hasOwnProperty.call(obj, p) || !this.isObject(obj[p]))
				obj[p] = {};
			if(i != len)
				obj = obj[p];
		}
		obj[p] = a[len + 1];
	},

	getGlobalForObject: function(o) {
		if(this.isPrimitive(o))
			return null;
		if("getGlobalForObject" in Components.utils)
			return Components.utils.getGlobalForObject(o);
		return o.__parent__ || o.valueOf.call();
	},

	sortAsNumbers: function(arr) {
		return arr.sort(function(a, b) {
			return a - b;
		});
	},

	objEquals: function(o1) {
		var s = this.getSource(o1);
		return Array.slice(arguments, 1).every(function(o) {
			return this.getSource(o) === s;
		}, this);
	},
	getSource: function(o) {
		return !this.isPrimitive(o) && !("toSource" in o) // !o.__proto__
			? Object.prototype.toSource.call(o)
			: uneval(o);
	},

	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	isElementVisible: function(elt) {
		if(!elt)
			return false;
		var bo = elt.boxObject;
		if(!bo)
			bo = "getBoundingClientRect" in elt
				? elt.getBoundingClientRect()
				: elt.ownerDocument.getBoxObjectFor(elt);
		// https://bugzilla.mozilla.org/show_bug.cgi?id=530985
		// isElementVisible(elt) || elt.namespaceURI == "http://www.w3.org/2000/svg"
		return bo.height > 0 && bo.width > 0;
	},
	closeMenus: function(node) {
		// Based on function closeMenus from chrome://browser/content/utilityOverlay.js
		for(; node && "tagName" in node; node = node.parentNode) {
			if(
				node.namespaceURI == this.XULNS
				&& (node.localName == "menupopup" || node.localName == "popup")
			)
				node.hidePopup();
		}
	},

	hasModifier: function(evt) {
		return evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey;
	},

	mm: function(n, minVal, maxVal) {
		return Math.max(minVal, Math.min(maxVal, n));
	},
	mmLine: function(n) {
		if(n >= 0xFFFFFFFF)
			n = 1;
		return this.mm(n, 1, 5e5);
	},

	get trim() { // function(str)
		delete this.trim;
		return this.trim = this.hasNativeMethod(String, "trim")
			? String.trim
			: function(str) {
				return String(str).replace(/^\s+|\s+$/g, "");
			};
	},
	encodeHTML: function(str, encDoubleQuotes) {
		str = str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		if(encDoubleQuotes !== false)
			str = str.replace(/"/g, "&quot;");
		return str;
	},

	// DOM utils
	parseFromString: function(str, contentType) {
		return new DOMParser().parseFromString(str, contentType || "application/xml").documentElement;
	},
	serializeToString: function(elt) {
		return new XMLSerializer().serializeToString(elt);
	},
	innerXML: function(elt) {
		return elt.innerHTML || Array.map(
			elt.childNodes,
			function(ch) {
				return ch.innerHTML || this.serializeToString(ch);
			},
			this
		).join("");
	},
	parseXULFromString: function(str) {
		return this.parseFromString(str.replace(/>\s+</g, "><"));
	},
	createElement: function(name, attrs) {
		return this.setAttributes(document.createElement(name), attrs);
	},
	setAttributes: function(node, attrs) {
		if(attrs) for(var attrName in attrs) if(attrs.hasOwnProperty(attrName))
			node.setAttribute(attrName, attrs[attrName]);
		return node;
	},
	attribute: function(node, attr, val, allowEmpty) {
		if(val || allowEmpty && val === "")
			node.setAttribute(attr, val);
		else
			node.removeAttribute(attr);
	},
	parseFromXML: function(xml) { // Deprecated
		this._deprecated("Called obsolete parseFromXML(), use parseXULFromString() without E4X instead");
		var pp = XML.prettyPrinting;
		XML.prettyPrinting = false;
		var elt = this.parseFromString(xml.toXMLString());
		XML.prettyPrinting = pp;
		return elt;
	},

	removeChilds: function(elt) {
		while(elt.hasChildNodes())
			elt.removeChild(elt.lastChild);
	},

	get storage() { // return function(key, val)
		const ns = "__handyClicks__";
		if("Application" in window) { // Firefox 3.0+
			var st = Application.storage;
			if(!st.has(ns))
				st.set(ns, { __proto__: null });
			this._storage = st.get(ns, null);
		}
		else { // For old versions
			var hw = Components.classes["@mozilla.org/appshell/appShellService;1"]
				.getService(Components.interfaces.nsIAppShellService)
				.hiddenDOMWindow;
			if(!(ns in hw)) {
				hw[ns] = { __proto__: null };
				var destroy = hw[ns + "destroy"] = function _ds(e) {
					var win = e.target.defaultView;
					if(win !== win.top)
						return;
					win.removeEventListener(e.type, _ds, false);
					delete win[_ds.ns];
				};
				destroy.ns = ns;
				hw.addEventListener("unload", destroy, false);
			}
			this._storage = hw[ns];
		}
		delete this.storage;
		return this.storage = function(key, val) {
			if(arguments.length == 1)
				return key in this._storage ? this._storage[key] : undefined;
			if(val === undefined)
				delete this._storage[key];
			else
				this._storage[key] = val;
			return val;
		};
	}
};

function HandyClicksObservers() {
	this.observers = [];
}
HandyClicksObservers.prototype = {
	notifyObservers: function() {
		var args = arguments;
		this.observers.forEach(function(ob) {
			ob[0].apply(ob[1], args);
		});
	},
	addObserver: function(func, context) {
		return this.observers.push(arguments) - 1;
	},
	removeObserver: function(oId) {
		delete this.observers[oId];
	},
	destroy: function() {
		delete this.observers;
	}
};

var handyClicksCleanupSvc = {
	_cleanups: [],
	registerCleanup: function(func, context, args) {
		return this._cleanups.push(arguments) - 1;
	},
	unregisterCleanup: function(uid) {
		delete this._cleanups[uid];
	},
	cleanup: function(uid) {
		var cs = this._cleanups;
		if(uid in cs) {
			this._cleanup.apply(this, cs[uid]);
			delete cs[uid];
		}
	},
	_cleanup: function(func, context, args) {
		func.apply(context, args);
	},
	destroy: function() {
		this._cleanups.forEach(this._cleanup, this);
		delete this._cleanups;

		this._nodeCleanups.forEach(function(nodeHandler) {
			nodeHandler.destroy();
		});
		delete this._nodeCleanups;
	},

	_nodeCleanups: [],
	get registerNodeCleanup() { // function(node, func, context, args)
		this.NodeHandler = function(node, func, context, args, uid) {
			this.node    = node;
			this.func    = func;
			this.context = context;
			this.args    = args;
			this.uid     = uid;
			var doc = this.doc = node.ownerDocument;
			var win = this.win = doc.defaultView;
			this._destroyTimeout = 0;
			win.addEventListener("unload", this, false);
			win.addEventListener("DOMNodeRemoved", this, false);
		};
		this.NodeHandler.prototype = {
			parent: this,
			handleEvent: function(e) {
				switch(e.type) {
					case "DOMNodeRemoved":
						if(e.target.ownerDocument != this.doc)
							break;
						clearTimeout(this._destroyTimeout);
						this._destroyTimeout = this.parent.ut.timeout(this.checkNode, this, [], 50);
					break;
					case "unload":
						if(e.target.defaultView === this.win)
							this.destroy();
				}
			},
			checkNode: function() {
				var doc = this.doc;
				for(var node = this.node.parentNode; node; node = node.parentNode)
					if(node === doc)
						return;
				this.destroy();
			},
			cancel: function() {
				var win = this.win;
				win.removeEventListener("unload", this, false);
				win.removeEventListener("DOMNodeRemoved", this, false);
				delete this.parent._nodeCleanups[this.uid];
			},
			destroy: function() {
				this.cancel();
				this.func.apply(this.context, this.args);
			}
		};
		delete this.registerNodeCleanup;
		return this.registerNodeCleanup = function(node, func, context, args) {
			return this._nodeCleanups.push(
				new this.NodeHandler(node, func, context, args, this._nodeCleanups.length)
			) - 1;
		};
	},
	unregisterNodeCleanup: function(uid) {
		var cs = this._nodeCleanups;
		if(uid in cs)
			cs[uid].cancel();
	},
	nodeCleanup: function(uid) {
		var cs = this._nodeCleanups;
		if(uid in cs)
			cs[uid].destroy();
	}
};

var handyClicksExtensionsHelper = {
	get newAddonManager() {
		delete this.newAddonManager;
		return this.newAddonManager = !("@mozilla.org/extensions/manager;1" in Components.classes);
	},
	get em() {
		delete this.em;
		return this.em = Components.classes["@mozilla.org/extensions/manager;1"]
			.getService(Components.interfaces.nsIExtensionManager);
	},
	get rdf() {
		delete this.rdf;
		return this.rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
			.getService(Components.interfaces.nsIRDFService);
	},
	instantInit: function() {
		if(
			this.newAddonManager
			&& !this.ut.storage("addons")
			&& !this.ut.storage("addonsPending")
		) {
			if("handyClicksSetsUtils" in window)
				this._instantInit();
			else
				this.ut.timeout(this._instantInit, this, [], 1000);
		}
	},
	_instantInit: function() {
		// Hack for Firefox 3.7a5pre+
		// Following code is asynchronous and take some time... so, starts them as soon possible
		this.ut.storage("addonsPending", true);
		Components.utils["import"]("resource://gre/modules/AddonManager.jsm");
		AddonManager.getAllAddons(this.ut.bind(function(addons) {
			this.ut.storage("addons", addons);
			this.ut.storage("addonsPending", undefined);
			var scheduledTasks = this.ut.storage("addonsScheduledTasks");
			if(scheduledTasks) {
				scheduledTasks.forEach(function(task) {
					task[0].apply(task[1], task[2]);
				});
				this.ut.storage("addonsScheduledTasks", undefined);
			}

			this.onEnabled =
			this.onDisabled =
			this.onInstalled =
			this.onOperationCancelled =
			this.onPropertyChanged = function(addon) {
				var guid = addon.id;
				var addons = this.ut.storage("addons");
				if(
					!addons.some(function(addon, i, addons) {
						if(addon.id == guid) {
							this.ut._log("Addon changed: " + guid);
							addons[i] = addon;
							return true;
						}
						return false;
					}, this)
				) {
					this.ut._log("Addon installed: " + guid);
					addons.push(addon);
				}
			};

			this.onUninstalled = function(addon) {
				var guid = addon.id;
				this.ut._log("Addon uninstalled: " + guid);
				var addons = this.ut.storage("addons");
				addons.some(function(addon, i, addons) {
					if(addon.id == guid) {
						this.ut._log("Addon uninstalled: delete");
						delete addons[i];
						return true;
					}
					return false;
				}, this);
			};

			AddonManager.addAddonListener(this);
		}, this));
	},
	destroy: function() {
		if(this.addons && "AddonManager" in window)
			AddonManager.removeAddonListener(this);
	},
	get pending() {
		return this.ut.storage("extensionsPending");
	},
	schedule: function(func, context, args) {
		if(!this.ut.storage("addonsScheduledTasks"))
			this.ut.storage("addonsScheduledTasks", []);
		this.ut.storage("addonsScheduledTasks").push(arguments);
	},
	get addons() {
		var addons = this.ut.storage("addons");
		if(addons) {
			delete this.addons;
			return this.addons = addons;
		}
		return addons;
	},
	isAvailable: function(guid) {
		var caller = Components.stack.caller;
		this.ut._deprecated( //= Added: 2012-01-12
			"Function handyClicksExtensionsHelper.isAvailable() is deprecated. "
			+ "Use handyClicksExtensionsHelper.isEnabled() instead."
		);
		return this.isEnabled(guid);
	},
	isInstalled: function(guid) {
		return this.newAddonManager
			? this.addons.some(function(addon) {
				return addon.id == guid;
			})
			: this.em.getInstallLocation(guid);
	},
	isEnabled: function(guid) {
		if(this.newAddonManager) {
			return this.addons.some(function(addon) {
				return addon.id == guid && addon.isActive;
			});
		}
		if(!this.em.getInstallLocation(guid))
			return false;
		var res  = this.rdf.GetResource("urn:mozilla:item:" + guid);
		var opType = this.getRDFRes(res, "opType");
		return opType != "needs-enable" && opType != "needs-install"
			&& this.getRDFRes(res, "userDisabled") != "true"
			&& this.getRDFRes(res, "appDisabled") != "true";
	},
	getRDFRes: function(res, type) {
		var tar = this.em.datasource.GetTarget(
			res, this.rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + type), true
		);
		return (
			tar instanceof Components.interfaces.nsIRDFLiteral
			|| tar instanceof Components.interfaces.nsIRDFInt
		) && tar.Value;
	}
};
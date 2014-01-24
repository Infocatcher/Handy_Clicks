var handyClicksUtils = {
	errPrefix: "[Handy Clicks] ",
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

	get consoleSvc() {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	ts: function() {
		var d = new Date();
		var ms = d.getMilliseconds();
		return d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms;
	},
	_info: function(s) {
		this.consoleSvc.logStringMessage(this.errPrefix + this.ts() + " " + this.safeToString(s));
	},
	_log: function(s) {
		this._debug && this._info.apply(this, arguments);
	},
	_err: function _err(e, fileName, lineNumber, isWarning) {
		if(this.isPrimitive(e) || typeof e == "xml") {
			var caller = Components.stack.caller;
			if(_err.caller == this._warn)
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
		// Bug: any string is shown as 1 line in Firefox 2.0 and older
		this._err(e, fileName, lineNumber, true);
	},
	_deprecated: function(msg) {
		var caller = Components.stack.caller.caller;
		this._warn(msg, caller.filename, caller.lineNumber);
	},
	_stack: function _stack(desc, isWarning) {
		if(desc)
			desc += " ";
		for(
			var stackFrame = Components.stack.caller, funcCaller = _stack.caller, i = 0;
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
			this._err(desc + "[stack: " + i + "] " + funcDesc, stackFrame.filename, stackFrame.lineNumber, isWarning);
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
			var dtr = Math.floor(dt) == dt ? dt : dt.toFixed(3);
			this._log("[timer] " + tId + " -> " + dtr + " ms");
			delete ts[tId];
			return dt;
		}
		return ts[tId] = this.now();
	},

	hasPrefix: function(str, prefix) {
		var f = this.hasPrefix = this.hasNativeMethod(String, "startsWith")
			? String.startsWith
			: function(str, prefix) {
				return str.substr(0, prefix.length) == prefix;
			};
		return f.apply(this, arguments);
	},
	removePrefix: function(str, prefix, forced) {
		if(forced || this.hasPrefix(str, prefix))
			return str.substr(prefix.length);
		return str;
	},
	hasPostfix: function(str, postfix) {
		var f = this.hasPostfix = this.hasNativeMethod(String, "endsWith")
			? String.endsWith
			: function(str, postfix) {
				return str.substr(-postfix.length) == postfix;
			};
		return f.apply(this, arguments);
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
			 "chrome,popup,titlebar=0",
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
		var hasConsole2 = "@zeniko/console2-clh;1" in Components.classes
			|| "@mozilla.org/commandlinehandler/general-startup;1?type=console2" in Components.classes; // Firefox <= 3.6
		if(!hasConsole2 && this.canOpenBrowserConsole)
			return this.openBrowserConsole();
		if("toErrorConsole" in top)
			return top.toErrorConsole();
		if("toJavaScriptConsole" in top)
			return top.toJavaScriptConsole();
		var consoleURI = hasConsole2
			? "chrome://console2/content/console2.xul"
			: "chrome://global/content/console.xul";
		return this.wu.openWindowByType(consoleURI, "global:console");
	},
	// Note: Browser Console isn't supported without opened browser windows
	get canOpenBrowserConsole() {
		var window = this.wu.wm.getMostRecentWindow("navigator:browser");
		return window && !!window.document.getElementById("menu_browserConsole");
	},
	openBrowserConsole: function() {
		var window = this.wu.wm.getMostRecentWindow("navigator:browser");
		if(!window)
			return;
		var consoleFrame = this.getBrowserConsole(window);
		if(consoleFrame) {
			consoleFrame.focus();
			return;
		}
		if("HUDService" in window && "toggleBrowserConsole" in window.HUDService) { // Firefox 27.0a1+
			window.HUDService.toggleBrowserConsole();
			return;
		}
		if("HUDConsoleUI" in window && "toggleBrowserConsole" in window.HUDConsoleUI) {
			window.HUDConsoleUI.toggleBrowserConsole();
			return;
		}
		window.document.getElementById("menu_browserConsole").doCommand();
	},
	getBrowserConsole: function(window) {
		if("HUDService" in window && "getBrowserConsole" in window.HUDService) { // Firefox 27.0a1+
			var hud = window.HUDService.getBrowserConsole();
			return hud && hud.iframeWindow;
		}
		if("HUDConsoleUI" in window && window.HUDConsoleUI._browserConsoleID) try {
			var HUDService = Components.utils["import"]("resource:///modules/HUDService.jsm", {}).HUDService;
			var hud = HUDService.getHudReferenceById(window.HUDConsoleUI._browserConsoleID);
			return hud && hud.iframeWindow;
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return null;
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
	getStr: function(src, sName, defaultStr) {
		try {
			return this.getBundle(src).GetStringFromName(sName);
		}
		catch(e) {
			this._warn('Can\'t get localized string "' + sName + '" from "' + src + '"');
		}
		return defaultStr || "";
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
			if(file.isDirectory()) //~ Hack: correctly handle install drive
				file.append(".");
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
	ensureFilePermissions: function(file, mask) {
		try {
			if(file.exists())
				file.permissions |= mask;
		}
		catch(e) {
			this._err("Can't change file permissions: " + file.path);
			Components.utils.reportError(e);
		}
	},
	copyFileTo: function(file, newParentDir, newName) {
		var target = (newParentDir || file.parent).clone();
		target.leafName = newName;
		if(target.exists())
			this.removeFile(file, true);
		this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_READ);
		try {
			file.copyTo(newParentDir, newName);
		}
		catch(e) {
			this._err("Can't copy " + file.path + " to " + target.path);
			Components.utils.reportError(e);
		}
	},
	moveFileTo: function(file, newParentDir, newName) {
		var target = (newParentDir || file.parent).clone();
		target.leafName = newName;
		this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
		this.ensureFilePermissions(target, this.PERMS_FILE_OWNER_WRITE);
		try {
			file.moveTo(newParentDir, newName);
		}
		catch(e) {
			this._err("Can't move " + file.path + " to " + target.path);
			Components.utils.reportError(e);
		}
	},
	removeFile: function(file, recursive) {
		this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
		try {
			file.remove(recursive);
		}
		catch(e) {
			this._err("Can't remove file " + file.path);
			Components.utils.reportError(e);
		}
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
	get canRunw() {
		delete this.canRunw;
		return this.canRunw = Components.classes["@mozilla.org/process/util;1"]
			.createInstance(Components.interfaces.nsIProcess)
			.hasOwnProperty("runw");
	},
	reveal: function(file) {
		// Based on code of function showDownload() from chrome://mozapps/content/downloads/downloads.js in Firefox 3.6
		// See https://developer.mozilla.org/en/nsILocalFile#Remarks
		var nsilf = Components.interfaces.nsILocalFile || Components.interfaces.nsIFile;
		if(!(file instanceof nsilf))
			return false;
		try {
			file.reveal();
			return true;
		}
		catch(e) {
			this._err(e);
		}
		if(!file.isDirectory()) {
			file = file.parent.QueryInterface(nsilf);
			if(!file)
				return false;
		}
		try {
			file.launch();
			return true;
		}
		catch(e) {
			this._err(e);
		}
		var uri = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
			.newFileURI(file);
		Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
			.getService(Components.interfaces.nsIExternalProtocolService)
			.loadUrl(uri);
		return true;
	},

	// File I/O (only UTF-8):
	PERMS_FILE_READ:        parseInt("0444", 8),
	PERMS_FILE_WRITE:       parseInt("0644", 8),
	PERMS_FILE_OWNER_READ:  parseInt("0400", 8),
	PERMS_FILE_OWNER_WRITE: parseInt("0600", 8),
	PERMS_DIRECTORY:        parseInt("0755", 8),
	get fp() {
		return Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
	},
	writeToFile: function(str, file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
		this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		try {
			fos.init(file, 0x02 | 0x08 | 0x20, this.PERMS_FILE_WRITE, 0);
		}
		catch(e) {
			this._err("Can't write string to file " + this._fileInfo(file));
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
				callback && callback.call(context || this, this.getErrorCode(err), err ? undefined : str);
				return !err;
			};
			return this.writeToFileAsync.apply(this, arguments);
		}
		try {
			this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_WRITE);
			var ostream = FileUtils.openSafeFileOutputStream(file);
			var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			suc.charset = "UTF-8";
			var istream = suc.convertToInputStream(str);
			NetUtil.asyncCopy(istream, ostream, this.bind(function(status) {
				var err = !Components.isSuccessCode(status);
				if(err)
					this._err("NetUtil.asyncCopy() failed: " + this.getErrorName(status));
				callback && callback.call(context || this, status, err ? undefined : str);
			}, this));
		}
		catch(e) {
			this._err("Can't write string to file " + this._fileInfo(file));
			this._err(e);
			callback && callback.call(context || this, this.getErrorCode(e));
			return false;
		}
		return true;
	},
	readFromFile: function(file, outErr) {
		if(!(file instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)))
			file = this.getLocalFile(file);
		// Don't check permissions: this is slow
		//this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_READ);
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, this.PERMS_FILE_READ, 0);
		}
		catch(e) {
			this._err("Can't read string from file " + this._fileInfo(file));
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
			this._log("readFromFileAsync(): asynchronous API not available");
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
			// Don't check permissions: this is slow
			//this.ensureFilePermissions(file, this.PERMS_FILE_OWNER_READ);
			NetUtil.asyncFetch(file, this.bind(function(istream, status) {
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
						if(this.getErrorCodeString(e) != "NS_BASE_STREAM_CLOSED")
							Components.utils.reportError(e);
					}
				}
				else {
					this._err("NetUtil.asyncFetch() failed: " + this.getErrorName(status));
				}
				callback.call(context || this, data, status);
			}, this));
		}
		catch(e) {
			this._err("Can't read string from file " + this._fileInfo(file));
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
		return Components.results[this.getErrorCodeString(err, defaultCode)];
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
	_fileInfo: function(file) {
		return file instanceof Components.interfaces.nsIFile
			? '"' + file.path + '"'
			: "<not a file> " + file;
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
	getTransferable: function(sourceWindow) {
		var ta = Components.classes["@mozilla.org/widget/transferable;1"]
			.createInstance(Components.interfaces.nsITransferable);
		if(
			sourceWindow
			&& sourceWindow instanceof Components.interfaces.nsIDOMWindow
			&& "init" in ta
		) try {
			Components.utils["import"]("chrome://gre/modules/PrivateBrowsingUtils.jsm");
			var privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(sourceWindow);
			ta.init(privacyContext);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return ta;
	},
	setClipboardData: function(dataObj, sourceWindow, clipId) {
		var ta = this.getTransferable(sourceWindow);
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
		var ta = this.getTransferable();
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
	copyStr: function(str, sourceDocument, clipId) {
		this.cbHelper.copyStringToClipboard(
			str,
			clipId === undefined ? this.cb.kGlobalClipboard : clipId,
			sourceDocument || document
		);
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
		// https://developer.mozilla.org/en-US/docs/Mozilla/Gecko/Versions
		if(this.isSeaMonkey) switch(ver) {
			case 2:   ver = 3.5; break;
			case 2.1: ver = 4;   break;
			default:  ver = parseFloat(this.appInfo.platformVersion);
		}
		delete this.fxVersion;
		return this.fxVersion = ver;
	},
	get osVersion() {
		delete this.osVersion; // String like "Windows NT 6.1"
		return this.osVersion = /\S\s+(\d.*)/.test(navigator.oscpu) ? parseFloat(RegExp.$1) : 0;
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

	isArray: function(str) {
		var f = this.isArray = this.hasNativeMethod(Array, "isArray")
			? Array.isArray
			: function(arr) {
				return arr instanceof Array
					|| Object.prototype.toString.call(arr) == "[object Array]";
			};
		return f.apply(this, arguments);
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
		return /\[native code\]\s*\}$/.test(Function.toString.call(func));
	},
	hasNativeMethod: function(obj, methName) {
		return methName in obj && typeof obj[methName] == "function" && this.isNativeFunction(obj[methName]);
	},
	unwrap: function(o) {
		this.unwrap = "XPCNativeWrapper" in window && "unwrap" in XPCNativeWrapper
			? function(o) {
				return o && XPCNativeWrapper.unwrap(o);
			}
			: function(o) {
				return o && o.wrappedJSObject || o
			};
		return this.unwrap.apply(this, arguments);
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

	objEquals: function() {
		Array.forEach(arguments, function(o) {
			this.sortObj(o, true);
		}, this);
		return this.objEqualsRaw.apply(this, arguments);
	},
	objEqualsRaw: function(o1) {
		var s = this.getSource(o1);
		return Array.slice(arguments, 1).every(function(o) {
			return this.getSource(o) === s;
		}, this);
	},
	sortObj: function(obj, deep, ignore) {
		if(!this.isObject(obj))
			return obj;
		var arr = [], ex = { __proto__: null };
		for(var p in obj) if(Object.hasOwnProperty.call(obj, p)) {
			var val = obj[p];
			if(deep && (!ignore || ignore.indexOf(p) == -1))
				this.sortObj(val, deep, ignore);
			arr.push(p);
			ex[p] = val;
			delete obj[p];
		}
		arr.sort().forEach(function(p) {
			obj[p] = ex[p];
		});
		return obj;
	},
	getSource: function(o) {
		return !this.isPrimitive(o) && !("toSource" in o) // !o.__proto__
			? Object.prototype.toSource.call(o)
			: uneval(o);
	},

	get wheelEvent() {
		delete this.wheelEvent;
		return this.wheelEvent = "WheelEvent" in window
			? "wheel"
			: "DOMMouseScroll";
	},
	get dragStartEvent() {
		delete this.dragStartEvent;
		return this.dragStartEvent = "ondragstart" in window
			? "dragstart"
			: "draggesture";
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
		//this._log("stopEvent " + e.type + "\n" + arguments.callee.caller);
	},
	isElementVisible: function(elt) {
		if(!elt)
			return false;
		var bo;
		if(elt.namespaceURI == this.XULNS)
			bo = elt.boxObject;
		if(!bo && "getBoundingClientRect" in elt)
			bo = elt.getBoundingClientRect();
		else
			bo = elt.ownerDocument.getBoxObjectFor(elt);
		if(bo.width === undefined && bo.top && bo.left) {
			bo.width = bo.right - bo.left;
			bo.height = bo.bottom - bo.top;
		}
		// https://bugzilla.mozilla.org/show_bug.cgi?id=530985
		// isElementVisible(elt) || elt.namespaceURI == "http://www.w3.org/2000/svg"
		return bo.height > 0 && bo.width > 0;
	},
	closeMenus: function(node) {
		// Based on function closeMenus from chrome://browser/content/utilityOverlay.js
		for(; node && "localName" in node; node = node.parentNode) {
			var ln = node.localName;
			if(
				node.namespaceURI == this.XULNS
				&& (ln == "menupopup" || ln == "popup" || ln == "panel")
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

	trim: function(str) {
		var f = this.trim = this.hasNativeMethod(String, "trim")
			? String.trim
			: function(str) {
				return String(str).replace(/^\s+|\s+$/g, "");
			};
		return f.apply(this, arguments);
	},
	encodeHTML: function(str, encDoubleQuotes, isAttr) {
		str = str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		if(encDoubleQuotes !== false)
			str = str.replace(/"/g, "&quot;");
		if(isAttr) {
			str = str
				.replace(/\t/g, "&#x9;")
				.replace(/\n/g, "&#xA;")
				.replace(/\r/g, "&#xD;");
		}
		return str;
	},
	isBlankPageURL: function(uri) {
		if("isBlankPageURL" in window)
			return isBlankPageURL(uri);
		return uri == "about:blank";
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
		//while(elt.hasChildNodes())
		//	elt.removeChild(elt.lastChild);
		elt.textContent = "";
	},

	storage: function(key, val) {
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
		var f  = this.storage = function(key, val) {
			if(arguments.length == 1)
				return key in this._storage ? this._storage[key] : undefined;
			if(val === undefined)
				delete this._storage[key];
			else
				this._storage[key] = val;
			return val;
		};
		return f.apply(this, arguments);
	},

	get xcr() {
		delete this.xcr;
		return this.xcr = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
			.getService(Components.interfaces.nsIXULChromeRegistry);
	},
	packageAvailable: function(packageName) {
		try {
			return /^[a-z]/.test(this.xcr.getSelectedLocale(packageName));
		}
		catch(e) {
		}
		return false;
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
			this._cleanup(cs[uid]);
			delete cs[uid];
		}
	},
	_cleanup: function(args) {
		args[0].apply(args[1] || window, args[2] || []);
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
	registerNodeCleanup: function(node, func, context, args) {
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
		var f = this.registerNodeCleanup = function(node, func, context, args) {
			return this._nodeCleanups.push(
				new this.NodeHandler(node, func, context, args, this._nodeCleanups.length)
			) - 1;
		};
		return f.apply(this, arguments);
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
var handyClicksUtils = {
	__proto__: handyClicksGlobals,

	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

	_err: function(e, fileName, lineNumber, isWarning) {
		if(this.ju.isPrimitive(e) || typeof e == "xml") {
			var caller = Components.stack.caller;
			if(isWarning) // Don't call directly, always use _warn()!
				caller = caller.caller;
			e = new Error(e, fileName || caller.filename, lineNumber || caller.lineNumber);
		}
		else if(!e || typeof e != "object") {
			Components.utils.reportError(e);
			return;
		}
		var cErr = Components.classes["@mozilla.org/scripterror;1"]
			.createInstance(Components.interfaces.nsIScriptError);
		// WorkerErrorEvent: message, filename, lineno
		cErr.init(
			this.errPrefix + e.message,
			fileName || e.fileName || e.filename,
			null,
			lineNumber || this.getLineNumber(e) || 0,
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
	_deprecated: function(msg, callerLevel) {
		for(var c = Components.stack.caller.caller; c && callerLevel--; c = c.caller);
		this._warn(msg, c.filename, c.lineNumber);
	},
	_stack: function _stack(prefix) {
		prefix = prefix || "";
		var callers = [];
		for(var cl = Components.stack.caller; cl; cl = cl.caller)
			callers.push(cl);
		var cnt = callers.length;
		callers.forEach(function(cl, i) {
			this._err(prefix + "[stack: " + ++i + "/" + cnt + "] " + cl, cl.filename, cl.lineNumber, true);
		}, this);
	},
	getLineNumber: function(err) {
		return err && (err.lineNumber || err.lineno) || undefined;
	},
	getRealLineNumber: function(err, baseLine) {
		// Usage:
		// var line = new Error().lineNumber + 1;
		// try { new Function(...)(); }
		// catch(err) { var realLine = getRealLineNumber(err, line); }
		var line = this.getLineNumber(err);
		if(
			/ line (\d+) > Function$/.test(err.fileName) // Firefox 30+
			&& RegExp.$1 == baseLine
		)
			return this.fixLineNumber(line); //~ todo: use mmLine() anyway ?
		return this.mmLine(this.fixLineNumber(line) - baseLine + 1);
	},
	fixLineNumber: function(line) {
		if(this.fxVersion >= 56 && (this.isFirefox || this.isSeaMonkey))
			return Math.max(1, line - 2); // O_o Strange things happens...
		if(this.isPaleMoon && this.appVersion >= 28.5)
			return Math.max(1, line - 1);
		return line;
	},
	objProps: function(o, filter, skipNativeFuncs) {
		if(this.ju.isPrimitive(o))
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
					typeof value == "function" && this.ju.isNativeFunction(value)
					|| typeof getter == "function" && this.ju.isNativeFunction(getter)
					|| typeof setter == "function" && this.ju.isNativeFunction(setter)
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

	NOTIFY_ICON_NORMAL: "normal",
	NOTIFY_ICON_DISABLED: "disabled",
	NOTIFY_ICON_WARNING: "warning",
	NOTIFY_ICON_ERROR: "error",
	notify: function(msg, opts) {
		if(arguments.length > 1 && !this.ju.isObject(opts))
			opts = this._convertNotifyArgs.apply(this, arguments);
		if(!opts)
			opts = {};
		var delayPref = "notify.openTime";
		var icon = opts.icon || this.NOTIFY_ICON_NORMAL;
		if(icon == this.NOTIFY_ICON_WARNING) {
			opts.title = opts.title || this.getLocalized("warningTitle");
			delayPref += "Warnings";
		}
		else if(icon == this.NOTIFY_ICON_ERROR) {
			opts.title = opts.title || this.getLocalized("errorTitle");
			delayPref += "Warnings";
		}
		var closeDelay = this.pu.get(delayPref);
		if(closeDelay <= 0)
			 return null;
		var buttons = opts.buttons || null;
		if(buttons) {
			opts.localized = opts.localized || {};
			for(var label in buttons) if(buttons.hasOwnProperty(label))
				if(label.charAt(0) == "$")
					opts.localized[label] = this.getLocalized(label.substr(1));
		}
		opts = {
			title:         opts.title         || this.getLocalized("title"),
			message:       msg                || "",
			onLeftClick:   opts.onLeftClick   || null,
			onMiddleClick: opts.onMiddleClick || null,
			buttons:       buttons            || null,
			localized:     opts.localized     || null,
			parentWindow:  opts.parentWindow  || window,
			context:       opts.context       || window,
			icon: icon,
			closeDelay: closeDelay,
			inWindowCorner: "inWindowCorner" in opts && opts.inWindowCorner !== undefined
				? opts.inWindowCorner
				: this.pu.get("notify.inWindowCorner"),
			dontCloseUnderCursor: this.pu.get("notify.dontCloseUnderCursor"),
			middleClickToClose:   this.pu.get("notify.middleClickToClose"),
			rearrangeWindows:     this.pu.get("notify.rearrangeWindows"),
			messageMaxWidth:      this.pu.get("notify.messageMaxWidth"),
			messageMaxHeight:     this.pu.get("notify.messageMaxHeight"),
			__proto__: null
		};
		var ws = this.pu.get("notify.dontOpenTwice")
			&& this.wu.wm.getEnumerator("handyclicks:notify");
		if(ws) while(ws.hasMoreElements()) {
			var w = ws.getNext();
			if(w.closed)
				continue;
			var arg = w.arguments && w.arguments[0];
			var optsStr = optsStr || this._stringifyOpts(opts);
			if(arg && this._stringifyOpts(arg) == optsStr) {
				this._log("notify(): switch to already opened window");
				this.makePopupWindowTopmost(w);
				w.hcNotify.blink();
				return w;
			}
		}
		var w = window.openDialog(
			"chrome://handyclicks/content/notify.xul",
			"_blank",
			"chrome,popup,titlebar=0",
			opts
		);
		// Note: alwaysRaised flag (and .zLevel = raisedZ/highestZ at startup) may cause system
		// "on top" for other browser windows
		var _this = this;
		w.addEventListener("load", function onLoad(e) {
			w.removeEventListener(e.type, onLoad, false);
			_this.makePopupWindowTopmost(w);
		}, false);
		return w;
	},
	notifyWarning: function(msg, opts) {
		(opts = opts || {}).icon = this.NOTIFY_ICON_WARNING;
		return this.notify(msg, opts);
	},
	notifyError: function(msg, opts) {
		(opts = opts || {}).icon = this.NOTIFY_ICON_ERROR;
		return this.notify(msg, opts);
	},
	notifyInWindowCorner: function(msg, opts) {
		if(arguments.length > 1 && !this.ju.isObject(opts))
			opts = this._convertNotifyArgs.apply(this, arguments);
		(opts = opts || {}).inWindowCorner = true;
		return this.notify(msg, opts);
	},
	_stringifyOpts: function(o) {
		var tmp = {};
		for(var p in o) {
			var v = o[p];
			if(!(v && typeof v == "object" && p != "buttons" && p != "localized"))
				tmp[p] = v;
		}
		return uneval(tmp);
	},
	_convertNotifyArgs: function(msg, header, funcLeftClick, funcMiddleClick, icon, parentWindow, inWindowCorner) {
		this._deprecated( //= Added: 2018-12-18
			'handyClicksUtils.notify(msg, header, ...) is deprecated. '
			+ 'Use handyClicksUtils.notify(msg, { title: "", ...}) instead.', 1
		);
		return {
			title: header,
			onLeftClick: funcLeftClick,
			onMiddleClick: funcMiddleClick,
			icon: icon,
			parentWindow: parentWindow,
			inWindowCorner: inWindowCorner
		};
	},
	makePopupWindowTopmost: function(w) {
		var xulWin = this.wu.getXulWin(w);
		var origZ = xulWin.zLevel;
		xulWin.zLevel = xulWin.raisedZ;
		w.setTimeout(function() {
			xulWin.zLevel = origZ;
		}, 0);
	},

	get toErrorConsole() {
		delete this.toErrorConsole;
		return this.toErrorConsole = this.ju.bind(this.openErrorConsole, this);
	},
	openErrorConsole: function() {
		var hasConsole2 = "@zeniko/console2-clh;1" in Components.classes
			|| "@mozilla.org/commandlinehandler/general-startup;1?type=console2" in Components.classes; // Firefox <= 3.6
		if(hasConsole2)
			return this.wu.openWindowByType("chrome://console2/content/console2.xul", "global:console");
		// Note: Browser Console not supported without opened browser windows
		var window = this.wu.browserWindow;
		if(!window)
			return this.wu.openWindowByType("chrome://global/content/console.xul", "global:console");
		var bcItem = window.document.getElementById("key_browserConsole");
		if(bcItem)
			return bcItem.doCommand();
		if("toErrorConsole" in window)
			return window.toErrorConsole();
		if("toJavaScriptConsole" in window)
			return window.toJavaScriptConsole();
		this._warn("openErrorConsole() failed: not found supported item in browser window");
		return null;
	},

	get promptsSvc() {
		delete this.promptsSvc;
		return this.promptsSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
	},
	alert: function(title, text, win) {
		this.ensureNotMinimized(win);
		this.promptsSvc.alert(win || window, title, text);
	},
	prompt: function(title, text, defVal, win) {
		this.ensureNotMinimized(win);
		var ret = { value: defVal };
		var res = this.promptsSvc.prompt(win || window, title, text, ret, null, {});
		return res ? ret.value : null;
	},
	confirm: function(title, text, win) {
		this.ensureNotMinimized(win);
		return this.promptsSvc.confirm(win || window, title, text);
	},
	confirmEx: function(title, text, buttonOkText, buttonOkDefault, checkText, checkObj, win) {
		this.ensureNotMinimized(win);
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
	fixMinimized: function(win) { //= Added: 2014-04-07
		this._deprecated("handyClicksUtils.fixMinimized() is deprecated. Use handyClicksUtils.ensureNotMinimized() instead.");
		return this.ensureNotMinimized.apply(this, arguments);
	},
	ensureNotMinimized: function(win) {
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=350299
		win = win || window;
		if(win.windowState == win.STATE_MINIMIZED)
			win.focus();
	},
	waitForPromptWindow: function(callback, context) {
		this.wu.ww.registerNotification({
			context: this,
			observe: function(subject, topic, data) {
				if(topic == "domwindowopened")
					subject.addEventListener("load", this, false);
			},
			handleEvent: function(e) {
				var win = e.currentTarget;
				win.removeEventListener(e.type, this, false);
				if(win.location != "chrome://global/content/commonDialog.xul")
					return;
				this.context.wu.ww.unregisterNotification(this);
				callback.call(context, win);
			}
		});
	},

	bind: function(func, context, args) { //= Added: 2019-02-13
		this._deprecated("handyClicksUtils.bind() is deprecated. Use handyClicksJsUtils.bind() instead.");
		return this.ju.bind.apply(this.ju, arguments);
	},

	_entities: { __proto__: null }, // cache of strings from *.dtd files
	getEntity: function(eName, dtds, contentType) {
		// Strange bug with Greasemonkey 0.8.20100408.6:
		// getEntity("statusbar.enabled", "chrome://greasemonkey/locale/greasemonkey.dtd");
		var dtd = dtds
			? "<!DOCTYPE page [\n"
				+ Array.prototype.concat.call(dtds).map(
					function(dtd, indx) {
						return '<!ENTITY % dtd' + indx + ' SYSTEM "' + dtd + '">\n%dtd' + indx + ';';
					}
				).join("\n")
				+ "\n]>\n"
			: "";
		var node = this.parseFromString(
			dtd + '<page xmlns="' + this.XULNS + '">&' + eName + ';</page>',
			contentType
		);
		//if(node.namespaceURI == "http://www.mozilla.org/newlayout/xml/parsererror.xml") {
		if(node.localName != "page") {
			dtd = dtds && Array.prototype.concat.call(dtds).join("\n");
			this._warn('Invalid XML entity: "' + eName + '"' + (dtd ? ", DTD:\n" + dtd : ""));
			return "";
		}
		return node.textContent;
	},
	getLocalizedEntity: function(eName, dtds, contentType) {
		return this._entities[eName] || (
			this._entities[eName] = this.getEntity(eName, dtds, contentType) || this.makeBuggyStr(eName)
		);
	},
	makeBuggyStr: function(s) {
		return "(" + s + ")\u034f";
	},
	isBuggyStr: function(s) {
		return s && /^\(.*\)\u034f$/.test(s);
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
		for(var tmp = file; tmp = this.getFileParent(tmp);)
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
		if(alias == "hc_PrefsDir")
			return this.ps.prefsDir.clone().QueryInterface(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
		if(alias == "hc_ScriptsDir")
			return this.ps._scriptsDir.clone().QueryInterface(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
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
			this.ju.bind(function(s, alias) {
				if(alias == "profile" || alias == "ProfD")
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
		return this.getLocalFileFromPath(path);
	},
	getLocalFileFromPath: function(path) {
		if(this.appInfo.OS == "WINNT")
			path = path.replace(/\//g, "\\");
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
			if(file.exists() && file.isDirectory()) //~ Hack: correctly handle install drive
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
	copyFileTo: function(file, newParentDir, newName) {
		var target = (newParentDir || file.parent).clone();
		target.leafName = newName;
		if(target.exists())
			this.removeFile(file, true);
		this.io.ensureFilePermissions(file, this.io.PERMS_FILE_OWNER_READ);
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
		this.io.ensureFilePermissions(file, this.io.PERMS_FILE_OWNER_WRITE);
		this.io.ensureFilePermissions(target, this.io.PERMS_FILE_OWNER_WRITE);
		try {
			file.moveTo(newParentDir, newName);
		}
		catch(e) {
			this._err("Can't move " + file.path + " to " + target.path);
			Components.utils.reportError(e);
		}
	},
	removeFile: function(file, recursive) {
		this.io.ensureFilePermissions(file, this.io.PERMS_FILE_OWNER_WRITE);
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
			var err = this.getLocalized("fileInvalidPath").replace("%p", path);
			this.notifyError(err, { buttons: {
				$openConsole: this.toErrorConsole
			}});
			return false;
		}
		if(!file.exists()) {
			this.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("fileNotFound").replace("%p", file.path)
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
				this.getLocalized("fileCantRun")
					.replace("%p", file.path)
					.replace("%err", e)
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

	get fp() {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		if("show" in fp)
			return fp;
		// Firefox 57+
		var tm = this.tm;
		return {
			__proto__: fp,
			show: function() {
				var rv;
				fp.open(function(r) {
					rv = r;
				});
				var thread = tm.currentThread;
				while(rv === undefined)
					thread.processNextEvent(false);
				return rv;
			}
		};
	},
	get tm() {
		delete this.tm;
		return this.tm = Components.classes["@mozilla.org/thread-manager;1"]
			.getService(Components.interfaces.nsIThreadManager);
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
	get eal() {
		delete this.eal;
		return this.eal = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
			.getService(Components.interfaces.nsPIExternalAppLauncher);
	},
	deleteTemporaryFileOnExit: function(file) {
		this.eal.deleteTemporaryFileOnExit(file);
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
	getClipboardData: function(flavor, clipId, qi) {
		if(!flavor)
			flavor = "text/unicode";
		var ta = this.getTransferable();
		ta.addDataFlavor(flavor);
		var cb = this.cb;
		cb.getData(ta, clipId === undefined ? cb.kGlobalClipboard : clipId);
		var data = {}, len = {};
		try {
			ta.getTransferData(flavor, data, len);
			if(flavor != "text/unicode")
				return data.value.QueryInterface(qi);
			return data.value
				.QueryInterface(Components.interfaces.nsISupportsString)
				.data
				.substr(0, len.value/2);
		}
		catch(e) {
		}
		return "";
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

	unwrap: function(o) {
		var f = this.unwrap = "XPCNativeWrapper" in window && "unwrap" in XPCNativeWrapper
			? function(o) {
				return o && XPCNativeWrapper.unwrap(o);
			}
			: function(o) {
				return o && o.wrappedJSObject || o;
			};
		return f.apply(this, arguments);
	},

	getGlobalForObject: function(o) {
		if(this.ju.isPrimitive(o))
			return null;
		if("getGlobalForObject" in Components.utils)
			return Components.utils.getGlobalForObject(o);
		return o.__parent__ || o.valueOf.call();
	},

	objEquals: function() {
		Array.prototype.forEach.call(arguments, function(o) {
			this.sortObj(o, true);
		}, this);
		return this.objEqualsRaw.apply(this, arguments);
	},
	objEqualsRaw: function(o1) {
		var s = this.getSource(o1);
		return Array.prototype.slice.call(arguments, 1).every(function(o) {
			return this.getSource(o) === s;
		}, this);
	},
	sortObj: function(obj, deep, ignore) {
		if(!this.ju.isObject(obj))
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
		return !this.ju.isPrimitive(o) && !("toSource" in o) // !o.__proto__
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
		e.stopImmediatePropagation && e.stopImmediatePropagation();
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

	hasModifier: function(e) {
		this._deprecated( //= Added: 2019-01-21
			"handyClicksUtils.hasModifier() is deprecated. Use handyClicksGlobals.hasModifier() instead."
		);
		return this.g.hasModifier(e);
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
		var f = this.trim = "trim" in String.prototype && "bind" in String.prototype.trim
			? String.prototype.trim.call.bind(String.prototype.trim)
			: function(str) {
				return ("" + str).replace(/^\s+|\s+$/g, "");
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
		return elt.innerHTML || Array.prototype.map.call(
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
	parseFromXML: function(xml) { // Deprecated
		this._deprecated("Called obsolete parseFromXML(), use parseXULFromString() without E4X instead");
		var pp = XML.prettyPrinting;
		XML.prettyPrinting = false;
		var elt = this.parseFromString(xml.toXMLString());
		XML.prettyPrinting = pp;
		return elt;
	},

	removeChilds: function(elt) {
		this._deprecated( //= Added: 2014-03-23
			"handyClicksUtils.removeChilds(node) is deprecated"
			+ ', use node.textContent = "" instead'
		);
		//while(elt.hasChildNodes())
		//	elt.removeChild(elt.lastChild);
		elt.textContent = "";
	},

	get xcr() {
		delete this.xcr;
		return this.xcr = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
			.getService(Components.interfaces.nsIXULChromeRegistry);
	},
	packageAvailable: function(packageName) {
		if(packageName) try {
			return /^[a-z]/.test(this.xcr.getSelectedLocale(packageName));
		}
		catch(e) {
		}
		return false;
	}
};
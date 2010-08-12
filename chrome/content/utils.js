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
		this._err(e, fileName, lineNumber, true);
	},
	objProps: function(o, mask) { // mask like "id, nodeName, parentNode.id"
		if(this.isPrimitive(o))
			return o;
		if(!mask)
			return this._objProps(o);
		var r = mask.split(/[,;\s]+/).map(
			function(p) {
				return p + " = " + this.getProperty.apply(this, [o].concat(p.split(/\s*\.\s*/)));
			},
			this
		);
		return r.join("\n");
	},
	_objProps: function(o) {
		var r = [];
		for(var p in o)
			r.push(p + " = " + (Object.hasOwnProperty.call(o, p) ? "[own] " : "") + this.safeToString(this.safeGet(o, p)));
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
	timer: function(tId, division) {
		var ts = this._timers;
		if(tId in ts) {
			var dt = Date.now() - ts[tId];
			if(division)
				dt /= division;
			this._log(<>[timer] {tId} -> {dt} ms</>);
			delete ts[tId];
			return dt;
		}
		return ts[tId] = Date.now();
	},

	hasPrefix: function(str, prefix) {
		return typeof str == "string" && str.indexOf(prefix) == 0;
	},
	removePrefix: function(str, prefix) {
		return this.hasPrefix(str, prefix)
			? str.substr(prefix.length)
			: str;
	},
	hasPostfix: function(str, postfix) {
		return typeof str == "string" && str.indexOf(postfix) == str.length - postfix.length;
	},
	removePostfix: function(str, postfix) {
		if(typeof str != "string")
			return str;
		var indx = str.indexOf(postfix);
		return indx == str.length - postfix.length
			? str.substring(0, indx)
			: str;
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
		return this.bind(this.openErrorConsole, this);
	},
	openErrorConsole: function() {
		if("toErrorConsole" in top)
			return top.toErrorConsole();
		if("toJavaScriptConsole" in top)
			return top.toJavaScriptConsole();
		return this.wu.openWindowByType("chrome://global/content/console.xul", "global:console");
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
			this._warn(<>Can't get localized string "{sName}" from "{src}".</>);
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
			this._warn(<>Invalid XML entity: "{eName}"</>);
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
		return file && file.QueryInterface(Components.interfaces.nsILocalFile);
	},
	getFileByAlias: function(alias, dontShowErrors) {
		if(alias == "_ProfDrv")
			return this.getLocalFileRoot(this.ps.profileDir);
		if(alias == "_SysDrv")
			return this.getLocalFileRoot(this.getFileByAlias("SysD"));
		try {
			return Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get(alias, Components.interfaces.nsILocalFile);
		}
		catch(e) {
			if(dontShowErrors)
				return null;
			this._err(<>Invalid directory alias: "{alias}"</>);
			this._err(e);
		}
		return null;
	},
	expandVariables: function(str) {
		return this.expandInternalVariables(this.expandEnvironmentVariables(str));
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
			this.ut.bind(function(s, alias) {
				if(alias.toLowerCase() == "profile" || alias == "ProfD")
					return this.ps._profileDir.path;
				var aliasFile = this.getFileByAlias(alias);
				return aliasFile ? aliasFile.path : s;
			}, this)
		);
	},
	getLocalFile: function(path) {
		if(!path)
			return path;
		path = this.expandVariables(path);
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			file.initWithPath(path);
		}
		catch(e) {
			this._err(<>Invalid path: "{path}"</>);
			this._err(e);
			return null;
		}
		try { file.normalize(); } // dir1/dir2/../file -> dir1/file
		catch(e) {}
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
				this.ut.NOTIFY_ICON_ERROR
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

	// File I/O:
	writeToFile: function(str, file) { // UTF-8
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		try {
			fos.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		}
		catch(e) {
			this._err(<>Can't write string to file "{file && file.path}"</>);
			this._err(e);
			fos.close();
			return false;
		}
		var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		cos.init(fos, "UTF-8", 0, 0);
		cos.writeString(str);
		cos.close(); // this closes fos
		return true;
	},
	readFromFile: function _rff(file) { // UTF-8
		_rff.error = false;
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, 0444, 0);
		}
		catch(e) {
			this._err(<>Can't read string from file "{file && file.path}"</>);
			this._err(e);
			fis.close();
			_rff.error = true;
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
				.substr(0, len.value / 2);
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
		// Based on code of Adblock Plus 1.2.1
		// chrome\adblockplus.jar\content\utils.js
		// Platform's line breaks by reading prefs.js
		var br = "\n";
		try {
			var prefFile = this.getFileByAlias("PrefF");
			var is = Components.classes["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Components.interfaces.nsIFileInputStream);
			is.init(prefFile, 0x01, 0444, 0);
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
	platformLineBreaks: function(str) {
		return str.replace(/\r\n?|\n\r?/g, this.lineBreak);
	},

	get isArray() { // function(arr)
		delete this.isArray;
		return this.isArray = "isArray" in Array //~ todo: check for "[native code]" ?
			? Array.isArray
			: function(arr) {
				arr instanceof Array
					|| Object.prototype.toString.call(arr) === "[object Array]";
			};
	},
	isObject: function(obj) {
		return typeof obj == "object" && obj !== null;
	},
	isEmptyObj: function(o) { // Error console says "Warning: deprecated __count__ usage" for obj.__count__
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

	getOwnProperty: function(obj) { // this.getOwnProperty(obj, "a", "b", "propName") instead of obj.a.b.propName
		var u;
		if(this.isPrimitive(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; i++) {
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
		for(var i = 1, len = a.length - 1; i <= len; i++) {
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
		for(var i = 1, len = a.length - 2; i <= len; i++) {
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
	attribute: function(node, attr, val, allowEmpty) {
		if(val || allowEmpty && val === "")
			node.setAttribute(attr, val);
		else
			node.removeAttribute(attr);
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
	closeMenus: function _cm(node) {
		// Based on function closeMenus from chrome://browser/content/utilityOverlay.js
		if(!this.isObject(node))
			return;
		if(
			node.namespaceURI == this.XULNS
			&& (node.localName == "menupopup" || node.localName == "popup")
		)
			node.hidePopup();
		_cm.call(this, node.parentNode);
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
		return this.mm(n, 1, 100000);
	},

	get trim() { // function(str)
		delete this.trim;
		return this.trim = "trim" in String //~ todo: check for "[native code]" ?
			? String.trim
			: function(str) {
				return str.replace(/^\s+|\s+$/g, "");
			};
	},

	// E4X
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
	parseFromXML: function(xml) {
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
			return arguments.length == 1
				? key in this._storage
					? this._storage[key]
					: undefined
				: (this._storage[key] = val);
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
	doCleanup: function(uid) {
		var cs = this._cleanups;
		if(uid in cs)
			this.cleanup.apply(this, cs[uid]);
	},
	cleanup: function(func, context, args) {
		func.apply(context, args);
	},
	destroy: function() {
		this._cleanups.forEach(this.cleanup, this);
		delete this._cleanups;
	},

	_nodeCleanups: [],
	registerNodeCleanup: function(node, func, context, args) {
		var win = node.ownerDocument.defaultView;
		var cleanup = function _cu(e) {
			var node = _cu.node;
			var doc = node.ownerDocument;
			var win = doc.defaultView;
			if(typeof e == "object") {
				var type = e.type;
				if(type == "unload") {
					if(e.target.defaultView !== win)
						return;
				}
				else if(type == "DOMNodeRemoved")
					for(node = node.parentNode; node; node = node.parentNode)
						if(node === doc)
							return;
			}
			win.removeEventListener("unload", _cu, true);
			win.removeEventListener("DOMNodeRemoved", _cu, true);
			e && _cu.func.apply(_cu.context, _cu.args);
			delete _cu.cuSvc._nodeCleanups[_cu.uid];
		};
		cleanup.node = func.node = node;
		cleanup.func = func;
		cleanup.context = context;
		cleanup.args = args;
		cleanup.cuSvc = this;
		var uid = this._nodeCleanups.push(cleanup) - 1;
		cleanup.uid = uid;

		win.addEventListener("unload", cleanup, true);
		win.addEventListener("DOMNodeRemoved", cleanup, true);

		return uid;
	},
	unregisterNodeCleanup: function(uid) {
		var cs = this._nodeCleanups;
		if(uid in cs)
			cs[uid](false);
	},
	doNodeCleanup: function(uid) {
		var cs = this._nodeCleanups;
		if(uid in cs)
			cs[uid](true);
	}
};

var handyClicksExtensionsHelper = {
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
			"Application" in window
			&& "getExtensions" in Application && !("extensions" in Application)
			&& !this.ut.storage("extensions")
			&& !this.ut.storage("extensionsPending")
		) {
			// Hack for Firefox 3.7a5pre+
			// Following code is asynchronous and take some time... so, starts them as soon possible
			this.ut.storage("extensionsPending", true);
			Application.getExtensions(this.ut.bind(function(exts) {
				this.ut.storage("extensions", exts);
				this.ut.storage("extensionsPending", false);
				var scheduledTasks = this.ut.storage("extensionsScheduledTasks");
				if(scheduledTasks) {
					scheduledTasks.forEach(function(task) {
						task.func.apply(task.context, task.args);
					});
					this.ut.storage("extensionsScheduledTasks", null);
				}
			}, this));
		}
	},
	get exts() {
		var exts = Application.extensions || this.ut.storage("extensions");
		if(exts) {
			delete this.exts;
			return this.exts = exts;
		}
		return exts;
	},
	isAvailable: function(guid) {
		return this.isInstalled(guid) && this.isEnabled(guid);
	},
	isInstalled: function(guid) {
		return "Application" in window
			? this.exts && this.exts.has(guid)
			: this.em.getInstallLocation(guid);
	},
	isEnabled: function(guid) {
		if("Application" in window)
			return this.exts && this.exts.get(guid).enabled;
		var res  = this.rdf.GetResource("urn:mozilla:item:" + guid);
		var opType = this.getRes(res, "opType");
		return opType != "needs-enable" && opType != "needs-install"
			&& this.getRes(res, "userDisabled") != "true"
			&& this.getRes(res, "appDisabled") != "true";
	},
	getRes: function(res, type) {
		var tar = this.em.datasource.GetTarget(
			res, this.rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + type), true
		);
		return (
			tar instanceof Components.interfaces.nsIRDFLiteral
			|| tar instanceof Components.interfaces.nsIRDFInt
		) && tar.Value;
	}
};
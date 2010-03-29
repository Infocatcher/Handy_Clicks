var handyClicksUtils = {
	errPrefix: "[Handy Clicks]: ",
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

	get consoleSvc() {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	_log: function() {
		this.consoleSvc.logStringMessage(
			this.errPrefix +
			Array.join(
				Array.map(arguments, this.safeToString), // Convert all arguments to strings
				"\n"
			)
		);
	},
	_err: function(e, isWarning, fileName, lineNumber) {
		if(typeof e == "string")
			e = new Error(e);
		if(e.constructor !== Error) {
			Components.utils.reportError(e);
			return;
		}
		var cErr = Components.classes["@mozilla.org/scripterror;1"]
			.createInstance(Components.interfaces.nsIScriptError);
		cErr.init(
			this.errPrefix + e.message,
			fileName || e.fileName,
			null,
			lineNumber || e.lineNumber || 0,
			e.columnNumber || 0,
			isWarning ? 1 : 0,
			null
		);
		this.consoleSvc.logMessage(cErr);
	},
	objProps: function(o, mask) { // mask like "id, nodeName, parentNode.id"
		if(!this.canHasProps(o))
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
		var has = "hasOwnProperty" in o;
		for(var p in o)
			r.push(p + " = " + (has && o.hasOwnProperty(p) ? "[own] " : "") + this.safeToString(this.safeGet(o, p)));
		return r.join("\n");
	},
	safeGet: function(o, p) {
		try { return o[p]; }
		catch(e) { return "" + e; }
	},
	safeToString: function(object) { // var obj = { __proto__: null }; => obj.toString() is missing
		try { return "" + object; }
		catch(e) { return "" + e; }
	},

	_timers: { __proto__: null },
	timer: function(tId) {
		var ts = this._timers;
		if(tId in ts) {
			var dt = Date.now() - ts[tId];
			this._log("[timer] " + tId + " -> " + dt + " ms");
			delete ts[tId];
			return dt;
		}
		return ts[tId] = Date.now();
	},

	notify: function(msg, header, funcLeftClick, funcMiddleClick, extEnabled, inWindowCorner) {
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
			 	extEnabled: extEnabled === undefined ? true : extEnabled,
			 	inWindowCorner: inWindowCorner === undefined ? this.pu.pref("notifyInWindowCorner") : inWindowCorner,
			 	dontCloseUnderCursor: this.pu.pref("notifyDontCloseUnderCursor"),
			 	__proto__: null
			 }
		);
	},
	notifyInWindowCorner: function(msg, header, funcLeftClick, funcMiddleClick, extEnabled) {
		return this.notify(msg, header, funcLeftClick, funcMiddleClick, extEnabled, true);
	},

	get console() {
		return window.toErrorConsole || window.toJavaScriptConsole;
	},
	get promptsSvc() {
		delete this.promptsSvc;
		return this.promptsSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
	},
	alertEx: function(ttl, txt) {
		this.promptsSvc.alert(window, ttl, txt);
	},
	promptEx: function(ttl, txt, defVal) {
		var ret = { value: defVal };
		var res = this.promptsSvc.prompt(window, ttl, txt, ret, null, {});
		return res ? ret.value : null;
	},
	confirmEx: function(ttl, txt) {
		return this.promptsSvc.confirm(window, ttl, txt);
	},

	bind: function(func, context, args) {
		return function() {
			func.apply(context, args);
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
		try { return this.getBundle(src).GetStringFromName(sName); }
		catch(e) { return ""; }
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
		dtds = dtds && "<!DOCTYPE dialog [\n"
			+ Array.concat(dtds).map(
					function(dtd, indx) {
						return '<!ENTITY % dtd' + indx + ' SYSTEM "' + dtd + '">\n%dtd' + indx + ';';
					}
				).join("\n")
			+ "\n]>";
		var node = this.parseFromString(
			(dtds ? dtds + "\n" : "")
			+ '<page xmlns="' + this.XULNS + '">&' + eName + ';</page>',
			contentType
		);
		if(node.namespaceURI == "http://www.mozilla.org/newlayout/xml/parsererror.xml") {
			this._err(new Error("Invalid XML entity: \"" + eName + "\""));
			return "";
		}
		return node.textContent;
	},
	getLocalizedEntity: function(eName, dtds, contentType) {
		return this._entities[eName] || (
			this._entities[eName] = this.getEntity(eName, dtds)
				|| this.makeBuggyStr(eName)
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
				.replace("%l", label)
				.replace("%id", type)
				.replace("%e", err);
	},

	getLocalFile: function(path) {
		if(!path)
			return path;
		var _this = this;
		path = path.replace(
			/^%([^%]+)%/,
			function(s, alias) {
				if(alias.toLowerCase() == "profile" || alias == "ProfD")
					return _this.ps._profileDir.path;
				try {
					return Components.classes["@mozilla.org/file/directory_service;1"]
						.getService(Components.interfaces.nsIProperties)
						.get(alias, Components.interfaces.nsILocalFile)
						.path;
				}
				catch(e) {
					_this.ut._err(new Error("Invalid directory alias: " + s));
					_this.ut._err(e);
					return s;
				}
			}
		);
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			file.initWithPath(path);
			file.normalize(); // dir1/dir2/../file -> dir1/file
		}
		catch(e) {
			this.ut._err(new Error("Invalid path: " + path));
			this.ut._err(e);
			return null;
		}
		return file;
	},
	getLocalPath: function(path) {
		var file = this.getLocalFile(path);
		return file ? file.path : path;
	},
	startProcess: function(path, args) {
		args = args || [];
		var file = this.ut.getLocalFile(path);
		if(!file) {
			this.ut.notify(
				this.ut.getLocalized("invalidFilePath").replace("%p", path)
					+ this.ut.getLocalized("openConsole"),
				this.ut.getLocalized("errorTitle"),
				this.ut.console
			);
			return false;
		}
		if(!file.exists()) {
			this.ut.alertEx(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("fileNotFound").replace("%p", path)
			);
			return false;
		}
		var process = Components.classes["@mozilla.org/process/util;1"]
			.createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		try {
			process.run(false, args, args.length);
			return true;
		}
		catch(e) {
			this.ut.alertEx(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("fileCantRun").replace("%p", path).replace("%e", e)
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
			this.ut._err(new Error("Can't write string to file\"" + file.path + "\""));
			this.ut._err(e);
			fos.close();
			return;
		}
		var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		cos.init(fos, "UTF-8", 0, 0);
		cos.writeString(str);
		cos.close(); // this closes fos
	},
	readFromFile: function(file) { // UTF-8
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			fis.init(file, 0x01, 0444, 0);
		}
		catch(e) {
			this.ut._err(new Error("Can't read string from file\"" + file.path + "\""));
			this.ut._err(e);
			fis.close();
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
			this._err(new Error("Can't convert UTF-8 to unicode"));
			this._err(e);
		}
		return str;
	},

	// Clipboard:
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	readFromClipboard: function(trimFlag) {
		// function readFromClipboard() chrome://browser/content/browser.js
		var url;

		try {
			// Get clipboard.
			var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
				.getService(Components.interfaces.nsIClipboard);

			// Create tranferable that will transfer the text.
			var trans = Components.classes["@mozilla.org/widget/transferable;1"]
				.createInstance(Components.interfaces.nsITransferable);

			trans.addDataFlavor("text/unicode");

			// If available, use selection clipboard, otherwise global one
			if(clipboard.supportsSelectionClipboard())
				clipboard.getData(trans, clipboard.kSelectionClipboard);
			else
				clipboard.getData(trans, clipboard.kGlobalClipboard);

			var data = {};
			var dataLen = {};
			trans.getTransferData("text/unicode", data, dataLen);

			if(data) {
				data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
				url = data.data.substring(0, dataLen.value / 2);
			}
		}
		catch (ex) {}

		url = url || "";
		return trimFlag ? this.trim(url) : url;
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
			.getService(Components.interfaces.nsIXULAppInfo);
	},
	get isSeaMonkey() {
		delete this.isSeaMonkey;
		return this.isSeaMonkey = this.appInfo.name == "SeaMonkey";
	},
	get fxVersion() {
		var ver = parseFloat(this.appInfo.version); // 3.0 for "3.0.10"
		if(this.isSeaMonkey) switch(ver) {
			case 2:   ver = 3.5; break;
			case 2.1:
			default:  ver = 3.7;
		}
		delete this.fxVersion;
		return this.fxVersion = ver;
	},

	isObject: function(obj) {
		return typeof obj == "object" && obj !== null;
	},
	isArray: function(arr) {
		return arr instanceof Array
			|| this.sandbox.Object.prototype.toString.call(arr) === "[object Array]";
	},
	canHasProps: function(o) {
		if(!o)
			return false;
		var t = typeof o;
		return t !== "string" && t !== "number" && t !== "boolean";
	},
	isEmptyObj: function(o) { // Error console says "Warning: deprecated __count__ usage" for obj.__count__
		for(var p in o) if(o.hasOwnProperty(p))
			return false;
		return true;
	},

	getOwnProperty: function(obj) { // this.getOwnProperty(obj, "a", "b", "propName") instead of obj.a.b.propName
		var u;
		if(!this.canHasProps(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; i++) {
			p = a[i];
			if(!(p in obj) || "hasOwnProperty" in obj && !obj.hasOwnProperty(p))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(!this.canHasProps(obj))
				return u;
		}
		return u;
	},
	getProperty: function(obj) {
		var u;
		if(!this.canHasProps(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; i++) {
			p = a[i];
			if(!(p in obj))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(!this.canHasProps(obj))
				return u;
		}
		return u;
	},
	setOwnProperty: function(obj) { // obj, "x", "y", value
		var a = arguments, p, len = a.length - 2;
		for(var i = 1; i <= len; i++) {
			p = a[i];
			if(!(p in obj) || "hasOwnProperty" in obj && !obj.hasOwnProperty(p) || !this.isObject(obj[p]))
				obj[p] = {};
			if(i != len)
				obj = obj[p];
		}
		obj[a[len]] = a[len + 1];
	},

	toArray: function(a) {
		return typeof a.length == "number" && a.length >= 0
			? Array.filter(a, function() { return true; })
			: [a];
	},

	objEquals: function(o1) {
		var s = this.getSource(o1);
		return Array.slice(arguments, 1).every(
			function(o) {
				return this.getSource(o) === s;
			},
			this
		);
	},
	getSource: function(o) {
		return this.canHasProps(o) && !o.__proto__
			? this.sandbox.Object.prototype.toSource.call(o)
			: uneval(o);
	},

	get sandbox() {
		delete this.sandbox;
		return this.sandbox = new Components.utils.Sandbox("about:blank");
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

	mm: function(n, minVal, maxVal) {
		return Math.max(Math.min(n, maxVal), minVal);
	},
	mmLine: function(n) {
		if(n >= 0xFFFFFFFF)
			n = 1;
		return this.mm(n, 1, 100000);
	},

	get trim() {
		delete this.trim;
		return this.trim = "trim" in String && String.trim.toString().indexOf("[native code]") != -1
			? function(s) {
				return s.trim();
			}
			: function(s) {
				return s.replace(/^\s+|\s+$/g, "");
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

	get _storage() {
		var w = Components.classes["@mozilla.org/appshell/appShellService;1"]
			.getService(Components.interfaces.nsIAppShellService)
			.hiddenDOMWindow;
		const ns = "__handyClicks__";
		if(!(ns in w)) {
			w[ns] = { __proto__: null };
			w.addEventListener("unload", function _u(e) {
				w.removeEventListener("unload", _u, false);
				delete w[ns];
			}, false);
		}
		delete this._storage;
		return this._storage = w[ns];
	},
	storage: function(key, val) {
		if("Application" in window) { // Firefox 3.0+
			const ns = "__handyClicks__";
			return arguments.length == 1
				? Application.storage.get(ns + key, null)
				: Application.storage.set(ns + key, val);
		}
		return arguments.length == 1
			? key in this._storage ? this._storage[key] : null
			: (this._storage[key] = val);
	},

	fixIconsSize: function(popup) {
		var icon = new Image();
		icon.src = "moz-icon://.js?size=16"; // Sometimes I see 14x14 instead of 16x16 in Windows 7
		this.timeout(
			function(icon, popup) {
				popup.setAttribute("handyclicks_iconSize", icon.width);
				if(this._devMode && icon.width != 16)
					this._log("Icon size: " + icon.width + " x " + icon.height);
			},
			this, [icon, popup], 0
		);
	}
};

function HandyClicksObservers() {
	this.observers = [];
}
HandyClicksObservers.prototype = {
	notifyObservers: function() {
		var args = arguments;
		this.observers.forEach(
			function(ob) {
				ob[0].apply(ob[1] || window, args);
			}
		);
	},
	addObserver: function(fnc, context) {
		return this.observers.push([fnc, context]) - 1;
	},
	removeObserver: function(oId) {
		delete this.observers[oId];
	}
};

var handyClicksCleanupSvc = {
	storage: [],
	destroy: function() {
		this.storage.forEach(this.cleanupEntry, this);
		this.storage = [];
	},
	registerCleanup: function(cFunc, context, args, node) {
		var cId = this.storage.push([cFunc, context, args]) - 1;
		if(node)
			this.registerNodeCleanup(cId, node);
		return cId;
	},
	registerNodeCleanup: function(cId, node) {
		node.addEventListener("DOMNodeRemoved", ncu, true);
		var nId = this.registerCleanup(
			function(node, ncu) {
				node.removeEventListener("DOMNodeRemoved", ncu, true);
			},
			null, [node, ncu]
		);
		var _this = this;
		function ncu(e) {
			if(e.originalTarget !== node)
				return;
			_this.doCleanup(nId);
			_this.doCleanup(cId);
		};
	},
	unregisterCleanup: function(cId) {
		delete this.observers[cId];
	},
	doCleanup: function(cId) {
		var strg = this.storage;
		if(!(cId in strg))
			return;
		var cu = strg[cId];
		delete strg[cId];
		this.cleanupEntry(cu);
	},
	cleanupEntry: function(cArr) {
		try {
			cArr[0].apply(cArr[1] || this, cArr[2] || []);
		}
		catch(e) {
			this.ut._err(e);
		}
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
	isAvailable: function(guid) {
		return this.isInstalled(guid) && this.isEnabled(guid);
	},
	isInstalled: function(guid) {
		return "Application" in window
			? Application.extensions.has(guid)
			: this.em.getInstallLocation(guid);
	},
	isEnabled: function(guid) {
		if("Application" in window)
			return Application.extensions.get(guid).enabled;
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
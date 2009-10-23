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
	_err: function(e, warn, fileName, lineNumber) {
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
			warn ? 1 : 0,
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
		return r.join("\n\n");
	},
	_objProps: function(o) {
		var r = [];
		var has = "hasOwnProperty" in o;
		for(var p in o)
			r.push(p + (has && o.hasOwnProperty(p) ? " [own]" : "") + " = " + this.safeToString(this.safeGet(o, p)));
		return r.join("\n\n");
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
		if(tId in this._timers) {
			this._log("[timer] " + tId + " -> " + (Date.now() - this._timers[tId]) + " ms");
			delete this._timers[tId];
		}
		else
			this._timers[tId] = Date.now();
	},

	notify: function(header, msg, fnc0, fnc1, extEnabled, inWindowCorner) {
		var dur = this.pu.pref("notifyOpenTime");
		if(dur <= 0)
			 return null;
		return window.openDialog(
			 "chrome://handyclicks/content/notify.xul",
			 "_blank",
			 "chrome,dialog=1,titlebar=0,popup=1",
			 {
			 	dur: dur,
			 	header: header || this.ut.getLocalized("title"),
			 	msg: msg || "",
			 	fnc0: fnc0, fnc1: fnc1,
			 	extEnabled: extEnabled === undefined ? true : extEnabled,
			 	inWindowCorner: inWindowCorner === undefined ? this.pu.pref("notifyInWindowCorner") : inWindowCorner,
			 	dontCloseUnderCursor: this.pu.pref("notifyDontCloseUnderCursor"),
			 	__proto__: null
			 }
		);
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
				|| "(" + sName + ")"
		);
	},

	errInfo: function(textId, label, type, err) {
		return this.ut.getLocalized(textId)
			+ this.ut.getLocalized("errorDetails")
				.replace("%l", label)
				.replace("%id", type)
				.replace("%e", err);
	},

	// File I/O:
	writeToFile: function(str, file) { // UTF-8
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
		var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		cos.init(fos, "UTF-8", 0, 0);
		cos.writeString(str);
		cos.close(); // this closes fos
	},
	readFromFile: function(file) { // UTF-8
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
			.createInstance(Components.interfaces.nsIScriptableInputStream);
		fis.init(file, 0x01, 0444, null);
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
			this._err(this.errPrefix + "Can't convert UTF-8 to unicode\n" + e);
		}
		return str;
	},

	// Clipboard:
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	readFromClipboard: function() {
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
		return url || "";
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
		return this.isSeaMonkey = this.appInfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
	},
	get fxVersion() {
		var ver = parseFloat(this.appInfo.version); // 3.0 for "3.0.10"
		if(this.isSeaMonkey) // SeaMonkey
			ver = 3.5;
		delete this.fxVersion;
		return this.fxVersion = ver;
	},

	isObject: function(obj) {
		return typeof obj == "object" && obj !== null;
	},
	isArray: function(arr) {
		return arr instanceof Array
			|| Object.prototype.toString.call(arr) === "[object Array]";
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

	attribute: function(node, attr, val, allowEmpty) {
		if(val || allowEmpty && val === "")
			node.setAttribute(attr, val);
		else
			node.removeAttribute(attr);
	},
	isElementVisible: function(elt) {
		// chrome://browser/content/utilityOverlay.js
		// function isElementVisible(aElement)
		// If elt or a direct or indirect parent is hidden or collapsed,
		// height, width or both will be 0.
		var bo = elt.boxObject;
		return bo.height > 0 && bo.width > 0;
	},

	mm: function(n, minVal, maxVal) {
		return Math.max(Math.min(n, maxVal), minVal);
	},
	mmLine: function(n) {
		if(n == 0xFFFFFFFF) // Max int number
			n = 1;
		return this.mm(n, 1, 100000);
	},

	// E4X
	fromXML: function(xml) {
		var pp = XML.prettyPrinting;
		XML.prettyPrinting = false;
		var elt = new DOMParser().parseFromString(xml.toXMLString(), "application/xml").documentElement;
		XML.prettyPrinting = pp;
		return elt;
	}
};

function HandyClicksObservers() {
	this.observers = [];
}
HandyClicksObservers.prototype = {
	notifyObservers: function() {
		var obs = this.observers;
		for(var i = 0, len = obs.length; i < len; i++)
			if(i in obs)
				obs[i][0].apply(obs[i][1] || this, arguments);
	},
	addPrefsObserver: function(fnc, context) {
		this.observers.push([fnc, context]);
		return this.observers.length - 1;
	},
	removePrefsObserver: function(oId) {
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
		this.storage.push([cFunc, context, args]);
		var cId = this.storage.length - 1;
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
		return this.em.getInstallLocation(guid);
	},
	isEnabled: function(guid) {
		var res  = this.rdf.GetResource("urn:mozilla:item:" + guid);
		var opType = this.getRes(res, "opType");
		return opType != "needs-disable" && opType != "needs-enable"
			&& opType != "needs-uninstall" && opType != "needs-install"
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
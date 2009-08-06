var handyClicksUtils = {
	errPrefix: "[Handy Clicks]: ",

	get consoleSvc() {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	_log: function() {
		this.consoleSvc.logStringMessage(
			this.errPrefix +
			Array.prototype.join.call(
				Array.prototype.map.call(arguments, this.safeToString), // Convert all arguments to strings
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
			lineNumber || e.lineNumber,
			e.columnNumber,
			warn ? 1 : 0,
			null
		);
		this.consoleSvc.logMessage(cErr);
	},
	objProps: function(o, mask) { // mask like "id, nodeName, parentNode.id"
		if(!this.isObject(o))
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
			r.push(p + (has && o.hasOwnProperty(p) ? " [own]" : "") + " = " + this.safeToString(o[p]));
		return r.join("\n\n");
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

	notify: function(nTitle, msg, fnc0, fnc1, extEnabled, inWindowCorner) {
		var dur = this.pu.pref("notifyOpenTime");
		if(dur <= 0)
			 return;
		extEnabled = typeof extEnabled == "boolean" ? extEnabled : true;
		inWindowCorner = typeof inWindowCorner == "boolean"
			? inWindowCorner
			: this.pu.pref("notifyInWindowCorner");
		window.openDialog(
			 "chrome://handyclicks/content/notify.xul",
			 "_blank",
			 "chrome,dialog=1,nTitlebar=0,popup=1",
			 {
			 	dur: dur,
			 	nTitle: nTitle || "", msg: msg || "",
			 	fnc0: fnc0, fnc1: fnc1,
			 	extEnabled: extEnabled, inWindowCorner: inWindowCorner,
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

	// Localised strings:
	_strings: { __proto__: null }, // cache of strings from stringbundle
	createBundle: function(src) {
		return Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService)
			.createBundle(src);
	},
	get localeBundle() {
		delete this.localeBundle;
		return this.localeBundle = this.createBundle("chrome://handyclicks/locale/hcs.properties");
	},
	get defaultBundle() {
		delete this.defaultBundle;
		return this.defaultBundle = this.createBundle("chrome://handyclicks-locale/content/hcs.properties");
	},
	getLocaleStr: function(name) {
		try { return this.localeBundle.GetStringFromName(name); }
		catch(e) { return null; }
	},
	getDefaultStr: function(name) {
		try { return this.defaultBundle.GetStringFromName(name); }
		catch(e) { return null; }
	},
	getLocalized: function(name) {
		if(!(name in this._strings))
			this._strings[name] = this.getLocaleStr(name) || this.getDefaultStr(name) || "(" + name + ")";
		return this._strings[name];
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

	isNoChromeWin: function(win) {
		return win.toString().indexOf("[object Window]") > -1; // [object XPCNativeWrapper [object Window]]
	},
	isNoChromeDoc: function(doc) {
		doc = doc || handyClicks.item.ownerDocument;
		return this.isNoChromeWin(doc.defaultView);
	},

	get fxVersion() {
		delete this.fxVersion;
		return this.fxVersion = parseFloat( // 3.0 for "3.0.10"
			Components.classes["@mozilla.org/xre/app-info;1"]
			.getService(Components.interfaces.nsIXULAppInfo)
			.version
		);
	},

	isObject: function(obj) {
		return typeof obj == "object" && obj !== null;
	},
	isArray: function(arr) {
		return arr instanceof Array
			|| Object.prototype.toString.call(arr) === "[object Array]";
	},
	getOwnProperty: function(obj) { // this.getOwnProperty(obj, "a", "b", "propName") instead of obj.a.b.propName
		var u;
		if(!this.isObject(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; i++) {
			p = a[i];
			if(!(p in obj) || "hasOwnProperty" in obj && !obj.hasOwnProperty(p))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(!this.isObject(obj))
				return u;
		}
		return u;
	},
	getProperty: function(obj) {
		var u;
		if(!this.isObject(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; i++) {
			p = a[i];
			if(!(p in obj))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(!this.isObject(obj))
				return u;
		}
		return u;
	},
	mm: function(n, minVal, maxVal) {
		return Math.max(Math.min(n, maxVal), minVal);
	},
	mmLine: function(n) {
		return this.mm(n, 1, 100000);
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
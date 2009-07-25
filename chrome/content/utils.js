var handyClicksObservers = {
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
var handyClicksUtils = {
	get pu() { return handyClicksPrefUtils; },
	errPrefix: "[Handy Clicks]: ",

	get consoleSvc() {
		delete this.consoleSvc;
		return this.consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
	},
	_log: function() {
		this.consoleSvc.logStringMessage(this.errPrefix + Array.prototype.join.call(arguments, "\n"));
	},
	get _err() {
		return Components.utils.reportError;
	},

	timers: { __proto__: null },
	timer: function(tId) {
		if(tId in this.timers) {
			this._log("[timer] " + tId + " -> " + (Date.now() - this.timers[tId]) + " ms");
			delete this.timers[tId];
		}
		else
			this.timers[tId] = Date.now();
	},

	notify: function(nTitle, msg, fnc, extEnabled, inWindowCorner) {
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
			 	fnc: fnc, extEnabled: extEnabled, inWindowCorner: inWindowCorner,
			 	__proto__: null
			 }
		);
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
	getLocaleStr: function(name) {
		if(!this._localeBundle)
			this._localeBundle = this.createBundle("chrome://handyclicks/locale/hcs.properties");
		try { return this._localeBundle.GetStringFromName(name); }
		catch(e) { return null; }
	},
	getDefaultStr: function(name) {
		if(!this._defaultBundle)
			this._defaultBundle = this.createBundle("chrome://handyclicks-locale/content/hcs.properties");
		try { return this._defaultBundle.GetStringFromName(name); }
		catch(e) { return null; }
	},
	getLocalised: function(name) {
		if(!(name in this._strings))
			this._strings[name] = this.getLocaleStr(name) || this.getDefaultStr(name) || "[" + name + "]";
		return this._strings[name];
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
			if(obj.__proto__ !== u && !obj.hasOwnProperty(p))
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
	}
};
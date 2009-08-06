var handyClicksRegSvc = {
	init: function() { // window "load"
		window.removeEventListener("load", this, false);
		this.registerServices(true);
		window.addEventListener("unload", this, false);
	},
	destroy: function() { // window "unlod"
		window.removeEventListener("unload", this, false);
		this.registerServices(false);
	},
	get s() {
		var s = {
			cn: "handyClicksConsole",
			cs: "handyClicksCleanupSvc",
			ed: "handyClicksEditor",
			fn: "handyClicksFuncs",
			hc: "handyClicks",
			ps: "handyClicksPrefSvc",
			pu: "handyClicksPrefUtils",
			rs: "handyClicksRegSvc",
			st: "handyClicksSets",
			ut: "handyClicksUtils",
			wu: "handyClicksWinUtils"
		};
		var _s = {}, oName;
		for(p in s) if(s.hasOwnProperty(p)) {
			oName = s[p];
			if(oName in window)
				_s[p] = window[oName];
		}
		return _s;
	},
	registerServices: function(regFlag) {
		var s = this.s;
		if(regFlag) {
			this.registerShortcuts(s, true);
			this.callMethods(s, "init");
		}
		else {
			this.callMethods(s, "destroy");
			this.registerShortcuts(s, false);
		}
	},
	registerShortcuts: function(s, regFlag) {
		var proto = regFlag ? s : Object.prototype;
		var o;
		for(var p in s) if(s.hasOwnProperty(p)) {
			o = s[p];
			o.__proto__ = proto;
			if(regFlag && "HandyClicksObservers" in window)
				o.__proto__.__proto__ = new HandyClicksObservers(); // Add observers interface
		}
	},
	callMethods: function(s, meth) {
		var o;
		for(var p in s) if(s.hasOwnProperty(p)) {
			o = s[p];
			if(o !== this && meth in o)
				o[meth]();
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init(e);    break;
			case "unload": this.destroy(e);
		}
	}
};
window.addEventListener("load", handyClicksRegSvc, false);
var handyClicksRegSvc = {
	__proto__: handyClicksGlobals,

	instantInit: function(reloadFlag) {
		var dt = (this.now() - this._startTime).toFixed(2);
		this._log("Scripts loaded into " + this.path + ": " + dt + " ms");
		window.addEventListener("load", this, false);
		this.callMethods("instantInit", reloadFlag);
	},
	init: function(reloadFlag) { // window "load"
		window.removeEventListener("load", this, false);
		window.addEventListener("unload", this, false);
		this.callMethods("init", reloadFlag);
		window._handyClicksInitialized = true;
		this.delay(function() {
			var noCache = reloadFlag ? "?" + Date.now() : "";
			this.jsLoader.loadSubScript("chrome://handyclicks/content/reloader.js" + noCache);
			handyClicksReloader.init(reloadFlag);
		}, this, reloadFlag ? 0 : 500);
	},
	destroy: function(reloadFlag) { // window "unlod"
		window.removeEventListener("unload", this, false);
		this.callMethods("destroy", reloadFlag);
		if("handyClicksReloader" in window)
			handyClicksReloader.destroy(reloadFlag);
		if(!reloadFlag)
			this.g.shutdown();
		this.cleanup();
		delete window._handyClicksInitialized;
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
	},
	callMethods: function(methName, reloadFlag) {
		var t = this.now();
		this.callable.forEach(function(o) {
			if(o !== this && o.hasOwnProperty(methName))
				o[methName](reloadFlag);
		}, this);
		var dt = (this.now() - t).toFixed(2);
		this._log(methName + "() in " + this.path + ": " + dt + " ms");
	},

	_cleanups: [],
	registerCleanup: function(fn, context) {
		return this._cleanups.push([fn, context]) - 1;
	},
	unregisterCleanup: function(uid) {
		delete this._cleanups[uid];
	},
	cleanup: function() {
		this._cleanups.forEach(function(cd) {
			cd[0].call(cd[1] || window);
		});
		this._cleanups.length = 0;
	}
};
handyClicksRegSvc.instantInit();
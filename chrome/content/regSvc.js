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
			this.jsLoader.loadSubScript("chrome://handyclicks/content/_reloader.js" + noCache);
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
	}
};
handyClicksRegSvc.instantInit();
var handyClicksRegSvc = {
	__proto__: handyClicksGlobals,

	instantInit: function(reloadFlag) {
		window.addEventListener("load", this, false);
		this.callMethods("instantInit", reloadFlag);
	},
	init: function(reloadFlag) { // window "load"
		window.removeEventListener("load", this, false);
		window.addEventListener("unload", this, false);
		this.callMethods("init", reloadFlag);
		window._handyClicksInitialized = true;
		setTimeout(function(_this) {
			_this.delayedInit(reloadFlag);
		}, 0, this);
	},
	delayedInit: function(reloadFlag) {
		var noCache = reloadFlag ? "?" + Date.now() : "";
		this.jsLoader.loadSubScript("chrome://handyclicks/content/_reloader.js" + noCache);
		handyClicksReloader.init(reloadFlag);
	},
	destroy: function(reloadFlag) { // window "unlod"
		window.removeEventListener("unload", this, false);
		this.callMethods("destroy", reloadFlag);
		if("handyClicksReloader" in window)
			handyClicksReloader.destroy(reloadFlag);
		this.g.shutdown();
		delete window._handyClicksInitialized;
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":   this.init();    break;
			case "unload": this.destroy();
		}
	},
	loadSubScript: function(/*path, obj*/) {
		this.ut._deprecated("handyClicksRegSvc.loadSubScript() is depracated, use handyClicksGlobals.jsLoader.loadSubScript() instead");
		var jsl = this.jsLoader;
		return jsl.loadSubScript.apply(jsl, arguments);
	},
	callMethods: function(methName, reloadFlag) {
		this.initializable.forEach(function(o) {
			if(o !== this && o.hasOwnProperty(methName))
				o[methName](reloadFlag);
		}, this);
	}
};
handyClicksRegSvc.instantInit();
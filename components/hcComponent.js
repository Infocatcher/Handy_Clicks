// Implementation of handyclicks:// protocol and command-line handler
// Based on code from following extensions:
//   * Adblock Plus 1.0.2 ( https://addons.mozilla.org/firefox/addon/1865 )
//   * Custom Buttons 0.0.4.5 ( https://addons.mozilla.org/firefox/addon/2707 )

const Cc = Components.classes,
      Ci = Components.interfaces,
      Cr = Components.results;

const P_CID = Components.ID("{40835331-35F5-4bdf-85AB-6010E332D585}"),
      P_CONTRACTID = "@mozilla.org/network/protocol;1?name=handyclicks",
      P_HANDLER = Ci.nsIProtocolHandler,
      P_SCHEME = "handyclicks",
      P_NAME = "Handy Clicks protocol handler";

const C_CID = Components.ID("{50C6263F-F53F-4fbd-A295-9BA84C5FAAC3}"),
      C_CONTRACTID = "@mozilla.org/commandlinehandler/general-startup;1?type=handyclicks",
      C_HANDLER = Ci.nsICommandLineHandler,
      C_CATEGORY = "m-handyclicks",
      C_ARG_DISABLE = "handyclicks-disable",
      C_ARG_DISABLE_INFO = "  -handyclicks-disable    Turn off Handy Clicks extension\n",
      C_NAME = "Handy Clicks command-line handler";

var global = this;
this.__defineGetter__("handyClicksGlobals", function() {
	delete this.handyClicksGlobals;
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://handyclicks/content/globals.js");
	return handyClicksGlobals;
});
setTimeout(function() {
	handyClicksGlobals.jsLoader.loadSubScript("chrome://handyclicks/content/uninstaller.js");
}, 300);

// https://bugzilla.mozilla.org/show_bug.cgi?id=1413413
var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
	.getService(Components.interfaces.nsIXULAppInfo);
var app = appInfo.name;
if((app == "Firefox" || app == "SeaMonkey") && parseFloat(appInfo.platformVersion) >= 58) {
	var Preferences = Components.utils["import"]("resource://gre/modules/Preferences.jsm", {}).Preferences;
	var prefs = new Preferences({ defaultBranch: true });
	handyClicksGlobals.jsLoader.loadSubScript("chrome://handyclicks-icon/skin/defaults/preferences/hcPrefs.js", {
		pref: prefs.set.bind(prefs)
	}, "UTF-8");
}

function handleURI(uri) {
	var g = handyClicksGlobals;
	if(startsWith(uri, g.ct.PROTOCOL_SETTINGS))
		g.wu.openSettingsLink(uri);
	else if(startsWith(uri, g.ct.PROTOCOL_EDITOR))
		g.wu.openEditorLink(uri);
}
function disable() {
	Cc["@mozilla.org/preferences-service;1"]
		.getService(Ci.nsIPrefBranch)
		.setBoolPref("extensions.handyclicks.enabled", false);
}
function startsWith(str, prefix) {
	var f = startsWith = "startsWith" in String.prototype
		? String.prototype.startsWith.call.bind(String.prototype.startsWith)
		: function(str, prefix) {
			return str.substr(0, prefix.length) == prefix;
		};
	return f.apply(this, arguments);
}

function setTimeout(callback, delay) {
	var timer = Cc["@mozilla.org/timer;1"]
		.createInstance(Ci.nsITimer);
	timer.init({ observe: callback }, delay, timer.TYPE_ONE_SHOT);
	return timer;
}

var _lastURI, _timer;
const protocol = {
	// nsIProtocolHandler interface implementation
	defaultPort: -1,
	protocolFlags: P_HANDLER.URI_NORELATIVE
		| P_HANDLER.URI_NOAUTH
		| P_HANDLER.URI_LOADABLE_BY_ANYONE
		| P_HANDLER.URI_NON_PERSISTABLE
		| P_HANDLER.URI_DOES_NOT_RETURN_DATA,
	scheme: P_SCHEME,
	allowPort: function() {
		return false;
	},
	newURI: function(spec, originCharset, baseURI) {
		var url = Cc["@mozilla.org/network/standard-url;1"]
			.createInstance(Ci.nsIStandardURL);
		url.init(Ci.nsIStandardURL.URLTYPE_STANDARD, 0, spec, originCharset, baseURI);
		return url.QueryInterface(Ci.nsIURI);
	},
	newChannel: function(uri) {
		//handleURI(uri.spec);
		// See http://tmp.garyr.net/forum/viewtopic.php?p=55624#p55624
		// and https://bitbucket.org/onemen/tabmixplus/src/1f25033b4a52/chrome/content/links/contentLinks.js#cl-185
		// We have similar bug...
		if(uri.spec != _lastURI) {
			handleURI(uri.spec);
			_timer && _timer.cancel();
			_lastURI = uri.spec;
			_timer = setTimeout(function() {
				_lastURI = _timer = null;
			}, 150);
		}
		return false;
	}
};

const cmdLine = {
	// nsICommandLineHandler interface implementation
	handle: function(cmdLine) {
		if(cmdLine.handleFlag(C_ARG_DISABLE, false))
			disable();
	},
	helpInfo: C_ARG_DISABLE_INFO
};

const factory = {
	// nsIFactory interface implementation
	createInstance: function(outer, iid) {
		if(outer != null)
			throw Cr.NS_ERROR_NO_AGGREGATION;
		if(iid.equals(P_HANDLER))
			return protocol;
		if(iid.equals(C_HANDLER))
			return cmdLine;
		throw Cr.NS_ERROR_NO_INTERFACE;
	},
	lockFactory: function(lock) {
		throw Cr.NS_ERROR_NOT_IMPLEMENTED;
	},
	// nsISupports interface implementation
	QueryInterface: function(iid) {
		if(iid.equals(Ci.nsISupports) || iid.equals(Ci.nsIFactory))
			return this;
		throw Cr.NS_ERROR_NO_INTERFACE;
	}
};

const module = {
	get catMan() {
		return Cc["@mozilla.org/categorymanager;1"]
			.getService(Ci.nsICategoryManager);
	},
	// nsIModule interface implementation
	registerSelf: function(compMgr, fileSpec, location, type) {
		compMgr.QueryInterface(Ci.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(P_CID, P_NAME, P_CONTRACTID, fileSpec, location, type);
		compMgr.registerFactoryLocation(C_CID, C_NAME, C_CONTRACTID, fileSpec, location, type);
		this.catMan.addCategoryEntry("command-line-handler", C_CATEGORY, C_CONTRACTID, false, true);
	},
	unregisterSelf: function(compMgr, fileSpec, location) {
		compMgr.QueryInterface(Ci.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(P_CID, fileSpec);
		compMgr.unregisterFactoryLocation(C_CID, fileSpec);
		this.catMan.deleteCategoryEntry("command-line-handler", C_CATEGORY, false);
	},
	getClassObject: function(compMgr, cid, iid) {
		if(!cid.equals(P_CID) && !cid.equals(C_CID))
			throw Cr.NS_ERROR_NO_INTERFACE;
		if(!iid.equals(Ci.nsIFactory))
			throw Cr.NS_ERROR_NOT_IMPLEMENTED;
		return factory;
	},
	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(comMgr, fileSpec) {
	return module;
}
function NSGetFactory(cid) {
	if(!cid.equals(P_CID) && !cid.equals(C_CID))
		throw Cr.NS_ERROR_FACTORY_NOT_REGISTERED;
	return factory;
}
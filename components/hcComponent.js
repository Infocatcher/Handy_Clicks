// Implementation of handyclicks:// protocol
// Some code based on code of following extensions:
//   * Adblock Plus 1.0.2 ( https://addons.mozilla.org/firefox/addon/1865 )
//   * Custom Buttons 0.0.4.5 ( https://addons.mozilla.org/firefox/addon/2707 )

// Implementation of command-line handler

const cc = Components.classes,
      ci = Components.interfaces,
      cr = Components.results;

const P_CID = Components.ID("{40835331-35F5-4bdf-85AB-6010E332D585}"),
      P_CONTRACTID = "@mozilla.org/network/protocol;1?name=handyclicks",
      P_HANDLER = ci.nsIProtocolHandler,
      P_SCHEME = "handyclicks",
      P_NAME = "Handy Clicks protocol handler";

const C_CID = Components.ID("{50C6263F-F53F-4fbd-A295-9BA84C5FAAC3}"),
      C_CONTRACTID = "@mozilla.org/commandlinehandler/general-startup;1?type=handyclicks",
      C_HANDLER = ci.nsICommandLineHandler,
      C_CATEGORY = "m-handyclicks",
      C_ARG_DISABLE = "handyclicks-disable",
      C_ARG_DISABLE_INFO = "  -handyclicks-disable    Turn off Handy Clicks extension\n",
      C_NAME = "Handy Clicks command-line handler";

const jsLoader = cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(ci.mozIJSSubScriptLoader);

jsLoader.loadSubScript("chrome://handyclicks/content/uninstaller.js");

var wu, ct;
function initOnce() {
	initOnce = function() {};
	jsLoader.loadSubScript("chrome://handyclicks/content/winUtils.js"); wu = handyClicksWinUtils;
	jsLoader.loadSubScript("chrome://handyclicks/content/consts.js");   ct = handyClicksConst;
	wu.ct = ct;
}
function handleURI(uri) {
	initOnce();
	if(hasPrefix(uri, ct.PROTOCOL_SETTINGS))
		wu.openSettingsLink(uri);
	else if(hasPrefix(uri, ct.PROTOCOL_EDITOR))
		wu.openEditorLink(uri);
}
function disable() {
	cc["@mozilla.org/preferences-service;1"]
		.getService(ci.nsIPrefBranch)
		.setBoolPref("extensions.handyclicks.enabled", false);
}
function hasPrefix(str, prefix) {
	return str.substr(0, prefix.length) == prefix;
}

/*
function alert(s, title) {
	cc["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(ci.nsIPromptService)
		.alert(null, title || "Handy Clicks", s);
}
*/

function setTimeout(callback, delay) {
	var timer = cc["@mozilla.org/timer;1"]
		.createInstance(ci.nsITimer);
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
		var url = cc["@mozilla.org/network/standard-url;1"]
			.createInstance(ci.nsIStandardURL);
		url.init(ci.nsIStandardURL.URLTYPE_STANDARD, 0, spec, originCharset, baseURI);
		return url.QueryInterface(ci.nsIURI);
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
			throw cr.NS_ERROR_NO_AGGREGATION;
		//init();
		if(iid.equals(P_HANDLER))
			return protocol;
		if(iid.equals(C_HANDLER))
			return cmdLine;
		throw cr.NS_ERROR_NO_INTERFACE;
	},
	lockFactory: function(lock) {
		throw cr.NS_ERROR_NOT_IMPLEMENTED;
	},
	// nsISupports interface implementation
	QueryInterface: function(iid) {
		if(iid.equals(ci.nsISupports) || iid.equals(ci.nsIFactory))
			return this;
		throw cr.NS_ERROR_NO_INTERFACE;
	}
};

const module = {
	get catMan() {
		return cc["@mozilla.org/categorymanager;1"]
			.getService(ci.nsICategoryManager);
	},
	// nsIModule interface implementation
	registerSelf: function(compMgr, fileSpec, location, type) {
		compMgr.QueryInterface(ci.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(P_CID, P_NAME, P_CONTRACTID, fileSpec, location, type);
		compMgr.registerFactoryLocation(C_CID, C_NAME, C_CONTRACTID, fileSpec, location, type);
		this.catMan.addCategoryEntry("command-line-handler", C_CATEGORY, C_CONTRACTID, false, true);
	},
	unregisterSelf: function(compMgr, fileSpec, location) {
		compMgr.QueryInterface(ci.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(P_CID, fileSpec);
		compMgr.unregisterFactoryLocation(C_CID, fileSpec);
		this.catMan.deleteCategoryEntry("command-line-handler", C_CATEGORY, false);
	},
	getClassObject: function(compMgr, cid, iid) {
		if(!cid.equals(P_CID) && !cid.equals(C_CID))
			throw cr.NS_ERROR_NO_INTERFACE;
		if(!iid.equals(ci.nsIFactory))
			throw cr.NS_ERROR_NOT_IMPLEMENTED;
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
		throw cr.NS_ERROR_FACTORY_NOT_REGISTERED;
	return factory;
}
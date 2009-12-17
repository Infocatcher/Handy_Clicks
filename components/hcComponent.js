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
      P_HANDLER = ci.nsIProtocolHandler;

const C_CID = Components.ID("{50C6263F-F53F-4fbd-A295-9BA84C5FAAC3}"),
      C_CONTRACTID = "@mozilla.org/commandlinehandler/general-startup;1?type=handyclicks",
      C_HANDLER = ci.nsICommandLineHandler,
      C_CATEGORY = "m-handyclicks";

const jsLoader = cc["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(ci.mozIJSSubScriptLoader);

var initialized = false;
var wu;
function init() {
	initialized = true;
	jsLoader.loadSubScript("chrome://handyclicks/content/winUtils.js");
	wu = handyClicksWinUtils;
}
function handleURI(uri) {
	const sets = "handyclicks://settings/";
	const add = "add/";
	if(uri.indexOf(sets) == 0) {
		uri = uri.substr(sets.length);
		if(uri.indexOf(add) == 0) {
			wu.openSettings(true, 2, uri.substr(add.length));
			return;
		}
		wu.openSettings();
		return;
	}
	wu.openLink(uri); // Not used now...
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

const protocol = {
	defaultPort: -1,
	protocolFlags: P_HANDLER.URI_NORELATIVE
		| P_HANDLER.URI_NOAUTH
		| P_HANDLER.URI_LOADABLE_BY_ANYONE
		| P_HANDLER.URI_NON_PERSISTABLE
		| P_HANDLER.URI_DOES_NOT_RETURN_DATA,
	scheme: "handyclicks",
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
		handleURI(uri.spec);
		return false;
	}
};

const cmdLine = {
	// nsICommandLineHandler interface implementation
	handle: function(cmdLine) {
		var indx = cmdLine.findFlag("handyclicks-disable", false);
		if(indx == -1)
			return;
		cmdLine.removeArguments(indx, indx);
		cc["@mozilla.org/preferences-service;1"]
			.getService(ci.nsIPrefBranch)
			.setBoolPref("extensions.handyclicks.enabled", false);
	},
	helpInfo: "  -handyclicks-disable          Turn off Handy Clicks\n"
};

const factory = {
	// nsIFactory interface implementation
	createInstance: function(outer, iid) {
		if(outer != null)
			throw cr.NS_ERROR_NO_AGGREGATION;
		if(!initialized)
			init();
		if(iid.equals(P_HANDLER))
			return protocol;
		if(iid.equals(C_HANDLER))
			return cmdLine;
		throw cr.NS_ERROR_NO_INTERFACE;
	},
	lockFactory: function(lock) {
	},
	// nsISupports interface implementation
	QueryInterface: function(iid) {
		if(iid.equals(ci.nsISupports) || iid.equals(ci.nsIFactory))
			return this;
		throw cr.NS_ERROR_NO_INTERFACE;
	}
};

const module = {
	registerSelf: function(compMgr, fileSpec, location, type) {
		compMgr.QueryInterface(ci.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(P_CID, "Handy Clicks protocol handler", P_CONTRACTID, fileSpec, location, type);
		compMgr.registerFactoryLocation(C_CID, "Handy Clicks command-line handler", C_CONTRACTID, fileSpec, location, type);
		cc["@mozilla.org/categorymanager;1"]
			.getService(ci.nsICategoryManager)
			.addCategoryEntry("command-line-handler", C_CATEGORY, C_CONTRACTID, true, true);
	},
	unregisterSelf: function(compMgr, fileSpec, location) {
		compMgr.QueryInterface(ci.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(P_CID, fileSpec);
		compMgr.unregisterFactoryLocation(C_CID, fileSpec);
		cc["@mozilla.org/categorymanager;1"]
			.getService(ci.nsICategoryManager)
			.deleteCategoryEntry("command-line-handler", C_CATEGORY);
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
// Implementation of handyclicks:// protocol
// Some code based on code of following extensions:
//   * Adblock Plus 1.0.2 ( https://addons.mozilla.org/firefox/addon/1865 )
//   * Custom Buttons 0.0.4.5 ( https://addons.mozilla.org/firefox/addon/2707 )

const cc = Components.classes,
      ci = Components.interfaces,
      cr = Components.results;

const P_CID = Components.ID("{40835331-35F5-4bdf-85AB-6010E332D585}");
const P_CONTRACTID = "@mozilla.org/network/protocol;1?name=handyclicks";
const P_HANDLER = ci.nsIProtocolHandler;

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

const factory = {
	// nsIFactory interface implementation
	createInstance: function(outer, iid) {
		if(outer != null)
			throw cr.NS_ERROR_NO_AGGREGATION;
		if(!iid.equals(P_HANDLER))
			throw cr.NS_ERROR_NO_INTERFACE;
		if(!initialized)
			init();
		return protocol;
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
		compMgr
			.QueryInterface(ci.nsIComponentRegistrar)
			.registerFactoryLocation(P_CID, "Handy Clicks protocol handler", P_CONTRACTID, fileSpec, location, type);
	},
	unregisterSelf: function(compMgr, fileSpec, location) {
		compMgr
			.QueryInterface(ci.nsIComponentRegistrar)
			.unregisterFactoryLocation(P_CID, fileSpec);
	},
	getClassObject: function(compMgr, cid, iid) {
		if(!cid.equals(P_CID))
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
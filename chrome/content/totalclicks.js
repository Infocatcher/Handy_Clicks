var totalClicks = {
	p_enabled: true,
	disabledBy: {
		mousemove: false,
		cMenu: false
	},
	event: null, // ???
	origItem: null,
	item: null,
	itemType: undefined,
	p_forceHideContextMenu: false, // for Linux (mousedown -> contextmenu -> click)
	p_convertURIs: true, // for Windows
	p_convertURIsTo: "", // use defaults
	_isFx3: null,
	_cMenu: null,
	cMenuTimeout: null,
	strOnMousedown: "",
	hasMousemoveHandler: false,
	prefs: Components.classes["@mozilla.org/preferences;1"]
		.createInstance(Components.interfaces.nsIPref),
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	init: function() {
		window.removeEventListener("load", this, false);

		// this.loadSettings();
		this.readPrefs(["enabled", "forceHideContextMenu", "convertURIs", "convertURIsTo"]);

		window.addEventListener("mousedown", this, true);
		window.addEventListener("click", this, true);

		this.prefs.addObserver("totalclicks.", this, false);
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);

		window.removeEventListener("mousedown", this, true);
		window.removeEventListener("click", this, true);

		this.prefs.removeObserver("totalclicks.", this);
	},
	get isFx3() {
		if(this._isFx3 == null)
			this._isFx3 = Components.classes["@mozilla.org/xre/app-info;1"]
				.getService(Components.interfaces.nsIXULAppInfo)
				.version.indexOf("3.") == 0;
		return this._isFx3;
	},
	get disabled() {
		if(!this.p_enabled)
			return true;
		for(var p in this.disabledBy)
			if(this.disabledBy[p])
				return true;
		return false;
	},
	skipTmpDisabled: function() {
		for(var p in this.disabledBy)
			this.disabledBy[p] = false;
		this.removeMousemoveHandler();
	},
	get cMenu() {
		var cm = null;
		switch(this.itemType) { // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
			case "link":
			case "img":
				cm = document.getElementById("contentAreaContextMenu");
			break;
			case "bookmark":
				cm = document.getElementById("bookmarks-context-menu") || document.getElementById("placesContext");
			break;
			case "historyItem":
				// Ex Bookmark Properties ( https://addons.mozilla.org/firefox/addon/7396 ):
				cm = "ex2BookmarksProperties" in window && document.getElementById("placesContext"); //~ todo: test!
			break;
			case "tab":
				var cm = document.getAnonymousElementByAttribute(getBrowser(), "anonid", "tabContextMenu"); //~ todo: test!
			break;
			case "submitButton":
				cm = null; //~ todo: SubmitToTab for fx3 => add cm
		}
		this._cMenu = cm; // cache
		return cm;
	},
	mousedownHandler: function(e) { //~ todo: hide context menu for Linux
		if(!this.p_enabled)
			return;
		var evtStr = this.getEvtStr(e);
		this.strOnMousedown = evtStr;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		this.defineItem(e, sets);

		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;

		var _this = this;
		var cm = this.cMenu;
		//~ todo: show menu after timeout // _this.disabledBy.cMenu = true;
		if(cm && e.button == 2) {
			cm.addEventListener(
				"popupshowing",
				function(e) {
					_this.clearCMenuTimeout();
					window.removeEventListener(e.type, arguments.callee, true);
				},
				true
			);
		}
		if(!this.hasMousemoveHandler) {
			window.addEventListener("mousemove", this, true); // only for right-click?
			this.hasMousemoveHandler = true;
		}
		if(this.p_forceHideContextMenu)
			window.addEventListener(
				"contextmenu",
				function(e) {
					_this.stopEvent(e);
					window.removeEventListener(e.type, arguments.callee, true);
				},
				true
			);
	},
	mousemoveHandler: function(e) {
		this.disabledBy.mousemove = true;
		this.clearCMenuTimeout();
		this._log("mousemoveHandler -> this.disabledBy.mousemove = true;");
		this.removeMousemoveHandler();
	},
	removeMousemoveHandler: function() {
		window.removeEventListener("mousemove", this, true);
		this.hasMousemoveHandler = false;
	},
	getEvtStr: function(e) {
		return "button=" + e.button
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey;
	},
	getSettings: function(str) {
		return (totalClicksPrefs || {})[str];
	},
	defineItem: function(e, sets) {
		this.event = e;
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		this.origItem = it;
		var itnn = it.nodeName.toLowerCase();

		// img:
		// if(sets["img"])
		if((itnn == "img" || itnn == "image") && it.src) {
			this.itemType = "img";
			this.item = it;
			return; //~ if(sets["img"].ignoreLinks) return;
		}

		// Link:
		var a = it, ann = itnn;
		while(ann != "#document" && ann != "a") {
			a = a.parentNode;
			ann = a.nodeName.toLowerCase();
		}
		if(ann == "a" && a.href) {
			this.itemType = "link";
			this.item = a;
			return;
		}

		// Bookmark:
		if(
			it.namespaceURI == this.XULNS //~ todo: check NS for all?
			&& it.type != "menu"
			&& (
				(
					/(^|\s+)bookmark-item(\s+|$)/.test(it.className)
					&& (itnn == "toolbarbutton" || itnn == "menuitem")
				)
				|| (itnn == "menuitem" && (it.hasAttribute("siteURI")))
			)
			&& it.parentNode.id != "historyUndoPopup"
		) {
			this.itemType = "bookmark";
			this.item = it;
			return;
		}

		// History item:
		if(
			it.statusText
			&& /(^|\s+)menuitem-iconic(\s+|$)/.test(it.className)
			&& /(^|\s+)bookmark-item(\s+|$)/.test(it.className)
			&& it.parentNode.id == "goPopup"
		) {
			this.itemType = "historyItem";
			this.item = it;
			return;
		}

		// Tab:
		var tab = it, tnn = itnn;
		while(tnn != "#document" && tnn != "tab" && tnn != "xul:tab") {
			tab = tab.parentNode;
			tnn = tab.nodeName.toLowerCase();
		}
		if(
			(tnn == "tab" || tnn == "xul:tab")
			&& /(^|\s+)tabbrowser-tab(\s+|$)/.test(tab.className)
			&& it.getAttribute("anonid") != "close-button"
		) {
			this.itemType = "tab";
			this.item = tab;
			return;
		}

		// Submit button:
		if(itnn == "input" && it.type == "button") {
			this.itemType = "submitButton";
			this.item = it;
			return;
		}
	},
	getFuncObj: function(sets) {
		if(!this.itemType) // see .defineItem()
			return false;
		var funcObj = sets[this.itemType];
		return funcObj && funcObj.enabled && funcObj.action
			? funcObj
			: false;
	},
	clearCMenuTimeout: function() {
		clearTimeout(this.cMenuTimeout);
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	clickHandler: function(e) {
		if(this.disabled) {
			this.skipTmpDisabled();
			return;
		}
		this.skipTmpDisabled();

		var evtStr = this.getEvtStr(e);
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		if(evtStr != this.strOnMousedown)
			this.defineItem(e, sets);

		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;

		/***
		var _this = this;
		var stopEvt = function() {
			_this.stopEvent(e);
		};
		***/

		var args = this.argsToArr(funcObj.arguments);
		args.unshift(e);
		if(funcObj.custom) { //~ todo
			// this.stopEvent(e);
			// try {
			// 	var fnc = new Function(unescape(funcObj.action));
			// 	fnc.apply(totalClicksFuncs, args); // ! totalClicksFuncs is undefined now !
			// } catch(e) { alert(e); }
		}
		else {
			var fnc = totalClicksFuncs[funcObj.action]; // ! totalClicksFuncs is undefined now !
			if(typeof fnc == "function") {
				this.stopEvent(e);
				fnc.apply(totalClicksFuncs, args);
			}
		}

		var oit = this.origItem;
		this._log(
			oit + "\n"
			+ "nodeName -> " + oit.nodeName + "\n"
			+ "itemType -> " + this.itemType
		);
	},
	argsToArr: function(argsObj) {
		argsObj = argsObj || {};
		var args = [];
		for(var p in argsObj)
			args.push(argsObj[p]);
		return args;
	},
	getXY: function(e) {
		return {
			x: this.isFx3 ? e.screenX : e.clientX,
			y: this.isFx3 ? e.screenY : e.clientY,
		};
	},
	handleEvent: function(e) {
		switch(e.type) { //~ todo: see https://bugzilla.mozilla.org/show_bug.cgi?id=174320
			case "load":        this.init(e);             break;
			case "unload":      this.destroy(e);          break;
			case "mousedown":   this.mousedownHandler(e); break;
			case "click":       this.clickHandler(e);     break;
			case "mousemove":   this.mousemoveHandler(e);
		}
	},
	observe: function(subject, topic, prefName) { // prefs observer
		if(topic != "nsPref:changed") // ???
			return;
		this.readPref(prefName.replace(/^totalclicks\./, ""));
	},
	readPref: function(prefName) { //~ warn: not use this for UTF-8!
		this["p_" + prefName] = navigator.preference("totalclicks." + prefName);
	},
	readPrefs: function(prefNameArr) {
		for(var i = 0; i < prefNameArr.length; i++)
			this.readPref(prefNameArr[i]);
	},

	consoleServ: Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService),
	_log: function(msg) {
		msg = "[Total Clicks]: " + msg + "\n";
		this.consoleServ.logStringMessage(msg);
	}
};
window.addEventListener("load", totalClicks, false);
window.addEventListener("unload", totalClicks, false);
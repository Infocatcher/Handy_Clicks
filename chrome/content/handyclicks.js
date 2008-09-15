var handyClicks = {
	ut: handyClicksUtils, // shortcut
	disabledBy: {
		mousemove: false,
		cMenu: false
	},
	event: null,
	origItem: null,
	item: null,
	itemType: undefined,
	_cMenu: null,
	cMenuTimeout: null,
	strOnMousedown: "",
	hasMousemoveHandler: false,
	prefs: Components.classes["@mozilla.org/preferences;1"]
		.createInstance(Components.interfaces.nsIPref),
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	init: function() {
		window.removeEventListener("load", this, false);
		window.addEventListener("mousedown", this, true);
		window.addEventListener("click", this, true);
		this.prefs.addObserver("extensions.handyclicks.", this, false);
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);
		window.removeEventListener("mousedown", this, true);
		window.removeEventListener("click", this, true);
		this.prefs.removeObserver("extensions.handyclicks.", this);
	},
	get fxVersion() {
		if(typeof this._fxVersion == "undefined")
			this._fxVersion = Components.classes["@mozilla.org/xre/app-info;1"]
				.getService(Components.interfaces.nsIXULAppInfo)
				.version;
		return this._fxVersion;
	},
	isFx: function(version) {
		return this.fxVersion.indexOf(version + ".") == 0;
	},
	get disabled() {
		if(!this.ut.pref("enabled"))
			return true;
		for(var p in this.disabledBy)
			if(this.disabledBy[p])
				return true;
		return false;
	},
	skipTmpDisabled: function() {
		for(var p in this.disabledBy)
			this.disabledBy[p] = false;
		if(this.hasMousemoveHandler)
			this.removeMousemoveHandler();
	},
	get cMenu() {
		var cm = null;
		switch(this.itemType) {
			case "link":
			case "img":
				cm = document.getElementById("contentAreaContextMenu");
			break;
			case "bookmark":
				cm = document.getElementById("bookmarks-context-menu") || document.getElementById("placesContext");
			break;
			case "historyItem":
				// Ex Bookmark Properties ( https://addons.mozilla.org/firefox/addon/7396 )
				if("ex2BookmarksProperties" in window)
					cm = document.getElementById("placesContext"); //~ todo: test!
			break;
			case "tab":
			case "tabbar":
				var cm = document.getAnonymousElementByAttribute(getBrowser(), "anonid", "tabContextMenu"); //~ todo: test!
			break;
			case "submitButton":
				cm = null; //~ todo: SubmitToTab for fx3 => add cm
			break;
			default: // custom types
				cm = handyClicksCustomTypes[this.itemType] && handyClicksCustomTypes[this.itemType]._contextMenu
					? handyClicksCustomTypes[this.itemType]._contextMenu()
					: this.getContextMenu();
		}
		this._cMenu = cm; // cache
		return cm;
	},
	getContextMenu: function(node) {
		node = node || this.item;
		if(!node)
			return null;
		var id = null;
		if(this.ut.isNoChromeDoc(node.ownerDocument))
			id = "contentAreaContextMenu";
		else {
			var nn = node.nodeName;
			while(nn != "#document" && !node.hasAttribute("context"))
				node = node.parentNode;
			id = node.getAttribute("context") || null;
		}
		return id ? document.getElementById(id) : null;
	},
	disallowMousemove: function(but) {
		return !this.hasMousemoveHandler
			&& this.ut.pref("disallowMousemoveForButtons").indexOf(but) > -1;
	},
	mousedownHandler: function(e) { //~ todo: test hiding of context menu in Linux
		if(!this.ut.pref("enabled"))
			return;
		var evtStr = this.getEvtStr(e);
		this.strOnMousedown = evtStr;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		this.saveEvent(e);
		this.defineItem(e, sets);
		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;

		if(this._cMenu)
			this._cMenu.hidePopup();

		var _this = this;
		var cm = this.cMenu;
		if(cm && e.button == 2) { // Show context menu after delay
			this.cMenuTimeout = setTimeout(
				function() {
					_this.disabledBy.cMenu = true;
					_this.showPopupOnItem();
				},
				this.ut.pref("showContextMenuTimeout")
			);
			cm.addEventListener(
				"popupshowing",
				function(e) {
					_this.clearCMenuTimeout();
					window.removeEventListener(e.type, arguments.callee, true);
				},
				true
			);
		}
		if(this.disallowMousemove(e.button)) {
			window.addEventListener("mousemove", this, true);
			this.hasMousemoveHandler = true;
		}
		if(this.ut.pref("forceHideContextMenu")) // for Linux
			window.addEventListener("contextmenu", this, true);
	},
	mousemoveHandler: function(e) {
		this.disabledBy.mousemove = true;
		this.clearCMenuTimeout();
		this.removeMousemoveHandler();
	},
	removeMousemoveHandler: function() {
		window.removeEventListener("mousemove", this, true);
		this.hasMousemoveHandler = false;
	},
	stopContextMenu: function(e) {
		this.stopEvent(e);
		window.removeEventListener("contextmenu", this, true);
	},
	showPopupOnItem: function(popup, node, e) {
		popup = popup || this._cMenu;
		node = node || this.origItem;
		if(!popup || !node || !node.ownerDocument.location)
			return; // e.g. rocker gesture => go back => node.ownerDocument.location == null
		e = e || this.copyOfEvent;

		if(this.itemType == "tab") {
			// Tab Scope ( https://addons.mozilla.org/firefox/addon/4882 )
			var tabscope = document.getElementById("tabscopePopup");
			if(tabscope) // mousedown -> ...delay... -> this popup -> Tab Scope popup hide this popup
				tabscope.hidePopup(); // only for tabs?
		}

		if((this.isFx(2) && popup.id == "contentAreaContextMenu")) { // workaround for spellchecker bug
			if(this.ut.pref("forceHideContextMenu"))
				window.removeEventListener("contextmenu", this, true);

			var evt = document.createEvent("MouseEvents"); // thanks to Tab Scope!
			evt.initMouseEvent(
				"click", true, false, node.ownerDocument.defaultView, 1,
				e.screenX, e.screenY, e.clientX, e.clientY,
				false, false, false, false,
				2, null
			);
			node.dispatchEvent(evt);

			this.disabledBy.cMenu = true;
			this.blinkNode();
			return;
		}
		document.popupNode = this.itemType == "tab" ? this.item : node;
		var xy = this.getXY(e);
		popup.showPopup(this.isFx(3) ? node : e.target, xy.x, xy.y, "popup", null, null);

		var _this = this;
		window.addEventListener( // No click event after some showPopup() //~ todo: test
			"mouseup", function(e) {
				setTimeout(function() { _this.skipTmpDisabled(); }, 0);
				window.removeEventListener("mouseup", arguments.callee, true);
			},
			true
		);
	},
	blinkNode: function(time, node) {
		node = node || this.origItem;
		if(!node)
			return;
		var hasStl = node.hasAttribute("style");
		var origVis = node.style.visibility;
		node.style.visibility = "hidden";
		setTimeout(
			function() {
				node.style.visibility = origVis;
				if(!hasStl)
					node.removeAttribute("style");
			},
			time || 170
		);
	},
	getEvtStr: function(e) {
		return "button=" + e.button
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey;
	},
	getSettings: function(str) {
		return (handyClicksPrefs || {})[str];
	},
	isOkFuncObj: function(fObj) { // funcObj && funcObj.enabled && funcObj.action
		return typeof fObj == "object"
			&& fObj.enabled
			&& typeof fObj.action != "undefined";
	},
	getFuncObj: function(sets) {
		if(!this.itemType) // see .defineItem()
			return false;
		var funcObj = sets.$all || sets[this.itemType];
		return this.isOkFuncObj(funcObj) ? funcObj : false;
	},
	cloneObj: function(obj) {
		obj = obj || {};
		var clone = {};
		for(var p in obj)
			clone[p] = obj[p];
		return clone;
	},
	saveEvent: function(e) {
		this.event = e;

		/* fx < 3.0:
		 * Works:
		 *   alert(uneval(this.getXY(this.event)));
		 * Always return "({x:0, y:0})":
		 *   var _this = this;
		 *   setTimeout(function() { alert(uneval(_this.getXY(_this.event))); }, 10);
		 */
		this.copyOfEvent = this.cloneObj(e);
	},
	defineItem: function(e, sets) {
		var all = this.isOkFuncObj(sets.$all);
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		this.origItem = it;
		var itnn = it.nodeName.toLowerCase();

		// Custom:
		if(handyClicksCustomTypes) {
			var customItem;
			for(var type in handyClicksCustomTypes) {
				if(all || this.isOkFuncObj(sets[type])) {
					customItem = handyClicksCustomTypes[type]._define.call(this, e, it);
					if(!customItem)
						continue;
					this.itemType = type;
					this.item = customItem;
					return;
				}
			}
		}

		// img:
		if(
			(all || this.isOkFuncObj(sets.img))
			&& (itnn == "img" || itnn == "image") && (it.src || it.hasAttribute("src"))
			&& this.ut.isNoChromeDoc(it.ownerDocument) // not for interface...
		) {
			this.itemType = "img";
			this.item = it;
			if(sets["img"].ignoreLinks)
				return;
		}

		// Link:
		if(all || this.isOkFuncObj(sets.link)) {
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
		}

		// History item:
		if(
			(all || this.isOkFuncObj(sets.historyItem))
			&& it.namespaceURI == this.XULNS
			&& handyClicksFuncs.getBookmarkUri(it)
			&& it.parentNode.id == "goPopup"
		) {
			this.itemType = "historyItem";
			this.item = it;
			return;
		}

		// Bookmark:
		if(
			(all || this.isOkFuncObj(sets.bookmark))
			&& it.namespaceURI == this.XULNS
			&& it.type != "menu"
			&& (
				(
					/(^|\s+)bookmark-item(\s+|$)/.test(it.className)
					&& (itnn == "toolbarbutton" || itnn == "menuitem")
				)
				|| (itnn == "menuitem" && (it.hasAttribute("siteURI")))
			)
			// && it.parentNode.id != "historyUndoPopup"
			&& handyClicksFuncs.getBookmarkUri(it)
		) {
			this.itemType = "bookmark";
			this.item = it;
			return;
		}

		// Tab:
		if(
			(all || this.isOkFuncObj(sets.tab))
			&& it.namespaceURI == this.XULNS
			&& it.getAttribute("anonid") != "close-button"
		) {
			var tab = it, tnn = itnn;
			while(tnn != "#document" && tnn != "tab" && tnn != "xul:tab") {
				tab = tab.parentNode;
				tnn = tab.nodeName.toLowerCase();
			}
			if(
				(tnn == "tab" || tnn == "xul:tab")
				&& (
					/(^|\s+)tabbrowser-tab(\s+|$)/.test(tab.className)
					|| /(^|\s+)tabbrowser-tabs(\s+|$)/.test(tab.parentNode.className) // >1 tabs in Firefox 1.5
				)
			) {
				this.itemType = "tab";
				this.item = tab;
				return;
			}
		}

		// Tab bar:
		if(
			// (all || this.isOkFuncObj(sets.tabbar))
			it.namespaceURI == this.XULNS
			&& it.className != "tabs-alltabs-button"
			&& it.getAttribute("anonid") != "close-button"
		) {
			var tb = it, tbnn = itnn, tbc = tb.className;
			var tbre = /(^|\s+)tabbrowser-tabs(\s+|$)/;
			while(tbnn != "#document" && !tbre.test(tbc) && tbnn != "tab" && tbnn != "xul:tab") {
				tb = tb.parentNode;
				tbnn = tb.nodeName.toLowerCase();
				tbc = tb.className;
			}
			if(tbre.test(tbc)) {
				this.itemType = "tabbar";
				this.item = tb;
				return;
			}
		}

		// Submit button:
		if(all || this.isOkFuncObj(sets.submitButton)) {
			if(itnn == "input" && it.type == "submit") {
				this.itemType = "submitButton";
				this.item = it;
				return;
			}
			var but = it, bnn = itnn;
			while(bnn != "#document" && bnn != "button") {
				but = but.parentNode;
				bnn = but.nodeName.toLowerCase();
			}
			if(bnn == "button") {
				this.itemType = "submitButton";
				this.item = it;
				return;
			}
		}
	},
	clearCMenuTimeout: function() {
		clearTimeout(this.cMenuTimeout);
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	clickHandler: function(e) {
		var dis = this.disabled;
		this.skipTmpDisabled();
		if(dis)
			return;

		var evtStr = this.getEvtStr(e);
		var sets = this.getSettings(evtStr);
		if(!sets)
			return;
		this.saveEvent(e);
		if(evtStr != this.strOnMousedown)
			this.defineItem(e, sets);

		var funcObj = this.getFuncObj(sets);
		if(!funcObj)
			return;

		this.stopEvent(e); // this stop "contextmenu" event in Windows
		if(this.ut.pref("forceHideContextMenu"))
			window.removeEventListener("contextmenu", this, true); // and listener is not needed
		this.clearCMenuTimeout();

		var args = this.argsToArr(funcObj.arguments);
		args.unshift(e);
		if(funcObj.custom) {
			try {
				var fnc = new Function(decodeURIComponent(funcObj.action));
				fnc.apply(handyClicksFuncs, args);
			}
			catch(e) {
				this.ut._error("[Handy Clicks]: custom action error:\n" + e);
				this.notify(
					this.ut.getLocalised("errorTitle"),
					this.ut.getLocalised("customFunctionError").replace("%func%", decodeURIComponent(funcObj.title)),
					toErrorConsole
				);
			}
		}
		else {
			var fnc = handyClicksFuncs[funcObj.action];
			if(typeof fnc == "function")
				fnc.apply(handyClicksFuncs, args);
			else {
				this.ut._error("[Handy Clicks]: " + funcObj.action + " not found (" + typeof fnc + ")");
				this.notify(
					this.ut.getLocalised("errorTitle"),
					this.ut.getLocalised("functionNotFound").replace("%func%", funcObj.action),
					toErrorConsole
				);
			}
		}

		var oit = this.origItem;
		this.ut._log(
			"clickHandler -> " + oit + "\n"
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
		e = e || this.copyOfEvent;
		var isFx3 = this.isFx(3);
		return {
			x: isFx3 ? e.screenX : e.clientX,
			y: isFx3 ? e.screenY : e.clientY
		};
	},
	handleEvent: function(e) {
		switch(e.type) { //~ todo: see https://bugzilla.mozilla.org/show_bug.cgi?id=174320
			case "load":        this.init(e);             break;
			case "unload":      this.destroy(e);          break;
			case "mousedown":   this.mousedownHandler(e); break;
			case "click":       this.clickHandler(e);     break;
			case "mousemove":   this.mousemoveHandler(e); break;
			case "contextmenu": this.stopContextMenu(e);
		}
	},
	observe: function(subject, topic, prefName) { // prefs observer
		if(topic != "nsPref:changed")
			return;
		this.ut.readPref(prefName.replace(/^extensions\.handyclicks\./, ""));
	},
	notify: function(ttl, txt, fnc) {
		var dur = this.ut.pref("notifyOpenTime");
		if(dur < 0)
			 return;
		window.openDialog(
			 "chrome://handyclicks/content/notify.xul",
			 "",
			 "chrome,dialog=1,titlebar=0,popup=1",
			 dur, ttl, txt, fnc, this.ut.pref("notifyInWindowCorner")
		);
	}
};
window.addEventListener("load", handyClicks, false);
window.addEventListener("unload", handyClicks, false);
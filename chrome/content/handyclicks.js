var handyClicks = {
	// Shortcuts:
	ut: handyClicksUtils,
	pu: handyClicksPrefUtils,
	get fn() { return handyClicksFuncs; },

	flags: {
		stopClick: false,
		runned: false,
		stopContextMenu: false
	},
	isRunOnMousedown: false,
	event: null,
	origItem: null,
	item: null,
	itemType: undefined,
	_cMenu: null,
	cMenuTimeout: null,
	evtStrOnMousedown: "",
	hasMousemoveHandler: false,
	mousemoveParams: { dist: 0 },
	_tabOnMousedown: null,
	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	init: function() {
		window.removeEventListener("load", this, false);
		window.addEventListener("mousedown", this, true);
		window.addEventListener("click", this, true);
		window.addEventListener("mouseup", this, true);
		window.addEventListener("contextmenu", this, true);
		window.addEventListener("dblclick", this, true);

		this.setStatus();
		this.pu.addPrefsObserver(this.updUI, this);
	},
	destroy: function() {
		window.removeEventListener("unload", this, false);
		window.removeEventListener("mousedown", this, true);
		window.removeEventListener("click", this, true);
		window.removeEventListener("mouseup", this, true);
		window.removeEventListener("contextmenu", this, true);
		window.removeEventListener("dblclick", this, true);
		this.clearCMenuTimeout();
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
		return !this.pu.pref("enabled");
	},
	getItemContext: function(e) {
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
				if(!this.isOkCustomType(this.itemType))
					break;
				var ct = handyClicksCustomTypes[this.itemType];
				var _cm = ct._contextMenu;
				if(_cm) {
					try { cm = _cm.call(this.fn, e); }
					catch(e) {
						this.ut.notify(
							this.ut.getLocalised("errorTitle"),
							this.ut.getLocalised("customTypeContextMenuError")
								.replace("%l", decodeURIComponent(ct.label || ""))
								.replace("%id", this.itemType)
								.replace("%e", e)
							+ this.ut.getLocalised("openConsole"),
							toErrorConsole
						);
						this.ut._err(
							"[Handy Clicks]: Error in custom function for context menu detection."
							+ "\nid: " + this.itemType
							+ "\nLabel: " + decodeURIComponent(ct.label || "")
							+ "\nCode:\n" + decodeURIComponent(ct.contextMenu || "")
						);
						throw e;
					}
				}
				else
					cm = this.getContextMenu();
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
			&& this.pu.pref("disallowMousemoveForButtons").indexOf(but) > -1;
	},
	skipFlags: function() {
		var fls = this.flags;
		for(var p in fls)
			if(fls.hasOwnProperty(p))
				fls[p] = false;
	},
	mousedownHandler: function(e) { //~ todo: test hiding of context menu in Linux
		if(this.disabled)
			return;

		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;

		if(this._cMenu)
			this._cMenu.hidePopup();

		// Experimental:
		var runOnMousedown = funcObj.eventType == "mousedown";
		if(runOnMousedown) {
			this.flags.stopClick = true;
			this.runFunc(e, funcObj);
		}
		if(
			this.pu.pref("forceHideContextMenu") // for clicks on Linux
			&& funcObj.action != "showContextMenu"
		)
			this.flags.stopContextMenu = true;
		if(runOnMousedown)
			return;

		var _this = this;
		var cm = this.getItemContext(e);

		// Fix for switching tabs by Mouse Gestures
		this._tabOnMousedown = cm && cm.id == "contentAreaContextMenu"
			? this.fn.getTabBrowser(true).mCurrentTab
			: null;

		var cMenuDelay = this.pu.pref("showContextMenuTimeout");
		if(cMenuDelay > 0 && cm && e.button == 2) { // Show context menu after delay
			this.clearCMenuTimeout(); // only one timeout... (for dblclick event)
			this.cMenuTimeout = setTimeout(
				function(_this) {
					if(_this.tabNotChanged)
						_this.showPopupOnItem();
				},
				cMenuDelay,
				this
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
			this.hasMousemoveHandler = true;
			window.addEventListener("mousemove", this, true);
		}
	},
	get tabNotChanged() {
		var tab = this._tabOnMousedown;
		return !tab || tab == this.fn.getTabBrowser(true).mCurrentTab;
	},
	mousemoveHandler: function(e) {
		if(this.mousemoveParams.screenX) {
			this.mousemoveParams.dist +=
				Math.sqrt(
					Math.pow(this.mousemoveParams.screenX - e.screenX, 2) +
					Math.pow(this.mousemoveParams.screenY - e.screenY, 2)
				);
			this.mousemoveParams.event = this.cloneObj(e);
		}
		this.mousemoveParams.screenX = e.screenX;
		this.mousemoveParams.screenY = e.screenY;

		if(this.mousemoveParams.dist < this.pu.pref("disallowMousemoveDist"))
			return;

		this.flags.runned = true;
		this.flags.stopContextMenu = false; //~ ?
		this.flags.stopClick = false; //~ ?

		this.clearCMenuTimeout();
		this.removeMousemoveHandler();
	},
	removeMousemoveHandler: function() {
		if(!this.hasMousemoveHandler)
			return;
		window.removeEventListener("mousemove", this, true);
		this.hasMousemoveHandler = false;
		this.mousemoveParams = { dist: 0 };
	},
	stopContextMenu: function(e) {
		if(this.flags.stopContextMenu)
			this.stopEvent(e);
	},
	showPopupOnItem: function(popup, node, e) {
		this.flags.runned = true;

		popup = popup || this._cMenu;
		node = node || this.origItem;
		if(!popup || !node || !node.ownerDocument.location)
			return; // e.g. rocker gesture => go back => node.ownerDocument.location == null
		e = e || this.copyOfEvent;

		if(this.itemType == "tab") {
			// Tab Scope ( https://addons.mozilla.org/firefox/addon/4882 )
			var tabscope = document.getElementById("tabscopePopup");
			if(tabscope) // mousedown -> ...delay... -> this popup -> Tab Scope popup hide this popup
				tabscope.hidePopup();
		}

		if(this.isFx(2) && popup.id == "contentAreaContextMenu") { // workaround for spellchecker bug
			this.flags.stopContextMenu = false;
			this.flags.stopClick = true;

			var evt = document.createEvent("MouseEvents");
			evt.initMouseEvent(
				"click", true, false, node.ownerDocument.defaultView, 1,
				e.screenX, e.screenY, e.clientX, e.clientY,
				false, false, false, false,
				2, null
			);
			node.dispatchEvent(evt);
			this.blinkNode();

			// this.flags.stopContextMenu = true; // ?
			return;
		}
		document.popupNode = this.itemType == "tab" ? this.item : node;
		var xy = this.getXY();
		popup.showPopup(this.isFx(3) ? node : e.target, xy.x, xy.y, "popup", null, null);
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
		return handyClicksPrefs.hasOwnProperty(str) ? handyClicksPrefs[str] : null;
	},
	isOkFuncObj: function(fObj) { // funcObj && funcObj.enabled && funcObj.action
		return handyClicksPrefSvc.isOkFuncObj(fObj) && fObj.enabled;
	},
	itemTypeInSets: function(sets, iType) {
		return sets.hasOwnProperty(iType) && this.isOkFuncObj(sets[iType]);
	},
	isOkCustomType: function(cType) {
		var cts = handyClicksCustomTypes;
		if(!cts.hasOwnProperty(cType))
			return false;
		var ct = cts[cType];
		return typeof ct == "object"
			&& ct.hasOwnProperty("enabled")
			&& ct.enabled
			&& ct.hasOwnProperty("_define")
			&& ct.hasOwnProperty("_contextMenu");
	},
	defineItem: function(e, sets) {
		var all = this.itemTypeInSets(sets, "$all");
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		this.origItem = it;
		var itnn = it.nodeName.toLowerCase();

		// Custom:
		var cItem;
		var cts = handyClicksCustomTypes, ct;
		var errors = [];
		for(var type in cts) {
			if(!cts.hasOwnProperty(type))
				continue;
			ct = cts[type];
			if(
				(all || this.itemTypeInSets(sets, type))
				&& this.isOkCustomType(type)
			) {
				try { cItem = ct._define.call(this, e, it); }
				catch(e) {
					var eId = this.ut.getLocalised("id") + " " + type
						+ "\n" + this.ut.getLocalised("label") + " " + decodeURIComponent(ct.label || "");
					errors.push(eId + "\n" + this.ut.getLocalised("details") + "\n" + e);
					var _err = this.ut._err;
					var _msg = "[Handy Clicks]: "
						+ this.ut.getLocalised("customTypeDefineError").replace("%e", eId);
					setTimeout(function() { _err(_msg); throw e; }, 0);
				}
				if(!cItem)
					continue;
				this.itemType = type;
				this.item = cItem;
				return;
			}
		}
		if(errors.length) {
			this.ut.notify(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("customTypeDefineError" + (errors.length == 1 ? "" : "s"))
					.replace("%e", errors.join("\n\n"))
				+ this.ut.getLocalised("openConsole"),
				toErrorConsole
			);
		}

		// img:
		if(
			(all || this.itemTypeInSets(sets, "img"))
			&& (itnn == "img" || itnn == "image") && (it.src || it.hasAttribute("src"))
			&& this.ut.isNoChromeDoc(it.ownerDocument) // not for interface...
		) {
			this.itemType = "img";
			this.item = it;
			if(sets.img.ignoreLinks)
				return;
		}

		// Link:
		if(all || this.itemTypeInSets(sets, "link")) {
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
			(all || this.itemTypeInSets(sets, "historyItem"))
			&& it.namespaceURI == this.XULNS
			&& this.fn.getBookmarkUri(it)
			&& it.parentNode.id == "goPopup"
		) {
			this.itemType = "historyItem";
			this.item = it;
			return;
		}

		// Bookmark:
		if(
			(all || this.itemTypeInSets(sets, "bookmark"))
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
			&& it.parentNode.id != "goPopup"
			&& this.fn.getBookmarkUri(it)
		) {
			this.itemType = "bookmark";
			this.item = it;
			return;
		}

		// Tab:
		if(
			(all || this.itemTypeInSets(sets, "tab"))
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
			(all || this.itemTypeInSets(sets, "tabbar"))
			&& it.namespaceURI == this.XULNS
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
		if(all || this.itemTypeInSets(sets, "submitButton")) {
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
	getFuncObj: function(sets) {
		if(!this.itemType) // see .defineItem()
			return false;
		var funcObj = sets.$all || sets[this.itemType];
		return this.isOkFuncObj(funcObj) ? funcObj : false;
	},
	getFuncObjByEvt: function(e) {
		var evtStr = this.getEvtStr(e);
		var isMousedown = e.type == "mousedown";
		if(isMousedown)
			this.evtStrOnMousedown = evtStr;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return null;
		if(
			isMousedown
			|| evtStr != this.evtStrOnMousedown
			|| e.originalTarget != this.origItem
		)
			this.defineItem(e, sets);
		this.saveEvent(e);
		return this.getFuncObj(sets);
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

		// fx < 3.0:
		// Works:
		//   alert(uneval(this.getXY(this.event)));
		//
		// Always return "({x:0, y:0})":
		//   var _this = this;
		//   setTimeout(function() { alert(uneval(_this.getXY(_this.event))); }, 10);
		this.copyOfEvent = this.cloneObj(e);
	},
	clearCMenuTimeout: function() {
		clearTimeout(this.cMenuTimeout);
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},
	clickHandler: function(e) {
		if(this.disabled)
			return;

		if(this.flags.stopClick)
			this.stopEvent(e); // Stop "contextmenu" event in Windows

		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;
		this.runFunc(e, funcObj);
	},
	mouseupHandler: function(e) {
		if(this.disabled)
			return;
		setTimeout(function(_this) { _this.skipFlags(); }, 0, this);
	},
	dblclickHandler: function(e) {
		if(this.disabled)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;
		this.runFunc(e, funcObj);
	},
	runFunc: function(e, funcObj) {
		if(this.flags.runned || e.type != funcObj.eventType)
			return;
		if(!this.tabNotChanged)
			return;
		this.flags.runned = true;
		this.flags.stopContextMenu = true;

		this.stopEvent(e); // this stop "contextmenu" event in Windows
		this.clearCMenuTimeout();
		this.removeMousemoveHandler();

		var args = this.argsToArr(funcObj.arguments);
		args.unshift(e);
		if(funcObj.custom) {
			var action = decodeURIComponent(funcObj.action);
			var label = '"' + decodeURIComponent(funcObj.label) + '"';
			try {
				new Function(action).apply(this.fn, args);
			}
			catch(e) {
				this.ut.notify(
					this.ut.getLocalised("errorTitle"),
					this.ut.getLocalised("customFunctionError")
						.replace("%f", label)
						.replace("%e", e)
					+ this.ut.getLocalised("openConsole"),
					toErrorConsole
				);
				this.ut._err("[Handy Clicks]: Error in custom function " + label + ":\n" + action);
				throw e;
			}
		}
		else {
			var fnc = this.fn[funcObj.action];
			if(typeof fnc == "function")
				fnc.apply(this.fn, args);
			else {
				this.ut.notify(
					this.ut.getLocalised("errorTitle"),
					this.ut.getLocalised("functionNotFound").replace("%f", funcObj.action),
					toErrorConsole
				);
				this.ut._err("[Handy Clicks]: " + funcObj.action + " not found (" + typeof fnc + ")");
			}
		}

		this.ut._log(
			e.type + " => runFunc -> " + this.origItem + "\n"
			+ "nodeName -> " + this.origItem.nodeName + "\n"
			+ "itemType -> " + this.itemType + "\n"
			+ "=> " + (funcObj.custom ? action : funcObj.action)
		);
	},
	argsToArr: function(argsObj) {
		argsObj = argsObj || {};
		var args = [];
		for(var p in argsObj)
			if(argsObj.hasOwnProperty(p))
				args.push(argsObj[p]);
		return args;
	},
	getXY: function(e) {
		e = e || this.mousemoveParams.event || this.copyOfEvent;
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
			case "contextmenu": this.stopContextMenu(e);  break;
			case "mouseup":     this.mouseupHandler(e);   break;
			case "dblclick":    this.dblclickHandler(e);
		}
	},
	observe: function(subject, topic, prefName) { // prefs observer
		if(topic != "nsPref:changed")
			return;
		this.pu.readPref(prefName.replace(/^extensions\.handyclicks\./, ""));
	},

	// GUI:
	toggleStatus: function() {
		this.pu.pref("enabled", !this.pu.pref("enabled"));
	},
	doSettings: function(e) {
		switch(e.button) {
			case 0:
				this.toggleStatus();
			break;
			case 1:
			case 2:
				handyClicksWinUtils.openWindowByType(
					"chrome://handyclicks/content/sets.xul",
					"handyclicks:settings",
					"chrome,titlebar,toolbar,centerscreen,resizable,dialog=0"
				);
		}
	},
	updUI: function(pName) {
		if(pName == "enabled")
			this.setStatus();
	},
	setStatus: function() {
		var sbi = document.getElementById("handyClicks-toggleStatus-sBarIcon");
		var enabled = this.pu.pref("enabled");
		sbi.setAttribute("hc_enabled", enabled);
		sbi.tooltipText = this.ut.getLocalised(enabled ? "enabled" : "disabled");
	}
};
window.addEventListener("load", handyClicks, false);
window.addEventListener("unload", handyClicks, false);
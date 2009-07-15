var handyClicks = {
	// Shortcuts:
	ut: handyClicksUtils,
	wu: handyClicksWinUtils,
	pu: handyClicksPrefUtils,
	ps: handyClicksPrefSvc,
	get fn() { return handyClicksFuncs; },

	flags: {
		stopClick: false,
		runned: false,
		stopContextMenu: false
	},
	editMode: false,
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
					try {
						cm = _cm.call(this.fn, e, this.item, this.origItem);
					}
					catch(e) {
						this.ut.notify(
							this.ut.getLocalised("errorTitle"),
							this.ut.getLocalised("customTypeContextMenuError")
								.replace("%l", this.ps.dec(ct.label))
								.replace("%id", this.itemType)
								.replace("%e", e)
							+ this.ut.getLocalised("openConsole"),
							toErrorConsole
						);
						this.ut._err(
							this.ut.errPrefix + "Error in custom function for context menu detection."
							+ "\nid: " + this.itemType
							+ "\nLabel: " + this.ps.dec(ct.label)
							+ "\nCode:\n" + this.ps.dec(ct.contextMenu)
						);
						this.ut._err(e);
					}
				}
				else
					cm = this.getContextMenu();
		}
		if(cm && typeof cm.hidePopup != "function") {
			// Try open XUL document with custom context in tab...
			this.ut._err(this.ut.errPrefix + "Strange error: context menu has no hidePopup method\n" + cm.id);
			cm = null;
		}
		this._cMenu = cm; // cache
		return cm;
	},
	getContextMenu: function(node) {
		node = node || this.item;
		if(!node)
			return null;
		var id = null;
		var doc = document;
		var isNoChrome = this.ut.isNoChromeDoc(node.ownerDocument);
		if(!isNoChrome || node.namespaceURI == this.XULNS) {
			var docNode = Node.DOCUMENT_NODE; // 9
			while(node && node.nodeType != docNode) {
				if(node.hasAttribute("context")) {
					id = node.getAttribute("context");
					doc = node.ownerDocument;
					break;
				}
				node = node.parentNode;
			}
		}
		if(!id) {
			//id = "contentAreaContextMenu";
			var brObj = this.getBrowserForNode(node);
			if(brObj) {
				id = this.getContextOfNode(brObj.browser);
				doc = brObj.document;
			}
		}

		this.ut._log("getContextMenu -> " + id + " -> " + (doc && id && doc.getElementById(id)));
		return id ? doc.getElementById(id) : null;
	},
	getBrowserForNode: function(node) {
		return this.getBrowserForWindow(node.ownerDocument.defaultView.top); // Frames!
	},
	getBrowserForWindow: function(targetWin, doc) {
		doc = doc || document;
		var br;
		["tabbrowser", "browser", "iframe"].some(
			function(tag) {
				var browsers = doc.getElementsByTagNameNS(this.XULNS, tag);
				var win, brObj;
				for(var i = 0, len = browsers.length; i < len; i++) {
					win = browsers[i].contentWindow;
					if(win == targetWin) {
						br = browsers[i];
						break;
					}
					if(!this.ut.isNoChromeWin(win)) {
						brObj = this.getBrowserForWindow(targetWin, win.document);
						if(brObj) {
							br = brObj.browser
							break;
						}
					}
				}
				return br;
			},
			this
		);
		return br
			? { browser: br, document: doc }
			: null;
	},
	getContextOfNode: function(node) {
		return node.getAttribute("contentcontextmenu")
			|| node.getAttribute("contextmenu")
			|| node.getAttribute("context");
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

		if(this._cMenu && typeof this._cMenu.hidePopup == "function")
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
		/*** todo:
		var delayedAction = funcObj.hasOwnProperty("delayedAction") ? funcObj.delayedAction : null;
		if(cMenuDelay > 0 && (delayedAction || (cm && e.button == 2)))
		***/
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

		if(this.ut.fxVersion == 2 && popup.id == "contentAreaContextMenu") { // workaround for spellchecker bug
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
		popup.showPopup(this.ut.fxVersion >= 3 ? node : e.target, xy.x, xy.y, "popup", null, null);
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
		return handyClicksPrefs.hasOwnProperty(str)
			? handyClicksPrefs[str]
			: this.editMode
				? {}
				: null;
	},
	isOkFuncObj: function(fObj) { // funcObj && funcObj.enabled && funcObj.action
		return this.ps.isOkFuncObj(fObj) && fObj.enabled;
	},
	isOkCustomType: function(cType) {
		var cts = handyClicksCustomTypes;
		if(!cts.hasOwnProperty(cType))
			return false;
		var ct = cts[cType];
		return typeof ct == "object" && ct.hasOwnProperty("_initialized");
	},
	itemTypeInSets: function(sets, iType) {
		return sets.hasOwnProperty(iType) && this.isOkFuncObj(sets[iType]);
	},
	defineItem: function(e, sets) {
		var all = this.editMode || this.itemTypeInSets(sets, "$all");
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		this.origItem = it;
		var itln = it.localName.toLowerCase();
		var _it;

		// Custom:
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
				try {
					_it = ct._define.call(this, e, it);
				}
				catch(e) {
					var eId = this.ut.getLocalised("id") + " " + type
						+ "\n" + this.ut.getLocalised("label") + " " + this.ps.dec(ct.label);
					errors.push(eId + "\n" + this.ut.getLocalised("details") + "\n" + e);
					this.ut._err(this.ut.errPrefix + this.ut.getLocalised("customTypeDefineError").replace("%e", eId));
					this.ut._err(e);
				}
				if(!_it)
					continue;
				this.itemType = type;
				this.item = _it;
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

		var docNode = Node.DOCUMENT_NODE; // 9

		// img:
		if(
			(all || this.itemTypeInSets(sets, "img"))
			&& (itln == "img" || itln == "image") && (it.src || it.hasAttribute("src"))
			&& this.ut.isNoChromeDoc(it.ownerDocument) // Not for interface...
		) {
			this.itemType = "img";
			this.item = it;
			if(sets.img.ignoreLinks)
				return;
		}

		// Link:
		if(all || this.itemTypeInSets(sets, "link")) {
			_it = it;
			while(_it && _it.nodeType != docNode) {
				if(
					(_it.localName.toLowerCase() == "a" && _it.href)
					|| (
						_it.nodeType == Node.ELEMENT_NODE
						&& _it.hasAttributeNS("http://www.w3.org/1999/xlink", "href")
					)
				) {
					this.itemType = "link";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}

		// History item:
		if(
			(all || this.itemTypeInSets(sets, "historyItem"))
			&& it.namespaceURI == this.XULNS
			&& this.fn.getBookmarkUri(it)
			// && it.parentNode.id == "goPopup"
			&& this.hasParent(it, "goPopup")
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
					/(?:^|\s)bookmark-item(?:\s|$)/.test(it.className)
					&& (itln == "toolbarbutton" || itln == "menuitem")
				)
				|| (itln == "menuitem" && (it.hasAttribute("siteURI")))
			)
			// && it.parentNode.id != "historyUndoPopup"
			// && it.parentNode.id != "goPopup"
			&& !this.hasParent(it, "goPopup")
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
			_it = it;
			while(_it && _it.nodeType != docNode) {
				if(
					_it.localName.toLowerCase() == "tab"
					&& (
						/(?:^|\s)tabbrowser-tab(?:\s|$)/.test(_it.className)
						|| /(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(_it.parentNode.className) // >1 tabs in Firefox 1.5
					)
				) {
					this.itemType = "tab";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}

		// Tab bar:
		if(
			(all || this.itemTypeInSets(sets, "tabbar"))
			&& it.namespaceURI == this.XULNS
			&& it.className != "tabs-alltabs-button"
			&& it.getAttribute("anonid") != "close-button"
		) {
			_it = it;
			while(_it && _it.nodeType != docNode && _it.localName.toLowerCase() != "tab") {
				if(
					/(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(_it.className)
				) {
					this.itemType = "tabbar";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}

		// Submit button:
		if(all || this.itemTypeInSets(sets, "submitButton")) {
			if(itln == "input" && it.type == "submit") {
				this.itemType = "submitButton";
				this.item = it;
				return;
			}
			_it = it;
			while(_it && _it.nodeType != docNode) {
				if(_it.localName.toLowerCase() == "button") {
					this.itemType = "submitButton";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}
	},
	hasParent: function(it, id) {
		it = it.parentNode;
		while(it) {
			if(it.id == id)
				return true;
			it = it.parentNode;
		}
		return false;
	},
	getFuncObj: function(sets) {
		return this.itemType // see .defineItem()
			&& (
				(this.itemTypeInSets(sets, "$all") && sets.$all)
				|| (this.itemTypeInSets(sets, this.itemType) && sets[this.itemType])
			);
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
		return this.getFuncObj(sets) || (this.editMode ? {} : null);
	},
	cloneObj: function(obj) {
		obj = obj || {};
		var clone = {};
		for(var p in obj) // Important: this is not real recursive copying of properties!
			clone[p] = obj[p];
		return clone;
	},
	saveEvent: function(e) {
		this.event = e;
		// fx < 3.0:
		// Following works:
		//   alert(uneval(this.getXY(this.event)));
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
		if(
			this.flags.runned
			|| (!this.editMode && e.type != funcObj.eventType)
			//|| !this.itemType
			|| !this.tabNotChanged
		) {
			this.editMode = false;
			return;
		}

		this.flags.runned = true;
		this.flags.stopContextMenu = true;

		this.stopEvent(e); // this stop "contextmenu" event in Windows
		this.clearCMenuTimeout();
		this.removeMousemoveHandler();

		if(this.editMode) {
			this.openEditor(e);
			this.editMode = false;
			return;
		}

		var args = this.argsToArr(funcObj.arguments);
		args.unshift(e);
		if(funcObj.custom) {
			args.unshift(this.item, this.origItem);
			var action = this.ps.dec(funcObj.action);
			var label = '"' + this.ps.dec(funcObj.label) + '"';
			try {
				new Function("event,item,origItem", action).apply(this.fn, args);
			}
			catch(e) {
				var eMsg = this.ut.getLocalised("customFunctionError")
					.replace("%f", label)
					.replace("%e", e);
				this.ut.notify(
					this.ut.getLocalised("errorTitle"),
					eMsg + this.ut.getLocalised("openConsole"),
					toErrorConsole
				);
				this.ut._err(this.ut.errPrefix + eMsg);
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
				this.ut._err(this.ut.errPrefix + funcObj.action + " not found (" + typeof fnc + ")");
			}
		}

		this.ut._log(
			e.type + " => runFunc -> " + this.origItem
			+ "\nlocalName -> " + this.origItem.localName
			+ ", itemType -> " + this.itemType
			+ ", button -> " + e.button
			+ "\n=> " + (funcObj.custom ? (this.ps.dec(funcObj.label) || action) : funcObj.action)
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
		return this.ut.fxVersion >= 3
			? { x: e.screenX, y: e.screenY }
			: { x: e.clientX, y: e.clientY };
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

	// GUI:
	toggleStatus: function() {
		this.pu.pref("enabled", !this.pu.pref("enabled"));
	},
	doSettings: function(e) {
		switch(e.button) {
			case 0: this.toggleStatus(); break;
			case 1: this.openSettings();
		}
	},
	openSettings: function() {
		this.wu.openWindowByType(
			window,
			"chrome://handyclicks/content/sets.xul",
			"handyclicks:settings",
			"chrome,titlebar,toolbar,centerscreen,resizable,dialog=0"
		);
	},
	editModeOn: function() {
		setTimeout(function(_this) { _this.editMode = true; }, 10, this);
	},
	openEditor: function(e) {
		e = e || this.copyOfEvent;
		this.fn.hideItemPopup();
		this.wu.openEditor("shortcut", this.getEvtStr(e), this.itemType);
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
		document.getElementById("handyClicks-clickEdit").setAttribute("disabled", !enabled);
	}
};
window.addEventListener("load", handyClicks, false);
window.addEventListener("unload", handyClicks, false);
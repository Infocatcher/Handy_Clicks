var handyClicks = {
	_editMode: false,
	get editMode() {
		return this._editMode;
	},
	set editMode(val) {
		this._editMode = val;
		this.setEditModeStatus(val);
	},

	copyOfEvent: null,
	origItem: null,
	item: null,
	itemType: undefined,
	flags: {
		runned: false, // => stop click events
		stopContextMenu: false, // => stop "contextmenu" event (in Linux: mousedown -> contextmenu -> ... delay ... -> click)
		allowEvents: false // => allow all events while (flags.runned == false)
	},

	_cMenu: null,
	daTimeout: null, // Delayed Action Timeout
	evtStrOnMousedown: "",
	hasMousemoveHandler: false,
	mousemoveParams: null,
	_tabOnMousedown: null,

	XULNS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	ignoreAction: "$ignore",

	// Initialization:
	init: function() {
		this.ps.loadSettings();
		this.setListeners(["mousedown", "click", "command", "mouseup", "contextmenu", "dblclick"], true);
		this.pu.addPrefsObserver(this.updUI, this);
		this.setStatus();
		this.registerHotkeys();
	},
	destroy: function() {
		this.setListeners(["mousedown", "click", "command", "mouseup", "contextmenu", "dblclick"], false);
		this.cancelDelayedAction();
	},
	setListeners: function(evtTypes, addFlag) {
		var act = addFlag ? "addEventListener" : "removeEventListener";
		evtTypes.forEach(
			function(evtType) { window[act](evtType, this, true); },
			this
		);
	},

	_enabled: true,
	get enabled() {
		return this._enabled && this.pu.pref("enabled");
	},
	set enabled(val) {
		this.pu.pref("enabled", val);
	},

	// Handlers:
	mousedownHandler: function(e) {
		if(!this.enabled)
			return;

		this.saveXY(e);
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;

		this.flags.allowEvents = funcObj.action == this.ignoreAction;

		if(this.pu.pref("forceStopMousedownEvent") || this.editMode)
			this.stopEvent(e);
		else if(this.ut.isNoChromeWin(e.view.top)) { // Prevent page handlers, but don't stop Mouse Gestures
			var cWin = e.view.top === content ? gBrowser.mCurrentBrowser : e.view.top;
			var _this = this;
			cWin.addEventListener(
				"mousedown",
				function(e) {
					cWin.removeEventListener("mousedown", arguments.callee, true);
					if(_this._enabled)
						_this.stopEvent(e);
				},
				true
			);
		}

		if(this._cMenu && typeof this._cMenu.hidePopup == "function")
			this._cMenu.hidePopup();

		var runOnMousedown = funcObj.eventType == "mousedown" && !this.flags.allowEvents;
		if(runOnMousedown)
			this.functionEvent(funcObj, e);
		if(funcObj.action != "showContextMenu")
			this.flags.stopContextMenu = true;
		if(runOnMousedown)
			return;

		var _this = this;
		var cm = this.getItemContext(e); //~ todo: get cm only if needed

		// Fix for switching tabs by Mouse Gestures
		this._tabOnMousedown = cm && cm.id == "contentAreaContextMenu"
			? this.fn.getTabBrowser(true).mCurrentTab
			: null;

		var delay = this.pu.pref("delayedActionTimeout");

		var delayedAction = funcObj.hasOwnProperty("delayedAction") && this.isOkFuncObj(funcObj.delayedAction)
			? funcObj.delayedAction
			: null;

		if(
			delay > 0
			&& !this.editMode
			&& (
				(!delayedAction && cm && e.button == 2) // Show context menu after delay
				|| (delayedAction && delayedAction.enabled) // Other action after delay
			)
		) {
			this.cancelDelayedAction(); // only one timeout... (for dblclick event)
			this.daTimeout = setTimeout(
				function(_this, da) {
					if(!_this.tabNotChanged)
						return;
					_this.flags.runned = true;
					if(!da)
						_this.showPopupOnItem();
					else
						_this.executeFunction(da);
				},
				delay,
				this,
				delayedAction
			);
			if(
				(cm && e.button == 2 && !delayedAction)
				|| delayedAction.action == "showContextMenu"
			) {
				cm.addEventListener(
					"popupshowing",
					function(e) {
						window.removeEventListener(e.type, arguments.callee, true);
						_this.cancelDelayedAction();
					},
					true
				);
			}
		}
		if(!this.hasMousemoveHandler) {
			this.hasMousemoveHandler = true;
			this.disallowMousemove = this.pu.pref("disallowMousemoveButtons").indexOf(e.button) != -1;
			window.addEventListener("mousemove", this, true);
		}
	},
	clickHandler: function(e) {
		if(!this.enabled)
			return;
		this.checkForStopEvent(e); // Can stop "contextmenu" event in Windows
		if(this.flags.allowEvents)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;
		this.functionEvent(funcObj, e);
	},
	mouseupHandler: function(e) {
		if(!this.enabled)
			return;
		this.checkForStopEvent(e);
		if(this.flags.allowEvents)
			this.cancelDelayedAction();
		this.skipFlagsDelay();
		this.saveXY(e);
	},
	commandHandler: function(e) {
		if(!this.enabled)
			return;
		this.checkForStopEvent(e);
	},
	dblclickHandler: function(e) {
		if(!this.enabled)
			return;
		if(this.flags.allowEvents)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;
		this.functionEvent(funcObj, e);
	},

	// Special handlers:
	contextmenuHandler: function(e) {
		if(this.flags.stopContextMenu)
			this.stopEvent(e);
	},
	mousemoveHandler: function(e) {
		this.saveXY(e);
		if(!this.disallowMousemove)
			return;
		if(!this.mousemoveParams)
			this.mousemoveParams = { dist: 0 };
		if("screenX" in this.mousemoveParams) {
			this.mousemoveParams.dist +=
				Math.sqrt(
					Math.pow(this.mousemoveParams.screenX - e.screenX, 2) +
					Math.pow(this.mousemoveParams.screenY - e.screenY, 2)
				);
		}
		this.mousemoveParams.screenX = e.screenX;
		this.mousemoveParams.screenY = e.screenY;

		if(this.mousemoveParams.dist < this.pu.pref("disallowMousemoveDist"))
			return;

		this.flags.runned = true;
		this.flags.stopContextMenu = false; //~ ?

		this.cancelDelayedAction();
		this.removeMousemoveHandler();
	},
	removeMousemoveHandler: function() {
		if(!this.hasMousemoveHandler)
			return;
		window.removeEventListener("mousemove", this, true);
		this.hasMousemoveHandler = false;
		this.mousemoveParams = null;
	},

	// Utils for handlers:
	checkForStopEvent: function _cs(e) {
		var canStop = this.flags.runned || (this.hasSettings && !this.flags.allowEvents) || this.editMode;
		var same = e.originalTarget === this.origItem;
		var stop = canStop && same;
		if(stop && e.type == "mouseup")
			_cs.time = Date.now();
		if(
			stop
			|| (
				canStop && e.type == "command" && e.originalTarget.localName == "command"
				&& (Date.now() - _cs.time < 100)
			)
		)
			this.stopEvent(e);
	},
	skipFlags: function() {
		var fls = this.flags;
		for(var p in fls) if(fls.hasOwnProperty(p))
			fls[p] = false;
		this.removeMousemoveHandler();
	},
	skipFlagsDelay: function() {
		setTimeout(function(_this) { _this.skipFlags(); }, 0, this);
	},
	get tabNotChanged() {
		var tab = this._tabOnMousedown;
		return !tab || tab == this.fn.getTabBrowser(true).mCurrentTab;
	},
	cancelDelayedAction: function() {
		clearTimeout(this.daTimeout);
	},

	// Settings service:
	getFuncObjByEvt: function(e) {
		this.hasSettings = false;
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
			//|| e.originalTarget != this.origItem
		)
			this.defineItem(e, sets);
		var funcObj = this.getFuncObj(sets) || (this.editMode ? {} : null);
		this.hasSettings = !!funcObj;
		if(this.hasSettings) {
			// fx < 3.0:
			// Following works:
			//   this.event = e;
			//   alert(uneval(this.getXY(this.event)));
			// Always return "({x:0, y:0})":
			//   var _this = this;
			//   setTimeout(function() { alert(uneval(_this.getXY(_this.event))); }, 10);
			this.copyOfEvent = e;//this.cloneObj(e);
			this.saveXY(e);
			this.origItem = e.originalTarget;
		}
		else {
			this.copyOfEvent = null;
			this.origItem = null;
		}
		return funcObj;
	},
	getEvtStr: function(e) {
		return "button=" + e.button
			+ ",ctrl=" + e.ctrlKey
			+ ",shift=" + e.shiftKey
			+ ",alt=" + e.altKey
			+ ",meta=" + e.metaKey;
	},
	getSettings: function(str) {
		return this.ps.prefs.hasOwnProperty(str)
			? this.ps.prefs[str]
			: this.editMode
				? {}
				: null;
	},
	defineItem: function(e, sets) {
		var all = this.itemTypeInSets(sets, "$all");
		this._all = all;
		all = this.editMode || all;
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "submitButton"
		this.item = null;

		var it = e.originalTarget;
		//this.origItem = it;

		var itln = it.localName.toLowerCase();
		var _it, _itln;

		// Custom:
		var cts = this.ps.types, ct;
		for(var type in cts) if(cts.hasOwnProperty(type)) {
			if(
				(all || this.itemTypeInSets(sets, type))
				&& this.isOkCustomType(type)
			) {
				ct = cts[type];
				try {
					_it = ct._define.call(this, e, it);
				}
				catch(e) {
					this.ut._log("[define item] Line: " + (e.lineNumber - ct._defineLine + 1));
					var eLine = this.ut.mmLine(e.lineNumber - ct._defineLine + 1);
					var href = "handyclicks://editor/itemType/" + type + "/define";
					var eMsg = this.ut.getLocalized("customTypeDefineError")
						+ this.ut.getLocalized("errorDetails")
							.replace("%l", this.ps.dec(ct.label))
							.replace("%id", type)
							.replace("%e", e);
					this.ut.notify(
						this.ut.getLocalized("errorTitle"),
						eMsg + this.ut.getLocalized("openConsole"),
						this.ut.console, this.wu.getOpenLink(href, eLine)
					);
					this.ut._err(new Error(eMsg), false, href, eLine);
					this.ut._err(e);
				}
				if(!_it)
					continue;
				this.itemType = type;
				this.item = _it;
				return;
			}
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
			if(this.ut.getOwnProperty(sets, "img", "ignoreLinks"))
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
			&& (
				this.hasParent(it, "goPopup")
				|| (itln == "treechildren" && (it.parentNode.id || "").indexOf("history") != -1) // Sidebar
			)
			&& this.fn.getBookmarkUri(it, e)
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
				|| (itln == "treechildren" && (it.parentNode.id || "").indexOf("bookmark") != -1) // Sidebar
			)
			&& !this.hasParent(it, "goPopup")
			&& this.fn.getBookmarkUri(it, e)
		) {
			this.itemType = "bookmark";
			this.item = it;
			return;
		}

		// Tab:
		if(
			(all || this.itemTypeInSets(sets, "tab"))
			&& it.namespaceURI == this.XULNS
			&& itln != "toolbarbutton"
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
			&& itln != "toolbarbutton"
		) {
			_it = it;
			while(_it && _it.nodeType != docNode) {
				_itln = _it.localName.toLowerCase();
				if(_itln == "tab" || _itln == "toolbarbutton")
					break;
				if(/(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(_it.className)) {
					this.itemType = "tabbar";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}

		// Submit button:
		if(all || this.itemTypeInSets(sets, "submitButton")) {
			if(itln == "input" && it.type == "submit" && "form" in it.wrappedJSObject) {
				this.itemType = "submitButton";
				this.item = it;
				return;
			}
			_it = it;
			while(_it && _it.nodeType != docNode) {
				if(_it.localName.toLowerCase() == "button" && "form" in _it.wrappedJSObject) {
					this.itemType = "submitButton";
					this.item = _it;
					return;
				}
				_it = _it.parentNode;
			}
		}
	},
	itemTypeInSets: function(sets, iType) {
		return sets.hasOwnProperty(iType) && this.isOkFuncObj(sets[iType]);
	},
	isOkFuncObj: function(fObj) {
		return this.ps.isOkFuncObj(fObj) && fObj.enabled;
	},
	isOkCustomType: function(cType) {
		return this.ps.isOkCustomType(cType) && this.ps.types[cType].hasOwnProperty("_initialized");
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

	// Context menu:
	getItemContext: function(e) {
		var cm = null;
		switch(this.itemType) {
			case "link":
			case "img":
				cm = document.getElementById("contentAreaContextMenu");
			break;
			case "bookmark":
				cm = document.getElementById("placesContext") || document.getElementById("bookmarks-context-menu");
			break;
			case "historyItem":
				cm = document.getElementById("placesContext"); // Firefox 3.0+
				// It not shown by default in History meny, but...
			break;
			case "tab":
			case "tabbar":
				var cm = document.getAnonymousElementByAttribute(gBrowser || getBrowser(), "anonid", "tabContextMenu");
			break;
			case "submitButton":
				cm = null; //~ todo: SubmitToTab for Firefox 3+ => add cm
			break;
			default: // custom types
				if(!this.isOkCustomType(this.itemType))
					break;
				var ct = this.ps.types[this.itemType];
				var _cm = ct._contextMenu;
				if(_cm) {
					try {
						cm = _cm.call(this.fn, e, this.item, this.origItem);
					}
					catch(e) {
						this.ut._log("[context menu] Line: " + (e.lineNumber - ct._contextMenuLine + 1));
						var eLine = this.ut.mmLine(e.lineNumber - ct._contextMenuLine + 1);
						var href = "handyclicks://editor/itemType/" + this.itemType + "/context";
						var eMsg = this.ut.getLocalized("customTypeContextMenuError")
							+ this.ut.getLocalized("errorDetails")
								.replace("%l", this.ps.dec(ct.label))
								.replace("%id", this.itemType)
								.replace("%e", e);
						this.ut.notify(
							this.ut.getLocalized("errorTitle"),
							eMsg + this.ut.getLocalized("openConsole"),
							this.ut.console, this.wu.getOpenLink(href, eLine)
						);
						this.ut._err(new Error(eMsg), false, href, eLine);
						this.ut._err(e);
					}
				}
				else
					cm = this.getContextMenu();
		}
		if(cm && typeof cm.hidePopup != "function") {
			// Try open XUL document with custom context in tab...
			this.ut._err(new Error("Strange error: context menu has no hidePopup() method\n" + cm.id), true);
			cm = null;
		}
		this._cMenu = cm; // cache
		return cm;
	},

	// Show context menu:
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
				tabscope.hidePopup();
		}

		if(this.ut.fxVersion == 2 && popup.id == "contentAreaContextMenu") { // workaround for spellchecker bug
			this.flags.stopContextMenu = false;

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
		//this.ut._log(popup.ownerDocument.location, document === popup.ownerDocument);
		//document.popupNode = this.itemType == "tab" ? this.item : node;
		popup.ownerDocument.popupNode = this.itemType == "tab" ? this.item : node;

		var xy = this.getXY();
		popup.showPopup(this.ut.fxVersion >= 3 ? node : e.target, xy.x, xy.y, "popup", null, null);
	},
	_xy: null,
	saveXY: function(e) {
		this._xy = { __proto__: null };
		["screenX", "screenY", "clientX", "clientY"].forEach(
			function(p) {
				this._xy[p] = e[p];
			},
			this
		);
	},
	getXY: function(e) {
		e = e || this._xy || this.copyOfEvent;
		return this.ut.fxVersion >= 3
			? { x: e.screenX, y: e.screenY }
			: { x: e.clientX, y: e.clientY };
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

	// Utils:
	stopEvent: function(e) {
		//this.ut._log(e.type + " -> stopEvent()");
		e.preventDefault();
		e.stopPropagation();
	},
	cloneObj: function(obj) {
		obj = obj || {};
		var clone = {};
		for(var p in obj) // Important: this is not real recursive copying of properties!
			clone[p] = obj[p];
		return clone;
	},

	// Custom types:
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
				id = this.getContextAttr(brObj.browser);
				doc = brObj.document;
			}
		}
		this.ut._log("getContextMenu() -> " + id + " -> " + (doc && id && doc.getElementById(id)));
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
					if(win === targetWin) {
						br = browsers[i];
						return true;
					}
					if(!this.ut.isNoChromeWin(win)) {
						brObj = this.getBrowserForWindow(targetWin, win.document);
						if(brObj) {
							br = brObj.browser
							doc = brObj.document;
							return true;
						}
					}
				}
				return false;
			},
			this
		);
		return br && doc
			? { browser: br, document: doc }
			: null;
	},
	getContextAttr: function(node) {
		return node.getAttribute("contentcontextmenu")
			|| node.getAttribute("contextmenu")
			|| node.getAttribute("context");
	},

	// Execute function:
	functionEvent: function(funcObj, e) {
		if(
			this.flags.runned
			|| (!this.editMode && e.type != funcObj.eventType)
			|| !this.itemType // (!this.editMode && !this.itemType)
			|| !this.tabNotChanged
		) {
			//this.editMode = false;
			return;
		}
		this.flags.runned = true;
		this.flags.stopContextMenu = true;

		this.stopEvent(e); // this stop "contextmenu" event in Windows

		if(this.editMode) {
			this.editMode = false;
			this.blinkNode();
			this.openEditor(e);
			return;
		}
		this.executeFunction(funcObj, e);
	},
	executeFunction: function(funcObj, e) {
		this.cancelDelayedAction();
		this.removeMousemoveHandler();

		var args = this.argsToArr(funcObj.arguments);
		args.unshift(e || null);
		if(funcObj.custom) {
			args.splice(1, 0, this.item, this.origItem);
			var action = this.ps.dec(funcObj.action);
			try {
				var line = new Error().lineNumber + 1;
				new Function("event,item,origItem", action).apply(this.fn, args);
			}
			catch(err) {
				this.ut._log("[func] Line: " + (err.lineNumber - line + 1));
				var eLine = this.ut.mmLine(err.lineNumber - line + 1);
				var href = "handyclicks://editor/shortcut/" + this.getEvtStr(e || this.copyOfEvent) + "/"
					+ (this._all ? "$all" : this.itemType) + "/" + (!e ? "delayed" : "normal") + "/code";
				var eMsg = this.ut.getLocalized("customFunctionError")
					+ this.ut.getLocalized("errorDetails")
						.replace("%l", this.ps.dec(funcObj.label))
						.replace("%id", this.itemType)
						.replace("%e", err);
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					eMsg + this.ut.getLocalized("openConsole"),
					this.ut.console, this.wu.getOpenLink(href, eLine)
				);
				this.ut._err(new Error(eMsg), false, href, eLine);
				throw err;
			}
		}
		else {
			var fnc = this.fn[funcObj.action];
			if(typeof fnc == "function")
				fnc.apply(this.fn, args);
			else {
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					this.ut.getLocalized("functionNotFound").replace("%f", funcObj.action),
					this.ut.console
				);
				this.ut._err(new Error(funcObj.action + " not found (" + typeof fnc + ")"));
			}
		}

		var eStr = this.getEvtStr(e || this.copyOfEvent);
		this.ut._log(
			(e ? e.type : "delayedAction")
			+ " -> " + this.ps.getModifiersStr(eStr) + " + " + this.ps.getLocaleButtonStr(eStr, true)
			+ "\n=> executeFunction()"
			+ "\nnodeName = " + this.origItem.nodeName
			+ ", itemType = " + this.itemType
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

	// Events interface:
	handleEvent: function(e) {
		switch(e.type) {
			case "load":        this.init(e);               break;
			case "mousedown":   this.mousedownHandler(e);   break;
			case "click":       this.clickHandler(e);       break;
			case "mouseup":     this.mouseupHandler(e);     break;
			case "command":     this.commandHandler(e);     break;
			case "dblclick":    this.dblclickHandler(e);    break;
			case "contextmenu": this.contextmenuHandler(e); break;
			case "mousemove":   this.mousemoveHandler(e);
		}
	},

	// GUI:
	toggleStatus: function() {
		this.enabled = !this.enabled;
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
	toggleEditMode: function() {
		setTimeout(function(_this) { _this.editMode = !_this.editMode; }, 0, this);
	},
	setEditModeStatus: function(em) {
		em = em === undefined ? this.editMode : em;
		//~ todo: this.ut.notify() ?
		document.getElementById("handyClicks-toggleStatus-sBarIcon").setAttribute("hc_editmode", em);
	},
	openEditor: function(e) {
		e = e || this.copyOfEvent;
		this.fn.closeMenus(e.originalTarget);
		this.wu.openEditor("shortcut", this.getEvtStr(e), this.itemType);
	},
	updUI: function(pName) {
		if(pName == "enabled")
			this.setStatus();
	},
	setStatus: function() {
		var sbi = document.getElementById("handyClicks-toggleStatus-sBarIcon");
		var enabled = this.enabled;
		sbi.setAttribute("hc_enabled", enabled);
		sbi.tooltipText = this.ut.getLocalized(enabled ? "enabled" : "disabled");
		document.getElementById("handyClicks-cmd-editMode").setAttribute("disabled", !enabled);
	},

	// Hotkeys:
	registerHotkeys: function() {
		this.pu.prefSvc.getBranch(this.pu.nPrefix + "key.")
			.getChildList("", {})
			.forEach(this.registerHotkey, this);
	},
	registerHotkey: function(kId) {
		var keyStr = this.pu.pref("key." + kId);
		if(!keyStr) // Key is disabled
			return;
		var tokens = keyStr.split(" ");
		var key = tokens.pop() || " ";
		var modifiers = tokens.join(",");
		var kElt = document.getElementById("handyClicks-key-" + kId);
		kElt.removeAttribute("disabled");
		kElt.setAttribute(key.indexOf("VK_") == 0 ? "keycode" : "key", key);
		kElt.setAttribute("modifiers", modifiers);
	}
};
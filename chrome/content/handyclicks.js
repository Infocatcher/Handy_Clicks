var handyClicks = {
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

	ignoreAction: "$ignore",

	// Initialization:
	init: function(reloadFlag) {
		this.ps.loadSettings();
		this.setListeners(["mousedown", "click", "command", "mouseup", "contextmenu", "dblclick"], true);
		this.pu.oSvc.addPrefsObserver(this.updUI, this);
		this.setStatus();
		this.registerHotkeys();
		this.showHideControls();
		reloadFlag && this.setEditModeStatus();
	},
	destroy: function(reloadFlag) {
		this.setListeners(["mousedown", "click", "command", "mouseup", "contextmenu", "dblclick"], false);
		this.cancelDelayedAction();
	},
	setListeners: function(evtTypes, addFlag) {
		var act = addFlag ? "addEventListener" : "removeEventListener";
		evtTypes.forEach(
			function(evtType) {
				window[act](evtType, this, true);
			},
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

	_editMode: false,
	get editMode() {
		return this._editMode;
	},
	set editMode(em) {
		this._editMode = em;
		this.setListeners(["keydown"], em);
		this.setEditModeStatus(em);
	},

	// Handlers:
	mousedownHandler: function(e) {
		if(!this.enabled)
			return;

		this.saveXY(e);
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;

		if(this._cMenu && typeof this._cMenu.hidePopup == "function") // ?
			this._cMenu.hidePopup();

		this.flags.allowEvents = funcObj.action == this.ignoreAction;
		this.flags.stopContextMenu = funcObj.action != "showContextMenu";

		// Fix for switching tabs by Mouse Gestures
		this._tabOnMousedown = e.view.top === content && this.getTabBrowser(true).mCurrentTab;

		if(funcObj.eventType == "mousedown" && !this.flags.allowEvents) {
			this.functionEvent(funcObj, e);
			return;
		}

		if(!this.ut.getOwnProperty(funcObj, "allowMousedownEvent")) {
			if(this.pu.pref("forceStopMousedownEvent") || this.editMode)
				this.stopEvent(e);
			else if(!this.ut.isChromeWin(e.view.top)) { // Prevent page handlers, but don't stop Mouse Gestures
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
		}

		var _this = this;
		//var cm = this.getItemContext(e); //~ todo: get cm only if needed

		var delay = this.pu.pref("delayedActionTimeout");
		var delayedAction = funcObj.hasOwnProperty("delayedAction") && this.isOkFuncObj(funcObj.delayedAction)
			? funcObj.delayedAction
			: null;

		if(
			delay > 0
			&& !this.editMode
			&& (
				(!delayedAction /*&& cm */&& e.button == 2) // Show context menu after delay
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
			/****
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
			****/
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
		if(funcObj)
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
		var funcObj = this.getFuncObjByEvt(e);
		if(funcObj)
			this.functionEvent(funcObj, e);
	},
	dblclickHandler: function(e) {
		if(!this.enabled)
			return;
		if(this.flags.allowEvents)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		if(funcObj)
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
		var isMouseup = e.type == "mouseup";
		if(stop && isMouseup)
			_cs.time = Date.now();
		if(
			stop
			|| (
				canStop && e.type == "command" && e.originalTarget.localName == "command"
				&& _cs.hasOwnProperty("time")
				&& Date.now() - _cs.time < 100
			)
		) {
			if(isMouseup && e.view.top === content) { // Prevent page handlers, but don't stop FireGestures extension
				var cWin = gBrowser.mCurrentBrowser;
				var _this = this;
				cWin.addEventListener(
					"mouseup",
					function(e) {
						cWin.removeEventListener("mouseup", arguments.callee, true);
						if(_this._enabled)
							_this.stopEvent(e);
					},
					true
				);
				return;
			}
			this.stopEvent(e);
		}
	},
	skipFlags: function() {
		var fls = this.flags;
		for(var p in fls) if(fls.hasOwnProperty(p))
			fls[p] = false;
		this.removeMousemoveHandler();
	},
	skipFlagsDelay: function() {
		setTimeout(function(_this) {
			_this.skipFlags();
		}, 0, this);
	},
	get tabNotChanged() {
		var tab = this._tabOnMousedown;
		return !tab || tab == this.getTabBrowser(true).mCurrentTab;
	},
	cancelDelayedAction: function() {
		clearTimeout(this.daTimeout);
	},

	// Settings service:
	getFuncObjByEvt: function(e) {
		this.hasSettings = false;
		var evtStr = this.ps.getEvtStr(e);
		var isMousedown = e.type == "mousedown";
		if(isMousedown)
			this.evtStrOnMousedown = evtStr;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return null;
		if(
			isMousedown
			|| evtStr != this.evtStrOnMousedown
			|| e.originalTarget !== this.origItem // For "command" event
		) {
			this.defineItem(e, sets);
			if(this.pu.pref("devMode") && this.itemType)
				this.ut._log("[" + e.type + "] " + "this.itemType = " + this.itemType);
		}
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
			//this.saveXY(e); // Saves incorrect coordinates...
			this.origItem = e.originalTarget;
		}
		else {
			this.copyOfEvent = null;
			this.origItem = null;
		}
		return funcObj;
	},
	getSettings: function(str) {
		return this.ps.prefs.hasOwnProperty(str)
			? this.ps.prefs[str]
			: this.editMode
				? {}
				: null;
	},
	defineItem: function(e, sets, forcedAll) {
		this._all = this.itemTypeInSets(sets, "$all");
		var all = forcedAll || this._all;
		//all = this.editMode || all;
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
					var eLine = this.ut.mmLine(e.lineNumber - ct._defineLine + 1);
					var href = "handyclicks://editor/itemType/" + type + "/define";
					var eMsg = this.ut.errInfo("customTypeDefineError", this.ps.dec(ct.label), type, e);
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
			&& !this.ut.isChromeDoc(it.ownerDocument) // Not for interface...
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
			&& it.namespaceURI == this.ut.XULNS
			&& (
				this.hasParent(it, "goPopup")
				|| (itln == "treechildren" && (it.parentNode.id || "").indexOf("history") != -1) // Sidebar
			)
			&& this.getBookmarkUri(it, e)
		) {
			this.itemType = "historyItem";
			this.item = it;
			return;
		}

		// Bookmark:
		if(
			(all || this.itemTypeInSets(sets, "bookmark"))
			&& it.namespaceURI == this.ut.XULNS
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
			&& this.getBookmarkUri(it, e)
		) {
			this.itemType = "bookmark";
			this.item = it;
			return;
		}

		// Tab:
		if(
			(all || this.itemTypeInSets(sets, "tab"))
			&& it.namespaceURI == this.ut.XULNS
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
			&& it.namespaceURI == this.ut.XULNS
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

		if(!forcedAll && this.editMode) // Nothing found?
			this.defineItem(e, sets, true); // Try again with disabled types.
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
		var type = this.itemType;
		if(!this.ps.isCustomType(type))
			return null; // Simulate "contextmenu" event

		if(!this.isOkCustomType(type))
			return null;
		var ct = this.ps.types[type];
		var _cm = ct._contextMenu;
		if(_cm) {
			try {
				cm = _cm.call(this.fn, e, this.item, this.origItem);
			}
			catch(e) {
				var eLine = this.ut.mmLine(e.lineNumber - ct._contextMenuLine + 1);
				var href = "handyclicks://editor/itemType/" + this.itemType + "/context";
				var eMsg = this.ut.errInfo("customTypeContextMenuError", this.ps.dec(ct.label), this.itemType, e);
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					eMsg + this.ut.getLocalized("openConsole"),
					this.ut.console, this.wu.getOpenLink(href, eLine)
				);
				this.ut._err(new Error(eMsg), false, href, eLine);
				this.ut._err(e);
			}
			if(cm === "auto")
				cm = this.getContextMenu();
		}

		if(this.ut.isObject(cm) && typeof cm.hidePopup != "function") {
			// XUL document with custom context...
			this.ut._err(new Error("Error: context menu has no hidePopup() method\nid: " + cm.id), true);
			cm = null;
		}
		this._cMenu = cm; // cache
		return cm;
	},

	// Show context menu:
	showPopupOnItem: function(popup, node, e) {
		node = node || this.origItem;
		if(!node || !node.ownerDocument.location)
			return; // e.g. rocker gesture => go back => node.ownerDocument.location === null

		if(this.itemType == "tab") {
			// Tab Scope ( https://addons.mozilla.org/firefox/addon/4882 )
			var tabscope = document.getElementById("tabscopePopup");
			if(tabscope) // mousedown -> ...delay... -> this popup -> Tab Scope popup hide this popup
				tabscope.hidePopup();
		}

		if(!popup)
			popup = this.getItemContext();

		if(!popup || (this.ut.fxVersion == 2 && popup.id == "contentAreaContextMenu")) {
			// Some strange things happens in Firefox 2 for "contentAreaContextMenu"... Spellchecker bug?
			this.flags.stopContextMenu = false;
			this.createMouseEvents(this._xy, node, ["mousedown", "mouseup", "contextmenu"], 2)();
			return;
		}

		popup = popup || this._cMenu;
		e = e || this.copyOfEvent;
		document.popupNode = popup.ownerDocument.popupNode = this.itemType == "tab" ? this.item : node;

		var xy = this.getXY();
		popup.showPopup(this.ut.fxVersion >= 3 ? node : e.target, xy.x, xy.y, "popup", null, null);
		this.focusOnItem();
	},
	_xy: null,
	saveXY: function(e) {
		if(!this._xy)
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
		var origStyle = node.hasAttribute("style") && node.getAttribute("style");
		node.style.setProperty("visibility", "hidden", "important");
		setTimeout(
			function(_this) {
				_this.ut.attribute(node, "style", origStyle, true);
			},
			time || 170, this
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
	getTabBrowser: function(tabsRequired) {
		return "SplitBrowser" in window && !(tabsRequired && "TM_init" in window) // Tab Mix Plus
			? SplitBrowser.activeBrowser
			: window.gBrowser || getBrowser();
	},
	closeMenus: function(it) {
		it = it || this.item;
		if(this.ut.isObject(it))
			closeMenus(it); // chrome://browser/content/utilityOverlay.js
	},
	getBookmarkUri:	function(it, e, usePlacesURIs) {
		var ln = it.localName;
		var uri = ln && ln.toLowerCase() == "treechildren"
			? this.getTreeInfo(it, e, "uri")
			: it.statusText || (it.node && it.node.uri) || it.getAttribute("siteURI") || "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTreeInfo: function(treechildren, e, prop) { // "uri" or "title"
		if(!("PlacesUtils" in window)) // For Firefox 3.0+
			return "";
		var tree = (treechildren || this.item).parentNode
		e = e || this.copyOfEvent;

		// Based on code of Places' Tooltips ( https://addons.mozilla.org/firefox/addon/7314 )
		var row = {}, column = {}, part = {};
		var tbo = tree.treeBoxObject;
		tbo.getCellAt(e.clientX, e.clientY, row, column, part);
		if(row.value == -1)
			return "";
		var node = tree.view.nodeForTreeIndex(row.value);
		if(!PlacesUtils.nodeIsURI(node))
			return "";
		return node[prop];
	},
	createMouseEvents: function(origEvt, item, evtTypes, button) {
		var evts = evtTypes.map(
			function(evtType) {
				return this.createMouseEvent(origEvt, item, evtType, button);
			},
			this
		);
		var _this = this;
		return function() {
			_this._enabled = false;
			evts.forEach(function(evt) { item.dispatchEvent(evt); });
			_this._enabled = true;
		};
	},
	createMouseEvent: function(origEvt, item, evtType, button) {
		item = item || origEvt.originalTarget;
		var doc = item.ownerDocument;
		var evt = doc.createEvent("MouseEvents");
		evt.initMouseEvent( // https://developer.mozilla.org/en/DOM/event.initMouseEvent
			evtType, true /* canBubble */, true /* cancelable */, doc.defaultView, 1,
			origEvt.screenX, origEvt.screenY, origEvt.clientX, origEvt.clientY,
			false, false, false, false,
			button, null
		);
		return evt;
	},
	focusOnItem: function(forced, it) {
		if(!forced && !this.pu.pref("focusOnItems"))
			return;
		it = it || this.item;
		if(
			this.ut.isObject(it)
			&& it.ownerDocument.defaultView.getComputedStyle(it, "").MozUserFocus != "ignore"
			&& typeof it.focus == "function"
		)
			it.focus();
	},

	// Custom types:
	//~ todo: move to separate file?
	getContextMenu: function(node) {
		node = node || this.item;
		if(!node)
			return null;
		var id = null;
		var doc = document;
		if(this.ut.isChromeDoc(node.ownerDocument) || node.namespaceURI == this.ut.XULNS) {
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
				var browsers = doc.getElementsByTagNameNS(this.ut.XULNS, tag);
				var win, brObj;
				for(var i = 0, len = browsers.length; i < len; i++) {
					win = browsers[i].contentWindow;
					if(win === targetWin) {
						br = browsers[i];
						return true;
					}
					if(this.ut.isChromeWin(win)) {
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
			this.closeMenus(e.originalTarget);
			this.wu.openEditor(null, "shortcut", this.ps.getEvtStr(e), this._all ? "$all" : this.itemType);
			return;
		}
		this.executeFunction(funcObj, e);
	},
	executeFunction: function(funcObj, e) {
		this.cancelDelayedAction();
		this.removeMousemoveHandler();

		this.lastEvent = this.copyOfEvent;
		this.lastItemType = this.itemType;
		this.lastAll = this._all;
		this.isDeleyed = !e;

		var action = funcObj.action;
		if(funcObj.custom) {
			action = this.ps.dec(action);
			try {
				var line = new Error().lineNumber + 1;
				new Function("event,item,origItem", action).apply(this.fn, [e, this.item, this.origItem]);
			}
			catch(err) {
				var eLine = this.ut.mmLine(err.lineNumber - line + 1);
				var href = "handyclicks://editor/shortcut/" + this.ps.getEvtStr(e || this.copyOfEvent) + "/"
					+ (this._all ? "$all" : this.itemType) + "/"
					+ (this.isDeleyed ? "delayed" : "normal") + "/code";
				var eMsg = this.ut.errInfo("customFunctionError", this.ps.dec(funcObj.label), this.itemType, err);
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					eMsg + this.ut.getLocalized("openConsole"),
					this.ut.console, this.wu.getOpenLink(href, eLine)
				);
				this.ut._err(new Error(eMsg), false, href, eLine);
				this.ut._err(err);
			}
		}
		else {
			var fnc = action in this.fn && this.fn[action];
			if(typeof fnc == "function") {
				var args = [e];
				var argsObj = funcObj.arguments;
				for(var p in argsObj) if(argsObj.hasOwnProperty(p))
					args.push(argsObj[p]);
				fnc.apply(this.fn, args);
			}
			else {
				this.ut.notify(
					this.ut.getLocalized("errorTitle"),
					this.ut.getLocalized("functionNotFound").replace("%f", action),
					this.ut.console
				);
				this.ut._err(new Error(action + " not found (" + typeof fnc + ")"));
			}
		}

		this.focusOnItem();

		if(this.pu.pref("devMode")) {
			var eStr = this.ps.getEvtStr(e || this.copyOfEvent);
			this.ut._log(
				(e ? e.type : "delayedAction")
				+ " -> " + this.ps.getModifiersStr(eStr) + " + " + this.ps.getButtonStr(eStr, true)
				+ "\n=> executeFunction()"
				+ "\nnodeName = " + this.origItem.nodeName
				+ ", itemType = " + this.itemType
				+ "\n=> " + (funcObj.custom ? (this.ps.dec(funcObj.label) || action) : funcObj.action)
			);
		}
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
			case "mousemove":   this.mousemoveHandler(e);   break;
			case "keydown":
				if(e.keyCode == e.DOM_VK_ESCAPE)
					this.editMode = false;
		}
	},

	// GUI:
	toggleStatus: function(fromKey) {
		var en = !this.enabled;
		this.enabled = en;
		if(fromKey && !document.getElementById("handyClicks-toggleStatus-tbButton") && !this.pu.pref("ui.showInStatusbar"))
			this.ut.notify(null, this.ut.getLocalized(en ? "enabled" : "disabled"), null, null, en, true);
	},
	checkClipboard: function() {
		document.getElementById("handyClicks-importFromClipboard").hidden = !this.ps.checkPrefsStr(this.ut.readFromClipboard());
	},
	doSettings: function(e) {
		if(e.type == "command" || e.button == 0)
			this.toggleStatus();
		else if(e.button == 1) {
			this.openSettings();
			this.closeMenus(e.target);
		}
	},
	openSettings: function(importFlag) {
		var w = this.wu.openWindowByType(
			window,
			"chrome://handyclicks/content/sets.xul",
			"handyclicks:settings",
			"chrome,titlebar,toolbar,centerscreen,resizable,dialog=0"
		);
		importFlag && setTimeout(function() {
			if("_handyClicksInitialized" in w) {
				w.handyClicksSets.importSets(true, true);
				return;
			}
			setTimeout(arguments.callee, 5);
		}, 0);
	},
	toggleEditMode: function() {
		setTimeout(function(_this) {
			_this.editMode = !_this.editMode;
		}, 0, this);
	},
	setEditModeStatus: function(em) {
		em = em === undefined ? this.editMode : em;
		var exitKey = this.ut.getStr("chrome://global/locale/keys.properties", "VK_ESCAPE") || "Esc";
		var tt = em
			? this.ut.getLocalized("editModeTip").replace("%k", exitKey)
			: "";
		var ttAttr = this.fn.tooltipAttrBase + "1";
		this.setControls(
			function(elt) {
				elt.setAttribute("hc_editmode", em);
				elt.setAttribute(ttAttr, tt);
			}
		);
		if(!em)
			return;
		var _this = this;
		this.ut.notify(
			this.ut.getLocalized("editModeTitle"),
			this.ut.getLocalized("editModeNote").replace("%k", exitKey),
			function() { _this.editMode = false; },
			null, true, true
		);
	},
	updUI: function(pName) {
		if(pName == "enabled")
			this.setStatus();
		else if(pName.indexOf("ui.showIn") == 0)
			this.showHideControls();
	},
	setStatus: function() {
		var enabled = this.enabled;
		var tt = this.ut.getLocalized(enabled ? "enabledTip" : "disabledTip");
		var ttAttr = this.fn.tooltipAttrBase + "0";
		this.setControls(
			function(elt) {
				elt.setAttribute("hc_enabled", enabled);
				elt.setAttribute(ttAttr, tt);
			}
		);
		document.getElementById("handyClicks-cmd-editMode").setAttribute("disabled", !enabled);
	},
	showHideControls: function() {
		document.getElementById("handyClicks-toggleStatus-menuitem").hidden = !this.pu.pref("ui.showInToolsMenu");
		document.getElementById("handyClicks-toggleStatus-sBarIcon").hidden = !this.pu.pref("ui.showInStatusbar");
	},
	setControls: function(func, context) {
		["sBarIcon", "tbButton", "menuitem"].forEach(
			function(id) {
				var elt = document.getElementById("handyClicks-toggleStatus-" + id);
				elt && func.call(context || this, elt);
			}
		);
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
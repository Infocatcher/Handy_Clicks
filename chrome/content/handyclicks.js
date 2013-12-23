var handyClicks = {
	ignoreAction: "$ignore",

	event: null,
	origItem: null,
	item: null,
	mainItem: null,
	itemType: undefined,
	flags: {
		cancelled: false,
		runned: false, // => stop click events
		stopContextMenu: false, // => stop "contextmenu" event (in Linux: mousedown -> contextmenu -> ... delay ... -> click)
		allowPopupshowing: false,
		allowEvents: false, // => allow all events while (flags.runned == false)
		allowEditModeEvents: false,
		__proto__: null
	},

	get copyOfEvent() { //= Added: 2012-05-15
		//~ todo: check old custom code and remove
		this.ut._deprecated('Field "copyOfEvent" is deprecated. Use "event" instead.');
		return this.event;
	},

	_cMenu: null,
	daTimeout: 0, // Delayed Action Timeout
	evtStrOnMousedown: "",
	_hasMoveHandlers: false,

	// Initialization:
	init: function(reloadFlag) {
		this.ps.loadSettingsAsync();
		this.initListeners(true);
	},
	initListeners: function(enabled) {
		this.setListeners(["mousedown", "click", "command", "mouseup", "dblclick", "contextmenu", "popupshowing"], enabled);
	},
	destroy: function(reloadFlag) {
		this.initListeners(false);
		this.cancelDelayedAction();
		if(this.editMode)
			this.editMode = false;
		this.setMoveHandlers(false);
		this.event = this.origItem = this.item = this.mainItem = null;
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "mousedown":    this.mousedownHandler(e);    break;
			case "click":        this.clickHandler(e);        break;
			case "mouseup":      this.mouseupHandler(e);      break;
			case "command":      this.commandHandler(e);      break;
			case "dblclick":     this.dblclickHandler(e);     break;
			case "contextmenu":  this.contextmenuHandler(e);  break;
			case "popupshowing": this.popupshowingHandler(e); break;
			case "mousemove":    this.mousemoveHandler(e);    break;
			case "draggesture": // Legacy
			case "dragstart":    this.dragHandler(e);         break;
			case "TabSelect":    this.tabSelectHandler(e);    break;
			case "DOMMouseScroll": // Legacy
			case "wheel":        this.wheelHandler(e);        break;
			case "keypress":
				if(e.keyCode != e.DOM_VK_ESCAPE)
					break;
				this.ut.stopEvent(e);
				this.editMode = false; // this removes event listener
		}
	},
	setListeners: function(evtTypes, add) {
		var act = add ? addEventListener : removeEventListener;
		evtTypes.forEach(function(evtType) {
			act.call(window, evtType, this, true);
		}, this);
	},

	_enabled: true, // Uses for internal disabling
	get enabled() {
		return this._enabled && this.pu.pref("enabled");
	},
	set enabled(on) {
		this.pu.pref("enabled", on);
	},

	_editMode: false,
	get editMode() {
		return this._editMode;
	},
	set editMode(em) {
		this._editMode = em;
		this.setListeners(["keypress"], em);
		this.ui.setEditModeStatus(em);
	},

	// Handlers:
	mousedownHandler: function(e) {
		if(!this.enabled)
			return;

		this.saveXY(e);
		this.resetFlags();
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;

		if( // Workaround for https://addons.mozilla.org/addon/budaneki/
			this.itemType == "link"
			&& e.button == 0
			&& this.item.parentNode
			&& this.item.parentNode.id == "budaneki-icon-menu-clonned"
			&& this.item.ownerDocument == document
		)
			return;

		if(this._cMenu && typeof this._cMenu.hidePopup == "function") // ?
			this._cMenu.hidePopup();

		var em = this.editMode;
		var allowEvts = this.flags.allowEvents = !em && funcObj.action == this.ignoreAction;
		this.flags.stopContextMenu = !allowEvts && funcObj.action != "showContextMenu";

		this.ui.setIcon(e);

		if(!em && funcObj.eventType == "mousedown" && !allowEvts) {
			this.functionEvent(funcObj, e);
			return;
		}

		var emAllowEvent = false;
		if(em) {
			var tar = e.originalTarget;
			if(tar.namespaceURI == this.ut.XULNS) {
				var nn = tar.nodeName;
				emAllowEvent = this.flags.allowEditModeEvents = nn == "xul:scrollbarbutton" || nn == "xul:slider";
				if(
					this.ut.fxVersion >= 3.6
					&& tar.boxObject
					&& tar.boxObject instanceof Components.interfaces.nsIMenuBoxObject
				) {
					this.flags.allowPopupshowing = true;
					//tar.boxObject.openMenu(true);
					tar.open = true; // Open <menu>, <toolbarbutton type="menu">, etc.
					this.flags.allowPopupshowing = false;
				}
			}
		}

		var amd = this.ut.getOwnProperty(funcObj, "allowMousedownEvent");
		// true      - don't stop
		// undefined - smart
		// false     - always stop
		if(amd === false || em && !emAllowEvent)
			this.ut.stopEvent(e);
		else if(amd === undefined && !this.ut.isChromeWin(e.view.top)) {
			// Prevent page handlers, but don't stop Mouse Gestures
			var root = e.view.top === content ? gBrowser.selectedBrowser : e.view.top;
			var _this = this;
			root.addEventListener(
				"mousedown",
				function stopMousedown(e) {
					root.removeEventListener("mousedown", stopMousedown, true);
					if(_this._enabled)
						_this.ut.stopEvent(e);
				},
				true
			);
		}

		var delay = this.pu.pref("delayedActionTimeout");
		if(delay > 0 && !em) {
			var delayedAction = this.ut.getOwnProperty(funcObj, "delayedAction");
			if(
				(!delayedAction && e.button == 2) // Show context menu after delay
				|| this.isOkFuncObj(delayedAction) // Other action after delay
			) {
				this.cancelDelayedAction(); // Only one timeout... (for dblclick event)
				this.daTimeout = this.ut.timeout(
					this.executeDelayedAction,
					this, [delayedAction],
					delay
				);
			}
		}

		this.setMoveHandlers(e);
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
		else if(this.editMode) {
			var tar = e.originalTarget;
			if(
				tar.namespaceURI != this.ut.XULNS
				|| !tar.boxObject
				|| !(tar.boxObject instanceof Components.interfaces.nsIMenuBoxObject)
			)
				this.ui.notifyEditMode();
		}
	},
	mouseupHandler: function(e) {
		if(!this.enabled)
			return;
		this.checkForStopEvent(e);
		if(this.flags.allowEvents)
			this.cancelDelayedAction();
		this.setMoveHandlers(false);
		this.saveXY(e);

		this.ui.restoreIcon();

		setTimeout(function(_this) {
			_this.flags.stopContextMenu = false;
		}, 0, this);
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
		if(this.enabled && this.flags.stopContextMenu)
			this.ut.stopEvent(e);
	},
	popupshowingHandler: function(e) {
		// Force prevent any popup
		// This is for RightToClick extension https://addons.mozilla.org/firefox/addon/righttoclick/
		if(this.enabled && this.flags.stopContextMenu && !this.flags.allowPopupshowing) {
			var ln = e.target.localName.toLowerCase();
			if(ln == "menupopup" || ln == "popup")
				this.ut.stopEvent(e);
		}
	},
	mousemoveHandler: function(e) {
		this.saveXY(e);
		if(!this.disallowMousemove)
			return;
		var mp = this.mousemoveParams, x = e.screenX, y = e.screenY;
		this.mousemoveParams = {
			dist: mp.dist + Math.sqrt(
				Math.pow(mp.screenX - x, 2) +
				Math.pow(mp.screenY - y, 2)
			),
			screenX: x,
			screenY: y
		};
		if(this.mousemoveParams.dist < this.pu.pref("disallowMousemoveDist"))
			return;

		this.ut._log("mousemoveHandler -> cancel()");
		this.cancel();
	},
	dragHandler: function(e) {
		if(!this.disallowMousemove)
			return;
		this.ut._log("dragHandler -> cancel()");
		this.cancel();
	},
	tabSelectHandler: function(e) {
		this.ut._log("tabSelectHandler -> cancel()");
		this.cancel();
	},
	wheelHandler: function() {
		this.ut._log("wheelHandler -> cancel()");
		this.cancel();
	},
	cancel: function() {
		this.flags.cancelled = true;
		this.flags.stopContextMenu = false; //~ ?

		this.cancelDelayedAction();
		this.setMoveHandlers(false);

		this.ui.restoreIcon();
	},
	setMoveHandlers: function(add) {
		if(!add ^ this._hasMoveHandlers)
			return;
		this._hasMoveHandlers = !!add;
		if(add) {
			var dist = this.disallowMousemoveDist = this.pu.pref("disallowMousemoveDist");
			this.disallowMousemove = dist >= 0
				&& this.pu.pref("disallowMousemoveButtons").indexOf(add.button) != -1;
			this.mousemoveParams = {
				dist: 0,
				screenX: add.screenX,
				screenY: add.screenY,
				__proto__: null
			};
		}
		else {
			this.mousemoveParams = null;
		}
		this.setListeners(["mousemove", "TabSelect", this.ut.dragStartEvent, this.ut.wheelEvent], add);
	},

	// Utils for handlers:
	checkForStopEvent: function _cs(e) {
		var canStop = (this.flags.runned || (this.hasSettings && !this.flags.allowEvents) || this.editMode)
			&& !this.flags.cancelled;
		if(canStop && this.editMode && this.flags.allowEditModeEvents)
			return;
		var same = e.originalTarget === this.origItem;
		var stop = canStop && same;
		var isMouseup = e.type == "mouseup";
		if(stop && isMouseup)
			_cs.time = Date.now();
		if(
			e.type == "command"
				? canStop
					&& e.originalTarget.localName == "command"
					&& _cs.hasOwnProperty("time")
					&& Date.now() - _cs.time < 100
				: stop
		) {
			if(isMouseup && e.view.top === content) { // Prevent page handlers, but don't stop FireGestures extension
				var cWin = gBrowser.selectedBrowser;
				var _this = this;
				cWin.addEventListener(
					"mouseup",
					function _mu(e) {
						cWin.removeEventListener("mouseup", _mu, true);
						if(_this._enabled)
							_this.ut.stopEvent(e);
					},
					true
				);
				return;
			}
			this.ut.stopEvent(e);
		}
	},
	resetFlags: function() {
		var fls = this.flags;
		for(var p in fls)
			fls[p] = false;
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
		else if(!this.item) // mousedown, scroll => switch to another tab => mouseup, click
			return null;
		var sets = this.getSettings(evtStr);
		if(!sets)
			return null;
		if(
			isMousedown
			|| evtStr != this.evtStrOnMousedown
			|| e.originalTarget !== this.origItem // For "command" event
		) {
			this.defineItem(e, sets);
			this.itemType && this.ut._log("[" + e.type + "] " + "this.itemType = " + this.itemType);
		}
		var funcObj = this.getFuncObj(sets) || this.editMode && { action: null };
		this.hasSettings = !!funcObj;
		if(this.hasSettings) {
			this.event = e;
			//this.saveXY(e); // Saves incorrect coordinates...
			this.origItem = e.originalTarget;
		}
		else
			this.event = this.origItem = null;
		return funcObj;
	},
	getSettings: function(str) {
		return this.ps.prefs.hasOwnProperty(str)
			? this.ps.prefs[str]
			: this.editMode
				? {}
				: null;
	},

	_ignoreOtherTypes: true,
	get ignoreOtherTypes() { //= Added: 2010-06-21
		return this._ignoreOtherTypes;
	},
	set ignoreOtherTypes(val) {
		var caller = Components.stack.caller;
		this.ut._deprecated('Flag "ignoreOtherTypes" is deprecated. Use "checkOtherTypes" instead.');
		this._ignoreOtherTypes = val;
	},
	defineItem: function(e, sets, forcedAll) {
		this._all = this.itemTypeInSets(sets, "$all");
		var all = forcedAll || this._all;
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "ext_mulipletabs", "submitButton"
		this.item = this.mainItem = null;

		//var it = this.origItem = e.originalTarget;
		var it = e.originalTarget;
		if(!it.localName) // it == document
			return;
		var _it;

		// Custom:
		var cts = this.ps.types;
		for(var type in cts) if(cts.hasOwnProperty(type)) {
			if(
				(all || this.itemTypeInSets(sets, type))
				&& this.ps.initCustomType(type)
			) {
				var ct = cts[type];
				this._ignoreOtherTypes = true; // Deprecated, see "ignoreOtherTypes" setter and getter
				this.checkOtherTypes = false;
				try {
					_it = ct._define.call(this, e, it);
				}
				catch(e) {
					var eLine = this.ut.mmLine(this.ut.getProperty(e, "lineNumber") - ct._defineLine + 1);
					var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
						+ this.ct.EDITOR_TYPE_DEFINE
						+ "?line=" + eLine;
					var eMsg = this.ut.errInfo("customTypeDefineError", this.ps.dec(ct.label), type, e);
					this.ut.notify(
						eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
						this.ut.getLocalized("errorTitle"),
						this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
						this.ut.NOTIFY_ICON_ERROR
					);
					this.ut._err(eMsg, href, eLine);
					this.ut._err(e);
				}
				if(!_it)
					continue;
				this.itemType = type;
				this.item = _it;
				if(!this.checkOtherTypes || this._ignoreOtherTypes)
					return;
			}
		}

		var checkSimpleType = this.ut.bind(function(type, getter) {
			if(all || this.itemTypeInSets(sets, type)) {
				var _it = getter.call(this, it, e);
				if(_it) {
					this.itemType = type;
					this.item = _it;
					return true;
				}
			}
			return false;
		}, this);

		// Image or link:
		if(all || this.itemTypeInSets(sets, "img")) {
			_it = this.getImg(it);
			if(
				_it && (
					!this.ut.getOwnProperty(sets, "img", "ignoreSingle")
					|| _it.ownerDocument.documentURI != _it.src
				)
			) {
				this.itemType = "img";
				this.item = _it;
				if(this.ut.getOwnProperty(sets, "img", "ignoreLinks"))
					return;
			}
		}
		if(checkSimpleType("link", this.getLink))
			return;
		if(this.itemType == "img")
			return;

		// Tab or selected tabs (Multiple Tab Handler extension):
		var mth = all || this.itemTypeInSets(sets, "ext_mulipletabs");
		if(mth || this.itemTypeInSets(sets, "tab")) {
			_it = this.getTab(it, true);
			if(_it) {
				if(mth && "MultipleTabService" in window && MultipleTabService.isSelected(_it)) {
					this.itemType = "ext_mulipletabs";
					this.item = MultipleTabService.getSelectedTabs(MultipleTabService.getTabBrowserFromChild(_it));
					this.mainItem = _it;
					return;
				}
				this.itemType = "tab";
				this.item = _it;
				return;
			}
		}

		// Other simple types:
		var types = {
			historyItem:  this.getHistoryItem,
			bookmark:     this.getBookmarkItem,
			tabbar:       this.getTabbar,
			submitButton: this.getSubmitButton,
			__proto__: null
		};
		for(var type in types)
			if(checkSimpleType(type, types[type]))
				return;

		if(!forcedAll && !this.itemType && this.editMode) // Nothing found?
			this.defineItem(e, sets, true); // Try again with disabled types.
	},

	getImg: function(it) {
		var itln = it.localName.toLowerCase();
		if(itln == "_moz_generated_content_before") { // Alt-text
			it = it.parentNode;
			itln = it.localName.toLowerCase();
		}
		if(
			(
				(itln == "img" || itln == "image") && it.hasAttribute("src")
				|| it instanceof HTMLCanvasElement
			)
			&& !this.ut.isChromeDoc(it.ownerDocument) // Not for interface...
			&& ( // Speed Dial has own settings for right clicks
				it.ownerDocument.documentURI != "chrome://speeddial/content/speeddial.xul"
				|| !/(?:^|\s)speeddial-container(?:\s|$)/.test(it.parentNode.className)
				|| this.pu.pref("types.images.SpeedDial")
			)
			// InFormEnter https://addons.mozilla.org/addon/informenter/
			&& (it.src || "").substr(0, 32) != "chrome://informenter/skin/marker"
		)
			return it;
		return null;
	},
	getLink: function(it) {
		if(
			it.namespaceURI == this.ut.XULNS
			&& this.inObject(it, "href") && (it.href || it.hasAttribute("href"))
			//&& this.ut.unwrap(it).accessibleType == Components.interfaces.nsIAccessibleProvider.XULLink
			&& (
				typeof it.open == "function" // Comes from chrome://global/content/bindings/text.xml#text-link binding
				|| it.wrappedJSObject && typeof it.wrappedJSObject.open == "function"
			)
		)
			return it;

		if(this.getCSSEditorURI(it) || this.getWebConsoleURI(it))
			return it;

		const docNode = Node.DOCUMENT_NODE; // 9
		const eltNode = Node.ELEMENT_NODE; // 1
		for(it = it; it && it.nodeType != docNode; it = it.parentNode) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=266932
			// https://bug266932.bugzilla.mozilla.org/attachment.cgi?id=206815
			// It's strange to see another link in Status Bar
			// and other browsers (Opera, Safari, Google Chrome) will open "top level" link.
			// And IE... IE won't open XML (it's important!) testcase. :D
			// Also this seems like bug of left-click handler.
			// So, let's open link, which user see in Status Bar.
			if(
				(
					it instanceof HTMLAnchorElement
					|| it instanceof HTMLAreaElement
					|| it instanceof HTMLLinkElement
				)
				&& (
					it.hasAttribute("href")
					|| this.ut.getProperty(it, "repObject", "href") // Firebug
				)
				|| it.nodeType == eltNode && it.hasAttributeNS("http://www.w3.org/1999/xlink", "href")
			)
				return it;
		}
		return null;
	},
	getHistoryItem: function(it, e) {
		if(it.namespaceURI != this.ut.XULNS)
			return null;
		var itln = it.localName.toLowerCase();
		if(
			(
				this.hasParent(it, "goPopup")
				|| itln == "treechildren" && (it.parentNode.id || "").toLowerCase().indexOf("history") != -1 // Sidebar
			)
			&& this.getBookmarkURI(it, e)
		)
			return it;
		return null;
	},
	getBookmarkItem: function(it, e) {
		if(it.namespaceURI != this.ut.XULNS)
			return null;
		var itln = it.localName.toLowerCase();
		if(
			!("type" in it && it.type == "menu")
			&& (
				(
					/(?:^|\s)bookmark-item(?:\s|$)/.test(it.className)
					&& (itln == "toolbarbutton" || itln == "menuitem")
				)
				|| itln == "menuitem" && it.hasAttribute("siteURI")
				|| itln == "treechildren" && (it.parentNode.id || "").toLowerCase().indexOf("bookmark") != -1 // Sidebar
			)
			&& !this.hasParent(it, "goPopup")
			&& this.getBookmarkURI(it, e)
		)
			return it;
		return null;
	},
	getTab: function(it, excludeCloseButton) {
		if(it.namespaceURI != this.ut.XULNS)
			return null;
		if(excludeCloseButton && it.localName.toLowerCase() == "toolbarbutton")
			return null;
		const docNode = Node.DOCUMENT_NODE; // 9
		for(; it && it.nodeType != docNode; it = it.parentNode) {
			if(
				it.localName.toLowerCase() == "tab"
				&& (
					/(?:^|\s)tabbrowser-tab(?:\s|$)/.test(it.className)
					|| /(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(it.parentNode.className) // >1 tab in Firefox 1.5
				)
			)
				return it;
		}
		return null;
	},
	getTabbar: function(it) {
		if(it.namespaceURI != this.ut.XULNS)
			return null;
		var itln = it.localName.toLowerCase();
		if(itln == "toolbarbutton")
			return null;
		if(itln == "toolbarspacer") { // <toolbarspacer/><tabs/><toolbarspacer/> in Firefox 4
			var tabsId = "tabbrowser-tabs";
			for(var tabs = it.nextSibling; tabs; tabs = tabs.nextSibling) {
				if(tabs.id == tabsId)
					return tabs;
				if(tabs.localName != "toolbarspacer")
					break;
			}
			for(var tabs = it.previousSibling; tabs; tabs = tabs.previousSibling) {
				if(tabs.id == tabsId)
					return tabs;
				if(tabs.localName != "toolbarspacer")
					break;
			}
			return null;
		}
		if(
			/(?:^|\s)treestyletab-toolbar-inner-box(?:\s|$)/.test(it.className)
			&& it.parentNode.id == "TabsToolbar"
		)
			return it.parentNode.getElementsByAttribute("id", "tabbrowser-tabs")[0];
		const docNode = Node.DOCUMENT_NODE; // 9
		for(; it && it.nodeType != docNode; it = it.parentNode) {
			itln = it.localName.toLowerCase();
			if(itln == "tab" || itln == "toolbarbutton")
				return null;
			if(/(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(it.className))
				return it;
		}
		return null;
	},
	getSubmitButton: function(it) {
		var itln = it.localName.toLowerCase();
		if(itln == "input" && it.type == "submit" && this.inObject(it, "form") && it.form)
			return it;
		const docNode = Node.DOCUMENT_NODE; // 9
		for(; it && it.nodeType != docNode; it = it.parentNode)
			if(it.localName.toLowerCase() == "button" && this.inObject(it, "form") && it.form)
				return it;
		return null;
	},

	inObject: function(o, p) {
		// this.ut._log("inObject(): " + ("wrappedJSObject" in o) + " " + o.wrappedJSObject);
		// Open chrome://global/content/console.xul in tab
		// and click on <xul:label class="text-link" />
		//   "wrappedJSObject" in o => false
		//   o.wrappedJSObject      => [object XULElement]

		//return p in o || o.wrappedJSObject && p in o.wrappedJSObject;
		return p in o || p in this.ut.unwrap(o);
	},
	itemTypeInSets: function(sets, iType) {
		return sets.hasOwnProperty(iType) && this.isOkFuncObj(sets[iType]);
	},
	isOkFuncObj: function(fObj) {
		return this.ps.isOkFuncObj(fObj) && fObj.enabled;
	},
	hasParent: function(it, pId) {
		for(it = it.parentNode; it && "id" in it; it = it.parentNode)
			if(it.id == pId)
				return true;
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

		if(!this.ps.initCustomType(type))
			return null;
		var ct = this.ps.types[type];
		var _cm = ct._contextMenu;
		if(_cm) {
			try {
				cm = _cm.call(this.fn, e, this.item, this.origItem);
			}
			catch(e) {
				var eLine = this.ut.mmLine(this.ut.getProperty(e, "lineNumber") - ct._contextMenuLine + 1);
				var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + this.itemType + "/"
					+ this.ct.EDITOR_TYPE_CONTEXT
					+ "?line=" + eLine;
				var eMsg = this.ut.errInfo("customTypeContextMenuError", this.ps.dec(ct.label), this.itemType, e);
				this.ut.notify(
					eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
					this.ut.getLocalized("errorTitle"),
					this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
					this.ut.NOTIFY_ICON_ERROR
				);
				this.ut._err(eMsg, href, eLine);
				this.ut._err(e);
			}
			if(cm === "auto")
				cm = this.getContextMenu();
		}

		if(this.ut.isObject(cm) && typeof cm.hidePopup != "function") {
			// XUL document with custom context...
			this.ut._warn('getItemContext: context menu has no "hidePopup" method, id: "' + cm.id + '"');
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

		if(this.itemType == "tab" || this.itemType == "ext_mulipletabs" || this.getTab(node)) {
			// Tab Scope ( https://addons.mozilla.org/firefox/addon/4882 )
			// mousedown -> ...delay... -> this popup -> Tab Scope popup hide this popup
			var tabscope = this.$("tabscopePopup");
			if(tabscope) {
				var _openPopup = tabscope.openPopup;
				tabscope.openPopup = function() {};
				setTimeout(
					function() {
						tabscope.openPopup = _openPopup;
					},
					this.pu.getPref("extensions.tabscope.popup_delay") || 250
				);
				tabscope.hidePopup();
			}
		}

		if(!popup)
			popup = this.getItemContext();

		if(!popup || (this.ut.fxVersion == 2 && popup.id == "contentAreaContextMenu")) {
			// Some strange things happens in Firefox 2 for "contentAreaContextMenu"... Spellchecker bug?
			this.flags.stopContextMenu = false;
			this.createMouseEvents(this._xy, node, ["mousedown", "mouseup", "contextmenu"], 2)();
			return;
		}

		//popup = popup || this._cMenu;
		e = e || this.event;
		//~ following is only for Firefox < 4.0 (see https://bugzilla.mozilla.org/show_bug.cgi?id=383930)
		document.popupNode = popup.ownerDocument.popupNode = this.itemType == "tab" ? this.item : node;

		//var isContext = e.button == 2;
		var xy = this.getXY(e);
		this.flags.allowPopupshowing = true;
		if("openPopupAtScreen" in popup) // Firefox 3.0+
			popup.openPopupAtScreen(xy.x, xy.y, true /*isContextMenu*/);
		else
			popup.showPopup(this.ut.fxVersion >= 3 ? node : e.target, xy.x, xy.y, "context", null, null);
		this.flags.allowPopupshowing = false;
		this.focusOnItem();
	},
	_xy: {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		__proto__: null
	},
	saveXY: function(e) {
		var o = this._xy;
		for(var p in o)
			o[p] = e[p];
	},
	getXY: function(e) {
		e = e || this._xy;
		return this.ut.fxVersion >= 3
			? { x: e.screenX, y: e.screenY }
			: { x: e.clientX, y: e.clientY };
	},

	// Utils:
	getTabBrowser: function(tabsRequired) {
		return "SplitBrowser" in window && !(tabsRequired && "TM_init" in window) // Tab Mix Plus
			? SplitBrowser.activeBrowser
			: window.gBrowser || getBrowser();
	},
	closeMenus: function(it) {
		this.ut.closeMenus(it || this.item);
	},
	uri: function(uri) {
		return /^[\w-]+:\S*$/.test(uri) && uri;
	},
	getCSSEditorURI: function(it) {
		if(!this.pu.pref("types.links.CSSEditor"))
			return null;
		var docURI = it.ownerDocument.documentURI;
		// Rules tab
		if(
			docURI == "chrome://browser/content/devtools/cssruleview.xul"
			|| docURI == "chrome://browser/content/devtools/cssruleview.xhtml" // Firefox 22+
		) {
			if(it.localName == "label")
				it = it.parentNode;
			return it.classList
				&& it.classList.contains("ruleview-rule-source")
				&& this.ut.getProperty(it, "parentNode", "_ruleEditor", "rule", "sheet", "href");
		}
		// Computed tab
		if(
			docURI == "chrome://browser/content/devtools/csshtmltree.xul"
			|| docURI == "chrome://browser/content/devtools/computedview.xhtml" // Firefox 22+
		) {
			return it instanceof HTMLAnchorElement
				&& !it.href
				&& !it.getAttribute("href")
				&& it.classList
				&& it.classList.contains("link")
				&& it.parentNode.classList.contains("rule-link")
				&& this.uri(it.title);
		}
		return null;
	},
	getWebConsoleURI: function(it) {
		return it.namespaceURI == this.XULNS
			&& it.classList
			&& it.classList.contains("webconsole-location")
			&& it.classList.contains("text-link")
			&& (it.parentNode.id || "").substr(0, 12) == "console-msg-"
			&& this.uri(it.getAttribute("title"));
	},
	getBookmarkURI:	function(it, e, usePlacesURIs) {
		var ln = it.localName;
		var uri = ln && ln.toLowerCase() == "treechildren"
			? this.getTreeInfo(it, e, "uri")
			: it.statusText
				|| it._placesNode && it._placesNode.uri // Firefox 3.7a5pre+
				|| it.node && it.node.uri
				|| it.getAttribute("siteURI")
				|| "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTreeInfo: function(treechildren, e, prop) { // "uri" or "title"
		if(!("PlacesUtils" in window)) // For Firefox 3.0+
			return "";
		var tree = (treechildren || this.item).parentNode;
		e = e || this.event;

		// Based on code of Places' Tooltips ( https://addons.mozilla.org/firefox/addon/7314 )
		var row = {}, column = {}, cell = {};
		tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, column, cell);
		if(row.value == -1)
			return "";
		var view = tree.view;
		if(!("nodeForTreeIndex" in view))
			return "";
		var node = view.nodeForTreeIndex(row.value);
		return PlacesUtils.nodeIsURI(node)
			? node[prop]
			: "";
	},
	createMouseEvents: function(origEvt, item, evtTypes, opts) {
		if(typeof opts == "number")
			opts = { button: opts };
		var evts = evtTypes.map(function(evtType) {
			return this.createMouseEvent(origEvt, item, evtType, opts);
		}, this);
		var _this = this;
		return function() {
			_this._enabled = false;
			evts.forEach(function(evt) {
				item.dispatchEvent(evt);
			});
			_this._enabled = true;
		};
	},
	createMouseEvent: function(origEvt, item, evtType, opts) {
		item = item || origEvt.originalTarget;
		var doc = item.ownerDocument;
		var win = doc.defaultView;
		if(typeof win.MouseEvent == "function") { // Firefox 11+
			var evt = new win.MouseEvent(evtType, {
				bubbles: true,
				cancelable: true,
				view: win,
				detail: 1,
				screenX: origEvt.screenX,
				screenY: origEvt.screenY,
				clientX: origEvt.clientX,
				clientY: origEvt.clientY,
				ctrlKey:  opts.ctrlKey  || false,
				altKey:   opts.altKey   || false,
				shiftKey: opts.shiftKey || false,
				metaKey:  opts.metaKey  || false,
				button:   opts.button   || 0,
				relatedTarget: null
			});
		}
		else {
			var evt = doc.createEvent("MouseEvents");
			evt.initMouseEvent( // https://developer.mozilla.org/en/DOM/event.initMouseEvent
				evtType, true /* canBubble */, true /* cancelable */, win, 1,
				origEvt.screenX, origEvt.screenY, origEvt.clientX, origEvt.clientY,
				opts.ctrlKey || false, opts.altKey || false, opts.shiftKey || false, opts.metaKey || false,
				opts.button || 0, null
			);
		}
		return evt;
	},
	focusOnItem: function(forced, it) {
		if(!forced && !this.pu.pref("focusOnItems"))
			return;
		it = it || this.mainItem || this.item;
		if(
			!this.ut.isObject(it)
			|| document.commandDispatcher.focusedElement === it // Already focused
			|| !("focus" in it) // typeof it.focus == "function"
			|| it.ownerDocument.defaultView.getComputedStyle(it, null).MozUserFocus == "ignore"
		)
			return;
		try {
			it.focus();
		}
		catch(e) {
			this.ut._err(e);
		}
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
			for(; node && node.nodeType != docNode; node = node.parentNode) {
				if(node.hasAttribute("context")) {
					id = node.getAttribute("context");
					doc = node.ownerDocument;
					break;
				}
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
				for(var i = 0, len = browsers.length; i < len; ++i) {
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
			|| this.flags.cancelled
			|| (!this.editMode && e.type != funcObj.eventType)
			|| !this.itemType // (!this.editMode && !this.itemType)
		) {
			//this.editMode = false;
			return;
		}
		this.flags.runned = true;
		this.flags.stopContextMenu = true;

		this.ut.stopEvent(e); // this stop "contextmenu" event in Windows

		if(this.editMode) {
			this.editMode = false;
			this.ui.blinkNode();
			this.closeMenus(e.originalTarget);
			//this.wu.openEditor(null, this.ct.EDITOR_MODE_SHORTCUT, this.ps.getEvtStr(e), this._all ? "$all" : this.itemType);
			this.ut.timeout( // Wait for blinkNode redraw
				this.wu.openEditor,
				this.wu,
				[null, this.ct.EDITOR_MODE_SHORTCUT, this.ps.getEvtStr(e), this._all ? "$all" : this.itemType]
			);
			return;
		}
		this.executeFunction(funcObj, e);
	},
	executeDelayedAction: function(da) {
		if(this.flags.runned || this.flags.cancelled)
			return;
		this.flags.runned = true;
		if(da)
			this.executeFunction(da);
		else
			this.showPopupOnItem();
		this.ui.restoreIcon();
	},
	executeFunction: function(funcObj, e) {
		this.cancelDelayedAction();
		this.setMoveHandlers(false);

		this.lastEvent = this.event;
		this.lastItemType = this.itemType;
		this.lastAll = this._all;
		this.isDeleyed = !e;

		var action = funcObj.action;
		if(funcObj.custom) {
			action = this.ps.dec(action);
			try {
				var line = new Error().lineNumber + 1;
				new Function("event,item,origItem", action).call(this.fn, e || this.event, this.item, this.origItem);
			}
			catch(err) {
				var eLine = this.ut.mmLine(this.ut.getProperty(err, "lineNumber") - line + 1);
				var href = this.getEditorLink(e) + "?line=" + eLine;
				var eMsg = this.ut.errInfo("customFunctionError", this.ps.dec(funcObj.label), this.itemType, err);
				this.ut.notify(
					eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
					this.ut.getLocalized("errorTitle"),
					this.ut.toErrorConsole, this.wu.getOpenEditorLink(href, eLine),
					this.ut.NOTIFY_ICON_ERROR
				);
				this.ut._err(eMsg, href, eLine);
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
				try {
					fnc.apply(this.fn, args);
				}
				catch(err) {
					var href = this.getEditorLink(e);
					var securityError = /Load of \S* from \S* denied\./.test(err);
					var eMsg = securityError
						? this.ut.getLocalized("securityError")
							.replace("%u", this.fn.getItemURI())
							.replace("%s", this.item.ownerDocument.documentURI)
						: this.ut.getLocalized("errorInBuiltInFunction").replace("%f", action);
					this.ut.notify(
						eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
						this.ut.getLocalized(securityError ? "warningTitle" : "errorTitle"),
						this.ut.toErrorConsole, this.wu.getOpenEditorLink(href),
						securityError ? this.ut.NOTIFY_ICON_WARNING : this.ut.NOTIFY_ICON_ERROR
					);
					this.ut._err(eMsg);
					this.ut._err(err);
				}
			}
			else {
				var href = this.getEditorLink(e);
				var eMsg = this.ut.getLocalized("functionNotFound").replace("%f", action);
				this.ut.notify(
					eMsg + this.ut.getLocalized("openConsole") + this.ut.getLocalized("openEditor"),
					this.ut.getLocalized("warningTitle"),
					this.ut.toErrorConsole, this.wu.getOpenEditorLink(href),
					this.ut.NOTIFY_ICON_WARNING
				);
				this.ut._err(eMsg, href); // We can't use _warn() with custom file name
				this.ut._warn('Function "' + action + '" not found (' + typeof this.fn[action] + ")");
			}
		}

		this.focusOnItem();

		if(this._devMode) {
			var eStr = this.ps.getEvtStr(e || this.event);
			this.ut._log(
				(e ? e.type : "delayedAction")
				+ " -> " + this.ps.getModifiersStr(eStr) + " + " + this.ps.getButtonStr(eStr, true)
				+ "\n=> executeFunction()"
				+ "\nnodeName = " + (this.origItem ? this.origItem.nodeName : "?")
				+ ", itemType = " + this.itemType
				+ "\n=> " + (funcObj.custom ? (this.ps.dec(funcObj.label) || action.substr(0, 100)) : funcObj.action)
			);
		}
	},
	getEditorLink: function(e) {
		return this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_SHORTCUT + "/"
			+ this.ps.getEvtStr(e || this.event) + "/"
			+ (this._all ? "$all" : this.itemType) + "/"
			+ (this.isDeleyed ? this.ct.EDITOR_SHORTCUT_DELAYED : this.ct.EDITOR_SHORTCUT_NORMAL) + "/"
			+ this.ct.EDITOR_SHORTCUT_CODE;
	}
};
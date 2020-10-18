var handyClicks = {
	__proto__: handyClicksGlobals,

	ignoreAction: "$ignore",

	event: null, // event object, that triggered action
	origItem: null, // event.originalTarget
	item: null, // detected item (e.g. XUL tab)
	mainItem: null, // clicked item for multiple items (e.g. selected tabs)
	handledItem: null, // API for another extensions to detect that item was handled by Handy Clicks
	itemType: undefined, // name of item type (e.g. "tab")
	itemData: null, // special item-specific data (object), currently used only itemData.onBeforeLoad
	settingsType: "", // event type to run action (from options)
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

	destroy: function(reloadFlag) {
		this.initListeners(false);
		this.cancelDelayedAction();
		if(this.editMode)
			this.editMode = false;
		this.setMoveHandlers(null);
		this.cleanup();
	},
	cleanup: function() {
		this.itemType = undefined;
		this.event = this.origItem = this.item = this.mainItem = this.handledItem = this.itemData = null;
	},
	_forceCleanupTimer: 0,
	forceCleanup: function() {
		if(this._forceCleanupTimer) {
			clearTimeout(this._forceCleanupTimer);
			this._forceCleanupTimer = 0;
		}
		this.handledItem = null;
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
			case "focus":        this.focusHandler(e);        break;
			case "blur":         this.blurHandler(e);         break;
			case "keypress":
				if(e.keyCode != e.DOM_VK_ESCAPE)
					break;
				this.ut.stopEvent(e);
				this.editMode = false; // this removes event listener
		}
	},
	_settingsLoaded: false,
	_settingsLoadTimer: 0,
	preloadSettings: function() {
		if(this._settingsLoadTimer || this._settingsLoaded)
			return;
		this._settingsLoadTimer = this.delay(function() {
			this._settingsLoadTimer = 0;
			if(!this.enabled) {
				this._log("Preload settings: disabled => do nothing");
				return;
			}
			this._settingsLoaded = true;
			this._log("Preload settings => loadSettingsAsync()");
			this.ps.loadSettingsAsync(function() {
				this._settingsLoaded = this.ps.loaded;
			}, this);
		}, this, 150);
	},
	_hasListeners: false,
	initListeners: function(enable) {
		if(enable == this._hasListeners)
			return;
		this._hasListeners = enable;
		this.setListeners(["mousedown", "click", "command", "mouseup", "dblclick", "contextmenu", "popupshowing"], enable);
		if(!enable || this.storage.get("activeLinkedFiles"))
			this.watchLinkedFiles(enable);
		this._log("initListeners(" + enable + ")");
	},
	setListeners: function(evtTypes, add) {
		var act = add ? addEventListener : removeEventListener;
		evtTypes.forEach(function(evtType) {
			act.call(window, evtType, this, true);
		}, this);
	},

	watchLinkedFiles: function(watch) {
		this._log("Browser: watchLinkedFiles(" + watch + ")");
		var act = watch ? addEventListener : removeEventListener;
		act.call(window, "focus", this, true);
		window.removeEventListener("blur", this, true);
		if(this._blurHandlerTimer) {
			clearTimeout(this._blurHandlerTimer);
			this._blurHandlerTimer = 0;
		}
	},
	_focusHandlerTimer: 0,
	focusHandler: function(e) {
		// Note: will be also handled any focus inside browser window
		if(!this._focusHandlerTimer)
			this._focusHandlerTimer = this.delay(this.checkLinkedFiles, this, 20);
	},
	checkLinkedFiles: function() {
		this._focusHandlerTimer = 0;
		this.watchLinkedFiles(false);
		var alf = this.storage.get("activeLinkedFiles");
		if(!alf)
			return;
		var unchanged = true;
		for(var path in alf) {
			var fd = alf[path];
			var file = this.ut.getLocalFileFromPath(fd.path);
			if(!file.exists()) {
				this._log("focusHandler() -> file was removed " + path);
				delete alf[path];
				continue;
			}
			var lastModified = file.lastModifiedTime;
			var size = file.fileSize;
			this._log("focusHandler() -> check file " + path);
			if(lastModified != fd.lastModified || size != fd.size) {
				fd.lastModified = lastModified;
				fd.size = size;
				unchanged = false;
				this.ps.reinitSettingsInBrowsers();
				break;
			}
		}
		if(!this.ju.isEmptyObj(alf))
			window.addEventListener("blur", this, true);
		else {
			this._log("focusHandler() -> nothing to watch, remove storage");
			this.storage.set("activeLinkedFiles", undefined);
		}
		unchanged && this._log("focusHandler() -> linked files not changed");
	},
	_blurHandlerTimer: 0,
	blurHandler: function(e) {
		if(!this._blurHandlerTimer)
			this._blurHandlerTimer = this.delay(this.checkFocusedWindow, this, 20);
	},
	checkFocusedWindow: function() {
		this._blurHandlerTimer = 0;
		if(this.wu.ww.activeWindow != window) {
			window.removeEventListener("blur", this, true);
			window.addEventListener("focus", this, true);
			this._log("blurHandler() -> focused another window, will wait for focus");
		}
	},

	_enabled: true, // Uses for internal disabling
	get enabled() {
		return this._enabled && this.pu.get("enabled");
	},
	set enabled(on) {
		this.pu.set("enabled", on);
	},

	_editMode: false,
	enabledForEditMode: false,
	get editMode() {
		return this._editMode;
	},
	set editMode(em) {
		this._editMode = em;
		this.setListeners(["keypress"], em);
		this.ui.setEditModeStatus(em);
		if(!em && this.enabledForEditMode) this.delay(function() {
			this.enabled = this.enabledForEditMode = false;
		}, this);
	},

	// Handlers:
	mousedownPos: { __proto__: null },
	mousedownHandler: function(e) {
		if(!this.enabled)
			return;

		this.saveXY(e);
		this.resetFlags();
		this.forceCleanup();
		var funcObj = this.getFuncObjByEvt(e);
		if(!funcObj)
			return;

		var mdPos = this.mousedownPos;
		mdPos.screenX = e.screenX;
		mdPos.screenY = e.screenY;

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
			var trg = e.originalTarget;
			if(trg.namespaceURI == this.XULNS) {
				var ln = trg.localName;
				emAllowEvent = this.flags.allowEditModeEvents = ln == "scrollbarbutton" || ln == "slider";
				if(e.button == 0 && this.isMenu(trg)) {
					this.flags.allowPopupshowing = true;
					if(this.fxVersion >= 3.6) {
						trg.open = true; // Open <menu>, <toolbarbutton type="menu">, etc.
						this.flags.allowPopupshowing = false;
					}
					else {
						this.delay(function() {
							this.flags.allowPopupshowing = false;
						}, this);
					}
				}
			}
		}

		var amd = this.ju.getOwnProperty(funcObj, "allowMousedownEvent");
		// true      - don't stop
		// undefined - smart
		// false     - always stop
		if(amd === false || em && !emAllowEvent)
			this.ut.stopEvent(e);
		else if(amd === undefined && !this.ut.isChromeWin(e.view.top)) {
			// Prevent page handlers, but don't stop Mouse Gestures
			var root = e.view.top === content ? gBrowser.selectedBrowser : e.view.top;
			var _this = this;
			root.addEventListener("mousedown", function stopMousedown(e) {
				root.removeEventListener("mousedown", stopMousedown, true);
				if(_this._enabled)
					_this.ut.stopEvent(e);
			}, true);
		}

		var delay = this.pu.get("delayedActionTimeout");
		if(delay > 0 && !em) {
			var delayedAction = this.ju.getOwnProperty(funcObj, "delayedAction");
			if(
				delayedAction
					? this.isOkFuncObj(delayedAction)
					: e.button == 2 // Will show context menu
			) {
				this.cancelDelayedAction(); // Only one timeout... (for dblclick event)
				this.daTimeout = this.delay(this.executeDelayedAction, this, delay, [delayedAction, e]);
			}
		}

		this.setMoveHandlers(e);
	},
	clickHandler: function(e) {
		if(!this.enabled)
			return;
		// Note: also stops "contextmenu" event on Windows and "command" event
		this.checkForStopEvent(e);
		if(this.flags.allowEvents)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		if(funcObj)
			this.functionEvent(funcObj, e);
		else if(this.editMode && !this.isMenu(e.originalTarget))
			this.ui.notifyEditMode(true);
	},
	mouseupHandler: function(e) {
		if(!this.enabled)
			return;
		// Note: also stops "command" event
		//if(this.settingsType != "command")
		this.checkForStopEvent(e);
		if(this.flags.allowEvents)
			this.cancelDelayedAction();
		var trg = e.originalTarget;
		if(
			this.item
			&& trg != this.origItem
			// Workaround for Multi Links https://addons.mozilla.org/addon/multi-links/
			&& trg.id == "multilinks-selection-container"
			&& "MultiLinks_Wrapper" in window
			&& this.item.localName.toLowerCase() == "a" // Multi Links supports only <a> links
			// If mouse was moved, Multi Links will open that link itself
			&& this.mousedownPos.screenX == e.screenX
			&& this.mousedownPos.screenY == e.screenY
			&& (!this.mousemoveParams || !this.mousemoveParams.dist)
		) {
			this._log(e.type + ": workaround for Multi Links");
			// Too many tricks...
			var mdEvent = this.event;
			var fakeEvent = {
				type: "click",
				target:         mdEvent.target,
				originalTarget: mdEvent.originalTarget,
				__proto__: e
			};
			var noop = function() {};
			for(var p in e) {
				if( // Don't stop "mouseup" event to not break Multi Links
					p == "preventDefault"
					|| p == "stopPropagation"
					|| p == "stopImmediatePropagation"
				) {
					fakeEvent[p] = noop;
					continue;
				}
				var v = e[p];
				if(typeof v == "function") {
					fakeEvent[p] = (function(v) {
						return function() {
							return v.apply(e, arguments);
						};
					})(v);
				}
			}
			this.clickHandler(fakeEvent);
		}
		this.setMoveHandlers(null);
		this.saveXY(e);

		this.ui.restoreIcon();

		this.delay(function() {
			this.flags.stopContextMenu = false;
		}, this);
		this._forceCleanupTimer = this.delay(this.forceCleanup, this, 500);
	},
	commandHandler: function(e) {
		if(!this.enabled)
			return;
		this.checkForStopEvent(e);
		var funcObj = this.getFuncObjByEvt(e);
		funcObj && this.functionEvent(funcObj, e);
	},
	dblclickHandler: function(e) {
		if(!this.enabled)
			return;
		if(this.flags.allowEvents)
			return;
		var funcObj = this.getFuncObjByEvt(e);
		funcObj && this.functionEvent(funcObj, e);
	},

	isMenu: function(node) {
		return node.namespaceURI == this.XULNS
			// See https://github.com/Infocatcher/Handy_Clicks/issues/31
			//&& node.boxObject
			//&& node.boxObject instanceof Components.interfaces.nsIMenuBoxObject;
			&& "open" in node
			&& Array.prototype.some.call(
				node.getElementsByTagNameNS(this.XULNS, "menupopup"),
				function(mp) {
					return mp.parentNode == node;
				}
			);
	},

	// Special handlers:
	contextmenuHandler: function(e) {
		if(this.enabled && this.flags.stopContextMenu)
			this.ut.stopEvent(e);
	},
	popupshowingHandler: function(e) {
		// Force prevent any popup
		// For RightToClick extension https://addons.mozilla.org/firefox/addon/righttoclick/
		if(this.enabled && this.flags.stopContextMenu && !this.flags.allowPopupshowing) {
			var ln = e.target.localName;
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
		if(this.mousemoveParams.dist < this.pu.get("disallowMousemoveDist"))
			return;

		this._log("mousemoveHandler -> cancel()");
		this.cancel();
	},
	dragHandler: function(e) {
		if(!this.disallowMousemove)
			return;
		this._log("dragHandler -> cancel()");
		this.cancel();
	},
	tabSelectHandler: function(e) {
		this._log("tabSelectHandler -> cancel()");
		this.cancel();
	},
	wheelHandler: function() {
		this._log("wheelHandler -> cancel()");
		this.cancel();
	},
	cancel: function() {
		this.flags.cancelled = true;
		this.flags.stopContextMenu = false;

		this.cancelDelayedAction();
		this.setMoveHandlers(null);

		this.ui.restoreIcon();
	},
	setMoveHandlers: function(e) {
		var add = !!e;
		if(add == this._hasMoveHandlers)
			return;
		this._hasMoveHandlers = add;
		if(e) {
			var dist = this.disallowMousemoveDist = this.pu.get("disallowMousemoveDist");
			this.disallowMousemove = dist >= 0
				&& this.pu.get("disallowMousemoveButtons").indexOf(e.button) != -1;
			this.mousemoveParams = {
				dist: 0,
				screenX: e.screenX,
				screenY: e.screenY,
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
		var trg = e.originalTarget;
		var same = trg === this.origItem;
		if(
			same
			&& this.settingsType == "command"
			&& (e.type == "click" || e.type == "mouseup")
		)
			return;
		var stop = canStop && same;
		var isMouseup = e.type == "mouseup";
		if(stop && isMouseup)
			_cs.time = Date.now();
		if(
			e.type == "command"
				? stop && !this.isMenu(trg) || (
					canStop
					&& trg.localName == "command"
					&& _cs.hasOwnProperty("time")
					&& Date.now() - _cs.time < 100
				)
				: stop
		) {
			if(isMouseup && e.view.top === content) { // Prevent page handlers, but don't stop FireGestures extension
				var br = gBrowser.selectedBrowser;
				var _this = this;
				br.addEventListener("mouseup", function _mu(e) {
					br.removeEventListener("mouseup", _mu, true);
					if(_this._enabled)
						_this.ut.stopEvent(e);
				}, true);
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
		if(this.daTimeout) {
			clearTimeout(this.daTimeout);
			this.daTimeout = 0;
		}
	},

	// Settings service:
	getFuncObjByEvt: function(e) {
		if(!this._settingsLoaded) {
			clearTimeout(this._settingsLoadTimer);
			this._log(e.type + " => loadSettings()");
			this.ps.loadSettings();
			this._settingsLoaded = this.ps.loaded;
		}
		this.hasSettings = false;
		this.settingsType = "";
		var evtStr = this.ps.getEvtStr(e);
		var isMousedown = e.type == "mousedown";
		if(isMousedown)
			this.evtStrOnMousedown = evtStr;
		else if(!this.item && e.type != "command") // mousedown, scroll => switch to another tab => mouseup, click
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
			this.itemType && this._log("[" + e.type + "] " + "type: " + this.itemType);
		}
		var funcObj = this.getFuncObj(sets) || this.editMode && { action: null };
		if(funcObj) {
			if(!this.editMode && this.isBlacklisted(e)) {
				var pref = this.pu.prefNS + "blacklist." + e.button;
				var url = e.view.location.href.substr(0, 100);
				this._log("[" + e.type + "] blacklisted site (" + pref + "):\n" + url);
				return null;
			}
			this.hasSettings = true;
			this.settingsType = funcObj.eventType || "";
			this.event = e;
			//this.saveXY(e); // Saves incorrect coordinates...
			this.origItem = e.originalTarget;
		}
		else {
			this.event = this.origItem = null;
		}
		return funcObj;
	},
	getSettings: function(str) {
		return this.ps.prefs.hasOwnProperty(str)
			? this.ps.prefs[str]
			: this.editMode ? {} : null;
	},

	checkOtherTypes: false,
	get ignoreOtherTypes() { //= Added: 2010-06-21
		return !this.checkOtherTypes;
	},
	set ignoreOtherTypes(val) {
		this.ut._deprecated('Flag "ignoreOtherTypes" is deprecated. Use "checkOtherTypes" instead.');
		this.checkOtherTypes = !val;
	},
	defineItem: function(e, sets, forcedAll) {
		this._all = this.itemTypeInSets(sets, "$all");
		var all = forcedAll || this._all;
		this.itemType = undefined; // "link", "img", "bookmark", "historyItem", "tab", "ext_mulipletabs", "submitButton"
		this.item = this.mainItem = this.itemData = null;

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
				this.checkOtherTypes = false;
				this._currentType = type;
				try {
					_it = ct._define.call(this, e, it, type, ct._firstCall);
				}
				catch(e) {
					this.customTypeError(e, type);
				}
				this._currentType = undefined;
				ct._firstCall = false;
				if(!_it)
					continue;
				this.itemType = type;
				this.item = _it;
				if(!this.checkOtherTypes)
					return;
			}
		}

		var checkSimpleType = this.ju.bind(function(type, getter) {
			var _it = (all || this.itemTypeInSets(sets, type))
				&& getter.call(this, it, e);
			if(!_it)
				return false;
			this.itemType = type;
			this.item = _it;
			return true;
		}, this);

		// Image or link:
		if(all || this.itemTypeInSets(sets, "img")) {
			_it = this.getImg(it);
			if(
				_it && (
					!this.ju.getOwnProperty(sets, "img", "ignoreSingle")
					|| _it.ownerDocument.documentURI != _it.src
				)
			) {
				this.itemType = "img";
				this.item = _it;
				if(this.ju.getOwnProperty(sets, "img", "ignoreLinks"))
					return;
			}
		}
		if(checkSimpleType("link", this.getLink))
			return;
		if(this.itemType == "img")
			return;

		// Tab or selected tabs (Multiple Tab Handler extension):
		var mth = all || this.itemTypeInSets(sets, "ext_mulipletabs");
		var tab = all || this.itemTypeInSets(sets, "tab");
		if(mth || tab) {
			if(it.localName == "toolbarbutton") {
				var mthExc = mth && this.ju.getOwnProperty(sets, "ext_mulipletabs", "excludeCloseButton");
				var tabExc = tab && this.ju.getOwnProperty(sets, "tab",             "excludeCloseButton");
			}
			_it = !(mthExc && tabExc) && this.getTab(it);
			if(_it && mth && !mthExc && "MultipleTabService" in window && MultipleTabService.isSelected(_it)) {
				this.itemType = "ext_mulipletabs";
				this.item = MultipleTabService.getSelectedTabs(MultipleTabService.getTabBrowserFromChild(_it));
				this.mainItem = _it;
				return;
			}
			if(_it && tab && !tabExc) {
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
	customTypeError: function(e, type) {
		var ct = this.ps.types[type];
		var eLine = this.ut.getRealLineNumber(e, ct._defineLine);
		var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
			+ this.ct.EDITOR_TYPE_DEFINE
			+ "?line=" + eLine;
		var eMsg = this.ps.errInfo("customTypeDefineError", e, type);
		this.ut.notifyError(eMsg, { buttons: {
			$openEditor: this.wu.getOpenEditorLink(href, eLine),
			$openConsole: this.ut.toErrorConsole
		}});
		this.ut._err(eMsg, href, eLine);
		this.ut._err(e);
	},

	// For fn.getItemText()/getItemURI()
	_currentType: undefined,
	getText: { __proto__: null },
	getURI: { __proto__: null },
	_initializedTypes: { __proto__: null },
	initCustomType: function(opts) {
		var type = this._currentType;
		if(type in this._initializedTypes)
			return true; // For usage like return initCustomType() && detectedItem;
		this._initializedTypes[type] = true;
		if("getText" in opts)
			this.getText[type] = opts.getText;
		if("getURI" in opts)
			this.getURI[type] = opts.getURI;
		return true;
	},
	destroyCustomTypes: function() {
		this.getText = { __proto__: null };
		this.getURI = { __proto__: null };
		this._initializedTypes = { __proto__: null };
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
				|| it instanceof HTMLCanvasElement && this.pu.get("types.images.canvas")
			)
			&& !this.ut.isChromeDoc(it.ownerDocument) // Not for interface...
			&& ( // Speed Dial has own settings for right clicks
				it.ownerDocument.documentURI != "chrome://speeddial/content/speeddial.xul"
				|| !/(?:^|\s)speeddial-container(?:\s|$)/.test(it.parentNode.className)
				|| this.pu.get("types.images.SpeedDial")
			)
			// InFormEnter https://addons.mozilla.org/addon/informenter/
			&& (it.src || "").substr(0, 32) != "chrome://informenter/skin/marker"
		)
			return it;
		return null;
	},
	getLink: function(it) {
		if(
			it.namespaceURI == this.XULNS
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
		for(; it && it.nodeType != docNode; it = it.parentNode) {
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
					|| this.ju.getProperty(it, "repObject", "href") // Firebug
				)
				|| it.nodeType == eltNode && it.hasAttributeNS("http://www.w3.org/1999/xlink", "href")
			)
				return it;
		}
		return null;
	},
	getHistoryItem: function(it, e) {
		if(it.namespaceURI != this.XULNS)
			return null;
		if(
			(
				this.hasParent(it, "goPopup")
				|| it.localName == "treechildren" && this.isHistoryTree(it.parentNode)
			)
			&& this.getBookmarkURI(it, e)
		)
			return it;
		if(
			it.hasAttribute("targetURI")
			&& this.hasParent(it, "PanelUI-history")
		)
			return it;
		return null;
	},
	getBookmarkItem: function(it, e) {
		if(it.namespaceURI != this.XULNS)
			return null;
		var itln = it.localName;
		if(
			!("type" in it && it.type == "menu")
			&& (
				(
					/(?:^|\s)bookmark-item(?:\s|$)/.test(it.className)
					&& (itln == "toolbarbutton" || itln == "menuitem")
				)
				|| itln == "menuitem" && (it.hasAttribute("siteURI") || it.hasAttribute("targetURI"))
				|| itln == "treechildren" && (
					this.isBookmarkTree(it.parentNode)
					|| this.isFeedSidebar(it)
				)
			)
			&& !this.hasParent(it, "goPopup")
			&& this.getBookmarkURI(it, e)
		)
			return it;
		return null;
	},
	getTab: function(it, excludeCloseButton) {
		if(it.namespaceURI != this.XULNS)
			return null;
		if(excludeCloseButton && it.localName == "toolbarbutton")
			return null;
		const docNode = Node.DOCUMENT_NODE; // 9
		for(; it && it.nodeType != docNode; it = it.parentNode) {
			if(
				it.localName == "tab"
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
		if(it.namespaceURI != this.XULNS)
			return null;
		var itln = it.localName;
		if(itln == "toolbarbutton")
			return null;
		if(itln == "toolbarspacer") { // <toolbarspacer/><tabs/><toolbarspacer/> in Firefox 4+
			var tabsId = "tabbrowser-tabs";
			var siblingTabs = function(sibling) {
				for(var tabs = it; (tabs = tabs[sibling]); ) {
					if(tabs.id == tabsId)
						return tabs;
					if(tabs.localName != "toolbarspacer")
						break;
				}
				return null;
			};
			return siblingTabs("nextSibling") || siblingTabs("previousSibling");
		}
		if(
			(
				/(?:^|\s)treestyletab-toolbar-inner-box(?:\s|$)/.test(it.className)
				|| it.classList && it.classList.contains("titlebar-placeholder")
					&& /^(?:pre|post)-tabs$/.test(it.getAttribute("type"))
			)
			&& it.parentNode.id == "TabsToolbar"
		)
			return it.parentNode.getElementsByAttribute("id", "tabbrowser-tabs")[0];
		const docNode = Node.DOCUMENT_NODE; // 9
		for(; it && it.nodeType != docNode; it = it.parentNode) {
			itln = it.localName;
			if(itln == "tab" || itln == "toolbarbutton")
				return null;
			if(it.id == "tabbrowser-tabs" || /(?:^|\s)tabbrowser-tabs(?:\s|$)/.test(it.className))
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
		// this._log("inObject(): " + ("wrappedJSObject" in o) + " " + o.wrappedJSObject);
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
		for(; "id" in (it = it.parentNode); )
			if(it.id == pId)
				return true;
		return false;
	},
	isBookmarkTree: function(tree) {
		return this.isPlacesTree(tree)
			&& /[:&]folder=/.test(tree.getAttribute("place"));
	},
	isHistoryTree: function(tree) {
		if(!this.isPlacesTree(tree))
			return false;
		var place = tree.getAttribute("place");
		return !/[:&]folder=/.test(place) // Exclude bookmarks
			&& !/[:&]transition=7(?:&|$)/.test(place); // Exclude downloads
	},
	isPlacesTree: function(tree) {
		return tree.getAttribute("type") == "places";
	},
	getFuncObj: function(sets) {
		var type = this.itemType;
		return type && ( // see .defineItem()
			this.itemTypeInSets(sets, "$all") && sets.$all
			|| this.itemTypeInSets(sets, type) && sets[type]
		);
	},
	blacklists: [],
	isBlacklisted: function(e) {
		if(this.hasModifier(e))
			return false;
		var btn = e.button;
		var patterns = this.blacklists[btn]
			|| (this.blacklists[btn] = this.parsePatterns(this.pu.get("blacklist." + btn, "")));
		var curURI = e.view.location.href;
		for(var i = 0, l = patterns.length; i < l; ++i)
			if(patterns[i].test(curURI))
				return true;
		return false;
	},
	parsePatterns: function(data) {
		var patterns = [];
		for(var lines = data.split(/\s+/), i = 0, l = lines.length; i < l; ++i) {
			var str = this.ut.trim(lines[i]);
			if(/^\/(.+)\/(i?)$/.test(str)) {
				var pattern = RegExp.$1;
				var flags = RegExp.$2;
			}
			else {
				var pattern = "^" + str
					.replace(/[\\\/.^$+?|()\[\]{}]/g, "\\$&") // Escape special symbols
					.replace(/\*/g, ".*")
					+ "$";
				var flags = "i";
			}
			try {
				patterns.push(new RegExp(pattern, flags));
			}
			catch(e) {
				this.ut._err(
					"parsePatterns(): Invalid regular expression:\n"
					+ str + "\n-> " + pattern + "\n" + e
				);
			}
		}
		return patterns;
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
				cm = _cm.call(this.fn, e, this.item, this.origItem, type);
			}
			catch(e) {
				var eLine = this.ut.getRealLineNumber(e, ct._contextMenuLine);
				var href = this.ct.PROTOCOL_EDITOR + this.ct.EDITOR_MODE_TYPE + "/" + type + "/"
					+ this.ct.EDITOR_TYPE_CONTEXT
					+ "?line=" + eLine;
				var eMsg = this.ps.errInfo("customTypeContextMenuError", e, type);
				this.ut.notifyError(eMsg, { buttons: {
					$openEditor: this.wu.getOpenEditorLink(href, eLine),
					$openConsole: this.ut.toErrorConsole
				}});
				this.ut._err(eMsg, href, eLine);
				this.ut._err(e);
			}
		}

		if(this.ju.isObject(cm) && typeof cm.hidePopup != "function") {
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
			// Tab Scope https://addons.mozilla.org/firefox/addon/4882
			// mousedown -> ...delay... -> our popup -> Tab Scope popup hides our popup
			var tabscope = this.$("tabscopePopup");
			if(tabscope) {
				var _openPopup = tabscope.openPopup;
				tabscope.openPopup = function() {};
				setTimeout(function() {
					tabscope.openPopup = _openPopup;
				}, this.pu.getPref("extensions.tabscope.popup_delay") || 250);
				tabscope.hidePopup();
			}
		}

		if(!popup)
			popup = this.getItemContext();

		if(!popup || (this.fxVersion == 2 && popup.id == "contentAreaContextMenu")) {
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
			popup.showPopup(this.fxVersion >= 3 ? node : e.target, xy.x, xy.y, "context", null, null);
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
		return this.fxVersion >= 3
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
		if(!this.pu.get("types.links.CSSEditor"))
			return null;
		var docURI = it.ownerDocument.documentURI;
		// Rules tab
		if(
			docURI == "chrome://browser/content/devtools/cssruleview.xul"
			|| docURI == "chrome://browser/content/devtools/cssruleview.xhtml" // Firefox 22+
			|| docURI == "chrome://devtools/content/inspector/inspector.xul" // Firefox 48+
			|| docURI == "chrome://devtools/content/inspector/inspector.xhtml" // Firefox 52+
		) {
			if(
				it.localName == "label"
				|| it.localName == "span" // Firefox 52+
			)
				it = it.parentNode;
			var uri = it.classList
				&& it.classList.contains("ruleview-rule-source")
				&& this.ju.getProperty(it, "parentNode", "_ruleEditor", "rule", "sheet", "href");
			if(uri)
				return uri;
		}
		// Computed tab
		if(
			docURI == "chrome://browser/content/devtools/csshtmltree.xul"
			|| docURI == "chrome://browser/content/devtools/computedview.xhtml" // Firefox 22+
			|| docURI == "chrome://devtools/content/inspector/inspector.xul" // Firefox 48+
			|| docURI == "chrome://devtools/content/inspector/inspector.xhtml" // Firefox 52+
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
		var uri = it.localName == "treechildren"
			? this.getTreeInfo(it, e, "uri")
			: it.statusText
				|| it._placesNode && it._placesNode.uri // Firefox 4+
				|| it.node && it.node.uri
				|| it.getAttribute("siteURI")
				|| it.getAttribute("targetURI")
				|| "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTreeInfo: function(treechildren, e, prop) { // "uri" or "title"
		if(!("PlacesUtils" in window)) // For Firefox 3.0+
			return "";
		treechildren = treechildren || this.item;
		e = e || this.event;
		var tree = treechildren.parentNode;

		// Based on code of Places' Tooltips ( https://addons.mozilla.org/firefox/addon/7314 )
		var row = {}, column = {}, cell = {};
		tree = tree.wrappedJSObject || tree; // For page in tab, Firefox <= 3.6
		tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, column, cell);
		if(row.value == -1)
			return "";
		if(this.isFeedSidebar(treechildren))
			return this.getFeedSidebarURI(tree, row.value);
		try {
			var node = tree.view.nodeForTreeIndex(row.value);
		}
		catch(e) {
		}
		if(!node || !PlacesUtils.nodeIsURI(node))
			return "";
		return node[prop];
	},
	isFeedSidebar: function(treechildren) {
		return treechildren.id == "feedbar_tree_container"; // Feed Sidebar
	},
	getFeedSidebarURI: function(tree, treeIndx) {
		var emulateClick = "javascript:void 0";
		try {
			// Based on code from resource://feedbar-modules/treeview.js, Feed Sidebar 8.0.3,
			// see FEEDBAR.onTreeClick()
			// Note: full_preview.html?idx=... link doesn't work without additional code
			if(tree.view.isContainer(treeIndx))
				return "";
			this.itemData = {
				treeIndx: treeIndx,
				onBeforeLoad: function() {
					FEEDBAR.setCellRead(treeIndx, true);
				}
			};
			if(this.pu.getPref("extensions.feedbar.showFullPreview") || !window.navigator.onLine)
				//return "chrome://feedbar/content/full_preview.html?idx=" + treeIndx;
				return emulateClick;
			return FEEDBAR.getCellLink(treeIndx);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return emulateClick; // Better fallback?
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
		if(!forced && !this.pu.get("focusOnItems"))
			return;
		it = it || this.mainItem || this.item;
		if(
			!this.ju.isObject(it)
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
	beforeLoad: function(item, uri) {
		if(this.itemData && this.itemData.onBeforeLoad) try {
			this.itemData.onBeforeLoad();
		}
		catch(e) {
			Components.utils.reportError(e);
		}
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
			this.delay(function() { // Wait for blinkNode() redraw
				this.wu.openEditor(null, this.ct.EDITOR_MODE_SHORTCUT, this.ps.getEvtStr(e), this._all ? "$all" : this.itemType);
			}, this);
			return;
		}
		this.executeFunction(funcObj, e);
	},
	executeDelayedAction: function(da, e) {
		this.daTimeout = 0;
		if(this.flags.runned || this.flags.cancelled)
			return;
		this.flags.runned = true;
		if(da) {
			if(e.button == 2)
				this.flags.stopContextMenu = true;
			this.executeFunction(da, e, true);
		}
		else {
			this.showPopupOnItem();
			this.handledItem = e.originalTarget;
		}
		this.ui.restoreIcon();
	},
	executeFunction: function(funcObj, e, isDeleyed) {
		this.cancelDelayedAction();
		this.setMoveHandlers(null);

		var type = this.itemType;
		this.lastEvent = this.event;
		this.lastItemType = type;
		this.lastAll = this._all;
		this.isDeleyed = !!isDeleyed;
		this.handledItem = e && e.originalTarget;

		if(funcObj.custom) {
			var fnc = this.ps.getCustomFunc(funcObj, isDeleyed);
			if(fnc) try {
				fnc.call(this.fn, e || this.event, this.item, this.origItem, type);
			}
			catch(err) {
				var eLine = this.ut.getRealLineNumber(err, funcObj._line);
				var href = this.getEditorLink(e) + "?line=" + eLine;
				var eMsg = this.ps.errInfo("customFunctionError", err, type, isDeleyed, funcObj.label || "");
				this.ut.notifyError(eMsg, { buttons: {
					$openEditor: this.wu.getOpenEditorLink(href, eLine),
					$openConsole: this.ut.toErrorConsole
				}});
				this.ut._err(eMsg, href, eLine);
				this.ut._err(err);
			}
		}
		else {
			var action = funcObj.action;
			if(action == this.ignoreAction) { // DblClicker extension or something similar?
				this._log("Something went wrong: detected " + e.type + " for " + action);
				return;
			}
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
						? this.getLocalized("securityError")
							.replace("%u", this.fn.getItemURI())
							.replace("%s", this.item.ownerDocument.documentURI)
						: this.getLocalized("errorInBuiltInFunction").replace("%f", action);
					this.ut.notify(eMsg, {
						icon: securityError ? this.ut.NOTIFY_ICON_WARNING : this.ut.NOTIFY_ICON_ERROR,
						buttons: {
							$openEditor: this.wu.getOpenEditorLink(href),
							$openConsole: this.ut.toErrorConsole
						}
					});
					this.ut._err(eMsg);
					this.ut._err(err);
				}
			}
			else {
				var href = this.getEditorLink(e);
				var eMsg = this.getLocalized("functionNotFound").replace("%f", action);
				this.ut.notifyWarning(eMsg, { buttons: {
					$openEditor: this.wu.getOpenEditorLink(href),
					$openConsole: this.ut.toErrorConsole
				}});
				this.ut._err(eMsg, href);
				this.ut._warn('Function "' + action + '" not found (' + typeof this.fn[action] + ")");
			}
		}

		this.focusOnItem();

		if(this._debug) {
			var eStr = this.ps.getEvtStr(e || this.event);
			this._log(
				(isDeleyed ? "delayedAction" : e.type)
				+ " -> " + this.ps.getModifiersStr(eStr) + " + " + this.ps.getButtonStr(eStr, true)
				+ "\n=> executeFunction()"
				+ "\nnodeName = " + (this.origItem ? this.origItem.nodeName : "?")
				+ ", itemType = " + type
				+ "\n=> " + (funcObj.custom ? (funcObj.label || funcObj.action.substr(0, 100)) : funcObj.action)
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
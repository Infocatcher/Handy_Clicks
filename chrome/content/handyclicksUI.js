if(!("handyClicks" in window)) window.__defineGetter__("handyClicks", function() {
	handyClicksUI._log("Used window.handyClicks lazy getter");
	delete this.handyClicks;
	return handyClicksUI.hc;
});

var handyClicksUI = {
	__proto__: handyClicksGlobals,

	blinkAttr: "__handyclicks__blink__",
	blinkOpacity: "0.1",
	blinkDuration: 170,
	attrNS: "urn:handyclicks:namespace",

	get enabled() {
		return this.pu.get("enabled");
	},
	set enabled(on) {
		this.pu.set("enabled", on);
	},
	get coreLoaded() {
		if(window.__lookupGetter__("handyClicks"))
			return false;
		delete this.coreLoaded;
		return this.coreLoaded = true;
	},

	init: function(reloadFlag) {
		this.setStatus();
		this.showHideControls();
		if(reloadFlag)
			this.setEditModeStatus();
		else
			this.registerHotkeys();
		this.pu.oSvc.addObserver(this.prefChanged, this);

		this.delay(function() {
			this.setupUIActions();
			this.setupProgress();
			//this.loadBlinkStyle();
		}, this);
	},
	destroy: function(reloadFlag) {
		clearTimeout(this._restoreIconTimeout);
		clearTimeout(this._blinkNodeTimeout);
		reloadFlag && this.removeInheritedContext();
	},
	loadBlinkStyle: function() {
		// Styles for blinkNode() function
		this.loadBlinkStyle = function() {};
		this._log("loadBlinkStyle()");
		var priorityHack = (function() {
			var rnd = Math.random().toFixed(16).substr(2);
			var hack = "*|*";
			for(var i = 0; i < 16; ++i)
				hack += ":not(#__priorityHack-" + rnd + "-" + i + ")";
			return hack;
		})();
		var css = "data:text/css," + encodeURIComponent('\
			@namespace hc url("' + this.attrNS + '");\n\
			' + priorityHack + '[hc|' + this.blinkAttr + '="true"] {\n\
				opacity: ' + this.blinkOpacity + ' !important;\n\
			}'
		);
		var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			.getService(Components.interfaces.nsIStyleSheetService);
		var uri = makeURI(css); // chrome://global/content/contentAreaUtils.js
		if(!sss.sheetRegistered(uri, sss.AGENT_SHEET))
			sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
		if(!sss.sheetRegistered(uri, sss.USER_SHEET))
			sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
	},

	get editMode() {
		return this.coreLoaded && this.hc.editMode;
	},
	set editMode(em) {
		if(!em && !this.coreLoaded)
			return;
		if(em && !this.enabled) {
			this.hc.enabledForEditMode = true;
			this.enabled = true;
		}
		this.hc.editMode = em;
	},
	initListeners: function(enable) {
		if(enable || this.coreLoaded) {
			if(enable)
				this.hc.initListeners(enable);
			else
				this.hc.destroy(); // Also perform all cleanups
		}
	},

	_blinkNodeTimeout: 0,
	blinkNode: function(time, node) {
		node = node || this.hc.item || this.hc.origItem;
		if(!node)
			return;
		this.loadBlinkStyle();
		time = time || this.blinkDuration;
		var oldFx = this.fxVersion <= 2;
		var nodes = Array.prototype.slice.call(node);
		if(!nodes.length)
			nodes = [node];
		nodes.forEach(function(node) {
			var attr = this.blinkAttr;
			node.setAttributeNS(this.attrNS, attr, "true");
			if(oldFx) {
				var origStyle = node.hasAttribute("style") && node.getAttribute("style");
				node.style.setProperty("opacity", this.blinkOpacity, "important");
			}
			node.scrollHeight || node.offsetHeight; // Force redraw
			this._blinkNodeTimeout = this.delay(function() {
				node.removeAttributeNS(this.attrNS, attr);
				oldFx && this.attribute(node, "style", origStyle, true);
			}, this, time);
		}, this);
	},

	// GUI:
	toolbarButtonId: "handyClicks-toolbarButton",
	get paletteButton() {
		var elt = this.getFromPalette(this.toolbarButtonId);
		if(!elt)
			return null;
		delete this.paletteButton;
		return this.paletteButton = elt;
	},
	getFromPalette: function(id) {
		var tb = "gNavToolbox" in window && gNavToolbox
			|| "getNavToolbox" in window && getNavToolbox() // Firefox 3.0
			|| this.e("navigator-toolbox"); // Firefox <= 2.0
		if(tb && "palette" in tb)
			return tb.palette.getElementsByAttribute("id", id)[0] || null;
		return null;
	},

	get controlsVisible() {
		return this.ut.isElementVisible(this.$("handyClicks-statusbarButton"))
			|| this.ut.isElementVisible(this.$(this.toolbarButtonId));
	},
	toggleStatus: function(fromKey) {
		var en = !this.enabled;
		this.enabled = en;
		if(!fromKey || this.controlsVisible)
			return;
		this.ut.notifyInWindowCorner(this.getLocalized(en ? "enabled" : "disabled"), {
			icon: en ? this.ut.NOTIFY_ICON_NORMAL : this.ut.NOTIFY_ICON_DISABLED,
			onLeftClick: function() {
				this.wu.openSettings();
			},
			context: this
		});
	},

	_toolbarContextItems: [],
	_menuContextItems: [],
	buildSettingsPopup: function(e) {
		this.checkClipboard();
		this.$("handyClicks-allSettingsMenuitem").hidden = !this.pu.get("ui.showAllSettingsMenuitem");

		var popup = e.target;
		var pn = popup.triggerNode || document.popupNode; // https://bugzilla.mozilla.org/show_bug.cgi?id=383930

		var inheritContext = this.pu.get("ui.inheritToolbarContextMenu")
			&& pn && pn.localName != "browser"
			&& !this.ju.startsWith(pn.localName, "statusbar");
		var sep = this.$("handyClicks-mainCommandsSeparator");
		if(sep.hidden == inheritContext) for(; sep; sep = sep.nextSibling)
			sep.hidden = !inheritContext;
		if(!inheritContext)
			return;

		if(!popup.hasAttribute("hc_additionalItemsAdded")) {
			popup.setAttribute("hc_additionalItemsAdded", "true");
			this.inheritStaticToolbarContext(popup);
		}

		if("onViewToolbarsPopupShowing" in window) {
			try {
				onViewToolbarsPopupShowing(e);
			}
			catch(e) {
				this.ut._err("buildSettingsPopup: onViewToolbarsPopupShowing() failed");
				this.ut._err(e);
			}
			var vtSep = this.$("handyClicks-viewToolbarsSeparator");
			var vtCmd = "onViewToolbarCommand" in window && "onViewToolbarCommand(event);";
			Array.prototype.slice.call(popup.childNodes).forEach(function(ch) {
				if(!this.isToolbarItem(ch))
					return;
				vtCmd && ch.setAttribute("oncommand", vtCmd); // For SeaMonkey
				ch.id && this.setClonedId(ch);
				popup.insertBefore(ch, vtSep);
			}, this);
		}

		var isMenu = pn.getAttribute("cui-areatype") == "menu-panel";
		this._toolbarContextItems.forEach(function(mi) {
			mi.hidden = isMenu;
		});
		this._menuContextItems.forEach(function(mi) {
			mi.hidden = !isMenu;
		});
	},
	inheritStaticToolbarContext: function(popup) {
		Array.prototype.forEach.call(
			this.$("toolbar-context-menu").childNodes,
			function(ch) {
				if(this.isToolbarItem(ch))
					return;
				if(
					ch.localName == "menuseparator"
					&& popup.lastChild
					&& popup.lastChild.localName == "menuseparator"
					&& this.ut.isElementVisible(popup.lastChild)
				)
					return;
				var clone = this.safeClone(ch);
				popup.appendChild(clone);
			},
			this
		);

		if("gCustomizeMode" in window && document.getElementsByClassName) { // Australis
			var moveToToolbar = document.getElementsByClassName("customize-context-moveToToolbar")[0];
			var removeFromMenu = document.getElementsByClassName("customize-context-removeFromPanel")[0];
			var moveToMenu = popup.getElementsByClassName("customize-context-moveToPanel")[0];
			var removeFromToolbar = popup.getElementsByClassName("customize-context-removeFromToolbar")[0];
			if(moveToToolbar && moveToMenu) {
				var mi = moveToMenu.parentNode.insertBefore(this.safeClone(moveToToolbar), moveToMenu);
				this._toolbarContextItems.push(moveToMenu);
				this._menuContextItems.push(mi);
			}
			if(removeFromMenu && removeFromToolbar) {
				var mi = removeFromToolbar.parentNode.insertBefore(this.safeClone(removeFromMenu), removeFromToolbar);
				this._toolbarContextItems.push(removeFromToolbar);
				this._menuContextItems.push(mi);
			}
		}
	},
	removeInheritedContext: function() {
		var sep = this.$("handyClicks-mainCommandsSeparator");
		var popup = sep.parentNode;
		popup.removeAttribute("hc_additionalItemsAdded");
		for(var mi = popup.lastChild; mi && mi != sep; mi = ps) {
			var ps = mi.previousSibling;
			if(mi.id != "handyClicks-viewToolbarsSeparator")
				popup.removeChild(mi);
		}
	},
	isToolbarItem: function(node) {
		return node.hasAttribute("toolbarindex") || node.hasAttribute("toolbarid") || node.hasAttribute("toolbarId");
	},
	safeClone: function(node) {
		var clone = node.cloneNode(true);
		clone.id && this.setClonedId(clone);
		Array.prototype.forEach.call(
			clone.getElementsByAttribute("id", "*"),
			this.setClonedId,
			this
		);
		return clone;
	},
	setClonedId: function(node) {
		node.id = "handyClicks-cloned-" + node.id;
	},
	checkClipboard: function() {
		const id = "handyClicks-importFromClipboard";
		this.$(id).hidden = this.$(id + "Separator").hidden = !this.ps.clipboardPrefs;
	},
	fixPopup: function(popup) {
		var pn = popup.triggerNode || document.popupNode; // https://bugzilla.mozilla.org/show_bug.cgi?id=383930
		pn && this.ut.closeMenus(pn); // For Firefox 2.0
	},

	ACTION_STATUS:          0,
	ACTION_SETTINGS:        1,
	ACTION_POPUP:           2,
	ACTION_EDIT_MODE:       3,
	ACTION_ALL_SETTINGS:    4,
	ACTION_SETTINGS_TOGGLE: 5,
	ACTION_EDITOR:          6,
	ACTION_EDITOR_TYPE:     7,
	setupUIActions: function() {
		this.setControls(function(elt) {
			var type = this.getTypeByLocalName(elt.localName);
			var leftClickAction = this.pu.get("ui.action" + type + "LeftClick");
			var rightClickAction = this.pu.get("ui.action" + type + "RightClick");
			var cmId = "handyClicks-settingsPopup";
			var popup = leftClickAction == this.ACTION_POPUP ? cmId : null;
			this.attribute(elt, "popup", popup);
			elt.setAttribute("context", cmId);
			elt.setAttribute("hc_preventContextMenu", rightClickAction != this.ACTION_POPUP);
			if(!elt.hasAttribute("oncontextmenu"))
				elt.setAttribute("oncontextmenu", "return handyClicksUI.allowContextMenu(event);");
			//~ note: "popup" doesn't work for menuitems
			if(elt.localName == "menuitem")
				elt.setAttribute("closemenu", popup ? "none" : "auto");
			if(type == "Menu") {
				var key;
				switch(leftClickAction) {
					case this.ACTION_STATUS:       key = "toggleStatus";    break;
					case this.ACTION_SETTINGS:     key = "openSettings";    break;
					case this.ACTION_EDIT_MODE:    key = "editMode";        break;
					case this.ACTION_ALL_SETTINGS: key = "openAboutConfig";
				}
				if(key)
					elt.setAttribute("key", "handyClicks-key-" + key);
				else
					elt.removeAttribute("key");
			}
		});
	},
	allowContextMenu: function(e) {
		var elt = e.target;
		return elt != e.currentTarget
			|| elt.getAttribute("hc_preventContextMenu") != "true"
			|| this.hasModifier(e);
	},
	getTypeByLocalName: function(ln) {
		switch(ln) {
			case "menuitem":       return "Menu";
			case "toolbarbutton":  return "Toolbar";
			case "statusbarpanel": return "Statusbar";
		}
		return undefined;
	},
	handleUIEvent: function(e) {
		var type = this.getTypeByLocalName(e.target.localName);
		if(!type)
			return;

		var button;
		var hasModifier = this.hasModifier(e);
		var leftClick = e.type == "command" || e.button == 0;
		if(leftClick && !hasModifier)
			button = "Left";
		else if(e.button == 1 || leftClick && hasModifier)
			button = "Middle";
		else if(e.button == 2) {
			if(hasModifier) // Will show context menu
				return;
			button = "Right";
		}

		var actionId = this.pu.get("ui.action" + type + button + "Click");
		if(leftClick) {
			var isMenuPopup = type == "Menu" && actionId == this.ACTION_POPUP;
			if(e.type == (isMenuPopup ? "command" : "click"))
				return;
		}
		switch(actionId) {
			case this.ACTION_STATUS:          this.toggleStatus();        break;
			case this.ACTION_SETTINGS:        this.wu.openSettings();     break;
			case this.ACTION_POPUP:           this.showSettingsPopup(e);  break;
			case this.ACTION_EDIT_MODE:       this.toggleEditMode();      break;
			case this.ACTION_ALL_SETTINGS:    this.pu.openAboutConfig();  break;
			case this.ACTION_SETTINGS_TOGGLE: this.wu.openSettings(true); break;
			case this.ACTION_EDITOR:          this.wu.openEditor();       break;
			case this.ACTION_EDITOR_TYPE:     this.wu.openEditor(undefined, this.ct.EDITOR_MODE_TYPE);
		}
		if(!leftClick && actionId != this.ACTION_POPUP)
			this.delay(this.ut.closeMenus, this.ut, 0, [e.target]);
	},
	showSettingsPopup: function(e) {
		// It's better to use "popup" or "context" attribute
		if(e) {
			if(
				e.button == 0 && e.target.localName == "menuitem"
				|| e.button == 1
			)
				this.hc.showPopupOnItem(this.$("handyClicks-settingsPopup"), e.target, e);
			return;
		}

		// Based on code from Right Links https://addons.mozilla.org/addon/right-links/
		var popup = this.$("handyClicks-settingsPopup");
		var anchor = gBrowser.selectedBrowser;
		document.popupNode = anchor;
		if("openPopup" in popup) // Firefox 3.0+
			popup.openPopup(anchor, "overlap", false);
		else
			popup.showPopup(anchor, -1, -1, "popup", "topleft", "topleft");
		// Select first menuitem
		// Unfortunately ordinal popup doesn't have nsIMenuBoxObject interface with activeChild field
		var keyCode = KeyboardEvent.DOM_VK_DOWN;
		key("keydown",  keyCode);
		key("keypress", keyCode);
		key("keyup",    keyCode);
		function key(type, code) {
			var evt = document.createEvent("KeyboardEvent");
			evt.initKeyEvent(
				type, true /*bubbles*/, true /*cancelable*/, window,
				false /*ctrlKey*/, false /*altKey*/, false /*shiftKey*/, false /*metaKey*/,
				code /*keyCode*/, 0 /*charCode*/
			);
			popup.dispatchEvent(evt);
		}
	},

	_temFromKey: false,
	toggleEditMode: function(fromKey) {
		this._temFromKey = fromKey;
		this.delay(function() {
			this.editMode = !this.editMode;
			this._temFromKey = false;
		}, this);
	},
	get escKey() {
		delete this.escKey;
		return this.escKey = this.getStr("chrome://global/locale/keys.properties", "VK_ESCAPE") || "Esc";
	},
	setEditModeStatus: function(em) {
		em = em === undefined ? this.editMode : em;
		var tt = em ? this.getLocalized("editModeTip").replace("%key", this.escKey) : "";
		var ttAttr = this.tooltipAttrBase + "1";
		this.setControls(function(elt) {
			elt.setAttribute("hc_editMode", em);
			elt.setAttribute(ttAttr, tt);
		});
		var act = em ? addEventListener : removeEventListener;
		act.call(window, "mouseover", this, true);
		act.call(window, "mousemove", this, true);
		act.call(window, "mouseout",  this, true);
		if(em)
			this.notifyEditMode();
		else {
			this.emtt.hidePopup();
			this.closeEditModeNotify();
		}
	},
	_emNotify: null,
	notifyEditMode: function(underCursor) {
		var nem = this.pu.get("notifyEditMode");
		if(!(nem == 1 && this._temFromKey && !this.controlsVisible || nem == 2))
			return;
		this.closeEditModeNotify();
		this._emNotify = this.ut.notify(this.getLocalized("editModeNote").replace("%key", this.escKey), {
			inWindowCorner: !underCursor,
			title: this.getLocalized("editModeTitle"),
			onLeftClick: function() {
				this.editMode = false;
			},
			context: this
		});
	},
	closeEditModeNotify: function() {
		var emn = this._emNotify;
		if(!emn)
			return;
		this._emNotify = null;
		!emn.closed && emn.close();
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "mouseover": this.mouseoverHandler(e); break;
			case "mousemove": this.mousemoveHandler(e); break;
			case "mouseout":  this.mouseoutHandler(e);
		}
	},
	get emtt() {
		delete this.emtt;
		return this.emtt = this.e("handyClicks-editModeTip");
	},
	get emttType() {
		delete this.emttType;
		return this.emttType = this.e("handyClicks-editModeTip-type");
	},
	get emttURI() {
		delete this.emttURI;
		return this.emttURI = this.e("handyClicks-editModeTip-uri");
	},
	mouseoverHandler: function(e) {
		this.updateEditModeTip(e);
		this.mousemoveHandler(e);
	},
	mousemoveHandler: function(e) {
		var trg = e.originalTarget;
		if(trg.namespaceURI == this.ut.XULNS && trg.localName == "treechildren")
			this.updateEditModeTip(e);
		var tt = this.emtt;
		if(!this.hc.itemType) {
			tt.hidePopup();
			return;
		}
		// Are you see these great backward compatibility? >_<
		if("openPopupAtScreen" in tt) // Firefox 3.0+
			tt.openPopupAtScreen(e.screenX, e.screenY, false /*isContextMenu*/);
		else
			tt.showPopup(document.documentElement, e.screenX, e.screenY, "tooltip", null, null);
		if(this.fxVersion <= 2)
			return;
		var x = e.screenX;
		var y = e.screenY;
		if(this.fxVersion <= 3.5) {
			x = Math.min(screen.width  - tt.boxObject.width,  x);
			y = Math.min(screen.height - tt.boxObject.height, y);
			var debo = document.documentElement.boxObject;
			x += debo.screenX;
			y += debo.screenY;
		}
		if(this.fxVersion != 3.6)
			y += 22;
		tt.moveTo(x, y);
	},
	mouseoutHandler: function(e) {
		if(!e.relatedTarget)
			this.emtt.hidePopup();
	},
	updateEditModeTip: function(e) {
		this.hc.defineItem(e, {});
		var type = this.hc.itemType;
		if(!type)
			return;
		var labelType = this.ps.getTypeLabel(type);
		var maxLen = 60;
		var labelUri = Array.prototype.concat.call(this.fn.getItemURI(this.hc.item, type, e))
			.map(function(url) {
				url = this.fn.losslessDecodeURI(url);
				if(url.length > maxLen) {
					var start = Math.floor(maxLen*0.65);
					return url.substr(0, start) + "\u2026" /* "..." */ + url.substr(start - maxLen);
				}
				return url;
			}, this)
			.join(", \n");
		if(this.emttType.value != labelType)
			this.emttType.value = labelType;
		if(this.emttURI.textContent != labelUri)
			this.emttURI.textContent = labelUri;
	},

	prefChanged: function(pName) {
		if(pName == "enabled")
			this.setStatus();
		else if(this.ju.startsWith(pName, "ui.showIn") || pName == "ui.showAppMenuSeparator")
			this.showHideControls();
		else if(this.ju.startsWith(pName, "ui.action"))
			this.setupUIActions();
		else if(pName == "ui.customizableProgressBar")
			this.setupProgress();
		else if(pName.substr(0, 10) == "blacklist.")
			this.coreLoaded && (this.hc.blacklists[pName.charAt(10)] = null);
	},
	setStatus: function() {
		var enabled = this.enabled;
		this.delay(function() {
			enabled && this.hc.preloadSettings();
			this.initListeners(enabled);
		}, this);
		if(!enabled && this.coreLoaded && this.hc._settingsLoaded) {
			this.hc._settingsLoaded = false;
			var timer = this.hc._settingsLoadTimer;
			if(timer) {
				this.hc._settingsLoadTimer = 0;
				clearTimeout(timer);
			}
			this.ps.disable();
		}
		var tt = this.getLocalized(enabled ? "enabledTip" : "disabledTip");
		var ttAttr = this.tooltipAttrBase + "0";
		this.setControls(function(elt) {
			elt.setAttribute("hc_enabled", enabled);
			elt.setAttribute(ttAttr, tt);
		});
		this.$("handyClicks-enabled").setAttribute("checked", enabled);
	},
	_restoreIconTimeout: 0,
	_hasIcon: false,
	setIcon: function(e) {
		if(!this.pu.get("ui.showMouseButton"))
			return;
		clearTimeout(this._restoreIconTimeout);
		var icon = e ? String(e.button || 0) : null;
		this._hasIcon = !!icon;
		this.setControls(function(elt) {
			this.attribute(elt, "hc_button", icon);
		});
	},
	restoreIcon: function() {
		if(!this._hasIcon)
			return;
		var delay = this.pu.get("ui.showMouseButton.restoreDelay");
		clearTimeout(this._restoreIconTimeout);
		this._restoreIconTimeout = this.delay(this.setIcon, this, delay);
	},
	showHideControls: function() {
		var statusBtn = this.$("handyClicks-statusbarButton");
		if(statusBtn)
			statusBtn.hidden = !this.pu.get("ui.showInStatusbar");
		this.delay(this.showHideNotVisibleControls, this);
	},
	showHideNotVisibleControls: function() {
		this.$("handyClicks-toolsMenuitem").hidden = !this.pu.get("ui.showInToolsMenu");
		var appMi = this.$("handyClicks-appMenuitem");
		if(appMi) {
			var appSep = this.$("handyClicks-appMenuitemSeparator");
			var hide = !this.pu.get("ui.showInAppMenu");
			appMi.hidden = hide;
			appSep.hidden = hide || !this.pu.get("ui.showAppMenuSeparator");
		}
	},
	setControls: function(func, context) {
		const id = "handyClicks-";
		[
			this.$(id + "toolsMenuitem"),
			this.$(id + "appMenuitem"),
			this.$(id + "toolbarButton") || this.paletteButton,
			this.$(id + "statusbarButton"),
			this.$(id + "editModeTip-icon")
		].forEach(function(elt) {
			elt && func.call(context || this, elt);
		}, this);
	},

	// Progressmeter:
	setupProgress: function() {
		var sbPanel = this.e("handyClicks-statusbarProgressPanel");
		var tbPanel = this.e("handyClicks-toolbarProgressContainer")
			|| this.getFromPalette("handyClicks-toolbarProgressContainer");

		var visiblePanel, hiddenPanel;
		if(!sbPanel || this.pu.get("ui.customizableProgressBar")) {
			visiblePanel = tbPanel;
			hiddenPanel = sbPanel;
		}
		else {
			visiblePanel = sbPanel;
			hiddenPanel = tbPanel;
		}

		if(hiddenPanel && !visiblePanel.hasChildNodes()) {
			hiddenPanel.collapsed = true;
			while(hiddenPanel.hasChildNodes())
				visiblePanel.appendChild(hiddenPanel.firstChild);
		}
		this.progressPanel = visiblePanel;
		this.progressLabelNode = visiblePanel.getElementsByAttribute("id", "handyClicks-statusbarProgressLabel")[0];
		this.progressNode = visiblePanel.getElementsByAttribute("id", "handyClicks-statusbarProgress")[0];
	},
	userCancelled: false,
	progressPart: 0,
	progressCount: 0,
	get progressLabel() {
		// We can't use "value" getter/setter for label inside toolbar palette
		return this.progressLabelNode.getAttribute("value");
	},
	set progressLabel(val) {
		return this.progressLabelNode.setAttribute("value", val);
	},
	get progress() {
		var progress = this.progressNode;
		if(!("max" in progress)) { // Firefox < 3.5
			progress._gain = 1;
			progress.__defineGetter__("max", function() {
				return Math.round(this.getAttribute("max") * this._gain);
			});
			progress.__defineSetter__("max", function(max) {
				this._gain = max/100;
				this.setAttribute("max", 100);
			});
			progress.__defineGetter__("value", function() {
				return Math.round(this.getAttribute("value") * this._gain);
			});
			progress.__defineSetter__("value", function(value) {
				this.setAttribute("value", Math.round(value/this._gain));
			});
		}
		delete this.progress;
		return this.progress = progress;
	},
	get showProgress() {
		return !this.progressPanel.collapsed;
	},
	set showProgress(show) {
		if(show) {
			this.userCancelled = false;
			if(this.progressPanel.collapsed)
				this.progressPart = this.progressCount = 0;
			clearTimeout(this._progressHideTimeout);
		}
		else {
			this.hideTaskbarProgress();
		}
		this.progressPanel.collapsed = !show;
	},
	get taskbarProgress() {
		delete this.taskbarProgress;
		const taskbarId = "@mozilla.org/windows-taskbar;1";
		const cc = Components.classes;
		const ci = Components.interfaces;
		if(!(taskbarId in cc))
			return this.taskbarProgress = null;
		var taskbar = cc[taskbarId].getService(ci.nsIWinTaskbar);
		if(!taskbar.available)
			return this.taskbarProgress = null;
		var docShell = window.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIWebNavigation)
			.QueryInterface(ci.nsIDocShellTreeItem)
			.treeOwner
			.QueryInterface(ci.nsIInterfaceRequestor)
			.getInterface(ci.nsIXULWindow)
			.docShell;
		return this.taskbarProgress = taskbar.getTaskbarProgress(docShell);
	},
	setTaskbarProgressState: function(current, max, state) {
		this.taskbarProgress && this.taskbarProgress.setProgressState(
			state === undefined ? Components.interfaces.nsITaskbarProgress.STATE_NORMAL : state,
			current || 0,
			max     || 0
		);
	},
	hideTaskbarProgress: function() {
		this.setTaskbarProgressState(0, 0, Components.interfaces.nsITaskbarProgress.STATE_NO_PROGRESS);
	},
	progressCancel: function() {
		this.userCancelled = true;
		this.showProgress = false;
	},
	_progressHideTimeout: 0,
	progressDelayedHide: function() {
		this._progressHideTimeout = this.delay(function() {
			this.showProgress = false;
		}, this, 300);
	},

	// Multiline tooltip:
	tooltipAttrBase: "handyclicks_tooltip-",
	tooltipAttrStyle: "handyclicks_tooltipStyle-",
	tooltipAttrClass: "handyclicks_tooltipClass-",
	fillInTooltip: function(tt) {
		tt.textContent = "";
		var tNode = document.tooltipNode;
		var attrBase = this.tooltipAttrBase;
		var i = 0, val, lbl;
		for(var attrName = attrBase + i; tNode.hasAttribute(attrName); attrName = attrBase + ++i) {
			val = tNode.getAttribute(attrName);
			if(!val)
				continue;
			lbl = document.createElement("label");
			lbl.setAttribute("value", val);
			lbl.setAttribute("crop", "center");
			this.attribute(lbl, "style", tNode.getAttribute(this.tooltipAttrStyle + i));
			this.attribute(lbl, "class", tNode.getAttribute(this.tooltipAttrClass + i));
			tt.appendChild(lbl);
		}
		return i > 0;
	},

	// Hotkeys:
	registerHotkeys: function() {
		this.pu.prefSvc.getBranch(this.pu.prefNS + "key.")
			.getChildList("", {})
			.forEach(this.registerHotkey, this);
	},
	registerHotkey: function(kId) {
		var kElt = this.e("handyClicks-key-" + kId);
		if(!kElt) {
			this.ut._warn('Key element not found: "' + kId + '"');
			return;
		}
		var keyStr = this.pu.get("key." + kId);
		if(!keyStr) { // Key is disabled
			// Strange things may happens without this for <key command="..." />
			kElt.parentNode.removeChild(kElt);
			return;
		}
		var tokens = keyStr.split(" ");
		var key = tokens.pop() || " ";
		var modifiers = tokens.join(",");
		kElt.removeAttribute("disabled");
		kElt.setAttribute(key.substr(0, 3) == "VK_" ? "keycode" : "key", key);
		kElt.setAttribute("modifiers", modifiers);
	}
};
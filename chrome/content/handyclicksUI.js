var handyClicksUI = {
	__proto__: handyClicksGlobals,

	blinkAttr: "__handyclicks__blink__",
	blinkOpacity: "0.1",
	blinkDuration: 170,
	attrNS: "urn:handyclicks:namespace",

	get coreLoaded() {
		if("handyClicks" in window) {
			delete this.coreLoaded;
			return this.coreLoaded = true;
		}
		return false;
	},

	init: function(reloadFlag) {
		this.setStatus();
		this.showHideControls();
		if(reloadFlag)
			this.setEditModeStatus();
		else
			this.registerHotkeys();
		this.pu.oSvc.addObserver(this.updUI, this);

		this.timeout(function() {
			this.setupUIActions();
			this.setupProgress();
			//this.loadBlinkStyle();
		}, this);
		this.timeout(function() {
			// Fix position of item in App menu from Classic Theme Restorer
			var mi = this.$("handyClicks-appMenuitem");
			if(mi) {
				var popup = mi.parentNode;
				if(popup.id == "menu_newPreferencesmenuPopup") {
					var insPos = popup.getElementsByAttribute("id", "menu_preferences")[0];
					if(
						insPos
						&& insPos.parentNode == popup
						&& insPos != document.getElementById("menu_preferences")
					) {
						popup.insertBefore(mi, insPos.nextSibling);
						popup.insertBefore(this.$("handyClicks-appMenuitemSeparator"), mi);
					}
				}
			}
		}, this, [], 50);
	},
	destroy: function(reloadFlag) {
		clearTimeout(this._restoreIconTimeout);
		clearTimeout(this._blinkNodeTimeout);
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
		if(em || this.coreLoaded)
			this.hc.editMode = em;
	},
	initListeners: function(enable) {
		if(enable || this.coreLoaded)
			this.hc.initListeners(enable);
	},

	_blinkNodeTimeout: 0,
	blinkNode: function(time, node) {
		node = node || this.hc.item || this.hc.origItem;
		if(!node)
			return;
		this.loadBlinkStyle();
		time = time || this.blinkDuration;
		var oldFx = this.ut.fxVersion <= 2;
		var nodes = Array.slice(node);
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
			this._blinkNodeTimeout = this.timeout(
				function(node, attr, oldFx, origStyle) {
					node.removeAttributeNS(this.attrNS, attr);
					oldFx && this.attribute(node, "style", origStyle, true);
				},
				this, [node, attr, oldFx, origStyle],
				time
			);
		}, this);
	},

	// GUI:
	toolbarButtonId: "handyClicks-toolbarButton",
	get paletteButton() {
		var elt = this.getFromPalette(this.toolbarButtonId);
		if(elt) {
			delete this.paletteButton;
			return this.paletteButton = elt;
		}
		return null;
	},
	getFromPalette: function(id) {
		var tb = "gNavToolbox" in window && gNavToolbox
			|| "getNavToolbox" in window && getNavToolbox() // Firefox 3.0
			|| this.e("navigator-toolbox"); // Firefox <= 2.0
		if(tb && "palette" in tb) {
			var elts = tb.palette.getElementsByAttribute("id", id);
			if(elts.length)
				return elts[0];
		}
		return null;
	},

	get controlsVisible() {
		return this.ut.isElementVisible(this.$("handyClicks-statusbarButton"))
			|| this.ut.isElementVisible(this.$(this.toolbarButtonId));
	},
	toggleStatus: function(fromKey) {
		var en = !this.hc.enabled;
		this.hc.enabled = en;
		if(!fromKey || this.controlsVisible)
			return;
		this.ut.notifyInWindowCorner(
			this.getLocalized(en ? "enabled" : "disabled"), null,
			this.ut.bind(this.wu.openSettings, this.wu), null,
			en ? this.ut.NOTIFY_ICON_NORMAL : this.ut.NOTIFY_ICON_DISABLED
		);
	},

	_toolbarContextItems: [],
	_menuContextItems: [],
	buildSettingsPopup: function(e) {
		this.checkClipboard();

		this.$("handyClicks-allSettingsMenuitem").setAttribute(
			"hidden",
			!this.pu.get("ui.showAllSettingsMenuitem")
		);

		var popup = e.target;
		var pn = popup.triggerNode || document.popupNode; // https://bugzilla.mozilla.org/show_bug.cgi?id=383930

		var inheritContext = this.pu.get("ui.inheritToolbarContextMenu")
			&& pn
			&& !this.ut.hasPrefix(pn.localName, "statusbar")
			&& pn.localName != "browser";
		this.$("handyClicks-mainCommandsSeparator").setAttribute("hc_hideAllAfter", !inheritContext);
		if(!inheritContext)
			return;

		if(!popup.hasAttribute("hc_additionalItemsAdded")) {
			popup.setAttribute("hc_additionalItemsAdded", "true");
			this.inheritStaticToolbarContext(popup);
		}
		var isMenu = pn.getAttribute("cui-areatype") == "menu-panel";
		this._toolbarContextItems.forEach(function(mi) {
			mi.hidden = isMenu;
		});
		this._menuContextItems.forEach(function(mi) {
			mi.hidden = !isMenu;
		});

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
			Array.slice(popup.childNodes).forEach(function(ch) {
				if(!this.isToolbarItem(ch))
					return;
				vtCmd && ch.setAttribute("oncommand", vtCmd); // For SeaMonkey
				ch.id && this.setClonedId(ch);
				popup.insertBefore(ch, vtSep);
			}, this);
		}
	},
	inheritStaticToolbarContext: function(popup) {
		Array.forEach(
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
	isToolbarItem: function(node) {
		return node.hasAttribute("toolbarindex") || node.hasAttribute("toolbarid") || node.hasAttribute("toolbarId");
	},
	safeClone: function(node) {
		var clone = node.cloneNode(true);
		clone.id && this.setClonedId(clone);
		Array.forEach(
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
	setupUIActions: function() {
		this.setControls(function(elt) {
			var type = this.getTypeByLocalName(elt.localName);
			var defaultAction = this.pu.get("ui.action" + type + "LeftClick");
			var popup = defaultAction == this.ACTION_POPUP
				? "handyClicks-settingsPopup"
				: null;
			var context = this.pu.get("ui.action" + type + "RightClick") == this.ACTION_POPUP
				? "handyClicks-settingsPopup"
				: "_handyClicks-noContext"; // Dummy value
			this.attribute(elt, "popup", popup);
			elt.setAttribute("context", context);
			//~ note: "popup" doesn't work for menuitems
			if(elt.localName == "menuitem")
				elt.setAttribute("closemenu", popup ? "none" : "auto");
			if(type == "Menu") {
				var key;
				switch(defaultAction) {
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
		var hasModifier = this.ut.hasModifier(e);
		var leftClick = e.type == "command" || e.button == 0;
		if(leftClick && !hasModifier)
			button = "Left";
		else if(e.button == 1 || leftClick && hasModifier)
			button = "Middle";
		else if(e.button == 2)
			button = "Right";

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
			case this.ACTION_SETTINGS_TOGGLE: this.wu.openSettings(true);
		}
		if(!leftClick && actionId != this.ACTION_POPUP)
			this.timeout(this.ut.closeMenus, this.ut, [e.target], 0);
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
		this.timeout(function() {
			this.editMode = !this.editMode;
			this._temFromKey = false;
		}, this);
	},
	setEditModeStatus: function(em) {
		em = em === undefined ? this.editMode : em;
		var tt = em
			? this.getLocalized("editModeTip").replace(
				"%key",
				this.ut.getStr("chrome://global/locale/keys.properties", "VK_ESCAPE") || "Esc"
			)
			: "";
		var ttAttr = this.tooltipAttrBase + "1";
		this.setControls(function(elt) {
			elt.setAttribute("hc_editMode", em);
			elt.setAttribute(ttAttr, tt);
		});
		if(em) {
			window.addEventListener("mouseover", this, true);
			window.addEventListener("mousemove", this, true);
			window.addEventListener("mouseout",  this, true);
			this.notifyEditMode();
		}
		else {
			window.removeEventListener("mouseover", this, true);
			window.removeEventListener("mousemove", this, true);
			window.removeEventListener("mouseout",  this, true);
			this.emtt.hidePopup();
		}
	},
	notifyEditMode: function(force) {
		var nem = this.pu.get("notifyEditMode");
		if(
			nem == 1 && (this._temFromKey && !this.controlsVisible || force)
			|| nem == 2
		) {
			var exitKey = this.ut.getStr("chrome://global/locale/keys.properties", "VK_ESCAPE") || "Esc";
			this.ut.notifyInWindowCorner(
				this.getLocalized("editModeNote").replace("%key", exitKey),
				this.getLocalized("editModeTitle"),
				this.ut.bind(function() { this.editMode = false; }, this)
			);
		}
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
	get emttValue() {
		delete this.emttValue;
		return this.emttValue = this.e("handyClicks-editModeTip-value");
	},
	mouseoverHandler: function(e) {
		this.hc.defineItem(e, {});
		var type = this.hc.itemType;
		if(type)
			this.emttValue.setAttribute("value", this.ps.getTypeLabel(type));
		this.mousemoveHandler(e);
	},
	mousemoveHandler: function(e) {
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
		if(this.ut.fxVersion <= 2)
			return;
		var x = e.screenX;
		var y = e.screenY;
		if(this.ut.fxVersion <= 3.5) {
			x = Math.min(screen.width  - tt.boxObject.width,  x);
			y = Math.min(screen.height - tt.boxObject.height, y);
			var debo = document.documentElement.boxObject;
			x += debo.screenX;
			y += debo.screenY;
		}
		if(this.ut.fxVersion != 3.6)
			y += 22;
		tt.moveTo(x, y);
	},
	mouseoutHandler: function(e) {
		if(!e.relatedTarget)
			this.emtt.hidePopup();
	},

	updUI: function(pName) {
		if(pName == "enabled")
			this.setStatus();
		else if(this.ut.hasPrefix(pName, "ui.showIn") || pName == "ui.showAppMenuSeparator")
			this.showHideControls();
		else if(this.ut.hasPrefix(pName, "ui.action"))
			this.setupUIActions();
		else if(pName == "ui.customizableProgressBar")
			this.setupProgress();
	},
	setStatus: function() {
		var enabled = this.pu.get("enabled");
		enabled && this.hc.preloadSettings();
		this.initListeners(enabled);
		var tt = this.getLocalized(enabled ? "enabledTip" : "disabledTip");
		var ttAttr = this.tooltipAttrBase + "0";
		this.setControls(function(elt) {
			elt.setAttribute("hc_enabled", enabled);
			elt.setAttribute(ttAttr, tt);
		});
		this.$("handyClicks-enabled").setAttribute("checked", enabled);
		this.$("handyClicks-cmd-editMode").setAttribute("disabled", !enabled);
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
		this._restoreIconTimeout = this.timeout(this.setIcon, this, [], delay);
	},
	showHideControls: function() {
		this.$("handyClicks-toolsMenuitem").hidden = !this.pu.get("ui.showInToolsMenu");
		var statusBtn = this.$("handyClicks-statusbarButton");
		if(statusBtn)
			statusBtn.hidden = !this.pu.get("ui.showInStatusbar");
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
		if(this.taskbarProgress)
			this.taskbarProgress.setProgressState(
				state === undefined ? Components.interfaces.nsITaskbarProgress.STATE_NORMAL : state,
				current || 0,
				max     || 0
			);
	},
	hideTaskbarProgress: function() {
		if(this.taskbarProgress)
			this.setTaskbarProgressState(0, 0, Components.interfaces.nsITaskbarProgress.STATE_NO_PROGRESS);
	},
	progressCancel: function() {
		this.userCancelled = true;
		this.showProgress = false;
	},
	_progressHideTimeout: 0,
	progressDelayedHide: function() {
		this._progressHideTimeout = setTimeout(function(_this) {
			_this.showProgress = false;
		}, 300, this);
	},

	// Multiline tooltip:
	get tt() {
		delete this.tt;
		return this.tt = this.$("handyClicks-tooltip");
	},
	tooltipAttrBase: "handyclicks_tooltip-",
	tooltipAttrStyle: "handyclicks_tooltipStyle-",
	tooltipAttrClass: "handyclicks_tooltipClass-",
	fillInTooltip: function(tooltip) {
		var tt = this.tt;
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
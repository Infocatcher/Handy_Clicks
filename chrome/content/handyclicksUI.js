var handyClicksUI = {
	blinkAttr: "__handyclicks__blink__",
	blinkOpacity: "0.1",
	blinkDuration: 170,

	uiVersion: 1,

	// Initialization:
	init: function(reloadFlag) {
		var vers = this.pu.pref("uiVersion") || 0;
		if(vers < this.uiVersion)
			this.uiMigration(vers);

		this.setStatus();
		this.showHideControls();
		this.setupUIActions();
		this.loadBlinkStyle();
		if(reloadFlag)
			this.setEditModeStatus();
		else
			this.registerHotkeys();
		this.pu.oSvc.addObserver(this.updUI, this);
	},
	destroy: function(reloadFlag) {
		clearTimeout(this._restoreIconTimeout);
		clearTimeout(this._blinkNodeTimeout);
	},
	get uiMigration() { // function(vers)
		var temp = {};
		this.rs.loadSubScript("chrome://handyclicks/content/convUI.js", temp);
		return temp.uiMigration;
	},
	loadBlinkStyle: function() {
		// Styles for blinkNode() function
		var css = "data:text/css," + encodeURIComponent(
			<><![CDATA[
				@namespace hc url("urn:handyclicks:namespace");
				*|*:root *|*[hc|%blinkAttr%="true"] {
					opacity: %blinkOpacity% !important;
				}
			]]></>.toString()
			.replace(/%blinkAttr%/g, this.blinkAttr)
			.replace(/%blinkOpacity%/g, this.blinkOpacity)
		);
		var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			.getService(Components.interfaces.nsIStyleSheetService);
		var uri = makeURI(css); // chrome://global/content/contentAreaUtils.js
		if(!sss.sheetRegistered(uri, sss.AGENT_SHEET))
			sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
	},

	_blinkNodeTimeout: null,
	blinkNode: function(time, node) {
		node = node || this.hc.item || this.hc.origItem;
		if(!node)
			return;
		time = time || this.blinkDuration;
		var oldFx = this.ut.fxVersion <= 2;
		var nodes = Array.slice(node);
		if(!nodes.length)
			nodes = [node];
		nodes.forEach(function(node) {
			var attr = this.blinkAttr;
			node.setAttributeNS("urn:handyclicks:namespace", attr, "true");
			if(oldFx) {
				var origStyle = node.hasAttribute("style") && node.getAttribute("style");
				node.style.setProperty("opacity", this.blinkOpacity, "important");
			}
			//node.offsetHeight;
			this._blinkNodeTimeout = this.ut.timeout(
				function(node, attr, oldFx, origStyle) {
					node.removeAttributeNS("urn:handyclicks:namespace", attr);
					oldFx && this.ut.attribute(node, "style", origStyle, true);
				},
				this, [node, attr, oldFx, origStyle],
				time
			);
		}, this);
	},

	// GUI:
	toolbarButtonId: "handyClicks-toolbarButton",
	get paletteButton() {
		var tb = "gNavToolbox" in window && gNavToolbox
			|| "getNavToolbox" in window && getNavToolbox() // Firefox 3.0
			|| this.e("navigator-toolbox"); // Firefox <= 2.0
		if(!tb || !("palette" in tb))
			return null;
		var elt = tb.palette.getElementsByAttribute("id", this.toolbarButtonId);
		if(elt.length) {
			delete this.paletteButton;
			return this.paletteButton = elt[0];
		}
		return null;
	},

	get isControlsVisible() {
		return this.ut.isElementVisible(this.$("handyClicks-statusbarButton"))
			|| this.ut.isElementVisible(this.$(this.toolbarButtonId));
	},
	toggleStatus: function(fromKey) {
		var en = !this.hc.enabled;
		this.hc.enabled = en;
		if(!fromKey || this.isControlsVisible)
			return;
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized(en ? "enabled" : "disabled"), null,
			this.ut.bind(this.wu.openSettings, this.wu), null,
			en ? this.ut.NOTIFY_ICON_NORMAL : this.ut.NOTIFY_ICON_DISABLED
		);
	},

	buildSettingsPopup: function(e) {
		this.checkClipboard();

		this.$("handyClicks-allSettingsMenuitem").setAttribute(
			"hidden",
			!this.pu.pref("ui.showAllSettingsMenuitem")
		);

		var inheritContext = this.pu.pref("ui.inheritToolbarContextMenu")
			&& document.popupNode && document.popupNode.localName.indexOf("toolbar") == 0;
		this.$("handyClicks-mainCommandsSeparator").setAttribute("hc_hideAllAfter", !inheritContext);
		if(!inheritContext)
			return;

		var popup = e.target;

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
				if(
					!ch.hasAttribute("toolbarindex")
					&& !ch.hasAttribute("toolbarid")
					&& !ch.hasAttribute("toolbarId")
				)
					return;
				vtCmd && ch.setAttribute("oncommand", vtCmd); // For SeaMonkey
				popup.insertBefore(ch, vtSep);
			});
		}

		if(popup.hasAttribute("hc_additionalItemsAdded"))
			return;
		popup.setAttribute("hc_additionalItemsAdded", "true");

		Array.forEach(
			this.$("toolbar-context-menu").childNodes,
			function(ch) {
				if(ch.hasAttribute("toolbarindex") || ch.hasAttribute("toolbarid"))
					return;
				var clone = ch.cloneNode(true);
				if(clone.id)
					clone.id = "handyClicks-cloned-" + clone.id;
				Array.forEach(
					clone.getElementsByAttribute("id", "*"),
					function(elt) {
						elt.id = "handyClicks-cloned-" + elt.id;
					}
				);
				popup.appendChild(clone);
			}
		);
	},
	checkClipboard: function() {
		const id = "handyClicks-importFromClipboard";
		this.$(id).hidden = this.$(id + "Separator").hidden = !this.ps.clipboardPrefs;
	},
	fixPopup: function() {
		if(document.popupNode)
			this.ut.closeMenus(document.popupNode); // For Firefox 2.0
	},

	ACTION_STATUS: 0,
	ACTION_SETTINGS: 1,
	ACTION_POPUP: 2,
	ACTION_EDIT_MODE: 3,
	ACTION_ALL_SETTINGS: 4,
	ACTION_SETTINGS_TOGGLE: 5,
	setupUIActions: function() {
		this.setControls(function(elt) {
			var type = this.getTypeByLocalName(elt.localName);
			var popup = this.pu.pref("ui.action" + type + "LeftClick") == this.ACTION_POPUP
				? "handyClicks-settingsPopup"
				: null;
			var context = this.pu.pref("ui.action" + type + "RightClick") == this.ACTION_POPUP
				? "handyClicks-settingsPopup"
				: "_handyClicks-noContext"; // Dummy value
			this.ut.attribute(elt, "popup", popup);
			elt.setAttribute("context", context);
			//if(elt.localName == "menuitem")
			//	elt.setAttribute("closemenu", popup ? "none" : "auto");
		});
	},
	getTypeByLocalName: function(ln) {
		switch(ln) {
			case "menuitem":       return "Menu";
			case "toolbarbutton":  return "Toolbar";
			case "statusbarpanel": return "Statusbar";
			default:               return undefined;
		}
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

		var actionId = this.pu.pref("ui.action" + type + button + "Click");
		switch(actionId) {
			case this.ACTION_STATUS:          this.toggleStatus();        break;
			case this.ACTION_SETTINGS:        this.wu.openSettings();     break;
			case this.ACTION_POPUP:           this.showSettingsPopup(e);  break;
			case this.ACTION_EDIT_MODE:       this.toggleEditMode();      break;
			case this.ACTION_ALL_SETTINGS:    this.pu.openAboutConfig();  break;
			case this.ACTION_SETTINGS_TOGGLE: this.wu.openSettings(true);
		}
		if(e.button != 0 && actionId != this.ACTION_POPUP)
			this.ut.timeout(this.ut.closeMenus, this.ut, [e.target], 0);
	},
	showSettingsPopup: function(e) {
		// Is better to use "popup" or "context" attribute
		if(e.button == 1)
			this.hc.showPopupOnItem(this.$("handyClicks-settingsPopup"), e.target, e);
	},

	_temFromKey: false,
	toggleEditMode: function(fromKey) {
		this._temFromKey = fromKey;
		this.ut.timeout(function() {
			this.hc.editMode = !this.hc.editMode;
			this._temFromKey = false;
		}, this);
	},
	setEditModeStatus: function(em) {
		em = em === undefined ? this.hc.editMode : em;
		var exitKey = this.ut.getStr("chrome://global/locale/keys.properties", "VK_ESCAPE") || "Esc";
		var tt = em
			? this.ut.getLocalized("editModeTip").replace("%key", exitKey)
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
		}
		else {
			window.removeEventListener("mouseover", this, true);
			window.removeEventListener("mousemove", this, true);
			window.removeEventListener("mouseout",  this, true);
			this.emtt.hidePopup();
			return;
		}
		var nem = this.pu.pref("notifyEditMode");
		if(!(nem == 1 && this._temFromKey && !this.isControlsVisible || nem == 2))
			return;
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized("editModeNote").replace("%key", exitKey),
			this.ut.getLocalized("editModeTitle"),
			this.ut.bind(function() { this.hc.editMode = false; }, this)
		);
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
		return this.emtt = this.$("handyClicks-editModeTip");
	},
	mouseoverHandler: function(e) {
		this.hc.defineItem(e, {});
		var type = this.hc.itemType;
		if(type)
			this.emtt.firstChild.setAttribute("value", this.ps.getTypeLabel(type));
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
		else if(pName.indexOf("ui.showIn") == 0)
			this.showHideControls();
		else if(pName.indexOf("ui.action") == 0)
			this.setupUIActions();
	},
	setStatus: function() {
		var enabled = this.hc.enabled;
		if(enabled && this.ps._loadStatus == this.ps.SETS_LOAD_SKIPPED)
			this.ps.loadSettings();
		var tt = this.ut.getLocalized(enabled ? "enabledTip" : "disabledTip");
		var ttAttr = this.tooltipAttrBase + "0";
		this.setControls(function(elt) {
			elt.setAttribute("hc_enabled", enabled);
			elt.setAttribute(ttAttr, tt);
		});
		this.$("handyClicks-enabled").setAttribute("checked", enabled);
		this.$("handyClicks-cmd-editMode").setAttribute("disabled", !enabled);
	},
	_restoreIconDelay: 250,
	_restoreIconTimeout: null,
	_hasIcon: false,
	setIcon: function(e) {
		if(!this.pu.pref("ui.showMouseButton"))
			return;
		clearTimeout(this._restoreIconTimeout);
		var icon = e ? String(e.button || 0) : null;
		this._hasIcon = !!icon;
		this.setControls(function(elt) {
			this.ut.attribute(elt, "hc_button", icon);
		});
	},
	restoreIcon: function() {
		if(!this._hasIcon)
			return;
		clearTimeout(this._restoreIconTimeout);
		this._restoreIconTimeout = this.ut.timeout(
			function() {
				this.setIcon();
			},
			this, [], this._restoreIconDelay
		);
	},
	showHideControls: function() {
		this.$("handyClicks-toolsMenuitem")  .hidden = !this.pu.pref("ui.showInToolsMenu");
		this.$("handyClicks-statusbarButton").hidden = !this.pu.pref("ui.showInStatusbar");
	},
	setControls: function(func, context) {
		const id = "handyClicks-";
		[
			this.$(id + "statusbarButton"),
			this.$(id + "toolsMenuitem"),
			this.$(id + "toolbarButton") || this.paletteButton,
		].forEach(function(elt) {
			elt && func.call(context || this, elt);
		}, this);
	},

	// Progressmeter:
	userCancelled: false,
	progressPart: 0,
	progressCount: 0,
	get progressPanel() {
		delete this.progressPanel;
		return this.progressPanel = this.e("handyClicks-statusbarProgressPanel");
	},
	get progressLabel() {
		delete this.progressLabel;
		return this.progressLabel = this.e("handyClicks-statusbarProgressLabel");
	},
	get progress() {
		delete this.progress;
		return this.progress = this.e("handyClicks-statusbarProgress");
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
		this.progressPanel.collapsed = !show;
	},
	progressCancel: function() {
		this.userCancelled = true;
		this.showProgress = false;
	},
	_progressHideTimeout: null,
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
		this.ut.removeChilds(tt);
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
			this.ut.attribute(lbl, "style", tNode.getAttribute(this.tooltipAttrStyle + i));
			this.ut.attribute(lbl, "class", tNode.getAttribute(this.tooltipAttrClass + i));
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
			this.ut._warn(<>Key element not found: "{kId}"</>);
			return;
		}
		var keyStr = this.pu.pref("key." + kId);
		if(!keyStr) { // Key is disabled
			// Strange things may happens without this for <key command="..." />
			kElt.parentNode.removeChild(kElt);
			return;
		}
		var tokens = keyStr.split(" ");
		var key = tokens.pop() || " ";
		var modifiers = tokens.join(",");
		kElt.removeAttribute("disabled");
		kElt.setAttribute(key.indexOf("VK_") == 0 ? "keycode" : "key", key);
		kElt.setAttribute("modifiers", modifiers);
	}
};
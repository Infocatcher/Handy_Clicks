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

		var hideAllSets = !this.pu.pref("ui.showAllSettingsMenuitem");
		this.$("handyClicks-allSettingsMenuitem").setAttribute("hidden", hideAllSets);
		this.$("handyClicks-editModeSeparator")  .setAttribute("hidden", hideAllSets);

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
			Array.slice(popup.childNodes).forEach(function(ch) {
				if(!ch.hasAttribute("toolbarindex") && !ch.hasAttribute("toolbarid"))
					return;
				ch.setAttribute("oncommand", "onViewToolbarCommand(event);"); // For SeaMonkey
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

	doSettings: function(e) {
		var leftClick = e.type == "command" || e.button == 0;
		var hasModifier = this.ut.hasModifier(e);
		if(leftClick && !hasModifier)
			this.toggleStatus();
		else if(e.button == 1 || leftClick && hasModifier) {
			this.wu.openSettings();
			this.ut.closeMenus(e.target);
		}
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
		if(!em)
			return;
		var nem = this.pu.pref("notifyEditMode");
		if(!(nem == 1 && this._temFromKey && !this.isControlsVisible || nem == 2))
			return;
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized("editModeNote").replace("%key", exitKey),
			this.ut.getLocalized("editModeTitle"),
			this.ut.bind(function() { this.hc.editMode = false; }, this)
		);
	},
	updUI: function(pName) {
		if(pName == "enabled")
			this.setStatus();
		else if(pName.indexOf("ui.showIn") == 0)
			this.showHideControls();
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

	// Multiline tooltip:
	tooltipAttrBase: "handyclicks_tooltip-",
	tooltipAttrStyle: "handyclicks_tooltipStyle-",
	tooltipAttrClass: "handyclicks_tooltipClass-",
	fillInTooltip: function(tooltip) {
		var tNode = document.tooltipNode;
		var attrBase = this.tooltipAttrBase;
		var i = 0, cache, lbl, val;
		for(var attrName = attrBase + i; tNode.hasAttribute(attrName); attrName = attrBase + ++i) {
			cache = "_" + attrName;
			lbl = cache in tooltip && tooltip[cache];
			if(!lbl) {
				lbl = document.createElement("label");
				lbl.setAttribute("crop", "center");
				tooltip.appendChild(lbl);
				tooltip[cache] = lbl;
			}
			this.ut.attribute(lbl, "style", tNode.getAttribute(this.tooltipAttrStyle + i));
			this.ut.attribute(lbl, "class", tNode.getAttribute(this.tooltipAttrClass + i));

			val = tNode.getAttribute(attrName);
			lbl.setAttribute("value", val);
			lbl.hidden = !val; // Hide empty lines
		}
		return i > 0;
	},
	hideAllLabels: function(tooltip) {
		Array.forEach(
			tooltip.childNodes,
			function(ch) {
				ch.hidden = true;
			}
		);
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
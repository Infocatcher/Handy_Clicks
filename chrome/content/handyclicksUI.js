var handyClicksUI = {
	blinkAttr: "__handyclicks__blink__",
	blinkOpacity: "0.1",

	// Initialization:
	init: function(reloadFlag) {
		const v = this.pu.pref("uiVersion") || 0;
		if(v < 1) { // Added 2009-11-13
			// New id for toolbarbutton
			if(!this.$(this.toolbarButtonId)) {
				var tbm = /(?:^|,)handyClicks-toggleStatus-tbButton(?:,|$)/;
				Array.some(
					document.getElementsByTagName("toolbar"),
					function(tb) {
						var cs = tb.getAttribute("currentset");
						if(!cs || !tbm.test(cs))
							return false;
						// Add toolbarbutton manually:
						var newItem = this.paletteButton;
						if(newItem)
							tb.insertBefore(newItem, /,*([^,]+)/.test(RegExp.rightContext) && this.e(RegExp.$1) || null);
						// Fix "currentset" of toolbar:
						cs = cs.replace(tbm, "," + this.toolbarButtonId + ",")
							.replace(/^,+|,+$/g, "")
							.replace(/,+/g, ",");
						tb.setAttribute("currentset", cs);
						tb.currentSet = cs;
						document.persist(tb.id, "currentset");
						try { BrowserToolboxCustomizeDone(true); }
						catch(e) {}
						return true;
					},
					this
				);
			}
			this.pu.pref("uiVersion", 1).savePrefFile();
		}

		this.setStatus();
		this.pu.oSvc.addObserver(this.updUI, this);
		this.registerHotkeys();
		this.showHideControls();
		reloadFlag && this.setEditModeStatus();
		this.initUninstallObserver();

		// Styles for blinkNode() function:
		var cssStr = '*|*:root *|*[' + this.blinkAttr + '="true"] { opacity: ' + this.blinkOpacity + ' !important; }';
		var data = "data:text/css," + encodeURIComponent(cssStr);
		var cc = Components.classes;
		var sss = cc["@mozilla.org/content/style-sheet-service;1"]
			.getService(Components.interfaces.nsIStyleSheetService);
		var uri = makeURI(data);
		if(!sss.sheetRegistered(uri, sss.USER_SHEET))
			sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
	},
	destroy: function(reloadFlag) {
		this.destroyUninstallObserver();
	},

	blinkNode: function(time, node) {
		node = node || this.hc.item || this.hc.origItem;
		if(!node)
			return;
		time = time || 170;
		var oldFx = this.ut.fxVersion <= 2;
		this.ut.toArray(node).forEach(
			function(node) {
				var attr = this.blinkAttr;
				node.setAttribute(attr, "true");
				if(oldFx) {
					var origStyle = node.hasAttribute("style") && node.getAttribute("style");
					node.style.setProperty("opacity", this.blinkOpacity, "important");
				}
				this.ut.timeout(
					function(node, attr, oldFx, origStyle) {
						node.removeAttribute(attr);
						oldFx && this.ut.attribute(node, "style", origStyle, true);
					},
					this, [node, attr, oldFx, origStyle],
					time
				);
			},
			this
		);
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
		this.ut.notifyInWindowCorner(this.ut.getLocalized(en ? "enabled" : "disabled"), null, null, null, en);
	},
	checkClipboard: function() {
		const id = "handyClicks-importFromClipboard";
		this.$(id).hidden = this.$(id + "Separator").hidden = !this.ps.checkPrefsStr(this.ut.readFromClipboard(true));
	},
	fixPopup: function() {
		if(document.popupNode)
			this.ut.closeMenus(document.popupNode); // For Firefox 2.0
	},
	doSettings: function(e) {
		if(e.type == "command" || e.button == 0)
			this.toggleStatus();
		else if(e.button == 1) {
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
			? this.ut.getLocalized("editModeTip").replace("%k", exitKey)
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
		var _this = this;
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized("editModeNote").replace("%k", exitKey),
			this.ut.getLocalized("editModeTitle"),
			function() { _this.hc.editMode = false; }
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
		if(enabled && this.ps._skippedLoad)
			this.ps.loadSettings();
		var tt = this.ut.getLocalized(enabled ? "enabledTip" : "disabledTip");
		var ttAttr = this.tooltipAttrBase + "0";
		this.setControls(function(elt) {
			elt.setAttribute("hc_enabled", enabled);
			elt.setAttribute(ttAttr, tt);
		});
		this.$("handyClicks-cmd-editMode").setAttribute("disabled", !enabled);
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
		].forEach(
			function(elt) {
				elt && func.call(context || this, elt);
			},
			this
		);
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
		var keyStr = this.pu.pref("key." + kId);
		if(!keyStr) // Key is disabled
			return;
		var tokens = keyStr.split(" ");
		var key = tokens.pop() || " ";
		var modifiers = tokens.join(",");
		var kElt = this.e("handyClicks-key-" + kId);
		kElt.removeAttribute("disabled");
		kElt.setAttribute(key.indexOf("VK_") == 0 ? "keycode" : "key", key);
		kElt.setAttribute("modifiers", modifiers);
	},

	// Uninstall observer:
	get oSvc() {
		return Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	},
	initUninstallObserver: function() {
		this.oSvc.addObserver(this, "em-action-requested", false);
	},
	destroyUninstallObserver: function() {
		this.oSvc.removeObserver(this, "em-action-requested");
	},
	observe: function(subject, topic, data) {
		if(
			topic == "em-action-requested"
			&& subject instanceof Components.interfaces.nsIUpdateItem
			&& subject.id == "handyclicks@infocatcher"
			&& data == "item-uninstalled"
			&& !this.ut.storage("uninstalled")
		) {
			this.ut.storage("uninstalled", true);
			this.uninstall();
		}
	},
	uninstall: function() {
		var ps = this.ut.promptsSvc;
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		var win = this.wu.wm.getMostRecentWindow("Extension:Manager") || window;
		var button = ps.confirmEx(
			win, this.ut.getLocalized("title"),
			this.ut.getLocalized("removeSettingsConfirm"),
			  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_1_DEFAULT,
			this.ut.getLocalized("removeSettings"), "", "",
			null, {}
		);
		if(button == 1) // Cancel
			return;

		//this.pu.prefSvc.deleteBranch(this.pu.prefNS);
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(
				function(pName) {
					this.pu.resetPref(this.pu.prefNS + pName);
				},
				this
			);

		//this.ps._prefsDir.remove(true);
		// Based on components/nsExtensionManager.js from Firefox 3.6
		function removeDirRecursive(dir) {
			try {
				dir.remove(true);
				return;
			}
			catch(e) {
			}
			var dirEntries = dir.directoryEntries;
			while(dirEntries.hasMoreElements()) {
				var entry = dirEntries.getNext().QueryInterface(Components.interfaces.nsIFile);
				if(entry.isDirectory())
					arguments.callee.call(this, entry);
				else {
					entry.permissions = 0644;
					entry.remove(false);
				}
			}
			dir.permissions = 0755;
			dir.remove(true);
		}
		removeDirRecursive(this.ps._prefsDir);
	}
};
var handyClicksSetsUtils = {
	__proto__: handyClicksGlobals,

	instantInit: function(reloadFlag) {
		if(!reloadFlag && this.fxVersion <= 2) {
			var sheet = document.styleSheets[0];
			sheet.insertRule("tooltip > description { white-space: -moz-pre-wrap; }", sheet.cssRules.length);
			// Fix for right-placed icon glitches in Firefox 1.5 and 2.0
			sheet.insertRule("button:not([hc_hideLabel='true']) .button-icon { opacity: 0.9999; }", sheet.cssRules.length);
		}
	},
	init: function(reloadFlag) {
		window.addEventListener(this.ut.wheelEvent, this, true);
		window.addEventListener("dragenter", this, true);
		window.addEventListener("dragexit", this, true);
		this.pu.oSvc.addObserver(this.prefsChanged, this);
		if(!reloadFlag) {
			this.tweakDialogButtons();
			this.setEnabledStatus();
			var de = document.documentElement;
			de.setAttribute("chromedir", window.getComputedStyle(de, null).direction);
			var slimFloatButtons = this.fxVersion >= 56 && (this.isFirefox || this.isSeaMonkey);
			de.setAttribute("hc_slimFloatButtons", slimFloatButtons);
			this.checkWindowStatus(true);
			this.delay(this.setKeysDesc, this, 10);
			this.delay(this.setDropEvents, this, 20);
		}
		if(this.hasSizeModeChangeEvent)
			window.addEventListener("sizemodechange", this, false);
		else {
			window.addEventListener("resize", this, false); // Can detect only maximize/restore
			this.legacySizeModeChange();
		}
	},
	destroy: function(reloadFlag) {
		window.removeEventListener(this.ut.wheelEvent, this, true);
		window.removeEventListener("dragenter", this, true);
		window.removeEventListener("dragexit", this, true);
		if(this.hasSizeModeChangeEvent)
			window.removeEventListener("sizemodechange", this, false);
		else {
			window.removeEventListener("resize", this, false);
			clearInterval(this._sizeModeChangeTimer);
		}
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "DOMMouseScroll": // Legacy
			case "wheel":          this.handleScroll(e);     break;
			case "dragenter":      this.dragenterHandler(e); break;
			case "dragexit":       this.dragexitHandler(e);  break;
			case "resize": // Legacy
			case "sizemodechange": this.checkWindowStatus();
		}
	},
	get dropEvent() {
		delete this.dropEvent;
		var v = this.fxVersion;
		return this.dropEvent = v < 3
			? "dragexit"
			: v < 3.7
				? "dragend"
				: "drop";
	},
	tweakDialogButtons: function() {
		// Insert Apply button between Ok and Cancel
		var de = document.documentElement;
		var okBtn = de.getButton("accept");
		var applyBtn = de.getButton("extra1");
		var cancelBtn = de.getButton("cancel");
		var btnBox = okBtn.parentNode;
		for(var node = btnBox.firstChild; node; node = node.nextSibling) {
			if(node == okBtn || node == cancelBtn) {
				node = node.nextSibling;
				if(node != applyBtn)
					btnBox.insertBefore(applyBtn, node);
				break;
			}
		}

		okBtn.setAttribute("hc_key", "hc-sets-key-accept");
		applyBtn.className += " hc-iconic hc-apply";
		applyBtn.setAttribute("hc_key", "hc-sets-key-apply");
	},
	setDropEvents: function() {
		var onDrop = "on" + this.dropEvent;
		Array.prototype.slice.call(document.getElementsByAttribute("hc_ondrop", "*")).forEach(
			function(elt) {
				elt.setAttribute(onDrop, elt.getAttribute("hc_ondrop"));
				elt.removeAttribute("hc_ondrop");
			}
		);
	},
	initPrefsMenu: function(popup) {
		Array.prototype.forEach.call(
			popup.getElementsByAttribute("hc_pref", "*"),
			function(mi) {
				mi.setAttribute("checked", this.pu.get(mi.getAttribute("hc_pref")));
			},
			this
		);
	},
	handlePrefCommand: function(mi) {
		if(mi.hasAttribute("hc_pref"))
			this.pu.set(mi.getAttribute("hc_pref"), mi.getAttribute("checked") == "true");
	},

	onTopAttr: "hc_onTop",
	onTopNAAttr: "hc_onTopNA",
	get onTopBtn() {
		delete this.onTopBtn;
		return this.onTopBtn = this.$("hc-sets-onTop");
	},
	checkWindowStatus: function(checkOpener) {
		var onTopBtn = this.onTopBtn;
		var top = this.topWindow;
		var na = "" + (top.windowState != top.STATE_NORMAL);
		if(onTopBtn.getAttribute(this.onTopNAAttr) == na)
			return;
		onTopBtn.setAttribute(this.onTopNAAttr, na);
		this.setOnTop(false, checkOpener);
	},
	setOnTop: function(toggle, checkOpener) {
		var root = document.documentElement;
		var onTop = root.getAttribute(this.onTopAttr) == "true";
		var forceOnTop = checkOpener && !onTop && !toggle
			&& opener && opener.document
			&& opener.document.documentElement.getAttribute(this.onTopAttr) == "true";
		if(toggle || forceOnTop) {
			onTop = !onTop;
			root.setAttribute(this.onTopAttr, onTop);
			root.id && document.persist(root.id, this.onTopAttr);
		}
		var top = this.topWindow;
		var state = top.windowState;
		// Strange glitches with minimized "raisedZ" window...
		var restore = onTop && state == top.STATE_MINIMIZED;
		if((restore || state == top.STATE_NORMAL) && (!checkOpener || onTop)) {
			if(restore)
				onTop = false;
			var xulWin = this.wu.getXulWin(top);
			var z = onTop ? xulWin.raisedZ : xulWin.normalZ;
			if(xulWin.zLevel != z)
				xulWin.zLevel = z;
		}
		this.showOnTopStatus(onTop);
	},
	toggleOnTop: function() {
		this.setOnTop(true);
	},
	showOnTopStatus: function(onTop) {
		var root = document.documentElement;
		if(onTop === undefined)
			onTop = root.getAttribute(this.onTopAttr) == "true";
		var btnVisible = this.pu.get("ui.onTopButton");
		var btn = this.onTopBtn;
		btn.hidden = !btnVisible;
		if(btnVisible) {
			btn.setAttribute("checked", onTop); // + autoCheck="false"
			btn.setAttribute("hc_hideLabel", !this.pu.get("ui.onTopButtonLabel"));
		}
		var s = root.style;
		if(onTop && !btnVisible) {
			s.outline = "2px groove " + (this.pu.get("ui.onTopBorderColor") || "orange");
			s.outlineOffset = "-2px";
		}
		else {
			s.outline = s.outlineOffset = "";
		}
	},
	toggleOnTopButton: function() {
		const p = "ui.onTopButton";
		this.pu.set(p, !this.pu.get(p));
	},

	maximizeWindow: function(win) {
		win = win || top;
		if("fullScreen" in win && win.fullScreen)
			win.fullScreen = false;
		else if(win.windowState == win.STATE_MAXIMIZED)
			win.restore();
		else
			win.maximize();
	},
	toggleFullscreen: function(win) {
		win = win || top;
		if("fullScreen" in win) // Firefox 3.0+
			win.fullScreen = !win.fullScreen;
	},

	setEnabledStatus: function(enabled) {
		if(enabled === undefined)
			enabled = this.pu.get("enabled");
		document.documentElement.setAttribute("hc_globallyDisabled", !enabled);
	},

	get hasSizeModeChangeEvent() {
		delete this.hasSizeModeChangeEvent;
		return this.hasSizeModeChangeEvent = this.fxVersion >= 8;
	},
	_sizeModeChangeTimer: 0,
	legacySizeModeChange: function() {
		var lastState = window.windowState;
		this._sizeModeChangeTimer = setInterval(function(_this) {
			var state = window.windowState;
			if(state != lastState)
				_this.checkWindowStatus();
			lastState = state;
		}, 350, this);
	},
	prefsChanged: function(pName, pVal) {
		switch(pName) {
			case "enabled":
				this.setEnabledStatus(pVal);
			break;
			case "ui.onTopButton":
			case "ui.onTopButtonLabel":
			case "ui.onTopBorderColor":
				this.showOnTopStatus();
		}
	},

	modifiedFlag: "* ",
	get importFlag() {
		delete this.importFlag;
		return this.importFlag = this.ut.trim(this.getLocalized("importFlag")) + " ";
	},
	removeTitleFlags: function(title) {
		title = this.ju.removePrefix(title, this.modifiedFlag);
		title = this.ju.removePrefix(title, this.importFlag);
		return title;
	},
	createTitle: function(title, isModified, isImport) {
		// [modifiedFlag] [importFlag] [title]
		return (isModified ? this.modifiedFlag : "")
			+ (isImport ? this.importFlag : "")
			+ this.removeTitleFlags(title);
	},

	PROMPT_SAVE: 0,
	PROMPT_CANCEL: 1,
	PROMPT_DONT_SAVE: 2,
	notifyUnsaved: function(msg, askPref) {
		if(!msg)
			msg = this.getLocalized("notifyUnsaved");
		if(!askPref)
			askPref = "ui.notifyUnsaved";
		if(!this.pu.get(askPref))
			return this.PROMPT_DONT_SAVE;
		var ps = this.ut.promptsSvc;
		this.ut.ensureNotMinimized();
		var dontAsk = { value: false };
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		var ret = ps.confirmEx(
			window,
			this.getLocalized("warningTitle"),
			msg,
			  ps["BUTTON_POS_" + this.PROMPT_SAVE]      * ps.BUTTON_TITLE_SAVE
			+ ps["BUTTON_POS_" + this.PROMPT_CANCEL]    * ps.BUTTON_TITLE_CANCEL
			+ ps["BUTTON_POS_" + this.PROMPT_DONT_SAVE] * ps.BUTTON_TITLE_DONT_SAVE
			+ ps["BUTTON_POS_" + this.PROMPT_SAVE + "_DEFAULT"],
			"", "", "",
			this.getLocalized("dontAskAgain"),
			dontAsk
		);
		if(ret != this.PROMPT_CANCEL && dontAsk.value)
			this.pu.set(askPref, false);
		return ret;
	},
	confirmReload: function() {
		var askPref = "ui.confirmReload";
		if(!this.pu.get(askPref))
			return true;
		var dontAsk = { value: false };
		var confirmed = this.ut.confirmEx(
			this.getLocalized("warningTitle"),
			this.getLocalized("confirmReload"),
			this.getLocalized("reload"),
			true,
			this.getLocalized("dontAskAgain"),
			dontAsk
		);
		if(confirmed && dontAsk.value)
			this.pu.set(askPref, false);
		return confirmed;
	},

	get topWindow() {
		return window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
			.rootTreeItem
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindow);
	},

	_allowScroll: 0,
	handleScroll: function(e) {
		if(
			e.target.nodeType == Node.DOCUMENT_NODE
			|| !this.pu.get("sets.scrollLists")
		)
			return;
		var aw = this.wu.ww.activeWindow;
		if(aw && aw.location.href == "chrome://global/content/commonDialog.xul")
			return; // Scroll still works for disabled window...
		if(aw && this.pu.get("sets.scrollLists.onlyInActiveWindow") && aw != this.topWindow)
			return;

		// Forbid too quickly scroll
		var now = Date.now();
		if(now < this._allowScroll)
			return;
		this._allowScroll = now + 50;

		if(this.hasScrollbar(e))
			return;

		if(
			this.scrollList(e)
			|| this.scrollRadioMenuitems(e)
			|| this.scrollNumTextbox(e)
			|| this.scrollTabs(e)
			|| this.scrollTabsToolbar(e)
			|| this.scrollRadios(e)
		)
			this.ut.stopEvent(e);
	},
	hasScrollbar: function(e) {
		for(var node = e.originalTarget; node; node = node.parentNode) {
			var sh = node.scrollHeight || 0;
			var ch = node.clientHeight || 0;
			if(ch && sh > ch && getComputedStyle(node, null).overflowY == "auto") {
				if(this._debug) {
					var info = node.nodeName
						+ (node.id ? "#" + node.id : "")
						+ (node.className ? "." + node.className.split(/\s+/).join(".") : "")
						+ " scrollHeight: " + sh + " clientHeight: " + ch;
					if(info != this._loggedInfo || "") {
						this._loggedInfo = info;
						this._log("Detected scrollbar: " + info);
					}
				}
				return true;
			}
		}
		return false;
	},
	isScrollForward: function(e) {
		var fwd = "deltaY" in e
			? e.deltaY > 0 // wheel
			: e.detail > 0; // DOMMouseScroll
		return this.pu.get("ui.reverseScrollDirection") ? !fwd : fwd;
	},
	scrollList: function(e) {
		var ml = e.target;
		var ln = ml.localName;
		if(ln == "menuitem" || ln == "menuseparator") {
			ml = ml.parentNode.parentNode;
			ln = ml.localName;
		}
		if(ln != "menulist" || ml.disabled)
			return false;
		var mp = ml.menupopup;

		if(ml.open) {
			var popupHeight = (mp.boxObject.firstChild || mp).boxObject.height;
			var childsHeight = 0;
			Array.prototype.forEach.call(
				mp.childNodes,
				function(ch) {
					childsHeight += ch.boxObject.height;
				}
			);
			//this._log("popupHeight: " + popupHeight + "\nchildsHeight: " + childsHeight);
			if(childsHeight > popupHeight) // Has scrollbar
				return false;
		}

		var fwd = this.isScrollForward(e);
		var si = ml.selectedItem || (fwd ? mp.firstChild : mp.lastChild);
		var si0 = si;
		var next = function() {
			si = fwd
				? si.nextSibling || mp.firstChild
				: si.previousSibling || mp.lastChild;
		};
		for(;;) {
			next();
			if(si == si0)
				break;
			if(
				si.getAttribute("disabled") != "true"
				&& si.localName == "menuitem"
				&& this.ut.isElementVisible(si)
			)
				break
		}
		if(si == ml.selectedItem)
			return false;
		ml.selectedItem = si;
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
		return true;
	},
	_showTooltip: false,
	scrollRadioMenuitems: function(e) {
		// Note: we don't receive scroll events from opened menu itself
		var rds = this.getSameLevelRadios(e.target);
		if(!rds.length)
			return false;
		var si, indx;
		rds.some(function(rd, i) {
			if(rd.getAttribute("checked") == "true") {
				si = rd;
				indx = i;
				return true;
			}
			return false;
		});
		var fwd = this.isScrollForward(e);
		indx = fwd
			? !si || indx == rds.length - 1
				? 0
				: indx + 1
			: !si || indx == 0
				? rds.length - 1
				: indx - 1;
		si = rds[indx];
		si.doCommand();
		//si.setAttribute("checked", "true");
		rds.forEach(function(rd, i) {
			// Strange things happens for hidden items...
			this.attribute(rd, "checked", i == indx);
		}, this);
		if(this._showTooltip)
			this.showInfoTooltip(e.target, si.getAttribute("label"), this.TOOLTIP_HIDE_QUICK, this.TOOLTIP_OFFSET_CURSOR);
		return true;
	},
	getSameLevelRadios: function(elt) {
		var isClosedMenu = false;
		if(elt.localName == "menu" || elt.getAttribute("type") == "menu") {
			isClosedMenu = elt.getAttribute("open") != "true";
			var mp = elt.firstChild;
			isClosedMenu && this.ensureMenupopupInitialized(mp);
			elt = mp && mp.firstChild;
			if(!elt)
				return null;
		}
		this._showTooltip = isClosedMenu;
		return Array.prototype.filter.call(
			elt.parentNode.childNodes,
			function(elt) {
				return "getAttribute" in elt
					&& elt.getAttribute("type") == "radio"
					&& elt.getAttribute("disabled") != "true"
					&& (
						isClosedMenu
							? elt.getAttribute("collapsed") != "true" && elt.getAttribute("hidden") != "true"
							: this.ut.isElementVisible(elt)
					);
			},
			this
		);
	},
	ensureMenupopupInitialized: function(mp) {
		this._log("ensureMenupopupInitialized()");
		mp.collapsed = true;
		mp["openPopup" in mp ? "openPopup" : "showPopup"]();
		mp.hidePopup();
		mp.collapsed = false;
	},
	scrollNumTextbox: function(e) {
		var tar = e.target;
		if(
			tar.localName != "textbox" || tar.getAttribute("type") != "number"
			|| tar.getAttribute("disabled") == "true"
			|| !("increase" in tar) || !("decrease" in tar) || !("_fireChange" in tar)
		)
			return false;
		tar[this.isScrollForward(e) ? "increase" : "decrease"]();
		tar._fireChange();
		return true;
	},
	scrollTabs: function(e) {
		for(var node = e.target; node && "localName" in node; node = node.parentNode) {
			if(node.localName == "tabs") {
				node.advanceSelectedTab(this.isScrollForward(e) ? 1 : -1, true);
				return true;
			}
		}
		return false;
	},
	scrollTabsToolbar: function(e) {
		for(var node = e.target; node; node = node.parentNode) {
			if("className" in node && /(?:^|\s)hcTabsToolbar(?:\s|$)/.test(node.className)) {
				var tabbox = node.parentNode.parentNode;
				var tabs = tabbox.tabs || tabbox.getElementsByTagNameNS(this.ut.XULNS, "tabs")[0];
				tabs.advanceSelectedTab(this.isScrollForward(e) ? 1 : -1, true);
				return true;
			}
		}
		return false;
	},
	scrollRadios: function(e) {
		for(var node = e.originalTarget; node && "localName" in node; node = node.parentNode) {
			if(node.localName != "radiogroup")
				continue;
			var maxIndx = (node.itemCount || node._getRadioChildren().length) - 1;
			if(maxIndx < 0)
				return false;
			var fwd = this.isScrollForward(e);
			var si = node.selectedIndex;
			if(si < 0 || si > maxIndx)
				si = fwd ? 0 : maxIndx;
			var si0 = si;
			var add = fwd ? 1 : -1;
			var next = function() {
				si += add;
				if(si < 0)
					si = maxIndx;
				else if(si > maxIndx)
					si = 0;
			};
			var get = function(indx) {
				if("getItemAtIndex" in node)
					return node.getItemAtIndex(indx);
				var children = node._getRadioChildren();
				return indx >= 0 && indx < children.length ? children[indx] : null;
			};
			for(;;) {
				next();
				if(si == si0)
					return false;
				var it = get(si);
				if(
					it.getAttribute("disabled") != "true"
					&& this.ut.isElementVisible(it)
				)
					break
			}
			if(si == node.selectedIndex)
				return false;
			node.selectedIndex = si;
			it.doCommand();
			return true;
		}
		return false;
	},

	_dragSwitchTimer: 0,
	_lastDragOverNode: null,
	_handleDragEvents: true,
	dragenterHandler: function(e) {
		if(!this._handleDragEvents)
			return;
		var tar = e.originalTarget;
		var ln = tar.localName;
		if(!ln || tar.getAttribute("disabled") == "true" || tar.getAttribute("selected") == "true")
			return;
		var selectHandler;
		if(ln == "tab")
			selectHandler = this.selectTab;
		else if(ln == "radio" && /(?:^|\s)paneSelector(?:\s|$)/.test(tar.parentNode.className))
			selectHandler = this.selectRadio;
		if(!selectHandler)
			return;

		var prevNode = this._lastDragOverNode;
		if(tar != prevNode) {
			if(prevNode)
				prevNode.removeAttribute("hc_canDragSwitch");
			this._lastDragOverNode = tar;
			tar.setAttribute("hc_canDragSwitch", "true");
		}

		var _this = this;
		var dragSwitch = function() {
			tar.removeAttribute("hc_canDragSwitch");
			selectHandler.call(_this, tar);
		};
		var delay = this.pu.get("ui.dragSwitchDelay");
		if(delay <= 0 || this.fxVersion < 3)
			dragSwitch();
		else {
			clearTimeout(this._dragSwitchTimer);
			this._dragSwitchTimer = setTimeout(dragSwitch, delay);
		}
	},
	dragexitHandler: function(e) {
		clearTimeout(this._dragSwitchTimer);
		if(this._lastDragOverNode) {
			this._lastDragOverNode.removeAttribute("hc_canDragSwitch");
			this._lastDragOverNode = null;
		}
	},
	selectTab: function(tab) {
		for(var node = tab.parentNode; node; node = node.parentNode) {
			if(node.localName == "tabbox") {
				node.selectedTab = tab;
				return;
			}
		}
	},
	selectRadio: function(radio) {
		radio.doCommand();
	},

	TOOLTIP_HIDE_DEFAULT: 2600,
	TOOLTIP_HIDE_QUICK: 800,
	TOOLTIP_HIDE_SLOW: 5000,
	TOOLTIP_OFFSET_DEFAULT: 2,
	TOOLTIP_OFFSET_CURSOR: 12,
	get infoTooltip() {
		var tt = document.createElement("tooltip");
		tt.id = "handyClicks-infoTooltip";
		tt.appendChild(document.createElement("description"));
		delete this.infoTooltip;
		return this.infoTooltip = document.documentElement.appendChild(tt);
	},
	showInfoTooltip: function _sit(anchor, msg, hideDelay, offset, tt) {
		if(!tt) {
			if(!msg)
				return;
			tt = this.infoTooltip;
			tt.firstChild.textContent = msg;
		}
		var bo = anchor.boxObject;
		var x = bo.screenX;
		var y = bo.screenY + bo.height + (offset === undefined ? this.TOOLTIP_OFFSET_DEFAULT : offset);
		tt.onmouseover = null; // Trick to show tooltip under cursor
		if("openPopupAtScreen" in tt) // Firefox 3.0+
			tt.openPopupAtScreen(x, y, false /*isContextMenu*/);
		else
			tt.showPopup(anchor, x, y, "tooltip", null, null);
		setTimeout(function() {
			tt.onmouseover = function() {
				this.hidePopup();
			};
		}, 25);
		if(_sit.hasOwnProperty("timeout"))
			clearTimeout(_sit.timeout);
		_sit.timeout = setTimeout(function(tt) {
			tt.hidePopup();
		}, hideDelay || this.TOOLTIP_HIDE_DEFAULT, tt);
	},
	showTooltip: function(tt, anchor, hideDelay, offset) {
		this.showInfoTooltip(anchor, "", hideDelay, offset, tt);
	},

	setKeysDesc: function() {
		//~ hack: show fake hidden popup with <menuitem key="keyId" /> to get descriptions
		var mp = document.createElement("menupopup");
		mp.style.visibility = "collapse";
		function addNode(node) {
			var keyId = node.getAttribute("hc_key");
			if(!keyId)
				return;
			var mi = document.createElement("menuitem");
			mi.__node = node;
			mi.setAttribute("key", keyId);
			mp.appendChild(mi);
		}
		var forEach = Array.prototype.forEach;
		var de = document.documentElement;
		forEach.call(document.getElementsByAttribute("hc_key", "*"), addNode);
		forEach.call(de.getButton("cancel").parentNode.childNodes, addNode);
		mp._onpopupshown = function() {
			forEach.call(mp.childNodes, function(mi) {
				var keyDesk = mi.getAttribute("acceltext");
				if(!keyDesk)
					return;
				var node = mi.__node;
				node.tooltipText = node.tooltipText
					? node.tooltipText + " (" + keyDesk + ")"
					: keyDesk;
			});
			mp.parentNode.removeChild(mp);
		};
		mp.setAttribute("onpopupshown", "this._onpopupshown();");
		de.appendChild(mp);
		mp["openPopup" in mp ? "openPopup" : "showPopup"]();
	},

	fixAccelWidth: function(mp) {
		if(this.fxVersion >= 4)
			return;
		var evt = document.createEvent("Events");
		evt.initEvent("popupshowing", false, false);
		evt._hcIgnore = false;
		mp.dispatchEvent(evt);
	},

	extLabels: {
		mthCloseTabs:           ["popup.selection.removeTabs",    "chrome://multipletab/locale/multipletab.dtd"],
		mthCloseOtherTabs:      ["popup.selection.removeOther",   "chrome://multipletab/locale/multipletab.dtd"],
		mthReloadTabs:          ["popup.selection.reloadTabs",    "chrome://multipletab/locale/multipletab.dtd"],
		mthAddBookmarkFor:      ["popup.selection.addBookmark",   "chrome://multipletab/locale/multipletab.dtd"],
		mthDuplicateTabs:       ["popup.selection.duplicateTabs", "chrome://multipletab/locale/multipletab.dtd"],
		mthSplitWindowFromTabs: ["popup.selection.splitWindow",   "chrome://multipletab/locale/multipletab.dtd"],
		__proto__: null
	},
	getExtLabel: function(name) {
		return this.ut.getLocalizedEntity.apply(this.ut, this.extLabels[name]);
	},
	getActionLabel: function(fo) {
		if(fo.custom)
			return this.ps.localize(fo.label || "");
		var act = fo.action;
		if(act in this.extLabels)
			return this.getExtLabel(act);
		return this.getLocalized(act);
	},

	confirmTypeAction: function(type, key, prefs) {
		var related = key == "typeDeletingWarning"
			? this.getSettingsForType(type, prefs)
			: this.getActiveSettingsForType(type, prefs);
		return !related || this.ut.confirm(
			this.getLocalized("warningTitle"),
			this.getLocalized(key)
				.replace("%t", this.ps.getTypeLabel(type, true))
				.replace("%n", related)
		);
	},
	getSettingsForType: function(type, prefs) {
		prefs = prefs || this.ps.prefs;
		var cnt = 0;
		for(var sh in prefs)
			if(this.ju.getOwnProperty(prefs, sh, type))
				++cnt;
		return cnt;
	},
	getActiveSettingsForType: function(type, prefs) {
		prefs = prefs || this.ps.prefs;
		var cnt = 0;
		for(var sh in prefs)
			if(this.ju.getOwnProperty(prefs, sh, type, "enabled"))
				++cnt;
		return cnt;
	}
};
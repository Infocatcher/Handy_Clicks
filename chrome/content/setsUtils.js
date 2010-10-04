var handyClicksSetsUtils = {
	init: function(reloadFlag) {
		window.addEventListener("DOMMouseScroll", this, true);
		window.addEventListener("dragenter", this, true);
		window.addEventListener("dragexit", this, true);
		this.pu.oSvc.addObserver(this.prefsChanged, this);
		if(!reloadFlag)
			this.createFloatToolbar();
		Array.slice(document.getElementsByAttribute("hc_ondrop", "*")).forEach(
			function(elt) {
				elt.setAttribute("on" + this.dropEvent, elt.getAttribute("hc_ondrop"));
				elt.removeAttribute("hc_ondrop");
			},
			this
		);

		// Insert Apply button between Ok and Cancel
		var de = document.documentElement;
		var okBtn = de.getButton("accept");
		var cancelBtn = de.getButton("cancel");
		var btnBox = okBtn.parentNode;
		for(var node = btnBox.firstChild; node; node = node.nextSibling) {
			if(node == okBtn || node == cancelBtn) {
				node = node.nextSibling;
				var applyBtn = de.getButton("extra1");
				if(node != applyBtn)
					btnBox.insertBefore(applyBtn, node);
				break;
			}
		}
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("DOMMouseScroll", this, true);
		window.removeEventListener("dragenter", this, true);
		window.removeEventListener("dragexit", this, true);
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "DOMMouseScroll":
				if(e.target.nodeType == Node.DOCUMENT_NODE)
					break;
				if(
					this.scrollList(e)
					|| this.scrollRadioMenuitems(e)
					|| this.scrollNumTextbox(e)
					|| this.scrollTabs(e)
					|| this.scrollTabsToolbar(e)
					|| this.scrollRadios(e)
				)
					this.ut.stopEvent(e);
			break;
			case "dragenter": this.dragenterHandler(e); break;
			case "dragexit":  this.dragexitHandler(e);
		}
	},
	get dropEvent() {
		delete this.dropEvent;
		var v = this.ut.fxVersion;
		return this.dropEvent = v < 3
			? "dragexit"
			: v < 3.7
				? "dragend"
				: "drop";
	},
	createFloatToolbar: function() {
		var de = document.documentElement;
		de.setAttribute("chromedir", window.getComputedStyle(de, null).direction);

		var onTop = this.ut.parseFromXML(
			<hbox xmlns={this.ut.XULNS} id="hc-sets-floatToolbar"
				oncommand="event.stopPropagation();">
				<button id="hc-sets-onTop"
					class="hcFloatButton"
					type="checkbox" autoCheck="false"
					context="hc-sets-onTopContext"
					hidden={ !this.pu.pref("ui.onTopButton") }
					oncommand="handyClicksWinUtils.toggleOnTop();"
					hc_key="hc-sets-key-toggleOnTop"
					label={ this.ut.getLocalized("onTop") }
					tooltiptext={ this.ut.getLocalized("onTopTip") }
				/>
				<menupopup id="hc-sets-onTopContext"
					onpopupshowing="handyClicksSetsUtils.initOnTopContext(this);"
					oncommand="handyClicksSetsUtils.handleOnTopContextCommand(event.target);">
					<menuitem id="hc-sets-onTopButtonLabel" type="checkbox"
						hc_pref="ui.onTopButtonLabel"
						label={ this.ut.getLocalized("onTopButtonLabel") }
					/>
				</menupopup>
			</hbox>
		);
		de.appendChild(onTop);

		var onTop = de.getAttribute("hc_onTop") == "true";
		if(!onTop && opener) {
			var xulWin = this.wu.getXulWin(opener);
			onTop = xulWin.zLevel > xulWin.normalZ;
		}
		if(onTop)
			this.wu.toggleOnTop(true);
		else
			this.wu.showOnTopStatus();
	},
	initOnTopContext: function(popup) {
		Array.forEach(
			popup.getElementsByTagName("menuitem"),
			function(mi) {
				mi.setAttribute("checked", this.pu.pref(mi.getAttribute("hc_pref")));
			},
			this
		);
	},
	handleOnTopContextCommand: function(mi) {
		this.pu.pref(mi.getAttribute("hc_pref"), mi.getAttribute("checked") == "true");
	},
	prefsChanged: function(pName, pVal) {
		switch(pName) {
			case "ui.onTopButton":
			case "ui.onTopButtonLabel":
			case "ui.onTopBorderColor":
				this.wu.showOnTopStatus();
		}
	},

	modifiedFlag: "* ",
	get importFlag() {
		delete this.importFlag;
		return this.importFlag = this.ut.trim(this.ut.getLocalized("importFlag")) + " ";
	},
	removeTitleFlags: function(title) {
		title = this.ut.removePrefix(title, this.modifiedFlag);
		title = this.ut.removePrefix(title, this.importFlag);
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
	notifyUnsaved: function() {
		if(!this.pu.pref("ui.notifyUnsaved"))
			return this.PROMPT_DONT_SAVE;
		var ps = this.ut.promptsSvc;
		this.ut.fixMinimized();
		var ask = { value: false };
		// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
		// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
		var ret = ps.confirmEx(
			window,
			this.ut.getLocalized("warningTitle"),
			this.ut.getLocalized("notifyUnsaved"),
			  ps["BUTTON_POS_" + this.PROMPT_SAVE]      * ps.BUTTON_TITLE_SAVE
			+ ps["BUTTON_POS_" + this.PROMPT_CANCEL]    * ps.BUTTON_TITLE_CANCEL
			+ ps["BUTTON_POS_" + this.PROMPT_DONT_SAVE] * ps.BUTTON_TITLE_DONT_SAVE
			+ ps["BUTTON_POS_" + this.PROMPT_SAVE + "_DEFAULT"],
			"", "", "",
			this.ut.getLocalized("dontAskAgain"), ask
		);
		if(ret != this.PROMPT_CANCEL && ask.value)
			this.pu.pref("ui.notifyUnsaved", false);
		return ret;
	},

	isScrollForward: function(e) {
		var fwd = e.detail > 0;
		return this.pu.pref("ui.reverseScrollDirection") ? !fwd : fwd;
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
			Array.forEach(
				mp.childNodes,
				function(ch) {
					childsHeight += ch.boxObject.height;
				}
			);
			//this.ut._log(<>popupHeight: {popupHeight}{"\n"}childsHeight: {childsHeight}</>);
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
			this.ut.attribute(rd, "checked", i == indx);
		}, this);
		if(this._showTooltip)
			this.showInfoTooltip(e.target, si.getAttribute("label"), this.TOOLTIP_HIDE_QUICK, this.TOOLTIP_OFFSET_CURSOR);
		return true;
	},
	getSameLevelRadios: function(elt) {
		var isClosedMenu = false;
		if(elt.localName == "menu" || elt.getAttribute("type") == "menu") {
			isClosedMenu = elt.getAttribute("open") != "true";
			elt = elt.hasChildNodes() && elt.firstChild.firstChild;
			if(!elt)
				return null;
		}
		this._showTooltip = isClosedMenu;
		return Array.filter(
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
		for(var node = e.target; node; node = node.parentNode) {
			if(node.localName == "tabs") {
				node.advanceSelectedTab(this.isScrollForward(e) ? 1 : -1, true);
				return true;
			}
		}
		return false;
	},
	scrollTabsToolbar: function(e) {
		for(var node = e.target; node; node = node.parentNode) {
			if(/(?:^|\s)hcTabsToolbar(?:\s|$)/.test(node.className)) {
				var tabbox = node.nextSibling;
				var tabs = tabbox.tabs || tabbox.getElementsByTagNameNS(this.ut.XULNS, "tabs")[0];
				tabs.advanceSelectedTab(this.isScrollForward(e) ? 1 : -1, true);
				return true;
			}
		}
		return false;
	},
	scrollRadios: function(e) {
		for(var node = e.originalTarget; node; node = node.parentNode) {
			if(node.localName == "radiogroup") {
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
		}
		return false;
	},

	dragSwitch: true,
	dragenterHandler: function(e) {
		var tar = e.originalTarget;
		var ln = tar.localName;
		if(!ln || tar.getAttribute("disabled") == "true" || tar.getAttribute("selected") == "true")
			return;
		var selectHandler;
		if(ln == "tab")
			selectHandler = "selectTab";
		else if(ln == "radio" && /(?:^|\s)paneSelector(?:\s|$)/.test(tar.parentNode.className))
			selectHandler = "selectRadio";
		if(!selectHandler)
			return;
		tar.setAttribute("hc_canDragSwitch", "true");
		this.dragSwitch = true;
		var _this = this;
		var dragSwitch = function() {
			tar.removeAttribute("hc_canDragSwitch");
			if(_this.dragSwitch)
				_this[selectHandler](tar);
		};
		var delay = this.pu.pref("ui.dragSwitchDelay");
		if(delay > 0 && this.ut.fxVersion >= 3)
			setTimeout(dragSwitch, delay);
		else
			dragSwitch();
	},
	dragexitHandler: function(e) {
		this.dragSwitch = false;
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
	TOOLTIP_OFFSET_DEFAULT: 2,
	TOOLTIP_OFFSET_CURSOR: 12,
	get infoTooltip() {
		delete this.infoTooltip;
		return this.infoTooltip = document.documentElement.appendChild(
			this.ut.parseFromXML(
				<tooltip xmlns={this.ut.XULNS} id="handyClicks-infoTooltip" onmouseover="this.hidePopup();">
					<description />
				</tooltip>
			)
		);
	},
	showInfoTooltip: function _sit(anchor, msg, hideDelay, offset) {
		if(!msg)
			return;
		var tt = this.infoTooltip;
		tt.firstChild.textContent = msg;

		var bo = anchor.boxObject;
		var x = bo.screenX;
		var y = bo.screenY + bo.height + (offset === undefined ? this.TOOLTIP_OFFSET_DEFAULT : offset);
		if("openPopupAtScreen" in tt) // Firefox 3.0+
			tt.openPopupAtScreen(x, y, false /*isContextMenu*/);
		else
			tt.showPopup(anchor, x, y, "tooltip", null, null);

		if(_sit.hasOwnProperty("timeout"))
			clearTimeout(_sit.timeout);
		_sit.timeout = setTimeout(function(tt) {
			tt.hidePopup();
		}, hideDelay || this.TOOLTIP_HIDE_DEFAULT, tt);
	},

	setKeysDescDelay: function() {
		this.ut.timeout(this.setKeysDesc, this, arguments);
	},
	setKeysDesc: function(/* node0, node1, ... */) {
		var nodes = Array.concat(
			Array.slice(document.getElementsByAttribute("hc_key", "*")),
			Array.slice(document.documentElement.getButton("cancel").parentNode.childNodes),
			Array.slice(arguments)
		);
		//~ hack: show fake hidden popup with <menuitem key="keyId" /> to get descriptions
		var mp = document.documentElement.appendChild(document.createElement("menupopup"));
		mp.style.visibility = "collapse";
		nodes.forEach(function(node) {
			var keyId = node.getAttribute("hc_key");
			if(!keyId)
				return;
			var mi = document.createElement("menuitem");
			mi.__node = node;
			mi.setAttribute("key", keyId);
			mp.appendChild(mi);
		});
		mp._onpopupshown = function() {
			Array.forEach(
				this.childNodes,
				function(mi) {
					var keyDesk = mi.getAttribute("acceltext");
					if(!keyDesk)
						return;
					var node = mi.__node;
					node.tooltipText = node.tooltipText
						? node.tooltipText + " (" + keyDesk + ")"
						: keyDesk;
				}
			);
			this.parentNode.removeChild(this);
		};
		mp.setAttribute("onpopupshown", "this._onpopupshown();");
		mp["openPopup" in mp ? "openPopup" : "showPopup"]();
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
	}
};
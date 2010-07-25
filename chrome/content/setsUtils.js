var handyClicksSetsUtils = {
	PROMPT_SAVE: 0,
	PROMPT_CANCEL: 1,
	PROMPT_DONT_SAVE: 2,

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
				this.scrollList(e)
					|| this.scrollRadio(e)
					|| this.scrollNumTextbox(e)
					|| this.scrollTabs(e)
					|| this.scrollPanes(e);
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

	modifiedFlag: "*",
	get importFlag() {
		delete this.importFlag;
		return this.importFlag = this.ut.getLocalized("importFlag");
	},
	removeTitleFlags: function(title) {
		var modifiedFlag = this.modifiedFlag + " ";
		var importFlag = this.importFlag + " ";
		if(title.indexOf(modifiedFlag) == 0)
			title = title.substr(modifiedFlag.length);
		if(title.indexOf(importFlag) == 0)
			title = title.substr(importFlag.length);
		return title;
	},
	createTitle: function(title, isModified, isImport) {
		// [modifiedFlag] [importFlag] [title]
		return (isModified ? this.modifiedFlag + " " : "")
			+ (isImport ? this.importFlag + " " : "")
			+ this.removeTitleFlags(title);
	},

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
		var si = ml.selectedItem;
		var fwd = this.isScrollForward(e);
		si = fwd
			? !si || si == mp.lastChild
				? mp.firstChild
				: si.nextSibling
			: !si || si == mp.firstChild
				? mp.lastChild
				: si.previousSibling;
		while(
			si && (
				si.getAttribute("disabled") == "true"
				|| si.localName != "menuitem"
				|| !this.ut.isElementVisible(si)
			)
		)
			si = fwd ? si.nextSibling : si.previousSibling;
		ml.selectedItem = si || (fwd ? mp.firstChild : mp.lastChild);
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
		return true;
	},
	_showTooltip: false,
	scrollRadio: function(e) {
		var rds = this.getSameLevelRadios(e.target);
		if(!rds.length)
			return false;
		var si, indx;
		rds.some(
			function(rd, i) {
				if(rd.getAttribute("checked") == "true") {
					si = rd, indx = i;
					return true;
				}
				return false;
			}
		);
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
			this.showInfoTooltip(e.target, si.getAttribute("label"));
		return true;
	},
	getSameLevelRadios: function(elt) {
		var isClosedMenu = false;
		if(elt.localName == "menu" || elt.getAttribute("type") == "menu") {
			isClosedMenu = elt.getAttribute("open") != "true";
			elt = elt.hasChildNodes() ? elt.firstChild.firstChild : null;
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
	scrollPanes: function(e) {
		var de = document.documentElement;
		if(de.localName != "prefwindow")
			return false;
		for(var node = e.originalTarget; node; node = node.parentNode) {
			if(
				node.localName == "radiogroup"
				&& /(?:^|\s)paneSelector(?:\s|$)/.test(node.className)
			) {
				this.st.switchPanes(this.isScrollForward(e));
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

	get infoTooltip() {
		delete this.infoTooltip;
		return this.infoTooltip = document.documentElement.appendChild(
			this.ut.parseFromXML(
				<tooltip xmlns={this.ut.XULNS} id="handyClicks-infoTooltip" onmouseover="this.hidePopup();">
					<label />
				</tooltip>
			)
		);
	},
	showInfoTooltip: function _sit(anchor, msg) {
		if(!msg)
			return;
		var tt = this.infoTooltip;
		tt.firstChild.setAttribute("value", msg);

		var bo = anchor.boxObject;
		var x = bo.screenX;
		var y = bo.screenY + bo.height + 12;
		if("openPopupAtScreen" in tt) // Firefox 3.0+
			tt.openPopupAtScreen(x, y, false /*isContextMenu*/);
		else
			tt.showPopup(anchor, x, y, "tooltip", null, null);

		if(_sit.hasOwnProperty("timeout"))
			clearTimeout(_sit.timeout);
		_sit.timeout = setTimeout(function(tt) {
			tt.hidePopup();
		}, 800, tt);
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
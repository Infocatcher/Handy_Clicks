var handyClicksSetsUtils = {
	init: function(reloadFlag) {
		window.addEventListener("DOMMouseScroll", this, true);
		this.pu.oSvc.addObserver(this.prefsChanged, this);
		if(!reloadFlag)
			this.createFloatToolbar();
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("DOMMouseScroll", this, true);
	},
	createFloatToolbar: function() {
		var de = document.documentElement;
		de.setAttribute("chromedir", window.getComputedStyle(de, null).direction);

		var onTop = this.ut.parseFromXML(
			<hbox xmlns={this.ut.XULNS} id="hc-sets-floatToolbar">
				<button id="hc-sets-onTop"
					class="hcFloatButton"
					type="checkbox"
					context="hc-sets-onTopContext"
					hidden={ !this.pu.pref("ui.onTopButton") }
					oncommand="handyClicksWinUtils.toggleOnTop(); event.stopPropagation();"
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
					<menuitem id="hc-sets-onTopButtonShow" type="checkbox"
						hc_pref="ui.onTopButton"
						label={ this.ut.getLocalized("onTopButtonShow") }
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
	handleEvent: function(e) {
		if(e.type == "DOMMouseScroll") {
			this.scrollList(e)
				|| this.scrollRadio(e)
				|| this.scrollNumTextbox(e)
				|| this.scrollTabs(e)
				|| this.scrollPanes(e);
		}
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
		rds.forEach( // Strange things happens for hidden items...
			function(rd, i) {
				this.ut.attribute(rd, "checked", i == indx);
			},
			this
		);
		if(this._showTooltip)
			this.showInfoTooltip(e, si.getAttribute("label"));
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
	showInfoTooltip: function _sit(e, msg) {
		if(!msg)
			return;
		var tt = this.infoTooltip;
		tt.firstChild.setAttribute("value", msg);
		//tt.hidePopup();
		if("openPopup" in tt)
			tt.openPopup(e.target, "after_start");
		else
			tt.showPopup(e.target, -1, -1, "tooltip", "bottomleft", "topleft");
		if("timeout" in _sit)
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
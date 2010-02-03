var handyClicksSetsUtils = {
	init: function(reloadFlag) {
		window.addEventListener("DOMMouseScroll", this, true);

		var onTop = this.ut.parseFromXML(
			<div xmlns="http://www.w3.org/1999/xhtml"
				id="hc-sets-topRightToolbar"
				style="position: fixed; top: 0; right: 0;">
				<button xmlns={this.ut.XULNS}
					id="hc-sets-onTop"
					type="checkbox"
					hidden={ !this.pu.pref("ui.onTopButton") }
					oncommand="handyClicksWinUtils.toggleOnTop(); event.stopPropagation();"
					label={ this.ut.getLocalized("onTop") }
				/>
			</div>
		);
		document.documentElement.appendChild(onTop);
		if(document.documentElement.getAttribute("hc_onTop") == "true")
			this.wu.toggleOnTop(true);
		else if(opener) {
			var xulWin = this.wu.getXulWin(opener);
			if(xulWin.zLevel > xulWin.normalZ)
				this.wu.toggleOnTop(true);
		}
		this.pu.oSvc.addObserver(this.prefsChanged, this);
	},
	destroy: function(reloadFlag) {
		window.removeEventListener("DOMMouseScroll", this, true);
	},
	prefsChanged: function(pName, pValue) {
		switch(pName) {
			case "ui.onTopButton":
			case "ui.onTopBorderColor":
				this.wu.showOnTopStatus();
		}
	},
	handleEvent: function(e) {
		if(e.type == "DOMMouseScroll")
			this.listScroll(e) || this.radioScroll(e);
	},
	listScroll: function(e) {
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
		var plus = e.detail > 0;
		si = plus
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
			si = plus ? si.nextSibling : si.previousSibling;
		ml.selectedItem = si || (plus ? mp.firstChild : mp.lastChild);
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
		return true;
	},
	_showTooltip: false,
	radioScroll: function(e) {
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
		var plus = e.detail > 0;
		indx = plus
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
	get infoTooltip() {
		var tt = this.ut.parseFromXML(
			<tooltip xmlns={this.ut.XULNS} id="handyClicks-infoTooltip" onmouseover="this.hidePopup();">
				<label />
			</tooltip>
		);
		delete this.infoTooltip;
		return this.infoTooltip = document.documentElement.appendChild(tt);
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
			tt.showPopup(e.target, -1, -1, "popup", "bottomleft", "topleft");
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
var handyClicksEditor = {
	funcs: {
		copyItemText: null,
		copyItemLink: null,
		submitFormToNewDoc: ["toNewWin", "loadInBackground", "refererPolicy"],
		renameTab: null,
		reloadTab: ["skipCache"],
		reloadAllTabs: ["skipCache"],
		reloadImg: null,
		openSimilarLinksInTabs: ["refererPolicy"],
		openUriInTab: ["loadInBackground", "refererPolicy", "moveTo", "hidePopup"],
		openUriInCurrentTab: ["refererPolicy", "hidePopup"],
		openUriInWindow: ["loadInBackground", "refererPolicy", "moveTo", "hidePopup"],
		openInSidebar: ["hidePopup"],
		downloadWithFlashGot: null,
		openInSplitBrowser: ["position"],
		removeOtherTabs: null,
		removeAllTabs: null,
		removeRightTabs: null,
		removeLeftTabs: null,
		undoCloseTab: null,
		cloneTab: null,
		showContextMenu: null
	},
	init: function() {
		var wa = window.arguments;
		if(!wa[0] || !wa[1] || !window.opener)
			return;
		this.initShortcuts();
		this.initShortcutEditor();
		this.initCustomTypesEditor();
		this.mBox.selectedIndex = this.mode == "shortcut" ? 0 : 1;
	},
	$: function(id) {
		return document.getElementById(id);
	},
	initShortcuts: function() {
		this.op = window.opener;
		this.mBox = this.$("hc-editor-mainTabbox");
		this.fBox = this.$("hc-editor-funcsTabbox");
		this.code = this.$("hc-editor-funcField");
		var wa = window.arguments;
		this.mode = wa[0];
		this.target = wa[1];
		this.type = wa[2];
	},
	initShortcutEditor: function(reload) {
		// alert(this.target + "\n" + this.type);
		var setsObj = handyClicksPrefs[this.target];
		setsObj = typeof setsObj == "object" //~ todo: isOkFuncObj
			? setsObj[this.type] || {}
			: {};
		this.fBox.selectedIndex = setsObj.custom ? 1 : 0;
		if(setsObj.custom)
			this.code.value = decodeURIComponent(setsObj.action);
		this.appendTypesList(reload);
		this.appendFuncsList(setsObj.custom, setsObj.action, reload);

		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked
					= new RegExp("(^|,)" + mdf + "=true(,|$)").test(this.target);
			},
			this
		);
		this.$("hc-editor-button").selectedIndex
			= parseInt(this.target.match(/(?:^|,)button=(\d)(?:,|$)/)[1]);
	},
	initCustomTypesEditor: function() {
		// this.$("hc-editor-customType").selectedIndex =
	},
	appendTypesList: function(reload) {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		if(!reload) {
			var tList = this.$("hc-editor-customTypePopup");
			var cTypes = handyClicksCustomTypes;
			var mi;
			for(var cType in cTypes) {
				mi = document.createElement("menuitem");
				mi.setAttribute("value", cType);
				mi.setAttribute("label", cType);
				parent.insertBefore(mi, sep);
				tList.appendChild(mi.cloneNode(false));
			}
		}
		parent.parentNode.value = this.type; // <menulist>
	},
	appendFuncsList: function(custom, action, reload) {
		var sep = this.$("hc-editor-funcsSep");
		var parent = sep.parentNode;
		if(!reload) {
			var mi;
			for(var f in this.funcs) {
				mi = document.createElement("menuitem");
				mi.setAttribute("value", f);
				mi.setAttribute("label", f); //~ todo: other?
				parent.insertBefore(mi, sep);
			}
		}
		parent.parentNode.value = custom // <menulist>
			? "$custom"
			: action;
		if(!custom && this.funcs[action])
			this.showArgs();
	},
	showArgs: function(action) {
		var args = this.funcs[action];
		//~ todo:
		// 0) remove all
		// 1) append arg-specified items
	},
	loadFuncs: function() {
		var target = "button=" + this.$("hc-editor-button").selectedIndex;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				target += "," + mdf + "=" + this.$("hc-editor-" + mdf).checked;
			},
			this
		);
		this.target = target;
		this.type = this.$("hc-editor-itemTypes").selectedItem.value;
		this.initShortcutEditor(true);
	}
};
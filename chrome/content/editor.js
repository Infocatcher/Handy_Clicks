var handyClicksEditor = {
	ut: handyClicksUtils, // shortcut
	funcs: { //~ todo: add categories
		// clipboard:
		copyItemText: {},
		copyItemLink: {},
		$sepTabs: 0,
		// tabs:
		renameTab: { supports: "tab" },
		reloadTab: { args: ["skipCache"], supports: "tab" },
		reloadAllTabs: { args: ["skipCache"], supports: "tab,tabbar" },
		removeOtherTabs: { supports: "tab" },
		removeAllTabs: { supports: "tab,tabbar" },
		removeRightTabs: { supports: "tab" },
		removeLeftTabs: { supports: "tab" },
		undoCloseTab: { supports: "tab,tabbar" },
		cloneTab: { supports: "tab" },
		$sepLinks: 0,
		// links:
		//~ @2009.02.26 12:13 todo, todo, todo...
		openSimilarLinksInTabs: ["refererPolicy"],
		openUriInTab: ["loadInBackground", "refererPolicy", "moveTo", "hidePopup"],
		openUriInCurrentTab: ["refererPolicy", "hidePopup"],
		openUriInWindow: ["loadInBackground", "refererPolicy", "moveTo", "hidePopup"],
		openInSidebar: ["hidePopup"],
		downloadWithFlashGot: null,
		openInSplitBrowser: ["position"],
		$sepMisc: 0,
		// misc:
		submitFormToNewDoc: ["toNewWin", "loadInBackground", "refererPolicy"],
		reloadImg: null,
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
				if(f.indexOf("$sep") == 0)
					mi = document.createElement("menuseparator");
				else {
					mi = document.createElement("menuitem");
					mi.setAttribute("value", f);
					mi.setAttribute("label", f); //~ todo: other?
				}
				parent.insertBefore(mi, sep);
			}
		}
		parent.parentNode.value = custom // <menulist>
			? "$custom"
			: action;
		if(!custom && action in this.funcs)
			this.loadFuncArgs(custom, action);
	},
	loadFuncArgs: function(custom, action) {
		var box = this.$("hc-editor-funcArgs");
		while(box.hasChildNodes())
			box.removeChild(box.lastChild);
		if(custom)
			return;
		var args = this.funcs[action];
		if(!args) // function has no arguments
			return;

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
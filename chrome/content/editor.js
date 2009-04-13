var handyClicksEditor = {
	ut: handyClicksUtils, // shortcut
	rebuildCustomTypes: true,
	types: {
		checkboxes: {
			skipCache: 1,
			loadInBackground: 1,
			loadJSInBackground: 1,
			hidePopup: 1,
			toNewWin: 1
		},
		menulists: {
			refererPolicy: [-1, 0, 1, 2],
			moveTabTo: ["null", "first", "before", "after", "last", "relative"],
			moveWinTo: ["null", "top", "right", "bottom", "left", "sub"],
			position: ["top", "right", "bottom", "left"]
		}
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
	initShortcutEditor: function() {
		// alert(this.target + "\n" + this.type);
		var setsObj = handyClicksPrefs[this.target];
		setsObj = typeof setsObj == "object" //~ todo: isOkFuncObj
			? setsObj[this.type] || {}
			: {};
		var isCustom = setsObj.custom;
		this.fBox.selectedIndex = isCustom ? 1 : 0;
		if(isCustom)
			this.code.value = decodeURIComponent(setsObj.action);
		this.appendTypesList();
		this.initFuncsList(isCustom, setsObj.action);

		if(/(?:^|,)button=(\d)(?:,|$)/.test(this.target))
			this.$("hc-editor-button").value = RegExp.$1;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked
					= new RegExp("(^|,)" + mdf + "=true(,|$)").test(this.target);
			},
			this
		);
		this.$("hc-editor-events").value = setsObj.eventType || "";
		this.$("hc-editor-enabled").checked = setsObj.enabled;
	},
	initCustomTypesEditor: function() {
		// this.$("hc-editor-customType").selectedIndex =
	},
	appendTypesList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		if(this.rebuildCustomTypes) {
			this.rebuildCustomTypes = false;
			var tList = this.$("hc-editor-customTypePopup");
			var cTypes = window.handyClicksCustomTypes || {};
			var mi;
			for(var cType in cTypes) {
				if(!cTypes.hasOwnProperty(cType))
					continue;
				mi = document.createElement("menuitem");
				mi.setAttribute("value", cType);
				mi.setAttribute("label", cType);
				parent.insertBefore(mi, sep);
				tList.appendChild(mi.cloneNode(false));
			}
		}
		parent.parentNode.value = this.type; // <menulist>
	},
	initFuncsList: function(custom, action) {
		var fList = this.$("hc-editor-func");
		fList.value = custom // <menulist>
			? "$custom"
			: action;

		var re = new RegExp("(^|[\\s,]+)" + this.type + "([\\s,]+|$)|^\\$all$");
		var mp = this.$("hc-editor-funcPopup");
		var its = mp.childNodes;
		var it;
		var hideSep = true;
		for(var i = 0, len = its.length; i < len; i++) {
			it = its[i];
			if(it.nodeName == "menuseparator") {
				it.style.display = hideSep ? "none" : "";
				hideSep = true;
			}
			else {
				if(re.test(it.getAttribute("hc_supports"))) {
					it.style.display = "";
					hideSep = false;
				}
				else
					it.style.display = "none";
			}
		}
		this.hideUnsupportedExts();

		this.addFuncArgs(custom, action);
	},
	exts: {
		SplitBrowser: "{29c4afe1-db19-4298-8785-fcc94d1d6c1d}",
		FlashGot: "{19503e42-ca3c-4c27-b1e2-9cdb2170ee34}",
	},
	hideUnsupportedExts: function() {
		var mp = this.$("hc-editor-funcPopup");
		var elts, i, len;
		for(var ext in this.exts)
			if(this.extNotAvailable(this.exts[ext])) {
				elts = mp.getElementsByAttribute("hc_required", ext);
				for(i = 0, len = elts.length; i < len; i++)
					elts[i].style.display = "none";
			}
	},
	extNotAvailable: function(guid) {
		return !Components.classes["@mozilla.org/extensions/manager;1"]
			.getService(Components.interfaces.nsIExtensionManager)
			.getItemForID(guid);
	},
	addFuncArgs: function() { //~ todo: cache
		var box = this.$("hc-editor-funcArgs");
		while(box.hasChildNodes())
			box.removeChild(box.lastChild);
		var funcs = this.$("hc-editor-func");
		var cFunc = funcs.value;
		if(cFunc == "$custom") {
			this.fBox.selectedIndex = 1; //~ todo: function
			return;
		}
		var cMi = funcs.getElementsByAttribute("value", cFunc)[0];
		if(!cMi)
			return;
		var cArgs = cMi.getAttribute("hc_args");
		if(!cArgs)
			return;
		cArgs.split(/[\s,;]+/).forEach(this.addArgControls, this);
	},
	addArgControls: function(arg) {
		var setsObj = handyClicksPrefs[this.target];
		setsObj = typeof setsObj == "object" //~ todo: isOkFuncObj
			? setsObj[this.type] || {}
			: {};
		var cArgVal = (setsObj.arguments || {})[arg];
		var aType = this.getArgType(arg);
		this.addControl(arg, aType, cArgVal); // "loadInBackground", "checkbox", true
	},
	getArgType: function(arg) {
		var types = this.argsTypes;
		if(arg in this.types.checkboxes)
			return "checkbox";
		if(arg in this.types.menulists)
			return "menulist";
		return this.ut._err("Cannt get type of " + arg);
	},
	addControl: function(argName, argType, argVal) {
		var argContainer = document.createElement("vbox");
		argContainer.className = "hc-editor-argsContainer";
		var elt = document.createElement(argType);
		switch(argType) {
			case "checkbox":
				elt.setAttribute("checked", !!argVal);
				elt.setAttribute("label", this.ut.getLocalised(argName));
			break;
			case "menulist":
				var mp = document.createElement("menupopup");
				var vals = this.types.menulists[argName];
				var mi;
				for(var i = 0, len = vals.length; i < len; i++) {
					mi = document.createElement("menuitem");
					mi.value = vals[i];
					mi.setAttribute("label", this.ut.getLocalised(argName + "[" + vals[i] + "]"));
					mp.appendChild(mi);
				}
				elt.value = argVal;
				elt.appendChild(mp);
		}
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs").appendChild(argContainer);
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
		this.initShortcutEditor();
	}
};
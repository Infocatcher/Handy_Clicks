var handyClicksEditor = {
	ut: handyClicksUtils, // shortcut
	ps: handyClicksPrefServ, // shortcut
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
		this.initUI();
		this.mBox.selectedIndex = this.mode == "shortcut" ? 0 : 1;
		this.ps.addPrefsObserver(this.initUI, this);
	},
	initUI: function() {
		this.initShortcutEditor();
		this.appendTypesList();
		this.initImgIgnoreLinks();
		this.initCustomTypesEditor();
	},
	$: function(id) {
		return document.getElementById(id);
	},
	initShortcuts: function() {
		this.op = window.opener;
		this.mBox = this.$("hc-editor-mainTabbox");
		// this.fBox = this.$("hc-editor-funcsTabbox");
		this.code = this.$("hc-editor-funcField");
		this.cLabel = this.$("hc-editor-funcLabel");
		var wa = window.arguments;
		this.mode = wa[0];
		this.target = wa[1];
		this.type = wa[2];
	},
	initShortcutEditor: function() {
		var setsObj = handyClicksPrefs[this.target];
		setsObj = typeof setsObj == "object" //~ todo: isOkFuncObj
			? setsObj[this.type] || {}
			: {};
		var isCustom = setsObj.custom;
		this.customFunction = isCustom;
		// this.fBox.selectedIndex = isCustom ? 1 : 0;
		if(isCustom) {
			this.code.newValue = decodeURIComponent(setsObj.action);
			this.cLabel.value = decodeURIComponent(setsObj.label);
		}
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
		this.$("hc-editor-enabled").checked = typeof setsObj.enabled != "boolean" || setsObj.enabled;
	},
	set customFunction(isCustom) {
		this.$("hc-editor-funcArgsBox").hidden = isCustom;
		this.$("hc-editor-funcCustom").hidden = !isCustom;
	},
	loadCustomType: function(type) {
		if(type.indexOf("custom_" == 0))
			this.initCustomTypesEditor(type);
	},
	initCustomTypesEditor: function(cType) {
		var cList = this.$("hc-editor-customType");
		cType = cType || cList.value;
		this._currentCType = cType;
		if(!cType)
			return;
		cType = cType
			.replace(/\W/, "")
			.replace(/^custom_/, "");
		cList.value = cType;
		var ct = handyClicksCustomTypes["custom_" + cType] || {};
		this.$("hc-editor-customTypeDefine").newValue = decodeURIComponent(ct.define || "");
		this.$("hc-editor-customTypeContext").newValue = decodeURIComponent(ct.contextMenu || "");
	},
	delCustomTypes: function() {
		var prnt, mis, mi;
		for(var i = 0, aLen = arguments.length; i < aLen; i++) {
			prnt = arguments[i];
			mis = prnt.getElementsByTagName("menuitem");
			for(var j = mis.length - 1; j >= 0; j--) {
				mi = mis[j];
				if(mi.getAttribute("value").indexOf("custom_") == 0)
					mi.parentNode.removeChild(mi);
			}
		}
	},
	appendTypesList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		var tList = this.$("hc-editor-customTypePopup");
		this.delCustomTypes(parent, tList);
		var cTypes = window.handyClicksCustomTypes || {};
		var mi;
		for(var cType in cTypes) {
			if(!cTypes.hasOwnProperty(cType))
				continue;
			mi = document.createElement("menuitem");
			mi.setAttribute("label", cType);
			mi.setAttribute("value", cType);
			parent.insertBefore(mi, sep);
			tList.appendChild(mi.cloneNode(false));
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
		var it, req;
		var hideSep = true;
		for(var i = 0, len = its.length; i < len; i++) {
			it = its[i];
			if(it.nodeName == "menuseparator") {
				it.style.display = hideSep ? "none" : "";
				hideSep = true;
			}
			else {
				req = it.getAttribute("hc_required");
				if(
					re.test(it.getAttribute("hc_supports"))
					&& (!req || this.extAvailable(req))
				) {
					it.style.display = "";
					hideSep = false;
				}
				else
					it.style.display = "none";
			}
		}
		this.addFuncArgs(custom, action);
	},
	exts: {
		SplitBrowser: "{29c4afe1-db19-4298-8785-fcc94d1d6c1d}",
		FlashGot: "{19503e42-ca3c-4c27-b1e2-9cdb2170ee34}"
	},
	extAvailable: function(eName) {
		var guid = this.exts[eName];
		return !!Components.classes["@mozilla.org/extensions/manager;1"]
			.getService(Components.interfaces.nsIExtensionManager)
			.getItemForID(guid);
	},
	itemTypeChanged: function(iType) {
		this.addFuncArgs();
		this.loadCustomType(iType);
		this.initImgIgnoreLinks(iType);
	},
	initImgIgnoreLinks: function(iType) {
		iType = iType || this.$("hc-editor-itemTypes").value;
		var isImg = iType == "img";
		var ignoreLinks = this.$("hc-editor-imgIgnoreLinks");
		ignoreLinks.hidden = !isImg;
		if(isImg) {
			var setsObj = (handyClicksPrefs[this.target] || {})[iType] || {};
			ignoreLinks.checked = typeof setsObj.ignoreLinks == "boolean" ? setsObj.ignoreLinks : false;
		}
	},
	addFuncArgs: function() { //~ todo: cache
		var box = this.$("hc-editor-funcArgs");
		while(box.hasChildNodes())
			box.removeChild(box.lastChild);
		var funcs = this.$("hc-editor-func");
		var cFunc = funcs.value;
		var isCustom = cFunc == "$custom";
		this.customFunction = isCustom;
		if(cFunc == "$custom")
			return;
		var cMi = funcs.selectedItem;
		if(!cMi)
			return;
		var cArgs = cMi.getAttribute("hc_args");
		this.$("hc-editor-funcArgsBox").hidden = !cArgs;
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
					mi.setAttribute("value", vals[i]);
					// mi.value = vals[i];
					mi.setAttribute("label", this.ut.getLocalised(argName + "[" + vals[i] + "]"));
					mp.appendChild(mi);
				}
				elt.value = argVal + "";
				elt.appendChild(mp);
		}
		elt.setAttribute("hc_argname", argName);
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs").appendChild(argContainer);
	},
	get currentShortcut() {
		var s = "button=" + this.$("hc-editor-button").selectedIndex;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				s += "," + mdf + "=" + this.$("hc-editor-" + mdf).checked;
			},
			this
		);
		return s;
	},
	get currentType() {
		var type = this.$("hc-editor-itemTypes").selectedItem;
		return type ? type.value : null;
	},
	loadFuncs: function() {
		var target = this.currentShortcut;
		this.target = target;
		this.type = this.currentType;
		this.initShortcutEditor();
	},
	setClickOptions: function(e) {
		this.$("hc-editor-button").value = e.button;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked = e[mdf + "Key"];
			},
			this
		);
		handyClicksEditor.loadFuncs();
	},

	saveSettings: function() {
		switch(this.mBox.selectedIndex) {
			case 0:  return this.saveShortcut();
			case 1:  return this.saveCustomType();
			default: return false;
		}
	},
	deleteSettings: function() {
		switch(this.mBox.selectedIndex) {
			case 0:  return this.deleteShortcut();
			case 1:  return this.deleteCustomType();
			default: return false;
		}
	},
	saveShortcut: function() {
		var sh = this.currentShortcut;
		var type = this.currentType;
		var evt = this.$("hc-editor-events").value || null;
		var enabled = this.$("hc-editor-enabled").checked;
		var fnc = this.$("hc-editor-func").value || null;
		if(!this.ps.isOkShortcut(sh) || !type || !evt || !fnc) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("editorIncomplete")
			);
			return false;
		}
		var p = handyClicksPrefs;
		if(!p.hasOwnProperty(sh))
			p[sh] = {};
		var po = p[sh];
		po[type] = {}; // rewrite
		var so = po[type];
		so.enabled = enabled;
		so.eventType = evt;
		var isCustom = fnc == "$custom";
		if(type == "img")
			so.ignoreLinks = this.$("hc-editor-imgIgnoreLinks").checked;
		if(isCustom) {
			so.custom = isCustom;
			so.label = encodeURIComponent(this.$("hc-editor-funcLabel").value);
			so.action = encodeURIComponent(this.code.value);
		}
		else {
			so.action = fnc;
			so.arguments = {};
			var args = so.arguments;
			var aIts = this.$("hc-editor-funcArgs").getElementsByAttribute("hc_argname", "*");
			var aIt, aVal;
			for(var i = 0, len = aIts.length; i < len; i++) {
				aIt = aIts[i];
				aVal = aIt.getAttribute("value") || aIt.checked;
				if(typeof aVal == "string") {
					if(aVal == "null")
						aVal = null;
					else if(/^-?\d+$/.test(aVal))
						aVal = parseInt(aVal);
				}
				args[aIt.getAttribute("hc_argname")] = aVal;
			}
		}
		// alert( uneval( handyClicksPrefs[sh] ) );
		this.ps.saveSettingsObjects();
		return true;
	},
	deleteShortcut: function() {
		delete(handyClicksPrefs[this.currentShortcut]);
		this.ps.saveSettingsObjects();
	},
	saveCustomType: function() {
		var tName = this.$("hc-editor-customType").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!tName || !def) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("editorIncomplete")
			);
			return false;
		}
		tName = "custom_" + tName;
		var cMenu = this.$("hc-editor-customTypeContext").value;
		var cts = handyClicksCustomTypes;
		if(!cts.hasOwnProperty(tName))
			cts[tName] = {};
		var ct = cts[tName];
		ct.define = encodeURIComponent(def);
		ct.contextMenu = cMenu ? encodeURIComponent(cMenu) : null;
		this.ps.saveSettingsObjects(true);
		return true;
	},
	deleteCustomType: function() {
		delete(handyClicksCustomTypes["custom_" + this.$("hc-editor-customType").value]);
		this.ps.saveSettingsObjects(true);
	}
};
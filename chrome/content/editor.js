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
		window.addEventListener("DOMMouseScroll", this, true);
		this.toggleApply(true);
	},
	initUI: function() {
		this.initShortcutEditor();
		this.appendTypesList();
		this.initImgIgnoreLinks();
		this.initCustomTypesEditor();
	},
	destroy: function() {
		window.removeEventListener("DOMMouseScroll", this, true);
	},
	get applyButton() {
		if(!this._applyButton)
			this._applyButton = document.documentElement.getButton("extra1");
		return this._applyButton;
	},
	toggleApply: function(dis) {
		this.applyButton.disabled = dis;
	},
	alloyApply: function(e) {
		var nn = e.target.nodeName;
		if(nn == "tab" || nn == "dialog")
			return;
		this.toggleApply(false);
	},
	$: function(id) {
		return document.getElementById(id);
	},
	handleEvent: function(e) {
		this.listScroll(e);
	},
	initShortcuts: function() {
		this.op = window.opener;
		this.mBox = this.$("hc-editor-mainTabbox");
		this.code = this.$("hc-editor-funcField");
		this.cLabel = this.$("hc-editor-funcLabel");
		var wa = window.arguments;
		this.mode = wa[0];
		this.target = wa[1];
		this.type = wa[2];
	},
	initShortcutEditor: function() {
		var setsObj = handyClicksPrefs[this.target] || {};
		setsObj = setsObj[this.type] || {};
		var isCustom = setsObj.custom;
		this.customFunction = isCustom;
		// this.fBox.selectedIndex = isCustom ? 1 : 0;
		if(isCustom) {
			this.code.newValue = decodeURIComponent(setsObj.action);
			this.cLabel.value = decodeURIComponent(setsObj.label);
		}
		this.initFuncsList(isCustom, setsObj.action || null);

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
	editCustomType: function(e) {
		if(e.button != 2)
			return;
		var tar = e.target;
		var cType = tar.value;
		if(cType.indexOf("custom_") == 0)
			this.initCustomTypesEditor(cType);
		this.mBox.selectedIndex = 1;
		var mp = tar.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
	},
	initCustomTypesEditor: function(cType) {
		var cList = this.$("hc-editor-customType");
		var sItem = cList.selectedItem;
		cType = cType || (sItem ? sItem.value : null);
		var cts = handyClicksCustomTypes;
		if(!cType || !cts.hasOwnProperty(cType))
			return;
		var ct = cts[cType] || {};
		cList.value = decodeURIComponent(ct.label || ""); //~ todo: test!
		this.$("hc-editor-customTypeExtId").value = cType.replace(/^custom_/, "");
		this.$("hc-editor-customTypeEnabled").checked = typeof ct.enabled == "boolean" ? ct.enabled : true;
		this.$("hc-editor-customTypeDefine").newValue = decodeURIComponent(ct.define || "");
		this.$("hc-editor-customTypeContext").newValue = decodeURIComponent(ct.contextMenu || "");
	},
	customTypeLabel: function(it) {
		if(it.getElementsByAttribute("label", it.value)[0])
			this.initCustomTypesEditor();
	},
	customTypeIdFilter: function(e) {
		var tar = e.target;
		var val = tar.value;
		if(/\W/.test(val)) {
			val = val.replace(/\W/g, "");
			tar.value = val
		}
		var val = "custom_" + tar.value;
		var ml = this.$("hc-editor-customType");
		var it = ml.getElementsByAttribute("value", val)[0];
		if(it) {
			ml.selectedItem = it;
			this.initCustomTypesEditor(val);
		}
		else
			ml.selectedItem = null;
		var key = e.charCode;
		if(!key || e.ctrlKey || e.altKey || e.metaKey || key < 32)
			return true;
		key = String.fromCharCode(key);
		return /\w/.test(key);
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
		var mi, _mi, typeObj, dis;
		var hideSep = true;
		for(var cType in cTypes) {
			if(!cTypes.hasOwnProperty(cType))
				continue;
			mi = document.createElement("menuitem");
			typeObj = cTypes[cType] || {};
			mi.setAttribute("label", decodeURIComponent(typeObj.label || "") || cType);
			mi.setAttribute("value", cType);
			_mi = mi.cloneNode(true);
			dis = typeof typeObj.enabled == "boolean" ? !typeObj.enabled : true;
			mi.setAttribute("disabled", dis);
			_mi.setAttribute("hc_disabled", dis);
			parent.insertBefore(mi, sep);
			tList.appendChild(_mi);
			hideSep = false;
		}
		sep.hidden = hideSep;
		parent.parentNode.value = this.type; // <menulist>
	},
	initFuncsList: function(custom, action) {
		var fList = this.$("hc-editor-func");
		fList.value = custom // <menulist>
			? "$custom"
			: action;
		if(!fList.value) // fix for Firefox 2.0
			fList.selectedIndex = -1;
		var re = new RegExp("(^|[\\s,]+)" + this.type + "([\\s,]+|$)|^\\$all$");
		var mp = this.$("hc-editor-funcPopup");
		var its = mp.childNodes;
		var it, req;
		var hideSep = true;
		for(var i = 0, len = its.length; i < len; i++) {
			it = its[i];
			if(it.nodeName == "menuseparator") {
				it.hidden = hideSep;
				hideSep = true;
			}
			else {
				req = it.getAttribute("hc_required");
				if(
					re.test(it.getAttribute("hc_supports"))
					&& (!req || this.extAvailable(req))
				) {
					it.hidden = false;
					hideSep = false;
				}
				else
					it.hidden = true;
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
		var cFunc = funcs.value || null;
		var isCustom = cFunc == "$custom";
		this.customFunction = isCustom;
		var argBox = this.$("hc-editor-funcArgsBox");
		argBox.hidden = true;
		if(cFunc == "$custom")
			return;
		var cMi = funcs.selectedItem;
		if(!cMi)
			return;
		var cArgs = cMi.getAttribute("hc_args");
		if(!cArgs)
			return;
		argBox.hidden = false;
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
		this.loadFuncs();
		this.alloyApply(e);
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
		this.toggleApply(true);
		return true;
	},
	deleteShortcut: function() {
		delete(handyClicksPrefs[this.currentShortcut]);
		this.ps.saveSettingsObjects();
		this.toggleApply(true);
	},
	saveCustomType: function() {
		var label = this.$("hc-editor-customType").value;
		var cType = this.$("hc-editor-customTypeExtId").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!label || !cType || !def) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("editorIncomplete")
			);
			return false;
		}
		cType = "custom_" + cType;
		var cMenu = this.$("hc-editor-customTypeContext").value;
		var cts = handyClicksCustomTypes;
		cts[cType] = {};
		var ct = cts[cType];
		ct.enabled = this.$("hc-editor-customTypeEnabled").checked;
		ct.label = encodeURIComponent(label);
		ct.define = encodeURIComponent(def);
		ct.contextMenu = cMenu ? encodeURIComponent(cMenu) : null;
		this.ps.saveSettingsObjects(true);
		this.toggleApply(true);
		return true;
	},
	deleteCustomType: function() {
		delete(handyClicksCustomTypes["custom_" + this.$("hc-editor-customTypeExtId").value]);
		this.ps.saveSettingsObjects(true);
		this.toggleApply(true);
	},
	listScroll: function(e) {
		var ml = e.target;
		var tn = ml.tagName;
		if(tn == "menuitem" || tn == "menuseparator") {
			ml = ml.parentNode.parentNode;
			tn = ml.tagName;
		}
		if(tn != "menulist" || ml.disabled)
			return;
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
		while(si && (si.hidden || si.getAttribute("disabled") == "true" || si.tagName != "menuitem"))
			si = plus ? si.nextSibling : si.previousSibling;
		ml.selectedItem = si || (plus ? mp.firstChild : mp.lastChild);
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
	}
};
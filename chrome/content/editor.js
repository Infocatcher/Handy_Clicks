var handyClicksEditor = {
	// Shortcuts:
	ut: handyClicksUtils,
	wu: handyClicksWinUtils,
	ps: handyClicksPrefSvc,

	types: {
		checkboxes: {
			__proto__: null,
			skipCache: 1,
			loadInBackground: 1,
			loadJSInBackground: 1,
			hidePopup: 1,
			toNewWin: 1
		},
		menulists: {
			__proto__: null,
			refererPolicy: [-1, 0, /*1,*/ 2],
			moveTabTo: ["null", "first", "before", "after", "last", "relative"],
			moveWinTo: ["null", "top", "right", "bottom", "left", "sub"],
			inWin: [-1, 0, 1, 2], // browser.link.open_newwindow.restriction
			position: ["top", "right", "bottom", "left"]
		}
	},
	tabs: {
		shortcut: 0,
		itemType: 1
	},
	init: function() {
		var wa = window.arguments;
		if(!wa[0] || !wa[1] || !window.opener)
			return;
		this.loadLabels();
		this.initShortcuts();
		this.initUI();
		this.loadCustomType(this.type);
		this.mBox.selectedIndex = this.tabs[this.mode];
		this.ps.addPrefsObserver(this.appendTypesList, this);
		window.addEventListener("DOMMouseScroll", this, true);
		this.toggleApply(true);
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
	loadLabels: function() {
		["hc-editor-button", "hc-editor-itemTypes", "hc-editor-funcPopup"].forEach(
			this.localiseLabels,
			this
		);
	},
	localiseLabels: function(parentId) {
		var p = this.$(parentId);
		var mis = p.getElementsByTagName("menuitem"), mi;
		for(var i = 0, len = mis.length; i < len; i++) {
			mi = mis[i];
			mi.setAttribute("label", this.ut.getLocalised(mi.getAttribute("label")));
		}
		if(this.ut.fxVersion >= 3) // Fix bug in Firefox 1.5 and 2.0
			return;
		var ml = mi.parentNode.parentNode;
		var si = ml.selectedIndex;
		ml.selectedIndex = null;
		ml.selectedIndex = si;
	},
	initUI: function() {
		this.initShortcutEditor();
		this.appendTypesList();
		this.initImgIgnoreLinks();
		this.initCustomTypesEditor();
	},
	destroy: function() {
		window.removeEventListener("DOMMouseScroll", this, true);
		this.wu.highlightAllOpened();
	},
	get applyButton() {
		delete this.applyButton;
		return this.applyButton = document.documentElement.getButton("extra1");
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
		if(e.type == "DOMMouseScroll")
			this.listScroll(e);
	},
	setWinId: function() {
		var winId;
		var cType = this.currentType || this.type; // For deleted custom types
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: winId = this.currentShortcut + "-" + cType; break;
			case this.tabs.itemType: winId = cType;                              break;
			default: return;
		}
		window[this.wu.winId] = winId;
		this.wu.highlightAllOpened();
	},
	initShortcutEditor: function() {
		var setsObj = handyClicksPrefs[this.target] || {};
		setsObj = setsObj[this.type] || {};
		var isCustom = setsObj.custom;
		this.customFunction = isCustom;
		if(isCustom) {
			this.code.newValue = this.ps.dec(setsObj.action);
			this.cLabel.value = this.ps.dec(setsObj.label);
		}
		this.initFuncsList(isCustom, setsObj.action || null);
		if(/(?:^|,)button=(\d)(?:,|$)/.test(this.target))
			this.$("hc-editor-button").value = RegExp.$1;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked
					= new RegExp("(?:^|,)" + mdf + "=true(?:,|$)").test(this.target);
			},
			this
		);
		this.$("hc-editor-events").value = setsObj.eventType || "click";
		this.$("hc-editor-enabled").checked = typeof setsObj.enabled != "boolean" || setsObj.enabled;
	},
	set customFunction(isCustom) {
		this.$("hc-editor-funcArgsBox").hidden = isCustom;
		this.$("hc-editor-funcCustom").hidden = !isCustom;
	},
	loadCustomType: function(type) {
		if(type && type.indexOf("custom_" == 0))
			this.initCustomTypesEditor(type);
	},
	editCustomType: function(e) {
		if(e.button != 2)
			return;
		var tar = e.target;
		var cType = tar.value;
		this.loadCustomType(cType);
		this.mBox.selectedIndex = this.tabs.itemType;
		var mp = tar.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
	},
	initCustomTypesEditor: function(cType) {
		var cList = this.$("hc-editor-customType");
		var sItem = cList.selectedItem;
		cType = cType || (sItem ? sItem.value : null);
		var enabledElt = this.$("hc-editor-customTypeEnabled");
		enabledElt.checked = true;
		var cts = handyClicksCustomTypes;
		if(!cType || !cts.hasOwnProperty(cType))
			return;
		var ct = cts[cType] || {};
		cList.value = this.ps.dec(ct.label);
		this.$("hc-editor-customTypeExtId").value = cType.replace(/^custom_/, "");
		enabledElt.checked = typeof ct.enabled == "boolean" ? ct.enabled : true;
		this.$("hc-editor-customTypeDefine").newValue = this.ps.dec(ct.define);
		this.$("hc-editor-customTypeContext").newValue = this.ps.dec(ct.contextMenu);
		this.setWinId();
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
		else {
			ml.selectedItem = null;
			this.$("hc-editor-customTypeEnabled").checked = true;
		}
		var key = e.charCode;
		if(!key || e.ctrlKey || e.altKey || e.metaKey || key < 32)
			return true;
		key = String.fromCharCode(key);
		return /\w/.test(key);
	},
	appendTypesList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		var tList = this.$("hc-editor-customTypePopup");
		this.delCustomTypes();
		var cTypes = window.handyClicksCustomTypes || {};
		var mi, _mi, typeObj, dis;
		var hideSep = true;
		for(var cType in cTypes) {
			if(!cTypes.hasOwnProperty(cType))
				continue;
			mi = document.createElement("menuitem");
			typeObj = cTypes[cType] || {};
			mi.setAttribute("label", this.ps.dec(typeObj.label) || cType);
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
	delCustomTypes: function() {
		var mis, mi, j;
		["hc-editor-itemTypes", "hc-editor-customTypePopup"].forEach(
			function(pId) {
				mis = this.$(pId).getElementsByTagName("menuitem");
				for(j = mis.length - 1; j >= 0; j--) {
					mi = mis[j];
					if(mi.getAttribute("value").indexOf("custom_") == 0)
						mi.parentNode.removeChild(mi);
				}
			},
			this
		);
	},
	initFuncsList: function(custom, action) {
		var fList = this.$("hc-editor-func");
		fList.value = custom // <menulist>
			? "$custom"
			: action;
		if(!fList.value) // fix for Firefox 2.0
			fList.selectedIndex = -1;
		var re = new RegExp("(?:^|[\\s,;]+)" + this.type + "(?:[\\s,;]+|$)|^\\$all$");
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
	addFuncArgs: function() {
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
		setsObj = typeof setsObj == "object" //~ todo: isOkFuncObj ?
			? setsObj[this.type] || {}
			: {};
		var cArgVal = (setsObj.arguments || {})[arg];
		this.addControl(arg, this.getArgType(arg), cArgVal); // "loadInBackground", "checkbox", true
	},
	getArgType: function(arg) {
		var types = this.argsTypes;
		if(arg in this.types.checkboxes)
			return "checkbox";
		if(arg in this.types.menulists)
			return "menulist";
		return this.ut._err("Can't get type of " + arg);
	},
	addControl: function(argName, argType, argVal) {
		var argContainer = document.createElement("hbox");
		argContainer.setAttribute("align", "center");
		argContainer.className = "hc-editor-argsContainer";
		var elt = document.createElement(argType);
		switch(argType) {
			case "checkbox":
				elt.setAttribute("checked", !!argVal);
				elt.setAttribute("label", this.ut.getLocalised(argName));
			break;
			case "menulist":
				// Description:
				var desc = document.createElement("label");
				desc.setAttribute("value", this.ut.getLocalised(argName));
				argContainer.appendChild(desc);
				// List of values:
				var mp = document.createElement("menupopup");
				var vals = this.types.menulists[argName];
				var mi;
				for(var i = 0, len = vals.length; i < len; i++) {
					mi = document.createElement("menuitem");
					mi.setAttribute("value", vals[i]);
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
		return type && type.value || null;
	},
	loadFuncs: function() {
		this.target = this.currentShortcut;
		this.type = this.currentType;
		this.initShortcutEditor();
		this.setWinId();
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
			case this.tabs.shortcut: return this.saveShortcut();
			case this.tabs.itemType: return this.saveCustomType();
			default: return false;
		}
	},
	deleteSettings: function() {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.deleteShortcut();
			case this.tabs.itemType: return this.deleteCustomType();
			default: return false;
		}
	},
	saveShortcut: function() {
		var sh = this.currentShortcut;
		var type = this.currentType;
		var evt = this.$("hc-editor-events").value || null;
		var enabledElt = this.$("hc-editor-enabled");
		var enabled = enabledElt.checked;
		var fnc = this.$("hc-editor-func").value || null;
		if(!this.ps.isOkShortcut(sh) || !type || !evt || !fnc) {
			this.ut.alertEx(
				this.ut.getLocalised("errorTitle"),
				this.ut.getLocalised("editorIncomplete")
			);
			return false;
		}
		var p = handyClicksPrefs;
		if(!p.hasOwnProperty(sh) || typeof p[sh] != "object")
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
			so.label = this.ps.enc(this.$("hc-editor-funcLabel").value);
			so.action = this.ps.enc(this.code.value);
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
		this.ps.saveSettingsObjects(true);
		enabledElt.checked = this.ut.getProperty(handyClicksPrefs, sh, type, "enabled");
		this.toggleApply(true);
		return true;
	},
	deleteShortcut: function() {
		delete handyClicksPrefs[this.currentShortcut];
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

		var cts = handyClicksCustomTypes;
		var ct = cts[cType] || {};
		var curEnabl = ct.enabled || false;
		var newEnabl = this.$("hc-editor-customTypeEnabled").checked;
		if(
			!newEnabl
			&& newEnabl != curEnabl
			&& !this.ut.confirmEx(
				this.ut.getLocalised("warningTitle"),
				this.ut.getLocalised("typeDisablingWarning")
			)
		)
			return false;
		cts[cType] = {};
		ct = cts[cType];
		ct.enabled = newEnabl;
		var cMenu = this.$("hc-editor-customTypeContext").value;
		ct.label = this.ps.enc(label);
		ct.define = this.ps.enc(def);
		ct.contextMenu = cMenu ? this.ps.enc(cMenu) : null;
		this.ps.saveSettingsObjects();
		this.toggleApply(true);

//		var cti = this.$("hc-editor-itemTypes").getElementsByAttribute("value", cType)[0];
//		if(cti)
//			cti.setAttribute("disabled", !newEnabl);

		this.appendTypesList();

		return true;
	},
	deleteCustomType: function() {
		delete handyClicksCustomTypes["custom_" + this.$("hc-editor-customTypeExtId").value];
		this.ps.saveSettingsObjects();
		this.toggleApply(true);
		this.appendTypesList();
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
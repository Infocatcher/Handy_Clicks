var handyClicksEditor = {
	// Shortcuts:
	ut: handyClicksUtils,
	wu: handyClicksWinUtils,
	ps: handyClicksPrefSvc,

	types: {
		checkboxes: {
			__proto__: null,
			skipCache: true,
			loadInBackground: true,
			loadJSInBackground: true,
			closePopups: true,
			toNewWin: true
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
	delayId: "-delay",

	init: function() {
		this.ps.loadSettings();
		if(this.ut.fxVersion == 1.5) // "relative" is not supported
			this.types.menulists.moveTabTo.pop();
		this.loadLabels();
		this.createDelayedFuncTab();
		this.initShortcuts();
		this.initUI();
		this.loadCustomType(this.type);
		this.mBox.selectedIndex = this.tabs[this.editorMode];
		this.ps.addPrefsObserver(this.appendTypesList, this);
		window.addEventListener("DOMMouseScroll", this, true);
		this.applyButton.disabled = true;
	},
	initShortcuts: function() {
		this.mBox = this.$("hc-editor-mainTabbox");
		var wa = window.arguments || [];
		this.editorMode = wa[0];
		this.shortcut = wa[1];
		this.type = wa[2];
		this.applyButton = document.documentElement.getButton("extra1");
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
			mi.setAttribute("label", this.ut.getLocalized(mi.getAttribute("label")));
			if(mi.hasAttribute("tooltiptext"))
				mi.setAttribute("tooltiptext", this.ut.getLocalized(mi.getAttribute("tooltiptext")));
		}
		if(this.ut.fxVersion >= 3) // Fix bug in Firefox 1.5 and 2.0
			return;
		var ml = mi.parentNode.parentNode;
		var si = ml.selectedIndex;
		ml.selectedIndex = null;
		ml.selectedIndex = si;
	},
	createDelayedFuncTab: function() {
		var dTab = this.$("hc-editor-funcTab").cloneNode(true);
		this.$("hc-editor-funcsTab").appendChild(
			this.addIds(dTab, this.delayId)
		);
		var fOpts = this.$("hc-editor-funcOpts");
		var f = "handyClicksEditor.disableDelayedAction();";
		fOpts.setAttribute("onchange", f);
		fOpts.setAttribute("oncommand", f);
	},
	addIds: function(node, id) {
		node.id += id;
		Array.prototype.forEach.call(
			node.getElementsByTagName("*"),
			function(node) { if(node.id) node.id += id; }
		);
		return node;
	},
	initUI: function() {
		this.initShortcutEditor();
		this.appendTypesList();
		this.initImgIgnoreLinks();
		this.disableDelayedAction();
		this.initCustomTypesEditor();
		this.setWinTitle();
	},
	destroy: function() {
		window.removeEventListener("DOMMouseScroll", this, true);
		this.wu.highlightAllOpened();
	},
	alloyApply: function(e) {
		var ln = e.target.localName;
		if(ln == "tab" || ln == "dialog" || ln == "key")
			return;
		this.applyButton.disabled = false;
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
		window[this.wu.winIdProp] = winId;
		this.wu.highlightAllOpened();
	},
	setWinTitle: function() {
		var sh = this.currentShortcut;
		var t = this.ps.getModifiersStr(sh)
			+ " + " + this.ps.getLocaleButtonStr(sh, true);
		var type = this.$("hc-editor-itemTypes").getAttribute("label");
		var ct = this.$("hc-editor-customType").value || this.$("hc-editor-customTypeExtId").value;
		t = " [" + t + (type ? " + " + type : "") + (ct ? " | " + ct : "") + "]";
		document.title = document.title.replace(/\s+\[.+\]$/, "") + t;
	},
	initShortcutEditor: function() {
		var setsObj = this.ut.getOwnProperty(handyClicksPrefs, this.shortcut, this.type) || {};
		this.initFuncEditor(setsObj, "");
		this.$("hc-editor-events").value = setsObj.eventType || "click";

		setsObj = this.ut.getOwnProperty(setsObj, "delayedAction") || {};
		this.initFuncEditor(setsObj, this.delayId);

		if(/(?:^|,)button=(\d)(?:,|$)/.test(this.shortcut))
			this.$("hc-editor-button").value = RegExp.$1;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked
					= new RegExp("(?:^|,)" + mdf + "=true(?:,|$)").test(this.shortcut);
			},
			this
		);
	},
	initFuncEditor: function(setsObj, delayed) {
		var isCustom = !!setsObj.custom;
		this.selectCustomFunc(isCustom, delayed);
		if(isCustom) {
			this.$("hc-editor-funcField" + delayed).newValue = this.ps.dec(setsObj.action);
			this.$("hc-editor-funcInitField" + delayed).newValue = this.ps.dec(setsObj.init);
			this.$("hc-editor-funcLabel" + delayed).value = this.ps.dec(setsObj.label);
		}
		this.initFuncsList(isCustom, setsObj.action || null, delayed);
		this.$("hc-editor-enabled" + delayed).checked = typeof setsObj.enabled != "boolean" || setsObj.enabled;
	},
	selectCustomFunc: function(isCustom, delayed) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgsBox" + delayed).collapsed = isCustom;
		this.$("hc-editor-funcCustom" + delayed).collapsed = !isCustom;
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
		this.setWinTitle();
	},
	customTypeLabel: function(it) {
		if(it.getElementsByAttribute("label", it.value)[0])
			this.initCustomTypesEditor();
	},
	customTypeLabelDelay: function(it) {
		setTimeout(function(_this, it) { _this.customTypeLabel(it); }, 0, this, it);
	},
	customTypeIdFilter: function(e) {
		setTimeout(function(_this, node) { _this._customTypeIdFilter(node); }, 0, this, e.target);
		if(e.type != "keypress")
			return false;
		var key = e.charCode;
		return !key || key < 32 || e.ctrlKey || e.altKey || e.metaKey || !/[^\w$]/.test(String.fromCharCode(key));
	},
	_customTypeIdFilter: function(node) {
		var val = node.value;
		var re = /[^\w$]/g;
		if(re.test(val)) {
			val = val.replace(re, "");
			node.value = val;
		}
		val = "custom_" + val;
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
	initFuncsList: function(custom, action, delayed) {
		delayed = delayed || "";
		var fList = this.$("hc-editor-func" + delayed);
		fList.value = custom // <menulist>
			? "$custom"
			: delayed && !action
				? "$auto"
				: action;
		if(!fList.value) // fix for Firefox 2.0
			fList.selectedIndex = -1;
		var re = new RegExp("(?:^|[\\s,;]+)" + this.escapeRegExp(this.type) + "(?:[\\s,;]+|$)|^\\$all$");
		var mp = this.$("hc-editor-funcPopup" + delayed);
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
		this.addFuncArgs(delayed);
	},
	escapeRegExp: function(s) {
		return ("" + s).replace(/[\\^$+*?()\[\]{}]/g, "\\$&");
	},
	exts: {
		SplitBrowser: "{29c4afe1-db19-4298-8785-fcc94d1d6c1d}",
		FlashGot: "{19503e42-ca3c-4c27-b1e2-9cdb2170ee34}"
	},
	extAvailable: function(eName) {
		var guid = this.exts[eName];
		return !!Components.classes["@mozilla.org/extensions/manager;1"]
			.getService(Components.interfaces.nsIExtensionManager)
			.getInstallLocation(guid);
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
			var setsObj = (handyClicksPrefs[this.shortcut] || {})[iType] || {};
			ignoreLinks.checked = typeof setsObj.ignoreLinks == "boolean" ? setsObj.ignoreLinks : false;
		}
	},
	addFuncArgs: function(delayed) {
		delayed = delayed || "";
		var box = this.$("hc-editor-funcArgs" + delayed);
		while(box.hasChildNodes())
			box.removeChild(box.lastChild);
		var funcs = this.$("hc-editor-func" + delayed);
		var cFunc = funcs.value || null;
		var isCustom = cFunc == "$custom";
		this.selectCustomFunc(isCustom, delayed);
		var argBox = this.$("hc-editor-funcArgsBox" + delayed);
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
		cArgs.split(/[\s,;]+/).forEach(
			function(arg) {
				this.addArgControls(arg, delayed);
			},
			this
		);
	},
	addArgControls: function(arg, delayed) {
		var setsObj = this.ut.getOwnProperty(handyClicksPrefs, this.shortcut, this.type) || {};
		if(delayed)
			setsObj = this.ut.getOwnProperty(setsObj, "delayedAction") || {};
		var cArgVal = typeof setsObj == "object"
			?  this.ut.getOwnProperty(setsObj, "arguments") || {}
			: {};
		cArgVal = this.ut.getOwnProperty(setsObj, "arguments", arg);
		var argType = this.getArgType(arg);
		if(!argType)
			return;
		this.addControl(arg, argType, cArgVal, delayed); // "loadInBackground", "checkbox", true
	},
	getArgType: function(arg) {
		var types = this.argsTypes;
		if(arg in this.types.checkboxes)
			return "checkbox";
		if(arg in this.types.menulists)
			return "menulist";
		this.ut._err("Can't get type of " + arg);
		return null;
	},
	addControl: function(argName, argType, argVal, delayed) {
		var argContainer = document.createElement("hbox");
		argContainer.setAttribute("align", "center");
		argContainer.className = "hc-editor-argsContainer";
		var elt = document.createElement(argType);
		switch(argType) {
			case "checkbox":
				elt.setAttribute("checked", !!argVal);
				elt.setAttribute("label", this.ut.getLocalized(argName));
			break;
			case "menulist":
				// Description:
				var desc = document.createElement("label");
				desc.setAttribute("value", this.ut.getLocalized(argName));
				argContainer.appendChild(desc);
				// List of values:
				var mp = document.createElement("menupopup");
				var vals = this.types.menulists[argName];
				var mi;
				for(var i = 0, len = vals.length; i < len; i++) {
					mi = document.createElement("menuitem");
					mi.setAttribute("value", vals[i]);
					mi.setAttribute("label", this.ut.getLocalized(argName + "[" + vals[i] + "]"));
					mp.appendChild(mi);
				}
				elt.value = argVal + "";
				elt.appendChild(mp);
		}
		elt.setAttribute("hc_argname", argName);
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs" + delayed).appendChild(argContainer);
	},
	get currentShortcut() {
		var s = "button=" + this.$("hc-editor-button").value;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				s += "," + mdf + "=" + this.$("hc-editor-" + mdf).checked;
			},
			this
		);
		return s;
	},
	get currentType() {
		return this.$("hc-editor-itemTypes").value || null;
	},
	loadFuncs: function() {
		this.shortcut = this.currentShortcut;
		this.type = this.currentType;
		this.initShortcutEditor();
		this.setWinId();
		this.setWinTitle();
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
		this.$("hc-editor-funcTabbox").selectedIndex = 0;
	},
	disableDelayedAction: function() {
		var dis = this.$("hc-editor-events").value == "mousedown" || !this.$("hc-editor-enabled").checked;
		this.$("hc-editor-funcTabDelay").setAttribute("disabled", dis);
	},
	fixFocusedElement: function _ffe(e) {
		if(e.type == "select") {
			_ffe.time = Date.now();
			return;
		}
		else if(Date.now() - _ffe.time > 50)
			return;
		// tab seleted ... < 50 ms ... textbox focused
		var fe = document.commandDispatcher.focusedElement;
		if(!fe || fe.localName != "input")
			return;
		var elt = fe.parentNode.parentNode; // <textbox>
		if(!elt || elt.className != "hcText")
			return;
		e.preventDefault();
		e.stopPropagation();
		while(elt) {
			if(elt.localName == "tabpanel") {
				var t = elt.getElementsByTagName("textbox")[1];
				if(!t)
					break;
				t.focus();
				break;
			}
			elt = elt.parentNode;
		}
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

		var so = this.getFuncObj();
		if(!this.ps.isOkShortcut(sh) || !type || !evt || !so) {
			this.ut.alertEx(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("editorIncomplete")
			);
			return false;
		}

		var p = handyClicksPrefs;
		if(!p.hasOwnProperty(sh) || typeof p[sh] != "object")
			p[sh] = {};
		var po = p[sh];
		po[type] = so; // rewrite
		so = po[type];
		so.eventType = evt;

		if(type == "img")
			so.ignoreLinks = this.$("hc-editor-imgIgnoreLinks").checked;

		var dso = this.getFuncObj(this.delayId);
		if(dso) {
			so.delayedAction = dso;
			so.delayedAction.eventType = "_delayed_"; // Required for handyClicksPrefSvc.isOkFuncObj()
		}

		this.ps.saveSettingsObjects(true);
		this.$("hc-editor-enabled").checked = this.ut.getOwnProperty(handyClicksPrefs, sh, type, "enabled");
		var dae = this.ut.getOwnProperty(handyClicksPrefs, sh, type, "delayedAction", "enabled");
		this.$("hc-editor-enabled" + this.delayId).checked = typeof dae == "boolean" ? dae : true;
		this.applyButton.disabled = true;
		return true;
	},
	getFuncObj: function(delayed) {
		delayed = delayed || "";
		var fnc = this.$("hc-editor-func" + delayed).value || null;
		var enabled = this.$("hc-editor-enabled" + delayed).checked;
		if(!fnc || (delayed && fnc == "$auto" && enabled))
			return null;
		var so = { enabled: enabled };
		var isCustom = fnc == "$custom";
		if(isCustom) {
			so.custom = isCustom;
			so.label = this.ps.enc(this.$("hc-editor-funcLabel" + delayed).value);
			so.action = this.ps.enc(this.$("hc-editor-funcField" + delayed).value);
			var init = this.$("hc-editor-funcInitField" + delayed).value;
			if(init)
				so.init = this.ps.enc(init);
		}
		else {
			so.action = fnc;
			so.arguments = {};
			var args = so.arguments;
			var aIts = this.$("hc-editor-funcArgs" + delayed).getElementsByAttribute("hc_argname", "*");
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
		return so;
	},
	deleteShortcut: function() {
		delete handyClicksPrefs[this.currentShortcut];
		this.ps.saveSettingsObjects();
		this.applyButton.disabled = true;
	},
	saveCustomType: function() {
		var label = this.$("hc-editor-customType").value;
		var cType = this.$("hc-editor-customTypeExtId").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!label || !cType || !def) {
			this.ut.alertEx(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("editorIncomplete")
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
				this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("typeDisablingWarning")
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
		this.applyButton.disabled = true;

		this.appendTypesList();

		return true;
	},
	deleteCustomType: function() {
		delete handyClicksCustomTypes["custom_" + this.$("hc-editor-customTypeExtId").value];
		this.ps.saveSettingsObjects();
		this.applyButton.disabled = true;
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
		var win = si.ownerDocument.defaultView;
		while(
			si && (
				si.getAttribute("disabled") == "true"
				|| si.tagName != "menuitem"
				|| win.getComputedStyle(si, "").display == "none"
				|| win.getComputedStyle(si, "").visibility == "collapse"
			)
		)
			si = plus ? si.nextSibling : si.previousSibling;
		ml.selectedItem = si || (plus ? mp.firstChild : mp.lastChild);
		ml.menuBoxObject.activeChild = ml.mSelectedInternal || ml.selectedInternal;
		ml.doCommand();
	}
};
var handyClicksEditor = {
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
			winRestriction: [-1, 0, 1, 2], // browser.link.open_newwindow.restriction
			target: ["cur", "win", "tab"], // browser.link.open_newwindow
			position: ["top", "right", "bottom", "left"]
		}
	},
	tabs: {
		shortcut: 0,
		itemType: 1
	},
	delayId: "-delay",

	init: function() {
		if(this.ut.fxVersion == 1.5) // "relative" is not supported
			this.types.menulists.moveTabTo.pop();
		this.loadLabels();
		this.createDelayedFuncTab();
		this.initShortcuts();
		this.ps.loadSettings(this.src || null);
		this.initUI();
		this.loadCustomType(this.type);
		this.selectTargetTab();
		this.ps.oSvc.addPrefsObserver(this.appendTypesList, this);
		window.addEventListener("DOMMouseScroll", this, true);
		this.applyButton.disabled = true;
	},
	selectTargetTab: function(delayed, src, line) {
		this.mBox.selectedIndex = this.tabs[this.editorMode];
		if(!src)
			return;
		switch(this.editorMode) {
			case "shortcut":
				var mTab = this.$("hc-editor-funcTabbox");
				mTab.selectedIndex = delayed ? 1 : 0;
				var tab = this.$("hc-editor-funcVarsTabbox" + (delayed ? this.delayId : ""));
				tab.selectedIndex = src == "code" ? 0 : 1;
			break;
			case "itemType":
				var tab = this.$("hc-editor-customTypeFuncs");
				tab.selectedIndex = src == "define" ? 0 : 1;
		}
		var panel = tab.selectedPanel
			|| tab.getElementsByTagName("tabpanels")[0]
				.getElementsByTagName("tabpanel")[tab.selectedIndex];
		var tbs = panel.getElementsByTagName("textbox"), tb;
		var cre = /(?:^|\s)hcEditor(?:\s|$)/;
		for(var i = 0, len = tbs.length; i < len; i++) {
			var tb = tbs[i];
			if(cre.test(tb.className || "")) {
				tb.selectLine(line);
				break;
			}
		}
	},
	initShortcuts: function() {
		this.mBox = this.$("hc-editor-mainTabbox");
		var wa = window.arguments || [];
		this.src = wa[0];
		this.editorMode = wa[1];
		this.shortcut = wa[2];
		this.type = wa[3];
		this.applyButton = document.documentElement.getButton("extra1");
	},
	loadLabels: function() {
		["hc-editor-button", "hc-editor-itemTypes", "hc-editor-funcPopup"].forEach(
			this.localiseLabels,
			this
		);
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				var elt = this.$("hc-editor-" + mdf);
				elt.setAttribute("label", this.ps.keys[elt.getAttribute("label")]);
			},
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
		Array.forEach(
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
			+ " + " + this.ps.getButtonStr(sh, true);
		var type = this.$("hc-editor-itemTypes").getAttribute("label");
		var ct = this.$("hc-editor-customType").value || this.$("hc-editor-customTypeExtId").value;
		t = " [" + t + (type ? " + " + type : "") + (ct ? " | " + ct : "") + "]";
		document.title = document.title.replace(/\s+\[.+\]$/, "") + t;
	},
	initShortcutEditor: function() {
		var setsObj = this.ut.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
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
		if(this.ps.isCustomType(type))
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
		var cts = this.ps.types;
		if(!cType || !cts.hasOwnProperty(cType))
			return;
		var ct = cts[cType] || {};
		cList.value = this.ps.dec(ct.label);
		this.$("hc-editor-customTypeExtId").value = cType.replace(this.ps.customMask, "");
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
		val = this.ps.customPrefix + val;
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
		var cTypes = this.ps.types;
		var typeObj, mi, _mi, dis;
		var hideSep = true;
		for(var cType in cTypes) if(cTypes.hasOwnProperty(cType)) {
			typeObj = cTypes[cType];
			if(!this.ut.isObject(typeObj)) {
				this.ut._err(new Error("Invalid custom type: " + cType + "\nvalue: " + typeObj), true);
				continue;
			}
			mi = <menuitem xmlns={this.ut.XULNS} value={cType} label={this.ps.dec(typeObj.label) || cType} />;
			_mi = mi.copy();
			dis = typeof typeObj.enabled == "boolean" ? !typeObj.enabled : true;
			mi.@disabled = dis;
			_mi.@hc_disabled = dis;
			parent.insertBefore(this.ut.fromXML(mi), sep);
			tList.appendChild(this.ut.fromXML(_mi));
			hideSep = false;
		}
		sep.hidden = hideSep;
		parent.parentNode.value = this.type; // <menulist>
		this.highlightUsedTypes();
	},
	delCustomTypes: function() {
		var mis, mi, j;
		["hc-editor-itemTypes", "hc-editor-customTypePopup"].forEach(
			function(pId) {
				mis = this.$(pId).getElementsByTagName("menuitem");
				for(j = mis.length - 1; j >= 0; j--) {
					mi = mis[j];
					if(this.ps.isCustomType(mi.getAttribute("value")))
						mi.parentNode.removeChild(mi);
				}
			},
			this
		);
	},
	highlightUsedTypes: function() {
		var so = this.ut.getOwnProperty(this.ps.prefs, this.currentShortcut);
		var ml = this.$("hc-editor-itemTypes");
		Array.forEach(
			ml.getElementsByTagName("menuitem"),
			function(mi) {
				var to = this.ut.getOwnProperty(so, mi.value);
				var val = this.ps.isOkFuncObj(to)
					? this.ut.getOwnProperty(to, "enabled")
						? "enabled"
						: "disabled"
					: "none";
				mi.setAttribute("hc_sets", val);
			},
			this
		);
		var si = ml.selectedItem;
		si && ml.setAttribute("hc_sets", si.getAttribute("hc_sets"));
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
			var setsObj = (this.ps.prefs[this.shortcut] || {})[iType] || {};
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
		var setsObj = this.ut.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
		if(delayed)
			setsObj = this.ut.getOwnProperty(setsObj, "delayedAction") || {};
		var cArgVal = this.ut.getOwnProperty(setsObj, "arguments") || {};
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
		this.ut._err(new Error("Can't get type of " + arg));
		return null;
	},
	addControl: function(argName, argType, argVal, delayed) {
		var ns = this.ut.XULNS;
		//default xml namespace = this.ut.XULNS;
		var argContainer = <hbox xmlns={ns} align="center" class="hc-editor-argsContainer" />;
		var elt = <{argType} xmlns={ns} hc_argname={argName} />;
		switch(argType) {
			case "checkbox":
				elt.@checked = !!argVal;
				elt.@label = this.ut.getLocalized(argName);
			break;
			case "menulist":
				// Description:
				argContainer.appendChild(<label xmlns={ns} value={this.ut.getLocalized(argName)} />);
				// List of values:
				var mp = <menupopup xmlns={ns} />;
				this.types.menulists[argName].forEach(
					function(val) {
						var l = this.ut.getLocalized(argName + "[" + val + "]");
						mp.appendChild(<menuitem xmlns={ns} value={val} label={l} />);
					},
					this
				);
				elt.@value = "" + argVal;
				elt.appendChild(mp);
		}
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs" + delayed).appendChild(this.ut.fromXML(argContainer));
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
		this.highlightUsedTypes();
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
		else if(!("time" in _ffe) || Date.now() - _ffe.time > 50)
			return;
		// tab seleted ... < 50 ms ... textbox focused
		var fe = document.commandDispatcher.focusedElement;
		if(!fe || fe.localName != "input")
			return;
		var elt = fe.parentNode.parentNode; // <textbox>
		var cre = /(?:^|\s)hcText(?:\s|$)/;
		if(!elt || !cre.test(elt.className || ""))
			return;
		e.preventDefault();
		e.stopPropagation();
		w:
		while(elt) {
			if(elt.localName == "tabpanel") {
				var ts = elt.getElementsByTagName("textbox"), t;
				for(var i = 1, len = ts.length; i < len; i++) {
					t = ts[i];
					if(!cre.test(t.className || "")) {
						t.focus();
						break w;
					}
				}
			}
			elt = elt.parentNode;
		}
	},

	saveSettings: function(applyFlag) {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.saveShortcut(applyFlag);
			case this.tabs.itemType: return this.saveCustomType(applyFlag);
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
	saveShortcut: function(applyFlag) {
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

		var p = this.ps.prefs;
		if(!p.hasOwnProperty(sh) || !this.ut.isObject(p[sh]))
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

		this.ps.saveSettingsObjects(applyFlag);
		if(!applyFlag) // ondialogaccept
			return true;
		this.$("hc-editor-enabled").checked = this.ut.getOwnProperty(this.ps.prefs, sh, type, "enabled");
		var dae = this.ut.getOwnProperty(this.ps.prefs, sh, type, "delayedAction", "enabled");
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
		delete this.ps.prefs[this.currentShortcut];
		this.ps.saveSettingsObjects();
		this.highlightUsedTypes();
		this.applyButton.disabled = false;
	},
	saveCustomType: function(applyFlag) {
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
		cType = this.ps.customPrefix + cType;

		var cts = this.ps.types;
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
		this.ps.saveSettingsObjects(applyFlag);
		if(!applyFlag) // ondialogaccept
			return true;
		this.applyButton.disabled = true;
		this.appendTypesList();
		return true;
	},
	deleteCustomType: function() {
		delete this.ps.types[this.ps.customPrefix + this.$("hc-editor-customTypeExtId").value];
		this.ps.saveSettingsObjects();
		this.appendTypesList();
		this.applyButton.disabled = false;
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
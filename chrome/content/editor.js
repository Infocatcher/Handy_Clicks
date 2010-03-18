var handyClicksEditor = {
	_testMode: false,

	types: {
		checkboxes: {
			__proto__: null,
			skipCache: true,
			loadInBackground: true,
			loadJSInBackground: true,
			closePopups: true
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

	init: function(reloadFlag) {
		if(this.ut.fxVersion == 1.5) // "relative" is not supported
			this.types.menulists.moveTabTo.pop();
		if(!reloadFlag) {
			this.initExtTypes();
			this.loadLabels();
			this.createDelayedFuncTab();
			this.addTestButtons();
		}
		this.initShortcuts();
		this.ps.loadSettings(this.src || null);
		this.initUI();
		this.loadCustomType(this.type);
		this.selectTargetTab(this.isDelayed);
		this.ps.oSvc.addObserver(this.appendTypesList, this);

		Array.forEach( // Add spellcheck feature for <menulist editable="true" />
			document.getElementsByTagName("menulist"),
			function(ml) {
				if(ml.getAttribute("spellcheck") != "true")
					return;
				var inp = ml.ownerDocument.getAnonymousElementByAttribute(ml, "anonid", "input");
				inp && inp.setAttribute("spellcheck", "true");
			}
		);
		if(this.ut.fxVersion == 3)
			document.documentElement.setAttribute("hc_fxVersion", "3.0"); // See style/editor.css
	},
	destroy: function(reloadFlag) {
		this.wu.markOpenedEditors();
		this._testMode && this.undoTestSettings();
	},
	addTestButtons: function() {
		var bTest = this.ut.parseFromXML(
			<button xmlns={this.ut.XULNS}
				id="hc-editor-buttonTest"
				class="dialog-button"
				command="hc-editor-cmd-test"
			/>
		);
		var bUndo = this.ut.parseFromXML(
			<button xmlns={this.ut.XULNS}
				id="hc-editor-buttonUndo"
				class="dialog-button"
				command="hc-editor-cmd-undo"
			/>
		);
		var bDel = document.documentElement.getButton("extra2");
		var insPoint = bDel.nextSibling, parent = bDel.parentNode;
		parent.insertBefore(bTest, insPoint);
		parent.insertBefore(bUndo, insPoint);
	},
	initShortcuts: function() {
		this.mBox = this.$("hc-editor-mainTabbox");
		var wa = "arguments" in window ? window.arguments : [];
		this.src = wa[0];
		this.editorMode = wa[1];
		this.shortcut = wa[2];
		this.type = wa[3];
		this.isDelayed = wa[4];
		this.buttonApply = document.documentElement.getButton("extra1");
	},
	set applyDisabled(dis) {
		this.buttonApply.disabled = dis;
		this.$("hc-editor-cmd-test").setAttribute("disabled", dis);
		this.$("hc-editor-cmd-undo").setAttribute("disabled", dis);
	},
	selectTargetTab: function(delayed, src, line) {
		this.mBox.selectedIndex = this.tabs[this.editorMode];
		if(delayed && !src)
			src = "code";
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
		if(typeof line != "number")
			return;
		var panel = tab.selectedPanel
			|| tab.getElementsByTagName("tabpanels")[0].getElementsByTagName("tabpanel")[tab.selectedIndex];
		var cre = /(?:^|\s)hcEditor(?:\s|$)/;
		Array.some(
			panel.getElementsByTagName("textbox"),
			function(tb) {
				if(cre.test(tb.className || "")) {
					tb.selectLine(line);
					return true;
				}
				return false;
			}
		);
	},
	loadLabels: function() {
		["hc-editor-button", "hc-editor-itemTypes", "hc-editor-func"].forEach(
			this.localizeLabels,
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
	localizeLabels: function(parentId) {
		var ml = this.$(parentId);
		Array.forEach(
			ml.getElementsByTagName("menuitem"),
			function(mi) {
				if(!mi.hasAttribute("hc_extLabel"))
					mi.setAttribute("label", this.ut.getLocalized(mi.getAttribute("label")));
				if(mi.hasAttribute("tooltiptext"))
					mi.setAttribute("tooltiptext", this.ut.getLocalized(mi.getAttribute("tooltiptext")));
			},
			this
		);
		if(this.ut.fxVersion >= 3)
			return;
		// Fix bug in Firefox 1.5 and 2.0
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
		const du = "handyClicksEditor.disableUnsupported();";
		fOpts.setAttribute("onchange", du);
		fOpts.setAttribute("oncommand", du);
	},
	addIds: function(node, id) {
		node.id += id;
		Array.forEach(
			node.getElementsByAttribute("id", "*"),
			function(node) {
				node.id += id;
			}
		);
		return node;
	},
	initExtTypes: function() {
		Array.forEach(
			this.$("hc-editor-itemTypes").getElementsByAttribute("hc_required", "*"),
			function(mi) {
				var ext = mi.getAttribute("hc_required");
				if(!this.extAvailable(ext)) {
					mi.hidden = true;
					return;
				}
				Array.forEach(
					this.$("hc-editor-funcPopup").getElementsByAttribute("hc_extLabel", ext),
					function(mi) {
						mi.setAttribute("label", this.getExtLabel(mi.getAttribute("label")));
					},
					this.su
				);
			},
			this
		);
	},
	_allowUndo: false,
	initUI: function(allowUndo) {
		this._allowUndo = allowUndo;
		this.initShortcutEditor();
		this.appendTypesList();
		this.initImgIgnoreLinks();
		this.initCustomTypesEditor();
		this.setWinTitle();
		this.disableUnsupported();
		this.applyDisabled = true;
		this._allowUndo = false;
	},
	allowApply: function(e) {
		var tar = e.target;
		var ln = tar.localName;
		if(ln == "tab" || ln == "dialog" || ln == "key")
			return;
		this.applyDisabled = false;
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
		this.wu.markOpenedEditors();
	},
	setWinTitle: function() {
		var sh = this.currentShortcut;
		var t = this.ps.getModifiersStr(sh) + " + " + this.ps.getButtonStr(sh, true);
		var type = this.$("hc-editor-itemTypes").getAttribute("label");
		var ct = this.$("hc-editor-customType").value || this.$("hc-editor-customTypeExtId").value;
		t = " [" + t + (type ? " + " + type : "") + (ct ? " | " + ct : "") + "]";
		document.title = document.title.replace(/\s+\[.+\]\*?$/, "") + t + (this.ps.otherSrc ? "*" : "");
	},
	initShortcutEditor: function() {
		var so = this.ut.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
		this.initFuncEditor(so, "");
		this.$("hc-editor-events").value = so.eventType || "click";

		so = this.ut.getOwnProperty(so, "delayedAction") || {};
		this.initFuncEditor(so, this.delayId);

		var butt = /(?:^|,)button=(\d)(?:,|$)/.test(this.shortcut) && RegExp.$1 || "0";
		this.$("hc-editor-button").value = butt;
		this.$("hc-editor-events-command").disabled = butt != "0";
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked
					= new RegExp("(?:^|,)" + mdf + "=true(?:,|$)").test(this.shortcut);
			},
			this
		);
	},
	initFuncEditor: function(setsObj, delayed, allowUndo) {
		var isCustom = !!setsObj.custom;
		this.selectCustomFunc(isCustom, delayed);
		if(isCustom) {
			const val = allowUndo || this._allowUndo ? "value" : "newValue";
			this.$("hc-editor-funcField"     + delayed)[val]  = this.ps.dec(setsObj.action);
			this.$("hc-editor-funcInitField" + delayed)[val]  = this.ps.dec(setsObj.init);
			this.$("hc-editor-funcLabel"     + delayed).value = this.ps.dec(setsObj.label);
		}
		this.initFuncsList(isCustom, setsObj.action || null, delayed);
		this.$("hc-editor-enabled" + delayed).checked = typeof setsObj.enabled != "boolean" || setsObj.enabled;
		if(!delayed)
			this.$("hc-editor-allowMousedown").value = "" + this.ut.getOwnProperty(setsObj, "allowMousedownEvent");
	},
	selectCustomFunc: function(isCustom, delayed) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgsBox" + delayed).collapsed = isCustom;
		this.$("hc-editor-funcCustom"  + delayed).collapsed = !isCustom;
	},
	loadCustomType: function(type) {
		if(this.ps.isCustomType(type))
			this.initCustomTypesEditor(type);
	},
	editCustomType: function(e) {
		if(e.button != 2)
			return;
		e.preventDefault();
		var tar = e.target;
		var cType = tar.value;
		this.loadCustomType(cType);
		this.mBox.selectedIndex = this.tabs.itemType;
		var mp = tar.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
	},
	initCustomTypesEditor: function(cType, to) {
		if(!to) {
			var cList = this.$("hc-editor-customType");
			if(!cType) {
				var sItem = cList.selectedItem;
				cType = sItem ? sItem.value : null;
			}
		}
		var enabledElt = this.$("hc-editor-customTypeEnabled");
		var cts = this.ps.types;
		if(!to && (!cType || !cts.hasOwnProperty(cType))) {
			enabledElt.checked = true;
			return;
		}
		var ct = to || cts[cType];
		if(!this.ut.canHasProps(ct))
			ct = {};
		enabledElt.checked = typeof ct.enabled == "boolean" ? ct.enabled : true;
		const val = to || this._allowUndo ? "value" : "newValue";
		this.$("hc-editor-customTypeDefine") [val] = this.ps.dec(ct.define);
		this.$("hc-editor-customTypeContext")[val] = this.ps.dec(ct.contextMenu);
		if(!to) {
			cList.value = this.ps.dec(ct.label);
			this.$("hc-editor-customTypeExtId").value = this.ps.removeCustomPrefix(cType);
			this.setWinId();
			this.setWinTitle();
		}
	},
	customTypeLabel: function(it) {
		if(it.getElementsByAttribute("label", it.value)[0])
			this.initCustomTypesEditor();
	},
	customTypeLabelDelay: function(it) {
		this.ut.timeout(this.customTypeLabel, this, [it], 0);
	},
	customTypeIdFilter: function(e) {
		this.ut.timeout(this._customTypeIdFilter, this, [e.target], 0);
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
		var typeObj, mi, _mi;
		var hideSep = true;
		for(var cType in cTypes) if(cTypes.hasOwnProperty(cType)) {
			typeObj = cTypes[cType];
			if(!this.ut.isObject(typeObj)) {
				this.ut._err(new Error("Invalid custom type: " + cType + "\nvalue: " + typeObj), true);
				continue;
			}
			mi = <menuitem xmlns={this.ut.XULNS} value={cType} label={this.ps.dec(typeObj.label) || cType} />;
			_mi = mi.copy();
			mi.@disabled = _mi.@hc_disabled = typeof typeObj.enabled == "boolean" ? !typeObj.enabled : true;
			parent.insertBefore(this.ut.parseFromXML(mi), sep);
			tList.appendChild(this.ut.parseFromXML(_mi));
			hideSep = false;
		}
		sep.hidden = hideSep;
		parent.parentNode.value = this.type; // <menulist>
		this.highlightUsedTypes();
	},
	delCustomTypes: function() {
		["hc-editor-itemTypes", "hc-editor-customTypePopup"].forEach(
			function(pId) {
				var mis = this.$(pId).getElementsByTagName("menuitem"), mi;
				for(var i = mis.length - 1; i >= 0; i--) {
					mi = mis[i];
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
		const type = this.type;
		var hideSep = true;
		Array.forEach(
			this.$("hc-editor-funcPopup" + delayed).childNodes,
			function(it) {
				if(it.localName == "menuseparator") {
					it.hidden = hideSep;
					hideSep = true;
					return;
				}
				if(this.notSupported(type, it)) {
					it.hidden = true;
					return;
				}
				it.hidden = hideSep = false;
			},
			this
		);
		this.addFuncArgs(delayed);
	},
	notSupported: function(type, actionItem, supp, app, req) {
		if(actionItem) {
			supp = actionItem.getAttribute("hc_supports");
			app  = actionItem.getAttribute("hc_app");
			req  = actionItem.getAttribute("hc_required");
		}
		return supp && supp.split(/,\s*/).indexOf(type) == -1
			|| app && app.split(/,\s*/).indexOf(this.ut.appInfo.name) == -1
			|| req && !this.extAvailable(req);
	},
	exts: {
		SplitBrowser: "{29c4afe1-db19-4298-8785-fcc94d1d6c1d}",
		FlashGot: "{19503e42-ca3c-4c27-b1e2-9cdb2170ee34}",
		"Multiple Tab Handler": "multipletab@piro.sakura.ne.jp"
	},
	extAvailable: function(eName) {
		return this.eh.isAvailable(this.exts[eName]);
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
		this.ut.removeChilds(box);
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
		cArgs.split(/,\s*/).forEach(
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
		if(argType)
			this.addControl(arg, argType, cArgVal, delayed); // "loadInBackground", "checkbox", true
	},
	getArgType: function(arg) {
		var types = this.types;
		if(arg in types.checkboxes)
			return "checkbox";
		if(arg in types.menulists)
			return "menulist";
		this.ut._err(new Error("Can't get type of " + arg));
		return null;
	},
	addControl: function(argName, argType, argVal, delayed) {
		const ns = this.ut.XULNS;
		//default xml namespace = this.ut.XULNS;
		var argContainer = <hbox xmlns={ns} align="center" class="hc-editor-argsContainer" />;
		var elt = <{argType} xmlns={ns} hc_argName={argName} />;
		elt.@onclick = "handyClicksEditor.clickHelper(event);";

		var cfgTt = this.ut.getLocalized("openAboutConfig");
		var cfg;

		switch(argType) {
			case "checkbox":
				elt.@checked = !!argVal;
				var label = elt.@label = this.ut.getLocalized(argName);

				cfg = this.getAboutConfigEntry(label);
				if(cfg) {
					elt.@hc_aboutConfigEntry = cfg;
					elt.@tooltiptext = cfgTt;
				}
			break;
			case "menulist":
				// Description:
				argContainer.appendChild(<label xmlns={ns} value={this.ut.getLocalized(argName)} />);
				// List of values:
				var mp = <menupopup xmlns={ns} />;
				this.types.menulists[argName].forEach(
					function(val, indx) {
						var label = this.ut.getLocalized(argName + "[" + val + "]");
						cfg = this.getAboutConfigEntry(label);
						var mi = <menuitem xmlns={ns} value={val} label={label}
							hc_aboutConfigEntry={cfg} tooltiptext={cfg ? cfgTt : ""} />;
						if(!cfg) // Firefox 1.5 crashes on actions like mi.@some_attribute = "";
							delete mi.@hc_aboutConfigEntry;
						else if(!argVal && indx === 0 || val == argVal) { //~ todo: test!
							elt.@hc_aboutConfigEntry = cfg;
							elt.@tooltiptext = cfgTt;
							elt.@oncommand = "handyClicksEditor.setAboutConfigTooltip(this);";
						}
						mp.appendChild(mi);
					},
					this
				);
				elt.@value = "" + argVal;
				elt.appendChild(mp);
		}
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs" + delayed).appendChild(this.ut.parseFromXML(argContainer));
	},
	getAboutConfigEntry: function(label) {
		return /\(([\w-]+(?:\.[\w-]+)+)\)/.test(label) && RegExp.$1;
	},
	clickHelper: function(e) {
		if(e.button != 2)
			return;
		var tar = e.target;
		if(!tar.hasAttribute("hc_aboutConfigEntry"))
			return;
		var mp = tar.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
		this.pu.openAboutConfig(tar.getAttribute("hc_aboutConfigEntry"));
	},
	setAboutConfigTooltip: function(ml) {
		var si = ml.selectedItem;
		if(si && si.hasAttribute("hc_aboutConfigEntry")) {
			ml.setAttribute("hc_aboutConfigEntry", si.getAttribute("hc_aboutConfigEntry"));
			ml.setAttribute("tooltiptext", this.ut.getLocalized("openAboutConfig"));
			return;
		}
		ml.removeAttribute("hc_aboutConfigEntry");
		ml.removeAttribute("tooltiptext");
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
		this.disableUnsupported();
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
		//this.allowApply(e);
		this.$("hc-editor-funcTabbox").selectedIndex = 0;
	},
	disableUnsupported: function() {
		var isMd = this.$("hc-editor-events").value == "mousedown";
		this.$("hc-editor-funcTabDelay").setAttribute("hc_disabled", isMd || !this.$("hc-editor-enabled").checked);
		const id = "hc-editor-allowMousedown";
		this.$(id + "Label").disabled = this.$(id).disabled = isMd;
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
		for(; elt; elt = elt.parentNode) {
			if(elt.localName != "tabpanel")
				continue;
			var ts = elt.getElementsByTagName("textbox"), t;
			for(var i = 1, len = ts.length; i < len; i++) {
				t = ts[i];
				if(!cre.test(t.className || "")) {
					t.focus();
					break w;
				}
			}
		}
	},

	saveSettings: function(applyFlag) {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.saveShortcut(applyFlag);
			case this.tabs.itemType: return this.saveCustomType(applyFlag);
			default: return false;
		}
	},
	testSettings: function() {
		//~ todo: save settings to temp file (aka crash recovery)
		this.$("hc-editor-cmd-test").setAttribute("disabled", "true");
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.testShortcut();
			case this.tabs.itemType: return this.testCustomType();
			default: return false;
		}
	},
	undoTestSettings: function(reloadAll) {
		this._testMode = false;
		this.ps.reloadSettings(reloadAll);
		reloadAll && this.initUI(true);
	},
	deleteSettings: function() {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.deleteShortcut();
			case this.tabs.itemType: return this.deleteCustomType();
			default: return false;
		}
	},
	copySettings: function() {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.copyShortcut();
			case this.tabs.itemType: return this.copyCustomType();
			default: return false;
		}
	},
	pasteSettings: function() {
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: return this.pasteShortcut();
			case this.tabs.itemType: return this.pasteCustomType();
			default: return false;
		}
	},
	saveShortcut: function(applyFlag, testFlag) {
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
			so.delayedAction.eventType = "__delayed__"; // Required for handyClicksPrefSvc.isOkFuncObj()
		}

		this._testMode = testFlag; //~ todo: test!
		if(testFlag)
			this.ps.testSettings();
		else {
			if(this.ps.otherSrc)
				this.ps.reloadSettings(applyFlag);
			else
				this.ps.saveSettingsObjects(applyFlag);
			if(!applyFlag) // ondialogaccept
				return true;
			this.applyDisabled = true;
		}

		this.$("hc-editor-enabled").checked = this.ut.getOwnProperty(this.ps.prefs, sh, type, "enabled");
		var dae = this.ut.getOwnProperty(this.ps.prefs, sh, type, "delayedAction", "enabled");
		this.$("hc-editor-enabled" + this.delayId).checked = typeof dae == "boolean" ? dae : true;
		return true;
	},
	testShortcut: function() {
		return this.saveShortcut(true, true);
	},
	getFuncObj: function(delayed) {
		delayed = delayed || "";
		var fnc = this.$("hc-editor-func" + delayed).value || null;
		var enabled = this.$("hc-editor-enabled" + delayed).checked;
		if(!fnc || (delayed && fnc == "$auto" && enabled))
			return null;
		var so = { enabled: enabled };
		if(!delayed) {
			var amd = this.$("hc-editor-allowMousedown").value;
			if(amd == "true")
				so.allowMousedownEvent = true;
			else if(amd == "false")
				so.allowMousedownEvent = false;
		}
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
			var aIts = this.$("hc-editor-funcArgs" + delayed).getElementsByAttribute("hc_argName", "*");
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
				args[aIt.getAttribute("hc_argName")] = aVal;
			}
		}
		return so;
	},
	deleteShortcut: function() {
		var p = this.ps.prefs;
		var cs = this.currentShortcut;
		var ct = this.currentType;
		if(this.ut.getOwnProperty(p, cs, ct))
			delete p[cs][ct];
		if(this.ps.otherSrc)
			this.ps.reloadSettings();
		else
			this.ps.saveSettingsObjects();
		this.highlightUsedTypes();

		//this.applyDisabled = false;
		this.buttonApply.disabled = false;
	},
	copyShortcut: function() {
		var delayed = this.$("hc-editor-funcTabbox").selectedIndex == 1 ? this.delayId : "";
		var funcs = this.$("hc-editor-func" + delayed);
		var si = funcs.selectedItem;
		if(!si)
			return;
		this.ut.storage("shortcut", {
			supports: si.getAttribute("hc_supports"),
			app:      si.getAttribute("hc_app"),
			required: si.getAttribute("hc_required"),
			so: this.getFuncObj(delayed)
		});
	},
	pasteShortcut: function() {
		var st = this.ut.storage("shortcut");
		if(!st)
			return;
		var type = this.currentType;
		if(
			!type || /^0(?:\.\d+)?$/.test(type) // type can be Math.random()
			|| this.notSupported(type, null, st.supports, st.app, st.required)
		)
			return;

		var isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == 1;
		var delayed = isDelayed ? this.delayId : "";
		var so = st.so;

		this.initFuncEditor(so, delayed, true);
		if(!isDelayed)
			this.$("hc-editor-events").value = so.eventType || "click";

		this.disableUnsupported();
		this.applyDisabled = false;
	},
	saveCustomType: function(applyFlag, testFlag) {
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
			!newEnabl && curEnabl
			&& !this.ut.confirmEx(
				this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("typeDisablingWarning")
			)
		)
			return false;
		cts[cType] = this.getTypeObj(newEnabl, label, def);

		this._testMode = testFlag; //~ todo: test!
		if(testFlag)
			this.ps.testSettings();
		else {
			if(this.ps.otherSrc)
				this.ps.reloadSettings(applyFlag);
			else
				this.ps.saveSettingsObjects(applyFlag);
			if(!applyFlag) // ondialogaccept
				return true;
			this.applyDisabled = true;
		}

		this.appendTypesList();
		return true;
	},
	testCustomType: function() {
		return this.saveCustomType(true, true);
	},
	getTypeObj: function(enabled, label, def) {
		var ct = {
			enabled: arguments.length >= 1 ? enabled : this.$("hc-editor-customTypeEnabled").checked,
			label:  this.ps.enc(arguments.length >= 2 ? label : this.$("hc-editor-customType")      .value),
			define: this.ps.enc(arguments.length >= 3 ? def   : this.$("hc-editor-customTypeDefine").value)
		};
		var cMenu = this.$("hc-editor-customTypeContext").value;
		ct.contextMenu = cMenu ? this.ps.enc(cMenu) : null;
		return ct;
	},
	deleteCustomType: function() {
		delete this.ps.types[this.ps.customPrefix + this.$("hc-editor-customTypeExtId").value];
		if(this.ps.otherSrc)
			this.ps.reloadSettings();
		else
			this.ps.saveSettingsObjects();
		this.appendTypesList();

		//this.applyDisabled = false;
		this.buttonApply.disabled = false;
	},
	copyCustomType: function() {
		this.ut.storage("type", this.getTypeObj());
	},
	pasteCustomType: function() {
		var st = this.ut.storage("type");
		if(!st)
			return;
		this.initCustomTypesEditor(null, st);
		this.applyDisabled = false;
	}
};
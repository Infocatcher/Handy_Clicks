var handyClicksEditor = {
	funcOptsFixed: false,
	testMode: false,

	delayId: "-delay",

	types: {
		checkboxes: {
			skipCache: true,
			loadInBackground: true,
			loadJSInBackground: true,
			closePopups: true,
			__proto__: null
		},
		menulists: {
			refererPolicy: [-1, 0, /*1,*/ 2],
			moveTabTo: ["null", "first", "before", "after", "last", "relative"],
			moveWinTo: ["null", "top", "right", "bottom", "left", "sub"],
			winRestriction: [-1, 0, 1, 2], // browser.link.open_newwindow.restriction
			target: ["cur", "win", "tab"], // browser.link.open_newwindow
			position: ["top", "right", "bottom", "left"],
			__proto__: null
		}
	},
	tabs: {
		shortcut: 0,
		itemType: 1
	},

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

		this.setTooltip();
		this.setFuncsNotes();
		this.setCompactUI();
		this.pu.oSvc.addObserver(this.prefsChanged, this);

		Array.forEach( // Add spellcheck feature for <menulist editable="true" />
			document.getElementsByTagName("menulist"),
			function(ml) {
				if(ml.getAttribute("spellcheck") != "true")
					return;
				var inp = ml.ownerDocument.getAnonymousElementByAttribute(ml, "anonid", "input");
				inp && inp.setAttribute("spellcheck", "true");
			}
		);

		var fb = this.e("hc-editor-funcFixBox");
		fb.style.marginBottom = "-" + fb.boxObject.height + "px";
		document.documentElement.setAttribute("hc_fxVersion", this.ut.fxVersion.toFixed(1)); // See style/editor.css

		window.addEventListener("focus", this, true);
	},
	destroy: function(reloadFlag) {
		this.wu.markOpenedEditors();
		this.testMode && this.undoTestSettings();
		window.removeEventListener("focus", this, true);
	},
	handleEvent: function(e) {
		if(e.type == "focus")
			this.fixFocusedElement(e);
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
				disabled="true"
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
				var tab = this.$("hc-editor-funcCustomTabbox" + (delayed ? this.delayId : ""));
				tab.selectedIndex = src == "code" ? 0 : 1;
			break;
			case "itemType":
				var tab = this.$("hc-editor-customTypeFuncs");
				tab.selectedIndex = src == "define" ? 0 : 1;
		}
		if(typeof line != "number" || !isFinite(line))
			return;
		var panel = tab.selectedPanel
			|| tab.getElementsByTagName("tabpanels")[0].getElementsByTagName("tabpanel")[tab.selectedIndex];
		var cre = /(?:^|\s)hcEditor(?:\s|$)/;
		Array.some(
			panel.getElementsByTagName("textbox"),
			function(tb) {
				if(cre.test(tb.className)) {
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
		this.makeDelayedNode(dTab);
		Array.forEach(
			dTab.getElementsByTagName("*"),
			this.makeDelayedNode,
			this
		);
		this.$("hc-editor-funcsTab").appendChild(dTab);
	},
	makeDelayedNode: function(node) {
		if(node.hasAttribute("id"))
			node.id += this.delayId;
		if(node.hasAttribute("control"))
			node.setAttribute("control", node.getAttribute("control") + this.delayId);
	},
	setTooltip: function(delay) {
		var dTab = this.$("hc-editor-funcTab-delay");
		dTab.tooltipText = dTab.tooltipText.replace(
			/\d+(?:\s+\d+)*/,
			delay === undefined ? this.pu.pref("delayedActionTimeout") : delay
		);
	},
	setFuncsNotes: function(show) {
		document.documentElement.setAttribute(
			"hc_showCustomFuncsNotes",
			show === undefined ? this.pu.pref("editor.ui.showCustomFuncsNotes") : show
		);
	},
	setCompactUI: function(compact) {
		document.documentElement.setAttribute(
			"hc_compactUI",
			compact === undefined ? this.pu.pref("editor.ui.compact") : compact
		);
	},
	prefsChanged: function(pName, pVal) {
		if(pName == "delayedActionTimeout")
			this.setTooltip(pVal);
		else if(pName == "editor.ui.showCustomFuncsNotes")
			this.setFuncsNotes(pVal);
		else if(pName == "editor.ui.compact")
			this.setCompactUI(pVal);
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
						mi.setAttribute("label", this.su.getExtLabel(mi.getAttribute("label")));
					},
					this
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
				var re = new RegExp("(?:^|,)" + mdf + "=true(?:,|$)");
				this.$("hc-editor-" + mdf).checked = re.test(this.shortcut);
			},
			this
		);
	},
	initFuncEditor: function(setsObj, delayed, allowUndo) {
		var isCustom = this.ut.getOwnProperty(setsObj, "custom");
		this.selectCustomFunc(isCustom, delayed);
		if(isCustom) {
			const val = allowUndo || this._allowUndo ? "value" : "newValue";
			this.$("hc-editor-funcField" + delayed)[val]  = this.ps.dec(this.ut.getOwnProperty(setsObj, "action"));
			this.$("hc-editor-funcLabel" + delayed).value = this.ps.dec(this.ut.getOwnProperty(setsObj, "label"));

			var initField = this.$("hc-editor-funcInitField" + delayed);
			initField[val] = this.ps.dec(this.ut.getOwnProperty(setsObj, "init"));
			this.highlightEmpty(initField);
		}
		this.initFuncsList(setsObj, delayed);
		var enabled = this.ut.getOwnProperty(setsObj, "enabled");
		this.$("hc-editor-enabled" + delayed).checked = typeof enabled != "boolean" || enabled;
		if(!delayed)
			this.$("hc-editor-allowMousedown").value = "" + this.ut.getOwnProperty(setsObj, "allowMousedownEvent");
	},
	selectCustomFunc: function(isCustom, delayed) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgsBox"      + delayed).collapsed =  isCustom;
		this.$("hc-editor-funcLabelBox"     + delayed).style.visibility = isCustom ? "" : "hidden";
		this.$("hc-editor-funcCustomTabbox" + delayed).collapsed = !isCustom;
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
		this.$("hc-editor-customTypeDefine")[val] = this.ps.dec(ct.define);
		var contextField = this.$("hc-editor-customTypeContext");
		contextField[val] = this.ps.dec(ct.contextMenu);
		this.highlightEmpty(contextField);
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
		var label, _labels = { __proto__: null };
		for(var cType in cTypes) if(cTypes.hasOwnProperty(cType)) {
			if(!this.ps.isCustomType(cType)) {
				this.ut._warn(new Error("Invalid custom type id: " + cType));
				continue;
			}
			typeObj = cTypes[cType];
			if(!this.ut.isObject(typeObj)) {
				this.ut._warn(new Error("Invalid custom type: " + cType + " (" + typeObj + ")"));
				continue;
			}
			label = this.ps.dec(typeObj.label) || cType;
			if(label in _labels)
				label += " (" + ++_labels[label] + ")";
			else
				_labels[label] = 1;
			mi = <menuitem xmlns={this.ut.XULNS} value={cType} label={label} />;
			_mi = mi.copy();
			mi.@disabled = _mi.@hc_disabled = typeof typeObj.enabled == "boolean" ? !typeObj.enabled : true;
			parent.insertBefore(this.ut.parseFromXML(mi), sep);
			tList.appendChild(this.ut.parseFromXML(_mi));
			hideSep = false;
		}
		sep.hidden = hideSep;
		parent.parentNode.value = this.type || ""; // <menulist>
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
	highlightEmpty: function _he(tb, wait) {
		if(wait) {
			this.ut.timeout(_he, this, [tb]);
			return;
		}
		var empty = !tb.textLength;
		if(tb.__highlightedEmpty == empty)
			return;
		tb.__highlightedEmpty = empty;
		var tab = tb.__parentTab || (tb.__parentTab = this.getTabForNode(tb));
		tab && tab.setAttribute("hc_empty", empty);
	},
	getTabForNode: function(node, noWarnings) {
		var tabPanel, tabBox;
		for(node = node.parentNode; node; node = node.parentNode) {
			var ln = node.localName;
			if(ln == "tabpanel")
				tabPanel = node;
			else if(tabPanel && ln == "tabbox") {
				tabBox = node;
				break;
			}
		}
		if(!tabPanel || !tabBox) {
			!noWarnings && this.ut._warn(new Error("getTabForNode: <tabpanel> or <tabbox> not found!"));
			return null;
		}
		var tabPanels = tabBox.tabpanels || tabBox.getElementsByTagNameNS(this.ut.XULNS, "tabpanels")[0];
		var tabs = tabBox.tabs || tabBox.getElementsByTagNameNS(this.ut.XULNS, "tabs")[0];
		if(!tabPanels || !tabs) {
			!noWarnings && this.ut._warn(new Error("getTabForNode: <tabpanels> or <tabs> not found!"));
			return null;
		}
		var tabPanelIndx = Array.indexOf(tabPanels.childNodes, tabPanel);
		if(tabPanelIndx == -1) {
			!noWarnings && this.ut._warn(new Error("getTabForNode: index of <tabpanel> not found!"));
			return null;
		}
		return tabs.childNodes[tabPanelIndx];
	},
	initFuncsList: function(setsObj, delayed) {
		delayed = delayed || "";
		var action = this.ut.getOwnProperty(setsObj, "action") || null;
		var fList = this.$("hc-editor-func" + delayed);
		fList.value = this.ut.getOwnProperty(setsObj, "custom") // <menulist>
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
		this.addFuncArgs(delayed, setsObj);
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
	initImgIgnoreLinks: function(iType, setsObj) {
		iType = iType || this.currentType;
		var isImg = iType == "img";
		this.$("hc-editor-funcOptsAdd").hidden = !isImg;
		if(isImg) {
			setsObj = setsObj || this.ut.getOwnProperty(this.ps.prefs, this.shortcut, iType);
			var ignoreLinks = this.ut.getOwnProperty(setsObj, "ignoreLinks") || false;
			this.$("hc-editor-imgIgnoreLinks").checked = ignoreLinks;
		}
	},
	addFuncArgs: function(delayed, setsObj) {
		delayed = delayed || "";
		this.ut.removeChilds(this.$("hc-editor-funcArgs" + delayed));
		var funcsList = this.$("hc-editor-func" + delayed);
		var cFunc = funcsList.value || null;
		var isCustom = cFunc == "$custom";
		this.selectCustomFunc(isCustom, delayed);
		var argBox = this.$("hc-editor-funcArgsBox" + delayed);
		argBox.hidden = true;
		if(cFunc == "$custom")
			return;
		var cMi = funcsList.selectedItem;
		if(!cMi)
			return;
		var cArgs = cMi.getAttribute("hc_args");
		if(!cArgs)
			return;
		argBox.hidden = false;
		cArgs.split(/,\s*/).forEach(
			function(argName) {
				this.addArgControls(argName, delayed, setsObj);
			},
			this
		);
	},
	addArgControls: function(argName, delayed, setsObj) {
		setsObj = setsObj || this.ut.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
		if(delayed)
			setsObj = this.ut.getOwnProperty(setsObj, "delayedAction") || {};
		var argVal = this.ut.getOwnProperty(setsObj, "arguments", argName);
		var argType = this.getArgType(argName);
		if(argType)
			this.addControl(argName, argType, argVal, delayed); // "loadInBackground", "checkbox", true
	},
	getArgType: function(argName) {
		var types = this.types;
		if(argName in types.checkboxes)
			return "checkbox";
		if(argName in types.menulists)
			return "menulist";
		this.ut._err(new Error("Can't get type of " + argName));
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
						var mi = <menuitem xmlns={ns}
							value={val}
							label={label}
							hc_aboutConfigEntry={cfg}
							tooltiptext={cfg ? cfgTt : ""}
						/>;
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
		return this.$("hc-editor-itemTypes").value || undefined;
	},

	loadFuncs: function() {
		this.shortcut = this.currentShortcut;
		this.type = this.currentType;
		if(this.funcOptsFixed) {
			this.initShortcutEditor(); //~ ugly, ugly, ugly...

			this.cantFixFuncOpts = !this.pasteShortcut(false, this._fixedFuncObj);
			this.pasteShortcut(true, this._fixedFuncObjDelayed);
		}
		else {
			this.initShortcutEditor();
		}
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
	},

	fixFuncOpts: function(fix) {
		this.funcOptsFixed = fix;

		var so = this._fixedFuncObj = fix && this.copyShortcut(false, true);
		this._fixedFuncObjDelayed   = fix && this.copyShortcut(true,  true);

		this.$("hc-editor-targetBox").setAttribute("hc_fixedFields", fix);
		this.cantFixFuncOpts = fix && !so;
	},
	set cantFixFuncOpts(val) {
		this.$("hc-editor-funcOptsFixed").setAttribute("hc_cantFixFields", val);
	},

	disableUnsupported: function() {
		var isMd = this.$("hc-editor-events").value == "mousedown";
		this.$("hc-editor-funcTab-delay").setAttribute(
			"hc_disabled",
			isMd || !this.$("hc-editor-enabled").checked || !this.$("hc-editor-enabled" + this.delayId).checked
		);
		const id = "hc-editor-allowMousedown";
		this.$(id + "Label").disabled = this.$(id).disabled = isMd;
	},
	hasCaller: function(calledFunc, func) {
		for(var caller = calledFunc.caller; caller; caller = caller.caller) {
			if(caller === func)
				return true;
			if(caller === calledFunc) // Prevent recursion
				return false;
		}
		return false;
	},
	fixFocusedElement: function _ffe(e) {
		// Stack example: _ffe <- this.handleEvent <- _ffe.caller.caller
		//this.ut._log(new Error().stack);
		if(!this.hasCaller(_ffe, document.commandDispatcher.advanceFocusIntoSubtree))
			return;
		var tar = e.target;
		if(tar.localName != "textbox" || !tar.hasAttribute("tabindex") || tar.getAttribute("readonly") != "true")
			return;
		e.preventDefault();
		for(var node = tar.parentNode; node; node = node.parentNode) {
			if(node.localName != "tabpanel")
				continue;
			Array.some(
				node.getElementsByTagName("textbox"),
				function(elt) {
					if(elt.hasAttribute("tabindex") || elt.getAttribute("readonly") == "true")
						return false;
					elt.focus();
					return true;
				}
			);
			break;
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
		this.$("hc-editor-cmd-test").setAttribute("disabled", "true");
		var ok = false;
		switch(this.mBox.selectedIndex) {
			case this.tabs.shortcut: ok = this.testShortcut();   break;
			case this.tabs.itemType: ok = this.testCustomType();
		}
		ok = ok && this.testMode;
		if(ok)
			this.$("hc-editor-cmd-undo").setAttribute("disabled", "false");
		return ok;
	},
	undoTestSettings: function(reloadAll) {
		this.testMode = false;
		this.ps.reloadSettings(reloadAll);
		if(reloadAll) {
			this.initUI(true);
			this.$("hc-editor-cmd-undo").setAttribute("disabled", "true");
		}
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
		var so = this.getFuncObj();
		var dso = this.getFuncObj(this.delayId);

		var typesList = this.$("hc-editor-itemTypes");
		var eventsList = this.$("hc-editor-events");
		var funcList = this.$("hc-editor-func");
		if(
			!this.ps.isOkShortcut(sh) // Not needed?
			|| !type || !so || dso === null
			|| !this.checkMenulist(typesList)
			|| !this.checkMenulist(eventsList)
			|| !this.checkMenulist(funcList)
		) {
			var req = [typesList, eventsList, funcList];
			if(this.$("hc-editor-func").value == "$custom")
				req.push(this.$("hc-editor-funcField"));
			if(this.$("hc-editor-func" + this.delayId).value == "$custom")
				req.push(this.$("hc-editor-funcField" + this.delayId));
			this.highlightRequiredFields(req, true);
			this.ut.alert(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("editorIncomplete")
			);
			this.highlightRequiredFields(req, false);
			return false;
		}

		if(dso)
			so.delayedAction = dso;
		this.ut.setOwnProperty(this.ps.prefs, sh, type, so);

		this.testMode = testFlag; //~ todo: test!
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
		var isDelayed = !!delayed;
		delayed = delayed || "";
		var fnc = this.$("hc-editor-func" + delayed).value || null;
		var enabled = this.$("hc-editor-enabled" + delayed).checked;
		var evt = this.$("hc-editor-events").value;
		if(!fnc || !isDelayed && !evt)
			return null;
		if(isDelayed && fnc == "$auto" && enabled)
			return undefined;
		var so = { enabled: enabled };
		if(!isDelayed) {
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
			var action = this.$("hc-editor-funcField" + delayed).value;
			if(!action)
				return null;
			so.action = this.ps.enc(action);
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
						aVal = Number(aVal);
				}
				args[aIt.getAttribute("hc_argName")] = aVal;
			}
		}
		so.eventType = isDelayed
			? "__delayed__" // Required for handyClicksPrefSvc.isOkFuncObj()
			: evt;
		if(!isDelayed) {
			var type = this.currentType;
			if(type == "img")
				so.ignoreLinks = this.$("hc-editor-imgIgnoreLinks").checked;
		}
		return so;
	},
	deleteShortcut: function() {
		var p = this.ps.prefs;
		var sh = this.currentShortcut;
		var ct = this.currentType;
		if(this.ut.getOwnProperty(p, sh, ct)) {
			delete p[sh][ct];
			if(this.ut.isEmptyObj(p[sh]))
				delete p[sh];
		}
		if(this.ps.otherSrc)
			this.ps.reloadSettings();
		else
			this.ps.saveSettingsObjects();
		this.highlightUsedTypes();

		//this.applyDisabled = false;
		this.buttonApply.disabled = false;
	},
	copyShortcut: function(isDelayed, dontCopy) {
		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == 1;
		var delayed = isDelayed ? this.delayId : "";
		var funcs = this.$("hc-editor-func" + delayed);
		var si = funcs.selectedItem;
		if(!si)
			return null;
		var o = {
			supports: si.getAttribute("hc_supports"),
			app:      si.getAttribute("hc_app"),
			required: si.getAttribute("hc_required"),
			so: this.getFuncObj(delayed)
		};
		if(dontCopy)
			return o;
		return this.ut.storage("shortcut", o);
	},
	pasteShortcut: function(isDelayed, stored) {
		stored = stored || this.ut.storage("shortcut");
		if(!stored)
			return false;
		var type = this.currentType;
		if(!type || this.notSupported(type, null, stored.supports, stored.app, stored.required))
			return false;

		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == 1;
		var delayed = isDelayed ? this.delayId : "";
		var so = stored.so;

		this.initFuncEditor(so, delayed, true);
		if(!isDelayed) {
			this.$("hc-editor-events").value = so.eventType || "click";
			this.initImgIgnoreLinks(type, so);
		}

		this.disableUnsupported();
		this.applyDisabled = false;
		return true;
	},
	saveCustomType: function(applyFlag, testFlag) {
		var label = this.$("hc-editor-customType").value;
		var cType = this.$("hc-editor-customTypeExtId").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!label || !cType || !def) {
			var req = [
				this.$("hc-editor-customType"),
				this.$("hc-editor-customTypeExtId"),
				this.$("hc-editor-customTypeDefine")
			];
			this.highlightRequiredFields(req, true);
			this.ut.alert(
				this.ut.getLocalized("errorTitle"),
				this.ut.getLocalized("editorIncomplete")
			);
			this.highlightRequiredFields(req, false);
			return false;
		}
		cType = this.ps.customPrefix + cType;

		var cts = this.ps.types;
		var ct = cts[cType] || {};
		var curEnabl = ct.enabled || false;
		var newEnabl = this.$("hc-editor-customTypeEnabled").checked;
		if(
			!newEnabl && curEnabl
			&& !this.ut.confirm(
				this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("typeDisablingWarning")
			)
		)
			return false;
		cts[cType] = this.getTypeObj(newEnabl, label, def);

		this.testMode = testFlag; //~ todo: test!
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
		var stored = this.ut.storage("type");
		if(!stored)
			return;
		this.initCustomTypesEditor(null, stored);
		this.applyDisabled = false;
	},

	highlightRequiredFields: function _hl(fields, addFlag, noDelay) {
		if(!addFlag && !noDelay) {
			this.ut.timeout(_hl, this, [fields, false, true], 2500);
			return;
		}
		fields.forEach(
			function(field) {
				if(
					addFlag && field.value
					&& (field.localName != "menulist" || this.checkMenulist(field))
				)
					return;
				this.ut.attribute(field, "hc_requiredField", addFlag);
				for(var tab = this.getTabForNode(field); tab; tab = this.getTabForNode(tab, true))
					this.ut.attribute(tab, "hc_requiredFieldParentTab", addFlag && tab.getAttribute("selected") != "true");
			},
			this
		);
	},
	checkMenulist: function(ml) {
		//~ note: disabled state are not checked
		return this.ut.isElementVisible(ml.selectedItem);
	}
};
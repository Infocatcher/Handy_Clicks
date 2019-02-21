var handyClicksEditor = {
	__proto__: handyClicksGlobals,

	delayId: "-delay",

	// "hc-editor-mainTabbox":
	INDEX_SHORTCUT: 0,
	INDEX_TYPE: 1,
	// "hc-editor-funcTabbox":
	INDEX_SHORTCUT_NORMAL: 0,
	INDEX_SHORTCUT_DELAYED: 1,
	// "hc-editor-funcCustomTabbox":
	INDEX_SHORTCUT_CODE: 0,
	INDEX_SHORTCUT_INIT: 1,
	// "hc-editor-customTypeTabbox":
	INDEX_TYPE_DEFINE: 0,
	INDEX_TYPE_CONTEXT: 0,

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

	funcOptsFixed: false,
	testMode: false,

	init: function hce_init(reloadFlag) {
		if(this.fxVersion == 1.5) // "relative" is not supported
			this.types.menulists.moveTabTo.pop();
		this.initShortcuts();
		if(!reloadFlag) {
			var type = this.type;
			if(type)
				this.currentType = type;
			this.initExtTypes();
			this.loadLabels();
			this.createDelayedFuncTab();
			this.addTestButtons();

			this.delay(function() {
				var ml = this.$("hc-editor-customType");
				var inp = document.getAnonymousElementByAttribute(ml, "anonid", "input");
				inp.setAttribute("spellcheck", "true");
				inp.setAttribute("tooltiptext", ml.getAttribute("hc_tooltiptext"));
			}, this);

			// Fix Ctrl(+Shift)+Tab and Ctrl+PageUp/Ctrl+PageDown navigation in Firefox 52+
			var tabboxProto = this.mainTabbox.__proto__;
			tabboxProto._origHandleEvent = tabboxProto.handleEvent;
			tabboxProto.handleEvent = function(e) {
				if("defaultPrevented" in e && e.defaultPrevented)
					return undefined;
				return this._origHandleEvent.apply(this, arguments);
			};

			var mouseEvt = typeof MouseEvent == "function" // Firefox 11+
				&& ("" + MouseEvent).charAt(0) != "[" // Trick for Firefox <= 2.0
				? new MouseEvent("click")
				: document.createEvent("MouseEvents");
			if(!("getModifierState" in mouseEvt)) { // Works only in Firefox 15+
				var os = this.$("hc-editor-os");
				os.style.opacity = 0.55;
				os.setAttribute("tooltiptext", os.getAttribute("hc_note"));
			}

			if(this.fxVersion == 3) { // Trick to show line-through
				var sheet = document.styleSheets[0];
				sheet.insertRule(
					'menuitem[hc_sets="disabled"], menulist[hc_sets="disabled"] > .menulist-label-box\n\
					{ text-decoration: line-through underline; }',
					sheet.cssRules.length
				);
			}
		}
		this.ps.loadSettings(this.src || null);
		this.selectTargetTab(this.isDelayed);
		this.initUI();
		if(!this.type)
			this.$("hc-editor-itemTypes").setAttribute("label", " "); // Fix height

		this.ps.oSvc.addObserver(this.setsReloading, this);

		this.setTooltip();
		this.setFuncsNotes();
		this.setCompactUI();
		this.pu.oSvc.addObserver(this.prefChanged, this);
		this.checkForCrashBackups(700);

		this._startTime1 = Date.now();
	},
	destroy: function(reloadFlag) {
		this.wu.markOpenedEditors();
		this.testMode && this.undoTestSettings();
		this._savedShortcutObj = this._savedTypeObj = null;
		if(!reloadFlag && this.storage.get("activeLinkedFiles")) {
			var unwatchLinkedFiles = true;
			var ws = this.wu.wm.getEnumerator("handyclicks:editor");
			while(ws.hasMoreElements()) {
				var w = ws.getNext();
				if(w != window && "_handyClicksInitialized" in w) {
					unwatchLinkedFiles = false; // Found opened editor
					break;
				}
			}
		}
		unwatchLinkedFiles && this.watchLinkedFiles(false); // Will be closed all editors
	},
	watchLinkedFile: function(path, file) {
		this._log("Editor: watchLinkedFile(): " + path);
		var alf = this.storage.get("activeLinkedFiles");
		if(!alf) {
			this.storage.set("activeLinkedFiles", (alf = { __proto__: null }));
			this.watchLinkedFiles(true);
		}
		alf[path] = {
			path: file.path,
			lastModified: file.lastModifiedTime,
			size: file.fileSize,
			__proto__: null
		};
	},
	watchLinkedFiles: function(watch) {
		this._log("Editor: watchLinkedFiles(" + watch + ")");
		if(!watch)
			this.storage.set("activeLinkedFiles", undefined);
		this.wu.forEachBrowserWindow(function(w) {
			w.handyClicks.watchLinkedFiles(watch);
		});
	},
	addTestButtons: function() {
		var df = document.createDocumentFragment();
		df.appendChild(this.ut.createElement("button", {
			id: "hc-editor-buttonTest",
			class: "dialog-button hc-iconic",
			command: "hc-editor-cmd-test",
			onclick: "handyClicksEditor.testSettings(event);",
			hc_key: "hc-editor-key-test"
		}));
		df.appendChild(this.ut.createElement("button", {
			id: "hc-editor-buttonUndo",
			class: "dialog-button hc-iconic",
			command: "hc-editor-cmd-undo",
			hc_key: "hc-editor-key-undo",
			disabled: "true"
		}));
		var delBtn = this.deleteButton;
		delBtn.id = "hc-editor-buttonDelete";
		delBtn.className += " hc-iconic";
		delBtn.setAttribute("hc_key", "hc-editor-key-delete");
		delBtn.parentNode.insertBefore(df, delBtn.nextSibling);
	},
	initShortcuts: function() {
		this.mainTabbox = this.$("hc-editor-mainTabbox");

		var wa = "arguments" in window ? window.arguments : [];
		this.src = wa[0];
		this.editorMode = wa[1];
		this.shortcut = wa[2];
		this.type = wa[3];
		this.isDelayed = wa[4];
		this.customType = null;
		this.customTypeLabel = "";
		var de = this.root = document.documentElement;
		this.applyButton = de.getButton("extra1");
		this.deleteButton = de.getButton("extra2");
		// Will be enabled only in case of changed settings format
		this.applyButton.disabled = true;
	},
	get editorTabIndex() {
		return this.mainTabbox.selectedIndex;
	},
	set editorTabIndex(indx) {
		this.mainTabbox.selectedIndex = indx;
	},
	setsReloading: function(notifyReason) {
		if(notifyReason & this.ps.SETS_RELOADED) {
			this.appendTypesList();
			this.dataSaved();
			this.setDialogButtons();
		}
	},
	set applyDisabled(dis) {
		this.applyButton.disabled = dis;
		this.$("hc-editor-cmd-test").setAttribute("disabled", dis);
		dis && this.setTestUndo();
	},
	setTestUndo: function(canUndo) {
		if(canUndo === undefined)
			canUndo = this.ps.hasTestSettings;
		this.$("hc-editor-cmd-undo").setAttribute("disabled", !canUndo);
	},
	selectTargetTab: function hce_selectTargetTab(isDelayed, src, line) {
		this.editorTabIndex = this.editorMode == this.ct.EDITOR_MODE_TYPE
			? this.INDEX_TYPE
			: this.INDEX_SHORTCUT;

		if(isDelayed && !src)
			src = this.ct.EDITOR_SHORTCUT_CODE;
		if(!src)
			return;
		var tabbox, si;
		switch(this.editorMode) {
			default:
			case this.ct.EDITOR_MODE_SHORTCUT:
				this.selectFuncTab(isDelayed);
				tabbox = this.$("hc-editor-funcCustomTabbox" + (isDelayed ? this.delayId : ""));
				si = src == this.ct.EDITOR_SHORTCUT_INIT
						? this.INDEX_SHORTCUT_INIT
						: this.INDEX_SHORTCUT_CODE;
			break;
			case this.ct.EDITOR_MODE_TYPE:
				tabbox = this.$("hc-editor-customTypeTabbox");
				si = src == this.ct.EDITOR_TYPE_CONTEXT
					? this.INDEX_TYPE_CONTEXT
					: this.INDEX_TYPE_DEFINE;
		}
		tabbox.selectedIndex = si;
		if(typeof line != "number" || !isFinite(line))
			return;
		var editor = this.getEditorFromTabbox(tabbox);
		if(!editor)
			return;
		if(this.ps.getSourcePath(editor.value))
			editor.openExternalEditor(line);
		else
			editor.selectLine(line);
	},
	selectFuncTab: function(isDelayed) {
		this.$("hc-editor-funcTabbox").selectedIndex = isDelayed
			? this.INDEX_SHORTCUT_DELAYED
			: this.INDEX_SHORTCUT_NORMAL;
	},
	get selectedTabbox() {
		var tabbox = this.mainTabbox;
		for(;;) {
			var panel = this.getSelectedPanel(tabbox);
			var tabboxes = panel.getElementsByTagName("tabbox");
			if(!tabboxes.length)
				break;
			tabbox = tabboxes[0];
		}
		return tabbox;
	},
	getSelectedPanel: function(tabbox) {
		return tabbox.selectedPanel
			|| tabbox.getElementsByTagName("tabpanels")[0] //~ todo: test
				.getElementsByTagName("tabpanel")[tabbox.selectedIndex];
	},
	getEditorFromPanel: function (panel) {
		var cre = /(?:^|\s)hcEditor(?:\s|$)/;
		var editor;
		Array.prototype.some.call(
			panel.getElementsByTagName("textbox"),
			function(tb) {
				if(cre.test(tb.className))
					return editor = tb;
				return false;
			}
		);
		return editor;
	},
	getEditorFromTabbox: function(tabbox) {
		return this.getEditorFromPanel(this.getSelectedPanel(tabbox));
	},
	getTabboxFromChild: function(node) {
		for(node = node.parentNode; node; node = node.parentNode)
			if(node.localName == "tabbox")
				return node;
		return null;
	},
	getFloatButton: function(cmd, sourceNode) {
		var tabbox = sourceNode.localName == "tabbox"
			? sourceNode
			: this.getTabboxFromChild(sourceNode);
		var toolbar = tabbox.firstChild;
		return toolbar.getElementsByAttribute("command", cmd)[0];
	},
	loadLabels: function() {
		["hc-editor-button", "hc-editor-itemTypes", "hc-editor-func"].forEach(
			this.localizeLabels,
			this
		);
		["ctrl", "shift", "alt", "meta", "os"].forEach(
			function(mdf) {
				var elt = this.$("hc-editor-" + mdf);
				elt.setAttribute("label", this.ps.keys[elt.getAttribute("label")]);
			},
			this
		);
		if(this.pu.get("editor.ui.sortInternalTypes"))
			this.sortInternalTypes();
	},
	sortInternalTypes: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var mis = [];
		for(var mi = sep.nextSibling; mi && mi.localName != "menuseparator"; mi = mi.nextSibling)
			mis.push(mi);
		var insPos = mi;
		var mp = mi.parentNode;
		mis.sort(function(a, b) {
			return a.getAttribute("label") > b.getAttribute("label")
		}).forEach(function(mi) {
			mp.insertBefore(mi, insPos);
		});
	},
	localizeLabels: function(parentId) {
		var ml = this.$(parentId);
		Array.prototype.forEach.call(
			ml.getElementsByTagName("menuitem"),
			function(mi) {
				if(!mi.hasAttribute("hc_extLabel"))
					mi.setAttribute("label", this.getLocalized(mi.getAttribute("label")));
				if(mi.hasAttribute("tooltiptext"))
					mi.setAttribute("tooltiptext", this.getLocalized(mi.getAttribute("tooltiptext")));
			},
			this
		);
		if(this.fxVersion >= 3)
			return;
		// Fix bug in Firefox 1.5 and 2.0
		var si = ml.selectedIndex;
		ml.selectedIndex = null;
		ml.selectedIndex = si;
	},
	createDelayedFuncTab: function() {
		var dTab = this.$("hc-editor-funcTab").cloneNode(true);
		this.makeDelayedNode(dTab);
		Array.prototype.forEach.call(
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
		if(delay === undefined)
			delay = this.pu.get("delayedActionTimeout");
		var dTab = this.$("hc-editor-funcTab-delay");
		dTab.tooltipText = delay <= 0
			? dTab.getAttribute("hc_tooltiptextDisabled")
			: dTab.getAttribute("hc_tooltiptext").replace("$n", delay);
	},
	setFuncsNotes: function(show) {
		this.root.setAttribute(
			"hc_showCustomFuncsNotes",
			show === undefined ? this.pu.get("editor.ui.showCustomFuncsNotes") : show
		);
	},
	setCompactUI: function(compact) {
		this.root.setAttribute(
			"hc_compactUI",
			compact === undefined ? this.pu.get("editor.ui.compact") : compact
		);
	},
	prefChanged: function(pName, pVal) {
		if(pName == "enabled")
			this.setTestUndo(false);
		if(pName == "delayedActionTimeout")
			this.setTooltip(pVal);
		else if(pName == "editor.ui.sortInternalTypes")
			pVal && this.sortInternalTypes(); // Can't undo...
		else if(pName == "editor.ui.showCustomFuncsNotes")
			this.setFuncsNotes(pVal);
		else if(pName == "editor.ui.compact")
			this.setCompactUI(pVal);
		else if(pName == "editor.ui.invertWindowTitle") {
			this.setWinTitle();
			this.setDialogButtons();
		}
	},
	initExtTypes: function() {
		Array.prototype.forEach.call(
			this.$("hc-editor-itemTypes").getElementsByAttribute("hc_required", "*"),
			function(mi) {
				var ext = mi.getAttribute("hc_required");
				if(!this.extEnabled(ext)) {
					mi.hidden = true;
					return;
				}
				Array.prototype.forEach.call(
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
		this.initAdditionalOptions();
		this.initCustomTypesEditor(allowUndo ? this.currentCustomType : this.type);
		this.disableUnsupported();
		this._allowUndo = false;

		this.dataSaved();
		this.setWinId();
		this.setWinTitle();
		this.setEditorButtons();
		this.setDialogButtons();
	},
	handleTabSelect: function(e) {
		if(!("_handyClicksInitialized" in window))
			return;

		var tabs = e.currentTarget;
		if(tabs.parentNode == this.mainTabbox)
			this.editorModeChanged();
		else
			this.setEditorButtons();

		// Don't focus <textbox class="hcText" readonly="true">
		// Based on code from chrome://global/content/bindings/tabbox.xml#tabs
		// advanceSelectedTab() -> _selectNewTab()
		var tabbox = tabs.tabbox || tabs.parentNode;
		var selectedPanel = tabbox.selectedPanel;
		var cd = document.commandDispatcher;
		cd.advanceFocusIntoSubtree(selectedPanel);
		for(;;) {
			var fe = cd.focusedElement;
			if(!fe || fe.localName != "input" || !fe.readOnly)
				break;
			cd.advanceFocus();
		}
	},
	editorModeChanged: function() {
		this.setWinId();
		this.setWinTitle();
		this.setDialogButtons();
		this.setEditorButtons();
	},
	fireEditorChange: function(node) {
		var evt = document.createEvent("Events");
		evt.initEvent("HandyClicks:editor:change", true, false);
		node.dispatchEvent(evt);
	},

	setDialogButtons: function() {
		var shModified = this.shortcutUnsaved;
		var typeModified = this.typeUnsaved;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: this.applyDisabled = !shModified;   break;
			case this.INDEX_TYPE:     this.applyDisabled = !typeModified;
		}
		this.deleteButton.disabled = !this.canDelete;
		document.title = this.su.createTitle(document.title, shModified || typeModified, this.ps.otherSrc);
		this.setModifiedTab(this.$("hc-editor-shortcutTab"), shModified);
		this.setModifiedTab(this.$("hc-editor-itemTypeTab"), typeModified);
	},
	setModifiedTab: function(tab, isModified) {
		tab.setAttribute("label", this.su.createTitle(tab.getAttribute("label"), isModified));
	},
	get canDelete() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT:
				return !!this.ju.getOwnProperty(this.ps.prefs, this.currentShortcut, this.currentType);
			case this.INDEX_TYPE:
				return this.ps.types.hasOwnProperty(this.currentCustomType);
			default:
				return false;
		}
	},

	_savedShortcutObj: null,
	_savedTypeObj: null,
	dataSaved: function() {
		this.shortcutSaved();
		this.typeSaved();
	},
	shortcutSaved: function() {
		this._savedShortcutObj = this.ju.getOwnProperty(this.ps.prefs, this.currentShortcut, this.currentType);
	},
	typeSaved: function() {
		this._savedTypeObj = this.ju.getOwnProperty(this.ps.types, this.currentCustomType);
	},
	get shortcutUnsaved() {
		var curr = this.currentShortcutObj;
		this.ps.sortSettings(curr);
		return curr && !this.ps.settingsEquals(curr, this._savedShortcutObj);
	},
	get typeUnsaved() {
		var curr = this.currentTypeObj;
		this.ps.sortSettings(curr);
		return curr && !this.ps.settingsEquals(curr, this._savedTypeObj);
	},
	get hasUnsaved() {
		return this.shortcutUnsaved || this.typeUnsaved;
	},

	dataChanged: function(e) {
		var trg = e.target;
		var ln = trg.localName;
		if(ln == "tab" || ln == "dialog" || ln == "key")
			return;
		//this.setDialogButtons();
		this.delay(this.setDialogButtons, this, 5);
		if(ln == "textbox" && /(?:^|\s)hcEditor(?:\s|$)/.test(trg.className))
			this.editorChanged(trg);
	},
	_editorTimer: 0,
	editorChanged: function(editor) {
		if(this._editorTimer)
			return;
		this._editorTimer = this.delay(function() {
			this._editorTimer = 0;
			this.setEditorButtons(editor);
			if(editor.getAttribute("hc_highlightEmpty") == "true")
				this.highlightEmpty(editor);
		}, this, 25);
	},
	setWinId: function() {
		var winId;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: winId = this.currentShortcut + "-" + this.currentType; break;
			case this.INDEX_TYPE:     winId = "#custom_types-" + this.currentCustomType;     break;
			default: return;
		}
		winId += this.ps.otherSrc ? this.ct.OTHER_SRC_POSTFIX : "";
		var winIdProp = this.wu.winIdProp;
		if((window[winIdProp] || null) == winId)
			return;
		window[winIdProp] = winId;
		this.wu.markOpenedEditors();
	},
	setWinTitle: function() {
		var shStr = this.ps.getShortcutStr(this.currentShortcut, true);
		var typeItem = this.$("hc-editor-itemTypes").selectedItem; // menulist.label may be wrong on startup!
		if(typeItem)
			shStr += this.ps.spacedSep + typeItem.getAttribute("label");
		var typeStr = this.ps.localize(this.$("hc-editor-customType").value)
			|| this.$("hc-editor-customTypeExtId").value;
		if(typeStr)
			typeStr = this.getLocalized("type").replace("%s", typeStr);
		var sep = typeStr ? " | " : "";
		var title = this.editorTabIndex == this.INDEX_TYPE
			? typeStr + sep + shStr
			: shStr + sep + typeStr;
		var baseTitle = this.su.removeTitleFlags(document.title)
			.replace(/\s+\[.+\]\*?$/, "")
			.replace(/^.*? \u2013 /, "");
		document.title = this.pu.get("editor.ui.invertWindowTitle")
			? title + " \u2013 " + baseTitle
			: baseTitle + " [" + title + "]";
	},
	initShortcutEditor: function() {
		var so = this.ju.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
		this.initFuncEditor(so, "");
		this.$("hc-editor-events").value = so.eventType || "click";

		so = this.ju.getOwnProperty(so, "delayedAction") || {};
		this.initFuncEditor(so, this.delayId);
		this.currentShortcut = this.shortcut;
		this.shortcutSaved();
	},
	initFuncEditor: function(setsObj, delayed, allowUndo) {
		var isCustom = this.ju.getOwnProperty(setsObj, "custom");
		this.selectCustomFunc(isCustom, delayed);
		if(isCustom) {
			const val = allowUndo || this._allowUndo ? "value" : "newValue";
			this.$("hc-editor-funcField" + delayed)[val]  = this.ju.getOwnProperty(setsObj, "action") || "";
			this.$("hc-editor-funcLabel" + delayed).value = this.ju.getOwnProperty(setsObj, "label") || "";

			var initField = this.$("hc-editor-funcInitField" + delayed);
			initField[val] = this.ju.getOwnProperty(setsObj, "init") || "";
			this.highlightEmpty(initField);
		}
		this.initFuncsList(setsObj, delayed);
		var enabled = this.ju.getOwnProperty(setsObj, "enabled");
		this.$("hc-editor-enabled" + delayed).checked = typeof enabled != "boolean" || enabled;
		if(!delayed) {
			this.$("hc-editor-allowMousedown").value = String(this.ju.getOwnProperty(setsObj, "allowMousedownEvent"));
			this.initAdditionalOptions(null, setsObj);
		}
	},
	selectCustomFunc: function(isCustom, delayed) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgsBox"             + delayed).collapsed =  isCustom;
		this.$("hc-editor-funcLabelBox"            + delayed).style.visibility = isCustom ? "" : "hidden";
		this.$("hc-editor-funcCustomTabbox"        + delayed).collapsed = !isCustom;
		this.$("hc-editor-funcCustomTabboxToolbar" + delayed).hidden = !isCustom;
	},
	editCustomType: function(e) {
		if(e.button != 2)
			return;
		var trg = e.target;
		var cType = trg.value;
		if(!this.ps.isCustomType(cType))
			return;

		var mp = trg.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
		this.initCustomTypesEditor(cType);
		this.delay(function() { // Trick to prevent context menu for items inside type tab
			this.editorTabIndex = this.INDEX_TYPE;
		}, this);
	},
	initCustomTypesEditor: function(cType, to) {
		var cList = this.$("hc-editor-customType");
		var updateUI = this.editorTabIndex == this.INDEX_TYPE;
		if(
			this.customType
			&& !this.testMode
			&& this._savedTypeObj
			&& !this.ps.settingsEquals( //~ todo: add API for this?
				this.ps.sortSettings(this.getTypeObj(this.customTypeLabel)),
				this._savedTypeObj
			)
		) {
			var res = this.su.notifyUnsaved(
				this.getLocalized("editorUnsavedSwitchWarning"),
				"editor.unsavedSwitchWarning"
			);
			if(res == this.su.PROMPT_CANCEL) {
				this.currentCustomType = this.customType;
				cList.value = this.customTypeLabel;
				return;
			}
			if(res == this.su.PROMPT_SAVE) {
				var customType = this.currentCustomType;
				var customTypeLabel = cList.value;
				this.currentCustomType = this.customType;
				cList.value = this.customTypeLabel;
				if(!this.saveCustomType(true))
					return;
				this.currentCustomType = customType;
				cList.value = customTypeLabel;
			}
			updateUI = true;
		}

		if(!to) {
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
		if(!this.ju.isObject(ct))
			ct = {};
		enabledElt.checked = typeof ct.enabled == "boolean" ? ct.enabled : true;
		const val = to || this._allowUndo ? "value" : "newValue";
		this.$("hc-editor-customTypeDefine")[val] = ct.define || "";
		var contextField = this.$("hc-editor-customTypeContext");
		contextField[val] = ct.contextMenu || "";
		this.highlightEmpty(contextField);
		if(!to) {
			cList.value = this.customTypeLabel = ct.label || "";
			this.customType = this.currentCustomType = cType;
		}
		this.delay(this.typeSaved, this); // Wait for XBL bindings setup
		this.fireEditorChange(this.$("hc-editor-itemTypePanel"));
		this.setWinId();
		this.setWinTitle();
		updateUI && this.delay(this.setDialogButtons, this);
	},
	customTypeLabelChanged: function(it) {
		var val = it.value;
		this.customTypeLabel = val;
		if(it.getElementsByAttribute("label", val).length)
			this.initCustomTypesEditor();
	},
	customTypeLabelChangedDelay: function(it) {
		this.delay(this.customTypeLabelChanged, this, 0, arguments);
	},
	customTypeIdFilter: function(e) {
		this.delay(this._customTypeIdFilter, this, 0, [e.target]);
		if(e.type != "keypress")
			return false;
		var key = e.charCode;
		var okChar = !key || key < 32 || e.ctrlKey || e.altKey || e.metaKey || !/[^\w$]/.test(String.fromCharCode(key));
		if(!okChar)
			this.customTypeIdInfo(e.target);
		return okChar;
	},
	_customTypeIdFilter: function(node) {
		var val = node.value;
		var re = /[^\w$]/g;
		if(re.test(val)) {
			var editor = node.inputField
				.QueryInterface(Components.interfaces.nsIDOMNSEditableElement)
				.editor
				.QueryInterface(Components.interfaces.nsIPlaintextEditor);
			editor.undo(1);
			val = node.value;

			if(re.test(val)) // Ensure cleaned
				val = node.value = val.replace(re, "");

			this.customTypeIdInfo(node);
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
	customTypeIdInfo: function(anchor) {
		var msg = this.getLocalized("allowedChars")
			.replace("%s", "a-z, A-Z, 0-9, $, _");
		this.su.showInfoTooltip(anchor, msg);
	},
	appendTypesList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		var tList = this.$("hc-editor-customTypePopup");
		this.delCustomTypes();
		var cTypes = this.ps.types;
		var hideSep = true;
		var _labels = { __proto__: null };
		var sortedTypes = [];
		for(var cType in cTypes) if(cTypes.hasOwnProperty(cType)) {
			if(!this.ps.isCustomType(cType)) {
				this.ut._warn('Invalid custom type id: "' + cType + '"');
				continue;
			}
			var typeObj = cTypes[cType];
			if(!this.ju.isObject(typeObj)) {
				this.ut._warn('Invalid custom type: "' + cType + '" (' + typeObj + ")");
				continue;
			}
			var label = typeObj.label || cType;
			if(label in _labels)
				label += " (" + ++_labels[label] + ")";
			else
				_labels[label] = 1;
			var dis = typeof typeObj.enabled == "boolean" ? !typeObj.enabled : true;
			var notUsed = !this.typeUsed(cType);
			var tip = notUsed
				? this.getLocalized("customTypeNotUsed") + " \n" + cType
				: cType;
			sortedTypes.push({
				label: label,
				hc_localizedLabel: this.ps.localize(label),
				value: cType,
				tooltiptext: tip,
				hc_notUsed: notUsed,
				hc_disabled: dis
			});
		}
		var dfTarget = document.createDocumentFragment();
		var dfEdit = document.createDocumentFragment();
		sortedTypes.sort(function(a, b) {
			return a.label > b.label;
		}).forEach(function(attrs) {
			var mi = this.ut.createElement("menuitem", attrs);
			var _mi = mi.cloneNode(true);
			mi.setAttribute("disabled", attrs.hc_disabled);
			mi.setAttribute("label", attrs.hc_localizedLabel);
			dfTarget.appendChild(mi);
			dfEdit.appendChild(_mi);
			hideSep = false;
		}, this);
		parent.insertBefore(dfTarget, sep);
		tList.appendChild(dfEdit);
		sep.hidden = hideSep;
		parent.parentNode.value = this.type || ""; // <menulist>
		this.highlightUsedTypes();
	},
	showLocalizedLabels: function(mp) {
		var mi = mp.getElementsByAttribute("value", this.currentCustomType)[0] || null;
		mi && mi.setAttribute("label", mp.parentNode.label); // Set new label for auto-selection
		Array.prototype.forEach.call(
			mp.getElementsByTagName("menuitem"),
			function(mi) {
				// Trick: localize real <label> and leave raw value in label attribute
				var lb = document.getAnonymousElementByAttribute(mi, "class", "menu-iconic-text");
				lb.setAttribute("value", mi.getAttribute("hc_localizedLabel"));
			}
		);
	},
	typeUsed: function(type, prefs) {
		prefs = prefs || this.ps.prefs;
		for(var sh in prefs)
			if(this.ju.getOwnProperty(prefs, sh, type))
				return true;
		return false;
	},
	delCustomTypes: function() {
		["hc-editor-itemTypes", "hc-editor-customTypePopup"].forEach(
			function(pId) {
				var mis = this.$(pId).getElementsByTagName("menuitem"), mi;
				for(var i = mis.length - 1; i >= 0; --i) {
					mi = mis[i];
					if(this.ps.isCustomType(mi.getAttribute("value")))
						mi.parentNode.removeChild(mi);
				}
			},
			this
		);
	},
	highlightUsedTypes: function() {
		var so = this.ju.getOwnProperty(this.ps.prefs, this.currentShortcut);
		var ml = this.$("hc-editor-itemTypes");
		Array.prototype.forEach.call(
			ml.getElementsByTagName("menuitem"),
			function(mi) {
				var to = this.ju.getOwnProperty(so, mi.value);
				var val = this.ps.isOkFuncObj(to)
					? this.ju.getOwnProperty(to, "enabled")
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
	highlightEmpty: function _he(tb) {
		var empty = !tb.textLength;
		if(tb.hasOwnProperty("__highlightedEmpty") && tb.__highlightedEmpty == empty)
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
			!noWarnings && this.ut._warn("getTabForNode: <tabpanel> or <tabbox> not found!");
			return null;
		}
		var tabPanels = tabBox.tabpanels || tabBox.getElementsByTagNameNS(this.ut.XULNS, "tabpanels")[0];
		var tabs = tabBox.tabs || tabBox.getElementsByTagNameNS(this.ut.XULNS, "tabs")[0];
		if(!tabPanels || !tabs) {
			!noWarnings && this.ut._warn("getTabForNode: <tabpanels> or <tabs> not found!");
			return null;
		}
		var tabPanelIndx = Array.prototype.indexOf.call(tabPanels.childNodes, tabPanel);
		if(tabPanelIndx == -1) {
			!noWarnings && this.ut._warn("getTabForNode: index of <tabpanel> not found!");
			return null;
		}
		return tabs.childNodes[tabPanelIndx];
	},
	initFuncsList: function(setsObj, delayed) {
		delayed = delayed || "";
		var action = this.ju.getOwnProperty(setsObj, "action") || null;
		var fList = this.$("hc-editor-func" + delayed);
		fList.value = this.ju.getOwnProperty(setsObj, "custom") // <menulist>
			? "$custom"
			: delayed && !action
				? "$auto"
				: action;
		if(!fList.value) {
			fList.selectedIndex = -1; // Fix for Firefox 2.0
			fList.setAttribute("label", " "); // Fix height
		}
		const type = this.type;
		var hideSep = true;
		Array.prototype.forEach.call(
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
			|| app && !this.appSupported(app.split(/,\s*/))
			|| req && !this.extEnabled(req);
	},
	get versComparator() {
		delete this.versComparator;
		return this.versComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
			.getService(Components.interfaces.nsIVersionComparator);
	},
	appSupported: function(apps) {
		return apps.some(function(app) {
			// App Name [MinVersion[ - MaxVersion]]
			if(!/^(.*?)(?:\s+(\d\S*)(?:\s+-\s+(\d\S*))?)?$/.test(app))
				return false;
			var appName    = RegExp.$1;
			var appMinVers = RegExp.$2;
			var appMaxVers = RegExp.$3;
			var info = this.appInfo;
			if(appName != info.name)
				return false;
			if(appMinVers && this.versComparator.compare(appMinVers, info.version) > 0)
				return false;
			if(appMaxVers && this.versComparator.compare(appMaxVers, info.version) < 0)
				return false;
			return true;
		}, this);
	},
	extPackages: {
		FlashGot: "flashgot",
		"Multiple Tab Handler": "multipletab",
		SplitBrowser: "splitbrowser",
		__proto__: null
	},
	extEnabled: function(eName) {
		return this.ut.packageAvailable(this.extPackages[eName]);
	},

	itemTypeChanged: function(type) {
		if(this.ps.isCustomType(type))
			this.initCustomTypesEditor(type);
	},
	initAdditionalOptions: function(iType, setsObj) {
		iType = iType || this.currentType;
		var showImg = iType == "img";
		var showTab = iType == "tab" || iType == "ext_mulipletabs";
		this.$("hc-editor-funcOpts-img").hidden = !showImg;
		this.$("hc-editor-funcOpts-tab").hidden = !showTab;
		if(!showImg && !showTab)
			return;
		setsObj = setsObj || this.ju.getOwnProperty(this.ps.prefs, this.shortcut, iType);
		if(showImg) {
			var ignoreLinks = this.ju.getOwnProperty(setsObj, "ignoreLinks") || false;
			this.$("hc-editor-imgIgnoreLinks").checked = ignoreLinks;
			var ignoreSingle = this.ju.getOwnProperty(setsObj, "ignoreSingle") || false;
			this.$("hc-editor-imgIgnoreSingle").checked = ignoreSingle;
		}
		else if(showTab) {
			var excludeBtn = this.ju.getOwnProperty(setsObj, "excludeCloseButton");
			this.$("hc-editor-tabExcludeCloseButton").checked = excludeBtn === undefined ? true : excludeBtn;
		}
	},
	addFuncArgs: function(delayed, setsObj) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgs" + delayed).textContent = "";
		var funcsList = this.$("hc-editor-func" + delayed);
		var cFunc = funcsList.value || null;
		var isCustom = cFunc == "$custom";
		this.selectCustomFunc(isCustom, delayed);
		var argBox = this.$("hc-editor-funcArgsBox" + delayed);
		argBox.hidden = true;
		if(isCustom)
			return;
		var cMi = funcsList.selectedItem;
		if(!cMi)
			return;
		var cArgs = cMi.getAttribute("hc_args");
		if(!cArgs)
			return;
		argBox.hidden = false;
		cArgs.split(/,\s*/).forEach(function(argName) {
			this.addArgControls(argName, delayed, setsObj);
		}, this);
	},
	addArgControls: function(argName, delayed, so) {
		var setsObj = so || this.ju.getOwnProperty(this.ps.prefs, this.shortcut, this.type) || {};
		if(delayed) //~ todo: test part with "so"
			setsObj = so || this.ju.getOwnProperty(setsObj, "delayedAction") || {};
		var argVal = this.ju.getOwnProperty(setsObj, "arguments", argName);
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
		this.ut._err("Can't get type of \"" + argName + '"');
		return null;
	},
	addControl: function(argName, argType, argVal, delayed) {
		var argContainer = this.ut.createElement("hbox", {
			class: "hc-editor-argsContainer",
			align: "center"
		});
		var elt = this.ut.createElement(argType, {
			hc_argName: argName,
			onclick: "handyClicksEditor.clickHelper(event);"
		});

		var cfgTt = this.getLocalized("openAboutConfig");
		switch(argType) {
			case "checkbox":
				var label = this.getLocalized(argName);
				argVal && elt.setAttribute("checked", "true");
				elt.setAttribute("label", label);
				var cfg = this.getAboutConfigEntry(label);
				if(cfg) {
					elt.setAttribute("hc_aboutConfigEntry", cfg);
					elt.setAttribute("tooltiptext", cfgTt);
				}
			break;
			case "menulist":
				// Description:
				argContainer.appendChild(this.ut.createElement("label", {
					value: this.getLocalized(argName)
				}));
				// List of values:
				var mp = document.createElement("menupopup");
				this.types.menulists[argName].forEach(function(val, indx) {
					var label = this.getLocalized(argName + "[" + val + "]");
					var cfg = this.getAboutConfigEntry(label);
					var mi = this.ut.createElement("menuitem", {
						value: val,
						label: label
					});
					if(cfg) {
						mi.setAttribute("hc_aboutConfigEntry", cfg);
						mi.setAttribute("tooltiptext", cfgTt);
						if(!argVal && indx === 0 || val == argVal) { //~ todo: test!
							elt.setAttribute("hc_aboutConfigEntry", cfg);
							elt.setAttribute("tooltiptext", cfgTt);
							elt.setAttribute("oncommand", "handyClicksEditor.setAboutConfigTooltip(this);");
						}
					}
					mp.appendChild(mi);
				}, this);
				elt.setAttribute("value", "" + argVal);
				elt.appendChild(mp);
		}
		argContainer.appendChild(elt);
		this.$("hc-editor-funcArgs" + delayed).appendChild(argContainer);
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
			ml.setAttribute("tooltiptext", this.getLocalized("openAboutConfig"));
			return;
		}
		ml.removeAttribute("hc_aboutConfigEntry");
		ml.removeAttribute("tooltiptext");
	},

	get currentShortcut() {
		return ["button", "ctrl", "shift", "alt", "meta", "os"].map(
			function(key) {
				var elt = this.$("hc-editor-" + key);
				var val = elt.value || elt.checked;
				if(key == "os" && !val)
					return "";
				return key + "=" + val;
			},
			this
		).filter(function(data) {
			return data;
		}).join(",");
	},
	set currentShortcut(shortcut) {
		var butt = /(?:^|,)button=([0-2])(?:,|$)/.test(shortcut) ? RegExp.$1 : "0";
		this.$("hc-editor-button").value = butt;
		this.$("hc-editor-events-command").disabled = butt != "0";
		["ctrl", "shift", "alt", "meta", "os"].forEach(
			function(mdf) {
				var re = new RegExp("(?:^|,)" + mdf + "=true(?:,|$)");
				this.$("hc-editor-" + mdf).checked = re.test(shortcut);
			},
			this
		);
	},
	get currentType() {
		return this.$("hc-editor-itemTypes").value || undefined;
	},
	set currentType(type) {
		this.$("hc-editor-itemTypes").value = type;
	},
	get currentCustomType() {
		return this.ps.customPrefix + this.$("hc-editor-customTypeExtId").value;
	},
	set currentCustomType(customType) {
		this.$("hc-editor-customTypeExtId").value = this.ps.removeCustomPrefix(customType || "");
		var notUsed = !this.typeUsed(customType);
		var ml = this.$("hc-editor-customType");
		ml.setAttribute("hc_notUsed", notUsed);
		var inp = document.getAnonymousElementByAttribute(ml, "anonid", "input");
		var tt = notUsed ? this.getLocalized("customTypeNotUsed") + " \n" : "";
		inp.setAttribute("tooltiptext", tt + ml.getAttribute("hc_tooltiptext"));
	},

	loadFuncs: function() {
		if(this.root.getAttribute("hc_renameShortcut") == "true") {
			this.highlightUsedTypes();
			return;
		}
		var curShortcut = this.currentShortcut;
		var curType = this.currentType;
		if(curShortcut == this.shortcut && curType == this.type)
			return; // Not changed

		if(
			!this.funcOptsFixed // Nothing to lost with fixed options
			//~ todo: we can't use this.shortcutUnsaved because shortcut already changed!
			//~ compare manually? (like in initCustomTypesEditor())
			//&& this.shortcutUnsaved
			&& !this.applyButton.disabled
		) {
			var res = this.su.notifyUnsaved(
				this.getLocalized("editorUnsavedSwitchWarning")
					+ this.getLocalized("fixNote"),
				"editor.unsavedSwitchWarning"
			);
			if(res == this.su.PROMPT_CANCEL) {
				this.currentType = this.type;
				this.currentShortcut = this.shortcut;
				return;
			}
			if(res == this.su.PROMPT_SAVE) {
				this.currentType = this.type;
				this.currentShortcut = this.shortcut;
				if(!this.saveShortcut(false, false, true))
					return;
				this.currentShortcut = curShortcut;
				this.currentType = curType;
			}
		}

		this.shortcut = curShortcut;
		this.type = curType;
		if(this.funcOptsFixed) {
			this.initShortcutEditor(); //~ ugly, ugly, ugly...

			this.cantFixFuncOpts = !this.pasteShortcut(false, this._fixedFuncObj);
			this.pasteShortcut(true, this._fixedFuncObjDelayed);
		}
		else {
			this.initShortcutEditor();
		}
		this.highlightUsedTypes();
		this.disableUnsupported();
		this.setWinId();
		this.setWinTitle();
		this.delay(this.setDialogButtons, this);

		this.fireEditorChange(this.$("hc-editor-shortcutPanel"));
	},
	setClickOptions: function(e) {
		this.$("hc-editor-button").value = e.button;
		["ctrl", "shift", "alt", "meta"].forEach(
			function(mdf) {
				this.$("hc-editor-" + mdf).checked = e[mdf + "Key"];
			},
			this
		);
		this.$("hc-editor-os").checked = e.getModifierState && e.getModifierState("OS");
		this.loadFuncs();
	},
	loadSavedShortcuts: function(e) {
		var shortcuts = [];
		var curType = this.currentType;
		var curSh = this.currentShortcut;
		var prefs = this.ps.prefs;
		var canRename;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			var so = prefs[sh];
			if(this.ju.isObject(so) && so.hasOwnProperty(curType)) {
				var fo = so[curType];
				this.ju.isObject(fo) && shortcuts.push({
					hc_shortcut: sh,
					label: this.ps.getShortcutStr(sh, true),
					type: "radio",
					checked: sh == curSh && (canRename = true),
					acceltext: this.su.getActionLabel(fo),
					hc_sets: fo.enabled ? "" : "disabled"
				});
			}
		}

		var df = document.createDocumentFragment();
		shortcuts.sort(function(a, b) {
			return a.label > b.label
		}).forEach(function(attrs) {
			df.appendChild(this.ut.createElement("menuitem", attrs));
		}, this);

		var mp = e.target;
		if(!df.hasChildNodes()) {
			df.appendChild(this.ut.createElement("menuitem", {
				label: mp.getAttribute("hc_noData"),
				disabled: true
			}));
		}
		else {
			var isRenaming = this.root.getAttribute("hc_renameShortcut") == "true";
			var insPos = df.firstChild;
			df.insertBefore(this.ut.createElement("menuitem", {
				id: "hc-editor-renameShortcut",
				class: "menuitem-iconic hc-iconic",
				label: isRenaming
					? mp.getAttribute(canRename ? "hc_renameDoneDisabled" : "hc_renameDone")
						.replace("$s", this.ps.getShortcutStr(curSh, true))
					: mp.getAttribute("hc_renameStart"),
				accesskey: mp.getAttribute("hc_renameAccesskey"),
				hc_rename: isRenaming ? "done" : "start",
				oncommand: "event.stopPropagation(); handyClicksEditor.renameShortcut();",
				disabled: isRenaming ? canRename : !canRename
			}), insPos);
			if(isRenaming) df.insertBefore(this.ut.createElement("menuitem", {
				id: "hc-editor-renameShortcut-cancel",
				class: "menuitem-iconic hc-iconic",
				label: mp.getAttribute(
					canRename && curSh != this._shortcut
						? "hc_renameCancelUsed"
						: "hc_renameCancel"
				),
				accesskey: mp.getAttribute("hc_renameCancelAccesskey"),
				oncommand: "event.stopPropagation(); handyClicksEditor.renameShortcut(false, true);"
			}), insPos);
			df.insertBefore(document.createElement("menuseparator"), insPos);
		}
		mp.textContent = "";
		mp.appendChild(df);

		var box = mp.parentNode;
		mp.moveTo(e.screenX - 32, box.boxObject.screenY + box.boxObject.height);
	},
	renameShortcut: function(onlyRename, forceCancel) {
		var rename = this.root.getAttribute("hc_renameShortcut") != "true";
		this.mainTabbox.handleCtrlTab = this.mainTabbox.handleCtrlPageUpDown = !rename;
		if(rename) {
			var fe = document.commandDispatcher.focusedElement;
			if(!fe || fe.parentNode.id != "hc-editor-shortcutBox")
				this.$("hc-editor-button").focus();
			this.root.setAttribute("hc_renameShortcut", "true");
			this.$("hc-editor-renameShortcutOverlay").style
				.backgroundColor = getComputedStyle(this.root, null).backgroundColor;
			this.funcOptsFixed && this.fixFuncOpts((this.$("hc-editor-funcOptsFixed").checked = false));
			this._shortcut = this.currentShortcut;
			this._type = this.currentType;
			return;
		}
		this.root.removeAttribute("hc_renameShortcut");
		var sh = this._shortcut;
		var ct = this._type;
		var newSh = this.currentShortcut;
		this._shortcut = this._type = null;
		var p = this.ps.prefs;
		if(this.ju.getOwnProperty(p, newSh, ct) || forceCancel) {
			// Don't overwrite: cancel and restore initial shortcut
			this.currentShortcut = sh;
			return;
		}
		// Rename shortcut
		var so = this.ju.getOwnProperty(p, sh, ct);
		if(!so) {
			this.ut._err("Shortcut not found: " + sh + " -> " + ct);
			return;
		}
		this.ju.setOwnProperty(p, newSh, ct, so);
		delete p[sh][ct];
		if(this.ju.isEmptyObj(p[sh]))
			delete p[sh];

		this.wu.shortcutRenamed(sh + "-" + ct, newSh + "-" + ct);
		if(onlyRename) // ondialogcancel -> checkSaved()
			return;

		// Like loadFuncs(), but preserve unsaved data
		this.shortcut = newSh;
		this.setWinId();
		this.setWinTitle();

		if(this.ps.otherSrc)
			this.pe.reloadSettings();
		else
			this.pe.saveSettingsObjectsAsync();
		this.highlightUsedTypes();
		this.shortcutSaved();
		this.setDialogButtons();
	},
	loadSavedShortcut: function(e) {
		var mi = e.target;
		var sh = mi.getAttribute("hc_shortcut");
		this.currentShortcut = sh;
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

	editCode: function() {
		this.doEditorCommand("hc-editor-cmd-editCode", "openExternalEditor");
	},
	codeToFile: function() {
		this.doEditorCommand("hc-editor-cmd-codeToFile", "codeToFile");
	},
	openScriptsDir: function() {
		var tabbox = this.selectedTabbox;
		if(tabbox.collapsed)
			return;

		var btn = this.getFloatButton("hc-editor-cmd-openScriptsDir", tabbox);
		if(btn)
			btn.disabled = true;

		var editor = this.getEditorFromTabbox(tabbox);
		var path = this.ps.getSourcePath(editor.value);
		var file = path && this.ut.getLocalFile(path);
		if(!file || !file.exists())
			file = this.ps.scriptsDir;
		this.ut.reveal(file);

		if(btn) setTimeout(function() {
			btn.disabled = false;
		}, 300);
	},
	openCode: function() {
		this.doEditorCommand("hc-editor-cmd-openCode", "loadFromFile", true);
		this.checkForCrashBackups(100, true);
	},
	initEditCodeContext: function() {
		var path = this.getFileDataPath();
		if(path == undefined)
			return false;
		this.$("hc-editor-renameFileData").setAttribute("disabled", !path);
		this.$("hc-editor-deleteFileData").setAttribute("disabled", !path);
		return true;
	},
	getFileDataPath: function() {
		if(!this.ps.otherSrc)
			return undefined;
		var tabbox = this.selectedTabbox;
		if(tabbox.collapsed)
			return undefined;
		var editor = this.getEditorFromTabbox(tabbox);
		var path = this.ps.getSourcePath(editor.value);
		if(!path)
			return undefined;
		if(!(path in this.ps.files))
			return "";
		var fd = new String(path);
		fd.editor = editor;
		return fd;
	},
	deleteFileData: function() {
		var path = this.getFileDataPath();
		if(!path)
			return;
		delete this.ps.files[path];
		this.pe.reloadSettings(true);
	},
	renameFileData: function() {
		var path = this.getFileDataPath();
		if(!path)
			return;
		var files = this.ps.files;
		var newFileName = this.getLocalized("newFileName");
		var exists = "";
		for(;;) {
			var newPath = this.ut.prompt(this.getLocalized("rename"), exists + newFileName, path);
			if(!newPath || newPath == path)
				return;
			if(!(newPath in files))
				break;
			exists = this.getLocalized("renameAlreadyExists").replace("%f", newPath) + "\n";
		}

		var fd = files[path];
		delete files[path];
		files[newPath] = fd;

		var newCode = "//> " + newPath;
		var oldCode = path.editor.value;
		path.editor.value = newCode;
		this.pe.forEachCode(this.ps, function(code, o, key) {
			if(code == oldCode)
				o[key] = newCode;
		}, this);
		this.pe.reloadSettings(true);
	},
	doEditorCommand: function(btnCmd, cmd/*, arg1, ...*/) {
		var tabbox = this.selectedTabbox;
		if(tabbox.collapsed)
			return;

		var btn = btnCmd && this.getFloatButton(btnCmd, tabbox);
		if(btn)
			btn.disabled = true;

		var editor = this.getEditorFromTabbox(tabbox);
		editor.focus();
		var args = Array.prototype.slice.call(arguments, 2);
		editor[cmd].apply(editor, args);

		if(btn && btn.getAttribute("command") != "hc-editor-cmd-codeToFile") setTimeout(function() {
			btn.disabled = false;
		}, 300);
	},
	setEditorButtons: function(editor) {
		editor = editor || this.getEditorFromTabbox(this.selectedTabbox);
		var dis = editor.textLength <= 1000 // Too long for path?
			&& !!this.ps.getSourcePath(editor.value);
		var codeToFileBtn = editor.__codeToFileBtn || (
			editor.__codeToFileBtn = this.getFloatButton("hc-editor-cmd-codeToFile", editor)
		);
		if(codeToFileBtn.disabled != dis)
			codeToFileBtn.disabled = dis;
	},

	hasCrashBackup: false,
	checkForCrashBackups: function(delay, silent) {
		setTimeout(function(_this) {
			_this._checkForCrashBackups(silent);
		}, delay || 500, this);
	},
	_checkForCrashBackups: function(silent) {
		var bakPath = this._hasCrashBackup();
		this.attribute(this.root, "hc_hasCrashBackup", bakPath);
		this.hasCrashBackup = !!bakPath;
		if(bakPath && !silent)
			this.ut.notifyWarning(this.getLocalized("hasCrashBackup").replace("%f", bakPath));
	},
	_hasCrashBackup: function() {
		var tempDir = this.ps._tempDir;
		if(!tempDir)
			return false;
		var activeFiles = this.storage.get("activeTempFiles") || { __proto__: null };
		var entries = tempDir.directoryEntries;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(fName.substr(0, 3) == "hc_" && !(entry.path in activeFiles))
				return entry.path;
		}
		return false;
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

	saveSettings: function(applyFlag) {
		if(!applyFlag) { // ondialogaccept
			var okSh = this.saveShortcut(applyFlag, false, false, true);
			var okType = this.saveCustomType(applyFlag, false, false, true);
			var ok = okSh && okType;
			this.applySettings(false, false, this.ut.bind(function() {
				if(ok)
					return;
				if(typeof okSh == "function")
					okSh();
				if(typeof okType == "function")
					okType();
				this.dataSaved();
				this.setDialogButtons();
			}, this));
			return ok;
		}
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: return this.saveShortcut(applyFlag);
			case this.INDEX_TYPE:     return this.saveCustomType(applyFlag);
			default:                  return false;
		}
	},
	testSettings: function(e) {
		var invertFocusPref = e && (e.button == 1 || e.button == 0 && this.hasModifier(e));
		if(e && !invertFocusPref)
			return;

		this.$("hc-editor-cmd-test").setAttribute("disabled", "true");
		var ok = false;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: ok = this.testShortcut();   break;
			case this.INDEX_TYPE:     ok = this.testCustomType(); break;
			default:                  return;
		}
		if(!(ok && this.testMode))
			return;
		this.$("hc-editor-cmd-undo").setAttribute("disabled", "false");
		var focus = this.pu.get("editor.testFocusMainWindow");
		if(invertFocusPref ? !focus : focus) {
			var w = this.wu.browserWindow;
			w && w.focus();
		}
	},
	undoTestSettings: function(reloadAll) {
		this.testMode = false;
		this.pe.testSettings(false);
		if(reloadAll) {
			this.ps.loadSettings();
			this.initUI(true);
			this.$("hc-editor-cmd-undo").setAttribute("disabled", "true");
		}
	},
	deleteSettings: function() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: return this.deleteShortcut();
			case this.INDEX_TYPE:     return this.deleteCustomType();
			default:                  return false;
		}
	},
	copySettings: function() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: return this.copyShortcut();
			case this.INDEX_TYPE:     return this.copyCustomType();
			default:                  return false;
		}
	},
	pasteSettings: function() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: return this.pasteShortcut();
			case this.INDEX_TYPE:     return this.pasteCustomType();
			default:                  return false;
		}
	},
	markAs: function(node, attr, val) {
		if(node.hasAttribute(attr) && node.getAttribute(attr) != "true")
			return; // Leave error indication
		node.setAttribute(attr, val || "true");
		setTimeout(function() {
			node.removeAttribute(attr);
		}, 200);
	},
	checkSaved: function() {
		if(!this.hasUnsaved)
			return true;
		var res = this.su.notifyUnsaved();
		if(res == this.su.PROMPT_CANCEL)
			return false;
		if(res == this.su.PROMPT_SAVE) {
			if(this.root.getAttribute("hc_renameShortcut") == "true")
				this.renameShortcut(true);
			this.saveSettings();
		}
		return true;
	},

	saveShortcut: function(applyFlag, testFlag, dontUpdate, saveAll) {
		var sh = this.currentShortcut;
		var type = this.currentType;
		var so = this.currentShortcutObj;

		var typesList = this.$("hc-editor-itemTypes");
		var eventsList = this.$("hc-editor-events");
		var funcList = this.$("hc-editor-func");
		if(
			!this.ps.isOkShortcut(sh) // Not needed?
			|| !type || !so
			|| !this.checkMenulist(typesList)
			|| !this.checkMenulist(eventsList)
			|| !this.checkMenulist(funcList)
		) {
			if(saveAll && this.editorTabIndex != this.INDEX_SHORTCUT)
				return true;
			var req = [typesList, eventsList, funcList];
			if(this.$("hc-editor-func").value == "$custom")
				req.push(this.$("hc-editor-funcField"));
			if(this.$("hc-editor-func" + this.delayId).value == "$custom")
				req.push(this.$("hc-editor-funcField" + this.delayId));
			this.highlightRequiredFields(req, true);
			this.ut.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("editorIncomplete")
			);
			this.highlightRequiredFields(req, false);
			return false;
		}

		this.ju.setOwnProperty(this.ps.prefs, sh, type, so);

		var loadCorrectedSettings = !dontUpdate  && this.ut.bind(function(status) {
			if(status !== undefined && !Components.isSuccessCode(status))
				return;
			var prefs = this.ps.prefs;
			var to = this.ju.getOwnProperty(prefs, sh, type);
			var enabled = this.ju.getOwnProperty(to, "enabled");
			var daEnabled = this.ju.getOwnProperty(to, "delayedAction", "enabled");
			if(typeof daEnabled != "boolean")
				daEnabled = true;
			var enabledItem = this.$("hc-editor-enabled");
			var daEnabledItem = this.$("hc-editor-enabled" + this.delayId);
			if(enabledItem.checked == enabled && daEnabledItem.checked == daEnabled)
				return;
			//~ todo: notify ?
			enabledItem.checked = enabled;
			daEnabledItem.checked = daEnabled;
			this.setDialogButtons();
		}, this);
		if(saveAll)
			return loadCorrectedSettings;
		this.applySettings(testFlag, applyFlag, loadCorrectedSettings);
		return true;
	},
	applySettings: function(testFlag, applyFlag, callback) {
		this.testMode = testFlag; //~ todo: test!
		if(testFlag)
			this.pe.testSettings(true);
		else {
			if(this.ps.otherSrc)
				this.pe.reloadSettings(applyFlag);
			else {
				if(!applyFlag) // ondialogaccept
					this.pe.saveSettingsObjects(applyFlag);
				else {
					this.applyDisabled = true; // Don't wait for callback
					this.pe.saveSettingsObjectsAsync(applyFlag, callback);
					return;
				}
			}
		}
		callback && callback();
	},
	testShortcut: function() {
		return this.saveShortcut(true, true);
	},
	get currentShortcutObj() {
		var so = this.getFuncObj();
		if(!so)
			return null;
		var dso = this.getFuncObj(this.delayId);
		if(dso)
			so.delayedAction = dso;
		else if(dso === null) // Invalid
			return null;
		return so;
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
			so.label = this.$("hc-editor-funcLabel" + delayed).value;
			var action = this.$("hc-editor-funcField" + delayed).value;
			if(!action)
				return null;
			so.action = action;
			var init = this.$("hc-editor-funcInitField" + delayed).value;
			if(init)
				so.init = init;
		}
		else {
			so.action = fnc;
			var args = so.arguments = {};
			Array.prototype.forEach.call(
				this.$("hc-editor-funcArgs" + delayed).getElementsByAttribute("hc_argName", "*"),
				function(argElt) {
					// Note: we can't use argElt.checked here, this doesn't work for just added
					// checkboxes, looks like corresponding binding isn't loaded yet.
					var argVal = argElt.getAttribute("value")
						|| argElt.getAttribute("checked") == "true";
					if(typeof argVal == "string") {
						if(argVal == "null")
							argVal = null;
						else if(/^-?\d+$/.test(argVal))
							argVal = +argVal;
					}
					args[argElt.getAttribute("hc_argName")] = argVal;
				},
				this
			);
		}
		so.eventType = isDelayed
			? "__delayed__" // Required for handyClicksPrefSvc.isOkFuncObj()
			: evt;
		if(!isDelayed) {
			var type = this.currentType;
			if(type == "img") { //~ todo: don't save false values?
				so.ignoreLinks  = this.$("hc-editor-imgIgnoreLinks") .checked;
				so.ignoreSingle = this.$("hc-editor-imgIgnoreSingle").checked;
			}
			else if(type == "tab" || type == "ext_mulipletabs") {
				so.excludeCloseButton = this.$("hc-editor-tabExcludeCloseButton").checked;
			}
		}
		return so;
	},
	deleteShortcut: function() {
		var p = this.ps.prefs;
		var sh = this.currentShortcut;
		var ct = this.currentType;
		if(this.ju.getOwnProperty(p, sh, ct)) {
			delete p[sh][ct];
			if(this.ju.isEmptyObj(p[sh]))
				delete p[sh];
		}
		else { // Nothing to delete
			return;
		}
		if(this.ps.otherSrc)
			this.pe.reloadSettings();
		else
			this.pe.saveSettingsObjects();
		this.highlightUsedTypes();

		this.shortcutSaved();
		this.setDialogButtons();
	},
	copyShortcut: function(isDelayed, dontCopy) {
		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == this.INDEX_SHORTCUT_DELAYED;
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
		this.markAs(this.$("hc-editor-funcTabbox"), "hc_copied");
		return this.storage.set("shortcut", o);
	},
	pasteShortcut: function(isDelayed, stored) {
		stored = stored || this.storage.get("shortcut");
		if(!stored)
			return false;
		var type = this.currentType;
		if(!type || this.notSupported(type, null, stored.supports, stored.app, stored.required)) {
			this.markAs(this.$("hc-editor-funcTabbox"), "hc_pasted", "false");
			return false;
		}

		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == this.INDEX_SHORTCUT_DELAYED;
		var delayed = isDelayed ? this.delayId : "";
		var so = stored.so;

		this.initFuncEditor(so, delayed, true);
		if(!isDelayed) {
			this.$("hc-editor-events").value = so.eventType || "click";
			//this.initAdditionalOptions(type, so);
		}

		this.disableUnsupported();
		this.setDialogButtons();
		this.markAs(this.$("hc-editor-funcTabbox"), "hc_pasted");
		return true;
	},
	saveCustomType: function(applyFlag, testFlag, dontUpdate, saveAll) {
		var label = this.$("hc-editor-customType").value;
		var cType = this.$("hc-editor-customTypeExtId").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!label || !cType || !def) {
			if(saveAll && this.editorTabIndex != this.INDEX_TYPE)
				return true;
			var req = [
				this.$("hc-editor-customType"),
				this.$("hc-editor-customTypeExtId"),
				this.$("hc-editor-customTypeDefine")
			];
			this.highlightRequiredFields(req, true);
			this.ut.alert(
				this.getLocalized("errorTitle"),
				this.getLocalized("editorIncomplete")
			);
			this.highlightRequiredFields(req, false);
			return false;
		}
		cType = this.ps.customPrefix + cType;

		var cts = this.ps.types;
		var ct = cts[cType] || {};
		var curEnabl = ct.enabled || false;
		var newEnabl = this.$("hc-editor-customTypeEnabled").checked;
		cts[cType] = this.getTypeObj(label, def, newEnabl);

		var loadCorrectedSettings = !dontUpdate && this.ut.bind(function(status) {
			if(status !== undefined && !Components.isSuccessCode(status))
				return;
			this.appendTypesList();
			this.setWinTitle(); // Label changed?
			this.setDialogButtons();
		}, this);
		if(saveAll)
			return loadCorrectedSettings;
		this.applySettings(testFlag, applyFlag, loadCorrectedSettings);
		return true;
	},
	onTypeEnabledChange: function(cb) {
		var type = this.currentCustomType;
		var to = this.ju.getOwnProperty(this.ps.types, type);
		if(
			to && to.enabled && !cb.checked
			&& !this.su.confirmTypeAction(type, "typeDisablingWarning")
		)
			cb.checked = true;
	},
	testCustomType: function() {
		return this.saveCustomType(true, true);
	},
	get currentTypeObj() {
		if(
			!this.$("hc-editor-customType").value
			|| !this.$("hc-editor-customTypeExtId").value
			|| !this.$("hc-editor-customTypeDefine").value
		)
			return null;
		return this.getTypeObj();
	},
	getTypeObj: function(label, def, enabled) {
		var ct = {
			enabled: enabled !== undefined ? enabled : this.$("hc-editor-customTypeEnabled").checked,
			label:  label !== undefined ? label : this.$("hc-editor-customType")      .value,
			define: def   !== undefined ? def   : this.$("hc-editor-customTypeDefine").value
		};
		var cMenu = this.$("hc-editor-customTypeContext").value;
		ct.contextMenu = cMenu || null;
		return ct;
	},
	deleteCustomType: function() {
		var cts = this.ps.types;
		var type = this.currentCustomType;
		if(!cts.hasOwnProperty(type)) // Nothing to delete
			return;
		if(!this.su.confirmTypeAction(type, "typeDeletingWarning"))
			return;
		delete cts[type];
		if(this.ps.otherSrc)
			this.pe.reloadSettings();
		else
			this.pe.saveSettingsObjects();
		this.appendTypesList();

		this.typeSaved();
		this.setDialogButtons();
	},
	copyCustomType: function() {
		this.storage.set("type", this.getTypeObj());
		this.markAs(this.$("hc-editor-customTypeTabbox"), "hc_copied");
	},
	pasteCustomType: function() {
		var stored = this.storage.get("type");
		if(!stored)
			return;
		this.initCustomTypesEditor(null, stored);
		this.setDialogButtons();
	},

	highlightRequiredFields: function _hl(fields, addFlag, noDelay) {
		if(!addFlag && !noDelay) {
			this.delay(_hl, this, 2500, [fields, false, true]);
			return;
		}
		fields.forEach(function(field) {
			if(
				addFlag && field.value
				&& (field.localName != "menulist" || this.checkMenulist(field))
			)
				return;
			this.attribute(field, "hc_requiredField", addFlag);
			for(var tab = this.getTabForNode(field); tab; tab = this.getTabForNode(tab, true))
				this.attribute(tab, "hc_requiredFieldParentTab", addFlag && tab.getAttribute("selected") != "true");
		}, this);
	},
	checkMenulist: function(ml) {
		//~ note: disabled state isn't checked
		if(ml.getAttribute("editable") == "true")
			return !!ml.value;
		return !!ml.selectedItem;
	}
};
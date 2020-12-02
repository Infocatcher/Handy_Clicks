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
			this.initExtTypes(type);
			this.loadLabels();
			this.createDelayedFuncTab();
			this.addTestButtons();
			this.delay(this.delayedInit, this, 20);

			var mouseEvt = typeof MouseEvent == "function" // Firefox 11+
				&& ("" + MouseEvent).charAt(0) != "[" // Trick for Firefox <= 2.0
				? new MouseEvent("click")
				: document.createEvent("MouseEvents");
			if(!("getModifierState" in mouseEvt)) { // Works only in Firefox 15+
				var os = this.$("hc-editor-os");
				os.setAttribute("hc_notSupported", "true");
				os.setAttribute("tooltiptext", os.getAttribute("hc_note"));
			}
			if(this.appInfo.OS != "Darwin") {
				var meta = this.$("hc-editor-meta");
				meta.setAttribute("hc_notSupported", "true");
				meta.setAttribute("tooltiptext", meta.getAttribute("hc_note"));
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
			this.typesList.setAttribute("label", " "); // Fix height

		this.ps.oSvc.addObserver(this.setsReloading, this);

		this.setFuncsNotes();
		this.setCompactUI();
		this.pu.oSvc.addObserver(this.prefChanged, this);
		this.checkForCrashBackups(700);
		document.addEventListener("keydown", this.tabLikeNavigation, true);
	},
	delayedInit: function() {
		this.setTooltip();

		// Fix Ctrl(+Shift)+Tab and Ctrl+PageUp/Ctrl+PageDown navigation in Firefox 52+
		var tabboxProto = this.mainTabbox.__proto__;
		tabboxProto._origHandleEvent = tabboxProto.handleEvent;
		tabboxProto.handleEvent = function(e) {
			if("defaultPrevented" in e && e.defaultPrevented)
				return undefined;
			return this._origHandleEvent.apply(this, arguments);
		};

		var ml = this.$("hc-editor-customType");
		var inp = document.getAnonymousElementByAttribute(ml, "anonid", "input");
		inp.setAttribute("spellcheck", "true");
		inp.setAttribute("tooltiptext", ml.getAttribute("hc_tooltiptext"));
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
		document.removeEventListener("keydown", this.tabLikeNavigation, true);
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
	get selectedEditor() {
		return this.getEditorFromTabbox(this.selectedTabbox);
	},
	insideSelectedPanel: function(node) {
		var tabpanel = this.getNodeFromChild("tabpanel", node);
		var tabpanels = tabpanel.parentNode;
		var selectedPanel = tabpanels.selectedPanel || tabpanels.getElementsByTagName("tabpanel")[0];
		return selectedPanel == tabpanel;
	},
	getSelectedPanel: function(tabbox) {
		return tabbox.selectedPanel
			|| tabbox.getElementsByTagName("tabpanels")[0]
				.getElementsByTagName("tabpanel")[tabbox.selectedIndex];
	},
	getEditorFromPanel: function (panel) {
		var tbs = panel.getElementsByTagName("textbox");
		for(var i = 0, l = tbs.length; i < l; ++i) {
			var tb = tbs[i];
			if(/(?:^|\s)hcEditor(?:\s|$)/.test(tb.className))
				return tb;
		}
		return null;
	},
	getEditorFromTabbox: function(tabbox) {
		return this.getEditorFromPanel(this.getSelectedPanel(tabbox));
	},
	getNodeFromChild: function(name, node) {
		for(; node; node = node.parentNode)
			if(node.localName == name)
				return node;
		return null;
	},
	getFloatButton: function(cmd, sourceNode) {
		var tabbox = sourceNode
			? this.getNodeFromChild("tabbox", sourceNode)
			: this.selectedTabbox;
		var toolbar = tabbox.firstChild;
		return toolbar.getElementsByAttribute("command", cmd)[0];
	},
	loadLabels: function() {
		["hc-editor-button", "hc-editor-itemTypes", "hc-editor-func"].forEach(
			this.localizeLabels,
			this
		);
		["ctrl", "shift", "alt", "meta", "os"].forEach(function(mdf) {
			this.$("hc-editor-" + mdf).setAttribute("label", this.ps.keys[mdf]);
		}, this);
		if(this.pu.get("editor.ui.sortInternalTypes"))
			this.sortInternalTypes(true);
	},
	sortInternalTypes: function(sort) {
		var sep = this.$("hc-editor-customTypesSep");
		var mis = [];
		for(var mi = sep, i = -1; (mi = mi.nextSibling) && mi.localName != "menuseparator"; ) {
			mis.push(mi);
			if(sort && !("__pos" in mi))
				mi.__pos = ++i;
		}
		var insPos = mi;
		var mp = mi.parentNode;
		mis.sort(function(a, b) {
			return sort
				? a.getAttribute("label").localeCompare(b.getAttribute("label"))
				: a.__pos - b.__pos;
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
			this.sortInternalTypes(pVal);
		else if(pName == "editor.ui.showCustomFuncsNotes")
			this.setFuncsNotes(pVal);
		else if(pName == "editor.ui.compact")
			this.setCompactUI(pVal);
		else if(pName == "editor.ui.invertWindowTitle") {
			this.setWinTitle();
			this.setDialogButtons();
		}
	},
	initExtTypes: function(curType) {
		var typesList = this.typesList;
		Array.prototype.forEach.call(
			typesList.getElementsByAttribute("hc_required", "*"),
			function(mi) {
				var ext = mi.getAttribute("hc_required");
				if(!this.extEnabled(ext)) {
					mi.hidden = true;
					if(curType && mi.getAttribute("value") == curType) {
						typesList.setAttribute("hc_extNotAvailable", "true");
						this.su.checkDarkFont(typesList);
					}
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
	reloadSettings: function() {
		if(!this.hasUnsaved || this.su.confirmReload())
			this.initUI(true);
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
		if(this.isPopupOpened(this.$("hc-editor-sets-popup")))
			this.initSettingsMenu(); // Changed using mouse scroll
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
		var title = document.title;
		var newTitle = this.su.createTitle(title, shModified || typeModified, this.ps.otherSrc);
		if(newTitle != title)
			document.title = newTitle;
		this.setModifiedTab(this.$("hc-editor-shortcutTab"), shModified);
		this.setModifiedTab(this.$("hc-editor-itemTypeTab"), typeModified);
	},
	setModifiedTab: function(tab, isModified) {
		var label = tab.getAttribute("label");
		var newLabel = this.su.createTitle(label, isModified);
		if(newLabel != label)
			tab.setAttribute("label", newLabel);
	},
	get canDelete() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT:
				return !!this.ju.getOwnProperty(this.ps.prefs, this.currentShortcut, this.currentType);
			case this.INDEX_TYPE:
				return this.ps.types.hasOwnProperty(this.currentCustomType);
		}
		return false;
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
		return curr && !this.ps.settingsEquals(this.ps.sortSettings(curr), this._savedShortcutObj);
	},
	get typeUnsaved() {
		var curr = this.currentTypeObj;
		return curr && !this.ps.settingsEquals(this.ps.sortSettings(curr), this._savedTypeObj);
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
	_editorLastUpdate: 0,
	editorChanged: function(editor) {
		if(this._editorTimer)
			return;
		this._editorTimer = this.delay(function() {
			this._editorTimer = 0;
			this._editorLastUpdate = Date.now();
			if(this.insideSelectedPanel(editor))
				this.setEditorButtons(editor);
			if(editor.getAttribute("hc_highlightEmpty") == "true")
				this.highlightEmpty(editor);
		}, this, Date.now() - this._editorLastUpdate > 1000 ? 10 : 100);
	},
	setWinId: function() {
		var winId;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT:
				winId = this.currentShortcut + "-" + (this.currentType || this.ct.EDITOR_NO_TYPE);
			break;
			case this.INDEX_TYPE:
				var type = this.currentCustomType;
				if(type == this.ps.customPrefix) {
					type = this.ps.isCustomType(this.type)
						? this.type
						: this.ct.EDITOR_NO_TYPE;
				}
				winId = "#custom_types-" + type;
		}
		winId += this.ps.otherSrc ? this.ct.OTHER_SRC_POSTFIX : "";
		var winIdProp = this.wu.winIdProp;
		if((window[winIdProp] || null) == winId)
			return;
		window[winIdProp] = winId;
		this.wu.markOpenedEditors();
	},
	switchToSettings: function() {
		var winId = window[this.wu.winIdProp];
		var w = this.wu.openSettings(false, [{ winId: winId }]);
		this.wu.openWindowByType.alreadyOpened && (function wait() {
			if("_handyClicksInitialized" in w)
				w.handyClicksSets.scrollToOpened(winId);
			else
				setTimeout(wait, 5);
		})();
	},
	setWinTitle: function() {
		var shStr = this.ps.getShortcutStr(this.currentShortcut, true);
		var typeItem = this.typesList.selectedItem; // menulist.label may be wrong on startup!
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
	initSettingsMenu: function() {
		var sm = this.$("hc-editor-sets-shortcutsMenu");
		sm.setAttribute("hidden", this.editorTabIndex != this.INDEX_SHORTCUT);
		sm.setAttribute("default", this.renameShortcutMode);
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
			this.$("hc-editor-funcField" + delayed)[val]  = this.ju.getOwnProperty(setsObj, "action") || " "; // Fix height
			this.$("hc-editor-funcLabel" + delayed).value = this.ju.getOwnProperty(setsObj, "label") || "";

			var initField = this.$("hc-editor-funcInitField" + delayed);
			initField[val] = this.ju.getOwnProperty(setsObj, "init") || "";
			this.highlightEmpty(initField);
		}
		this.initFuncsList(setsObj, delayed);
		var enabled = this.ju.getOwnProperty(setsObj, "enabled");
		this.$("hc-editor-enabled" + delayed).checked = typeof enabled != "boolean" || enabled;
		if(!delayed) {
			this.$("hc-editor-allowMousedown").value = "" + this.ju.getOwnProperty(setsObj, "allowMousedownEvent");
			this.initAdditionalOptions(null, setsObj);
		}
	},
	selectCustomFunc: function(isCustom, delayed) {
		delayed = delayed || "";
		this.$("hc-editor-funcArgsBox"      + delayed).collapsed =  isCustom;
		this.$("hc-editor-funcLabelBox"     + delayed).style.visibility = isCustom ? "" : "hidden";
		this.$("hc-editor-funcCustomTabbox" + delayed).collapsed = !isCustom;
	},
	editCustomType: function(e) {
		if(e.button != 2)
			return;
		var trg = e.target;
		var type = trg.value;
		if(!this.ps.isCustomType(type))
			return;

		var mp = trg.parentNode;
		if("hidePopup" in mp)
			mp.hidePopup();
		this.initCustomTypesEditor(type);
		this.delay(function() { // Trick to prevent context menu for items inside type tab
			this.editorTabIndex = this.INDEX_TYPE;
		}, this);
	},
	initCustomTypesEditor: function(type, to) {
		var cList = this.$("hc-editor-customType");
		var updateUI = this.editorTabIndex == this.INDEX_TYPE;
		var hasUnsaved = !this._allowUndo && (
			this.customType
				? !this.testMode && this._savedTypeObj && !this.ps.settingsEquals(
					this.ps.sortSettings(this.getTypeObj(this.customTypeLabel)),
					this._savedTypeObj
				)
				: this.getCurrentTypeObj(this.customTypeLabel) // Switch from typed unsaved data
		);
		if(hasUnsaved) {
			var customTypeLabel = cList.value;
			cList.value = this.customTypeLabel;
			var res = this.su.notifyUnsaved(
				this.getLocalized("editorUnsavedSwitchWarning"),
				"editor.unsavedSwitchWarning"
			);
			if(res == this.su.PROMPT_CANCEL)
				return;
			if(res == this.su.PROMPT_SAVE && !this.saveCustomType(true))
				return;
			cList.value = customTypeLabel;
			updateUI = true;
		}

		if(!to && !type) {
			var sItem = cList.selectedItem;
			type = sItem ? sItem.value : null;
		}
		var enabledElt = this.$("hc-editor-customTypeEnabled");
		var types = this.ps.types;
		var ct = to || types[type];
		if(!this.ju.isObject(ct))
			ct = {};
		enabledElt.checked = typeof ct.enabled == "boolean" ? ct.enabled : true;
		const val = to || this._allowUndo ? "value" : "newValue";
		this.$("hc-editor-customTypeDefine")[val] = ct.define || "";
		var contextField = this.$("hc-editor-customTypeContext");
		contextField[val] = ct.contextMenu || "";
		if(!to && (!type || !types.hasOwnProperty(type)))
			return;
		this.highlightEmpty(contextField);
		if(!to) {
			cList.value = this.customTypeLabel = ct.label || "";
			this.currentCustomType = type;
		}
		this.customType = type;
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
	typeFilterTimer: 0,
	customTypeIdFilter: function(e) {
		var trg = e.target;
		if(!this.typeFilterTimer) {
			this.typeFilterTimer = this.delay(function() {
				this.typeFilterTimer = 0;
				this._customTypeIdFilter(trg);
			}, this);
		}
		if(e.type != "keypress")
			return false;
		var key = e.charCode;
		var okChar = !key || key < 32 || e.ctrlKey || e.altKey || e.metaKey || !/[^\w$]/.test(String.fromCharCode(key));
		if(!okChar)
			this.customTypeIdInfo(trg);
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
			this.delay(this.setWinId, this);
		}
	},
	customTypeIdInfo: function(anchor) {
		var msg = this.getLocalized("allowedChars")
			.replace("%s", "a-z, A-Z, 0-9, $, _");
		this.su.showInfoTooltip(anchor, msg);
	},
	appendTypesList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var typesPopup = sep.parentNode;
		var customTypesPopup = this.$("hc-editor-customTypePopup");
		this.delCustomTypes(typesPopup);
		this.delCustomTypes(customTypesPopup);
		var types = this.ps.types;
		var hideSep = true;
		var _labels = { __proto__: null };
		var sortedTypes = [];
		for(var type in types) if(types.hasOwnProperty(type)) {
			if(!this.ps.isCustomType(type)) {
				this.ut._warn('Invalid custom type id: "' + type + '"');
				continue;
			}
			var to = types[type];
			if(!this.ju.isObject(to)) {
				this.ut._warn('Invalid custom type: "' + type + '" (' + to + ")");
				continue;
			}
			var label = to.label || type;
			var localizedLabel = this.ps.localize(label);
			if(localizedLabel in _labels)
				localizedLabel += " (" + ++_labels[localizedLabel] + ")";
			else
				_labels[localizedLabel] = 1;
			var dis = typeof to.enabled == "boolean" ? !to.enabled : true;
			var notUsed = !this.su.hasSettingsForType(type);
			sortedTypes.push({
				label: label,
				hc_localizedLabel: localizedLabel,
				value: type,
				tooltiptext: this.getTypeTip(type, notUsed),
				hc_notUsed: notUsed,
				hc_disabled: dis
			});
		}
		var dfTarget = document.createDocumentFragment();
		var dfEdit = document.createDocumentFragment();
		sortedTypes.sort(function(a, b) {
			return a.hc_localizedLabel.localeCompare(b.hc_localizedLabel);
		}).forEach(function(attrs) {
			var mi = this.ut.createElement("menuitem", attrs);
			var _mi = mi.cloneNode(true);
			mi.setAttribute("disabled", attrs.hc_disabled);
			mi.setAttribute("label", attrs.hc_localizedLabel);
			dfTarget.appendChild(mi);
			dfEdit.appendChild(_mi);
			hideSep = false;
		}, this);
		typesPopup.insertBefore(dfTarget, sep);
		customTypesPopup.appendChild(dfEdit);
		sep.hidden = hideSep;
		typesPopup.parentNode.value = this.type || ""; // <menulist>
		this.highlightUsedTypes();
	},
	getTypeTip: function(type, notUsed) {
		return this.getLocalized("internalId").replace("%id", type)
			+ (notUsed ? " \n" + this.getLocalized("customTypeNotUsed") : "");
	},
	showLocalizedLabels: function(mp) {
		var mi = mp.getElementsByAttribute("value", this.currentCustomType)[0] || null;
		if(mi) {
			var label = mp.parentNode.label;
			var mis = mp.getElementsByAttribute("label", label);
			for(var i = mis.length - 1; i >= 0; --i) {
				var mi2 = mis[i];
				if(mi2 != mi) // Trick to edit select items with equals labels
					mi2.setAttribute("label", label + " " + i + "#" + Date.now());
			}
			mi.setAttribute("label", label); // Set new label for auto-selection
		}
		Array.prototype.forEach.call(
			mp.getElementsByTagName("menuitem"),
			function(mi) {
				// Trick: localize real <label> and leave raw value in label attribute
				var lb = document.getAnonymousElementByAttribute(mi, "class", "menu-iconic-text");
				lb.setAttribute("value", mi.getAttribute("hc_localizedLabel"));
			}
		);
	},
	delCustomTypes: function(popup) {
		var mis = popup.getElementsByTagName("menuitem");
		for(var i = mis.length - 1; i >= 0; --i) {
			var mi = mis[i];
			if(this.ps.isCustomType(mi.getAttribute("value")))
				mi.parentNode.removeChild(mi);
		}
	},
	highlightUsedTypes: function() {
		var so = this.ju.getOwnProperty(this.ps.prefs, this.currentShortcut);
		var ml = this.typesList;
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
		var tabPanel, tabPanels, tabBox;
		for(; (node = node.parentNode); ) {
			var ln = node.localName;
			if(ln == "tabpanel")
				tabPanel = node;
			else if(tabPanel && ln == "tabpanels")
				tabPanels = node;
			else if(tabPanel && ln == "tabbox") {
				tabBox = node;
				break;
			}
		}
		if(!tabPanel || !tabBox) {
			!noWarnings && this.ut._warn("getTabForNode(): <tabpanel> or <tabbox> not found!");
			return null;
		}
		var tabs = tabBox.tabs || tabBox.getElementsByTagNameNS(this.XULNS, "tabs")[0];
		var tabPanelIndx = Array.prototype.indexOf.call(tabPanels.childNodes, tabPanel);
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
		this.updateShortcutContext();

		var ml = this.typesList;
		if(ml.hasAttribute("hc_extNotAvailable"))
			ml.removeAttribute("hc_extNotAvailable");
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
		if(!isCustom) {
			var cMi = funcsList.selectedItem;
			var cArgs = cMi && cMi.getAttribute("hc_args");
			cArgs && cArgs.split(/,\s*/).forEach(function(argName) {
				this.addArgControls(argName, delayed, setsObj);
			}, this);
		}
		this.$("hc-editor-funcArgsBox" + delayed).hidden = !cArgs;
	},
	addArgControls: function(argName, delayed, so) {
		var argVal = this.ju.getOwnProperty(so, "arguments", argName);
		var argType = this.getArgType(argName);
		argType && this.addControl(argName, argType, argVal, delayed);
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
			onclick: "handyClicksEditor.openAboutConfig(event);",
			onkeydown: "handyClicksEditor.openAboutConfig(event);"
		});

		var cfgTt = this.getLocalized("openAboutConfigRightClick");
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
				this.types.menulists[argName].forEach(function(val) {
					var label = this.getLocalized(argName + "[" + val + "]");
					var cfg = this.getAboutConfigEntry(label);
					var mi = this.ut.createElement("menuitem", {
						value: val,
						label: label
					});
					if(cfg) {
						mi.setAttribute("hc_aboutConfigEntry", cfg);
						mi.setAttribute("tooltiptext", cfgTt);
						if(!elt.hasAttribute("oncommand")) {
							elt.setAttribute("oncommand", "handyClicksEditor.setAboutConfigTooltip(this);");
							this.delay(this.setAboutConfigTooltip, this, 50, [elt]);
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
	openAboutConfig: function(e) {
		if(
			e.type == "click" && e.button != 2
			|| e.type == "keydown" && !(e.keyCode == e.DOM_VK_F2 && !this.hasModifier(e))
		)
			return;
		var trg = e.target;
		var pName = trg.getAttribute("hc_aboutConfigEntry");
		if(!pName)
			return;
		var mp = trg.parentNode;
		"hidePopup" in mp && mp.hidePopup();
		this.pu.openAboutConfig(pName);
	},
	setAboutConfigTooltip: function(ml) {
		var si = ml.selectedItem;
		if(si && si.hasAttribute("hc_aboutConfigEntry")) {
			ml.setAttribute("hc_aboutConfigEntry", si.getAttribute("hc_aboutConfigEntry"));
			ml.setAttribute("tooltiptext", this.getLocalized("openAboutConfigF2"));
			return;
		}
		ml.removeAttribute("hc_aboutConfigEntry");
		ml.removeAttribute("tooltiptext");
	},

	get currentShortcut() {
		var vals = [];
		["button", "ctrl", "shift", "alt", "meta", "os"].forEach(function(key) {
			var elt = this.$("hc-editor-" + key);
			var val = elt.value || elt.checked;
			if(val || key != "os")
				vals.push(key + "=" + val);
		}, this);
		return vals.join(",");
	},
	set currentShortcut(sh) {
		var btn = sh ? this.ps.getButton(sh) : "0";
		this.$("hc-editor-button").value = btn;
		this.$("hc-editor-events-command").disabled = btn != "0";
		["ctrl", "shift", "alt", "meta", "os"].forEach(function(mdf) {
			this.$("hc-editor-" + mdf).checked = sh && sh.indexOf(mdf + "=true") != -1;
		}, this);
	},
	get typesList() {
		delete this.typesList;
		return this.typesList = this.e("hc-editor-itemTypes");
	},
	get currentType() {
		return this.typesList.value || undefined;
	},
	set currentType(type) {
		this.typesList.value = type;
	},
	get currentCustomType() {
		return this.ps.customPrefix + this.$("hc-editor-customTypeExtId").value;
	},
	set currentCustomType(customType) {
		this.$("hc-editor-customTypeExtId").value = this.ps.removeCustomPrefix(customType || "");
		this.checkNotUsedType(customType);
	},
	checkNotUsedType: function(type, updateMenu) {
		var notUsed = !this.su.hasSettingsForType(type);
		var ml = this.$("hc-editor-customType");
		ml.setAttribute("hc_notUsed", notUsed);
		this.delay(function() { // Wait to correctly set tooltip on startup
			var inp = document.getAnonymousElementByAttribute(ml, "anonid", "input");
			var ttNotUsed = notUsed ? " \n" + this.getLocalized("customTypeNotUsed") : "";
			var tt = ml.getAttribute("hc_tooltiptext") + ttNotUsed;
			inp.setAttribute("tooltiptext", tt);
			if(inp.parentNode.classList && inp.parentNode.classList.contains("menulist-editable-box"))
				inp.parentNode.setAttribute("tooltiptext", tt); // For Firefox 60
			var mi = updateMenu && ml.getElementsByAttribute("value", type)[0] || null;
			if(mi) {
				mi.setAttribute("tooltiptext", this.getTypeTip(type, notUsed));
				mi.setAttribute("hc_notUsed", notUsed);
			}
		}, this, 50);
	},
	typeUsageChanged: function(type) {
		if(type == this.currentCustomType)
			this.checkNotUsedType(type, true);
	},
	get renameShortcutMode() {
		return this.root.getAttribute("hc_renameShortcut") == "true";
	},
	set renameShortcutMode(rename) {
		this.attribute(this.root, "hc_renameShortcut", !!rename);
	},

	loadFuncs: function() {
		if(this.renameShortcutMode) {
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
					+ this.getLocalized("fixNote")
					.replace("%b", this.$("hc-editor-funcOptsFixed").label),
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
		["ctrl", "shift", "alt", "meta"].forEach(function(mdf) {
			this.$("hc-editor-" + mdf).checked = e[mdf + "Key"];
		}, this);
		this.$("hc-editor-os").checked = e.getModifierState && e.getModifierState("OS");
		this.loadFuncs();
	},
	openShortcutsMenu: function() {
		if(this.editorTabIndex != this.INDEX_SHORTCUT)
			this.editorTabIndex = this.INDEX_SHORTCUT;
		var shBox = this.$("hc-editor-shortcutBox");
		var cm = this.$("hc-editor-shortcutContext");
		if("openPopup" in cm)
			cm.openPopup(shBox, "after_start", 0, 0);
		else
			cm.showPopup(shBox, -1, -1, "popup", "bottomleft", "topleft");
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
			return a.label.localeCompare(b.label);
		}).forEach(function(attrs) {
			df.appendChild(this.ut.createElement("menuitem", attrs));
		}, this);

		var mp = this.$("hc-editor-shortcutContext");
		if(!df.hasChildNodes()) {
			df.appendChild(this.ut.createElement("menuitem", {
				label: mp.getAttribute("hc_noData"),
				disabled: true
			}));
		}
		else {
			var isRenaming = this.renameShortcutMode;
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
				oncommand: "handyClicksEditor.renameShortcut();",
				disabled: isRenaming ? canRename : !canRename
			}), insPos);
			if(isRenaming) df.insertBefore(this.ut.createElement("menuitem", {
				id: "hc-editor-renameShortcut-cancel",
				class: "menuitem-iconic hc-iconic",
				label: mp.getAttribute("hc_renameCancel") + (
					canRename && curSh != this._shortcutBeforeRename
						? this.getLocalized("alreadyUsed")
						: ""
				),
				accesskey: mp.getAttribute("hc_renameCancelAccesskey"),
				oncommand: "handyClicksEditor.renameShortcut(false, true);"
			}), insPos);
			df.insertBefore(document.createElement("menuseparator"), insPos);
		}
		mp.textContent = "";
		mp.appendChild(df);

		var box = mp.parentNode;
		if(e && document.popupNode) // Ignore, if called from openShortcutsMenu()
			mp.moveTo(e.screenX - 32, box.boxObject.screenY + box.boxObject.height);
		if(!curType)
			this.typeRequired();
	},
	updateShortcutContext: function() {
		if(this.isPopupOpened(this.$("hc-editor-shortcutContext")))
			this.loadSavedShortcuts(); // Changed using mouse scroll
	},
	isPopupOpened: function(mp) {
		return "open" in mp.parentNode && mp.parentNode.open
			|| !("state" in mp) || mp.state == "open";
	},
	renameShortcut: function(onlyRename, forceCancel, syncSave) {
		var rename = !this.renameShortcutMode;
		this.renameShortcutMode = rename;
		this.mainTabbox.handleCtrlTab = this.mainTabbox.handleCtrlPageUpDown = !rename;
		var act = rename ? addEventListener : removeEventListener;
		act.call(window, "keydown", this.preventAccesskeys, true);
		act.call(window, "command", this.preventCommands, true);
		this.disableTextboxes(rename); // Force prevent focus...
		this.attribute(this.$("hc-editor-cmd-reloadSettings"), "disabled", rename);
		if(rename) {
			var fe = document.commandDispatcher.focusedElement;
			if(!fe || fe.parentNode.id != "hc-editor-shortcutBox")
				this.$("hc-editor-button").focus();
			this.$("hc-editor-renameShortcutOverlay").style
				.backgroundColor = getComputedStyle(this.root, null).backgroundColor;
			this.funcOptsFixed && this.fixFuncOpts((this.$("hc-editor-funcOptsFixed").checked = false));
			this._shortcutBeforeRename = this.currentShortcut;
			this._typeBeforeRename = this.currentType;
			return;
		}
		var sh = this._shortcutBeforeRename;
		var ct = this._typeBeforeRename;
		var newSh = this.currentShortcut;
		this._shortcutBeforeRename = this._typeBeforeRename = null;
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
		if(syncSave) {
			this.pe.saveSettingsObjects();
			return;
		}

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
	preventAccesskeys: function(e) {
		if(e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey)
			e.preventDefault();
	},
	preventCommands: function(e) {
		var trg = e.target;
		var nn = trg.localName;
		if((nn == "command" || nn == "key") && !trg.hasAttribute("hc_allowInRenameMode")) {
			e.preventDefault();
			e.stopPropagation();
		}
	},
	disableTextboxes: function(disable) {
		var disAttr = "hc_disableInput";
		Array.forEach(document.getElementsByTagName("textbox"), function(tb) {
			if(disable) {
				if(tb.disabled)
					return;
				tb.setAttribute(disAttr, "true");
			}
			else if(tb.hasAttribute(disAttr))
				tb.removeAttribute(disAttr);
			else
				return;
			var inp = document.getAnonymousElementByAttribute(tb, "anonid", "input");
			inp.disabled = disable;
		});
	},
	tabLikeNavigation: function(e) {
		if(e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
			if("defaultPrevented" in e ? e.defaultPrevented : e.getPreventDefault())
				return;
			if(e.keyCode == e.DOM_VK_UP) { // Ctrl+Up
				document.commandDispatcher.rewindFocus();
				e.preventDefault();
			}
			else if(e.keyCode == e.DOM_VK_DOWN) { // Ctrl+Down
				document.commandDispatcher.advanceFocus();
				e.preventDefault();
			}
		}
	},
	loadSavedShortcut: function(e) {
		var mi = e.target;
		var sh = mi.getAttribute("hc_shortcut");
		if(!sh)
			return;
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
		this.doEditorCommand("hc-editor-cmd-codeToFile", "codeToFile", function() {
			var editCode = this.getFloatButton("hc-editor-cmd-editCode");
			this.markAs(editCode, "hc_attention", "", 2);
		}, this);
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
			var newPath = this.ut.prompt(this.getLocalized("renameFile"), exists + newFileName, path);
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
		//path.editor.value = newCode;
		Array.prototype.forEach.call(
			document.getElementsByTagName("textbox"),
			function(tb) {
				if(/(?:^|\s)hcEditor(?:\s|$)/.test(tb.className) && tb.value == oldCode)
					tb.value = newCode;
			}
		);
		this.pe.forEachCode(this.ps, function(code, o, key) {
			if(code == oldCode)
				o[key] = newCode;
		}, this);
		this.pe.reloadSettings(true);
	},
	_fdChanged: false,
	_windowClosing: false,
	changedFileData: function(path) {
		this.delay(function() {
			this._fdChanged = true;
			this.changedFileDataSync(path);
		}, this);
	},
	changedFileDataSync: function(path) {
		var wSet = this.wu.wm.getMostRecentWindow("handyclicks:settings");
		wSet && wSet.handyClicksSets.changedFileData(path);
	},
	cleanupFilesData: function() {
		if(!this._fdChanged)
			return;
		this._log("cleanupFilesData()");
		this.pe.filterFilesData(this.ps.files) && this.changedFileDataSync();
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
		editor = editor || this.selectedEditor;
		var path = editor.textLength <= 1028 // Too long for path? ("//> ".length + PATH_MAX)
			&& this.ps.getSourcePath(editor.value);
		var codeToFileBtn = editor.__codeToFileBtn || (
			editor.__codeToFileBtn = this.getFloatButton("hc-editor-cmd-codeToFile", editor)
		);
		var dis = !!path;
		if(codeToFileBtn.disabled != dis)
			codeToFileBtn.disabled = dis;
		this.delay(function() {
			var editCodeBtn = editor.__editCodeBtn || (
				editor.__editCodeBtn = this.getFloatButton("hc-editor-cmd-editCode", editor)
			);
			var notFound = this.su.linkedFileNotExists(path);
			this.attribute(editCodeBtn, "hc_fileNotFound", notFound);
			if(!editCodeBtn.hasAttribute("hc_isDarkFont")) // Only once... for better performance
				this.su.checkDarkFont(editCodeBtn);
			this.delay(function() { // Wait for su.setKeysDesc()
				var baseTip = editCodeBtn.__baseTip || (
					editCodeBtn.__baseTip = editCodeBtn.getAttribute("tooltiptext")
				);
				var newTip = notFound ? baseTip + " \n" + this.getLocalized("cantEditFile") : baseTip;
				if(editCodeBtn.getAttribute("tooltiptext") != newTip)
					editCodeBtn.setAttribute("tooltiptext", newTip);
			}, this, 150);
		}, this, 10);
	},

	hasCrashBackup: false,
	checkForCrashBackups: function(delay, silent) {
		setTimeout(function(_this) {
			_this._checkForCrashBackups(silent);
		}, delay || 500, this);
	},
	_checkForCrashBackups: function(silent) {
		var bakFile = this._hasCrashBackup();
		var hasBak = this.hasCrashBackup = !!bakFile;
		this.attribute(this.root, "hc_hasCrashBackup", hasBak);
		if(bakFile && !silent) {
			var msg = this.getLocalized("hasCrashBackup")
				.replace("%b", this.$("hc-editor-cmd-openCode").getAttribute("label"))
				.replace("%f", bakFile.path);
			this.ut.notifyWarning(msg, { buttons: {
				$openDirectory: function() {
					this.ut.reveal(bakFile);
				}
			}, context: this });
		}
	},
	_hasCrashBackup: function() {
		var tempDir = this.ps._tempDir;
		if(!tempDir)
			return null;
		var activeFiles = this.storage.get("activeTempFiles") || { __proto__: null };
		var entries = tempDir.directoryEntries;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(fName.substr(0, 3) == "hc_" && !(entry.path in activeFiles))
				return entry;
		}
		return null;
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
			this.applySettings(false, false, this.ju.bind(function() {
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
		}
		return false;
	},
	testSettings: function(e) {
		var invertFocusPref = e && (e.button == 1 || e.button == 0 && this.hasModifier(e));
		if(e && !invertFocusPref)
			return;

		this.$("hc-editor-cmd-test").setAttribute("disabled", "true");
		var ok = false;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: ok = this.testShortcut();   break;
			case this.INDEX_TYPE:     ok = this.testCustomType();
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
		var deleted;
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: deleted = this.deleteShortcut();   break;
			case this.INDEX_TYPE:     deleted = this.deleteCustomType();
		}
		deleted && this.su.showInfoTooltip(
			this.deleteButton,
			this.getLocalized("deleteUndo")
				.replace("%b", this.applyButton.label),
			this.su.TOOLTIP_HIDE_DEFAULT,
			this.su.TOOLTIP_OFFSET_ABOVE
		);
	},
	copySettings: function() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: this.copyShortcut();   break;
			case this.INDEX_TYPE:     this.copyCustomType();
		}
	},
	pasteSettings: function() {
		switch(this.editorTabIndex) {
			case this.INDEX_SHORTCUT: this.pasteShortcut();   break;
			case this.INDEX_TYPE:     this.pasteCustomType();
		}
	},
	markAs: function(node, attr, val, count) {
		if(node.hasAttribute(attr) && node.getAttribute(attr) != "true")
			return; // Leave error indication
		(function mark() {
			node.setAttribute(attr, val || "true");
			setTimeout(function() {
				node.removeAttribute(attr);
				--count && setTimeout(mark, 200);
			}, 200);
		})();
	},
	checkSaved: function() {
		var hasUnsaved = this.hasUnsaved;
		var hasRename = this.renameShortcutMode && this._shortcutBeforeRename != this.currentShortcut;
		var res = hasUnsaved ? this.su.notifyUnsaved()
			: hasRename ? this.notifyUnsavedRename() : undefined;
		if(res == this.su.PROMPT_CANCEL)
			return false;
		if(res == this.su.PROMPT_SAVE) {
			hasRename && this.renameShortcut(hasUnsaved, false, true);
			hasUnsaved && this.saveSettings();
		}
		this._windowClosing = true;
		this.cleanupFilesData();
		return true;
	},
	checkCanEnable: function(cb) {
		var type = this.currentType;
		if(
			cb.checked
			&& cb.id == "hc-editor-enabled" // Ignore checkbox for delayed action
			&& this.ps.isCustomType(type)
			&& !this.ju.getOwnProperty(this.ps.types, type, "enabled")
		) {
			this.su.showInfoTooltip(
				cb,
				this.getLocalized("cantBeEnabled"),
				this.su.TOOLTIP_HIDE_DEFAULT,
				this.su.TOOLTIP_OFFSET_CURSOR
			);
		}
	},
	notifyUnsavedRename: function() {
		var newSh = this.currentShortcut;
		var alreadyUsed = !!this.ju.getOwnProperty(this.ps.prefs, newSh, this._typeBeforeRename);
		var sh = "\n" + this.ps.getShortcutStr(this._shortcutBeforeRename, true)
			+ "\n\u21d2 " /* "=>" */ + this.ps.getShortcutStr(newSh, true)
			+ (alreadyUsed ? this.getLocalized("alreadyUsed") : "");
		alreadyUsed && this.ut.waitForPromptWindow(function(win) {
			var btn = win.document.documentElement.getButton("accept");
			btn.disabled = true;
		});
		return this.su.notifyUnsaved(
			this.getLocalized("confirmRename") + sh,
			"editor.confirmRename",
			alreadyUsed ? this.su.PROMPT_DONT_SAVE : this.su.PROMPT_SAVE
		);
	},

	saveShortcut: function(applyFlag, testFlag, dontUpdate, saveAll) {
		var sh = this.currentShortcut;
		var type = this.currentType;
		var so = this.currentShortcutObj;

		var typesList = this.typesList;
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

		var loadCorrectedSettings = !dontUpdate  && this.ju.bind(function(status) {
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
		applyFlag && this.delay(this.typeUsageChanged, this, 0, [type]);
		return true;
	},
	applySettings: function(testFlag, applyFlag, callback) {
		this.testMode = testFlag; //~ todo: test!
		if(testFlag)
			this.pe.testSettings(true);
		else if(this.ps.otherSrc)
			this.pe.reloadSettings(applyFlag);
		else if(!applyFlag) // ondialogaccept
			this.pe.saveSettingsObjects();
		else {
			this.applyDisabled = true; // Don't wait for callback
			this.pe.saveSettingsObjectsAsync(applyFlag, callback);
			return;
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
		this.delay(this.typeUsageChanged, this, 0, [ct]);
		if(!this.ju.getOwnProperty(p, sh, ct)) { // Nothing to delete
			this._savedShortcutObj = null;
			this.setDialogButtons();
			return false;
		}
		delete p[sh][ct];
		if(this.ju.isEmptyObj(p[sh]))
			delete p[sh];
		if(this.ps.otherSrc)
			this.pe.reloadSettings();
		else
			this.pe.saveSettingsObjects();
		this.highlightUsedTypes();

		this.shortcutSaved();
		this.setDialogButtons();
		return true;
	},
	copyShortcut: function(isDelayed, dontCopy) {
		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == this.INDEX_SHORTCUT_DELAYED;
		var delayed = isDelayed ? this.delayId : "";
		var funcs = this.$("hc-editor-func" + delayed);
		var si = funcs.selectedItem;
		if(!si) {
			this.markAs(this.$("hc-editor-funcTabbox"), "hc_copied", "false");
			return null;
		}
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
		var so = stored.so;
		var type = this.currentType;
		if(isDelayed === undefined)
			isDelayed = this.$("hc-editor-funcTabbox").selectedIndex == this.INDEX_SHORTCUT_DELAYED;
		var cantPasteDefault = so === undefined && !isDelayed;

		if(
			!type
			|| cantPasteDefault
			|| this.notSupported(type, null, stored.supports, stored.app, stored.required)
		) {
			this.markAs(this.$("hc-editor-funcTabbox"), "hc_pasted", "false");
			if(!cantPasteDefault)
				this.typeRequired();
			return false;
		}

		var delayed = isDelayed ? this.delayId : "";
		this.initFuncEditor(so, delayed, true);
		if(!isDelayed)
			this.$("hc-editor-events").value = so.eventType || "click";

		this.disableUnsupported();
		this.setDialogButtons();
		this.markAs(this.$("hc-editor-funcTabbox"), "hc_pasted");
		return true;
	},
	saveCustomType: function(applyFlag, testFlag, dontUpdate, saveAll) {
		var label = this.$("hc-editor-customType").value;
		var type = this.$("hc-editor-customTypeExtId").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		if(!label || !type || !def) {
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
		type = this.ps.customPrefix + type;

		var enabled = this.$("hc-editor-customTypeEnabled").checked;
		this.ps.types[type] = this.getTypeObj(label, def, enabled);

		var loadCorrectedSettings = !dontUpdate && this.ju.bind(function(status) {
			if(status !== undefined && !Components.isSuccessCode(status))
				return;
			var to = this.ps.types[type];
			if(to && to.enabled == enabled && to.label == label) // Looks not changed
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
		return this.getCurrentTypeObj();
	},
	getCurrentTypeObj: function(label) {
		if(label === undefined)
			label = this.$("hc-editor-customType").value;
		var def = this.$("hc-editor-customTypeDefine").value;
		var cm = this.$("hc-editor-customTypeContext").value;
		return (label || def || cm || this.$("hc-editor-customTypeExtId").value)
			? this.getTypeObj(label, def, undefined, cm || null)
			: null;
	},
	getTypeObj: function(label, def, enabled, cm) {
		return {
			enabled:     enabled !== undefined ? enabled : this.$("hc-editor-customTypeEnabled").checked,
			label:       label   !== undefined ? label   : this.$("hc-editor-customType")       .value,
			define:      def     !== undefined ? def     : this.$("hc-editor-customTypeDefine") .value,
			contextMenu: cm      !== undefined ? cm      : this.$("hc-editor-customTypeContext").value || null
		};
	},
	deleteCustomType: function() {
		var types = this.ps.types;
		var type = this.currentCustomType;
		if(!types.hasOwnProperty(type)) { // Nothing to delete
			this._savedTypeObj = null;
			this.setDialogButtons();
			return false;
		}
		if(!this.su.confirmTypeAction(type, "typeDeletingWarning"))
			return false;
		delete types[type];
		if(this.ps.otherSrc)
			this.pe.reloadSettings();
		else
			this.pe.saveSettingsObjects();
		this.appendTypesList();

		this.typeSaved();
		this.setDialogButtons();
		return true;
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

	highlightRequiredFields: function _hl(fields, addFlag, noDelay, force) {
		if(!addFlag && !noDelay) {
			var timer = this.delay(_hl, this, 2500, [fields, false, true]);
			fields.forEach(function(field) {
				field.__timer = timer;
			});
			return;
		}
		function cancelTimer(node) {
			if(node.__timer || 0) {
				addFlag && clearTimeout(node.__timer);
				node.__timer = 0;
			}
		}
		fields.forEach(function(field) {
			if(
				addFlag && !force && field.value
				&& (field.localName != "menulist" || this.checkMenulist(field))
			)
				return;
			cancelTimer(field);
			this.attribute(field, "hc_requiredField", addFlag);
			for(var tab = this.getTabForNode(field); tab; tab = this.getTabForNode(tab, true)) {
				cancelTimer(tab);
				this.attribute(tab, "hc_requiredFieldParentTab", addFlag && tab.getAttribute("selected") != "true");
			}
		}, this);
	},
	typeRequired: function() {
		var nodes = [this.typesList];
		this.highlightRequiredFields(nodes, true, false, true);
		this.highlightRequiredFields(nodes, false);
	},
	checkMenulist: function(ml) {
		//~ note: disabled state isn't checked
		if(ml.getAttribute("editable") == "true")
			return !!ml.value;
		return !!ml.selectedItem;
	}
};
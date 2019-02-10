var handyClicksSets = {
	__proto__: handyClicksGlobals,

	_import: false,
	_importPartial: false,
	_importFilesData: false,
	_importFromClipboard: false,
	_importSrc: null,
	_savedPrefs: null,
	_savedTypes: null,

	init: function(reloadFlag) {
		this.ps.loadSettings();
		this.initShortcuts();

		this.restoreSearchQuery();
		this[reloadFlag ? "updTree" : "drawTree"]();

		!reloadFlag && this.focusSearch(true);

		this.updTreeButtons();
		this.checkTreeSaved();
		this.ps.oSvc.addObserver(this.setsReloading, this);

		this.initPrefs();
		this.pu.oSvc.addObserver(this.prefsChanged, this);

		var fxVersion = this.ut.fxVersion;
		if(fxVersion >= 3.5) {
			var sf = this.searchField;
			if(typeof sf._clearSearch == "function") {
				this._origClearSearch = sf._clearSearch;
				var hcs = this;
				sf._clearSearch = function() {
					if(window.closed)
						return null;
					var ret = hcs._origClearSearch.apply(this, arguments);
					hcs.searchInSetsTreeDelay();
					return ret;
				};
			}
		}
		else if(fxVersion <= 2) {
			this.$("hc-sets-tree-searchContainer").style.padding = "0";
		}

		if(reloadFlag)
			this.setDialogButtons();
		else {
			this.startupUI();
			if(this.counters.buggy) {
				this.setDialogButtons();
				this.notifyBuggyPrefs();
			}
		}

		if(fxVersion >= 3.6) { // Fix wrong resizing after sizeToContent() call
			var de = document.documentElement;
			if(de.getAttribute("sizemode") == "normal")
				window.resizeTo(+de.width, +de.height);
		}

		var brWin = this.wu.wm.getMostRecentWindow("navigator:browser");
		if(brWin) {
			if(!brWin.document.getElementById("appmenu_preferences"))
				document.getElementsByAttribute("preference", "showInAppMenu")[0].hidden = true;
			var statusBar = brWin.document.getElementById("status-bar");
			// Note: still available in Firefox 32.0a1, but can't be restored without extensions
			// + see https://bugzilla.mozilla.org/show_bug.cgi?id=956731
			if(!statusBar || statusBar.parentNode.hasAttribute("toolbar-delegate")) {
				document.getElementsByAttribute("preference", "showInStatusbar")[0].hidden = true;
				document.getElementsByAttribute("value", "Statusbar")[0].hidden = true;
			}
		}

		if(
			(this.ut.appInfo.name == "Pale Moon" ? this.ut.appVersion >= 27 : fxVersion >= 25)
			&& this.ut.appInfo.OS == "WINNT"
			&& this.ut.osVersion >= 6
			&& matchMedia("(-moz-windows-default-theme)").matches
		)
			this.tree.setAttribute("hc_hasOverlayBackground", "true");

		if(fxVersion <= 2)
			this.e("hc-sets-overrideInstantApply-box").hidden = true;

		window.addEventListener("mouseover", this, true);
		document.addEventListener(this.su.dropEvent, this, false);
	},
	initShortcuts: function() {
		var tr = this.tree = this.$("hc-sets-tree");
		var tView = this.tView = tr.view;
		this.tbo = tr.treeBoxObject;
		this.tBody = tr.body;
		this.tSel = tView.selection;

		this.applyButton = document.documentElement.getButton("extra1");
	},
	destroy: function(reloadFlag) {
		this.closeImportEditors();
		this.treeState(true);
		this.treeScrollPos(true);
		this.saveSearchQuery();
		reloadFlag && this.setImportStatus(false);
		this.rowsCache = this._savedPrefs = this._savedTypes = null;

		window.removeEventListener("mouseover", this, true);
		document.removeEventListener(this.su.dropEvent, this, false);
	},
	restoreSearchQuery: function() {
		if(!this.pu.get("sets.rememberSearchQuery"))
			return false;
		var sf = this.searchField;
		var obsoletePref = this.pu.prefNS + "sets.lastSearchQuery"; //= Added: 2012-01-11
		var lsq = this.pu.getPref(obsoletePref);
		if(lsq != undefined)
			this.pu.prefSvc.deleteBranch(obsoletePref);
		else
			lsq = sf.getAttribute("hc_value");
		sf.value = lsq;
		//sf._enterSearch && sf._enterSearch();
		return !!lsq;
	},
	saveSearchQuery: function() {
		var sf = this.searchField;
		if(this.pu.get("sets.rememberSearchQuery"))
			sf.setAttribute("hc_value", sf.value);
		else
			sf.removeAttribute("hc_value");
	},
	startupUI: function() {
		this.treeState(false);
		this.treeScrollPos(false);
		Array.prototype.forEach.call(
			this.$("hc-sets-tree-columns").getElementsByTagName("treecol"),
			function(col) {
				if(!col.tooltipText)
					col.tooltipText = col.getAttribute("label");
			}
		);
		var de = document.documentElement;
		this.instantApply = de.instantApply;
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;

		var prefsButt = de.getButton("extra2");
		prefsButt.className += " hc-iconic hc-preferences";
		// Used menu button (instead of "popup" attributes) to make popup accessible from keyboard
		prefsButt.setAttribute("type", "menu");
		prefsButt.appendChild(this.e("hc-sets-prefsManagementPopup"));
		Array.prototype.forEach.call( // Fix command handler from dialog binding
			prefsButt.getElementsByTagName("menuitem"),
			function(mi) {
				mi.setAttribute("dlgtype", "extra2");
			}
		);
	},
	buildCharsetMenu: function(popup) {
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.notifyObservers(null, "charsetmenu-selected", "other");
		if(popup.lastChild.localName != "menuseparator")
			return;
		try { // Firefox 32+
			var CharsetMenu = Components.utils["import"]("resource://gre/modules/CharsetMenu.jsm", {}).CharsetMenu;
			var df = document.createDocumentFragment();
			CharsetMenu.build(df, true, false); // Works only with empty nodes!
			popup.appendChild(df);
			Array.prototype.forEach.call(
				popup.getElementsByTagName("menuitem"),
				function(mi) {
					if(!mi.hasAttribute("value"))
						mi.setAttribute("value", mi.getAttribute("charset"));
					mi.removeAttribute("type"); // Remove type="radio"
				}
			);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},
	handleEvent: function(e) {
		if(e.type == "mouseup") {
			this.smartSelect(e);
			this.delay(this.smartSelectStop, this, 10);
		}
		else if(e.type == "mouseover")
			this.openMenu(e);
		else if(e.type == this.su.dropEvent)
			this.dataChanged(e, true);
	},
	setAutocompletePlural: function(tb) {
		if(!tb)
			tb = this.e("hc-sets-tabSize");
		var label = tb.nextSibling;
		label.value = label.getAttribute(tb.value == 1 ? "hc_labelSingle" : "hc_labelMultiple");
	},
	closeImportEditors: function() {
		this.wu.forEachWindow("handyclicks:editor", function(w) {
			if(!("_handyClicksInitialized" in w) || w.handyClicksPrefSvc.otherSrc)
				w.close();
		});
	},
	treeState: function(saveFlag) {
		var rememberState = this.pu.get("sets.rememberState");
		var tr = this.tree;
		if(saveFlag) {
			if(rememberState) {
				tr.setAttribute("hc_stateCollapsed", this.ps.JSON.stringify(this.getCollapsed()));
				tr.setAttribute("hc_stateSelected", this.ps.JSON.stringify(this.getSelected()));
			}
			else {
				tr.removeAttribute("hc_stateCollapsed");
				tr.removeAttribute("hc_stateSelected");
			}
			document.persist(tr.id, "hc_stateCollapsed");
			document.persist(tr.id, "hc_stateSelected");
			return;
		}
		if(!rememberState)
			return;

		var collapsedRows = tr.getAttribute("hc_stateCollapsed");
		var selectedRows = tr.getAttribute("hc_stateSelected");
		collapsedRows && this.restoreCollapsed(this.ps.JSON.parse(collapsedRows));
		selectedRows && this.restoreSelection(this.ps.JSON.parse(selectedRows));
	},
	treeScrollPos: function(saveFlag) {
		var rememberScrollPos = this.pu.get("sets.rememberScrollPosition");
		var tr = this.tree;
		if(saveFlag) {
			if(rememberScrollPos) {
				tr.setAttribute("hc_firstVisibleRow", this.tbo.getFirstVisibleRow());
				tr.setAttribute("hc_lastVisibleRow", this.tbo.getLastVisibleRow());
			}
			else {
				tr.removeAttribute("hc_firstVisibleRow");
				tr.removeAttribute("hc_lastVisibleRow");
			}
			document.persist(tr.id, "hc_firstVisibleRow");
			document.persist(tr.id, "hc_lastVisibleRow");
			return;
		}
		if(!rememberScrollPos)
			return;
		if(!tr.hasAttribute("hc_firstVisibleRow"))
			return;
		if(!this.tView.rowCount)
			return;
		var fvr = +tr.getAttribute("hc_firstVisibleRow");
		var lvr = +tr.getAttribute("hc_lastVisibleRow"); // Note: may be larger, than maxRowsIndx
		this.restoreScroll(fvr, lvr);
	},
	restoreScroll: function(fvr, lvr) {
		var tbo = this.tbo;
		tbo.ensureRowIsVisible(lvr);
		tbo.ensureRowIsVisible(fvr);
		if(lvr >= this.tView.rowCount - 1) this.delay(function() { // Force scroll to last row
			tbo.ensureRowIsVisible(lvr);
			tbo.ensureRowIsVisible(fvr);
		}, this);
	},

	/*** Actions pane ***/
	forceUpdTree: function(pSrc) {
		this.ps.loadSettings(pSrc);
		this.setDialogButtons();
		this.updTree();
	},
	_treeBatchMode: false,
	treeBatch: function(func, context, args) {
		if(!this._treeBatchMode) {
			this._treeBatchMode = true;
			var tbo = this.tbo;
			tbo.beginUpdateBatch();
		}
		var ret = func.apply(context || this, args);
		if(tbo) {
			tbo.endUpdateBatch();
			this._treeBatchMode = false;
		}
		return ret;
	},
	counters: {
		override: 0,
		overrideDa: 0,
		added: 0,
		addedDa: 0,
		buggy: 0,
		__proto__: null
	},
	resetCounters: function() {
		var c = this.counters;
		for(var p in c)
			c[p] = 0;
	},
	drawTree: function() {
		return this.treeBatch(this._drawTree, this, arguments);
	},
	_drawTree: function(dontSearch) {
		this.ut.timer("drawTree()");
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.get("delayedActionTimeout");
		var daForceDis = this._daForceDisable = daTime <= 0;
		this._daAfter = daForceDis
			? this.getLocalized("disabled")
			: this.getLocalized("after").replace("%t", daTime);
		this._daExpand = this.pu.get("sets.treeExpandDelayedAction");
		this._localizeArgs = this.pu.get("sets.localizeArguments");
		this._maxCodeLength = this.pu.get("sets.codeLengthLimit");
		this._preserveLines = this.pu.get("sets.codeLengthLimit.preserveLines");
		this.drawMode = this.pu.get("sets.treeDrawMode");

		this.resetCounters();

		var df = this.ut.fxVersion >= 2
			? document.createDocumentFragment()
			: this.tBody;
		this.drawPrefs(this.ps.prefs, df);
		this._import && this.addImportStatistics(df);
		if(df != this.tBody)
			this.tBody.appendChild(df);
		this._importPartial && this.hideOldTreeitems(true);
		this.markOpenedEditors(true);
		delete this.eltsCache;
		this._hasFilter = false;

		this.ut.timer("drawTree()");
		!dontSearch && this.searchInSetsTree(true);
	},
	drawPrefs: function(prefs, df, isRemoved) {
		this._drawRemoved = isRemoved;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh))
			this.drawShortcut(prefs, sh, df);
	},
	drawShortcut: function(prefs, sh, df) {
		var so = prefs[sh];
		if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(so)) {
			this.ut._warn('Invalid shortcut in prefs: "' + sh + '"');
			return;
		}
		if(this.ut.isEmptyObj(so)) {
			this.ut._warn('Empty settings object in prefs: "' + sh + '"');
			return;
		}
		switch(this.drawMode) {
			case 0:
			default: // Normal
				var button = this.ps.getButtonId(sh);
				var modifiers = this.ps.getModifiersStr(sh);
				var buttonContainer = this.eltsCache[button]
					|| this.appendContainerItem(df, button, this.getLocalized(button));
				var modifiersContainer = this.eltsCache[sh]
					|| this.appendContainerItem(buttonContainer, sh, modifiers);
				this.appendItems(modifiersContainer, so, sh);
			break;
			case 1: // Normal (compact)
				var label = this.ps.getShortcutStr(sh, true);
				var buttonContainer = this.eltsCache[sh]
					|| this.appendContainerItem(df, sh, label);
				this.appendItems(buttonContainer, so, sh);
			break;
			case 2: // Normal (inline)
				var label = this.ps.getShortcutStr(sh, true) + this.ps.spacedSep;
				for(var type in so) if(so.hasOwnProperty(type))
					this.appendRow(df, sh, type, so[type], label + this.getTypeLabel(type));
			break;
			case 3: // Inverse
				var button = this.ps.getButtonId(sh);
				var buttonLabel = this.getLocalized(button);
				var modifiers = this.ps.getModifiersStr(sh);
				for(var type in so) if(so.hasOwnProperty(type)) {
					var typeContainer = this.eltsCache[type]
						|| this.appendContainerItem(df, type, this.getTypeLabel(type));
					var hash = type + "-" + button;
					var buttonContainer = this.eltsCache[hash]
						|| this.appendContainerItem(typeContainer, hash, buttonLabel);
					this.appendRow(buttonContainer, sh, type, so[type], modifiers);
				}
			break;
			case 4: // Inverse (compact)
				var label = this.ps.getShortcutStr(sh, true);
				for(var type in so) if(so.hasOwnProperty(type)) {
					var typeContainer = this.eltsCache[type]
						|| this.appendContainerItem(df, type, this.getTypeLabel(type));
					this.appendRow(typeContainer, sh, type, so[type], label);
				}
			break;
			case 5: // Inverse (inline)
				var label = this.ps.spacedSep + this.ps.getShortcutStr(sh, true);
				for(var type in so) if(so.hasOwnProperty(type))
					this.appendRow(df, sh, type, so[type], this.getTypeLabel(type) + label);
			break;
		}
	},
	addImportStatistics: function(df) {
		var overrideTypes = 0;
		var newTypes = 0;

		var types = this.ps.types;
		var savedTypes = this._savedTypes;

		for(var type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			var oldTo = this.ut.getOwnProperty(savedTypes, type);
			if(!oldTo)
				++newTypes;
			else if(!this.settingsEquals(to, oldTo))
				++overrideTypes;
		}

		var deletable = 0;
		var deletableDa = 0;
		var deletableTypes = 0;

		var prefs = this.ps.prefs;
		var savedPrefs = this._savedPrefs;
		var delPrefs = {};

		for(var sh in savedPrefs) if(savedPrefs.hasOwnProperty(sh)) {
			var so = savedPrefs[sh];
			if(!this.ut.isObject(so))
				continue;
			var newSo = this.ut.getOwnProperty(prefs, sh);
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				var newTo = this.ut.getOwnProperty(newSo, type);
				if(to && !newTo) {
					++deletable;
					this.ut.setOwnProperty(delPrefs, sh, type, to);
				}
				if(!this.ut.isObject(to))
					continue;
				var da = this.ut.getOwnProperty(to, "delayedAction");
				var newDa = this.ut.getOwnProperty(newTo, "delayedAction");
				if(da && !newDa)
					++deletableDa;
			}
		}

		for(var type in savedTypes) if(savedTypes.hasOwnProperty(type))
			if(savedTypes[type] && !this.ut.getOwnProperty(types, type))
				++deletableTypes;

		this.drawPrefs(delPrefs, df, true);

		const id = "hc-sets-tree-import";
		var c = this.counters;
		var showStats = this.ut.bind(function(type, normal, delayed, customTypes) {
			this.$(id + type + "Normal")     .value = normal;
			this.$(id + type + "Delayed")    .value = delayed;
			this.$(id + type + "CustomTypes").value = customTypes;
		}, this);
		showStats("Added",   c.added,    c.addedDa,    newTypes);
		showStats("Changed", c.override, c.overrideDa, overrideTypes);
		showStats("Removed", deletable,  deletableDa,  deletableTypes);
	},
	hideOldTreeitems: function(hide, update) {
		if(update) {
			var hidden = this.tBody.getElementsByAttribute("hidden", "true");
			for(var i = hidden.length - 1; i >= 0; --i)
				hidden[i].hidden = false;
		}
		Array.prototype.forEach.call(
			this.tBody.getElementsByAttribute("hc_old", "item"),
			function(tItem) {
				if(hide)
					this.hideTreeitem(tItem, true);
				else
					this.showTreeitem(tItem);
			},
			this
		);
	},
	redrawTree: function() {
		return this.treeBatch(this._redrawTree, this, arguments);
	},
	_redrawTree: function(dontSearch) {
		this.tBody.textContent = "";
		this._drawTree(dontSearch);
		this.setDialogButtons();
	},
	updTree: function() {
		return this.treeBatch(this._updTree, this, arguments);
	},
	_updTree: function(saveClosed, saveSel) {
		if(saveClosed === undefined)
			saveClosed = true;
		if(saveSel === undefined)
			saveSel = true;

		var collapsedRows = saveClosed && this.getCollapsed();
		var selectedRows = saveSel && this.getSelected();

		this._redrawTree();
		if(!this.tView.rowCount)
			return;

		saveClosed && this.restoreCollapsed(collapsedRows);
		saveSel && this.restoreSelection(selectedRows);
	},
	getCollapsed: function() {
		var collapsedRows = { __proto__: null };
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				if(ti.getAttribute("open") != "true")
					collapsedRows[ti.__hash] = true;
			}
		);
		return collapsedRows;
	},
	restoreCollapsed: function(collapsedRows) {
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				if(ti.__hash in collapsedRows)
					ti.setAttribute("open", "false");
			}
		);
	},
	getSelected: function() {
		var selectedRows = { __proto__: null };
		var rngCount = this.tSel.getRangeCount();
		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				var tItem = this.getItemAtIndex(j);
				if(tItem) // May be out of range in case of filters
					selectedRows[tItem.__hash] = true;
			}
		}
		return selectedRows;
	},
	restoreSelection: function(selectedRows) {
		Array.prototype.forEach.call(
			this.tBody.getElementsByTagName("treeitem"),
			function(ti) {
				if(ti.__hash in selectedRows) {
					var indx = this.tView.getIndexOfItem(ti);
					if(indx != -1)
						this.tSel.rangedSelect(indx, indx, true);
				}
			},
			this
		);
	},
	shortcutRenamed: function(oldHash, newHash) {
		// Trick to save corrected collapsed and selected state
		var mdfPattern = this.ps.modifiersMask;
		var newBtn = /button=(\d)/.test(newHash) && RegExp.$1;
		var newMdf = mdfPattern.test(newHash) && RegExp.lastMatch;
		var rc = this.rowsCache;
		for(var tItem = (oldHash in rc) && rc[oldHash].parentNode; tItem; tItem = tItem.parentNode.parentNode) {
			if(tItem.__delayed)
				tItem.__delayed.__hash = newHash + "-delayed";
			tItem.__hash = tItem.__hash
				.replace(/^(button=?)\d/, "$1" + newBtn)
				.replace(/(-button)\d$/, "$1" + newBtn)
				.replace(mdfPattern, newMdf);
			if(tItem.parentNode == this.tBody)
				break;
		}
	},

	setsReloading: function(notifyReason) {
		if(notifyReason & this.ps.SETS_RELOADED) {
			if(this.ps.otherSrc) // Disable checkbox, if all files data was deleted
				this.setImportFilesDataStatus();
			this.updTree();
			this.checkTreeSaved();
		}
	},

	markOpenedEditors: function() {
		return this.treeBatch(this._markOpenedEditors, this, arguments);
	},
	_markOpenedEditors: function(isInitial) {
		if(!isInitial) for(var rowId in this.rowsCache)
			this._setItemStatus(rowId, false);
		const idProp = this.wu.winIdProp;
		const pSvc = "handyClicksPrefSvc";
		var otherSrc = this.ps.otherSrc;
		this.wu.forEachWindow("handyclicks:editor", function(w) {
			if(idProp in w && pSvc in w && w[pSvc].otherSrc == otherSrc)
				this._setItemStatus(w[idProp], true);
		}, this);
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem = document.createElement("treeitem");
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		var tRow = tItem.appendChild(document.createElement("treerow"));
		var tCell = tRow.appendChild(document.createElement("treecell"));
		tCell.setAttribute("label", label);
		var tChld = tItem.appendChild(document.createElement("treechildren"));

		tItem.__hash = hash;
		tItem.__sortLabel = label;
		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);
		return this.eltsCache[hash] = tChld;
	},
	getSortedInsPos: function(parent, sortItem) {
		var sortedItems = Array.prototype.slice.call(parent.childNodes);
		sortedItems.push(sortItem);
		sortedItems.sort(function(a, b) {
			return a.__sortLabel > b.__sortLabel;
		});
		return sortedItems[sortedItems.indexOf(sortItem) + 1] || null;
	},
	appendItems: function(parent, items, shortcut) {
		for(var itemType in items) if(items.hasOwnProperty(itemType))
			this.appendRow(parent, shortcut, itemType, items[itemType]);
	},
	appendRow: function(parent, shortcut, itemType, fo, forcedLabel) {
		var tItem = document.createElement("treeitem");
		var tRow = tItem.appendChild(document.createElement("treerow"));
		if(!this.ut.isObject(fo))
			fo = {};
		var foStr = 'prefs["' + shortcut + '"].' + itemType;
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = this.getTypeLabel(itemType, isCustomType);
		var label = forcedLabel || typeLabel;
		var initCode, daInitCode;
		var extNA = this.extTypeNotAvailable(itemType);
		var drawRemoved = this._drawRemoved;

		this.appendTreeCell(tRow, "label", label);
		this.appendTreeCell(tRow, "label", fo.eventType);
		var actLabel = this.su.getActionLabel(fo);
		this.appendTreeCell(tRow, "label", actLabel);
		this.appendTreeCell(tRow, "label", this.getActionCode(fo.action, isCustom));
		var linkedFile = this.getActionCode._hasLinkedFile;
		var fileData = this.getActionCode._hasFileData;
		this.appendTreeCell(tRow, "label", this.getArguments(fo.arguments || {}, this._localizeArgs));
		this.appendTreeCell(tRow, "label", (initCode = this.getInitCode(fo, true)));
		if(this.getActionCode._hasFileData)
			fileData = true;
		if(this.getActionCode._hasLinkedFile)
			linkedFile = true;

		var da = this.ut.getOwnProperty(fo, "delayedAction");
		if(da) {
			tItem.setAttribute("container", "true");
			if(this._daExpand)
				tItem.setAttribute("open", "true");
			var daChild = tItem.appendChild(document.createElement("treechildren"));
			var daItem = daChild.appendChild(document.createElement("treeitem"));
			var daRow = daItem.appendChild(document.createElement("treerow"));

			if(!this.ut.isObject(da))
				da = {};

			this.appendTreeCell(daRow, "label", this.getLocalized("delayed"));
			this.appendTreeCell(daRow, "label", this._daAfter);

			var daStr = foStr + ".delayedAction";
			var daCustom = !!da.custom;
			var daLabel = this.su.getActionLabel(da);
			var daDis = this._daForceDisable || !fo.enabled || !da.enabled;
			this.appendTreeCell(daRow, "label", daLabel);
			this.appendTreeCell(daRow, "label", this.getActionCode(da.action, daCustom));
			var daLinkedFile = this.getActionCode._hasLinkedFile;
			var daFileData = this.getActionCode._hasFileData;
			this.appendTreeCell(daRow, "label", this.getArguments(da.arguments || {}, this._localizeArgs));
			this.appendTreeCell(daRow, "label", (daInitCode = this.getInitCode(da, true)));
			if(this.getActionCode._hasLinkedFile)
				daLinkedFile = true;
			if(this.getActionCode._hasFileData)
				daFileData = true;

			this.setChildNodesProperties(daRow, {
				hc_delayed: true,
				hc_enabled: !daDis,
				hc_disabled: daDis,
				hc_buggy: this.isBuggyFuncObj(da, daCustom, daLabel, daStr) && ++this.counters.buggy,
				hc_notAvailable: extNA,
				hc_custom: daCustom,
				hc_customFile: daLinkedFile,
				hc_customInit: !!daInitCode,
				hc_customType: isCustomType
			}, true);

			this.setNodeProperties(
				this.appendTreeCell(daRow, "value", da.enabled),
				{ hc_checkbox: true }
			);

			if(this._import) {
				if(!drawRemoved) {
					var savedDa = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
					var overrideDa = savedDa;
					var equalsDa = this.settingsEquals(da, savedDa);
				}
				this.setChildNodesProperties(daRow, {
					hc_override: !drawRemoved &&  overrideDa && !equalsDa && ++this.counters.overrideDa,
					hc_equals:   !drawRemoved &&  overrideDa &&  equalsDa,
					hc_new:      !drawRemoved && !overrideDa &&              ++this.counters.addedDa,
					hc_old:      drawRemoved,
					hc_fileData: daFileData
				}, true);
				drawRemoved && daItem.setAttribute("hc_old", "child");
			}

			daItem.__shortcut = shortcut;
			daItem.__itemType = itemType;
			daItem.__isCustomType = isCustomType;
			daItem.__isDelayed = true;
			daItem.__isRemoved = drawRemoved;

			this.rowsCache[daItem.__hash = shortcut + "-" + itemType + "-delayed"] = daRow; // Uses for search
		}

		this.setNodeProperties(
			this.appendTreeCell(tRow, "value", fo.enabled),
			{ hc_checkbox: true }
		);

		var isBuggy = this.isBuggyFuncObj(fo, isCustom, actLabel, foStr)
			|| (
				isCustomType && !this.ps.isOkCustomType(itemType, this._drawRemoved && this._savedTypes)
				|| this.ut.isBuggyStr(typeLabel)
			);

		this.setChildNodesProperties(tRow, {
			hc_enabled: fo.enabled,
			hc_disabled: !fo.enabled,
			hc_buggy: isBuggy && ++this.counters.buggy,
			hc_notAvailable: extNA,
			hc_custom: isCustom,
			hc_customFile: linkedFile,
			hc_customInit: !!initCode,
			hc_customType: isCustomType
		}, true);
		if(this._import) {
			var saved = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType);

			// Ignore delayed actions:
			if(savedDa)
				saved.delayedAction = null;
			if(da)
				fo.delayedAction = null;

			if(!drawRemoved) {
				var override = saved;
				var equals = this.settingsEquals(fo, saved);
				if(isCustomType) {
					var newType = this.ut.getOwnProperty(this.ps.types, itemType);
					var savedType = this.ut.getOwnProperty(this._savedTypes, itemType);
					var eqType = this.settingsEquals(newType, savedType);
					if(!eqType && (saved || savedType))
						override = true;
					equals = equals && eqType;
				}
			}
			this.setChildNodesProperties(tRow, {
				hc_override: !drawRemoved &&  override && !equals && ++this.counters.override,
				hc_equals:   !drawRemoved &&  override &&  equals,
				hc_new:      !drawRemoved && !override            && ++this.counters.added,
				hc_old:      drawRemoved,
				hc_fileData: fileData
			}, true);
			drawRemoved && tItem.setAttribute("hc_old", "item");

			// Restore...
			if(savedDa)
				saved.delayedAction = savedDa;
			if(da)
				fo.delayedAction = da;
		}

		tItem.__shortcut = shortcut;
		tItem.__itemType = itemType;
		tItem.__isCustomType = isCustomType;
		tItem.__isDelayed = false;
		tItem.__isRemoved = drawRemoved;
		tItem.__delayed = da && daItem;
		tItem.__sortLabel = label;

		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);

		this.rowsCache[tItem.__hash = shortcut + "-" + itemType] = tRow;
		return tItem;
	},
	getTypeLabel: function(type, isCustomType) {
		return this.ps.getTypeLabel(type, isCustomType, this._drawRemoved && this._savedTypes);
	},
	getActionCode: function getActionCode(action, isCustom) {
		getActionCode._hasLinkedFile = getActionCode._hasFileData = false;
		if(!isCustom)
			return action;
		var path = this.ps.getSourcePath(action);
		if(path) {
			getActionCode._hasLinkedFile = true;
			var hasData = getActionCode._hasFileData = this._import
				&& path in this.ps.files
				&& this.ps.isValidFileData(this.ps.files[path]);
			return this.getLocalized("customFile" + (hasData ? "WithData" : "")) + " " + path;
		}
		return this.getLocalized("customFunction")
			+ (this.oldTree ? " " : " \n")
			+ this.cropCode(action || "");
	},
	getInitCode: function(fo) {
		var init = this.ut.getOwnProperty(fo, "init");
		return init
			? this.getActionCode(init, true)
			: "";
	},
	cropCode: function(code) {
		var maxLen = this._maxCodeLength;
		if(!maxLen)
			return code;
		if(code.length <= (maxLen + this._preserveLines))
			return code;
		var cropped = code.substr(0, maxLen);
		if(
			!/[\r\n]/.test(code.substr(maxLen - 1, 2)) // Already used entire line?
			&& /^[^\n\r]+/.test(code.substr(maxLen))
			&& RegExp.lastMatch.length <= this._preserveLines
		)
			cropped += RegExp.lastMatch;
		else
			cropped = cropped.replace(/\s+$/, "");
		return cropped + "\n[\u2026]"; // "[...]"
	},
	isBuggyFuncObj: function(fo, isCustom, label, foStr) {
		if(!this.ps.isOkFuncObj(fo)) {
			this.ut._warn(
				"Buggy function object for " + foStr + ":\n"
				+ this.ps.JSON.stringify(fo, null, "\t")
			);
			return true;
		}
		return !isCustom && this.ut.isBuggyStr(label);
	},
	extPackages: {
		ext_mulipletabs: "multipletab",
		__proto__: null
	},
	extTypeNotAvailable: function(type) {
		if(!this.ps.isExtType(type))
			return false;
		if(!(type in this.extPackages)) {
			this.ut._warn('Unknown extension: "' + type + '"');
			return true;
		}
		return !this.ut.packageAvailable(this.extPackages[type]);
	},
	settingsEquals: function(savedObj, newObj) {
		if(!this.ps.settingsEquals(savedObj, newObj))
			return false;
		if(!this._importFilesData)
			return true;
		for(var key in savedObj) if(savedObj.hasOwnProperty(key)) if(key in this.ps.codeKeys) {
			if( // Will ignore saved files, that will be unchanged
				newObj.hasOwnProperty(key)
				&& savedObj[key] == newObj[key]
				&& !this.fileDataEquals(savedObj[key])
			)
				return false;
		}
		for(var key in newObj) if(newObj.hasOwnProperty(key)) if(key in this.ps.codeKeys) {
			if(
				!savedObj.hasOwnProperty(key)
				&& this.getFileData(newObj[key])
			) // Will be imported new file
				return false;
		}
		return true;
	},
	setNodeProperties: function(node, propsObj) {
		// Optimize: use prefixes and add space after each property
		var propsVal = node.getAttribute("properties") || "";
		var changed = false;
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			var add = !!propsObj[p];
			p += " ";
			var indx = propsVal.indexOf(p);
			if(add) {
				if(indx == -1) {
					propsVal += p;
					changed = true;
				}
			}
			else if(indx != -1) {
				propsVal = propsVal.substr(0, indx) + propsVal.substr(indx + p.length);
				changed = true;
			}
		}
		changed && node.setAttribute("properties", propsVal);
	},
	setChildNodesProperties: function(parent, propsObj, addToParent) {
		if(addToParent)
			this.setNodeProperties(parent, propsObj);
		Array.prototype.forEach.call(
			parent.getElementsByTagName("*"),
			function(elt) {
				this.setNodeProperties(elt, propsObj);
			},
			this
		);
	},
	setNodesProperties: function(parents, propsObj, addToParent) {
		Array.prototype.forEach.call(
			parents,
			function(parent) {
				this.setChildNodesProperties(parent, propsObj, addToParent);
			},
			this
		);
	},
	appendTreeCell: function(parent, attrName, attrValue) {
		var cell = document.createElement("treecell");
		attrName && cell.setAttribute(attrName, attrValue);
		return parent.appendChild(cell);
	},
	get oldTree() {
		delete this.oldTree;
		return this.oldTree = this.ut.fxVersion <= 2;
	},
	getArguments: function(argsObj, localize) {
		var res = [];
		for(var p in argsObj) if(argsObj.hasOwnProperty(p)) {
			res.push(
				localize
					? this.getLocalizedArguments(argsObj, p)
					: this.getRawArguments(argsObj, p)
			)
		}
		return res.join(this.oldTree ? ", " : ", \n");
	},
	getLocalizedArguments: function(argsObj, p) {
		var argVal = argsObj[p];
		return typeof argVal == "boolean"
			? this.getLocalized(p) + ": " + this.getLocalized(argVal ? "yes" : "no")
			: this.getLocalized(p) + " " + this.getLocalized(p + "[" + argVal + "]");
	},
	getRawArguments: function(argsObj, p) {
		return p + " = " + uneval(argsObj[p]);
	},
	updTreeButtons: function() {
		var noSel = !this.hasSelectedItem;
		[
			"delete", "edit", "toggle",
			"partialExportToFile", "partialExportToClipboard",
			"exportToURI", "exportToHTML"
		].forEach(function(id) {
			this.$("hc-sets-cmd-" + id).setAttribute("disabled", noSel);
		}, this);
	},
	getSelectedItems: function(opts) {
		var rngCount = this.tSel.getRangeCount();
		var tItems = [];
		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				var tItem = this.getItemAtIndex(j);
				if(!tItem || !("__shortcut" in tItem))
					continue;
				if(tItem.__isRemoved && !(opts && opts.withRemoved || false))
					continue;
				if(opts && opts.checkHasSelected || false)
					return [tItem];
				if(opts && opts.onlyCustomTypes && !tItem.__isCustomType)
					continue;
				if( // Don't add delayed action item, if main item is selected
					opts && opts.noDelayed
					&& tItem.__isDelayed
					&& tItems.length
					&& tItems[tItems.length - 1] == tItem.parentNode.parentNode
				)
					continue;
				tItem.__index = j;
				tItems.push(tItem);
			}
		}
		return tItems;
	},
	get hasSelectedItem() {
		return this.getSelectedItems({ checkHasSelected: true }).length > 0;
	},
	get selectedItems() {
		return this.getSelectedItems();
	},
	get selectedItemsNoDelayed() {
		return this.getSelectedItems({ noDelayed: true });
	},
	get selectedItemsWithCustomTypes() {
		return this.getSelectedItems({ onlyCustomTypes: true });
	},
	getItemAtIndex: function(indx) {
		if(indx == -1 || indx >= this.tView.rowCount)
			return null;
		return this.tView.getItemAtIndex(indx); // <treeitem>
	},
	getRowForItem: function(tItem) {
		for(var ch = tItem.firstChild; ch; ch = ch.nextSibling)
			if(ch.localName == "treerow")
				return ch;
		return null;
	},

	get isTreePaneSelected() {
		var prefWin = document.documentElement;
		return prefWin.currentPane == prefWin.preferencePanes[0];
	},
	selectTreePane: function() {
		var prefWin = document.documentElement;
		prefWin.showPane(prefWin.preferencePanes[0]);
	},
	switchPanes: function(nextFlag) {
		var prefWin = document.documentElement;
		var panes = prefWin.preferencePanes;
		var pCount = panes.length;
		var n = Array.prototype.indexOf.call(panes, prefWin.currentPane) + (nextFlag ? 1 : -1);
		if(n >= pCount) n = 0;
		else if(n < 0)  n = pCount - 1;
		prefWin.showPane(panes[n]);
	},

	addItems: function(e) {
		if(!this.isTreePaneSelected)
			return;
		if(e) {
			if(e.type == "command" || e.button > 0)
				this.openEditorWindow({ __shortcut: this.ps.getEvtStr(e) }, this.ct.EDITOR_MODE_SHORTCUT, true);
			return;
		}
		var its = this.getSelectedItems({ withRemoved: true });
		if(its.length == 1) {
			this.openEditorWindow(its[0], this.ct.EDITOR_MODE_SHORTCUT, true);
			return;
		}
		this.openEditorWindow();
	},
	editItems: function(e, forceEditSaved) {
		if(e && !this.isClickOnRow(e)) {
			this.addItems();
			return;
		}
		if(e && e.type == "dblclick" && (e.button != 0 || this.isClickOnContainer(e)))
			return;
		if(!this.isTreePaneSelected)
			return;
		var its = this.getSelectedItems({
			noDelayed: true,
			withRemoved: forceEditSaved
		});
		if(this.editorsLimit(its.length))
			return;
		var src = forceEditSaved ? null : undefined;
		its.forEach(function(it) {
			this.openEditorWindow(it, this.ct.EDITOR_MODE_SHORTCUT, false, src);
		}, this);
	},
	editButtonClick: function(e) {
		var btn = e.button;
		if(btn == 0)
			return;
		var hasModifier = this.hasModifier(e);
		var cmdId = btn == 1
			? "hc-sets-cmd-editSaved"
			: btn == 2 && hasModifier
				? "hc-sets-cmd-editSavedType"
				: "hc-sets-cmd-editType";
		var cmd = this.$(cmdId);
		if(cmd.getAttribute("disabled") != "true")
			cmd.doCommand();
	},
	editItemsTypes: function(forceEditSaved) {
		if(!this.isTreePaneSelected)
			return;
		var cIts = this.getSelectedItems({
			onlyCustomTypes: true,
			withRemoved: forceEditSaved
		});
		if(this.editorsLimit(cIts.length))
			return;
		var src = forceEditSaved ? null : undefined;
		var types = { __proto__: null };
		cIts.forEach(function(it) {
			var type = it.__itemType;
			if(type in types)
				return;
			types[type] = true;
			this.openEditorWindow(it, this.ct.EDITOR_MODE_TYPE, false, src);
		}, this);
	},
	closeItemEditors: function(otherSrc, getCanClose) {
		return this.closeEditors(this.ct.EDITOR_MODE_SHORTCUT, otherSrc, getCanClose);
	},
	closeItemTypeEditors: function(otherSrc, getCanClose) {
		return this.closeEditors(this.ct.EDITOR_MODE_TYPE, otherSrc, getCanClose);
	},
	closeEditors: function(mode, otherSrc, getCanClose) {
		if(!this.isTreePaneSelected)
			return 0;
		var winIds = { __proto__: null };
		if(otherSrc === undefined)
			otherSrc = this.ps.otherSrc;
		var selectedItems = mode == this.ct.EDITOR_MODE_SHORTCUT
			? this.selectedItems
			: this.selectedItemsWithCustomTypes;
		selectedItems.forEach(function(it) {
			var winId = mode == this.ct.EDITOR_MODE_SHORTCUT
				? this.wu.getWinId(otherSrc, this.ct.EDITOR_MODE_SHORTCUT, it.__shortcut, it.__itemType, it.__isDelayed)
				: this.wu.getWinId(otherSrc, this.ct.EDITOR_MODE_TYPE,     undefined,     it.__itemType, undefined);
			winIds[winId] = true;
		}, this);
		var wins = this.wu.getEditorsById(winIds);
		if(getCanClose)
			return wins.length;
		wins.forEach(function(win) {
			win.document.documentElement.cancelDialog();
		});
		return wins.length;
	},
	editorsLimit: function(count) {
		const limPref = "sets.openEditorsLimit";
		var lim = this.pu.get(limPref);
		if(lim <= 0 || count <= lim)
			return false;
		//this.ut.ensureNotMinimized();
		var dontAsk = { value: false };
		var ok = this.ut.promptsSvc.confirmCheck(
			window,
			this.getLocalized("warningTitle"),
			this.getLocalized("openEditorsWarning").replace("%n", count),
			this.getLocalized("dontAskAgain"),
			dontAsk
		);
		if(!ok)
			return true;
		if(dontAsk.value)
			this.pu.set(limPref, 0);
		return false;
	},
	isClickOnRow: function(e) {
		var row = {}, col = {}, cell = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, cell);
		return row.value > -1;
	},
	isClickOnContainer: function(e) {
		var row = {}, col = {}, cell = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, cell);
		return row.value > -1 && this.tView.isContainer(row.value);
	},
	getItemsInfo: function(tIts) {
		tIts = tIts ? tIts.slice() : this.selectedItemsNoDelayed;
		var itsCount = tIts.length;
		if(!itsCount)
			return [];

		const MAX_TYPE_LENGTH = 40;
		const MAX_LABEL_LENGTH = 50;
		const MAX_ROWS = 12;

		if(itsCount > MAX_ROWS)
			tIts.splice(MAX_ROWS - 2, itsCount - MAX_ROWS + 1, "\u2026" /* "..." */);
		var info = tIts.map(function(tItem, i) {
			if(typeof tItem == "string") // Cropped mark
				return tItem;
			var type = tItem.__itemType, sh = tItem.__shortcut;
			var mdfs = this.ps.getModifiersStr(sh);
			var button = this.ps.getButtonStr(sh, true);
			var sep = this.ps.spacedSep;
			var typeLabel = this.cropStr(this.ps.getTypeLabel(type), MAX_TYPE_LENGTH);
			var fObj = this.ut.getOwnProperty(this.ps.prefs, sh, type);
			var dObj = this.ut.getOwnProperty(fObj, "delayedAction");
			var addLabel = "";
			if(tItem.__isDelayed) {
				typeLabel += " (" + this.getLocalized("delayed") + ")";
				fObj = dObj;
			}
			else {
				var daLabel = this.ut.isObject(dObj) && this.su.getActionLabel(fObj);
				if(daLabel) {
					addLabel = "\n\t(" + this.getLocalized("delayed") + ": "
						+ this.cropStr(daLabel, MAX_LABEL_LENGTH) + ")";
				}
			}
			var label = this.ut.isObject(fObj)
				? this.cropStr(this.su.getActionLabel(fObj), MAX_LABEL_LENGTH)
				: "?";
			var n = i + 1;
			if(n == MAX_ROWS)
				n = itsCount;
			return n + ". " + mdfs + sep + button + sep + typeLabel + " \u21d2 " /* "=>" */
				+ label + addLabel;
		}, this);

		return info;
	},
	cropStr: function(str, maxLen) {
		return str.length > maxLen
			? str.substr(0, maxLen - 1) + "\u2026" /* "..." */
			: str;
	},
	deleteItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var tIts = this.selectedItemsNoDelayed;
		if(
			!tIts.length
			|| !this.ut.confirm(
				this.getLocalized("title"),
				this.getLocalized("deleteConfirm").replace("%n", tIts.length)
					+ "\n\n" + this.getItemsInfo(tIts).join("\n")
			)
		)
			return;

		// Get next deletable item
		for(var indx = tIts[tIts.length - 1].__index + 1, nextItem; (nextItem = this.getItemAtIndex(indx)); ++indx)
			if("__shortcut" in nextItem && !nextItem.__isDelayed)
				break;

		var fvr = this.tbo.getFirstVisibleRow();
		var lvr = this.tbo.getLastVisibleRow();

		this.treeBatch(function() {
			tIts.forEach(this.deleteItem, this);
		});

		this.checkTreeSaved();
		if(this.instantApply)
			this.saveSettingsObjectsCheck(true);
		else {
			this.ps.otherSrc && this.pe.reloadSettings(true /* reloadAll */);
			this.setDialogButtons();
		}

		var hasRemoved = this._import && !this._importPartial;
		var foundRemoved;
		if(hasRemoved) tIts.forEach(function(tItem) {
			if(!(tItem.__hash in this.rowsCache))
				return;
			var newItem = this.rowsCache[tItem.__hash].parentNode;
			var indx = this.tView.getIndexOfItem(newItem);
			if(indx != -1) {
				foundRemoved = true;
				this.tSel.rangedSelect(indx, indx, true);
			}
		}, this);
		if(!foundRemoved) {
			if(hasRemoved && nextItem && nextItem.__hash in this.rowsCache)
				nextItem = this.rowsCache[nextItem.__hash].parentNode;
			var indx = nextItem
				? this.tView.getIndexOfItem(nextItem)
				: this.tView.rowCount - 1;
			if(indx != -1)
				this.tSel.rangedSelect(indx, indx, true);
		}

		this.searchInSetsTree(true);
		this.restoreScroll(fvr, lvr);
	},
	deleteItem: function(tItem, indx) {
		var sh = tItem.__shortcut;
		var type = tItem.__itemType;
		if(!sh || !type)
			return;
		var p = this.ps.prefs;
		var so = p[sh];
		if(tItem.__isDelayed) { // Remove delayed action
			var to = so[type];
			delete to.delayedAction;

			this.deleteCachedRow(tItem.__hash);

			var tChld = tItem.parentNode;
			tItem = tChld.parentNode;
			tItem.removeChild(tChld);
			tItem.removeAttribute("container");
		}
		else {
			delete so[type];
			if(this.ut.isEmptyObj(so))
				delete p[sh];

			this.removeTreeitem(tItem);
		}
		if(indx === undefined)
			this.searchInSetsTree(true);
	},
	removeTreeitem: function(tItem) {
		for(;; tItem = tChld.parentNode) {
			var tChld = tItem.parentNode;
			tChld.removeChild(tItem);

			this.deleteCachedRow(tItem.__hash);
			if(tItem.__delayed)
				this.deleteCachedRow(tItem.__delayed.__hash);

			if(tChld == this.tBody || tChld.hasChildNodes())
				break;
		}
	},
	deleteCachedRow: function(hash) {
		var tRow = this.rowsCache[hash];
		if(tRow && /(?:^|\s)hc_buggy(?:\s|$)/.test(tRow.getAttribute("properties")))
			--this.counters.buggy;
		delete this.rowsCache[hash];
	},
	hideTreeitem: function(tItem, markAsOld) {
		for(;; tItem = tChld.parentNode) {
			var tChld = tItem.parentNode;
			tItem.hidden = true;
			markAsOld && !tItem.hasAttribute("hc_old") && tItem.setAttribute("hc_old", "container");
			if(tChld == this.tBody || this.hasVisibleChild(tChld))
				break;
		}
	},
	showTreeitem: function(tItem) {
		for(;; tItem = tChld.parentNode) {
			var tChld = tItem.parentNode;
			tItem.hidden = false;
			if(tChld == this.tBody)
				break;
		}
	},
	hasVisibleChild: function(node) {
		return Array.prototype.some.call(node.childNodes, function(ch) {
			return !ch.hidden;
		});
	},
	openEditorWindow: function(tItem, mode, add, src) { // mode: this.ct.EDITOR_MODE_*
		var shortcut = tItem
			? tItem.__shortcut
			: undefined;
		var itemType = tItem && add !== true
			? tItem.__itemType
			: undefined;
		var isDelayed = tItem && add !== true && tItem.__isDelayed;
		if(src === undefined)
			src = this.ps.currentOtherSrc;
		this.wu.openEditor(src, mode || this.ct.EDITOR_MODE_SHORTCUT, shortcut, itemType, isDelayed);
	},
	setItemStatus: function() {
		return this.treeBatch(this._setItemStatus, this, arguments);
	},
	_setItemStatus: function(rowId, editStat) {
		if(!rowId)
			return;
		rowId = this.ut.removePostfix(rowId, this.ct.OTHER_SRC_POSTFIX);
		if(!(rowId in this.rowsCache))
			return;
		this.setChildNodesProperties(
			this.rowsCache[rowId].parentNode, // <treeitem>
			{ hc_edited: editStat }
		);
	},
	ensureStatusSearchUpdated: function() {
		if(this.searchField.value.indexOf(this.searchPlaceholders.hc_edited) != -1)
			this.searchInSetsTree(true);
	},
	treeClick: function _tc(e) {
		var row = {}, col = {}, cell = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, cell);
		if(e.type == "mousedown") {
			_tc.row = row.value;
			_tc.col = col.value;
			return;
		}
		if(row.value == _tc.row) {
			if(e.button == 0 && col.value == _tc.col)
				this.toggleEnabled(e);
			else if(e.button == 1)
				this.editItems(e);
		}
		_tc.row = _tc.col = null;
	},
	toggleEnabled: function(e, forcedEnabled) { //~ todo: test!
		if(e) { // Click on checkbox cell
			var row = {}, col = {}, cell = {};
			this.tbo.getCellAt(e.clientX, e.clientY, row, col, cell);
			var rowIndx = row.value;
			var column = col.value;
			if(rowIndx == -1 || column == null)
				return;
			var checked = this.tView.getCellValue(rowIndx, column);
			if(!checked) // real checked is "true" or "false"
				return;
			var tItem = this.getItemAtIndex(rowIndx);
			if(!tItem || tItem.__isRemoved)
				return;
			this.toggleItemEnabled(tItem);
		}
		else { // Space button pressed
			var fe = document.commandDispatcher.focusedElement;
			if(!fe || fe.localName != "tree")
				return;
			var its = this.selectedItems;
			if(!its.length)
				return;
			its.forEach(function(tItem) {
				this.toggleItemEnabled(tItem, forcedEnabled);
			}, this);
		}
		function callback() {
			this.checkTreeSaved();
			this.setDialogButtons();
			this.updTreeButtons();
		}
		this.ps.otherSrc && this.pe.reloadSettings(true /* applyFlag */);
		if(this.instantApply && !this.ps.otherSrc)
			this.saveSettingsObjectsCheck(true, callback, this);
		else
			callback.call(this);
	},
	toggleItemEnabled: function(tItem, forcedEnabled) {
		var tRow = this.getRowForItem(tItem);
		var enabled = this.checkedState(tItem, forcedEnabled === undefined ? null : forcedEnabled);
		var forcedDisDa = this.pu.get("delayedActionTimeout") <= 0;
		if(tItem.__isDelayed) {
			var pDis = !this.checkedState(tItem.parentNode.parentNode); // Check state of parent
			this.setNodeProperties(tRow, { hc_unsavedDisabled: forcedDisDa || pDis || !enabled });
		}
		else {
			this.setNodeProperties(tRow, { hc_unsavedDisabled: !enabled });
			if(tItem.__delayed) {
				var cRow = this.getRowForItem(tItem.__delayed);
				var cDis = !this.checkedState(tItem.__delayed);
				this.setNodeProperties(cRow, { hc_unsavedDisabled: forcedDisDa || cDis || !enabled });
			}
		}
		var so = this.ps.prefs[tItem.__shortcut][tItem.__itemType];
		if(tItem.__isDelayed)
			so.delayedAction.enabled = enabled;
		else
			so.enabled = enabled;
	},
	checkedState: function(tItem, val) {
		var tRow = this.getRowForItem(tItem);
		var tCell = tRow.getElementsByAttribute("value", "*")[0];
		var enabled = tCell.getAttribute("value") == "true";
		if(val !== undefined) {
			enabled = val === null
				? !enabled // toggle
				: val;
			tCell.setAttribute("value", enabled);
		}
		return enabled;
	},

	initEditMenu: function(mp) {
		var rowCount = this.tView.rowCount;
		var cantCollapse = !rowCount || this.treeCollapsed;
		var cantExpand = !rowCount || this.treeExpanded;
		var found = this.searcher.count > 0;

		var selected = 0;
		var tSel = this.tSel;
		var rngCount = tSel.getRangeCount();
		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j)
				++selected;
		}

		this.$("hc-sets-tree-selectAll")      .setAttribute("disabled", !rowCount || selected == rowCount);
		this.$("hc-sets-tree-clearSelection") .setAttribute("disabled", !rowCount || selected == 0);
		this.$("hc-sets-tree-invertSelection").setAttribute("disabled", !rowCount);

		this.$("hc-sets-tree-collapse")       .setAttribute("disabled", cantCollapse);
		this.$("hc-sets-tree-collapseLevel")  .setAttribute("disabled", cantCollapse);
		this.$("hc-sets-tree-expandLevel")    .setAttribute("disabled", cantExpand);
		this.$("hc-sets-tree-expand")         .setAttribute("disabled", cantExpand);

		this.$("hc-sets-tree-find")           .setAttribute("disabled", !rowCount);
		this.$("hc-sets-tree-findNext")       .setAttribute("disabled", !found);
		this.$("hc-sets-tree-findPrev")       .setAttribute("disabled", !found);
		this.$("hc-sets-tree-findSelectAll")  .setAttribute("disabled", !found);

		this.$("hc-sets-tree-findFilter").setAttribute(
			"checked",
			this.$("hc-sets-tree-searchFilterMode").getAttribute("checked")
		);
	},
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.tSel.selectAll();
	},
	clearSelection: function() {
		if(this.isTreePaneSelected)
			this.tSel.clearSelection();
	},
	invertSelection: function() {
		if(!this.isTreePaneSelected)
			return;
		var tSel = this.tSel;
		try {
			tSel.invertSelection();
			return;
		}
		catch(e) {
			// NS_ERROR_NOT_IMPLEMENTED
		}
		var rngCount = tSel.getRangeCount();
		if(rngCount == 0) {
			tSel.selectAll();
			return;
		}
		var selectedRows = { __proto__: null };
		var start = {}, end = {};
		for(var t = 0; t < rngCount; ++t) {
			tSel.getRangeAt(t, start, end);
			for(var i = start.value; i <= end.value; ++i)
				selectedRows[i] = false;
		}
		this.treeBatch(function() {
			tSel.clearSelection();
			for(var i = 0, rowsCount = this.tView.rowCount; i < rowsCount; ++i)
				if(!(i in selectedRows))
					tSel.rangedSelect(i, i, true);
		});
	},
	smartSelect: function ss(e) {
		if(e.button == 1)
			return;
		if(
			(
				"mgPrefs" in window && e.button == mgPrefs.mousebutton // 3.0
				|| "mgGesturePrefs" in window && e.button == mgGesturePrefs.mousebutton // 3.1pre
			)
			&& "mgGestureRecognizer" in window && !mgGestureRecognizer.checkPrevent(e)
		)
			return; // Do nothing, if Mouse Gestures Redox 3.0+ is active ( http://mousegestures.org/ )

		if(ss._ignore || false)
			return;
		var row = this.tbo.getRowAt(e.clientX, e.clientY);
		var et = e.type;
		var lastHandledRow = this.ut.getOwnProperty(ss, "_lastHandledRow");
		if(row == -1)
			return;
		if(et == "mousedown") { // Start
			this.smartSelectStop();
			window.addEventListener("mouseup", this, true);
			ss._initialRow = row;
			ss._startY = e.screenY;
			return;
		}

		var bo = this.tBody.boxObject;
		var atTopEdge = e.screenY - bo.screenY <= 4;
		var atBottomEdge = bo.screenY + bo.height - e.screenY <= 4;
		if(row == lastHandledRow && !(atTopEdge || atBottomEdge))
			return;

		// mouseup or mousemove:
		var initialRow = this.ut.getOwnProperty(ss, "_initialRow");
		if(initialRow === undefined)
			return;
		if(et == "mousemove" && ss._startY != undefined && Math.abs(ss._startY - e.screenY) <= 4)
			return; // Just inaccurate click?
		ss._startY = undefined;

		if(row != initialRow || lastHandledRow != undefined)
			this.tSel.rangedSelect(initialRow, row, false);
		ss._lastHandledRow = row;

		if(et == "mouseup") {
			this.smartSelectStop();
			return;
		}
		// mousemove:
		var fvr = this.tbo.getFirstVisibleRow();
		var lvr = this.tbo.getLastVisibleRow();
		if(row <= fvr + 2 && (row < initialRow || atTopEdge))
			var visRow = row - (atTopEdge || row == fvr ? 1 : 2);
		else if(row >= lvr - 2 && (row > initialRow || atBottomEdge))
			var visRow = row + (atBottomEdge || row == lvr ? 1 : 2);
		else
			return;
		this.tbo.ensureRowIsVisible(visRow);
		ss._ignore = true;
		setTimeout(function() {
			ss._ignore = false;
		}, 60);
	},
	smartSelectStop: function() {
		var ss = this.smartSelect;
		ss._initialRow = ss._lastHandledRow = ss._startY = undefined;
		window.removeEventListener("mouseup", this, true);
	},

	initViewMenu: function(mp) {
		var tdm = this.pu.get("sets.treeDrawMode");
		if(tdm < 0 || tdm > 5) // see drawTree() and switch(drawMode) { ... }
			tdm = 0;
		var checkbox = mp.getElementsByAttribute("value", tdm);
		checkbox.length && checkbox[0].setAttribute("checked", "true");
		var closeMenu = this.pu.get("sets.closeTreeViewMenu") ? "auto" : "none";
		Array.prototype.forEach.call(
			mp.getElementsByTagName("menuitem"),
			function(mi) {
				mi.setAttribute("closemenu", closeMenu);
				if(mi.hasAttribute("hc_pref"))
					mi.setAttribute("checked", this.pu.get(mi.getAttribute("hc_pref")));
				else if(mi.hasAttribute("hc_treeAttr"))
					mi.setAttribute("checked", this.tree.getAttribute(mi.getAttribute("hc_treeAttr")) == "true");
			},
			this
		);
	},
	viewMenuCommand: function(e, popup) {
		var mi = e.target;
		if(mi.hasAttribute("value"))
			this.setDrawMode(mi.value);
		else if(mi.hasAttribute("hc_pref")) {
			var prefName = mi.getAttribute("hc_pref");
			this.pu.set(prefName, !this.pu.get(prefName)); // => prefsChanged()
		}
		else if(mi.hasAttribute("hc_treeAttr")) {
			var attrName = mi.getAttribute("hc_treeAttr");
			var tr = this.tree;
			tr.setAttribute(attrName, tr.getAttribute(attrName) != "true");
		}

		if(this.hasModifier(e))
			popup.hidePopup();
	},
	viewMenuClick: function(e, popup) {
		if(e.button == 0)
			return;
		if(e.button == 1) {
			var mi = e.target;
			mi.doCommand();
			mi.setAttribute("checked", mi.getAttribute("type") == "radio" || mi.getAttribute("checked") != "true");
			if(this.pu.get("sets.closeTreeViewMenu"))
				return;
		}
		popup.hidePopup();
	},
	setDrawMode: function(dm) {
		// <preference instantApply="true" ... /> is bad on slow devices (it saves prefs.js file)
		this.pu.set("sets.treeDrawMode", +dm); // => prefsChanged()
	},

	get treeContainers() {
		return this.tBody.getElementsByAttribute("container", "true");
	},
	toggleTreeContainers: function() {
		if(this.isTreePaneSelected)
			this.treeBatch(this._toggleTreeContainers, this, arguments);
	},
	_toggleTreeContainers: function(expand) {
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				ti.setAttribute("open", expand);
			}
		);
	},
	get maxExpandedLevel() {
		var expandedLevel = -1;
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				if(ti.getAttribute("open") != "true")
					return;
				var curIndx = this.tView.getIndexOfItem(ti);
				if(curIndx == -1)
					return;
				var curLevel = this.tView.getLevel(curIndx);
				if(curLevel > expandedLevel)
					expandedLevel = curLevel;
			},
			this
		);
		return expandedLevel;
	},
	get treeCollapsed() {
		return Array.prototype.every.call(
			this.tBody.childNodes,
			function(tItem) {
				return tItem.hidden
					|| tItem.getAttribute("container") != "true"
					|| tItem.getAttribute("open") != "true";
			}
		);
	},
	get treeExpanded() {
		return Array.prototype.every.call(
			this.treeContainers,
			function(tItem) {
				return this.isTreeitemHidden(tItem)
					|| tItem.getAttribute("open") == "true";
			},
			this
		);
	},
	changeTreeExpandLevel: function(levelDiff) {
		if(this.isTreePaneSelected)
			this.expandTreeLevel(this.maxExpandedLevel + levelDiff);
	},
	expandTreeLevel: function(level) {
		this.treeBatch(this._expandTreeLevel, this, arguments);
	},
	_expandTreeLevel: function(level) {
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				var curIndx = this.tView.getIndexOfItem(ti);
				if(curIndx == -1)
					return;
				var curLevel = this.tView.getLevel(curIndx);
				ti.setAttribute("open", curLevel <= level);
			},
			this
		);
	},
	isTreeitemHidden: function(tItem) {
		for(; tItem; tItem = tItem.parentNode.parentNode) {
			if(tItem.hidden)
				return true;
			if(tItem.parentNode == this.tBody)
				break;
		}
		return false;
	},
	inCollapsedTreeitem: function(tItem) {
		for(; (tItem = tItem.parentNode.parentNode); ) {
			if(tItem.getAttribute("container") == "true" && tItem.getAttribute("open") != "true")
				return true;
			if(tItem.parentNode == this.tBody)
				break;
		}
		return false;
	},
	ensureTreeitemVisible: function(tItem) {
		for(; (tItem = tItem.parentNode.parentNode); ) {
			if(tItem.getAttribute("container") == "true")
				tItem.setAttribute("open", "true");
			if(tItem.parentNode == this.tBody)
				break;
		}
	},

	treeHeaderClick: function(e) {
		if(e.button == 1)
			return this.toggleTreeContainers(this.treeCollapsed);
		if(this.hasModifier(e))
			return this.toggleTreeContainers(e.button == 2);
		return this.changeTreeExpandLevel(e.button == 2 ? 1 : -1);
	},

	isMenuButton: function(node) {
		// node.boxObject instanceof Components.interfaces.nsIMenuBoxObject
		return node.localName == "button" && node.getAttribute("type") == "menu";
	},
	isSiblingMenus: function(menu, menu2) {
		var p = menu.parentNode;
		var p2 = menu2.parentNode;
		return p == p2 || this.isBottomMenuPanel(p) && this.isBottomMenuPanel(p2);
	},
	isBottomMenuPanel: function(p) {
		return p.id == "hc-sets-tree-editPanel" || p.getAttribute("anonid") == "dlg-buttons";
	},
	_openMenuTimer: 0,
	openMenu: function(e) {
		if(this._openMenuTimer) {
			clearTimeout(this._openMenuTimer);
			this._openMenuTimer = 0;
		}
		var menu = e.originalTarget;
		if(!this.isMenuButton(menu))
			return;
		Array.prototype.concat.call(
			Array.prototype.slice.call(document.getElementsByTagName("*")),
			Array.prototype.slice.call(this.applyButton.parentNode.childNodes)
		).some(function(node) {
			if(this.isMenuButton(node) && node != menu && node.open) {
				var openMenu = function() {
					node.open = false;
					menu.open = true;
				};
				if(this.isSiblingMenus(node, menu))
					openMenu();
				else
					this._openMenuTimer = setTimeout(openMenu, this.pu.get("ui.openMenuDelay"));
				return true;
			}
			return false;
		}, this);
	},

	/*** Search in tree ***/
	focusSearch: function(dontSwitch) {
		if(!dontSwitch && !this.isTreePaneSelected)
			this.selectTreePane();
		var sf = this.searchField;
		sf.select();
		sf.focus();
	},
	focusSetsTree: function() {
		if(!this.isTreePaneSelected)
			this.selectTreePane();
		this.tree.focus();
	},
	get searchField() {
		delete this.searchField;
		return this.searchField = this.$("hc-sets-tree-searchField");
	},

	get searcher() {
		delete this.searcher;
		return this.searcher = handyClicksSetsSearcher;
	},
	initSearchMenu: function(mp) {
		var counters = { __proto__: null };
		var sp = this.searchPlaceholders;
		Array.prototype.forEach.call(
			this.tree.getElementsByTagName("treerow"),
			function(tRow) {
				var tItem = tRow.parentNode;
				if(tItem.hidden || tItem.parentNode.parentNode.hidden)
					return;
				var props = tRow.getAttribute("properties");
				props && props.split(/\s+/).forEach(function(prop) {
					if(!(prop in sp))
						return;
					var ph = sp[prop];
					counters[ph] = (counters[ph] || 0) + 1;
				});
			}
		);

		var val = this.searchField.value;
		var labelTemplate = mp.getAttribute("hc_labelTemplate");
		Array.prototype.forEach.call(mp.getElementsByTagName("menuitem"), function(mi) {
			var ph = mi.getAttribute("acceltext");
			if(!ph)
				return;
			mi.setAttribute("checked", val.indexOf(ph) != -1);
			if(ph == "%ovr%" || ph == "%new%" || ph == "%data%")
				mi.setAttribute("disabled", !this._import);
			else if(ph == "%old%")
				mi.setAttribute("disabled", !this._import || this._importPartial);
			var count = counters[ph];
			var origLabel = mi.__origLabel || (mi.__origLabel = mi.getAttribute("label"));
			var label = count
				? labelTemplate
					.replace("$label", origLabel)
					.replace("$count", count)
				: origLabel;
			if(label != mi.getAttribute("label"))
				mi.setAttribute("label", label);
		}, this);
	},
	insertSearchPlaceholder: function(mi) {
		var ph = mi.getAttribute("acceltext");
		if(!ph)
			return;
		var ifi = this.searchField.inputField;
		var val = ifi.value;
		var pos = val.indexOf(ph);
		var editor = ifi
			.QueryInterface(Components.interfaces.nsIDOMNSEditableElement)
			.editor
			.QueryInterface(Components.interfaces.nsIPlaintextEditor);
		if(pos != -1) {
			var posEnd = pos + ph.length;
			var before = val.substr(0, pos);
			var after = val.substr(posEnd);
			if(/^\s*$/.test(before)) { // "  %ph%  after"
				pos = 0;
				if(/^\s+/.test(after))
					posEnd += RegExp.lastMatch.length;
			}
			else if(/^\s*$/.test(after)) { // "before  %ph%  "
				posEnd = val.length;
				if(/\s+$/.test(before))
					pos -= RegExp.lastMatch.length;
			}
			else { // "before  %ph%  after"
				var beforeSp = /\s*$/.test(before) && RegExp.lastMatch.length;
				var afterSp = /^\s*/.test(after) && RegExp.lastMatch.length;
				if(beforeSp) {
					pos -= beforeSp - 1;
					posEnd += afterSp;
				}
				else if(afterSp) {
					posEnd += afterSp - 1;
				}
			}
			ifi.selectionStart = pos;
			ifi.selectionEnd = posEnd;
			editor.deleteSelection(0, 0);
		}
		else {
			// Check for selection inside placeholder
			var leftPh = /%[^%]*$/.test(val.substr(0, ifi.selectionStart)) && RegExp.lastMatch;
			var rightPh = /^[^%]*%+/.test(val.substr(ifi.selectionEnd)) && RegExp.lastMatch;
			if(leftPh && rightPh && /^[^%]*$/.test(val.substring(ifi.selectionStart, ifi.selectionEnd)))
				ifi.selectionStart = ifi.selectionEnd = ifi.selectionEnd + rightPh.length;

			if(/\S$/.test(val.substr(0, ifi.selectionStart)))
				ph = " " + ph;
			if(/^\S/.test(val.substr(ifi.selectionEnd)))
				ph += " ";
			editor.insertText(ph);
		}
		this.fireChange(this.searchField, "input");
		if(this.ut.fxVersion < 3.5)
			this.searchInSetsTree();
		ifi.focus();
	},
	navigateSearchResults: function(e) {
		var code = e.keyCode;
		if(code == e.DOM_VK_F1) {
			e.preventDefault();
			var tt = this.$("hc-sets-search-tooltip");
			var anchor = this.$("hc-sets-tree-searchContainer");
			// See chrome://global/content/xul.css: tooltip { margin-top: 21px; }
			var offset = -21 + this.su.TOOLTIP_OFFSET_DEFAULT;
			this.su.showTooltip(tt, anchor, this.su.TOOLTIP_HIDE_SLOW, offset);
			return;
		}
		this.delay(function() {
			this.$("hc-sets-search-tooltip").hidePopup();
		}, this);
		var enter = code == e.DOM_VK_RETURN;
		var up    = code == e.DOM_VK_UP;
		var down  = code == e.DOM_VK_DOWN;
		var nav = up || down;
		var c = e.ctrlKey;
		var s = e.shiftKey;
		var a = e.altKey || e.metaKey;

		if     (enter && a && !s || nav && a)  this.toggleFilterMode();   //        Alt+Enter,   Alt+(Up, Down)
		else if(enter && c && !s || nav && s)  this.searcher.selectAll(); //       Ctrl+Enter, Shift+(Up, Down)
		else if(enter && c && s || up   && c)  this.searcher.first();     // Ctrl+Shift+Enter, Ctrl+Up
		else if(enter && a && s || down && c)  this.searcher.last();      //  Alt+Shift+Enter, Ctrl+Down
		else if(enter &&  s     || up)         this.searcher.prev();      //      Shift+Enter,      Up
		else if(enter && !s     || down)       this.searcher.next();      //            Enter,      Down
		else if(code == e.DOM_VK_ESCAPE && e.target.value && e.target.type != "search") {
			// Firefox < 3.5
			e.target.value = "";
			this.searchInSetsTree();
		}
		else
			return;
		e.preventDefault(); // Don't close dialog window
	},
	toggleFilterMode: function() {
		if(!this.isTreePaneSelected)
			return;
		var fm = this.$("hc-sets-tree-searchFilterMode");
		if(fm.getAttribute("checked") != "true")
			fm.setAttribute("checked", "true");
		else
			fm.removeAttribute("checked");
		this.searchInSetsTree(true, true);
	},

	_searchDelay: 50,
	_searchTimer: 0,
	_lastSearch: 0,
	searchPlaceholders: {
		hc_override:     "%ovr%",
		hc_new:          "%new%",
		hc_old:          "%old%",
		hc_fileData:     "%data%",
		hc_custom:       "%custom%",
		hc_customFile:   "%file%",
		hc_customInit:   "%init%",
		hc_customType:   "%type%",
		hc_enabled:      "%on%",
		hc_disabled:     "%off%",
		hc_delayed:      "%delay%",
		hc_edited:       "%open%",
		hc_notAvailable: "%na%",
		hc_buggy:        "%bug%",
		__proto__: null
	},
	get searchReplacements() { // hc_foo: "internal string"
		delete this.searchReplacements;
		var sr = this.searchReplacements = { __proto__: null };
		var sp = this.searchPlaceholders;
		var i = 0;
		for(var p in sp) {
			// Will replace %foo% with not used in text symbols (to not find %foo% in code)
			var s = Array.prototype.map.call(
				(i++).toString(8),
				function(c) {
					return String.fromCharCode(c);
				}
			).join("");
			sr[p] = "\uffff" + s + "\uffff";
		}
		return sr;
	},
	get searchMap() { // "%foo%": "internal string"
		delete this.searchMap;
		var sm = this.searchMap = { __proto__: null };
		var sp = this.searchPlaceholders;
		var sr = this.searchReplacements;
		for(var p in sp)
			sm[sp[p]] = sr[p];
		return sm;
	},
	toggleSearch: function(str, dontSelect) {
		this.doSearch(this.searchField.value == str ? "" : str, dontSelect);
	},
	doSearch: function(str, dontSelect) {
		this.searchField.value = str;
		this.searchInSetsTree(dontSelect);
	},
	searchInSetsTree: function(dontSelect) {
		if(this._searchTimer)
			return;

		var remTime = this._lastSearch + this._searchDelay - Date.now();
		if(remTime > 0) {
			this._searchTimer = this.delay(function() {
				this._searchTimer = 0;
				this.searchInSetsTree.apply(this, arguments);
			}, this, remTime, arguments);
			return;
		}

		this.treeBatch(this._searchInSetsTree, this, arguments);
	},
	searchInSetsTreeDelay: function(dontSelect) {
		if(this._searchTimer)
			return;
		this._searchTimer = this.delay(function() {
			this._searchTimer = 0;
			this.searchInSetsTree(dontSelect);
		}, this);
	},
	_searchInSetsTree: function(dontSelect) {
		this.ut.timer("searchInSetsTree()");
		var sf = this.searchField;
		var filterMode = this.$("hc-sets-tree-searchFilterMode").getAttribute("checked") == "true";

		var sTerm = sf.value;
		var checkFunc;
		var caseSensitive = false;
		var hasTerm = true;

		if(sTerm.indexOf("%") != -1) {
			var sr = this.searchReplacements;
			var sm = this.searchMap;
			sTerm = sTerm.replace(/%[^%]+%/g, function(ph, offset, sTerm) {
				if(sTerm.charAt(offset - 1) == "%" && sTerm.charAt(offset + ph.length) == "%")
					return ph.slice(1, -1); // %%foo%% -> %foo%
				if(ph in sm)
					return sm[ph];
				if(ph == "%dis%") //= Added: 2018-12-20
					return sr.hc_disabled;
				return ph;
			});
		}

		if(/^\/(.+)\/(im?|mi?)?$/.test(sTerm)) { // /RegExp/flags
			try {
				sTerm = new RegExp(RegExp.$1, RegExp.$2);
				checkFunc = function(rowText) {
					return sTerm.test(rowText);
				};
				caseSensitive = true;
				sf.setAttribute("hc_queryType", "RegExp");
			}
			catch(e) {
			}
		}

		if(!checkFunc) {
			if(/^('|")(.*)\1$/.test(sTerm)) { // "whole string"
				sTerm = RegExp.$2;
				if(!sTerm)
					hasTerm = false;
				if(RegExp.$1 == '"')
					caseSensitive = true;
				else
					sTerm = sTerm.toLowerCase();
				checkFunc = function(rowText) {
					return rowText.indexOf(sTerm) != -1;
				};
				sf.setAttribute("hc_queryType", "wholeString");
			}
			else { // Threat spaces as "and" (default)
				sTerm = this.ut.trim(sTerm).toLowerCase();
				if(!sTerm)
					hasTerm = false;
				sTerm = sTerm.split(/\s+/);
				checkFunc = function(rowText) {
					return sTerm.every(function(s) {
						return rowText.indexOf(s) != -1;
					});
				};
				sf.setAttribute("hc_queryType", "spaceSeparated");
			}
		}

		if(!hasTerm)
			dontSelect = true;
		if(dontSelect)
			var selectedRows = this.getSelected();

		if(this._hasFilter) {
			var hidden = this.tBody.getElementsByAttribute("hidden", "true");
			for(var i = hidden.length - 1; i >= 0; --i) {
				var tItem = hidden[i];
				if(this._importPartial && tItem.hasAttribute("hc_old"))
					continue;
				tItem.hidden = false;
			}
		}
		var matchedRows = [];
		for(var h in this.rowsCache) {
			var tRow = this.rowsCache[h];
			var tItem = tRow.parentNode;
			if(this._importPartial && tItem.hasAttribute("hc_old"))
				continue;
			var okRow = !hasTerm || checkFunc(this.getRowText(tRow, caseSensitive));
			var hl = hasTerm && okRow;
			this.setChildNodesProperties(tRow, { hc_search: hl }, true);
			tItem.__matched = okRow;
			okRow && matchedRows.push(tRow);
		}
		var found = matchedRows.length > 0;

		if(hasTerm && filterMode) {
			this._hasFilter = true;
			for(var h in this.rowsCache) {
				tRow = this.rowsCache[h];
				var tItem = tRow.parentNode;
				if(tItem.__matched)
					continue;
				if(
					tItem.__isDelayed
						? tItem.parentNode.parentNode.__matched
						: tItem.__delayed && tItem.__delayed.__matched
				)
					continue;
				this.hideTreeitem(tItem);
			}
		}

		this.searcher.results = matchedRows.map(function(tRow) {
			return tRow.parentNode; // treeitem
		}, this);

		if(dontSelect)
			this.restoreSelection(selectedRows);
		else
			found && this.searcher.select();

		this.$("hc-sets-tree-searchResults").value = matchedRows.length;
		sf.setAttribute("hc_notFound", hasTerm && !found);

		this._lastSearch = Date.now();
		this.ut.timer("searchInSetsTree()");
	},
	getRowText: function(tRow, caseSensitive) {
		var tChld = tRow, tItem;
		var tBody = this.tBody;
		var rowText = [];
		do {
			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
			if(tItem.__isDelayed)
				tChld.parentNode.__tempIgnore = true;
			else if(tItem.__tempIgnore) {
				delete tItem.__tempIgnore;
				continue;
			}
			var row = this.getRowForItem(tItem);
			Array.prototype.forEach.call(
				row.getElementsByAttribute("label", "*"),
				function(elt) {
					var label = elt.getAttribute("label");
					label && rowText.push(label);
				},
				this
			);
			var sr = this.searchReplacements;
			var props = row.getAttribute("properties");
			props && props.split(/\s+/).forEach(function(prop) {
				if(prop in sr)
					rowText.push(sr[prop]);
			});
		}
		while(tChld != tBody);
		rowText = rowText.join("\n");
		return caseSensitive ? rowText : rowText.toLowerCase();
	},

	/*** Prefs pane ***/
	_updPrefsUITimeout: 0,
	prefsChanged: function(pName, pVal) {
		if(pName == "sets.treeDrawMode")
			this.redrawTree();
		else if(pName == "sets.treeExpandDelayedAction")
			this.updTree(false);
		else if(pName == "sets.localizeArguments")
			this.updTree();
		else if(pName == "sets.codeLengthLimit" || pName == "sets.codeLengthLimit.preserveLines")
			this.redrawTree();
		else if(this.ut.hasPrefix(pName, "editor.externalEditor")) {
			this.initExternalEditor();
			this.updateDependencies("externalEditor");
		}
		else if(this.warnMsgsPrefs.indexOf(pName) != -1)
			this.initResetWarnMsgs();
		else if(pName == "disallowMousemoveButtons") {
			this.setDisallowMousemove();
			this.updateDependencies("disallowMousemove");
		}
		else if(pName == "sets.lastSearchQuery") //~ obsolete
			this.restoreSearchQuery() && this.updTree();
		else if(this.ut.hasPrefix(pName, "ui.action"))
			this.loadUIAction();
		else {
			this.updateAllDependencies();
			clearTimeout(this._updPrefsUITimeout);
			this._updPrefsUITimeout = this.delay(this.setDialogButtons, this, 10);
		}
	},
	initPrefs: function() {
		this.setDisallowMousemove();
		this.initResetWarnMsgs();
		this.loadUIAction();
		this.updateAllDependencies();
		// This is relatively slow, will execute after small delay
		this.delay(this.initExternalEditor, this);
	},
	setDisallowMousemove: function() {
		var buttons = this.pu.get("disallowMousemoveButtons") || "";
		for(var i = 0; i <= 2; ++i)
			this.$("hc-sets-disallowMousemove-" + i).checked = buttons.indexOf(i) != -1;
	},
	get disallowMousemoveButtons() {
		var val = "";
		for(var i = 0; i <= 2; ++i)
			if(this.$("hc-sets-disallowMousemove-" + i).checked)
				val += i;
		return val;
	},
	get currentActionPref() {
		var typeStr = this.$("hc-sets-action-type").value;
		var buttonStr = this.$("hc-sets-action-button").value;
		return "ui.action" + typeStr + buttonStr + "Click";
	},
	get currentActionTextbox() {
		var type = this.$("hc-sets-action-type").selectedIndex;
		var button = this.$("hc-sets-action-button").selectedIndex;
		var tb = document.getElementsByAttribute("preference", "action-" + type + "-" + button);
		return tb.length ? tb[0] : null;
	},
	getControlByPrefName: function(prefName) {
		var pref = document.getElementsByAttribute("name", prefName)[0];
		return pref && document.getElementsByAttribute("preference", pref.id)[0];
	},
	loadUIAction: function() {
		var tb = this.currentActionTextbox;
		if(!tb)
			return;
		var prefName = this.currentActionPref;
		var ml = this.$("hc-sets-action-value");
		ml.value = tb.value || this.pu.get(prefName);

		var defaultBranch = this.pu.prefSvc.getDefaultBranch(this.pu.prefNS);
		var _this = this;
		function prefChanged(pName, tb) {
			return _this.pu.getPref(pName, undefined, defaultBranch) != tb.value;
		}
		this.$("hc-sets-action-reset").setAttribute("disabled", !prefChanged(prefName, tb));
		//ml.getElementsByAttribute("value", 2 /*ACTION_POPUP*/)[0]
		//	.setAttribute("disabled", prefName == "ui.actionMenuLeftClick");
		const ns = "ui.action";
		var hasChanged = this.pu.prefSvc.getBranch(this.pu.prefNS + ns)
			.getChildList("", {})
			.some(function(pName) {
				var tb = this.getControlByPrefName(this.pu.prefNS + ns + pName);
				return tb && prefChanged(ns + pName, tb);
			}, this);
		this.$("hc-sets-action-resetAll").setAttribute("disabled", !hasChanged);
	},
	changeUIAction: function() {
		var type = this.$("hc-sets-action-type").selectedIndex;
		var button = this.$("hc-sets-action-button").selectedIndex;
		var tb = this.currentActionTextbox;
		if(tb) {
			tb.value = this.$("hc-sets-action-value").value;
			this.fireChange(tb);
			this.loadUIAction();
		}
	},
	resetUIAction: function() {
		var tb = this.currentActionTextbox;
		if(!tb)
			return;
		var prefName = this.currentActionPref;
		var defaultBranch = this.pu.prefSvc.getDefaultBranch(this.pu.prefNS);
		var defaultVal = this.pu.getPref(prefName, undefined, defaultBranch);
		if(defaultVal !== undefined && defaultVal != tb.value) {
			tb.value = defaultVal;
			this.fireChange(tb);
			this.loadUIAction();
		}
	},
	resetAllUIActions: function() {
		var ns = this.pu.prefNS + "ui.action";
		var defaultBranch = this.pu.prefSvc.getDefaultBranch(ns);
		var changed = false;
		defaultBranch.getChildList("", {}).forEach(function(prefName) {
			var tb = this.getControlByPrefName(ns + prefName);
			if(!tb)
				return;
			var defaultVal = this.pu.getPref(prefName, undefined, defaultBranch);
			if(defaultVal !== undefined && defaultVal != tb.value) {
				changed = true;
				tb.value = defaultVal;
				this.fireChange(tb);
			}
		}, this);
		changed && this.loadUIAction();
	},
	saveSettings: function(applyFlag, forceSavePrefs) {
		this.pu.set("disallowMousemoveButtons", this.disallowMousemoveButtons);
		if(!this.instantApply) {
			if(applyFlag) {
				this.delay(function() {
					this.savePrefpanes();
					this.setDialogButtons();
				}, this);
			}
			else if(forceSavePrefs)
				this.savePrefpanes();
		}
		var saved = true;
		if(this.ps.otherSrc)
			this.pe.reloadSettings(applyFlag);
		else {
			saved = this.saveSettingsObjectsCheck(applyFlag, this.setDialogButtons, this);
			if(applyFlag) {
				this.applyButton.disabled = true; // Don't wait for callback
				return saved;
			}
		}
		this.setDialogButtons();
		if(!applyFlag && !this.checkImport())
			return false;
		return saved;
	},
	buggyPrefsConfirm: function() {
		if(!this.counters.buggy)
			return true;
		this.showBuggyPrefs();
		return this.ut.confirmEx(
			this.getLocalized("warningTitle"),
			this.getLocalized("buggyDetected").replace("%n", this.counters.buggy)
				+ "\n" + this.getLocalized("saveBuggyConfirm"),
			this.getLocalized("save")
		);
	},
	notifyBuggyPrefs: function() {
		this.notifyBuggyPrefs = function() {}; // Only once
		this.ut.notifyWarning(this.getLocalized("buggyDetected").replace("%n", this.counters.buggy), {
			buttons: {
				$show: this.showBuggyPrefs,
				$openConsole: this.ut.toErrorConsole
			},
			context: this
		});
	},
	showBuggyPrefs: function() {
		if(!this.isTreePaneSelected)
			this.selectTreePane();
		this.doSearch("%bug%");
	},
	saveSettingsObjectsCheck: function(applyFlag, callback, context) {
		if(!this.buggyPrefsConfirm())
			return false;
		if(applyFlag)
			this.pe.saveSettingsObjectsAsync(applyFlag, callback, context);
		else
			this.pe.saveSettingsObjects(applyFlag);
		//this.setDialogButtons();
		return true;
	},
	savePrefpanes: function() {
		Array.prototype.forEach.call(
			document.getElementsByTagName("prefpane"),
			function(pp) {
				pp.writePreferences(false /* aFlushToDisk */);
			}
		);
		this.pu.savePrefFile();
		//this.prefsSaved();
		//this.setDialogButtons();
	},
	reloadPrefpanes: function() {
		Array.prototype.forEach.call(
			document.getElementsByTagName("preference"),
			function(ps) {
				ps.value = ps.valueFromPreferences;
			}
		);
	},
	warnMsgsPrefs: [
		"sets.importJSWarning",
		"sets.openEditorsLimit",
		"sets.removeBackupConfirm",
		"ui.notifyUnsaved",
		"editor.unsavedSwitchWarning",
		"sets.incompleteImportWarning"
	],
	initResetWarnMsgs: function() {
		var changed = this.warnMsgsPrefs.filter(this.pu.prefChanged, this.pu);
		var notChanged = !changed.length;
		this.$("hc-sets-resetWarnMsgs").disabled = notChanged;
		if(notChanged)
			return;

		var tt = this.$("hc-sets-warnMsgsPrefs-tooltip");
		var ttSep = this.$("hc-sets-warnMsgsPrefs-tooltipSep");
		while(ttSep.nextSibling)
			tt.removeChild(ttSep.nextSibling);
		changed.forEach(function(pName, i) {
			if(i != 0) {
				var sep = ttSep.cloneNode(true);
				sep.removeAttribute("id");
				tt.appendChild(sep);
			}
			var desc = document.createElement("description");
			var text;
			switch(pName) {
				case "sets.importJSWarning":
					text = this.getLocalized("importSetsWarning");
				break;
				case "sets.openEditorsLimit":
					text = this.getLocalized("openEditorsWarning")
						.replace("%n", "N");
				break;
				case "sets.removeBackupConfirm":
					text = this.getLocalized("removeBackupConfirm")
						.replace("%f", this.ps.prefsFileName + ".js");
				break;
				case "ui.notifyUnsaved":
					text = this.getLocalized("notifyUnsaved");
				break;
				case "editor.unsavedSwitchWarning":
					text = this.getLocalized("editorUnsavedSwitchWarning");
				break;
				case "sets.incompleteImportWarning":
					text = this.getLocalized("importIncomplete");
				break;
				default:
					this.ut._warn('initResetWarnMsgs: no description for "' + pName + '" pref');
					text = pName;
			}
			desc.textContent = text;
			tt.appendChild(desc);
		}, this);
	},
	resetWarnMsgs: function() {
		this.warnMsgsPrefs.forEach(this.pu.resetPref, this.pu);
	},
	showWarnMsgsPrefs: function() {
		if(this.ut.fxVersion < 3)
			return;
		function escapeRegExp(str) {
			return str.replace(/[\\\/.^$+*?|()\[\]{}]/g, "\\$&");
		}
		var re = escapeRegExp(this.pu.prefNS)
			+ "(?:" + this.warnMsgsPrefs.map(escapeRegExp).join("|") + ")";
		this.pu.openAboutConfig("/" + re + "/");
	},
	get ee() {
		var ee = this.e("hc-sets-externalEditorPath");
		// Trick for Firefox 4+, first this.ee.value = "..." may clear undo buffer otherwise
		if("editor" in ee)
			ee.editor; // Ensure initialized
		delete this.ee;
		return this.ee = ee;
	},
	get eeFile() {
		var path = this.ee.value;
		if(!path || /^\w+$/.test(path))
			return null;
		return this.ut.getLocalFile(path);
	},
	get eeArgs() {
		var tb = this.e("hc-sets-externalEditorArgs");
		if("editor" in tb)
			tb.editor; // Ensure initialized
		delete this.eeArgs;
		return this.eeArgs = tb;
	},
	selectExternalEditor: function() {
		var ee = this.ee;
		var fp = this.ut.fp;
		fp.appendFilters(fp.filterApps);
		fp.appendFilters(fp.filterAll);
		var curDir = this.eeFile;
		if(curDir && curDir.exists()) {
			if(!curDir.isDirectory())
				curDir = this.ut.getFileParent(curDir);
			if(curDir)
				fp.displayDirectory = curDir;
		}
		fp.init(window, this.getLocalized("selectEditor"), fp.modeOpen);
		if(fp.show() != fp.returnOK)
			return;
		ee.value = fp.file.path;
		this.fireChange(ee);
	},
	getRelativePath: function(path) {
		path = path.replace(/^[a-z]:\\/, function(s) {
			return s.toUpperCase();
		});
		var file = this.ut.getLocalFileFromPath(path); // Normalize ..\..\ things
		if(!file)
			return undefined;
		path = file.path;

		var dirSep = this.ut.appInfo.OS == "WINNT" ? "\\" : "/";
		var aliases = {
			ProgF:        0,
			AppData:      0,
			LocalAppData: 0,
			ProfD:        3,
			CurProcD:     3,
			Home:         0,
			SysD:         0,
			WinD:         0,
			UsrApp:       0,
			LocApp:       0,
			Locl:         0,
			LibD:         0,
			hc_SysDrv:    0,
			hc_ProfDrv:   0,
			__proto__: null
		};
		for(var alias in aliases) {
			var maxLevel = aliases[alias];
			var aliasFile = this.ut.getFileByAlias(alias, true);
			for(var level = 0; aliasFile && level <= maxLevel; ++level) {
				var aliasPath = aliasFile.path;
				if(this.ut.hasPrefix(path, aliasPath + dirSep)) {
					return "%" + alias + "%"
						+ new Array(level + 1).join(dirSep + "..")
						+ path.substr(aliasPath.length);
				}
				aliasFile = this.ut.getFileParent(aliasFile);
			}
		}
		return undefined;
	},
	setRelativePath: function() {
		var ee = this.ee;
		var path = this.getRelativePath(ee.value);
		if(!path)
			return;
		ee.value = path;
		this.fireChange(ee);
	},
	setNormalPath: function() {
		var file = this.eeFile;
		if(!file)
			return;
		var ee = this.ee;
		ee.value = file.path;
		this.fireChange(ee);
	},
	convertPath: function() {
		if(/^%[^%]+%/.test(this.ee.value))
			this.setNormalPath();
		else
			this.setRelativePath();
	},
	externalEditorChanged: function eec(delayed) {
		if(delayed) {
			this.delay(eec, this, 5);
			return;
		}
		this.initExternalEditor(true);
	},
	initExternalEditor: function(changed) {
		var eeFile = this.eeFile;
		var img = this.$("hc-sets-externalEditorIcon");
		if(eeFile && eeFile.exists()) {
			img.src = "moz-icon:file://" + eeFile.path.replace(/\\/g, "/") + "?size=16";
			img.setAttribute("hc_existingPath", "true");
		}
		else if(this.ee.value == "Scratchpad") {
			img.src = this.ut.isSeaMonkey ? "" : "chrome://branding/content/icon16.png";
			img.setAttribute("hc_existingPath", "false");
		}
		else {
			img.src = "";
			img.setAttribute("hc_existingPath", "false");
		}
		var isRelative = /^%[^%]+%/.test(this.ee.value);
		this.$("hc-sets-externalEditorButtonDeck").selectedIndex = isRelative ? 1 : 0;
		img.removeAttribute("tooltiptext");
		var tt = "";
		if(
			eeFile
			&& "nsILocalFileWin" in Components.interfaces
			&& eeFile instanceof Components.interfaces.nsILocalFileWin
		) {
			var getVI = function(f) {
				try { return eeFile.getVersionInfoField(f) || ""; }
				catch(e) { return ""; }
			};
			tt = getVI("FileDescription") || eeFile.leafName || "";
			changed && this.setDefaultArgs(getVI("ProductName"));
		}
		else if(
			eeFile
			&& "nsILocalFileMac" in Components.interfaces
			&& eeFile instanceof Components.interfaces.nsILocalFileMac
		) {
			try { tt = eeFile.bundleDisplayName; }
			catch(e) {}
		}
		else if(eeFile) {
			tt = eeFile.leafName;
		}
		if(isRelative && eeFile)
			tt += (tt ? "\n" : "") + eeFile.path;
		this.attribute(img, "tooltiptext", tt);
	},
	_prevApp: null,
	setDefaultArgs: function(app) {
		if(app == this._prevApp)
			return;
		this._prevApp = app;
		var args;
		if(app == "AkelPad") {
			args = "/Call('Scripts::Main', 1, 'EvalCmd.js', `AkelPad.SendMessage("
				+ "AkelPad.GetMainWnd(), 1204 /*AKD_GOTO*/, 0x1 /*GT_LINE*/, '%L:%C');`)";
		}
		else if(app == "Notepad++")
			args = "-n%L";
		else if(app.substr(0, 12) == "Sublime Text")
			args = "%F:%L:%C";
		else
			return;
		var eeArgs = this.eeArgs;
		eeArgs.value = args;
		this.fireChange(eeArgs);
	},
	showExternalEditorFile: function() {
		var eeFile = this.eeFile;
		if(eeFile && eeFile.exists()) {
			this.reveal(eeFile);
			return;
		}
		this.ee.focus();
	},
	externalEditorEvent: function(e) {
		switch(e.type) {
			case "click":
				if(e.button == 0)
					this.showExternalEditorFile();
			break;
			case "keypress":
				if(
					e.charCode
					&& !e.ctrlKey && !e.altKey && !e.metaKey
					&& String.fromCharCode(e.charCode).toLowerCase() == "c"
				) {
					var ee = this.ee;
					var val = ee.value;
					if(
						val.toLowerCase() == "s"
						&& ee.inputField.selectionStart == val.length
					) {
						e.preventDefault();
						ee.value = "Scratchpad";
						this.eeArgs.value = "";
						this.fireChange(ee);
						this.fireChange(this.eeArgs);
						break;
					}
				}
				if(e.keyCode != e.DOM_VK_RETURN)
					break;
				this.ut.stopEvent(e);
				if(!this.hasModifier(e))
					this.selectExternalEditor();
				else if(e.shiftKey)
					this.convertPath();
				else
					this.showExternalEditorFile();
		}
	},
	fireChange: function(node, eventType) {
		var evt = document.createEvent("Events");
		evt.initEvent(eventType || "change", true, true);
		node.dispatchEvent(evt);
	},

	checkSaved: function(onlyTree) {
		if(!this.checkImport(onlyTree))
			return false;
		if(onlyTree ? !this.treeUnsaved : !this.hasUnsaved)
			return true;
		var res = this.su.notifyUnsaved();
		if(res == this.su.PROMPT_CANCEL)
			return false;
		if(res == this.su.PROMPT_SAVE)
			this.saveSettings(false, true);
		return true;
	},
	checkImport: function(isImport) {
		//return !this.ps.otherSrc
		//	|| this.ut.confirm(this.getLocalized("title"), this.getLocalized("importIncomplete"));
		if(!this.ps.otherSrc)
			return true;
		var askPref = "sets.incompleteImportWarning";
		var dontAsk = { value: false };
		var ok = this.ut.confirmEx(
			this.getLocalized("warningTitle"),
			this.getLocalized("importIncomplete"),
			this.getLocalized(isImport ? "continue" : "closeSettings"),
			false,
			this.getLocalized("dontAskAgain"),
			dontAsk
		);
		if(!ok)
			return false;
		if(dontAsk.value)
			this.pu.set(askPref, false);
		!isImport && this.cleanImportSearch();
		return true;
	},

	setDialogButtons: function() {
		var isModified = this.hasUnsaved;
		document.title = this.su.createTitle(document.title, isModified, this.ps.otherSrc);
		if(this.instantApply)
			return; // Button is hidden
		this.applyButton.disabled = !isModified;
	},

	treeUnsaved: true,
	checkTreeSaved: function() {
		this.treeUnsaved = this.ps.otherSrc
			? false
			: this.ps.hasUnsaved;
	},
	get prefsUnsaved() { //~ todo: this is buggy
		return Array.prototype.some.call(
			document.getElementsByTagName("preference"),
			function(ps) {
				// Sometimes value isn't updated after actions like Ctrl+Z
				var elts = document.getElementsByAttribute("preference", ps.id);
				if(elts.length)
					ps.value = ps.getElementValue(elts[0]);

				return ps.value != ps.valueFromPreferences; // May be string and number on Firefox 3.0
			},
			this
		)
		|| this.disallowMousemoveButtons != this.pu.get("disallowMousemoveButtons");
	},
	get hasUnsaved() {
		return this.instantApply
			? false
			: this.treeUnsaved || this.prefsUnsaved;
	},

	dataChanged: function(e, delayed) {
		if(delayed) {
			this.delay(this.dataChanged, this, 5, [e]);
			return;
		}
		var tar = e.target;
		if(!("hasAttribute" in tar))
			return;
		var ln = tar.localName;
		//if(ln == "prefwindow") {
		//	this.focusSearch(true); //?
		//	return;
		//}
		if(tar.localName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("hc_requiredFor"))
			this.getDependentIds(tar).forEach(this.updateDependencies, this);
		if(tar.hasAttribute("preference")) {
			var p = this.$(tar.getAttribute("preference"));
			if(p.getAttribute("instantApply") == "true" || p.getAttribute("hc_instantApply") == "true")
				return;
		}
		else if(ln != "checkbox" && ln != "radio" && ln != "textbox")
			return;
		if(tar == this.searchField)
			return;
		if(this.instantApply)
			this.saveSettings(true);
		else
			//this.delay(this.setDialogButtons, this);
			this.setDialogButtons();
	},
	updateAllDependencies: function() {
		var reqs = { __proto__: null };
		Array.prototype.forEach.call(
			document.getElementsByAttribute("hc_dependsOn", "*"),
			function(it) {
				var dependsOn = it.getAttribute("hc_dependsOn");
				if(dependsOn in reqs)
					return;
				reqs[dependsOn] = true;
				this.updateDependencies(dependsOn);
			},
			this
		);
	},
	getDependentIds: function(it) {
		return it.getAttribute("hc_requiredFor").split(/\s+/);
	},
	getRequiredItems: function(requiredFor) {
		return Array.prototype.filter.call(
			document.getElementsByAttribute("hc_requiredFor", "*"),
			function(it) {
				return this.getDependentIds(it).indexOf(requiredFor) != -1;
			},
			this
		);
	},
	updateDependencies: function(requiredFor) {
		var dis = this.getRequiredItems(requiredFor).every(this.getDisabledFromItem, this);
		Array.prototype.forEach.call(
			document.getElementsByAttribute("hc_dependsOn", requiredFor),
			function(dep) {
				this.disableChilds(dep, dis);
			},
			this
		);
	},
	getDisabledFromItem: function(it) {
		var dis = false;
		if(it.hasAttribute("hc_disablePattern")) // 0|1|2 -> ^(0|1|2)$
			dis = new RegExp("^(?:" + it.getAttribute("hc_disablePattern") + ")$").test(it.value);
		else if(it.hasAttribute("hc_enablePattern"))
			dis = !new RegExp(it.getAttribute("hc_enablePattern")).test(it.value);
		else if(it.localName == "checkbox")
			dis = it.getAttribute("checked") != "true";
		return dis;
	},
	disableChilds: function(parent, dis) {
		parent.disabled = dis;
		Array.prototype.forEach.call(
			parent.getElementsByTagName("*"),
			function(elt) {
				elt.disabled = dis;
			}
		);
	},
	initTreeMenu: function() {
		var ln = document.popupNode.localName;
		if(ln != "treechildren" && ln != "tree")
			return false;

		this.checkClipboard();

		var noImport = !this._import;
		var selItsAll = this.getSelectedItems({ withRemoved: true });
		var selIts = noImport ? selItsAll : selItsAll.filter(function(tItem) {
			return !tItem.__isRemoved;
		});
		var noSel = !selIts.length;
		var noSelAll = !selItsAll.length;
		var hasEnabled = false;
		var hasDisabled = false;
		selIts.some(function(it) {
			if(this.checkedState(it))
				hasEnabled = true;
			else
				hasDisabled = true;
			return hasEnabled && hasDisabled;
		}, this);
		this.$("hc-sets-cmd-enable").setAttribute("disabled", noSel || !hasDisabled);
		this.$("hc-sets-cmd-disable").setAttribute("disabled", noSel || !hasEnabled);
		var noTypes = noSel || !selIts.some(function(it) {
			return it.__isCustomType;
		});
		var noTypesAll = noImport ? noTypes : noSelAll || !selItsAll.some(function(it) {
			return it.__isCustomType;
		});
		this.$("hc-sets-cmd-editType").setAttribute("disabled", noTypes);
		this.$("hc-sets-editType").hidden = noTypes;

		this.$("hc-sets-cmd-editSaved").setAttribute("disabled", noSelAll || noImport);
		this.$("hc-sets-editSaved").hidden = noImport;
		this.$("hc-sets-cmd-editSavedType").setAttribute("disabled", noTypesAll || noImport);
		this.$("hc-sets-editSavedType").hidden = noTypesAll || noImport;

		this.$("hc-sets-closeEditors-separator").hidden = (
			(this.$("hc-sets-closeEditors").hidden = !this.closeItemEditors(undefined, true))
			+ (this.$("hc-sets-closeSavedEditors").hidden = noImport || !this.closeItemEditors(false, true))
			+ (this.$("hc-sets-closeTypeEditors").hidden = noTypes || !this.closeItemTypeEditors(undefined, true))
			+ (this.$("hc-sets-closeSavedTypeEditors").hidden = noImport || noTypesAll || !this.closeItemTypeEditors(false, true))
		) == 4;

		return true;
	},

	reloadSettings: function() {
		this.reloadPrefpanes();
		this.initPrefs();
		//this.prefsSaved();

		this.updateAllDependencies();
		this.forceUpdTree(this._importSrc);
		this.ps.otherSrc && this.pe.reloadSettings();

		//this.applyButton.disabled = true;
		this.checkTreeSaved();
		this.setDialogButtons();
	},

	// about:config entries
	// Reset prefs:
	resetPrefs: function() {
		var exportPrefs = { value: true };
		var confirmed = this.ut.confirmEx(
			this.getLocalized("warningTitle"),
			this.getLocalized("resetPrefsConfirm"),
			this.getLocalized("resetPrefs"),
			true,
			this.getLocalized("exportPrefsFirst"),
			exportPrefs
		);
		if(!confirmed)
			return;
		if(exportPrefs.value && !this.exportPrefs())
			return; // Don't reset w/o backup
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(this.pu.resetPref, this.pu);
		this.reloadPrefpanes(); // Changed prefs don't reloaded by default
	},
	// Export/import:
	exportPrefsHeader: "[Handy Clicks settings]",
	exportPrefs: function() {
		var file = this.pickFile(this.getLocalized("exportPrefs"), true, "ini");
		if(!file)
			return false;
		var data = this.exportPrefsHeader + "\n"
			+ this.pu.prefSvc.getBranch(this.pu.prefNS)
				.getChildList("", {})
				.map(function(pName) {
					return this.pu.prefNS + pName + "=" + this.pu.get(pName);
				}, this).sort().join("\n");
		this.ut.writeToFile(data, file);
		this.backupsDir = file.parent;
		return true;
	},
	importPrefs: function(file) {
		if(
			file && !this.ut.confirm(
				this.getLocalized("title"),
				this.getLocalized("importPrefsConfirm")
					.replace("%f", file.path)
			)
		)
			return;
		if(!file && !(file = this.pickFile(this.getLocalized("importPrefs"), false, "ini")))
			return;
		var lines = this.ut.readFromFile(file)
			.split(/[\r\n]+/);
		if(lines[0] != this.exportPrefsHeader) {
			this.ut.alert(
				this.getLocalized("importErrorTitle"),
				this.getLocalized("invalidConfigFormat")
			);
			return;
		}
		this.backupsDir = file.parent;
		var _oldPrefs = [];
		this.pu.set("prefsVersion", 0);
		var ps = this.pu.prefSvc;
		for(var i = 1, l = lines.length; i < l; ++i) {
			var line = lines[i];
			var first = line.charAt(0);
			if(
				first == ";" || first == "#"
				|| first == "[" && line.charAt(line.length - 1) == "]"
			)
				continue;
			var indx = line.indexOf("=");
			if(indx == -1) {
				this.ut._warn("[Import INI] Skipped invalid line #" + (i + 1) + ': "' + line + '"');
				continue;
			}
			var pName = line.substr(0, indx);
			if(!this.ut.hasPrefix(pName, this.pu.prefNS)) {
				this.ut._warn('[Import INI] Skipped pref with invalid name: "' + pName + '"');
				continue;
			}
			var pType = ps.getPrefType(pName);
			var isOld = pType == ps.PREF_INVALID; // Old format?
			if(isOld) {
				_oldPrefs.push(pName);
				this.ut._warn('[Import INI] Old pref: "' + pName + '"');
			}
			var pVal = line.substr(indx + 1);
			if(pType == ps.PREF_INT || isOld && /^(?:0|-?[1-9]\d*)$/.test(pVal)) // Convert string to number
				pVal = +pVal;
			else if(pType == ps.PREF_BOOL || isOld && (pVal == "true" || pVal == "false")) // ...or boolean
				pVal = pVal == "true";
			else if(pName == this.pu.prefNS + "editor.external.args") { // String
				// Backward compatible fix for multiline string pref
				for(; i < l; ) {
					var nextLine = lines[i + 1];
					if(this.ut.hasPrefix(nextLine, this.pu.prefNS))
						break;
					pVal += "\n" + nextLine;
					++i;
				}
			}
			this.pu.setPref(pName, pVal);
		}
		this.pu.prefsMigration();
		_oldPrefs.forEach(function(pName) {
			this.pu.prefSvc.deleteBranch(pName);
		}, this);
		this.pu.savePrefFile();
		this.reloadPrefpanes(); // Changed prefs don't reloaded by default
		this.ut.notify(this.getLocalized("configSuccessfullyImported"));
	},

	// Clicking options management
	// Export/import:
	exportSets: function(partialExport, targetId, onlyCustomTypes) {
		if(typeof document == "object")
			this.selectTreePane();
		var ct = this.ct;
		if(targetId == ct.EXPORT_FILEPICKER) {
			var file = this.pickFile(
				this.getLocalized("exportSets"), true, "js",
				!partialExport && this.ps.prefsFile.lastModifiedTime
			);
			if(!file)
				return;
			this.backupsDir = file.parent;
		}
		if(partialExport) {
			var its = onlyCustomTypes ? this.selectedItemsWithCustomTypes : this.selectedItemsNoDelayed;
			var pStr = this.extractPrefs(!onlyCustomTypes, its);
			if(targetId == ct.EXPORT_CLIPBOARD_STRING)
				this.ut.copyStr(pStr);
			else if(targetId == ct.EXPORT_CLIPBOARD_URI)
				this.ut.copyStr(ct.PROTOCOL_SETTINGS_ADD + this.ps.encURI(pStr));
			else if(targetId == ct.EXPORT_CLIPBOARD_HTML) {
				var uri = ct.PROTOCOL_SETTINGS_ADD + this.ps.encURI(pStr);
				var label = this.extractLabels(its).join(", ");
				var info = this.ut.encodeHTML(this.getItemsInfo(its).join(" \n"))
					.replace(/\n/g, "&#10;")
					.replace(/\u21d2/g, "&#8658;");
				this.ut.copyStr(
					'<a href="' + this.ut.encodeHTML(uri) + '" title="' + info + '">'
					+ this.ut.encodeHTML(label, false)
					+ "</a>"
				);
			}
			else {
				this.ut.writeToFileAsync(pStr, file);
			}
		}
		else if(targetId == ct.EXPORT_FILEPICKER) {
			//this.ut.copyFileTo(this.ps.prefsFile, file.parent, file.leafName);
			var pStr = this.ps.getSettingsStr(null, null, true /*exportLinkedFiles*/);
			var lastMod = !this.treeUnsaved && !this.ps.otherSrc
				&& this.ps.prefsFile.lastModifiedTime;
			this.ut.writeToFileAsync(pStr, file, function(status) {
				if(Components.isSuccessCode(status) && lastMod)
					file.lastModifiedTime = lastMod;
			});
		}
		else {
			throw new Error(this.errPrefix + "Full export to clipboard not supported");
		}
	},
	extractPrefs: function(extractShortcuts, _its) {
		//~ todo: with "extractShortcuts == false" user see empty tree on import
		var types = this.ps.types, newTypes = {};
		var prefs = this.ps.prefs, newPrefs = {};

		var its = _its || (extractShortcuts ? this.selectedItemsNoDelayed : this.selectedItemsWithCustomTypes);
		var normalItems = [];
		its.forEach(function(it, i, its) {
			var type = it.__itemType;
			if(it.__isCustomType) {
				var to = this.ut.getOwnProperty(types, type);
				this.ut.setOwnProperty(newTypes, type, to);
			}
			if(extractShortcuts) {
				var sh = it.__shortcut;
				var to = this.ut.getOwnProperty(prefs, sh, type);
				this.ut.setOwnProperty(newPrefs, sh, type, to);
			}
			if(it.__isDelayed && (!i || its[i - 1] != it.parentNode.parentNode))
				normalItems.push(it.parentNode.parentNode); // Add not selected normal items
		}, this);

		if(normalItems.length)
			its = its.concat(normalItems);
		this.setNodesProperties(its, { hc_copied: true });
		this.delay(function() {
			this.setNodesProperties(its, { hc_copied: false });
		}, this, 200);

		return this.ps.getSettingsStr(newTypes, newPrefs, true);
	},
	extractLabels: function(its) {
		return its.map(function(it) {
			var fo = this.ut.getOwnProperty(this.ps.prefs, it.__shortcut, it.__itemType);
			return this.ut.isObject(fo) && this.su.getActionLabel(fo);
		}, this).filter(function(label) {
			return label;
		});
	},
	importSets: function(partialImport, srcId, data) {
		this.selectTreePane();
		var ct = this.ct;
		var pSrc;
		this.ps.checkPrefsStr.checkCustomCode = true;
		switch(srcId) {
			default:
			case ct.IMPORT_FILEPICKER:
				pSrc = this.pickFile(this.getLocalized("importSets"), false, "js");
				if(!pSrc)
					return;
			break;
			case ct.IMPORT_CLIPBOARD:
				pSrc = this.ps.clipboardPrefs;
				var fromClip = true;
			break;
			case ct.IMPORT_STRING:
				pSrc = this.ps.getPrefsStr(data);
			break;
			case ct.IMPORT_BACKUP:
				delete this.ps.checkPrefsStr.checkCustomCode;
				pSrc = this.pe.getBackupFile(data);
			break;
			case ct.IMPORT_FILE:
				pSrc = data;
		}
		if(
			fromClip
				? !pSrc // this.ps.clipboardPrefs are valid or empty
				: !this.ps.checkPrefs(pSrc)
		) {
			this.ut.alert(
				this.getLocalized("importErrorTitle"),
				this.getLocalized("invalidConfigFormat")
					+ (this.ps._hashError ? this.getLocalized("invalidHash") : "")
			);
			return;
		}
		if(
			this.ps._hashMissing
			&& !this.ut.confirmEx(
				this.getLocalized("warningTitle"),
				this.getLocalized("hashMissingConfirm"),
				this.getLocalized("continueImport")
			)
		)
			return;
		const warnPref = "sets.importJSWarning";
		if(srcId != ct.IMPORT_BACKUP && this.ps._hasCustomCode && this.pu.get(warnPref)) {
			this.ut.ensureNotMinimized();
			var dontAsk = { value: false };
			var ok = this.ut.promptsSvc.confirmCheck(
				window,
				this.getLocalized("warningTitle"),
				this.getLocalized("importSetsWarning"),
				this.getLocalized("importSetsWarningNotShowAgain"),
				dontAsk
			);
			if(!ok)
				return;
			this.pu.set(warnPref, !dontAsk.value);
		}
		if(!this.checkSaved(true))
			return;
		if(!this.ps.otherSrc) {
			this._savedPrefs = this.ps.prefs;
			this._savedTypes = this.ps.types;
		}
		this.ps.loadSettings(pSrc);
		//this.setDialogButtons();
		//this.pe.reloadSettings(false);
		if(this.ps._loadStatus)
			return;
		this._importSrc = pSrc;
		this.setImportStatus(true, partialImport, srcId == ct.IMPORT_CLIPBOARD);
		if(partialImport)
			this.redrawTree();
		else
			this.updTree();
		if(
			pSrc instanceof (Components.interfaces.nsILocalFile || Components.interfaces.nsIFile)
			&& !this.ps.prefsDir.contains(pSrc, false /* aRecurse, for Firefox 31 and older */)
		)
			this.backupsDir = pSrc.parent;
	},
	createBackup: function() {
		var bName = this.ps.prefsFileName + this.ps.names.userBackup + this.pe.getTimeString();
		var bFile = this.pe.getBackupFile(bName + ".js");
		bFile.createUnique(bFile.NORMAL_FILE_TYPE, this.ut.PERMS_FILE_WRITE);
		//this.ut.copyFileTo(this.ps.prefsFile, this.ps.backupsDir, bFile.leafName);
		var pStr = this.ps.getSettingsStr(null, null, true /*exportLinkedFiles*/);
		this.ut.writeToFileAsync(pStr, bFile, function(status) {
			if(!Components.isSuccessCode(status))
				return;
			this.ut.notify(this.getLocalized("backupCreated").replace("%f", bFile.path), {
				onLeftClick: function() {
					this.reveal(bFile)
				},
				context: this
			});
		}, this);
	},
	removeBackup: function(mi, e) {
		var fName = mi.getAttribute("hc_fileName");
		if(!fName)
			return false;
		var file = mi.__file;
		var exists = file.exists();

		var dontAsk = !exists || this.hasModifier(e) || e.type == "click";
		const confirmPref = "sets.removeBackupConfirm";
		if(!dontAsk && this.pu.get(confirmPref)) {
			this.ut.closeMenus(mi);
			this.ut.ensureNotMinimized();
			var dontAsk = { value: false };
			var ok = this.ut.promptsSvc.confirmCheck(
				window, this.getLocalized("title"),
				this.getLocalized("removeBackupConfirm").replace("%f", fName),
				this.getLocalized("dontAskAgain"),
				dontAsk
			);
			if(!ok)
				return false;
			if(dontAsk.value)
				this.pu.set(confirmPref, false);
		}

		exists && file.remove(false);
		mi.parentNode.removeChild(mi);
		this.updRestorePopup();
		return true;
	},
	initImportPopup: function() {
		this.checkClipboard();
		this.delay(this.buildRestorePopup, this);
	},
	handleRestoreCommand: function(e) {
		var mi = e.target;
		if(!mi.hasAttribute("hc_fileName"))
			return;
		this.importSets(
			this.hasModifier(e) || e.type == "click",
			this.ct.IMPORT_BACKUP,
			mi.getAttribute("hc_fileName")
		);
	},
	get ubPopup() {
		delete this.ubPopup;
		return this.ubPopup = this.$("hc-sets-tree-restoreFromBackupPopup");
	},
	buildRestorePopup: function() {
		var popup = this.ubPopup;

		var bakFiles = [];
		var entries = this.ps.backupsDir.directoryEntries;
		const fPrefix = this.ps.prefsFileName;
		const mainFile   = fPrefix + ".js";
		const corrupted  = fPrefix + this.ps.names.corrupted;
		const userBackup = fPrefix + this.ps.names.userBackup;
		const oldBackup  = fPrefix + this.ps.names.version;
		const testBackup = fPrefix + this.ps.names.testBackup;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(
				entry.isFile()
				&& /\.js$/i.test(fName)
				&& this.ut.hasPrefix(fName, fPrefix)
				&& fName != mainFile
				&& !this.ut.hasPrefix(fName, corrupted)
			) {
				bakFiles.push({
					file: entry,
					time: entry.lastModifiedTime
				});
			}
		}

		var isEmpty = !bakFiles.length;
		var ubCount = 0;
		var bytes = this.getLocalized("bytes");
		var testBackupStatus = this.storage.get("testBackupCreated") ? "thisSession" : "afterCrash";

		var df = document.createDocumentFragment();
		bakFiles.sort(function(a, b) {
			return b.time - a.time; // newest ... oldest
		}).forEach(function(fo) {
			var file = fo.file;
			var time = new Date(fo.time).toLocaleString();
			var size = file.fileSize.toString().replace(/(\d)(?=(?:\d{3})+(?:\D|$))/g, "$1 ");
			var name = file.leafName;
			var mi = this.ut.createElement("menuitem", {
				label: time + " [" + size + " " + bytes + "] \u2013 " + name,
				tooltiptext: file.path,
				hc_fileName: name,
				hc_userBackup: this.ut.hasPrefix(name, userBackup) && !!(++ubCount),
				hc_oldBackup:  this.ut.hasPrefix(name, oldBackup),
				hc_testBackup: this.ut.hasPrefix(name, testBackup) && testBackupStatus
			});
			mi.__file = file;
			df.appendChild(mi);
		}, this);

		var sep;
		for(; sep = popup.firstChild; ) {
			if(sep.localName == "menuseparator")
				break;
			popup.removeChild(sep);
		}
		popup.insertBefore(df, sep);
		this.updRestorePopup(ubCount, isEmpty, true);
	},
	updRestorePopup: function(ubCount, isEmpty) {
		var popup = this.ubPopup;
		if(ubCount === undefined)
			ubCount = popup.getElementsByAttribute("hc_userBackup", "true").length;
		if(isEmpty === undefined)
			isEmpty = !ubCount && !popup.getElementsByAttribute("hc_fileName", "*").length;
		var menu = popup.parentNode;
		menu.setAttribute("disabled", isEmpty);
		if(isEmpty)
			popup.hidePopup();

		var removeDepth = this.pu.get("sets.backupUserRemoveDepth");
		var removeDepth2 = this.pu.get("sets.backupUserRemoveDepth2");
		var miRemove = this.$("hc-sets-tree-removeUserBackups");
		var miRemove2 = this.$("hc-sets-tree-removeUserBackups2");
		miRemove.setAttribute("label", miRemove.getAttribute("hc_label").replace("$n", removeDepth));
		miRemove2.setAttribute("label", miRemove2.getAttribute("hc_label").replace("$n", removeDepth2));
		miRemove.setAttribute("disabled", ubCount <= removeDepth);
		miRemove2.setAttribute("disabled", ubCount <= removeDepth2);

		popup.setAttribute("hc_isDarkMenuFont", this.isDarkFont(this.$("hc-sets-tree-openBackupsDir")));
	},
	removeOldUserBackups: function(store) {
		if(store < 0)
			store = 0;
		var popup = this.ubPopup;
		var ubItems = popup.getElementsByAttribute("hc_userBackup", "true");
		for(var i = ubItems.length - 1; i >= store; --i) {
			var mi = ubItems[i];
			var file = mi.__file;
			file.exists() && file.remove(false);
			mi.parentNode.removeChild(mi);
		}
		this.updRestorePopup(store);
	},
	reveal: function(file) {
		return this.ut.reveal(file);
	},

	isDarkFont: function(node) {
		var isDarkFont = true;
		var fc = window.getComputedStyle(node, null).color;
		if(/^rgb\((\d+), *(\d+), *(\d+)\)$/.test(fc)) {
			var r = +RegExp.$1, g = +RegExp.$2, b = +RegExp.$3;
			var brightness = Math.max(r/255, g/255, b/255); // HSV, 0..1
			isDarkFont = brightness < 0.4;
		}
		return isDarkFont;
	},

	setImportStatus: function(isImport, isPartial, fromClipboard, updMode) {
		this._import              = isImport;
		this._importPartial       = isImport && isPartial;
		this._importFromClipboard = isImport && fromClipboard;
		if(!updMode) {
			this.closeImportEditors();
			this.checkTreeSaved();
		}
		var panel = this.$("hc-sets-tree-importPanel");
		panel.hidden = !isImport;
		if(!isImport) {
			this.cleanImportSearch() && this.searchInSetsTree(true);
			return;
		}

		this.setImportFilesDataStatus();
		this.$("hc-sets-tree-importType").value = isPartial;
		this.$("hc-sets-tree-importRowRemoved").setAttribute("hc_collapse", isPartial);
		panel.setAttribute("hc_isDarkFont", this.isDarkFont(this.$("hc-sets-tree-importAdded")));
		if(
			Array.prototype.indexOf.call(
				panel.getElementsByTagName("*"),
				document.commandDispatcher.focusedElement
			) == -1
		)
			this.$("hc-sets-tree-buttonImportOk").focus();
	},
	setImportFilesDataStatus: function() {
		var files = this.ps.files;
		var hasFD = false;
		var df = document.createDocumentFragment();
		var bytes = this.getLocalized("bytes");
		for(var path in files) if(files.hasOwnProperty(path)) {
			hasFD = true;
			var fo = files[path];
			var date = fo.lastModified ? new Date(fo.lastModified).toLocaleString() : "?";
			var size = fo.size ? ("" + fo.size).replace(/(\d)(?=(?:\d{3})+(?:\D|$))/g, "$1 ") + " " + bytes : "?";
			var row = df.appendChild(document.createElement("row"));
			row.appendChild(this.ut.createElement("label", { value: path }));
			row.appendChild(this.ut.createElement("label", { value: date }));
			row.appendChild(this.ut.createElement("label", { value: size }));
		}
		var importFD = this.$("hc-sets-tree-importFilesData");
		importFD.disabled = !hasFD;
		importFD.checked = this._importFilesData = hasFD;
		var label = hasFD
			? importFD.getAttribute("hc_labelN")
			: importFD.getAttribute("hc_label");
		if(importFD.getAttribute("label") != label) {
			importFD.setAttribute("label", label);
			// Force re-apply XBL binding to restore accesskey
			var pn = importFD.parentNode;
			var ns = importFD.nextSibling;
			pn.insertBefore(pn.removeChild(importFD), ns);
		}
		var counter = this.$("hc-sets-tree-importFilesStatistics");
		counter.value = df.childNodes.length;
		counter.hidden = !hasFD;
		var tipRows = this.$("hc-sets-tree-importFilesTipRows");
		tipRows.textContent = "";
		tipRows.appendChild(df);
	},
	cleanImportSearch: function(typeChanged) {
		var search = this.searchField.value;
		var newSearch = search.replace(this.searchPlaceholders.hc_old, "");
		if(!typeChanged) {
			newSearch = newSearch
				.replace(this.searchPlaceholders.hc_override, "")
				.replace(this.searchPlaceholders.hc_new, "")
				.replace(this.searchPlaceholders.hc_fileData, "");
		}
		if(newSearch == search)
			return false;
		this.searchField.value = this.ut.trim(newSearch);
		return true;
	},
	toggleImportType: function(isPartial) {
		if(isPartial === undefined)
			isPartial = !this._importPartial;
		else if(isPartial == this._importPartial) // Not changed
			return;
		this.setImportStatus(this._import, isPartial, this._importFromClipboard, true);
		this.hideOldTreeitems(isPartial, true);
		isPartial && this.cleanImportSearch(isPartial);
		this.searchInSetsTree(true);
	},
	toggleImportFilesData: function(importFD) {
		this._importFilesData = importFD;
		this.updTree();
	},
	importDone: function(ok) {
		if(ok && !this.buggyPrefsConfirm())
			return;

		var isPartial = this._importPartial;
		//var fromClip = this._importFromClipboard;
		this.setImportStatus(false);
		if(ok) {
			// Keep prefs file because content of new file may be equals!
			this.pe.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport, true);

			this.ps.otherSrc = false;
			if(this._importFilesData)
				this.importFilesData();
			isPartial && this.mergePrefs();
			this.pe.saveSettingsObjects(true);
		}
		else { // Cancel import
			this.ps.loadSettings();
			this.updTree();
		}
		this.tree.focus();
		this.setDialogButtons();
		this._importSrc = this._savedPrefs = this._savedTypes = null;
	},
	mergePrefs: function() {
		var types = this.ps.types;
		var prefs = this.ps.prefs;
		this.ps.loadSettings();

		for(var type in types) if(types.hasOwnProperty(type)) {
			if(!this.ps.isCustomType(type))
				continue;
			var to = types[type];
			if(!this.ps.isOkCustomObj(to))
				continue;
			this.ut.setOwnProperty(this.ps.types, type, to);
		}

		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh))
				continue;
			var so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.ut.isObject(to))
					continue;
				this.ut.setOwnProperty(this.ps.prefs, sh, type, to);
			}
		}
	},
	importFilesData: function() {
		var overwriteAsk = true, overwrite;
		var files = this.ps.files;
		for(var path in files) if(files.hasOwnProperty(path)) {
			var fo = files[path];
			if(!this.ps.isValidFileData(fo)) {
				this.ut._warn("Import skipped, invalid data for " + path);
				continue;
			}
			var file = this.ut.getLocalFile(path);
			if(!file) {
				this.ut._warn("Import skipped, invalid path: " + path);
				continue;
			}
			if(!this.pe.importAllowed(file)) {
				this.ut._warn("Import not allowed for " + path + " -> " + file.path);
				continue;
			}
			var exists = file.exists();
			if(exists && file.fileSize == fo.size) try { // Compare only with different file size
				if(this.ut.readFromFile(file) == fo.data)
					continue;
			}
			catch(e) {
				Components.utils.reportError(e);
			}
			if(exists && overwriteAsk) {
				// See this.ut.confirmEx()
				this.ut.ensureNotMinimized(window);
				var ps = this.ut.promptsSvc;
				var applyToAll = { value: false };
				var dateKey = fo.lastModified == file.lastModifiedTime
					? "replaceBySameDate"
					: fo.lastModified > file.lastModifiedTime
						? "replaceByNewer"
						: "replaceByOlder";
				var btn = ps.confirmEx(
					window,
					this.getLocalized("importJsFiles"),
					this.getLocalized("overwriteJsFile")
						+ "\n" + path
						+ "\n" + this.getLocalized(dateKey),
					  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_1_DEFAULT // "Cancel"
					+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING,
					this.getLocalized("overwrite"), // pos 0
					this.getLocalized("overwriteSkipAll"), // pos 1
					this.getLocalized("overwriteSkip"), // pos 2
					this.getLocalized("applyToAll"),
					applyToAll
				);
				if(btn == 0)
					overwrite = true;
				else if(btn == 1) // Canceled
					return;
				else if(btn == 2)
					overwrite = false;
				if(applyToAll.value)
					overwriteAsk = false;
			}
			if(exists) {
				if(!overwrite)
					continue;
			}
			else {
				try {
					file.create(file.NORMAL_FILE_TYPE, this.ut.PERMS_FILE_WRITE); // Also create directories
				}
				catch(e) {
					Components.utils.reportError(e);
					continue;
				}
			}
			this.writeFileData(file, fo.data, fo.lastModified || Date.now());
		}
	},
	writeFileData: function(file, data, time) {
		this.ut.writeToFileAsync(data, file, function(status) {
			if(Components.isSuccessCode(status))
				file.lastModifiedTime = time;
		}, this);
	},
	getFileData: function(code) {
		var path = this.ps.getSourcePath(code);
		return path && this.ut.getOwnProperty(this.ps.files, path, "data");
	},
	fileDataEquals: function(code) {
		var path = this.ps.getSourcePath(code);
		if(!path)
			return true;
		var fileData = this.ut.getOwnProperty(this.ps.files, path, "data");
		if(!fileData) // File will be unchanged
			return true;
		var file = this.ut.getLocalFile(path);
		if(!file.exists())
			return false;
		try {
			return this.ut.readFromFile(file) == fileData;
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return undefined;
	},

	// Import using drag-and-drop
	_dragOverTimer: 0,
	handleDragOver: function(e) {
		if(!this.hasDropData(e))
			return;
		var dt = e.dataTransfer;
		dt.effectAllowed = dt.dropEffect = "copy";
		e.preventDefault();
		e.stopPropagation();
		this.su._handleDragEvents = false;
		clearTimeout(this._dragOverTimer);
		this._dragOverTimer = this.delay(function() {
			this.su._handleDragEvents = true;
		}, this, 500);
	},
	handleDragLeave: function(e) {
	},
	handleDrop: function(e) {
		this.handleDragLeave(e);
		var data = this.getDropData(e);
		if(!data)
			return;
		this.su._handleDragEvents = true;
		// Prevent legacy "dragdrop" event (Firefox 3.6 and older), if received "drop" event
		e.preventDefault();
		e.stopPropagation();

		window.focus(); // Just moves window on top of other browser windows...
		var isFile = data instanceof Components.interfaces.nsIFile;
		if(isFile && /\.ini$/i.test(data.leafName))
			this.importPrefs(data);
		else {
			var type = isFile ? this.ct.IMPORT_FILE : this.ct.IMPORT_STRING;
			this.importSets(true, type, data);
		}
	},
	hasDropData: function(e) {
		return !!this.getDropData(e, true);
	},
	getDropData: function(e, _onlyCheck) {
		var dt = e.dataTransfer;
		if(!dt)
			return null;
		function getDataAt(type, i) {
			return dt.getDataAt && dt.getDataAt(type, i)
				|| dt.mozGetDataAt && dt.mozGetDataAt(type, i)
				|| dt.getData && dt.getData(type) // Fallback
				|| "";
		}
		var types = dt.types;
		var tc = types.length;
		for(var i = 0, c = dt.mozItemCount || dt.itemCount || 1; i < c; ++i) {
			for(var j = 0; j < tc; ++j) {
				var type = types[j];
				if(type == "application/x-moz-file") {
					var file = getDataAt(type, i);
					return file instanceof Components.interfaces.nsIFile
						&& /\.(?:ini|jsm?|json)$/i.test(file.leafName)
						&& file;
				}
				if(type == "text/x-moz-url") {
					var url = getDataAt(type, i).match(/^[^\r\n]*/)[0];
					return this.ut.hasPrefix(url, this.ct.PROTOCOL_SETTINGS_ADD) && url;
				}
				if(type == "text/plain") {
					var str = this.ut.trim(getDataAt(type, i) || "");
					return (
						this.ut.hasPrefix(str, this.ps.requiredHeader)
						|| this.ut.hasPrefix(str, this.ct.PROTOCOL_SETTINGS_ADD)
					) && str;
				}
			}
		}
		return null;
	},

	// Export/import utils:
	pickFile: function(pTitle, modeSave, ext, date) {
		var fp = this.ut.fp;
		fp.defaultString = this.ps.prefsFileName + (modeSave ? this.getFormattedDate(date) : "") + "." + ext;
		fp.defaultExtension = ext;
		fp.appendFilter(this.getLocalized("hcPrefsFiles"), "handyclicks_prefs*." + ext);
		fp.appendFilter(this.getLocalized(ext + "Files"), "*." + ext + (ext == "js" ? ";*.jsm;*.json" : ""));
		fp.appendFilters(fp.filterAll);
		var bDir = this.backupsDir;
		if(bDir)
			fp.displayDirectory = bDir;
		var win = typeof window == "object" ? window : this.wu.wm.getMostRecentWindow(null);
		fp.init(win, pTitle, fp[modeSave ? "modeSave" : "modeOpen"]);
		if(fp.show() == fp.returnCancel)
			return null;
		var file = fp.file;
		if(modeSave && file.exists())
			file.remove(true);
		return file;
	},
	get backupsDir() {
		var path = this.pu.get("sets.backupsDir");
		var file = path && this.ut.getLocalFile(path);
		return file && file.exists() && file.isDirectory() && file;
	},
	set backupsDir(dir) {
		var savedDir = this.backupsDir;
		if(savedDir && dir.equals(savedDir))
			return; // May be manually changed to use some custom alias, don't override!
		var path = dir.path;
		var curDrv = this.ut.getFileRoot(this.ps.profileDir);
		if(curDrv.contains(dir, false /* aRecurse, for Firefox 31 and older */))
			path = "%hc_ProfDrv%" + path.substr(curDrv.path.length)
		this.pu.set("sets.backupsDir", path);
	},
	getFormattedDate: function(date) {
		var d = date ? new Date(date) : new Date();
		var df = this.pu.get("sets.dateFormat");
		if(!df)
			return "";
		if(
			"toISOString" in d // Firefox 3.5+
			// Prefer toLocaleFormat(), if available and not raise deprecation warning
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1299900
			&& this.ut.fxVersion >= 55
		) {
			// toISOString() uses zero UTC offset, trick to use locale offset
			d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
			return "_" + d.toISOString() // Example: 2017-01-02T03:04:05.006Z
				.replace(/:\d+\.\d+Z$/, "")
				.replace("T", "_")
				.replace(":", "-"); // 2017-01-02_03-04
		}
		return d.toLocaleFormat(df);
	},

	checkClipboard: function() {
		this.$("hc-sets-cmd-importFromClipboard").setAttribute("disabled", !this.ps.clipboardPrefs);
	}
};

var handyClicksSetsSearcher = {
	__proto__: handyClicksSets,

	_res: [], // treeitems
	_current: 0,
	_wrapped: false,
	set results(res) {
		var items = Array.prototype.slice.call(this.tBody.getElementsByTagName("treeitem"));
		this._res = res.sort(function(a, b) {
			return items.indexOf(a) - items.indexOf(b);
		});
		this._current = 0;
		this.wrapped = this._wrapped = false;
	},
	get count() {
		return this._res.length;
	},
	reset: function() {
		this._current = 0;
	},
	next: function() {
		if(!this.isTreePaneSelected)
			return;
		if(this.startFromSelection(true))
			return;
		if(this.checkVisibility())
			return;
		if(++this._current >= this.count)
			this._wrapped = true, this._current = 0;
		this.select();
	},
	prev: function() {
		if(!this.isTreePaneSelected)
			return;
		if(this.startFromSelection(false))
			return;
		if(this.checkVisibility())
			return;
		if(--this._current < 0)
			this._wrapped = true, this._current = this.count - 1;
		this.select();
	},
	first: function() {
		if(!this.isTreePaneSelected)
			return;
		this._current = 0;
		this.select();
	},
	last: function() {
		if(!this.isTreePaneSelected)
			return;
		this._current = this.count - 1;
		this.select();
	},
	select: function() {
		if(!this.count)
			return;
		var tItem = this._res[this._current];
		this.wrapped = this._wrapped;
		this._wrapped = false; // Reset flag
		this.treeBatch(function() {
			this.ensureTreeitemVisible(tItem);
			var i = this.tView.getIndexOfItem(tItem);
			this.tSel.select(i);
			this.delay(function() { // Wait for expanding
				this.scrollToRow(i);
			}, this);
		});
	},
	startFromSelection: function(preferNext) {
		if(!this.count)
			return true;

		var tItem = this._res[this._current];
		var i = this.tView.getIndexOfItem(tItem);
		if(i != -1 && this.tSel.isSelected(i))
			return false; // Already selected -> navigate without corrections

		var rngCount = this.tSel.getRangeCount();
		if(!rngCount)
			return false;

		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				var tItem = this.tView.getItemAtIndex(j);
				if(firstSelected == undefined)
					var firstSelected = j;
				var indx = this._res.indexOf(tItem);
				if(indx != -1) { // Found selected matched item -> update current position
					this._current = indx;
					return false;
				}
			}
		}

		// Try find nearest matched item
		var maxIndx = this.tView.rowCount - 1;
		for(var i = preferNext ? j - 1 : firstSelected; ; preferNext ? ++i : --i) {
			if(i < 0)
				i = maxIndx;
			else if(i > maxIndx)
				i = 0;

			if(startPos == undefined)
				var startPos = i;
			else if(i == startPos)
				break;

			var tItem = this.tView.getItemAtIndex(i);
			var indx = this._res.indexOf(tItem);
			if(indx != -1) { // Found nearest matched item -> select and don't use next()/prev()
				this._current = indx;
				this.select();
				return true;
			}
		}

		return false;
	},
	checkVisibility: function() {
		var tItem = this._res[this._current];
		if(!this.inCollapsedTreeitem(tItem))
			return false;
		this.select();
		return true;
	},
	scrollToRow: function(i) {
		var pos = 0.5;
		var tbo = this.tbo;
		var first = tbo.getFirstVisibleRow();
		var visibleRows = tbo.height/tbo.rowHeight;
		var newFirst = i - pos*visibleRows + 1;
		tbo.scrollByLines(Math.round(newFirst - first));
		tbo.ensureRowIsVisible(i); // Should be visible, but...
	},
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.treeBatch(this._selectAll, this, arguments);
	},
	_selectAll: function() {
		var tSel = this.tSel;
		tSel.clearSelection();
		var firstIndx, lastIndx;
		this._res.forEach(function(tItem, n) {
			this.ensureTreeitemVisible(tItem);
			var i = this.tView.getIndexOfItem(tItem);
			tSel.rangedSelect(i, i, true);
			if(!n)
				firstIndx = i;
			else
				lastIndx = i;
		}, this);
		this.delay(function() {
			lastIndx  != undefined && this.tbo.ensureRowIsVisible(lastIndx);
			firstIndx != undefined && this.tbo.ensureRowIsVisible(firstIndx);
		}, this);
	},
	_unwrapTimeout: 0,
	_unwrapDelay: 700,
	set wrapped(val) {
		clearTimeout(this._unwrapTimeout);
		this.searchField.setAttribute("hc_wrapped", val);
		if(!val)
			return;
		this._unwrapTimeout = this.delay(function() {
			this.searchField.setAttribute("hc_wrapped", "false");
		}, this, this._unwrapDelay);
	}
};
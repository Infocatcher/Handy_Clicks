var handyClicksSets = {
	__proto__: handyClicksGlobals,

	_import: false,
	_importPartial: false,
	_importFilesData: false,
	_importSrc: null,
	_savedPrefs: null,
	_savedTypes: null,

	init: function(reloadFlag) {
		var args = "arguments" in window && window.arguments[0] || {};
		var importArgs = args.importArgs || null;
		var winId = args.winId || null;

		this.ps.loadSettings();
		this.initShortcuts();

		this.restoreSearchQuery();
		if(importArgs) // NS_ERROR_NOT_AVAILABLE: Cannot call openModalWindow on a hidden window
			this.delay(this.importSetsFromArgs, this, 0, importArgs);
		else {
			if(reloadFlag)
				this.updTree();
			else
				this.drawTree(false, this.pu.get("sets.rememberState"));
			!reloadFlag && this.focusSearch(true);
		}

		this.updTreeButtons();
		this.ps.oSvc.addObserver(this.setsReloading, this);

		this.initPrefs();
		this.pu.oSvc.addObserver(this.prefChanged, this);

		var fxVersion = this.fxVersion;
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
			this.startupUI(winId);
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

		var brWin = this.wu.browserWindow;
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
			(this.isPaleMoon ? this.appVersion >= 27 : fxVersion >= 25)
			&& this.appInfo.OS == "WINNT"
			&& this.osVersion >= 6
			&& matchMedia("(-moz-windows-default-theme)").matches
		)
			this.tree.setAttribute("hc_hasOverlayBackground", "true");

		if(fxVersion <= 2)
			this.e("hc-sets-overrideInstantApply-box").hidden = true;

		window.addEventListener("mouseover", this, true);
		document.addEventListener(this.su.dropEvent, this, false);
		this.$("hc-sets-tree-columns").addEventListener("click", this, true);

		this.checkLinkedFilesDelay = 10;
	},
	initShortcuts: function() {
		var tr = this.tree = this.$("hc-sets-tree");
		var tView = this.tView = tr.view;
		this.tbo = tr.treeBoxObject;
		this.tBody = tr.body;
		this.tSel = tView.selection;

		var de = document.documentElement;
		this.applyButton = de.getButton("extra1");
		this.prefsButton = de.getButton("extra2");
	},
	destroy: function(reloadFlag) {
		this.closeImportEditors(true);
		this.treeState(true);
		this.treeScrollPos(true);
		this.saveTreeSortOrder();
		this.saveSearchQuery();
		reloadFlag && this.setImportStatus(false);
		this.rowsCache = this._savedPrefs = this._savedTypes = null;
		this._typesState = this._filesState = null;

		window.removeEventListener("mouseover", this, true);
		document.removeEventListener(this.su.dropEvent, this, false);
		this.$("hc-sets-tree-columns").removeEventListener("click", this, true);
	},
	restoreSearchQuery: function() {
		if(!this.pu.get("sets.rememberSearchQuery"))
			return;
		var sf = this.searchField;
		sf.value = sf.getAttribute("hc_value");
	},
	saveSearchQuery: function() {
		var sf = this.searchField;
		if(this.pu.get("sets.rememberSearchQuery"))
			sf.setAttribute("hc_value", sf.value);
		else
			sf.removeAttribute("hc_value");
	},
	startupUI: function(winId) {
		this.treeState(false);
		if(winId)
			this.scrollToOpened(winId);
		else
			this.treeScrollPos(false);

		var de = document.documentElement;
		var instantApply = this.instantApply = de.instantApply;
		if(instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;

		var prefsBtn = this.prefsButton;
		prefsBtn.className += " hc-iconic hc-preferences";
		// Used menu button (instead of "popup" attributes) to make popup accessible from keyboard
		prefsBtn.setAttribute("type", "menu");
		prefsBtn.appendChild(this.e("hc-sets-prefsManagementPopup"));

		this.delay(this.startupUIDelayed, this, 50);
	},
	startupUIDelayed: function() {
		Array.prototype.forEach.call(
			this.$("hc-sets-tree-columns").getElementsByTagName("treecol"),
			function(col) {
				if(!col.tooltipText)
					col.tooltipText = col.getAttribute("label");
			}
		);
		Array.prototype.forEach.call( // Fix command handler from dialog binding
			this.prefsButton.getElementsByTagName("menuitem"),
			function(mi) {
				mi.setAttribute("dlgtype", "extra2");
			}
		);
		if(this.instantApply)
			document.documentElement.setAttribute("hc_instantApply", "true");
		if(this.ps.loaded && this.treeUnsaved)
			this.setModifiedState(true);
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
		else if(e.type == "click")
			this.treeColumnsClick(e);
	},
	setAutocompletePlural: function(tb) {
		if(!tb)
			tb = this.e("hc-sets-tabSize");
		var label = tb.nextSibling;
		label.value = label.getAttribute(tb.value == 1 ? "hc_labelSingle" : "hc_labelMultiple");
	},
	closeImportEditors: function(force) {
		var hasNotClosed;
		this.wu.forEachWindow("handyclicks:editor", function(w) {
			if(
				"_handyClicksInitialized" in w
					? w.handyClicksPrefSvc.otherSrc
					: "arguments" in w && w.arguments && w.arguments[0]
			) {
				if(force)
					w.close();
				else if(!this.wu.askToCloseWindow(w))
					hasNotClosed = true;
			}
		}, this);
		return !hasNotClosed;
	},
	treeState: function(saveFlag) {
		var rememberState = this.pu.get("sets.rememberState");
		var tr = this.tree;
		if(saveFlag) {
			if(rememberState) {
				this.persistLong(tr, "hc_stateCollapsed", this.ps.JSON.stringify(this.getCollapsed()));
				this.persistLong(tr, "hc_stateSelected", this.ps.JSON.stringify(this.getSelected()));
			}
			else {
				this.persistLong(tr, "hc_stateCollapsed", "");
				this.persistLong(tr, "hc_stateSelected", "");
			}
			return;
		}
		if(!rememberState)
			return;

		var collapsedRows = this.getPersistedLong(tr, "hc_stateCollapsed");
		var selectedRows = this.getPersistedLong(tr, "hc_stateSelected");
		collapsedRows && this.restoreCollapsed(this.parseJSON(collapsedRows));
		selectedRows && this.restoreSelection(this.parseJSON(selectedRows));
	},
	persistLong: function(node, attr, val) {
		var maxLen = 4096;
		for(var i = 0; ; ++i) {
			var v = val.substr(i*maxLen, maxLen);
			var a = attr + (i ? i + 1 : "");
			if(v)
				node.setAttribute(a, v);
			else if(node.hasAttribute(a)) // Remove previously persisted
				node.removeAttribute(a);
			else
				break;
			document.persist(node.id, a);
		}
	},
	getPersistedLong: function(node, attr) {
		var val = "";
		for(var i = 1, a; node.hasAttribute((a = attr + (i > 1 ? i : ""))); ++i)
			val += node.getAttribute(a);
		return val;
	},
	parseJSON: function(s) {
		try { // Can't store too long data using document.persist()
			return this.ps.JSON.parse(s);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return {};
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
		this.ensureLastRowIsVisible(lvr, fvr);
	},
	ensureLastRowIsVisible: function(lvr, fvr) {
		// ensureRowIsVisible() doesn't work correctly for last row on startup
		if(lvr === undefined)
			lvr = this.tbo.getLastVisibleRow();
		if(lvr >= this.tView.rowCount - 1) this.delay(function() {
			this.tbo.ensureRowIsVisible(lvr);
			if(fvr !== undefined && this.tbo.getFirstVisibleRow() == fvr + 1) {
				this._log("ensureLastRowIsVisible(): restore scroll to second-to-last row");
				this.tbo.scrollByLines(-1);
			}
		}, this);
	},
	saveTreeSortOrder: function() {
		var rememberSort = this.pu.get("sets.rememberSort");
		var tr = this.tree;
		Array.prototype.forEach.call(tr.columns, function(treeCol) {
			var col = treeCol.element;
			if(!rememberSort) {
				col.removeAttribute("sortDirection");
				col.removeAttribute("sortActive");
			}
			document.persist(col.id, "sortDirection");
			document.persist(col.id, "sortActive");
		});
		var hasDMi = "drawModeInitial" in this;
		var dmi = hasDMi && this.drawModeInitial;
		if(rememberSort) {
			if(hasDMi && this.treeSortColumn) {
				tr.setAttribute("hc_drawModeInitial", dmi);
				this._log("Save initial tree draw mode: " + dmi);
			}
			else {
				tr.removeAttribute("hc_drawModeInitial");
			}
			document.persist(tr.id, "hc_drawModeInitial");
		}
		else if(hasDMi) {
			this.setDrawMode(dmi);
		}
	},
	get treeSortColumn() {
		var sortCol = this.$("hc-sets-tree-columns").getElementsByAttribute("sortActive", "true")[0] || null;
		if(sortCol && sortCol.hasAttribute("primary") && !sortCol.getAttribute("sortDirection"))
			return null;
		return sortCol;
	},
	ensureTreeSorted: function() {
		var sortCol = this.treeSortColumn;
		if(!sortCol) {
			this.ensureInitialDrawMode();
			return;
		}
		// Trick: set sort direction to previous state and invoke sorting
		var dir = sortCol.getAttribute("sortDirection");
		var dirs = ["", "ascending", "descending", ""];
		sortCol.setAttribute("sortDirection", dirs[dirs.lastIndexOf(dir) - 1]);
		this.tView.cycleHeader(this.tree.columns[sortCol.id]);
		this._log("ensureTreeSorted() -> " + sortCol.id.substr(13) + " -> " + (dir || "(unsorted)"));

		var tr = this.tree;
		if(tr.hasAttribute("hc_drawModeInitial")) {
			this.drawModeInitial = +tr.getAttribute("hc_drawModeInitial");
			tr.removeAttribute("hc_drawModeInitial");
			this._log("Read initial tree draw mode: " + this.drawModeInitial);
		}
	},
	ensureTreeDrawMode: function(col) {
		if(!this.pu.get("sets.treeSortAutoInlineDrawMode"))
			return;
		var dm;
		if(
			col.hasAttribute("primary")
			&& col.getAttribute("sortDirection") == "descending" // Will be initial sort order
			&& this.drawInline
		) {
			dm = "drawModeInitial" in this ? this.drawModeInitial
				: this.modeToTree();
		}
		else if(!this.drawInline) {
			dm = this.modeToInline();
		}
		if(dm !== undefined) {
			this.setDrawMode(dm);
			this.initViewMenu(this.$("hc-sets-tree-viewPopup"));
		}
	},
	sortTree: function(colId) {
		this.ensureTreeDrawMode(this.$(colId));
		this.tView.cycleHeader(this.tree.columns[colId]);
	},

	/*** Actions pane ***/
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
	_drawTree: function(dontSearch, saveClosed) {
		this.timer("drawTree()");
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.get("delayedActionTimeout");
		var daForceDis = this._daForceDisable = daTime <= 0;
		this._daAfter = daForceDis
			? this.getLocalized("disabled")
			: this.getLocalized("after").replace("%t", daTime);
		this._daExpand = saveClosed // Will restore collapsed/expanded state
			|| this.pu.get("sets.treeExpandDelayedAction");
		this._localizeArgs = this.pu.get("sets.localizeArguments");
		this._maxCodeLength = this.pu.get("sets.codeLengthLimit");
		this._preserveLines = this.pu.get("sets.codeLengthLimit.preserveLines");
		var dm = this.drawMode = this.pu.get("sets.treeDrawMode");
		this.drawInline = this.isInline(dm);
		var sortTypes = this.pu.get("sets.treeSortCustomTypes");
		var sp = sortTypes > 0 ? "\uffdc" // show after shortcut items
			: sortTypes == 0 ? "" : "\t"; // show before shortcut items
		this.typesSortPrefix = sp && new Array(11).join(sp);

		this.resetCounters();

		var df = this.fxVersion >= 2
			? document.createDocumentFragment()
			: this.tBody;
		this.drawPrefs(this.ps.prefs, df);
		this._import && this.addImportStatistics(df);
		this.drawTypes(this.ps.types, df);
		this._import && this.drawTypes(this._delTypes, df, true);
		if(df != this.tBody)
			this.tBody.appendChild(df);
		this._importPartial && this.hideOldTreeitems(true);
		this.markOpenedEditors(true);
		delete this.eltsCache;
		this._hasFilter = false;
		this._hasHighlighted = false;
		this.ensureTreeSorted();

		this.timer("drawTree()");
		!dontSearch && this.searchInSetsTree(true);

		this.delay(function() { // Cleanup, see getSortedInsPos()
			delete this.tBody.__sortedChildNodes;
			Array.prototype.forEach.call(
				this.tBody.getElementsByTagName("treechildren"),
				function(tChld) {
					delete tChld.__sortedChildNodes;
				}
			);
		}, this);
	},
	drawPrefs: function(prefs, df, isRemoved) {
		this._drawRemoved = isRemoved;
		for(var sh in prefs) if(prefs.hasOwnProperty(sh))
			this.drawShortcut(prefs, sh, df);
	},
	drawTypes: function(types, df, isRemoved) {
		this._drawRemoved = isRemoved;
		if(!this.drawInline && !this.ju.isEmptyObj(types)) {
			var hash = "#custom_types";
			df = this.eltsCache[hash]
				|| this.appendContainerItem(df, hash, this.getLocalized("customTypes"), this.typesSortPrefix);
		}
		for(var type in types) if(types.hasOwnProperty(type))
			this.appendType(df, type, types[type]);
	},
	DRAW_NORMAL:          0,
	DRAW_NORMAL_COMPACT:  1,
	DRAW_NORMAL_INLINE:   2,
	DRAW_INVERSE:         3,
	DRAW_INVERSE_COMPACT: 4,
	DRAW_INVERSE_INLINE:  5,
	isInline: function(dm) {
		return dm == this.DRAW_NORMAL_INLINE
			|| dm == this.DRAW_INVERSE_INLINE;
	},
	modeToInline: function() {
		return this.drawMode < 2
			? this.DRAW_NORMAL_INLINE
			: this.DRAW_INVERSE_INLINE;
	},
	modeToTree: function() {
		return this.drawMode == this.DRAW_NORMAL_INLINE
			? this.DRAW_NORMAL
			: this.DRAW_INVERSE;
	},
	drawShortcut: function(prefs, sh, df) {
		var so = prefs[sh];
		if(!this.ps.isOkShortcut(sh) || !this.ju.isObject(so)) {
			this.ut._warn('Invalid shortcut in prefs: "' + sh + '"');
			return;
		}
		if(this.ju.isEmptyObj(so)) {
			this.ut._warn('Empty settings object in prefs: "' + sh + '"');
			return;
		}
		switch(this.drawMode) {
			default:
			case this.DRAW_NORMAL:
				var button = this.ps.getButtonId(sh);
				var modifiers = this.ps.getModifiersStr(sh);
				var buttonContainer = this.eltsCache[button]
					|| this.appendContainerItem(df, button, this.getLocalized(button));
				var modifiersContainer = this.eltsCache[sh]
					|| this.appendContainerItem(buttonContainer, sh, modifiers);
				this.appendItems(modifiersContainer, so, sh);
			break;
			case this.DRAW_NORMAL_COMPACT:
				var label = this.ps.getShortcutStr(sh, true);
				var buttonContainer = this.eltsCache[sh]
					|| this.appendContainerItem(df, sh, label);
				this.appendItems(buttonContainer, so, sh);
			break;
			case this.DRAW_NORMAL_INLINE:
				var label = this.ps.getShortcutStr(sh, true) + this.ps.spacedSep;
				for(var type in so) if(so.hasOwnProperty(type))
					this.appendRow(df, sh, type, so[type], label + this.getTypeLabel(type));
			break;
			case this.DRAW_INVERSE:
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
			case this.DRAW_INVERSE_COMPACT:
				var label = this.ps.getShortcutStr(sh, true);
				for(var type in so) if(so.hasOwnProperty(type)) {
					var typeContainer = this.eltsCache[type]
						|| this.appendContainerItem(df, type, this.getTypeLabel(type));
					this.appendRow(typeContainer, sh, type, so[type], label);
				}
			break;
			case this.DRAW_INVERSE_INLINE:
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
		var state = this._typesState = { __proto__: null };

		for(var type in types) if(types.hasOwnProperty(type)) {
			var to = types[type];
			var oldTo = this.ju.getOwnProperty(savedTypes, type);
			if(!oldTo) {
				++newTypes;
				state[type] = "new";
			}
			else if(!this.settingsEquals(to, oldTo)) {
				++overrideTypes;
				state[type] = "changed";
			}
		}

		var deletable = 0;
		var deletableDa = 0;
		var deletableTypes = 0;

		var prefs = this.ps.prefs;
		var savedPrefs = this._savedPrefs;
		var delPrefs = {};
		var delTypes = this._delTypes = {};

		for(var sh in savedPrefs) if(savedPrefs.hasOwnProperty(sh)) {
			var so = savedPrefs[sh];
			if(!this.ju.isObject(so))
				continue;
			var newSo = this.ju.getOwnProperty(prefs, sh);
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				var newTo = this.ju.getOwnProperty(newSo, type);
				if(to && !newTo) {
					++deletable;
					this.ju.setOwnProperty(delPrefs, sh, type, to);
				}
				if(!this.ju.isObject(to))
					continue;
				var da = this.ju.getOwnProperty(to, "delayedAction");
				var newDa = this.ju.getOwnProperty(newTo, "delayedAction");
				if(da && !newDa)
					++deletableDa;
			}
		}

		for(var type in savedTypes) if(savedTypes.hasOwnProperty(type)) {
			if(savedTypes[type] && !this.ju.getOwnProperty(types, type)) {
				++deletableTypes;
				this.ju.setOwnProperty(delTypes, type, savedTypes[type]);
			}
		}

		this.drawPrefs(delPrefs, df, true);

		const id = "hc-sets-tree-import";
		var c = this.counters;
		var $ = this.$;
		function showStats(type, normal, delayed, customTypes) {
			$(id + type + "Normal")     .value = normal;
			$(id + type + "Delayed")    .value = delayed;
			$(id + type + "CustomTypes").value = customTypes;
		}
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
	_redrawTree: function(dontSearch, saveClosed) {
		this.tBody.textContent = "";
		this._drawTree(dontSearch, saveClosed);
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

		this._redrawTree(false, saveClosed);
		if(!this.tView.rowCount)
			return;

		saveClosed && this.restoreCollapsed(collapsedRows);
		saveSel && this.restoreSelection(selectedRows);
	},
	reloadTree: function() {
		this._filesState = { __proto__: null };
		this.ps.loadSettings(this._importSrc);
		this.updTree();
		this._importSrc && this.pe.reloadSettings();
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
		var curIndx = this.tree.currentIndex;
		var rngCount = this.tSel.getRangeCount();
		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				var tItem = this.getItemAtIndex(j);
				if(tItem) // May be out of range in case of filters
					selectedRows[tItem.__hash] = j != curIndx || "current";
			}
		}
		return selectedRows;
	},
	restoreSelection: function(selectedRows) {
		var curIndx;
		Array.prototype.forEach.call(
			this.tBody.getElementsByTagName("treeitem"),
			function(ti) {
				if(ti.__hash in selectedRows) {
					var indx = this.tView.getIndexOfItem(ti);
					if(indx != -1) {
						this.tSel.rangedSelect(indx, indx, true);
						if(selectedRows[ti.__hash] == "current")
							curIndx = indx;
					}
				}
			},
			this
		);
		if(curIndx !== undefined)
			this.tree.currentIndex = curIndx;
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
			this.changedFileData() || this.updTree();
			this.checkTreeSaved();
		}
	},
	changedFileData: function(path) {
		if(!this.ps.otherSrc)
			return false;
		if(path)
			delete this._filesState[path];
		else
			this._filesState = { __proto__: null };
		this.updTree();
		this.setImportFilesDataStatus();
		return true;
	},
	changedFile: function(path) {
		if(!this.ps.otherSrc)
			this.updTree();
	},

	markOpenedEditors: function() {
		return this.treeBatch(this._markOpenedEditors, this, arguments);
	},
	_markOpenedEditors: function(isInitial) {
		if(!isInitial) for(var rowId in this.rowsCache)
			this._setItemStatus(rowId, false, undefined);
		const idProp = this.wu.winIdProp;
		const pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow("handyclicks:editor", function(w) {
			if(idProp in w && pSvc in w)
				this._setItemStatus(w[idProp], true, w[pSvc].otherSrc);
		}, this);
	},
	createContainer: function() {
		var tItem = document.createElement("treeitem");
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		tItem.appendChild(document.createElement("treerow"));
		tItem.appendChild(document.createElement("treechildren"));
		return (this.createContainer = function() {
			return tItem.cloneNode(true);
		})();
	},
	appendContainerItem: function(parent, hash, label, sortLabel) {
		var tItem = this.createContainer();
		var tRow = tItem.firstChild;
		var tChld = tItem.lastChild;
		this.appendTreeCell(tRow, "label", label, 0, sortLabel || label);

		tItem.__hash = hash;
		tItem.__sortLabel = sortLabel || label;
		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);
		return this.eltsCache[hash] = tChld;
	},
	getSortedInsPos: function(parent, sortItem) {
		var sortedItems = parent.__sortedChildNodes || (
			parent.__sortedChildNodes = Array.prototype.slice.call(parent.childNodes)
		);
		sortedItems.push(sortItem);
		sortedItems.sort(function(a, b) {
			return a.__sortLabel.localeCompare(b.__sortLabel);
		});
		return sortedItems[sortedItems.indexOf(sortItem) + 1] || null;
	},
	appendItems: function(parent, items, shortcut) {
		for(var itemType in items) if(items.hasOwnProperty(itemType))
			this.appendRow(parent, shortcut, itemType, items[itemType]);
	},
	checkLinkedFilesDelay: 250,
	appendRow: function(parent, shortcut, itemType, fo, forcedLabel) {
		var tItem = document.createElement("treeitem");
		var tRow = tItem.appendChild(document.createElement("treerow"));
		if(!this.ju.isObject(fo))
			fo = {};
		var foStr = 'prefs["' + shortcut + '"].' + itemType;
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = this.getTypeLabel(itemType, isCustomType);
		var label = forcedLabel || typeLabel;
		var initCode, daInitCode;
		var extNA = this.extTypeNotAvailable(itemType);
		var drawRemoved = this._drawRemoved;

		var col = -1;
		this.appendTreeCell(tRow, "label", label, ++col);
		this.appendTreeCell(tRow, "label", fo.eventType, ++col);
		var actLabel = this.su.getActionLabel(fo);
		var localized = this.ps.localize._localized;
		this.appendTreeCell(tRow, "label", actLabel, ++col);
		this.appendTreeCell(tRow, "label", this.getActionCode(fo.action, isCustom), ++col);
		var linkedFile = this.getActionCode._linkedFile;
		var fileData = this.getActionCode._hasFileData;
		this.appendTreeCell(tRow, "label", this.getArguments(fo.arguments || null, this._localizeArgs), ++col);
		this.appendTreeCell(tRow, "label", (initCode = this.getInitCode(fo, true)), ++col);
		var linkedFileInit = initCode && this.getActionCode._linkedFile;
		var hasLinkedFile = linkedFile || linkedFileInit;
		if(this.getActionCode._hasFileData)
			fileData = true;
		this.setNodeProperties(
			this.appendTreeCell(tRow, "value", fo.enabled, ++col),
			{ hc_checkbox: true }
		);

		var da = fo.delayedAction || null;
		if(da) {
			tItem.setAttribute("container", "true");
			if(this._daExpand)
				tItem.setAttribute("open", "true");
			var daChild = tItem.appendChild(document.createElement("treechildren"));
			var daItem = daChild.appendChild(document.createElement("treeitem"));
			var daRow = daItem.appendChild(document.createElement("treerow"));

			if(!this.ju.isObject(da))
				da = {};

			var col = -1;
			this.appendTreeCell(daRow, "label", this.getLocalized("delayed"), ++col);
			this.appendTreeCell(daRow, "label", this._daAfter, ++col);

			var daStr = foStr + ".delayedAction";
			var daCustom = !!da.custom;
			var daLabel = this.su.getActionLabel(da);
			var daLocalized = this.ps.localize._localized;
			var daDis = this._daForceDisable || !fo.enabled || !da.enabled;
			this.appendTreeCell(daRow, "label", daLabel, ++col);
			this.appendTreeCell(daRow, "label", this.getActionCode(da.action, daCustom), ++col);
			var daLinkedFile = this.getActionCode._linkedFile;
			var daFileData = this.getActionCode._hasFileData;
			this.appendTreeCell(daRow, "label", this.getArguments(da.arguments || null, this._localizeArgs), ++col);
			this.appendTreeCell(daRow, "label", (daInitCode = this.getInitCode(da, true)), ++col);
			var daLinkedFileInit = daInitCode && this.getActionCode._linkedFile;
			var daHasLinkedFile = daLinkedFile || daLinkedFileInit;
			if(this.getActionCode._hasFileData)
				daFileData = true;
			this.setNodeProperties(
				this.appendTreeCell(daRow, "value", da.enabled, ++col),
				{ hc_checkbox: true }
			);

			var daCachedNa = extNA || daHasLinkedFile && (
				this.su.linkedFileNotExists(daLinkedFile, true)
				|| this.su.linkedFileNotExists(daLinkedFileInit, true)
			);
			this.setChildNodesProperties(daRow, {
				hc_delayed: true,
				hc_enabled: !daDis,
				hc_disabled: daDis,
				hc_buggy: this.isBuggyFuncObj(da, daCustom, daLabel, daStr) && ++this.counters.buggy,
				hc_notAvailable: daCachedNa,
				hc_internal: !daCustom,
				hc_custom: daCustom,
				hc_customFile: daHasLinkedFile,
				hc_customInit: !!daInitCode,
				hc_customType: isCustomType,
				hc_customLocalized: daLocalized,
				hc_customNotLocalized: daCustom && !daLocalized
			}, true);

			if(this._import) {
				if(!drawRemoved) {
					var savedDa = this.ju.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
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
			daItem.__isType = false;
			daItem.__isDelayed = true;
			daItem.__isRemoved = drawRemoved;

			this.rowsCache[daItem.__hash = shortcut + "-" + itemType + "-delayed"] = daRow; // Uses for search
		}

		var isBuggy = this.isBuggyFuncObj(fo, isCustom, actLabel, foStr)
			|| (
				isCustomType && !this.ps.isOkCustomType(itemType, this._drawRemoved && this._savedTypes)
				|| this.ut.isBuggyStr(typeLabel)
			);

		var cachedNa = extNA || hasLinkedFile && (
			this.su.linkedFileNotExists(linkedFile, true)
			|| this.su.linkedFileNotExists(linkedFileInit, true)
		);
		this.setChildNodesProperties(tRow, {
			hc_enabled: fo.enabled,
			hc_disabled: !fo.enabled,
			hc_buggy: isBuggy && ++this.counters.buggy,
			hc_notAvailable: cachedNa,
			hc_internal: !isCustom,
			hc_custom: isCustom,
			hc_customFile: hasLinkedFile,
			hc_customInit: !!initCode,
			hc_customType: isCustomType,
			hc_customLocalized: localized,
			hc_customNotLocalized: isCustom && !localized
		}, true);
		if(this._import) {
			var saved = this.ju.getOwnProperty(this._savedPrefs, shortcut, itemType);

			// Ignore delayed actions:
			if(savedDa)
				saved.delayedAction = null;
			if(da)
				fo.delayedAction = null;

			if(!drawRemoved) {
				var override = saved;
				var equals = this.settingsEquals(fo, saved);
				if(isCustomType) {
					var newType = this.ju.getOwnProperty(this.ps.types, itemType);
					var savedType = this.ju.getOwnProperty(this._savedTypes, itemType);
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
		tItem.__isType = false;
		tItem.__isDelayed = false;
		tItem.__isRemoved = drawRemoved;
		tItem.__delayed = da && daItem;
		tItem.__sortLabel = label;

		if(!extNA && (hasLinkedFile || daHasLinkedFile)) this.delay(function() {
			var na = this.su.linkedFileNotExists(linkedFile)
				|| this.su.linkedFileNotExists(linkedFileInit);
			var daNa = this.su.linkedFileNotExists(daLinkedFile)
				|| this.su.linkedFileNotExists(daLinkedFileInit);
			var naChanged;
			if(na != cachedNa)
				this.setChildNodesProperties(tRow,  { hc_notAvailable: na }, true), naChanged = true;
			if(daNa != daCachedNa)
				this.setChildNodesProperties(daRow, { hc_notAvailable: daNa }, true), naChanged = true;
			naChanged && this.ensureNASearchUpdated();
		}, this, this.checkLinkedFilesDelay);

		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);

		this.rowsCache[tItem.__hash = shortcut + "-" + itemType] = tRow;
		return tItem;
	},
	appendType: function(parent, type, to) {
		var tItem = document.createElement("treeitem");
		var tRow = tItem.appendChild(document.createElement("treerow"));
		if(!this.ju.isObject(to))
			to = {};
		var typeLabel = this.getTypeLabel(type, true);
		var localized = this.ps.localize._localized;
		var label = this.drawInline
			? this.getLocalized("customType").replace("%s", typeLabel)
			: typeLabel;
		var sortLabel = this.typesSortPrefix + label;
		var drawRemoved = this._drawRemoved;
		var na = "\u2013";

		var col = -1;
		this.appendTreeCell(tRow, "label", label, ++col, sortLabel);
		this.appendTreeCell(tRow, "label", na, ++col);
		this.appendTreeCell(tRow, "label", na, ++col);
		this.appendTreeCell(tRow, "label", this.getActionCode(to.define, true), ++col);
		var linkedFile = this.getActionCode._linkedFile;
		var fileData = this.getActionCode._hasFileData;
		this.appendTreeCell(tRow, "label", "", ++col);
		var cmCode = "";
		if(to.contextMenu) {
			cmCode = this.getActionCode(to.contextMenu, true);
			var linkedFileCM = this.getActionCode._linkedFile;
			if(this.getActionCode._hasFileData)
				fileData = true;
		}
		var hasLinkedFile = linkedFile || linkedFileCM;
		this.appendTreeCell(tRow, "label", cmCode, ++col);
		this.setNodeProperties(
			this.appendTreeCell(tRow, "value", to.enabled, ++col),
			{ hc_checkbox: true }
		);

		tItem.__shortcut = undefined;
		tItem.__itemType = type;
		tItem.__isCustomType = true;
		tItem.__isType = true;
		tItem.__isDelayed = false;
		tItem.__isRemoved = drawRemoved;
		tItem.__delayed = null;
		tItem.__sortLabel = sortLabel;

		var cachedNa = hasLinkedFile && (
			this.su.linkedFileNotExists(linkedFile, true)
			|| this.su.linkedFileNotExists(linkedFileCM, true)
		);
		this.setChildNodesProperties(tRow, {
			hc_enabled: to.enabled,
			hc_disabled: !to.enabled,
			hc_buggy: !this.ps.isOkCustomType(type, drawRemoved && this._savedTypes),
			hc_notAvailable: cachedNa,
			hc_custom: true,
			hc_customFile: hasLinkedFile,
			hc_customType: true,
			hc_customLocalized: localized,
			hc_customNotLocalized: !localized
		}, true);
		if(this._import) {
			var state = this._typesState[type] || "";
			var ovr = state == "changed";
			this.setChildNodesProperties(tRow, {
				hc_override: ovr,
				hc_equals:  !ovr,
				hc_new:      state == "new",
				hc_old:      drawRemoved,
				hc_fileData: fileData
			}, true);
			drawRemoved && tItem.setAttribute("hc_old", "item");
		}

		if(hasLinkedFile) this.delay(function() {
			var na = this.su.linkedFileNotExists(linkedFile)
				|| this.su.linkedFileNotExists(linkedFileCM);
			if(na != cachedNa) {
				this.setChildNodesProperties(tRow, { hc_notAvailable: na }, true);
				this.ensureNASearchUpdated();
			}
		}, this, this.checkLinkedFilesDelay);

		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);

		this.rowsCache[tItem.__hash = "#custom_types-" + type] = tRow;
		return tItem;
	},
	getTypeLabel: function(type, isCustomType) {
		this.ps.localize._localized = false;
		return this.ps.getTypeLabel(type, isCustomType, this._drawRemoved && this._savedTypes);
	},
	getActionCode: function getActionCode(action, isCustom) {
		getActionCode._linkedFile = getActionCode._hasFileData = undefined;
		if(!isCustom)
			return action;
		var path = this.ps.getSourcePath(action);
		if(path) {
			getActionCode._linkedFile = path;
			var hasData = getActionCode._hasFileData = this._import
				&& path in this.ps.files;
			return this.getLocalized("customFile" + (hasData ? "WithData" : "")) + " " + path;
		}
		return this.getLocalized("customFunction")
			+ this.treeNewline
			+ this.cropCode(action || "");
	},
	getInitCode: function(fo) {
		var init = fo.init || null;
		return init ? this.getActionCode(init, true) : "";
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
				&& !this.fileDataEquals(this.ps.getSourcePath(savedObj[key]))
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
		var noProps = !propsVal;
		var changed = false;
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			var add = !!propsObj[p];
			if(!add && noProps)
				continue;
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
		addToParent && this.setNodeProperties(parent, propsObj);
		var nodes = parent.getElementsByTagName("*");
		for(var i = 0, l = nodes.length; i < l; ++i)
			this.setNodeProperties(nodes[i], propsObj);
	},
	setNodesProperties: function(parents, propsObj, addToParent) {
		parents.forEach(function(parent) {
			this.setChildNodesProperties(parent, propsObj, addToParent);
		}, this);
	},
	appendTreeCell: function(tRow, attr, val, col, sortData) {
		var cell = tRow.appendChild(document.createElement("treecell"));
		cell.setAttribute(attr, val);
		tRow.parentNode.setAttribute("hc_sortData" + col, sortData || val);
		return cell;
	},
	get treeNewline() {
		delete this.treeNewline;
		return this.treeNewline = this.fxVersion <= 2 ? " " : " \n";
	},
	getArguments: function(argsObj, localize) {
		if(!argsObj)
			return "";
		var res = [];
		for(var p in argsObj) if(argsObj.hasOwnProperty(p)) {
			res.push(
				localize
					? this.getLocalizedArguments(argsObj, p)
					: this.getRawArguments(argsObj, p)
			);
		}
		return res.join("," + this.treeNewline);
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

	addItems: function addItems(e) {
		if(!this.isTreePaneSelected)
			return;
		const MODE_SHORTCUT = this.ct.EDITOR_MODE_SHORTCUT;
		if(e) {
			var isCmd = e.type == "command";
			if(!isCmd) { // Preserve "click" event with getModifierState()
				"__click" in addItems && clearTimeout(addItems.__click.timer);
				var tmr = setTimeout(function() {
					delete addItems.__click;
				}, 25);
				addItems.__click = { event: e, timer: tmr };
			}
			if(isCmd || e.button > 0) {
				var evt = isCmd && addItems.__click && addItems.__click.event || e;
				this.openEditorWindow({ __shortcut: this.ps.getEvtStr(evt) }, MODE_SHORTCUT, true);
			}
			return;
		}
		var its = this.getSelectedItems({ withRemoved: true });
		var singleItem = its.length == 1 && its[0];
		if(singleItem) {
			if(singleItem.__isType)
				this.wu.openEditor(this.ps.currentOtherSrc, MODE_SHORTCUT, undefined, singleItem.__itemType);
			else
				this.openEditorWindow(singleItem, MODE_SHORTCUT, true);
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
		if(e && its.every(function(it) { return it.__isType; })) {
			this.editItemsTypes(forceEditSaved);
			return;
		}
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
		var types = { __proto__: null };
		cIts = cIts.filter(function(it) {
			var type = it.__itemType;
			if(type in types)
				return false;
			return types[type] = true;
		}, this);
		if(this.editorsLimit(cIts.length))
			return;
		var src = forceEditSaved ? null : undefined;
		cIts.forEach(function(it) {
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
		var selectedItems = this.getSelectedItems({
			onlyCustomTypes: mode == this.ct.EDITOR_MODE_TYPE,
			withRemoved: true
		});
		selectedItems.forEach(function(it) {
			var winId = mode == this.ct.EDITOR_MODE_SHORTCUT
				? this.wu.getWinId(otherSrc, this.ct.EDITOR_MODE_SHORTCUT, it.__shortcut, it.__itemType, it.__isDelayed)
				: this.wu.getWinId(otherSrc, this.ct.EDITOR_MODE_TYPE,     undefined,     it.__itemType, undefined);
			winIds[winId] = true;
		}, this);
		var wins = this.wu.getEditorsById(winIds);
		if(!getCanClose) wins.forEach(function(win) {
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
		return this.tbo.getRowAt(e.clientX, e.clientY) > -1;
	},
	isClickOnContainer: function(e) {
		var row = this.tbo.getRowAt(e.clientX, e.clientY);
		return row > -1 && this.tView.isContainer(row);
	},
	getItemsInfo: function(tIts) {
		tIts = tIts ? tIts.slice() : this.selectedItemsNoDelayed;
		var itsCount = tIts.length;
		if(!itsCount)
			return [];

		const MAX_TYPE_LENGTH = 60;
		const MAX_LABEL_LENGTH = 60;
		const MAX_ROWS = 12;

		if(itsCount > MAX_ROWS)
			tIts.splice(MAX_ROWS - 2, itsCount - MAX_ROWS + 1, "\u2026" /* "..." */);
		var info = tIts.map(function(tItem, i) {
			if(typeof tItem == "string") // Cropped mark
				return tItem;
			var type = tItem.__itemType;
			var typeLabel = this.cropStr(this.ps.getTypeLabel(type), MAX_TYPE_LENGTH);
			var n = i + 1;
			if(n == MAX_ROWS)
				n = itsCount;
			if(tItem.__isType) {
				var related = this.su.getSettingsForType(type);
				return n + ". " + this.getLocalized("customType").replace("%s", typeLabel)
					+ this.getLocalized("customTypeRelated").replace("%n", related);
			}
			var sh = tItem.__shortcut;
			var mdfs = this.ps.getModifiersStr(sh);
			var button = this.ps.getButtonStr(sh, true);
			var sep = this.ps.spacedSep;
			var fObj = this.ju.getOwnProperty(this.ps.prefs, sh, type);
			var dObj = this.ju.getOwnProperty(fObj, "delayedAction");
			var addLabel = "";
			if(tItem.__isDelayed) {
				typeLabel += " " + this.getLocalized("delayedActionMark");
				fObj = dObj;
			}
			else if(this.ju.isObject(dObj)) {
				var daLabel = this.cropStr(this.su.getActionLabel(fObj), MAX_LABEL_LENGTH);
				addLabel = this.getLocalized("delayedAction")
					.replace("%s", daLabel || this.getLocalized("unnamed"));
			}
			var label = this.ju.isObject(fObj)
				? this.cropStr(this.su.getActionLabel(fObj), MAX_LABEL_LENGTH)
					|| this.getLocalized("unnamed")
				: "?";
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
		var deleteTypes = { value: false, hasSettings: false };
		if(!this.confirmDelete(tIts, deleteTypes))
			return;
		if(!deleteTypes.value) {
			tIts = tIts.filter(function(it) { return !it.__isType; });
			if(!tIts.length)
				return;
		}

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

		if(deleteTypes.value && deleteTypes.hasSettings)
			this.updTree();
		else
			this.searchInSetsTree(true);
		this.restoreScroll(fvr, lvr);
	},
	deleteItem: function(tItem) {
		var sh = tItem.__shortcut;
		var type = tItem.__itemType;
		var prefs = this.ps.prefs;
		if(tItem.__isType) {
			delete this.ps.types[type];
			this.removeTreeitem(tItem);
		}
		else if(tItem.__isDelayed) { // Remove delayed action
			var so = prefs[sh];
			var to = so[type];
			delete to.delayedAction;

			this.deleteCachedRow(tItem.__hash);

			var tChld = tItem.parentNode;
			tItem = tChld.parentNode;
			tItem.removeChild(tChld);
			tItem.removeAttribute("container");
			delete tItem.__delayed;
		}
		else {
			var so = prefs[sh];
			delete so[type];
			if(this.ju.isEmptyObj(so))
				delete prefs[sh];

			this.removeTreeitem(tItem);
		}
	},
	confirmDelete: function(tIts, deleteTypes) {
		if(!tIts.length)
			return true;
		var typesCount = 0;
		var setsCount = 0;
		tIts.forEach(function(it) {
			if(!it.__isType)
				return;
			++typesCount;
			setsCount += this.su.getSettingsForType(it.__itemType);
		}, this);
		if(!setsCount) // Safe to delete
			deleteTypes.value = true;
		else
			deleteTypes.hasSettings = true;
		var onlyTypes = typesCount == tIts.length;
		onlyTypes && setsCount && this.ut.waitForPromptWindow(function(win) {
			var btn = win.document.documentElement.getButton("accept");
			var cb = win.document.getElementById("checkbox");
			function setCanDelete() {
				btn.disabled = !cb.checked;
			}
			setCanDelete();
			cb.addEventListener("command", setCanDelete, false);
			win.addEventListener("unload", function destroy(e) {
				win.removeEventListener(e.type, destroy, false);
				cb.removeEventListener("command", setCanDelete, false);
			}, false);
		});
		return this.ut.confirmEx(
			this.getLocalized("title"),
			this.getLocalized("deleteConfirm").replace("%n", tIts.length)
				+ "\n\n" + this.getItemsInfo(tIts).join("\n"),
			this.getLocalized("delete"), true,
			setsCount && this.getLocalized(onlyTypes ? "deleteCustomTypesConfirm" : "deleteCustomTypes")
				.replace("%n", typesCount)
				.replace("%s", setsCount),
			deleteTypes
		);
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
		var shortcut, itemType, isDelayed;
		if(tItem) {
			shortcut = tItem.__shortcut;
			if(!add) {
				itemType = tItem.__itemType;
				isDelayed = tItem.__isDelayed;
			}
		}
		if(src === undefined)
			src = this.ps.currentOtherSrc;
		this.wu.openEditor(src, mode || this.ct.EDITOR_MODE_SHORTCUT, shortcut, itemType, isDelayed);
	},
	setItemStatus: function() {
		return this.treeBatch(this._setItemStatus, this, arguments);
	},
	_setItemStatus: function(winId, editStat, otherSrc) {
		var tItem = this.getTreeitemByWinId(winId);
		if(!tItem)
			return;
		if(
			otherSrc == undefined // Force remove all highlighting
			|| (tItem.__isRemoved ? !otherSrc && this.ps.otherSrc : otherSrc == this.ps.otherSrc)
		)
			this.setChildNodesProperties(tItem, { hc_edited: editStat });
	},
	getTreeitemByWinId: function(winId) {
		if(!winId)
			return null;
		var pf = this.ct.OTHER_SRC_POSTFIX;
		if(winId.slice(-pf.length) == pf)
			winId = winId.slice(0, -pf.length);
		return winId in this.rowsCache
			&& this.rowsCache[winId].parentNode;
	},
	scrollToOpened: function(winId) {
		this.focusSetsTree();
		var tItem = this.getTreeitemByWinId(winId);
		if(!tItem) {
			this.delay(function() {
				this.blinkTree("hc_notFound");
			}, this, 20);
			return;
		}
		this.ensureTreeitemVisible(tItem);
		if(
			this.filterMode
			&& this.isTreeitemHidden(tItem)
			&& !(this._importPartial && tItem.hasAttribute("hc_old"))
		) {
			this._log("scrollToOpened(): reset filter");
			this.resetTreeFilter();
		}
		var indx = this.tView.getIndexOfItem(tItem);
		if(indx != -1) {
			this.tSel.select(indx);
			this.searcher.scrollToRow(indx);
			this.ensureLastRowIsVisible();
			if(this.fxVersion <= 2) this.delay(function() {
				this.searcher.scrollToRow(indx);
			}, this);
		}
		this.delay(function() {
			if(indx != -1)
				this.blinkTreeitem(tItem);
			else
				this.blinkTree("hc_notFound");
		}, this, 20);
	},
	blinkTree: function(attr) {
		this.blinkNode(this.tBody, function(tb, hl) {
			this.attribute(tb, attr, hl);
		}, this);
	},
	blinkTreeitem: function(tItem) {
		this.blinkNode(tItem, function(ti, hl) {
			this.setChildNodesProperties(ti, { hc_blink: hl }, true);
			this.tBody.boxObject.height; // Force reflow
		}, this);
	},
	blinkNode: function(node, hl, context, count) {
		if(!count)
			count = 3;
		(function blink() {
			hl.call(context, node, true);
			setTimeout(function() {
				hl.call(context, node, false);
				--count && setTimeout(blink, 80);
			}, 150);
		})();
	},
	_hoveredCheckbox: null,
	highlightHover: function(e) {
		var tItem = this.getChecboxItem(e);
		if(!tItem) {
			this.unhoverCheckbox();
			return;
		}
		var tRow = this.getRowForItem(tItem);
		var tCell = tRow.getElementsByAttribute("value", "*")[0];
		if(tCell != this._hoveredCheckbox)
			this.hoverCheckbox(tCell);
	},
	hoverCheckbox: function(tCell) {
		this.unhoverCheckbox();
		this.setNodeProperties(tCell, { hc_checkboxHover: true });
		this._hoveredCheckbox = tCell;
	},
	unhoverCheckbox: function() {
		if(this._hoveredCheckbox) {
			this.setNodeProperties(this._hoveredCheckbox, { hc_checkboxHover: false });
			this._hoveredCheckbox = null;
		}
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
			else if(e.button == 1) {
				var it = this.tView.getItemAtIndex(row.value);
				if("__shortcut" in it && !it.__isRemoved) {
					var mode = it.__isType ? this.ct.EDITOR_MODE_TYPE : this.ct.EDITOR_MODE_SHORTCUT;
					this.openEditorWindow(it, mode);
				}
			}
		}
		_tc.row = _tc.col = null;
	},
	getChecboxItem: function(e) {
		var row = {}, col = {}, cell = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, cell);
		var rowIndx = row.value;
		var column = col.value;
		if(
			rowIndx == -1
			|| !column || column.id != "hc-sets-tree-columnEnabled"
			|| !this.tView.getCellValue(rowIndx, column) // Should be "true" or "false"
		)
			return null;
		var tItem = this.getItemAtIndex(rowIndx);
		if(!tItem || tItem.__isRemoved)
			return null;
		return tItem;
	},
	toggleEnabled: function(e, forceEnable) {
		if(e) { // Check for click on checkbox cell
			var tItem = this.getChecboxItem(e);
			if(!tItem)
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
				this.toggleItemEnabled(tItem, forceEnable);
			}, this);
		}
		function updUI() {
			this.checkTreeSaved();
			this.setDialogButtons();
			this.updTreeButtons();
		}
		this.ps.otherSrc && this.pe.reloadSettings(true /* applyFlag */);
		if(this.instantApply && !this.ps.otherSrc)
			this.saveSettingsObjectsCheck(true, updUI, this);
		else
			updUI.call(this);
	},
	toggleItemEnabled: function(tItem, forceEnable) {
		if(
			tItem.__isType
			&& this.checkedState(tItem)
			&& !forceEnable
			&& !this.su.confirmTypeAction(tItem.__itemType, "typeDisablingWarning")
		)
			return;
		var tRow = this.getRowForItem(tItem);
		var enabled = this.checkedState(tItem, forceEnable === undefined ? null : forceEnable);
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
		if(tItem.__isType) {
			var to = this.ps.types[tItem.__itemType];
			to.enabled = enabled;
		}
		else {
			var so = this.ps.prefs[tItem.__shortcut][tItem.__itemType];
			if(tItem.__isDelayed)
				so.delayedAction.enabled = enabled;
			else
				so.enabled = enabled;
		}
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

		this.$("hc-sets-tree-findFilter").setAttribute("checked", this.filterMode);
	},
	selectAll: function() {
		if(!this.isTreePaneSelected)
			return;
		this.tree.focus();
		this.tSel.selectAll();
	},
	clearSelection: function() {
		if(!this.isTreePaneSelected)
			return;
		this.tree.focus();
		this.tSel.clearSelection();
	},
	invertSelection: function() {
		if(!this.isTreePaneSelected)
			return;
		this.tree.focus();
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
		var lastHandledRow = ss._lastHandledRow || undefined;
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
		var initialRow = ss._initialRow || undefined;
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
		var tdm = this.ut.mm(this.pu.get("sets.treeDrawMode"), 0, 5);
		mp.getElementsByAttribute("hc_drawMode", tdm)[0].setAttribute("checked", "true");
		var sct = this.ut.mm(this.pu.get("sets.treeSortCustomTypes"), -1, 1);
		mp.getElementsByAttribute("hc_sortTypes", sct)[0].setAttribute("checked", "true");
		this.$("hc-sets-tree-sortMenu").hidden = this.fxVersion <= 2;
		this.$("hc-sets-tree-customTypesMenu").setAttribute("hc_notFound", this.ju.isEmptyObj(this.ps.types));
		var closeMenu = this.pu.get("sets.closeTreeViewMenu") ? "auto" : "none";
		Array.prototype.forEach.call(
			mp.getElementsByTagName("menuitem"),
			function(mi) {
				var pref = mi.getAttribute("hc_pref");
				if(pref != "sets.closeTreeViewMenu")
					mi.setAttribute("closemenu", closeMenu);
				if(pref)
					mi.setAttribute("checked", this.pu.get(pref));
				else if(mi.hasAttribute("hc_treeAttr"))
					mi.setAttribute("checked", this.tree.getAttribute(mi.getAttribute("hc_treeAttr")) == "true");
			},
			this
		);
	},
	viewMenuCommand: function(e, popup) {
		var mi = e.target;
		if(mi.hasAttribute("hc_drawMode"))
			this.setDrawMode(+mi.getAttribute("hc_drawMode"), true);
		if(mi.hasAttribute("hc_sortTypes"))
			this.pu.set("sets.treeSortCustomTypes", +mi.getAttribute("hc_sortTypes"));
		else if(mi.hasAttribute("hc_pref")) {
			var prefName = mi.getAttribute("hc_pref");
			this.pu.set(prefName, !this.pu.get(prefName)); // => prefChanged()
		}
		else if(mi.hasAttribute("hc_treeAttr")) {
			var attrName = mi.getAttribute("hc_treeAttr");
			var tr = this.tree;
			tr.setAttribute(attrName, tr.getAttribute(attrName) != "true");
		}
		this.hasModifier(e) && popup.hidePopup();
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
	setViewMenuClose: function(e, mi) {
		e.stopPropagation();
		var prefName = mi.getAttribute("hc_pref");
		var close = !this.pu.get(prefName);
		this.pu.set(prefName, close);
		var popup = mi.parentNode;
		if(close)
			popup.hidePopup();
		else
			this.initViewMenu(popup);
	},
	setDrawMode: function(dm, changedByUser) {
		// <preference instantApply="true" ... /> is bad on slow devices (it saves prefs.js file)
		this.pu.set("sets.treeDrawMode", dm); // => prefChanged()
		if(changedByUser)
			this.drawModeInitial = dm;
	},
	setDrawModeFromKey: function(dm) {
		if(!this.isTreePaneSelected)
			return;
		var mi = this.$("hc-sets-tree-viewMenu").getElementsByAttribute("hc_drawMode", dm)[0];
		this.notifyTreeChange(mi);
		this.setDrawMode(dm, true);
	},
	ensureInitialDrawMode: function() {
		if(!("drawModeInitial" in this))
			this.drawModeInitial = this.drawMode;
	},
	notifyTreeChange: function(id, template, n) {
		var node = typeof id == "string" ? this.$(id) : id;
		var s = node.getAttribute("label");
		this.su.showInfoTooltip(
			this.$("hc-sets-tree-columns"),
			template ? template.replace("%s", s).replace("%n", n) : s,
			this.su.TOOLTIP_HIDE_QUICK,
			this.su.TOOLTIP_OFFSET_ABOVE
		);
	},
	initSortMenu: function(mp) {
		this.createSortMenu(mp);
		var cols = this.$("hc-sets-tree-columns");
		var sortCol = cols.getElementsByAttribute("sortActive", "true")[0]
			|| cols.getElementsByAttribute("primary", "true")[0];
		Array.prototype.forEach.call(
			mp.getElementsByAttribute("type", "radio"),
			function(mi) {
				var col = this.$(mi.getAttribute("hc_column"));
				mi.setAttribute("checked", col == sortCol);
				mi.setAttribute("hc_forHidden", col.hidden);
				var sd = col.getAttribute("sortDirection");
				var dir = sd == "ascending" ? "\u25b2"
					: sd == "descending" ? "\u25bc" : "";
				mi.setAttribute("acceltext", dir);
				setTimeout(function() { // Hack for Firefox 3.6 and older
					var accel = document.getAnonymousElementByAttribute(mi, "class", "menu-iconic-accel");
					accel.value = dir;
				}, 0);
			},
			this
		);
	},
	createSortMenu: function(mp) {
		this.createSortMenu = function() {}; // Only once
		var df = document.createDocumentFragment();
		var cols = this.$("hc-sets-tree-columns");
		Array.prototype.forEach.call(
			cols.getElementsByTagName("treecol"),
			function(col) {
				var mi = this.ut.createElement("menuitem", {
					label: col.getAttribute("label"),
					type: "radio",
					hc_column: col.id
				});
				df.appendChild(mi);
			},
			this
		);
		mp.insertBefore(df, mp.firstChild);
	},
	sortMenuCommand: function(e) {
		var colId = e.target.getAttribute("hc_column");
		if(!colId)
			return;
		this.sortTree(colId);
		this.initSortMenu(e.currentTarget);
	},

	get treeContainers() {
		return this.tBody.getElementsByAttribute("container", "true");
	},
	toggleTreeContainers: function() {
		if(!this.isTreePaneSelected)
			return;
		this.tree.focus();
		this.treeBatch(this._toggleTreeContainers, this, arguments);
	},
	_toggleTreeContainers: function(expand, notify) {
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				ti.setAttribute("open", expand);
			}
		);
		notify && this.notifyTreeChange(expand ? "hc-sets-tree-expand" : "hc-sets-tree-collapse");
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
		if(!this.isTreePaneSelected)
			return;
		this.tree.focus();
		var levelNew = this.maxExpandedLevel + levelDiff + 1;
		var expand = levelDiff > 0;
		var template = this.getLocalized("changeTreeLevelTemplate");
		if(expand && this.treeExpanded) {
			template += this.getLocalized("alreadyExpanded");
			--levelNew;
		}
		else if(!expand && levelNew < 0) {
			template += this.getLocalized("alreadyCollapsed");
			levelNew = 0;
		}
		this.notifyTreeChange(
			expand ? "hc-sets-tree-expandLevel" : "hc-sets-tree-collapseLevel",
			template, levelNew
		);
		this.expandTreeLevel(levelNew - 1);
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

	treeColumnsClick: function(e) {
		var col = e.target;
		if(col.localName != "treecol")
			return;
		if(e.button == 0 && !this.hasModifier(e)) { // Left-click to sort
			this.ensureTreeDrawMode(col);
			return;
		}
		if(!col.hasAttribute("primary"))
			return;
		this.ut.stopEvent(e);
		if(e.shiftKey || e.altKey || e.metaKey)
			this.toggleTreeContainers(this.treeCollapsed, true);
		else
			this.changeTreeExpandLevel(e.button == 2 ? 1 : -1);
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
		return this.searchField = this.e("hc-sets-tree-searchField");
	},
	get filterMode() {
		return this.$("hc-sets-tree-searchFilterMode").getAttribute("checked") == "true";
	},
	set filterMode(fm) {
		this.attribute(this.$("hc-sets-tree-searchFilterMode"), "checked", fm);
	},

	get searcher() {
		delete this.searcher;
		return this.searcher = handyClicksSetsSearcher;
	},
	initSearchMenu: function(mp) {
		var val = this.searchField.value;
		var hasSearch = /\S/.test(val);
		var counters = { __proto__: null };
		var sp = this.searchPlaceholders;
		Array.prototype.forEach.call(
			this.tree.getElementsByTagName("treerow"),
			function(tRow) {
				var tItem = tRow.parentNode;
				//if(tItem.hidden || tItem.parentNode.parentNode.hidden)
				//	return;
				var props = tRow.getAttribute("properties");
				if(!props || hasSearch && props.indexOf("hc_search ") == -1) // See .setNodeProperties()
					return;
				props.split(/\s+/).forEach(function(prop) {
					if(!(prop in sp))
						return;
					var ph = sp[prop];
					counters[ph] = (counters[ph] || 0) + 1;
				});
			}
		);

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
			var nf = !count;
			if(nf != (mi.getAttribute("hc_notFound") == "true"))
				mi.setAttribute("hc_notFound", nf);
		}, this);

		this.su.checkDarkFont(mp.firstChild, mp);
	},
	insertSearchPlaceholder: function(mi) {
		var ph = mi.getAttribute("acceltext");
		if(!ph)
			return;
		var ifi = this.searchField.inputField;
		var val = ifi.value;
		var editor = ifi
			.QueryInterface(Components.interfaces.nsIDOMNSEditableElement)
			.editor
			.QueryInterface(Components.interfaces.nsIPlaintextEditor);
		function removePh(ph) {
			var pos = val.indexOf(ph);
			if(pos == -1)
				return false;
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
			val = ifi.value;
			return true;
		}
		if(!removePh(ph)) {
			if(ph in this.oppositeSearchPlaceholders)
				this.oppositeSearchPlaceholders[ph].forEach(removePh);

			// Check for selection inside placeholder
			var leftPh = /%[a-z+-]*$/.test(val.substr(0, ifi.selectionStart)) && RegExp.lastMatch;
			var rightPh = /^[a-z+-]*%+/.test(val.substr(ifi.selectionEnd)) && RegExp.lastMatch;
			if(leftPh && rightPh && /^[a-z+-]*$/.test(val.substring(ifi.selectionStart, ifi.selectionEnd)))
				ifi.selectionStart = ifi.selectionEnd = ifi.selectionEnd + rightPh.length;

			if(/\S$/.test(val.substr(0, ifi.selectionStart)))
				ph = " " + ph;
			if(/^\S/.test(val.substr(ifi.selectionEnd)))
				ph += " ";
			editor.insertText(ph);
		}
		this.fireChange(this.searchField, "input");
		if(this.fxVersion < 3.5)
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
		this.filterMode = !this.filterMode;
		this.searchInSetsTree(true, true);
	},

	_searchDelay: 50,
	_searchTimer: 0,
	_lastSearch: 0,
	searchPlaceholders: {
		hc_override:           "%ovr%",
		hc_new:                "%new%",
		hc_old:                "%old%",
		hc_fileData:           "%data%",
		hc_internal:           "%internal%",
		hc_custom:             "%custom%",
		hc_customFile:         "%file%",
		hc_customInit:         "%init%",
		hc_customType:         "%type%",
		hc_customLocalized:    "%+lng%",
		hc_customNotLocalized: "%-lng%",
		hc_enabled:            "%on%",
		hc_disabled:           "%off%",
		hc_delayed:            "%delay%",
		hc_edited:             "%open%",
		hc_notAvailable:       "%na%",
		hc_buggy:              "%bug%",
		__proto__: null
	},
	oppositeSearchPlaceholders: {
		"%ovr%":      ["%new%", "%old%"],
		"%new%":      ["%ovr%", "%old%"],
		"%old%":      ["%ovr%", "%new%"],
		"%data%":     ["%internal%"],
		"%internal%": ["%custom%", "%file%", "%init%", "%type%", "%+lng%", "%-lng%", "%data%"],
		"%custom%":   ["%internal%"],
		"%file%":     ["%internal%"],
		"%init%":     ["%internal%"],
		"%type%":     ["%internal%"],
		"%+lng%":     ["%internal%", "%-lng%"],
		"%-lng%":     ["%internal%", "%+lng%"],
		"%on%":       ["%off%"],
		"%off%":      ["%on%"],
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
	usedPlaceholder: function(ph) {
		return this.searchField.value.indexOf(ph) != -1;
	},
	ensureNASearchUpdated: function() {
		if(this.usedPlaceholder(this.searchPlaceholders.hc_notAvailable))
			this.searchInSetsTreeDelay(true, 25);
	},
	ensureStatusSearchUpdated: function() {
		if(this.usedPlaceholder(this.searchPlaceholders.hc_edited))
			this.searchInSetsTree(true);
	},
	toggleSearch: function(str, dontSelect) {
		this.doSearch(this.searchField.value == str ? "" : str, dontSelect);
	},
	doSearch: function(str, dontSelect) {
		this.searchField.value = str;
		this.searchInSetsTree(dontSelect);
	},
	resetTreeFilter: function() {
		this.searchField.value = "";
		// Force search in synchronous mode
		this._lastSearch = 0;
		if(this._searchTimer) {
			clearTimeout(this._searchTimer);
			this._searchTimer = 0;
		}
		this.searchInSetsTree(true);
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
	searchInSetsTreeDelay: function(dontSelect, delay) {
		if(this._searchTimer)
			return;
		this._searchTimer = this.delay(function() {
			this._searchTimer = 0;
			this.searchInSetsTree(dontSelect);
		}, this, delay || 0);
	},
	_searchInSetsTree: function(dontSelect) {
		this.timer("searchInSetsTree()");
		var sf = this.searchField;
		var filterMode = this.filterMode;

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
		var rowsCount = 0;
		for(var h in this.rowsCache) {
			var tRow = this.rowsCache[h];
			var tItem = tRow.parentNode;
			if(this._importPartial && tItem.hasAttribute("hc_old"))
				continue;
			++rowsCount;
			var okRow = !hasTerm || checkFunc(this.getRowText(tRow, caseSensitive));
			var hl = hasTerm && okRow;
			if(hl || this._hasHighlighted)
				this.setChildNodesProperties(tRow, { hc_search: hl }, true);
			tItem.__matched = okRow;
			okRow && matchedRows.push(tRow);
		}
		var foundCount = matchedRows.length;
		var found = foundCount > 0;
		if(hasTerm && found)
			this._hasHighlighted = true;

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

		this.$("hc-sets-tree-searchResults").value = foundCount;
		this.$("hc-sets-tree-searchTotal").value = rowsCount;
		var st = this.$("hc-sets-tree-searchStatistics");
		st.setAttribute("hc_search", hasTerm);
		var tt = hasTerm
			? st.getAttribute("hc_tooltipResults") + " / " + st.getAttribute("hc_tooltipTotal")
			: st.getAttribute("hc_tooltipResults");
		if(st.tooltipText != tt) {
			st.tooltipText = tt;
			if(this.fxVersion < 3) Array.forEach(st.getElementsByTagName("*"), function(node) {
				node.tooltipText = tt;
			});
		}
		sf.setAttribute("hc_notFound", hasTerm && !found);

		this._lastSearch = Date.now();
		this.timer("searchInSetsTree()");
	},
	getRowText: function(tRow, caseSensitive) {
		var tChld = tRow, tItem;
		var rowText = [];
		do {
			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
			if(tItem.__isDelayed)
				var skipLevel = true;
			else if(skipLevel) {
				skipLevel = false;
				continue;
			}
			var row = this.getRowForItem(tItem);
			Array.prototype.forEach.call(
				row.getElementsByAttribute("label", "*"),
				function(elt) {
					var label = elt.getAttribute("label");
					label && rowText.push(label);
				}
			);
			var sr = this.searchReplacements;
			var props = row.getAttribute("properties");
			props && props.split(/\s+/).forEach(function(prop) {
				prop in sr && rowText.push(sr[prop]);
			});
		}
		while(tChld != this.tBody);
		rowText = rowText.join("\n");
		return caseSensitive ? rowText : rowText.toLowerCase();
	},

	/*** Prefs pane ***/
	_updPrefsUITimeout: 0,
	prefChanged: function(pName, pVal) {
		if(
			pName == "sets.treeDrawMode"
			|| pName == "sets.treeExpandDelayedAction"
		)
			this.updTree(false);
		else if(
			pName == "sets.treeSortCustomTypes"
			|| pName == "sets.localizeArguments"
			|| pName == "sets.codeLengthLimit"
			|| pName == "sets.codeLengthLimit.preserveLines"
		)
			this.updTree();
		else if(this.ju.startsWith(pName, "editor.externalEditor")) {
			this.initExternalEditor();
			this.updateDependencies("externalEditor");
		}
		else if(this.warnMsgsPrefs.indexOf(pName) != -1)
			this.initResetWarnMsgs();
		else if(pName == "disallowMousemoveButtons") {
			this.setDisallowMousemove();
			this.updateDependencies("disallowMousemove");
		}
		else if(this.ju.startsWith(pName, "ui.action"))
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
		"editor.confirmRename",
		"editor.unsavedSwitchWarning",
		"sets.importJSWarning",
		"sets.incompleteImportWarning",
		"sets.openEditorsLimit",
		"sets.removeBackupConfirm",
		"sets.removeOldBackupsConfirm",
		"sets.removeFileConfirm",
		"ui.confirmReload",
		"ui.notifyUnsaved"
	],
	warnEnabled: function(pName) {
		return this.pu.get(pName) > 0; // true or positive integer
	},
	get allWarnEnabled() {
		return this.warnMsgsPrefs.every(this.warnEnabled, this);
	},
	initResetWarnMsgs: function() {
		var allEnabled = this.allWarnEnabled;
		this.$("hc-sets-warnMsgs").setAttribute("hc_canReset", !allEnabled);
		var restoreAll = this.e("hc-sets-warnMsgs-restoreAll");
		restoreAll && this.attribute(restoreAll, "disabled", allEnabled);
	},
	initResetWarnMsgsMenu: function() {
		var mp = this.$("hc-sets-warnMsgs-popup");
		var df = document.createDocumentFragment();
		this.warnMsgsPrefs.forEach(function(pName) {
			var text;
			switch(pName) {
				case "editor.confirmRename":
					text = this.getLocalized("confirmRename");
				break;
				case "editor.unsavedSwitchWarning":
					text = this.getLocalized("editorUnsavedSwitchWarning");
				break;
				case "sets.importJSWarning":
					text = this.getLocalized("importSetsWarning");
				break;
				case "sets.incompleteImportWarning":
					text = this.getLocalized("importIncomplete");
				break;
				case "sets.openEditorsLimit":
					text = this.getLocalized("openEditorsWarning")
						.replace("%n", "N");
				break;
				case "sets.removeBackupConfirm":
					text = this.getLocalized("removeBackupConfirm")
						.replace("%f", this.ps.prefsFileName + ".js");
				break;
				case "sets.removeOldBackupsConfirm":
					text = this.getLocalized("removeOldBackupsConfirm")
						.replace("%n", "N");
				break;
				case "sets.removeFileConfirm":
					text = this.getLocalized("removeFileConfirm")
						.replace("%f", "%hc_ScriptsDir%/customScript.js");
				break;
				case "ui.confirmReload":
					text = this.getLocalized("confirmReload");
				break;
				case "ui.notifyUnsaved":
					text = this.getLocalized("notifyUnsaved");
				break;
				default:
					this.ut._warn('initResetWarnMsgs: no description for "' + pName + '" pref');
					text = pName;
			}
			var attrs = {
				label: text.replace(/\s+/g, " ").replace(/\s*\.\s*$/, ""),
				tooltiptext: text,
				type: "checkbox",
				autocheck: "false",
				hc_pref: pName,
				closemenu: "none"
			};
			if(this.warnEnabled(pName))
				attrs.checked = true;
			var mi = this.ut.createElement("menuitem", attrs);
			df.appendChild(mi);
		}, this);
		df.appendChild(document.createElement("menuseparator"));
		df.appendChild(this.ut.createElement("menuitem", {
			id: "hc-sets-warnMsgs-restoreAll",
			label: mp.getAttribute("hc_restoreAll"),
			oncommand: "handyClicksSets.resetWarnMsgs();",
			disabled: this.allWarnEnabled
		}));
		mp.textContent = "";
		mp.appendChild(df);
	},
	resetWarnMsg: function(mi) {
		var pName = mi.getAttribute("hc_pref");
		if(!pName)
			return;
		var reset = !this.warnEnabled(pName);
		if(reset)
			this.pu.resetPref(pName);
		else
			this.pu.set(pName, typeof this.pu.get(pName) == "number" ? 0 : false);
		this.attribute(mi, "checked", reset);
	},
	resetWarnMsgs: function() {
		this.warnMsgsPrefs.forEach(function(pName) {
			if(!this.warnEnabled(pName))
				this.pu.resetPref(pName);
		}, this);
	},
	showWarnMsgsPrefs: function(mi) {
		var pName = mi && mi.getAttribute("hc_pref");
		if(!pName && this.fxVersion < 3)
			return;
		function escapeRegExp(str) {
			return str.replace(/[\\\/.^$+*?|()\[\]{}]/g, "\\$&");
		}
		var filter = pName || "/^" + escapeRegExp(this.pu.prefNS)
			+ "(?:" + this.warnMsgsPrefs.map(escapeRegExp).join("|")
			+ ")/";
		this.pu.openAboutConfig(filter);
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

		var dirSep = this.appInfo.OS == "WINNT" ? "\\" : "/";
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
				if(this.ju.startsWith(path, aliasPath + dirSep)) {
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
			img.src = this.isSeaMonkey ? "" : "chrome://branding/content/icon16.png";
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
		if(app == "AkelPad") // AkelPad 4.9.1 (15.12.2014)+
			args = "/If(`SendMain(1204 /*AKD_GOTO*/, 0x1 /*GT_LINE*/, '%L:%C')`, ``, ``)";
		else if(app == "Notepad++")
			args = "-n%L";
		else if(
			app.substr(0, 12) == "Sublime Text"
			|| app == "CudaText"
		)
			args = "%F:%L:%C";
		else if(app == "Visual Studio Code")
			args = "--goto\n%F:%L:%C";
		else
			return;
		var eeArgs = this.eeArgs;
		eeArgs.value = args;
		this.fireChange(eeArgs);
	},
	showExternalEditorFile: function() {
		var eeFile = this.eeFile;
		if(eeFile && eeFile.exists()) {
			this.ut.reveal(eeFile);
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
				var chr = e.charCode
					&& !e.ctrlKey && !e.altKey && !e.metaKey
					&& String.fromCharCode(e.charCode).toLowerCase();
				if(chr) {
					var ee = this.ee;
					var val = ee.value.toLowerCase();
					var sp = "scratchpad";
					if(val == sp && ee.inputField.selectionStart == val.length)
						e.preventDefault(); // Don't break autocompleted string
					else if(
						val && this.ju.startsWith(sp, val)
						&& chr == sp.charAt(val.length)
						&& ee.inputField.selectionStart == val.length
					) {
						e.preventDefault();
						ee.value = "Scratchpad";
						this.eeArgs.value = "";
						this.fireChange(ee);
						this.fireChange(this.eeArgs);
					}
					break;
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
		if(!this.ps.otherSrc)
			return true;

		if(!this.isTreePaneSelected) {
			var prefWin = document.documentElement;
			var currentPane = prefWin.currentPane;
			this.selectTreePane();
			setTimeout(function() { // Will restore, if window not closed (pressed Cancel)
				prefWin.showPane(currentPane);
			}, 0);
		}
		this.blinkNode(this.$("hc-sets-tree-importPanel"), function(node, hl) {
			this.attribute(node, "hc_notify", hl);
		}, this, 1);

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
		this.setModifiedState(this.hasUnsaved);
	},
	setModifiedState: function(isModified) {
		document.title = this.su.createTitle(document.title, isModified, this.ps.otherSrc);
		if(this.instantApply)
			return; // Button is hidden
		this.applyButton.disabled = !isModified;
	},

	get treeUnsaved() {
		delete this.treeUnsaved;
		this.checkTreeSaved();
		return this.treeUnsaved;
	},
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

				return ps.value != ps.valueFromPreferences; // May be string and number in Firefox 3.0
			},
			this
		) || this.disallowMousemoveButtons != this.pu.get("disallowMousemoveButtons");
	},
	get hasUnsaved() {
		return this.instantApply
			? false
			: this.treeUnsaved || this.prefsUnsaved;
	},
	get hasChangedImport() {
		var pSrc = this._importSrc;
		if(!pSrc)
			return false;
		if(pSrc instanceof Components.interfaces.nsIFile)
			pSrc = this.io.readFromFile(pSrc);
		pSrc = pSrc.replace(/,\s*"files":\s*\{[\s\S]*?\}(\s*\}\s*)$/, "$1");
		return this.ps.checkUnsaved(pSrc);
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
		var onlyTypes = !noTypesAll && selItsAll.every(function(it) { return it.__isType; });
		this.$("hc-sets-cmd-editType").setAttribute("disabled", noTypes);
		this.$("hc-sets-editType").hidden = noTypes;
		this.$("hc-sets-edit").setAttribute("default", !onlyTypes);
		this.$("hc-sets-editType").setAttribute("default", onlyTypes);

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

	RELOAD_TREE:  1,
	RELOAD_PREFS: 2,
	RELOAD_ALL:   3,
	reloadSettings: function(flags) {
		if(this.instantApply)
			return;
		if(!flags)
			flags = this.RELOAD_ALL;
		var hasUnsaved = flags & this.RELOAD_TREE && (this.treeUnsaved || this.hasChangedImport)
			|| flags & this.RELOAD_PREFS && this.prefsUnsaved;
		if(hasUnsaved && !this.su.confirmReload())
			return;
		if(flags & this.RELOAD_TREE) {
			this.reloadTree();
			this.checkTreeSaved();
		}
		if(flags & this.RELOAD_PREFS) {
			this.reloadPrefpanes();
			this.initPrefs();
			this.updateAllDependencies();
		}
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
		this.io.writeToFile(data, file);
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
		var err = { value: null };
		var lines = this.io.readFromFile(file, err)
			.split(/[\r\n]+/);
		if(err.value) {
			this.ut.alert(
				this.getLocalized("importErrorTitle"),
				this.getLocalized("readError").replace("%err", err.value)
			);
			return;
		}
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
			if(!this.ju.startsWith(pName, this.pu.prefNS)) {
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
					if(this.ju.startsWith(nextLine, this.pu.prefNS))
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
				var html = '<a href="' + this.ut.encodeHTML(uri) + '" title="' + info + '">'
					+ this.ut.encodeHTML(label, false)
					+ "</a>";
				//this.ut.copyStr(html);
				this.ut.setClipboardData({
					"text/unicode": html,
					"text/html":    html
				});
			}
			else {
				this.io.writeToFileAsync(pStr, file);
			}
		}
		else if(targetId == ct.EXPORT_FILEPICKER) {
			//this.ut.copyFileTo(this.ps.prefsFile, file.parent, file.leafName);
			var outFiles = {};
			var pStr = this.ps.stringifySettings({ exportLinkedFiles: true, outFiles: outFiles });
			if(!this.treeUnsaved && !this.ps.otherSrc) {
				var lastMod = this.ps.prefsFile.lastModifiedTime;
				var files = outFiles.value;
				for(var path in files) if(files.hasOwnProperty(path)) {
					var fd = files[path];
					if(fd.lastModified > lastMod) {
						this._log("Use last modified date from file " + path);
						lastMod = fd.lastModified;
					}
				}
			}
			this.io.writeToFileAsync(pStr, file, function(status) {
				if(Components.isSuccessCode(status) && lastMod)
					file.lastModifiedTime = lastMod;
			});
		}
		else {
			throw new Error(this.errPrefix + "Full export to clipboard not supported");
		}
	},
	extractPrefs: function(extractShortcuts, _its) {
		var types = this.ps.types, newTypes = {};
		var prefs = this.ps.prefs, newPrefs = {};

		var its = _its || (extractShortcuts ? this.selectedItemsNoDelayed : this.selectedItemsWithCustomTypes);
		var normalItems = [];
		its.forEach(function(it, i, its) {
			var type = it.__itemType;
			if(it.__isCustomType) {
				var to = this.ju.getOwnProperty(types, type);
				this.ju.setOwnProperty(newTypes, type, to);
			}
			if(extractShortcuts) {
				var sh = it.__shortcut;
				var to = this.ju.getOwnProperty(prefs, sh, type);
				this.ju.setOwnProperty(newPrefs, sh, type, to);
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

		return this.ps.stringifySettings({ types: newTypes, prefs: newPrefs, exportLinkedFiles: true });
	},
	extractLabels: function(its) {
		return its.map(function(it) {
			var fo = this.ju.getOwnProperty(this.ps.prefs, it.__shortcut, it.__itemType);
			return this.ju.isObject(fo) && this.su.getActionLabel(fo);
		}, this).filter(function(label) {
			return label;
		});
	},
	importSetsFromArgs: function() {
		this.importSets.apply(this, arguments);
		if(!this._importSrc) { // Failed or canceled?
			this.drawTree(false, this.pu.get("sets.rememberState"));
			this.treeState(false);
			this.treeScrollPos(false);
		}
	},
	importSets: function(partialImport, srcId, data) {
		this.selectTreePane();
		var ct = this.ct;
		var pSrc;
		var cps = this.ps.checkPrefsStr;
		cps.checkCustomCode = true;
		switch(srcId) {
			default:
			case ct.IMPORT_FILEPICKER:
				pSrc = this.pickFile(this.getLocalized("importSets"), false, "js");
				if(!pSrc) {
					cps.checkCustomCode = false;
					return;
				}
			break;
			case ct.IMPORT_CLIPBOARD:
				pSrc = this.ps.clipboardPrefs;
				var fromClip = true;
			break;
			case ct.IMPORT_STRING:
				pSrc = this.ps.getPrefsStr(data);
			break;
			case ct.IMPORT_BACKUP:
				cps.checkCustomCode = false;
				pSrc = this.pe.getBackupFile(data);
			break;
			case ct.IMPORT_FILE:
				pSrc = data;
		}
		var validPrefs = fromClip
			? pSrc // this.ps.clipboardPrefs is valid or empty
			: this.ps.checkPrefs(pSrc);
		cps.checkCustomCode = false;
		if(!validPrefs) {
			this.ut.alert(
				this.getLocalized("importErrorTitle"),
				this.ps._ioError
					? this.getLocalized("readError").replace("%err", this.ps._ioError)
					: this.getLocalized("invalidConfigFormat")
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
		var isBackup = srcId == ct.IMPORT_BACKUP;
		if(!isBackup && this.ps._hasCustomCode && this.pu.get(warnPref)) {
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
		this.ps.loadSettings(validPrefs);
		if(!this.ps.loaded) {
			this.ut._err("importSets(): something went wrong, ps.loadSettings() failed");
			return;
		}
		this._filesState = { __proto__: null };
		this._importSrc = pSrc;
		this.setImportStatus(true, partialImport);
		if(partialImport)
			this.redrawTree();
		else
			this.updTree();
		if(!isBackup && pSrc instanceof Components.interfaces.nsIFile)
			this.backupsDir = pSrc.parent;
	},
	createBackup: function() {
		var bName = this.ps.prefsFileName + this.ps.names.userBackup + this.pe.getTimeString();
		var bFile = this.pe.getBackupFile(bName + ".js");
		bFile.createUnique(bFile.NORMAL_FILE_TYPE, this.io.PERMS_FILE_WRITE);
		//this.ut.copyFileTo(this.ps.prefsFile, this.ps.backupsDir, bFile.leafName);
		var pStr = this.ps.stringifySettings({ exportLinkedFiles: true });
		this.io.writeToFileAsync(pStr, bFile, function(status) {
			if(!Components.isSuccessCode(status))
				return;
			var msg = this.getLocalized("backupCreated")
				.replace("%f", bFile.path)
				.replace("%i", this.$("hc-sets-tree-buttonImport").getAttribute("label"))
				.replace("%r", this.$("hc-sets-tree-restoreFromBackupMenu").getAttribute("label"));
			this.ut.notify(msg, {
				onLeftClick: function() {
					this.ut.reveal(bFile);
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
		var confirmed = !dontAsk && this.su.confirmCheckPref(
			"sets.removeBackupConfirm",
			this.getLocalized("title"),
			this.getLocalized("removeBackupConfirm").replace("%f", fName),
			window,
			mi
		);
		if(!confirmed)
			return false;

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
		return this.ubPopup = this.e("hc-sets-tree-restoreFromBackupPopup");
	},
	get ubRD() {
		delete this.ubRD;
		return this.ubRD = this.e("hc-sets-tree-removeDuplicateBackups");
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
				&& this.ju.startsWith(fName, fPrefix)
				&& fName != mainFile
				&& !this.ju.startsWith(fName, corrupted)
			) {
				bakFiles.push({
					file: entry,
					time: entry.lastModifiedTime
				});
			}
		}

		var isEmpty = !bakFiles.length;
		var ubCount = 0;
		var testBackupStatus = this.storage.get("testBackupCreated") ? "thisSession" : "afterCrash";

		var df = document.createDocumentFragment();
		bakFiles.sort(function(a, b) {
			return b.time - a.time; // newest ... oldest
		}).forEach(function(fo) {
			var file = fo.file;
			var name = file.leafName;
			var mi = df.appendChild(this.ut.createElement("menuitem", {
				label: this.stringifyDate(fo.time) + " \u2013 " + name,
				acceltext: this.stringifySize(file.fileSize),
				tooltiptext: file.path,
				hc_fileName: name,
				hc_userBackup: this.ju.startsWith(name, userBackup) && !!(++ubCount),
				hc_oldBackup:  this.ju.startsWith(name, oldBackup),
				hc_testBackup: this.ju.startsWith(name, testBackup) && testBackupStatus
			}));
			mi.__file = file;
		}, this);

		var sep;
		for(; sep = popup.firstChild; ) {
			if(sep.localName == "menuseparator")
				break;
			popup.removeChild(sep);
		}
		popup.insertBefore(df, sep);
		this.ubRD.hasAttribute("disabled") && this.ubRD.removeAttribute("disabled");
		this.updRestorePopup(ubCount, isEmpty, true);
	},
	get backupItems() {
		return this.ubPopup.getElementsByAttribute("hc_fileName", "*");
	},
	get userBackupItems() {
		return this.ubPopup.getElementsByAttribute("hc_userBackup", "true");
	},
	updRestorePopup: function(ubCount, isEmpty) {
		var popup = this.ubPopup;
		if(ubCount === undefined)
			ubCount = this.userBackupItems.length;
		if(isEmpty === undefined)
			isEmpty = !ubCount && !this.backupItems.length;
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
		this.su.checkDarkFont(this.$("hc-sets-tree-openBackupsDir"), popup);
	},
	removeOldUserBackups: function(store) {
		if(store < 0)
			store = 0;
		var ubItems = this.userBackupItems;
		var toRemove = Array.prototype.slice.call(this.userBackupItems, store);
		if(!toRemove.length)
			return;

		var confirmed = this.su.confirmCheckPref(
			"sets.removeOldBackupsConfirm",
			this.getLocalized("title"),
			this.getLocalized("removeOldBackupsConfirm").replace("%n", toRemove.length),
			window,
			toRemove[0]
		);
		if(!confirmed)
			return;

		toRemove.forEach(function(mi) {
			var file = mi.__file;
			file.exists() && file.remove(false);
			mi.parentNode.removeChild(mi);
		});

		this.updRestorePopup(store);
	},
	removeDuplicateBackups: function() {
		var ubPopup = this.ubPopup;
		var ubRD = this.ubRD;
		ubRD.setAttribute("disabled", "true");
		ubPopup.setAttribute("hc_duplicateCheck", "true");
		setTimeout(function() {
			// .buildRestorePopup() -> .removeAttribute("disabled")
			ubPopup.removeAttribute("hc_duplicateCheck");
		}, 400);

		var sizes = { __proto__: null };
		Array.prototype.forEach.call(this.backupItems, function(mi) {
			var size = mi.__file.fileSize;
			if(size in sizes)
				sizes[size].push(mi); // From newer to older
			else
				sizes[size] = [mi];
		}, this);
		var fileData = this.ju.bind(function(contents, mi) {
			var file = mi.__file;
			var path = file.path;
			if(path in contents)
				return contents[path];
			return contents[path] = this.io.readFromFile(file);
		}, this);
		var dupCount = 0;
		for(var size in sizes) {
			var mis = sizes[size];
			var len = mis.length;
			if(len == 1)
				continue;
			var contents = { __proto__: null };
			for(var i = len - 1; i >= 1; --i) { // Will keep older file
				var mi = mis[i];
				this.delay(function(mis, contents, i, mi) {
					if(mi.hasAttribute("hc_duplicateRemove"))
						return;
					var data = fileData(contents, mi);
					for(var j = i - 1; j >= 0; --j) {
						var mi2 = mis[j];
						if(fileData(contents, mi2) != data)
							continue;
						++dupCount;
						mi2.setAttribute("hc_duplicateRemove", "true");
						this.delay(function(mi2) { // Pseudo-async + progress animation
							var file = mi2.__file;
							file.exists() && file.remove(false);
							mi2.parentNode.removeChild(mi2);
						}, this, 100, [mi2]);
						if(mi.hasAttribute("hc_duplicateKeep"))
							continue;
						mi.setAttribute("hc_duplicateKeep", "true");
						this.delay(function(mi) {
							mi.removeAttribute("hc_duplicateKeep");
						}, this, 110, [mi]);
					}
				}, this, 0, [mis, contents, i, mi]);
			}
		}
		this.delay(function() {
			ubPopup.scrollHeight || ubPopup.offsetHeight; // Force redraw
			this.delay(function() {
				this.su.showInfoTooltip(
					ubRD,
					this.getLocalized(dupCount ? "duplicateBackupsRemoved" : "duplicateBackupsNA")
						.replace("%n", dupCount),
					this.su.TOOLTIP_HIDE_DEFAULT,
					this.su.TOOLTIP_OFFSET_ABOVE
				);
			}, this);
		}, this, 120);
	},
	stringifyDate: function(time) {
		var d = new Date(time);
		return d.toLocaleDateString(undefined, {
			year:   "numeric",
		    month:  "2-digit",
		    day:    "2-digit", // Doesn't work...
		    hour:   "2-digit",
		    minute: "2-digit",
		    second: "2-digit"
		}).replace(/(\s)(\d:)/, "$10$2");
	},
	stringifySize: function(size) {
		return this.stringifyInteger(size) + " " + this.getLocalized("bytes");
	},
	stringifyInteger: function(n) {
		return n.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		});
	},

	setImportStatus: function(isImport, isPartial, updMode) {
		if(!updMode) {
			if(!this.closeImportEditors())
				return;
			this.checkTreeSaved();
		}
		this._import        = isImport;
		this._importPartial = isImport && isPartial;
		var panel = this.$("hc-sets-tree-importPanel");
		panel.hidden = !isImport;
		if(!isImport) {
			this.cleanImportSearch() && this.searchInSetsTree(true);
			this.$("hc-sets-tree-importStatistics").removeAttribute("minwidth");
			return;
		}

		this.setImportFilesDataStatus();
		this.$("hc-sets-tree-importType").value = isPartial;
		this.$("hc-sets-tree-importRowRemoved").setAttribute("hc_collapse", isPartial);

		for(var fe = document.commandDispatcher.focusedElement; fe; fe = fe.parentNode)
			if(fe == panel)
				return;
		this.$("hc-sets-tree-buttonImportOk").focus();
	},
	setImportFilesDataStatus: function() {
		var filesData = [];
		var files = this.ps.files;
		for(var path in files) if(files.hasOwnProperty(path)) {
			var fo = files[path];
			filesData.push({
				path: path,
				time: fo.lastModified,
				size: fo.size
			});
		}
		var countFD = filesData.length;
		var hasFD = !!countFD;
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
		importFD.className = "";
		var counter = this.$("hc-sets-tree-importFilesStatistics");
		counter.value = countFD;
		counter.hidden = !hasFD;
		var added = 0, changed = 0, older = 0, newer = 0;
		this.delay(function() {
			if(!this._import) {
				this._log("setImportFilesDataStatus() -> delay() -> not in import mode, ignore");
				return;
			}
			var tt = this.$("hc-sets-tree-importFilesTip");
			if(this.fxVersion >= 51) { // https://bugzilla.mozilla.org/show_bug.cgi?id=1318898
				// Prevent disappearance of semi-transparent nodes
				tt.style.filter = "contrast(1)";
			}
			tt.setAttribute("hc_hasFilesData", hasFD);
			var df = document.createDocumentFragment();
			filesData.sort(function(a, b) {
				return a.path.localeCompare(b.path);
			}).forEach(function(fd, i) {
				var n = i + 1;
				var path = fd.path;
				var date = fd.time >= 0 ? this.stringifyDate(fd.time) : "?";
				var size = fd.size >= 0 ? this.stringifySize(fd.size) : "?";
				var row = df.appendChild(document.createElement("row"));
				row.appendChild(this.ut.createElement("label", { value: n + ".", class: "hc-num" }));
				row.appendChild(this.ut.createElement("label", {
					value: path,
					crop: "center",
					class: "hc-path"
				}));
				row.appendChild(this.ut.createElement("label", { value: date, class: "hc-date" }));
				row.appendChild(this.ut.createElement("label", { value: size, class: "hc-size" }));
				this.delay(function() {
					var equals = this.fileDataEquals(path);
					if(equals === undefined)
						row.className = "hc-new", ++added;
					else if(!equals) {
						++changed;
						var file = this.ut.getLocalFile(path);
						var flm = file.lastModifiedTime;
						row.className = "hc-override" + (
							fd.time < flm && ++older
								? " hc-older"
								: fd.time > flm && ++newer ? " hc-newer" : ""
						);
					}
					if(n < countFD)
						return;
					const id = "hc-sets-tree-importFilesTip";
					this.$(id + "Added").value = added;
					this.$(id + "Older").value = older;
					this.$(id + "SameDate").value = changed - older - newer;
					this.$(id + "Newer").value = newer;
					var tipRows = this.$(id + "Rows");
					tipRows.textContent = "";
					tipRows.appendChild(df);
					importFD.className = (added ? "hc-new" : (changed ? "" : "hc-equals"))
						+ (changed ? " hc-override" : "");
				}, this);
			}, this);
		}, this, 10);
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
		this.setImportStatus(this._import, isPartial, true);
		this.hideOldTreeitems(isPartial, true);
		isPartial && this.cleanImportSearch(isPartial);
		this.searchInSetsTree(true);
	},
	toggleImportFilesData: function(importFD) {
		// Leave "Files" checkbox in place, if width of statistics grid will be increased
		var statsGrid = this.$("hc-sets-tree-importStatistics");
		statsGrid.setAttribute("minwidth", statsGrid.boxObject.width);

		this._importFilesData = importFD;
		this.updTree();
	},
	importDone: function(ok) {
		if(ok && !this.buggyPrefsConfirm())
			return;

		var isPartial = this._importPartial;
		this.setImportStatus(false);
		if(this._import) // Not changed (canceled)
			return;
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
		this._typesState = this._filesState = null;
		this._delTypes = null;
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
			this.ju.setOwnProperty(this.ps.types, type, to);
		}

		for(var sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh))
				continue;
			var so = prefs[sh];
			if(!this.ju.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				if(!this.ju.isObject(to))
					continue;
				this.ju.setOwnProperty(this.ps.prefs, sh, type, to);
			}
		}
	},
	importFilesData: function() {
		var overwriteAsk = true, overwrite;
		var errors = [];
		var files = this.ps.files;
		for(var path in files) if(files.hasOwnProperty(path)) {
			var fo = files[path];
			var file = this.ut.getLocalFile(path);
			if(!file) {
				this.ut._warn("Import skipped, invalid path: " + path);
				errors.push(path);
				continue;
			}
			if(!this.pe.importAllowed(file)) {
				this.ut._warn("Import not allowed for " + path + "\n=> " + file.path + this.pe._importPathsInfo);
				errors.push(path + "\n=> " + file.path);
				continue;
			}
			var exists = file.exists();
			if(exists && file.fileSize == fo.size)
				if(this.compareFileData(file, fo.data))
					continue;
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
				var defBtn = overwrite === undefined
					? ps.BUTTON_POS_1_DEFAULT
					: overwrite ? ps.BUTTON_POS_0_DEFAULT : ps.BUTTON_POS_2_DEFAULT;
				var btn = ps.confirmEx(
					window,
					this.getLocalized("importJsFiles"),
					this.getLocalized("overwriteJsFile")
						+ "\n" + path
						+ "\n" + this.getLocalized(dateKey),
					  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING + defBtn // "Cancel"
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
					file.create(file.NORMAL_FILE_TYPE, this.io.PERMS_FILE_WRITE); // Also create directories
				}
				catch(e) {
					this.ut._err("Import skipped, can't create " + path + "\n=> " + file.path);
					Components.utils.reportError(e);
					errors.push(path + "\n=> " + file.path);
					continue;
				}
			}
			this.writeFileData(file, fo.data, fo.lastModified || Date.now());
		}
		if(errors.length) {
			var msg = this.getLocalized("skippedFileData")
				 + "\n" + errors.map(function(e, i) { return ++i + ") " + e; }).join("\n");
			this.ut.notifyWarning(msg, { buttons: {
				$openConsole: this.ut.toErrorConsole
			}});
		}
	},
	writeFileData: function(file, data, time) {
		this.io.writeToFileAsync(data, file, function(status) {
			if(Components.isSuccessCode(status))
				file.lastModifiedTime = time;
		}, this);
	},
	getFileData: function(code) {
		var path = this.ps.getSourcePath(code);
		return path && this.ju.getOwnProperty(this.ps.files, path, "data");
	},
	fileDataEquals: function(path) {
		if(!path)
			return true;
		var fs = this._filesState;
		if(path in fs)
			return fs[path];
		var fileData = this.ju.getOwnProperty(this.ps.files, path, "data");
		if(!fileData) // File will be unchanged
			return true;
		var file = this.ut.getLocalFile(path);
		if(!file.exists())
			return fs[path] = undefined;
		return fs[path] = this.compareFileData(file, fileData);
	},
	compareFileData: function(file, data) {
		return this.io.readFromFile(file).replace(/^\ufeff/, "") == data.replace(/^\ufeff/, "");
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
					return this.ju.startsWith(url, this.ct.PROTOCOL_SETTINGS_ADD) && url;
				}
				if(type == "text/plain") {
					var str = this.ut.trim(getDataAt(type, i) || "");
					return (
						this.ju.startsWith(str, this.ps.requiredHeader)
						|| this.ju.startsWith(str, this.ct.PROTOCOL_SETTINGS_ADD)
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
			path = "%hc_ProfDrv%" + path.substr(curDrv.path.length);
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
			&& this.fxVersion >= 55
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
	next: function(focusTree) {
		if(!this.isTreePaneSelected)
			return;
		focusTree && this.tree.focus();
		if(this.startFromSelection(true))
			return;
		if(this.checkVisibility())
			return;
		if(++this._current >= this.count)
			this._wrapped = true, this._current = 0;
		this.select();
	},
	prev: function(focusTree) {
		if(!this.isTreePaneSelected)
			return;
		focusTree && this.tree.focus();
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
	_selectAll: function(focusTree) {
		focusTree && this.tree.focus();
		this.tSel.clearSelection();
		var fvr = this.tbo.getFirstVisibleRow();
		var lvr = this.tbo.getLastVisibleRow();
		var hasVisible, nearestIndx, offset = Infinity;
		this._res.forEach(function(tItem) {
			this.ensureTreeitemVisible(tItem);
			var i = this.tView.getIndexOfItem(tItem);
			this.tSel.rangedSelect(i, i, true);
			if(hasVisible)
				return;
			if(i >= fvr && i < lvr) { // "Last visible row" may be not really visible
				hasVisible = true;
				return;
			}
			var di = i < fvr ? fvr - i : i - lvr;
			if(di < offset) {
				offset = di;
				nearestIndx = i;
			}
		}, this);
		if(!hasVisible && nearestIndx !== undefined) this.delay(function() {
			this.scrollToRow(nearestIndx);
		}, this);
	},
	get allSelected() {
		var res = this._res;
		if(!res.length)
			return undefined;
		var rngCount = this.tSel.getRangeCount();
		if(!rngCount)
			return false;
		var selCount = 0;
		var start = {}, end = {};
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				var tItem = this.getItemAtIndex(j);
				if(!tItem)
					continue;
				++selCount;
				if(res.indexOf(tItem) == -1)
					return false;
			}
		}
		return selCount == res.length;
	},
	_unwrapTimeout: 0,
	_unwrapDelay: 700,
	set wrapped(val) {
		if(this.searchField.hasAttribute("hc_searchWrapped") == val)
			return;
		if(this._unwrapTimeout) {
			clearTimeout(this._unwrapTimeout);
			this._unwrapTimeout = 0;
		}
		this.attribute(this.searchField, "hc_searchWrapped", val);
		this.attribute(this.tree, "hc_searchWrapped", val);
		if(!val)
			return;
		this._unwrapTimeout = this.delay(function() {
			this._unwrapTimeout = 0;
			this.searchField.removeAttribute("hc_searchWrapped");
			this.tree.removeAttribute("hc_searchWrapped");
		}, this, this._unwrapDelay);
	},
	navigate: function(e) {
		var btn = e.button;
		var mdf = this.hasModifier(e);
		if(btn == 0 && !mdf)
			this.next(true);
		else if(btn == 2 && !mdf)
			this.prev(true);
		else if(btn == (mdf ? 0 : 1)) {
			if(this.allSelected)
				this.clearSelection();
			else
				this.selectAll(true);
		}
	}
};
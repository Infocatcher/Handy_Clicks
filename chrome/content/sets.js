var handyClicksSets = {
	__proto__: handyClicksGlobals,

	_import: false,
	_importPartial: false,
	_importFromClipboard: false,
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
			fxVersion >= 25
			&& this.ut.appInfo.OS == "WINNT"
			&& this.ut.osVersion >= 6
			&& document.querySelector(":-moz-system-metric(windows-default-theme)")
		)
			this.tree.setAttribute("hc_hasOverlayBackground", "true");

		if(fxVersion <= 2)
			this.e("hc-sets-overrideInstantApply-box").hidden = true;

		window.addEventListener("mouseover", this, true);
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
		this.instantApply = document.documentElement.instantApply;
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;

		var de = document.documentElement;
		var prefsButt = de.getButton("extra2");
		prefsButt.setAttribute("type", "menu");
		//prefsButt.setAttribute("popup", "hc-sets-prefsManagementPopup");
		// Can't open popup from keyboard
		prefsButt.appendChild(this.e("hc-sets-prefsManagementPopup"));
		prefsButt.className += " hc-iconic hc-preferences";
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
	},
	setAutocompletePlural: function(tb) {
		if(!tb)
			tb = this.e("hc-sets-tabSize");
		var label = tb.nextSibling;
		label.value = label.getAttribute(tb.value == 1 ? "hc_labelSingle" : "hc_labelMultiple");
	},
	closeImportEditors: function() {
		this.wu.forEachWindow(
			"handyclicks:editor",
			function(w) {
				if(!("_handyClicksInitialized" in w) || w.handyClicksPrefSvc.otherSrc)
					w.close();
			}
		);
	},
	treeState: function(saveFlag) {
		var rememberState = this.pu.get("sets.rememberState");
		var tr = this.tree;
		if(saveFlag) {
			if(rememberState) {
				tr.setAttribute("hc_stateCollapsed", this.ps.JSON.stringify(this.saveCollapsed()));
				tr.setAttribute("hc_stateSelected", this.ps.JSON.stringify(this.saveSelection()));
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
		var tbo = this.tbo;
		if(saveFlag) {
			if(rememberScrollPos) {
				tr.setAttribute("hc_firstVisibleRow", tbo.getFirstVisibleRow());
				tr.setAttribute("hc_lastVisibleRow", tbo.getLastVisibleRow());
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
		var maxRowsIndx = this.tView.rowCount - 1;
		if(maxRowsIndx < 0)
			return;
		var fvr = +tr.getAttribute("hc_firstVisibleRow");
		var lvr = +tr.getAttribute("hc_lastVisibleRow");
		if(lvr > maxRowsIndx)
			fvr -= lvr - maxRowsIndx;
		tbo.scrollToRow(this.ut.mm(fvr, 0, maxRowsIndx));
	},

	/*** Actions pane ***/
	forceUpdTree: function() {
		this.ps.loadSettings();
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
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.get("delayedActionTimeout");
		var daForceDis = this._daForceDisable = daTime <= 0;
		this._daAfter = daForceDis
			? this.getLocalized("disabled")
			: this.getLocalized("after").replace("%t", daTime);
		this._daExpand = this.pu.get("sets.treeExpandDelayedAction");
		this._localizeArgs = this.pu.get("sets.localizeArguments");

		this.resetCounters();

		var df = this.ut.fxVersion >= 2
			? document.createDocumentFragment()
			: this.tBody;
		var drawMode = this.pu.get("sets.treeDrawMode");
		var p = this.ps.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._warn('Invalid shortcut in prefs: "' + sh + '"');
				continue;
			}
			var so = p[sh];
			if(this.ut.isEmptyObj(so)) {
				this.ut._warn('Empty settings object in prefs: "' + sh + '"');
				continue;
			}
			switch(drawMode) {
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
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var label = button + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
					var buttonContainer = this.eltsCache[sh]
						|| this.appendContainerItem(df, sh, label);
					this.appendItems(buttonContainer, so, sh);
				break;
				case 2: // Normal (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = button + (modifiers ? sep + modifiers : "") + sep;
					for(var type in so) if(so.hasOwnProperty(type))
						this.appendRow(df, sh, type, so[type], label + this.ps.getTypeLabel(type));
				break;
				case 3: // Inverse
					var button = this.ps.getButtonId(sh);
					var buttonLabel = this.getLocalized(button);
					var modifiers = this.ps.getModifiersStr(sh);
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(df, type, this.ps.getTypeLabel(type));
						var hash = type + "-" + button;
						var buttonContainer = this.eltsCache[hash]
							|| this.appendContainerItem(typeContainer, hash, buttonLabel);
						this.appendRow(buttonContainer, sh, type, so[type], modifiers);
					}
				break;
				case 4: // Inverse (compact)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var label = button + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(df, type, this.ps.getTypeLabel(type));
						this.appendRow(typeContainer, sh, type, so[type], label);
					}
				break;
				case 5: // Inverse (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = sep + button + (modifiers ? sep + modifiers : "");
					for(var type in so) if(so.hasOwnProperty(type))
						this.appendRow(df, sh, type, so[type], this.ps.getTypeLabel(type) + label);
				break;
			}
		}
		if(df != this.tBody)
			this.tBody.appendChild(df);
		this.markOpenedEditors();
		if(this._import)
			this.addImportStatistics();
		delete this.eltsCache;
		this._hasFilter = false;

		!dontSearch && this.searchInSetsTree(true);
	},
	addImportStatistics: function() {
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

		for(var sh in savedPrefs) if(savedPrefs.hasOwnProperty(sh)) {
			var so = savedPrefs[sh];
			if(!this.ut.isObject(so))
				continue;
			var newSo = this.ut.getOwnProperty(prefs, sh);
			for(var type in so) if(so.hasOwnProperty(type)) {
				var to = so[type];
				var newTo = this.ut.getOwnProperty(newSo, type);
				if(to && !newTo)
					++deletable;
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

		const id = "hc-sets-tree-import";
		var c = this.counters;
		this.$(id + "ChangedValue").value = c.override + "/" + c.overrideDa + " + " + overrideTypes;
		this.$(id + "AddedValue")  .value = c.added    + "/" + c.addedDa    + " + " + newTypes;
		this.$(id + "RemovedValue").value = deletable  + "/" + deletableDa  + " + " + deletableTypes;
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

		var collapsedRows = saveClosed && this.saveCollapsed();
		var selectedRows = saveSel && this.saveSelection();

		this._redrawTree();
		if(!this.tView.rowCount)
			return;

		saveClosed && this.restoreCollapsed(collapsedRows);
		saveSel && this.restoreSelection(selectedRows);
	},
	saveCollapsed: function() {
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
	saveSelection: function() {
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

	setsReloading: function(notifyReason) {
		if(notifyReason & this.ps.SETS_RELOADED) {
			this.updTree();
			this.checkTreeSaved();
		}
	},

	markOpenedEditors: function() {
		return this.treeBatch(this._markOpenedEditors, this, arguments);
	},
	_markOpenedEditors: function() {
		for(var rowId in this.rowsCache)
			this._setItemStatus(rowId, false);
		var wProp = this.wu.winIdProp;
		var otherSrc = this.ps.otherSrc;
		this.wu.forEachWindow(
			"handyclicks:editor",
			function(w) {
				if(
					wProp in w
					&& "handyClicksPrefSvc" in w
					&& w.handyClicksPrefSvc.otherSrc == otherSrc
				)
					this._setItemStatus(w[wProp], true);
			},
			this
		);
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem = this.ut.parseXULFromString('\
			<treeitem xmlns="' + this.ut.XULNS + '" container="true" open="true">\
				<treerow>\
					<treecell label="' + this.ut.encodeHTML(label) + '" />\
				</treerow>\
				<treechildren />\
			</treeitem>'
		);
		tItem.__hash = hash;
		tItem.__sortLabel = label;
		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);
		return this.eltsCache[hash] = tItem.getElementsByTagName("treechildren")[0];
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
		var tRow = document.createElement("treerow");
		if(!this.ut.isObject(fo))
			fo = {};
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = this.ps.getTypeLabel(itemType, isCustomType);
		var label = forcedLabel || typeLabel;
		var initCode, daInitCode;
		var extNA = this.extTypeNotAvailable(itemType);

		this.appendTreeCell(tRow, "label", label);
		this.appendTreeCell(tRow, "label", fo.eventType);
		var actLabel = this.getActionLabel(fo);
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
			var daChild = document.createElement("treechildren");
			var daItem = document.createElement("treeitem");
			var daRow = document.createElement("treerow");

			if(!this.ut.isObject(da))
				da = {};

			this.appendTreeCell(daRow, "label", this.getLocalized("delayed"));
			this.appendTreeCell(daRow, "label", this._daAfter);

			var daCustom = !!da.custom;
			var daLabel = this.getActionLabel(da);
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
				hc_enabled: !daDis,
				hc_disabled: daDis,
				hc_buggy: this.isBuggyFuncObj(da, daCustom, daLabel) && ++this.counters.buggy,
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
				var savedDa = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
				var overrideDa = savedDa;
				var equalsDa = this.settingsEquals(da, savedDa);
				this.setChildNodesProperties(daRow, {
					hc_override: overrideDa && !equalsDa && ++this.counters.overrideDa,
					hc_equals:   overrideDa &&  equalsDa,
					hc_new:     !overrideDa &&              ++this.counters.addedDa,
					hc_fileData: daFileData
				}, true);
			}

			daItem.__shortcut = shortcut;
			daItem.__itemType = itemType;
			daItem.__isCustomType = isCustomType;
			daItem.__isDelayed = true;

			daItem.appendChild(daRow);
			daChild.appendChild(daItem);
			tItem.appendChild(daChild);

			this.rowsCache[daItem.__hash = shortcut + "-" + itemType + "-delayed"] = daRow; // Uses for search
		}

		this.setNodeProperties(
			this.appendTreeCell(tRow, "value", fo.enabled),
			{ hc_checkbox: true }
		);

		var isBuggy = this.isBuggyFuncObj(fo, isCustom, actLabel)
			|| (
				isCustomType && !this.ps.isOkCustomType(itemType)
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
			this.setChildNodesProperties(tRow, {
				hc_override: override && !equals && ++this.counters.override,
				hc_equals:   override &&  equals,
				hc_new:     !override            && ++this.counters.added,
				hc_fileData: fileData
			}, true);

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
		tItem.__delayed = da && daItem;
		tItem.__sortLabel = label;

		tItem.appendChild(tRow);
		var insPos = this.getSortedInsPos(parent, tItem);
		parent.insertBefore(tItem, insPos);

		this.rowsCache[tItem.__hash = shortcut + "-" + itemType] = tRow;
		return tItem;
	},
	getActionLabel: function(fo) {
		if(fo.custom)
			return fo.label || "";
		var act = fo.action;
		if(act in this.su.extLabels)
			return this.su.getExtLabel(act);
		return this.getLocalized(act);
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
				&& this.isValidFileData(this.ps.files[path]);
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
	get maxCodeLength() {
		delete this.maxCodeLength;
		return this.maxCodeLength = this.pu.get("sets.codeLengthLimit");
	},
	cropCode: function(code) {
		var maxLen = this.maxCodeLength;
		if(code.length > maxLen)
			return code.substr(0, maxLen) + "\n[\u2026]"; // "[...]"
		return code;
	},
	isBuggyFuncObj: function(fo, isCustom, label) {
		return !this.ps.isOkFuncObj(fo) || !isCustom && this.ut.isBuggyStr(label);
	},
	extPackages: {
		ext_mulipletabs: "multipletab",
		__proto__: null
	},
	extTypeNotAvailable: function(type) {
		return this.ps.isExtType(type)
			&& !this.ut.packageAvailable(this.extPackages[type]);
	},
	settingsEquals: function(savedObj, newObj) {
		if(!this.ps.settingsEquals(savedObj, newObj))
			return false;
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
	setNodeProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		var changed = false;
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			if(new RegExp("(?:^|\\s)" + p + "(?:\\s|$)").test(propsVal)) {
				if(!propsObj[p]) { // Remove
					propsVal = RegExp.leftContext + " " + RegExp.rightContext;
					changed = true;
				}
			}
			else if(propsObj[p]) { // Add
				propsVal = propsVal + " " + p;
				changed = true;
			}
		}
		changed && tar.setAttribute("properties", propsVal.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " "));
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
		var selIts = this.selectedItems;
		var noSel = !selIts.length;
		[
			"delete", "edit", "toggle",
			"partialExportToFile", "partialExportToClipboard",
			"exportToURI", "exportToHTML"
		].forEach(function(id) {
			this.$("hc-sets-cmd-" + id).setAttribute("disabled", noSel);
		}, this);
	},
	get selectedItems() {
		var rngCount = this.tSel.getRangeCount();
		if(rngCount == 0)
			return [];
		var tItemsArr = [];
		var start = {}, end = {}, tItem;
		for(var i = 0; i < rngCount; ++i) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; ++j) {
				tItem = this.getItemAtIndex(j);
				if(!tItem || !("__shortcut" in tItem))
					continue;
				//if(tItem.__isDelayed)
				//	tItem = tItem.parentNode.parentNode;
				tItemsArr.push(tItem);
				tItem.__index = j;
			}
		}
		tItemsArr.forEach(
			function(tItem, indx) {
				var daItem = !tItem.__isDelayed && tItem.__delayed;
				if(!daItem)
					return;
				var i; // Remove "delayed action", if main item is selected
				while((i = tItemsArr.lastIndexOf(daItem)) != -1)
					if(i != indx)
						delete tItemsArr[i];
			}
		);
		return tItemsArr.filter(function() { return true; }) // Remove deleted items
	},
	get selectedItemsWithCustomTypes() {
		return this.selectedItems.filter(
			function(it) {
				return it.__isCustomType;
			}
		);
	},
	getItemAtIndex: function(indx) {
		if(indx == -1 || indx >= this.tView.rowCount)
			return null;
		return this.tView.getItemAtIndex(indx); // <treeitem>
	},
	getRowForItem: function(item) {
		var chs = item.childNodes;
		for(var i = 0, len = chs.length; i < len; ++i)
			if(chs[i].localName == "treerow")
				return chs[i];
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
		var its = this.selectedItems;
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
		var its = this.selectedItems;
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
		var hasModifier = this.ut.hasModifier(e);
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
		var cIts = this.selectedItemsWithCustomTypes;
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
		tIts = tIts ? tIts.slice() : this.selectedItems;
		var itsCount = tIts.length;
		if(!itsCount)
			return [];

		const MAX_TYPE_LENGTH = 40;
		const MAX_LABEL_LENGTH = 50;
		const MAX_ROWS = 12;

		if(itsCount > MAX_ROWS)
			tIts.splice(MAX_ROWS - 2, itsCount - MAX_ROWS + 1, "\u2026" /* "..." */);
		var info = tIts.map(
			function(tItem, i) {
				if(typeof tItem == "string") // Cropped mark
					return tItem;
				var type = tItem.__itemType, sh = tItem.__shortcut;
				var mdfs = this.ps.getModifiersStr(sh);
				var button = this.ps.getButtonStr(sh, true);
				var typeLabel = this.cropStr(this.ps.getTypeLabel(type), MAX_TYPE_LENGTH);
				var fObj = this.ut.getOwnProperty(this.ps.prefs, sh, type);
				var dObj = this.ut.getOwnProperty(fObj, "delayedAction");
				var addLabel = "";
				if(tItem.__isDelayed) {
					typeLabel += " (" + this.getLocalized("delayed") + ")";
					fObj = dObj;
				}
				else {
					var daLabel = this.ut.isObject(dObj) && this.getActionLabel(fObj);
					if(daLabel)
						addLabel = "\n\t(" + this.getLocalized("delayed") + ": "
							+ this.cropStr(daLabel, MAX_LABEL_LENGTH) + ")";
				}
				var label = this.ut.isObject(fObj)
					? this.cropStr(this.getActionLabel(fObj), MAX_LABEL_LENGTH)
					: "?";
				var n = i + 1;
				if(n == MAX_ROWS)
					n = itsCount;
				return n + ". " + mdfs + " + " + button + " + " + typeLabel + " \u21d2 " /* "=>" */
					+ label + addLabel;
			},
			this
		);

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
		var tIts = this.selectedItems;
		if(
			!tIts.length
			|| !this.ut.confirm(
				this.getLocalized("title"),
				this.getLocalized("deleteConfirm").replace("%n", tIts.length)
					+ "\n\n" + this.getItemsInfo(tIts).join("\n")
			)
		)
			return;

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
		this.searchInSetsTree(true);
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
		var tBody = this.tBody;
		var tChld = tItem.parentNode;
		while(true) {
			tChld.removeChild(tItem);

			this.deleteCachedRow(tItem.__hash);
			if(tItem.__delayed)
				this.deleteCachedRow(tItem.__delayed.__hash);

			if(tChld.hasChildNodes() || tChld == tBody)
				break;

			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
		}
	},
	deleteCachedRow: function(hash) {
		var tRow = this.rowsCache[hash];
		if(tRow && /(?:^|\s)hc_buggy(?:\s|$)/.test(tRow.getAttribute("properties")))
			--this.counters.buggy;
		delete this.rowsCache[hash];
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

			this.toggleRowEnabled(rowIndx);
		}
		else { // Space button pressed
			var fe = document.commandDispatcher.focusedElement;
			if(!fe || fe.localName != "tree")
				return;
			var its = this.selectedItems;
			if(!its.length)
				return;
			its.forEach(function(tItem) {
				this.toggleRowEnabled(tItem.__index, forcedEnabled);
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
	toggleRowEnabled: function(rowIndx, forcedEnabled) {
		var tItem = this.getItemAtIndex(rowIndx);
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

		this.$("hc-sets-tree-find")           .setAttribute("disabled", !rowCount);

		var found = this.searcher.count > 0;
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
	smartSelect: function _ss(e) {
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

		var row = this.tbo.getRowAt(e.clientX, e.clientY);
		var et = e.type;
		if(row == -1)
			return;
		if(et == "mousedown") { // Start
			this.smartSelectStop();
			window.addEventListener("mouseup", this, true);
			_ss.row0 = row;
			return;
		}
		// mouseup or mousemove:
		var row0 = this.ut.getOwnProperty(_ss, "row0");
		if(row0 === undefined)
			return;
		var row1 = this.ut.getOwnProperty(_ss, "row1");
		_ss.row1 = row;

		if(!(row0 == row1 && row0 == row)) {
			if(row1 !== undefined)
				this.tSel.clearRange(row0, row1);
			if(row0 != row) {
				this.tSel.rangedSelect(row0, row, true);
				if(et == "mouseup") {
					this.delay(function() {
						this.tSel.rangedSelect(row0, row, true);
					}, this);
				}
			}
		}

		if(et == "mouseup") {
			this.smartSelectStop();
			return;
		}
		// mousemove:
		_ss.row1 = row;
		if(row <= this.tbo.getFirstVisibleRow() + 2)
			var visRow = row - 2;
		else if(row >= this.tbo.getLastVisibleRow() - 2)
			var visRow = row + 2;
		else
			return;
		var maxRowsIndx = this.tView.rowCount - 1;
		this.tbo.ensureRowIsVisible(this.ut.mm(visRow, 0, maxRowsIndx));
	},
	smartSelectStop: function() {
		this.smartSelect.row0 = this.smartSelect.row1 = undefined;
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

		if(this.ut.hasModifier(e))
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
		return this.treeBatch(this._toggleTreeContainers, this, arguments);
	},
	_toggleTreeContainers: function(expand) {
		expand = String(expand);
		Array.prototype.forEach.call(
			this.treeContainers,
			function(ti) {
				ti.setAttribute("open", expand);
			}
		);
	},
	expandTree: function() {
		this.toggleTreeContainers(true);
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
	expandTreeLevel: function() {
		return this.treeBatch(this._expandTreeLevel, this, arguments);
	},
	_expandTreeLevel: function(level) {
		this.expandTree();
		Array.prototype.filter.call(
			this.treeContainers,
			function(ti) {
				var curLevel = this.tView.getLevel(this.tView.getIndexOfItem(ti));
				return curLevel > level;
			},
			this
		).forEach(
			function(ti) {
				ti.setAttribute("open", "false");
			}
		);
	},

	treeHeaderClick: function(e) {
		if(e.button == 1)
			return this.toggleTreeContainers(!this.tBody.getElementsByAttribute("open", "true").length);
		if(this.ut.hasModifier(e))
			return this.toggleTreeContainers(e.button == 2);
		var level = this.maxExpandedLevel + (e.button == 2 ? 1 : -1);
		return this.expandTreeLevel(level);
	},

	isMenuButton: function(node) {
		// node.boxObject instanceof Components.interfaces.nsIMenuBoxObject
		return node.localName == "button" && node.getAttribute("type") == "menu";
	},
	openMenu: function(e) {
		var menu = e.originalTarget;
		if(!this.isMenuButton(menu))
			return;
		Array.prototype.concat.call(
			Array.prototype.slice.call(document.getElementsByTagName("*")),
			Array.prototype.slice.call(this.applyButton.parentNode.childNodes)
		).some(function(node) {
			if(this.isMenuButton(node) && node.open && node != menu) {
				node.open = false;
				menu.open = true;
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
				var props = tRow.getAttribute("properties") || "";
				props.split(/\s+/).forEach(function(prop) {
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
			if(/\S$/.test(val.substr(0, ifi.selectionStart)))
				ph = " " + ph;
			if(/^\S/.test(val.substr(ifi.selectionEnd)))
				ph += " ";
			editor.insertText(ph);
		}
		// Force call for old Firefox versions
		this.fireChange(this.searchField, "input");
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
	_searchTimeout: 0,
	_lastSearch: 0,
	searchPlaceholders: {
		hc_override:     "%ovr%",
		hc_new:          "%new%",
		hc_fileData:     "%data%",
		hc_custom:       "%custom%",
		hc_customFile:   "%file%",
		hc_customInit:   "%init%",
		hc_customType:   "%type%",
		hc_enabled:      "%on%",
		hc_disabled:     "%off%",
		hc_edited:       "%open%",
		hc_notAvailable: "%na%",
		hc_buggy:        "%bug%",
		__proto__: null
	},
	get searchReplacements() {
		delete this.searchReplacements;
		var sr = this.searchReplacements = { __proto__: null };
		var sp = this.searchPlaceholders;
		var s = "";
		for(var p in sp) {
			s += "\0";
			sr[p] = "\uffff" + s + "\uffff";
		}
		return sr;
	},
	toggleSearch: function(str, dontSelect) {
		this.doSearch(this.searchField.value == str ? "" : str, dontSelect);
	},
	doSearch: function(str, dontSelect) {
		this.searchField.value = str;
		this.searchInSetsTree(dontSelect);
	},
	searchInSetsTree: function(dontSelect, dontResetPosition) {
		if(this._searchTimeout)
			return;

		var remTime = this._lastSearch + this._searchDelay - Date.now();
		if(remTime > 0) {
			this._searchTimeout = this.delay(function() {
				this._searchTimeout = 0;
				this.searchInSetsTree.apply(this, arguments);
			}, this, remTime, arguments);
			return;
		}

		this.treeBatch(this._searchInSetsTree, this, arguments);
	},
	searchInSetsTreeDelay: function(dontSelect, dontResetPosition) {
		// Needs for undo/redo
		this.delay(this.searchInSetsTree, this, 0, arguments);
	},
	_searchInSetsTree: function(dontSelect, dontResetPosition) {
		var sf = this.searchField;
		var filterMode = this.$("hc-sets-tree-searchFilterMode").getAttribute("checked") == "true";

		var sTerm = sf.value;
		var checkFunc;
		var caseSensitive = false;
		var hasTerm = true;

		if(sTerm.indexOf("%") != -1) {
			var sp = this.searchPlaceholders;
			var sr = this.searchReplacements;
			for(var p in sp)
				sTerm = sTerm.replace(sp[p], sr[p]);
			sTerm = sTerm.replace("%dis%", sr.hc_disabled); //= Added: 2018-12-20
		}

		if(/^\/(.+)\/([im]{0,2})$/.test(sTerm)) { // /RegExp/flags
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
			var selectedRows = this.saveSelection();

		this._hasFilter && this._redrawTree(true);
		var tRow, rowText, okRow;
		var matchedRows = [];
		for(var h in this.rowsCache) {
			tRow = this.rowsCache[h];
			okRow = true;
			if(hasTerm) {
				rowText = this.getRowText(tRow, caseSensitive); //~ todo: cache?
				okRow = checkFunc(rowText);
			}
			var hl = hasTerm && okRow;
			this.setChildNodesProperties(tRow, { hc_search: hl }, true);
			tRow.parentNode.__matched = okRow;
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
				this.removeTreeitem(tItem);
			}
		}

		this.searcher.reset(dontResetPosition);
		matchedRows.forEach(function(tRow) {
			var indx = this.tView.getIndexOfItem(tRow.parentNode);
			this.searcher.add(indx);
		}, this);
		this.searcher.finish();

		if(dontSelect)
			this.restoreSelection(selectedRows);
		else
			found && this.searcher.select();

		this.$("hc-sets-tree-searchResults").value = matchedRows.length;
		sf.setAttribute("hc_notFound", hasTerm && !found);

		this._lastSearch = Date.now();
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
			var props = row.getAttribute("properties");
			var sr = this.searchReplacements;
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
		else if(pName == "sets.codeLengthLimit") {
			delete this.maxCodeLength;
			this.maxCodeLength = pVal;
			this.redrawTree();
		}
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
			onLeftClick: this.showBuggyPrefs,
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

		//~ todo:
		//   #hc-sets-warnMsgsPrefs-tooltip description { white-space: -moz-pre-wrap; }
		// for old Firefox versions (it's buggy in Firefox 1.5)?
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
		return this.ut.getLocalFile(this.ee.value);
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
		if(eeFile instanceof Components.interfaces.nsILocalFileWin) {
			var getVI = function(f) {
				try { return eeFile.getVersionInfoField(f) || ""; }
				catch(e) { return ""; }
			};
			var name = getVI("ProductName");
			var vers = getVI("ProductVersion");
			if(name)
				tt = name + (vers && vers != "0, 0, 0, 0" ? " " + vers : "");
			if(changed)
				this.setDefaultArgs(name);
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
		var argsField = this.$("hc-sets-externalEditorArgs");
		argsField.value = args;
		this.fireChange(argsField);
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
						this.fireChange(ee);
						break;
					}
				}
				if(e.keyCode != e.DOM_VK_RETURN)
					break;
				this.ut.stopEvent(e);
				if(!this.ut.hasModifier(e))
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

		var selIts = this.selectedItems;
		var noSel = !selIts.length;
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
		this.$("hc-sets-cmd-editType").setAttribute("disabled", noTypes);
		this.$("hc-sets-editType").hidden = noTypes;

		var noImport = !this._import;
		this.$("hc-sets-cmd-editSaved").setAttribute("disabled", noSel || noImport);
		this.$("hc-sets-editSaved").hidden = noImport;
		this.$("hc-sets-cmd-editSavedType").setAttribute("disabled", noTypes || noImport);
		this.$("hc-sets-editSavedType").hidden = noTypes || noImport;

		this.$("hc-sets-closeEditors-separator").hidden = (
			(this.$("hc-sets-closeEditors").hidden = !this.closeItemEditors(undefined, true))
			+ (this.$("hc-sets-closeSavedEditors").hidden = noImport || !this.closeItemEditors(false, true))
			+ (this.$("hc-sets-closeTypeEditors").hidden = noTypes || !this.closeItemTypeEditors(undefined, true))
			+ (this.$("hc-sets-closeSavedTypeEditors").hidden = noImport || noTypes || !this.closeItemTypeEditors(false, true))
		) == 4;

		return true;
	},

	reloadSettings: function() {
		this.reloadPrefpanes();
		this.initPrefs();
		//this.prefsSaved();

		this.updateAllDependencies();
		this.forceUpdTree();

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
				.map(
					function(pName) {
						return this.pu.prefNS + pName + "=" + this.pu.get(pName);
					},
					this
				).sort().join("\n");
		this.ut.writeToFile(data, file);
		this.backupsDir = file.parent;
		return true;
	},
	importPrefs: function() {
		var file = this.pickFile(this.getLocalized("importPrefs"), false, "ini");
		if(!file)
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
			var pStr = this.extractPrefs(!onlyCustomTypes);
			if(targetId == ct.EXPORT_CLIPBOARD_STRING)
				this.ut.copyStr(pStr);
			else if(targetId == ct.EXPORT_CLIPBOARD_URI)
				this.ut.copyStr(ct.PROTOCOL_SETTINGS_ADD + this.ps.encURI(pStr));
			else if(targetId == ct.EXPORT_CLIPBOARD_HTML) {
				var uri = ct.PROTOCOL_SETTINGS_ADD + this.ps.encURI(pStr);
				var label = this.extractLabels(!onlyCustomTypes).join(", ");
				var info = this.ut.encodeHTML(this.getItemsInfo().join(" \n"))
					.replace(/\n/g, "&#10;")
					.replace(/\u21d2/g, "&#8658;");
				this.ut.copyStr(
					'<a href="' + this.ut.encodeHTML(uri) + '" title="' + info + '">'
					+ this.ut.encodeHTML(label, false)
					+ "</a>"
				);
			}
			else
				this.ut.writeToFile(pStr, file);
		}
		else if(targetId == ct.EXPORT_FILEPICKER) {
			//this.ut.copyFileTo(this.ps.prefsFile, file.parent, file.leafName);
			var pStr = this.ps.getSettingsStr(null, null, true /*exportLinkedFiles*/);
			this.ut.writeToFile(pStr, file);
			file.lastModifiedTime = this.ps.prefsFile.lastModifiedTime;
		}
		else {
			throw new Error(this.errPrefix + "Full export to clipboard not supported");
		}
	},
	extractPrefs: function(extractShortcuts) {
		//~ todo: with "extractShortcuts == false" iser see empty tree on import
		var types = this.ps.types, newTypes = {};
		var prefs = this.ps.prefs, newPrefs = {};

		var its = extractShortcuts ? this.selectedItems : this.selectedItemsWithCustomTypes;
		its.forEach(
			function(it) {
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
			},
			this
		);

		this.setNodesProperties(its, { hc_copied: true });
		this.delay(function() {
			this.setNodesProperties(its, { hc_copied: false });
		}, this, 200);

		return this.ps.getSettingsStr(newTypes, newPrefs, true);
	},
	extractLabels: function(extractShortcuts) {
		var its = extractShortcuts ? this.selectedItems : this.selectedItemsWithCustomTypes;
		return its.map(
			function(it) {
				var fo = this.ut.getOwnProperty(this.ps.prefs, it.__shortcut, it.__itemType);
				return this.ut.isObject(fo) && this.getActionLabel(fo);
			},
			this
		).filter(function(label) {
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
				pSrc = this.pe.getBackupFile(data);
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
		this.setImportStatus(true, partialImport, srcId == 1 /* from clipboard */);
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
		this.ut.writeToFile(pStr, bFile);
		this.ut.notify(this.getLocalized("backupCreated").replace("%f", bFile.path), {
			onLeftClick: function() {
				this.reveal(bFile)
			},
			context: this
		});
	},
	removeBackup: function(mi, e) {
		var fName = mi.getAttribute("hc_fileName");
		if(!fName)
			return false;
		var file = this.pe.getBackupFile(fName);
		if(!file.exists()) {
			mi.parentNode.removeChild(mi);
			this.updRestorePopup();
			return false;
		}

		var dontAsk = this.ut.hasModifier(e) || e.type == "click";
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

		file.remove(false);
		mi.parentNode.removeChild(mi);
		this.updRestorePopup();
		return true;
	},
	initImportPopup: function() {
		this.checkClipboard();
		this.delay(this.buildRestorePopup, this);
	},
	destroyImportPopup: function() {
		this.destroyRestorePopup();
	},
	handleRestoreCommand: function(e) {
		var mi = e.target;
		if(!mi.hasAttribute("hc_fileName"))
			return;
		this.importSets(
			this.ut.hasModifier(e) || e.type == "click",
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

		var entries = this.ps.backupsDir.directoryEntries;
		var _fTerms = [], _files = {}, _fTime;
		var _ubTerms = [], _ubFiles = {}, _ubTime;

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
				!entry.isFile()
				|| !this.ut.hasPrefix(fName, fPrefix)
				|| !/\.js$/i.test(fName)
				|| fName == mainFile
				|| this.ut.hasPrefix(fName, corrupted)
			)
				continue;
			if(
				this.ut.hasPrefix(fName, userBackup)
				&& /-(\d{14})(?:-\d+)?\.js$/.test(fName)
			) {
				_ubTime = +RegExp.$1;
				if(!(_ubTime in _ubFiles))
					_ubFiles[_ubTime] = [];
				_ubFiles[_ubTime].push(entry);
				_ubTerms.push(_ubTime);
			}
			_fTime = entry.lastModifiedTime;
			if(!(_fTime in _files))
				_files[_fTime] = [];
			_files[_fTime].push(entry);
			_fTerms.push(_fTime);
		}
		var isEmpty = _fTerms.length == 0;
		var ubCount = _ubTerms.length;

		var bytes = this.getLocalized("bytes");
		var testBackupStatus = this.ut.storage("testBackupCreated") ? "thisSession" : "afterCrash";

		var df = document.createDocumentFragment();
		this.ut.sortAsNumbers(_fTerms).reverse().forEach(function(time) {
			var file = _files[time].shift();
			var fTime = new Date(time).toLocaleString();
			var fSize = file.fileSize.toString().replace(/(\d)(?=(?:\d{3})+(?:\D|$))/g, "$1 ");
			var fName = file.leafName;
			var fPath = file.path;
			df.appendChild(this.ut.createElement("menuitem", {
				label: fTime + " [" + fSize + " " + bytes + "] \u2013 " + fName,
				tooltiptext: fPath,
				hc_fileName: fName,
				hc_userBackup: this.ut.hasPrefix(fName, userBackup),
				hc_oldBackup: this.ut.hasPrefix(fName, oldBackup),
				hc_testBackup: this.ut.hasPrefix(fName, testBackup) && testBackupStatus
			}));
		}, this);

		var sep;
		for(;;) {
			sep = popup.firstChild;
			if(sep.localName == "menuseparator")
				break;
			popup.removeChild(sep);
		}
		popup.insertBefore(df, sep);
		_fTerms = _files = null;

		popup.__userBackups = this.ut.sortAsNumbers(_ubTerms).reverse().map(function(time) {
			return _ubFiles[time].shift(); // newest ... oldest
		});
		_ubTerms = _ubFiles = null;

		this.updRestorePopup(ubCount, isEmpty, true);
	},
	destroyRestorePopup: function() {
		delete this.ubPopup.__userBackups;
	},
	updRestorePopup: function(ubCount, isEmpty, dontCleanup) {
		var popup = this.ubPopup;
		if(ubCount === undefined)
			ubCount = popup.getElementsByAttribute("hc_userBackup", "true").length;
		if(isEmpty === undefined && !ubCount)
			isEmpty = popup.getElementsByAttribute("hc_fileName", "*").length == 0;
		var menu = popup.parentNode;
		menu.setAttribute("disabled", isEmpty);
		if(isEmpty)
			popup.hidePopup();
		if("__userBackups" in popup && !dontCleanup) this.delay(function() {
			popup.__userBackups = popup.__userBackups.filter(function(file) {
				return file.exists();
			});
		}, this);
		this.$("hc-sets-tree-removeUserBackupsExc10").setAttribute("disabled", ubCount <= 10);
		this.$("hc-sets-tree-removeUserBackupsExc1") .setAttribute("disabled", ubCount <= 1);

		var mi = this.$("hc-sets-tree-openBackupsDir");
		var isDarkFont = true;
		var fc = window.getComputedStyle(mi, null).color;
		if(/^rgb\((\d+), *(\d+), *(\d+)\)$/.test(fc)) {
			var r = +RegExp.$1, g = +RegExp.$2, b = +RegExp.$3;
			var brightness = Math.max(r/255, g/255, b/255); // HSV, 0..1
			isDarkFont = brightness < 0.4;
		}
		popup.setAttribute("hc_isDarkMenuFont", isDarkFont);
	},
	removeOldUserBackups: function(store) {
		var popup = this.ubPopup;
		var ub = popup.__userBackups;
		ub.slice(store, ub.length).forEach(
			function(file) {
				var fName = /[^\\\/]+$/.test(file.leafName) && RegExp.lastMatch;
				file.exists() && file.remove(false);
				Array.prototype.forEach.call(
					popup.getElementsByAttribute("hc_fileName", fName),
					function(mi) {
						mi.parentNode.removeChild(mi);
					}
				);
			}
		);
		popup.__userBackups = ub.slice(0, store);
		//this.buildRestorePopup();
		this.updRestorePopup(store);
	},
	reveal: function(file) {
		return this.ut.reveal(file);
	},

	setImportStatus: function(isImport, isPartial, fromClipboard, updMode) {
		this._import              = isImport;
		this._importPartial       = isImport && isPartial;
		this._importFromClipboard = isImport && fromClipboard;
		if(!updMode) {
			this.closeImportEditors();
			this.checkTreeSaved();
		}
		this.$("hc-sets-tree-importPanel").hidden = !isImport;
		if(!isImport) {
			this.cleanImportSearch() && this.searchInSetsTree(true);
			return;
		}

		this.$("hc-sets-tree-importType").value = isPartial;
		this.$("hc-sets-tree-importRowRemoved").setAttribute("hc_collapse", isPartial);
		if(
			Array.prototype.indexOf.call(
				this.$("hc-sets-tree-importPanel").getElementsByTagName("*"),
				document.commandDispatcher.focusedElement
			) == -1
		)
			this.$("hc-sets-tree-buttonImportOk").focus();
	},
	cleanImportSearch: function() {
		var search = this.searchField.value;
		var newSearch = search
			.replace(this.searchPlaceholders.hc_override, "")
			.replace(this.searchPlaceholders.hc_new, "");
		if(newSearch == search)
			return false;
		this.searchField.value = this.ut.trim(newSearch);
		return true;
	},
	toggleImportType: function(isPartial) {
		if(isPartial === undefined)
			isPartial = !this._importPartial;
		this.setImportStatus(this._import, isPartial, this._importFromClipboard, true);
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
		this._savedPrefs = this._savedTypes = null;
	},
	mergePrefs: function() {
		var types = this.ps.types;
		var prefs = this.ps.prefs;
		this.ps.loadSettings();

		var type, to, sh, so;

		for(type in types) if(types.hasOwnProperty(type)) {
			if(!this.ps.isCustomType(type))
				continue;
			to = types[type];
			if(!this.ps.isOkCustomObj(to))
				continue;
			this.ut.setOwnProperty(this.ps.types, type, to);
		}

		for(sh in prefs) if(prefs.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh))
				continue;
			so = prefs[sh];
			if(!this.ut.isObject(so))
				continue;
			for(type in so) if(so.hasOwnProperty(type)) {
				to = so[type];
				if(!this.ut.isObject(to))
					continue;
				this.ut.setOwnProperty(this.ps.prefs, sh, type, to);
			}
		}
	},
	isValidFileData: function(fo) {
		return this.ut.isObject(fo) && !!fo.data;
	},
	importFilesData: function() {
		var overwriteAsk = true, overwrite;
		var files = this.ps.files;
		for(var path in files) if(files.hasOwnProperty(path)) {
			var fo = files[path];
			if(!this.isValidFileData(fo)) {
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

	// Export/import utils:
	pickFile: function(pTitle, modeSave, ext, date) {
		var fp = this.ut.fp;
		fp.defaultString = this.ps.prefsFileName + (modeSave ? this.getFormattedDate(date) : "") + "." + ext;
		fp.defaultExtension = ext;
		fp.appendFilter(this.getLocalized("hcPrefsFiles"), "handyclicks_prefs*." + ext);
		fp.appendFilter(this.getLocalized(ext + "Files"), "*." + ext + (ext == "js" ? ";*.jsm" : ""));
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

	_res: [], // rows numbers
	_current: 0,
	_wrapped: false,
	reset: function(dontResetPosition) {
		this._res = [];
		if(!dontResetPosition)
			this._current = 0;
		this.wrapped = this._wrapped = false;
	},
	add: function(r) {
		this._res.push(r);
	},
	finish: function() {
		this.ut.sortAsNumbers(this._res);
	},
	get count() {
		return this._res.length;
	},
	next: function() {
		if(!this.isTreePaneSelected)
			return;
		if(++this._current >= this.count)
			this._wrapped = true, this._current = 0;
		this.select();
	},
	prev: function() {
		if(!this.isTreePaneSelected)
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
		var i = this._res[this._current];
		this.wrapped = this._wrapped;
		this._wrapped = false; // Reset flag
		this.treeBatch(function() {
			this.expandTree();
			this.tSel.select(i);
			this.scrollToRow(i);
		});
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
		this._res.forEach(function(i) {
			tSel.rangedSelect(i, i, true);
		});
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
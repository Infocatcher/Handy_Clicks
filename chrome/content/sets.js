var handyClicksSets = {
	_import: false,
	_importPartial: false,
	_importFromClipboard: false,
	_savedPrefs: null,
	_savedTypes: null,

	init: function(reloadFlag) {
		this.ps.loadSettings();
		this.initShortcuts();

		this[reloadFlag ? "redrawTree" : "drawTree"]();
		this.updTreeButtons();
		this.checkTreeSaved();
		this.ps.oSvc.addObserver(this.setsReloading, this);

		this.initPrefs();
		this.pu.oSvc.addObserver(this.prefsChanged, this);

		if(this.ut.fxVersion >= 3.5) {
			var sf = this.searchField;
			if(typeof sf._clearSearch == "function") {
				this._origClearSearch = sf._clearSearch;
				var hcs = this;
				sf._clearSearch = function() {
					var ret = hcs._origClearSearch.apply(this, arguments);
					hcs.searchInSetsTreeDelay();
					return ret;
				};
			}
		}
		if(this.pu.pref("sets.rememberSearchQuery")) {
			var sf = this.searchField;
			sf.value = this.pu.pref("sets.lastSearchQuery") || "";
			sf._enterSearch && sf._enterSearch();
		}
		this.focusSearch(true);
		this.searchInSetsTree(true);

		if(reloadFlag)
			this.setDialogButtons();
		else
			this.startupUI();

		if(this.ut.fxVersion >= 3.6) { // Fix wrong resizing after sizeToContent() call
			var de = document.documentElement;
			window.resizeTo(Number(de.width), Number(de.height));
		}

		window.addEventListener("mouseover", this, true);
	},
	initShortcuts: function() {
		var tr = this.tree = this.$("hc-sets-tree");
		var tView = this.tView = tr.view;
		this.tbo = tr.treeBoxObject;
		this.tBody = tr.body;
		this.tSel = tView.selection;
		this.searcher.__proto__ = this;

		this.applyButton = document.documentElement.getButton("extra1");
	},
	destroy: function(reloadFlag) {
		this.closeEditors();
		this.treeScrollPos(true);
		this.pu.pref(
			"sets.lastSearchQuery",
			this.pu.pref("sets.rememberSearchQuery")
				? this.searchField.value
				: ""
		);
		reloadFlag && this.setImportStatus(false);
		this.rowsCache = this._savedPrefs = this._savedTypes = null;

		window.removeEventListener("mouseover", this, true);
	},
	startupUI: function() {
		this.treeScrollPos(false);
		Array.forEach(
			this.$("hc-sets-tree-columns").getElementsByTagName("treecol"),
			function(col) {
				if(!col.tooltipText)
					col.tooltipText = col.getAttribute("label");
			}
		);
		this.instantApply = this.pu.getPref("browser.preferences.instantApply");
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

		this.applyButton.className += " hc-iconic hc-apply";
		this.applyButton.setAttribute("hc_key", "hc-sets-key-apply");
		this.su.setKeysDescDelay();

		if("MozTabSize" in de.style) // Firefox 4.0+
			this.e("hc-sets-tabSizeBox").removeAttribute("hidden");
	},
	handleEvent: function(e) {
		if(e.type == "mouseup") {
			this.smartSelect(e);
			this.ut.timeout(this.smartSelectStop, this, [], 10);
		}
		else if(e.type == "mouseover")
			this.openMenu(e);
	},
	closeEditors: function() {
		this.wu.forEachWindow(
			"handyclicks:editor",
			function(w) {
				if(!("_handyClicksInitialized" in w) || w.handyClicksPrefSvc.otherSrc)
					w.close();
			}
		);
	},
	treeScrollPos: function(saveFlag) {
		var tr = this.tree;
		var tbo = this.tbo;
		if(saveFlag) {
			tr.setAttribute("hc_firstVisibleRow", tbo.getFirstVisibleRow());
			tr.setAttribute("hc_lastVisibleRow", tbo.getLastVisibleRow());
			document.persist(tr.id, "hc_firstVisibleRow");
			document.persist(tr.id, "hc_lastVisibleRow");
			return;
		}
		if(!tr.hasAttribute("hc_firstVisibleRow"))
			return;
		var maxRowsIndx = this.tView.rowCount - 1;
		if(maxRowsIndx < 0)
			return;
		var fvr = Number(tr.getAttribute("hc_firstVisibleRow"));
		var lvr = Number(tr.getAttribute("hc_lastVisibleRow"));
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
	treeBatch: function(func, context, args) {
		var tbo = this.tbo;
		tbo.beginUpdateBatch();
		var ret = func.apply(context || this, args);
		tbo.endUpdateBatch();
		return ret;
	},
	drawTree: function() {
		return this.treeBatch(this._drawTree, this, arguments);
	},
	_drawTree: function() {
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.pref("delayedActionTimeout");
		this._daAfter = this.ut.getLocalized("after").replace("%t", daTime);
		this._forcedDisDa = daTime <= 0;
		this._expandDa = this.pu.pref("sets.treeExpandDelayedAction");
		this._localizeArgs = this.pu.pref("sets.localizeArguments");

		this._overrides = this._overrideDa = this._new = this._newDa = 0;
		this._buggy = 0;

		var drawMode = this.pu.pref("sets.treeDrawMode");
		var p = this.ps.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._warn(<>Invalid shortcut in prefs: "{sh}"</>);
				continue;
			}
			var so = p[sh];
			if(this.ut.isEmptyObj(so)) {
				this.ut._warn(<>Empty settings object in prefs: "{sh}"</>);
				//delete p[sh];
				continue;
			}
			switch(drawMode) {
				case 0:
				default: // Normal
					var button = this.ps.getButtonId(sh);
					var modifiers = this.ps.getModifiersStr(sh);
					var buttonContainer = this.eltsCache[button]
						|| this.appendContainerItem(this.tBody, button, this.ut.getLocalized(button));
					var modifiersContainer = this.eltsCache[sh]
						|| this.appendContainerItem(buttonContainer, sh, modifiers);
					this.appendItems(modifiersContainer, so, sh);
				break;
				case 1: // Normal (compact)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var label = button + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
					var buttonContainer = this.eltsCache[sh]
						|| this.appendContainerItem(this.tBody, sh, label);
					this.appendItems(buttonContainer, so, sh);
				break;
				case 2: // Normal (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = button + (modifiers ? sep + modifiers : "") + sep;
					for(var type in so) if(so.hasOwnProperty(type))
						this.appendRow(this.tBody, sh, type, so[type], label + this.ps.getTypeLabel(type));
				break;
				case 3: // Inverse
					var button = this.ps.getButtonId(sh);
					var buttonLabel = this.ut.getLocalized(button);
					var modifiers = this.ps.getModifiersStr(sh);
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(this.tBody, type, this.ps.getTypeLabel(type));
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
							|| this.appendContainerItem(this.tBody, type, this.ps.getTypeLabel(type));
						this.appendRow(typeContainer, sh, type, so[type], label);
					}
				break;
				case 5: // Inverse (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = sep + button + (modifiers ? sep + modifiers : "");
					for(var type in so) if(so.hasOwnProperty(type))
						this.eltsCache[type] = this.appendRow(
							this.tBody, sh, type, so[type], this.ps.getTypeLabel(type) + label, this.eltsCache[type] || null
						);
				break;
			}
		}
		this.markOpenedEditors();
		if(this._import)
			this.addImportStatistics();
		delete this.eltsCache;
		this._hasFilter = false;
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
				newTypes++;
			else if(!this.ut.objEquals(to, oldTo))
				overrideTypes++;
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
					deletable++;
				if(!this.ut.isObject(to))
					continue;
				var da = this.ut.getOwnProperty(to, "delayedAction");
				var newDa = this.ut.getOwnProperty(newTo, "delayedAction");
				if(da && !newDa)
					deletableDa++;
			}
		}

		for(var type in savedTypes) if(savedTypes.hasOwnProperty(type))
			if(savedTypes[type] && !this.ut.getOwnProperty(types, type))
				deletableTypes++;

		const id = "hc-sets-tree-import";
		this.$(id + "OverridesValue").value = <>{this._overrides}/{this._overrideDa} + {overrideTypes }</>;
		this.$(id + "NewValue")      .value = <>{this._new      }/{this._newDa     } + {newTypes      }</>;
		this.$(id + "DeletableValue").value = <>{deletable      }/{deletableDa     } + {deletableTypes}</>;
	},
	redrawTree: function() {
		return this.treeBatch(this._redrawTree, this, arguments);
	},
	_redrawTree: function(dontSearch) {
		this.ut.removeChilds(this.tBody);
		this._drawTree();
		!dontSearch && this.searchInSetsTree(true);
		this.setDialogButtons();
		//document.title = document.title.replace(/\*?$/, this.ps.otherSrc ? "*" : "");
	},
	updTree: function() {
		return this.treeBatch(this._updTree, this, arguments);
	},
	_updTree: function(saveClosed, saveSel) {
		if(saveClosed === undefined)
			saveClosed = true;
		if(saveSel === undefined)
			saveSel = true;

		if(saveClosed) {
			var collapsedRows = { __proto__: null };
			Array.forEach(
				this.treeContainers,
				function(ti) {
					if(ti.getAttribute("open") != "true")
						collapsedRows[ti.__hash] = true;
				}
			);
		}
		if(saveSel)
			var selectedRows = this.saveSelection();

		this._redrawTree();
		if(!this.tView.rowCount)
			return;

		saveClosed && Array.forEach(
			this.treeContainers,
			function(ti) {
				if(ti.__hash in collapsedRows)
					ti.setAttribute("open", "false");
			}
		);
		saveSel && this.restoreSelection(selectedRows);
	},
	saveSelection: function() {
		var selectedRows = { __proto__: null };
		var rngCount = this.tSel.getRangeCount();
		var start = {}, end = {};
		for(var i = 0; i < rngCount; i++) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; j++) {
				//var tItem = this.getItemAtIndex(j);
				var tItem = this.tView.getItemAtIndex(j);
				selectedRows[tItem.__hash] = true;
			}
		}
		return selectedRows;
	},
	restoreSelection: function(selectedRows) {
		Array.forEach(
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
			this.setItemStatus(rowId, false);
		var wProp = this.wu.winIdProp;
		var otherSrc = this.ps.otherSrc;
		this.wu.forEachWindow(
			"handyclicks:editor",
			function(w) {
				if(wProp in w)
					this.setItemStatus(w[wProp], w.handyClicksPrefSvc.otherSrc == otherSrc);
			},
			this
		);
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem = this.ut.parseFromXML(
			<treeitem xmlns={this.ut.XULNS} container="true" open="true">
				<treerow>
					<treecell label={label} />
				</treerow>
				<treechildren />
			</treeitem>
		);
		parent.appendChild(tItem);
		tItem.__hash = hash;
		return this.eltsCache[hash] = tItem.getElementsByTagName("treechildren")[0];
	},
	appendItems: function(parent, items, shortcut) {
		for(var itemType in items) if(items.hasOwnProperty(itemType))
			this.appendRow(parent, shortcut, itemType, items[itemType]);
	},
	appendRow: function(parent, shortcut, itemType, fo, forcedLabel, insAfter) {
		var tItem = document.createElement("treeitem");
		var tRow = document.createElement("treerow");
		if(!this.ut.isObject(fo))
			fo = {};
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = this.ps.getTypeLabel(itemType, isCustomType);

		this.appendTreeCell(tRow, "label", forcedLabel || typeLabel);
		this.appendTreeCell(tRow, "label", fo.eventType);
		var actLabel = this.getActionLabel(fo);
		this.appendTreeCell(tRow, "label", actLabel);
		this.appendTreeCell(tRow, "label", this.getActionCode(fo.action, isCustom));
		this.appendTreeCell(tRow, "label", this.getArguments(fo.arguments || {}, this._localizeArgs));
		this.appendTreeCell(tRow, "label", this.getInitCode(fo, true));

		var da = this.ut.getOwnProperty(fo, "delayedAction");
		if(da) {
			tItem.setAttribute("container", "true");
			if(this._expandDa)
				tItem.setAttribute("open", "true");
			var daChild = document.createElement("treechildren");
			var daItem = document.createElement("treeitem");
			var daRow = document.createElement("treerow");

			if(!this.ut.isObject(da))
				da = {};

			this.appendTreeCell(daRow, "label", this.ut.getLocalized("delayed"));
			this.appendTreeCell(daRow, "label", this._daAfter);

			var daCustom = !!da.custom;
			var daLabel = this.getActionLabel(da);
			this.appendTreeCell(daRow, "label", daLabel);
			this.appendTreeCell(daRow, "label", this.getActionCode(da.action, daCustom));
			this.appendTreeCell(daRow, "label", this.getArguments(da.arguments || {}, this._localizeArgs));
			this.appendTreeCell(daRow, "label", this.getInitCode(da, true));

			this.setClildsProperties(daRow, {
				hc_disabled: this._forcedDisDa || !fo.enabled || !da.enabled,
				hc_buggy: this.isBuggyFuncObj(da, daCustom, daLabel) && ++this._buggy,
				hc_custom: daCustom,
				hc_customType: isCustomType
			}, true);

			this.setNodeProperties(
				this.appendTreeCell(daRow, "value", da.enabled), // checkbox
				{ hc_checkbox: true }
			);

			if(this._import) { //~ todo: test!
				var savedDa = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
				var overrideDa = savedDa;
				var equalsDa = this.ut.objEquals(da, savedDa);
				this.setClildsProperties(daRow, {
					hc_override: overrideDa && !equalsDa && ++this._overrideDa,
					hc_equals:   overrideDa &&  equalsDa,
					hc_new:     !overrideDa &&              ++this._newDa
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
			this.appendTreeCell(tRow, "value", fo.enabled), // checkbox
			{ hc_checkbox: true }
		);

		var isBuggy = this.isBuggyFuncObj(fo, isCustom, actLabel)
			|| (
				isCustomType && !this.ps.isOkCustomType(itemType)
				|| this.ut.isBuggyStr(typeLabel)
			);

		this.setClildsProperties(tRow, {
			hc_disabled: !fo.enabled,
			hc_buggy: isBuggy && ++this._buggy,
			hc_custom: isCustom,
			hc_customType: isCustomType
		}, true);
		if(this._import) { //~ todo: test!
			var saved = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType);

			// Ignore delayed actions:
			if(savedDa)
				saved.delayedAction = null;
			if(da)
				fo.delayedAction = null;

			var override = saved;
			var equals = this.ut.objEquals(fo, saved);
			if(isCustomType) {
				var newType = this.ut.getOwnProperty(this.ps.types, itemType);
				var savedType = this.ut.getOwnProperty(this._savedTypes, itemType);
				var eqType = this.ut.objEquals(newType, savedType);
				if(!eqType && (saved || savedType))
					override = true;
				equals = equals && eqType;
			}
			this.setClildsProperties(tRow, {
				hc_override: override && !equals && ++this._overrides,
				hc_equals:   override &&  equals,
				hc_new:     !override            && ++this._new
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

		tItem.appendChild(tRow);
		//parent.appendChild(tItem);
		parent.insertBefore(tItem, insAfter && insAfter.nextSibling);
		this.rowsCache[tItem.__hash = shortcut + "-" + itemType] = tRow;
		return tItem;
	},
	getActionLabel: function(fo) {
		if(fo.custom)
			return this.ps.dec(fo.label);
		var act = fo.action;
		if(act in this.su.extLabels)
			return this.su.getExtLabel(act);
		return this.ut.getLocalized(act);
	},
	getActionCode: function(action, isCustom) {
		return isCustom
			? this.ut.getLocalized("customFunction") + (this.oldTree ? " " : "\n") + this.ps.dec(action)
			: action;
	},
	getInitCode: function(fo) {
		var init = this.ut.getOwnProperty(fo, "init");
		return init
			? this.getActionCode(init, true)
			: "";
	},
	isBuggyFuncObj: function(fo, isCustom, label) {
		return !this.ps.isOkFuncObj(fo) || !isCustom && this.ut.isBuggyStr(label);
	},
	setNodeProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		var changed = false;
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			//propsVal = propsVal.replace(new RegExp("(?:^|\\s)" + p + "(?:\\s|$)"), " ");
			//if(propsObj[p])
			//	propsVal += " " + p;
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
	setClildsProperties: function(parent, propsObj, addToParent) {
		if(addToParent)
			this.setNodeProperties(parent, propsObj);
		Array.forEach(
			parent.getElementsByTagName("*"),
			function(elt) {
				this.setNodeProperties(elt, propsObj);
			},
			this
		);
	},
	setNodesProperties: function(parents, propsObj, addToParent) {
		Array.forEach(
			parents,
			function(parent) {
				this.setClildsProperties(parent, propsObj, addToParent);
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
		return res.join(this.oldTree ? ", " : ",\n ");
	},
	getLocalizedArguments: function(argsObj, p) {
		var argVal = argsObj[p];
		return typeof argVal == "boolean"
			? this.ut.getLocalized(p) + ": " + this.ut.getLocalized(argVal ? "yes" : "no")
			: this.ut.getLocalized(p) + " " + this.ut.getLocalized(p + "[" + argVal + "]");
	},
	getRawArguments: function(argsObj, p) {
		return p + " = " + uneval(argsObj[p]);
	},
	updTreeButtons: function() {
		var selIts = this.selectedItems;
		var noSel = !selIts.length;
		["delete", "edit", "toggle", "partialExportToFile", "partialExportToClipboard", "exportToURI"].forEach(
			function(id) {
				this.$("hc-sets-cmd-" + id).setAttribute("disabled", noSel);
			},
			this
		);
		this.$("hc-sets-cmd-enable").setAttribute(
			"disabled",
			noSel || !selIts.some(function(it) { return !this.checkedState(it); }, this)
		);
		this.$("hc-sets-cmd-disable").setAttribute(
			"disabled",
			noSel || !selIts.some(function(it) { return this.checkedState(it); }, this)
		);
		var noTypes = noSel || !selIts.some(function(it) { return it.__isCustomType; });
		this.$("hc-sets-cmd-editType").setAttribute("disabled", noTypes);
		this.$("hc-sets-editType").hidden = noTypes;
	},
	get selectedItems() {
		var rngCount = this.tSel.getRangeCount();
		if(rngCount == 0)
			return [];
		var tItemsArr = [];
		var start = {}, end = {}, tItem;
		for(var i = 0; i < rngCount; i++) {
			this.tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; j++) {
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
		for(var i = 0, len = chs.length; i < len; i++)
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
		var n = Array.indexOf(panes, prefWin.currentPane) + (nextFlag ? 1 : -1);
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
	editItems: function(e) {
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
		its.forEach(function(it) {
			this.openEditorWindow(it, this.ct.EDITOR_MODE_SHORTCUT);
		}, this);
	},
	editItemsTypes: function() {
		if(!this.isTreePaneSelected)
			return;
		var cIts = this.selectedItemsWithCustomTypes;
		if(this.editorsLimit(cIts.length))
			return;
		cIts.forEach(function(it) {
			this.openEditorWindow(it, this.ct.EDITOR_MODE_TYPE);
		}, this);
	},
	editorsLimit: function(count) {
		var lim = this.pu.pref("sets.openEditorsLimit");
		if(lim <= 0 || count <= lim)
			return false;
		this.ut.fixMinimized();
		var ask = { value: false };
		var cnf = this.ut.promptsSvc.confirmCheck(
			window, this.ut.getLocalized("warningTitle"),
			this.ut.getLocalized("openEditorsWarning").replace("%n", count),
			this.ut.getLocalized("dontAskAgain"), ask
		);
		if(!cnf)
			return true;
		if(ask.value)
			this.pu.pref("sets.openEditorsLimit", 0);
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
	deleteItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var tIts = this.selectedItems;
		if(!tIts.length)
			return;

		const MAX_TYPE_LENGTH = 40;
		const MAX_LABEL_LENGTH = 50;
		const MAX_ROWS = 12;
		var delInfo = tIts.map(
			function(tItem, i) {
				var type = tItem.__itemType, sh = tItem.__shortcut;
				var mdfs = this.ps.getModifiersStr(sh);
				var button = this.ps.getButtonStr(sh, true);
				var typeLabel = this.cropStr(this.ps.getTypeLabel(type), MAX_TYPE_LENGTH);
				var fObj = this.ut.getOwnProperty(this.ps.prefs, sh, type);
				var dObj = this.ut.getOwnProperty(fObj, "delayedAction");
				var addLabel = "";
				if(tItem.__isDelayed) {
					typeLabel += " (" + this.ut.getLocalized("delayed") + ")";
					fObj = dObj;
				}
				else {
					var daLabel = this.ut.isObject(dObj) && this.getActionLabel(fObj);
					if(daLabel)
						addLabel = "\n\t(" + this.ut.getLocalized("delayed") + ": "
							+ this.cropStr(daLabel, MAX_LABEL_LENGTH) + ")";
				}
				var label = this.ut.isObject(fObj)
					? this.cropStr(this.getActionLabel(fObj), MAX_LABEL_LENGTH)
					: "?";
				return (i + 1) + ". " + mdfs + " + " + button + " + " + typeLabel + " \u21d2 " /* "=>" */
					+ label + addLabel;
			},
			this
		);
		if(delInfo.length > MAX_ROWS)
			delInfo.splice(MAX_ROWS - 2, delInfo.length - MAX_ROWS + 1, "\u2026" /* "..." */);
		delInfo = delInfo.join("\n");

		if(
			!this.ut.confirm(
				this.ut.getLocalized("title"),
				this.ut.getLocalized("deleteConfirm").replace("%n", tIts.length)
					+ "\n\n" + delInfo
			)
		)
			return;

		//tIts.forEach(this.deleteItem, this);
		this.treeBatch(function() {
			tIts.forEach(this.deleteItem, this);
		});

		this.checkTreeSaved();
		if(this.instantApply)
			this.saveSettingsObjectsCheck(true);
		else {
			this.ps.otherSrc && this.ps.reloadSettings(true /* reloadAll */);
			this.setDialogButtons();
		}
		this.searchInSetsTree(true);
	},
	cropStr: function(str, maxLen) {
		return str.length > maxLen
			? str.substr(0, maxLen - 1) + "\u2026" /* "..." */
			: str;
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

			delete this.rowsCache[tItem.__hash];

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

			delete this.rowsCache[tItem.__hash];
			if(tItem.__delayed)
				delete this.rowsCache[tItem.__delayed.__hash];

			if(tChld.hasChildNodes() || tChld == tBody)
				break;

			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
		}
	},
	openEditorWindow: function(tItem, mode, add) { // mode: this.ct.EDITOR_MODE_*
		var shortcut = tItem
			? tItem.__shortcut
			: undefined;
		var itemType = tItem && add !== true
			? tItem.__itemType
			: undefined;
		var isDelayed = tItem && add !== true && tItem.__isDelayed;
		this.wu.openEditor(this.ps.currentSrc, mode || this.ct.EDITOR_MODE_SHORTCUT, shortcut, itemType, isDelayed);
	},
	setItemStatus: function(rowId, editStat) {
		if(!rowId)
			return;
		rowId = this.ut.removePostfix(rowId, this.ct.OTHER_SRC_POSTFIX);
		if(!(rowId in this.rowsCache))
			return;
		this.setClildsProperties(
			this.rowsCache[rowId].parentNode, // <treeitem>
			{ hc_edited: editStat }
		);
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
		this.ps.otherSrc && this.ps.reloadSettings(true /* applyFlag */);
		if(this.instantApply && !this.ps.otherSrc)
			this.saveSettingsObjectsCheck(true);
		this.checkTreeSaved();
		this.setDialogButtons();
		this.updTreeButtons();
	},
	toggleRowEnabled: function(rowIndx, forcedEnabled) {
		var tItem = this.getItemAtIndex(rowIndx);
		var tRow = this.getRowForItem(tItem);
		var enabled = this.checkedState(tItem, forcedEnabled === undefined ? null : forcedEnabled);
		var forcedDisDa = this.pu.pref("delayedActionTimeout") <= 0;
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
		for(var i = 0; i < rngCount; i++) {
			tSel.getRangeAt(i, start, end);
			for(var j = start.value, l = end.value; j <= l; j++)
				selected++;
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
		for(var t = 0; t < rngCount; t++) {
			tSel.getRangeAt(t, start, end);
			for(var i = start.value; i <= end.value; i++)
				selectedRows[i] = false;
		}
		this.treeBatch(function() {
			tSel.clearSelection();
			for(var i = 0, rowsCount = this.tView.rowCount; i < rowsCount; i++)
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
				if(et == "mouseup")
					setTimeout(function(_this, row0, row) {
						_this.tSel.rangedSelect(row0, row, true);
					}, 0, this, row0, row);
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
		var tdm = this.pu.pref("sets.treeDrawMode");
		if(tdm < 0 || tdm > 5) // see drawTree() and switch(drawMode) { ... }
			tdm = 0;
		var checkbox = mp.getElementsByAttribute("value", tdm);
		checkbox.length && checkbox[0].setAttribute("checked", "true");
		this.$("hc-sets-tree-toggleColored").setAttribute("checked", this.tree.getAttribute("hc_colored") == "true");
		var closeMenu = this.pu.pref("sets.closeTreeViewMenu") ? "auto" : "none";
		Array.forEach(
			mp.getElementsByTagName("menuitem"),
			function(mi) {
				mi.setAttribute("closemenu", closeMenu);
				if(mi.hasAttribute("hc_pref"))
					mi.setAttribute("checked", this.pu.pref(mi.getAttribute("hc_pref")));
			},
			this
		);
	},
	viewMenuCommand: function(e, popup) {
		var mi = e.target;
		if(mi.hasAttribute("value"))
			this.setDrawMode(mi.value);
		else if(mi.hasAttribute("hc_pref")) {
			var pName = mi.getAttribute("hc_pref");
			this.pu.pref(pName, !this.pu.pref(pName)); // => prefsChanged()
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
			if(this.pu.pref("sets.closeTreeViewMenu"))
				return;
		}
		popup.hidePopup();
	},
	setDrawMode: function(dm) {
		// <preference instantApply="true" ... /> is bad on slow devices (it saves prefs.js file)
		this.pu.pref("sets.treeDrawMode", Number(dm)); // => prefsChanged()
	},
	toggleColored: function() {
		var tr = this.tree;
		tr.setAttribute("hc_colored", tr.getAttribute("hc_colored") != "true");
	},

	get treeContainers() {
		return this.tBody.getElementsByAttribute("container", "true");
	},
	toggleTreeContainers: function() {
		return this.treeBatch(this._toggleTreeContainers, this, arguments);
	},
	_toggleTreeContainers: function(expand) {
		expand = String(expand);
		Array.forEach(
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
		Array.forEach(
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
		Array.filter(
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
		Array.concat(
			Array.slice(document.getElementsByTagName("*")),
			Array.slice(this.applyButton.parentNode.childNodes)
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

	searcher: {
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
				this.tbo.ensureRowIsVisible(i);
			});
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
		_unwrapTimeout: null,
		_unwrapDelay: 700,
		set wrapped(val) {
			clearTimeout(this._unwrapTimeout);
			this.searchField.setAttribute("hc_wrapped", val);
			if(!val)
				return;
			this._unwrapTimeout = setTimeout(function(_this) {
				_this.searchField.setAttribute("hc_wrapped", "false");
			}, this._unwrapDelay, this);
		}
	},
	navigateSearchResults: function(e) {
		var code = e.keyCode;
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
	_searchTimeout: null,
	_lastSearch: 0,
	searchInSetsTree: function() {
		if(this._searchTimeout)
			return;

		var remTime = this._lastSearch + this._searchDelay - Date.now();
		if(remTime > 0) {
			this._searchTimeout = setTimeout(
				function(_this, args) {
					_this._searchTimeout = null;
					args.callee.apply(_this, args);
				},
				remTime,
				this, arguments
			);
			return;
		}

		this.treeBatch(this._searchInSetsTree, this, arguments);
	},
	searchInSetsTreeDelay: function() {
		// Needs for undo/redo
		this.ut.timeout(this.searchInSetsTree, this, arguments, 0);
	},
	_searchInSetsTree: function(dontSelect, dontResetPosition) {
		var sf = this.searchField;
		var filterMode = this.$("hc-sets-tree-searchFilterMode").getAttribute("checked") == "true";

		var sTerm = sf.value;
		var checkFunc;
		var caseSensitive = false;
		var hasTerm = true;

		if(/^\/(.+)\/([im]{0,2})$/.test(sTerm)) { // /RegExp/flags
			try {
				sTerm = new RegExp(RegExp.$1, RegExp.$2);
				var _ = this.ut.bind(this.ut._log, this.ut);
				checkFunc = function(rowText) {
					//_(rowText, sTerm.test(rowText));
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
			else { // Threat spaces as "and"
				sTerm = this.ut.trim(sTerm).toLowerCase();
				if(!sTerm)
					hasTerm = false;
				sTerm = sTerm.split(/\s+/);
				checkFunc = function(rowText) {
					return sTerm.every(function(s) { return rowText.indexOf(s) != -1; });
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
			this.setClildsProperties(tRow, { hc_search: hl }, true);
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
			Array.forEach(
				this.getRowForItem(tItem).getElementsByAttribute("label", "*"),
				function(elt) {
					var label = elt.getAttribute("label");
					label && rowText.push(label);
				},
				this
			);
		}
		while(tChld != tBody);
		rowText = rowText.join("\n");
		return caseSensitive ? rowText : rowText.toLowerCase();
	},

	/*** Prefs pane ***/
	_updPrefsUITimeout: null,
	prefsChanged: function(pName, pVal) {
		if(pName == "sets.treeDrawMode")
			this.redrawTree();
		else if(pName == "sets.treeExpandDelayedAction")
			this.updTree(false);
		else if(pName == "sets.localizeArguments")
			this.updTree();
		else if(this.ut.hasPrefix(pName, "editor.externalEditor")) {
			this.initExternalEditor();
			this.updateAllDependencies("externalEditor");
		}
		else if(this.warnMsgsPrefs.indexOf(pName) != -1)
			this.initResetWarnMsgs();
		else if(pName == "disallowMousemoveButtons") {
			this.setDisallowMousemove();
			this.updateAllDependencies("disallowMousemove");
		}
		else if(pName == "editor.tabSymbol")
			this.setTabulation();
		else if(this.ut.hasPrefix(pName, "ui.action"))
			this.loadUIAction();
		else {
			this.updateAllDependencies();
			clearTimeout(this._updPrefsUITimeout);
			this._updPrefsUITimeout = setTimeout(function(_this) {
				_this.setDialogButtons();
			}, 10, this);
		}
	},
	initPrefs: function() {
		this.setDisallowMousemove();
		this.initExternalEditor();
		this.initResetWarnMsgs();
		this.setTabulation();
		this.loadUIAction();
		this.updateAllDependencies();
	},
	setDisallowMousemove: function() {
		var buttons = this.pu.pref("disallowMousemoveButtons") || "";
		for(var i = 0; i <= 2; i++)
			this.$("hc-sets-disallowMousemove-" + i).checked = buttons.indexOf(i) != -1;
	},
	get disallowMousemoveButtons() {
		var val = "";
		for(var i = 0; i <= 2; i++)
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
		var tb = document.getElementsByAttribute("preference", <>action-{type}-{button}</>);
		return tb.length ? tb[0] : null;
	},
	loadUIAction: function() {
		var tb = this.currentActionTextbox;
		if(!tb)
			return;
		this.$("hc-sets-action-value").value = tb.value || this.pu.pref(this.currentActionPref);
		this.$("hc-sets-action-reset").setAttribute(
			"disabled",
			!this.pu.prefSvc.prefHasUserValue(this.pu.prefNS + this.currentActionPref)
		);
		const ns = this.pu.prefNS + "ui.action";
		var hasChanged = this.pu.prefSvc.getBranch(ns)
			.getChildList("", {})
			.some(function(pName) {
				return this.pu.prefSvc.prefHasUserValue(ns + pName);
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
		}
	},
	resetUIAction: function() {
		//if(!this.resetPrefsConfirmed)
		//	return;
		this.pu.resetPref(this.pu.prefNS + this.currentActionPref);
	},
	resetAllUIActions: function() {
		if(!this.resetPrefsConfirmed)
			return;
		const ns = this.pu.prefNS + "ui.action";
		this.pu.prefSvc.getBranch(ns)
			.getChildList("", {})
			.forEach(function(pName) {
				this.pu.resetPref(ns + pName);
			}, this);
	},
	get minSpaces() {
		delete this.minSpaces;
		return this.minSpaces = this.$("hc-sets-tabulationSpaces").getAttribute("min");
	},
	get maxSpaces() {
		delete this.maxSpaces;
		return this.maxSpaces = this.$("hc-sets-tabulationSpaces").getAttribute("max");
	},
	setTabulation: function() {
		var ts = this.pu.pref("editor.tabSymbol");
		var rg = this.$("hc-sets-tabulation");
		var sp = this.$("hc-sets-tabulationSpaces");
		var custom = this.$("hc-sets-tabulationCustom");
		var si = 2;
		if(ts == "\t") {
			si = 0;
			sp.value = 8;
		}
		else if(/^ +$/.test(ts) && ts.length >= this.minSpaces && ts.length <= this.maxSpaces) {
			si = 1;
			sp.value = ts.length;
		}
		else {
			custom.value = ts;
		}
		rg.selectedIndex = si;
		this.$("hc-sets-tabulationRadioCustom").hidden = custom.hidden = si != 2;
	},
	get tabulation() {
		var rg = this.$("hc-sets-tabulation");
		var sp = this.$("hc-sets-tabulationSpaces");
		var si = rg.selectedIndex;
		if(si == 0)
			return "\t";
		if(si == 1) {
			var n = this.ut.mm(Number(this.$("hc-sets-tabulationSpaces").value) || 8, this.minSpaces, this.maxSpaces);
			return new Array(n + 1).join(" ");
		}
		return this.$("hc-sets-tabulationCustom").value || "\t";
	},
	selectTabulation: function(rg) {
		var si = rg.selectedItem;
		var dis = false;
		Array.forEach(
			rg.getElementsByTagName("*"),
			function(ch) {
				if(ch.localName == "radio") {
					dis = ch != si;
					return;
				}
				ch.disabled = dis;
			}
		);
	},
	saveSettings: function(applyFlag) {
		this.pu.pref("disallowMousemoveButtons", this.disallowMousemoveButtons);
		this.pu.pref("editor.tabSymbol", this.tabulation);
		if(applyFlag && !this.instantApply)
			this.savePrefpanes();
		var saved = true;
		if(this.ps.otherSrc)
			this.ps.reloadSettings(applyFlag);
		else
			saved = this.saveSettingsObjectsCheck(applyFlag);
		this.setDialogButtons();
		if(
			saved
			&& !applyFlag && this.ps.otherSrc
			&& !this.ut.confirm(this.ut.getLocalized("title"), this.ut.getLocalized("importIncomplete"))
		)
			return false;
		return saved;
	},
	buggyPrefsConfirm: function() {
		return !this._buggy || this.ut.confirmEx(
			this.ut.getLocalized("warningTitle"),
			this.ut.getLocalized("saveBuggyConfirm").replace("%n", this._buggy),
			this.ut.getLocalized("save")
		);
	},
	saveSettingsObjectsCheck: function(reloadFlag) {
		if(!this.buggyPrefsConfirm())
			return false;
		this.ps.saveSettingsObjects(reloadFlag);
		this.setDialogButtons();
		return true;
	},
	savePrefpanes: function() {
		Array.forEach(
			document.getElementsByTagName("prefpane"),
			function(pp) {
				pp.writePreferences(false /* aFlushToDisk */);
			}
		);
		this.pu.savePrefFile();
		//this.prefsSaved();
		this.setDialogButtons();
	},
	reloadPrefpanes: function() {
		Array.forEach(
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
		"ui.notifyUnsaved"
	],
	initResetWarnMsgs: function() {
		var notChanged = true;
		var disabled = this.warnMsgsPrefs.filter(function(pName) {
			if(this.pu.pref(pName))
				return false;
			notChanged = false;
			return true;
		}, this);

		var tt = this.$("hc-sets-warnMsgsPrefs-tooltip");
		//~ todo:
		//   #hc-sets-warnMsgsPrefs-tooltip description { white-space: -moz-pre-wrap; }
		// for old Firefox versions (it's buggy in Firefox 1.5)?
		if(disabled.length) {
			//this.ut.removeChilds(tt);
			var ttSep = this.$("hc-sets-warnMsgsPrefs-tooltipSep");
			while(ttSep.nextSibling)
				tt.removeChild(ttSep.nextSibling);
			disabled.forEach(function(pName, i) {
				if(i != 0) {
					var sep = ttSep.cloneNode(true);
					sep.removeAttribute("id");
					tt.appendChild(sep);
				}
				var desc = document.createElement("description");
				var text;
				switch(pName) {
					case "sets.importJSWarning":
						text = this.ut.getLocalized("importSetsWarning");
					break;
					case "sets.openEditorsLimit":
						text = this.ut.getLocalized("openEditorsWarning").replace("%n", "N");
					break;
					case "sets.removeBackupConfirm":
						text = this.ut.getLocalized("removeBackupConfirm").replace("%f", this.ps.prefsFileName + ".js");
					break;
					case "ui.notifyUnsaved":
						text = this.ut.getLocalized("notifyUnsaved");
				}
				desc.textContent = text || pName;
				tt.appendChild(desc);
			}, this);
		}

		this.$("hc-sets-resetWarnMsgs").disabled = notChanged;
	},
	resetWarnMsgs: function() {
		this.warnMsgsPrefs.forEach(function(pName) {
			this.resetPref(pName);
		}, this);
	},
	get ee() {
		return this.$("hc-sets-externalEditorPath");
	},
	get eeFile() {
		return this.ut.getLocalFile(this.ee.value);
	},
	selectExternalEditor: function() {
		var ee = this.ee;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		fp.appendFilters(fp.filterApps);
		fp.appendFilters(fp.filterAll);
		var curDir = this.eeFile;
		if(curDir && curDir.exists()) {
			if(!curDir.isDirectory())
				curDir = this.ut.getFileParent(curDir);
			if(curDir)
				fp.displayDirectory = curDir;
		}
		fp.init(window, this.ut.getLocalized("selectEditor"), fp.modeOpen);
		if(fp.show() != fp.returnOK)
			return;
		ee.value = fp.file.path;
		this.fireChange(ee);
	},
	makeRelativePath: function() {
		var ee = this.ee;
		var path = ee.value.replace(/^[a-z]:\\/, function(s) { return s.toUpperCase(); });

		var resPath, resLevel, resLength;
		[
			"ProgF", "LocalAppData", "ProfD", "Home", "SysD", "WinD",// "XCurProcD",
			"UsrApp", "LocApp",
			"Locl", "LibD",
			"_SysDrv"//, "_ProfDrv"
		].forEach(function(alias) {
			var aliasFile = this.ut.getFileByAlias(alias, true), aliasPath, aliasLength;
			for(var level = 0; aliasFile; aliasFile = this.ut.getFileParent(aliasFile), level++) {
				aliasPath = aliasFile.path;
				aliasLength = aliasPath.length;
				if(
					!this.ut.hasPrefix(path, aliasPath)
					|| !/\/|\\/.test(path.substr(aliasLength - 1, 2))
					|| resPath && (level > resLevel || level == resLevel && aliasLength < resLength)
				)
					continue;
				var sep = RegExp.lastMatch; // \ or /
				resPath = path.substr(aliasLength);
				resPath = "%" + alias + "%"
					+ new Array(level + 1).join(sep + "..")
					+ (resPath.charAt(0) == sep ? "" : sep) + resPath;
				resLevel = level;
				resLength = aliasLength;
			}
		}, this);

		if(!resPath || resPath == path)
			return;
		ee.value = resPath;
		this.fireChange(ee);
	},
	makeNormalPath: function() {
		var file = this.eeFile;
		if(!file)
			return;
		var ee = this.ee;
		ee.value = file.path;
		this.fireChange(ee);
	},
	convertPath: function() {
		if(/^%[^%]+%/.test(this.ee.value))
			this.makeNormalPath();
		else
			this.makeRelativePath();
	},
	initExternalEditor: function _iee(delay) {
		if(delay) {
			this.ut.timeout(_iee, this, [], 5);
			return;
		}
		var eeFile = this.eeFile;
		var img = this.$("hc-sets-externalEditorIcon");
		if(eeFile && eeFile.exists()) {
			img.src = "moz-icon:file://" + eeFile.path.replace(/\\/g, "/") + "?size=16";
			img.setAttribute("hc_validPath", "true");
		}
		else {
			img.src = "";
			img.setAttribute("hc_validPath", "false");
		}
		var butt = this.$("hc-sets-externalEditorButton");
		var isRelative = /^%[^%]+%/.test(this.ee.value);
		butt.setAttribute(
			"label",
			butt.getAttribute(isRelative ? "hc_labelMakeAbsolute" : "hc_labelMakeRelative")
		);
		img.removeAttribute("tooltiptext");
		var tt = "";
		if(eeFile instanceof Components.interfaces.nsILocalFileWin) try {
			var name = eeFile.getVersionInfoField("ProductName")    || "";
			var vers = eeFile.getVersionInfoField("ProductVersion") || "";
			tt = name + (name && vers ? " " + vers : vers);
		}
		catch(e) {
		}
		if(isRelative)
			tt += (tt ? "\n" : "") + eeFile.path;
		this.ut.attribute(img, "tooltiptext", tt);
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
	fireChange: function(node) {
		var evt = document.createEvent("Events");
		evt.initEvent("change", true, true);
		node.dispatchEvent(evt);
	},

	checkSaved: function() {
		if(!this.hasUnsaved)
			return true;
		var res = this.su.notifyUnsaved();
		if(res == this.su.PROMPT_CANCEL)
			return false;
		if(res == this.su.PROMPT_SAVE)
			this.saveSettings();
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
			: this.ps.getSettingsStr() != this.ps._savedStr;
	},
	get prefsUnsaved() { //~ todo: this is buggy
		return Array.some(
			document.getElementsByTagName("preference"),
			function(ps) {
				// Sometimes value are not updated after actions like Ctrl+Z
				var elts = document.getElementsByAttribute("preference", ps.id);
				if(elts.length)
					ps.value = ps.getElementValue(elts[0]);

				return ps.value != ps.valueFromPreferences; // May be string and number on Firefox 3.0
			},
			this
		)
		|| this.disallowMousemoveButtons != this.pu.pref("disallowMousemoveButtons")
		|| this.tabulation != this.pu.pref("editor.tabSymbol");
	},
	get hasUnsaved() {
		return this.instantApply
			? false
			: this.treeUnsaved || this.prefsUnsaved;
	},

	dataChanged: function(e, tar) {
		if(!tar) {
			// Strange things may happens after Ctrl+(Shift+)Z
			this.ut.timeout(arguments.callee, this, [e, e.target], 5);
			return;
		}
		//var tar = e.target;
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
			this.updateDependencies(tar, true);
		if(tar.hasAttribute("preference")) {
			var p = this.$(tar.getAttribute("preference"));
			if(p.getAttribute("instantApply") == "true" || p.getAttribute("hc_instantApply") == "true")
				return;
		}
		else if(ln != "checkbox" && ln != "radio" && ln != "textbox")
			return;
		if(this.instantApply)
			this.saveSettings();
		else {
			//this.ut.timeout(this.setDialogButtons, this, [], 5);
			this.setDialogButtons();
			//this.applyButton.disabled = this._prefsSaved = false;
		}
	},
	updateAllDependencies: function(depId) {
		Array.forEach(
			document.getElementsByAttribute("hc_requiredFor", depId || "*"),
			this.updateDependencies,
			this
		);
	},
	updateDependencies: function(it, checkAll) {
		var checkParent = it.getAttribute("hc_checkParent") == "true";
		if(checkParent && checkAll !== true)
			return;
		var dis = false;
		if(it.hasAttribute("hc_disabledValues"))
			dis = new RegExp("(?:^|\\s)" + it.value.replace(/[\\^$+*?()\[\]{}]/g, "\\$&") + "(?:\\s|$)")
				.test(it.getAttribute("hc_disabledValues"));
		else if(it.hasAttribute("hc_enabledRegExp"))
			dis = !new RegExp(it.getAttribute("hc_enabledRegExp")).test(it.value);
		else if(it.hasAttribute("checked") && !checkParent)
			dis = it.getAttribute("checked") != "true";
		else {
			dis = Array.every(
				(checkParent ? it.parentNode : it).getElementsByTagName("checkbox"),
				function(ch) {
					return ch.getAttribute("checked") != "true";
				}
			);
		}
		it.getAttribute("hc_requiredFor").split(/\s+/).forEach(
			function(req) {
				Array.forEach(
					document.getElementsByAttribute("hc_depends", req),
					function(dep) {
						this.disableChilds(dep, dis);
					},
					this
				);
			},
			this
		);
	},
	disableChilds: function(parent, dis) {
		parent.disabled = dis;
		Array.forEach(
			parent.getElementsByTagName("*"),
			function(elt) {
				elt.disabled = dis;
			}
		);
	},
	checkTreeContext: function() {
		var ln = document.popupNode.localName;
		return ln == "treechildren" || ln == "tree";
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
	get resetPrefsConfirmed() {
		return this.ut.confirm(
			this.ut.getLocalized("warningTitle"),
			this.ut.getLocalized("resetPrefsWarning")
		);
	},
	resetPrefs: function() {
		if(!this.resetPrefsConfirmed)
			return;
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(this.resetPref, this);
		this.reloadPrefpanes(); // Changed prefs don't reloaded by default
	},
	resetPref: function(pName) {
		this.pu.resetPref(this.pu.prefNS + pName);
	},
	// Export/import:
	exportPrefsHeader: "[Handy Clicks settings]",
	exportPrefs: function() {
		var file = this.pickFile(this.ut.getLocalized("exportPrefs"), true, "ini");
		if(!file)
			return;
		var data = this.exportPrefsHeader + "\n"
			+ this.pu.prefSvc.getBranch(this.pu.prefNS)
				.getChildList("", {})
				.map(
					function(pName) {
						return this.pu.prefNS + pName + "=" + this.pu.pref(pName);
					},
					this
				).sort().join("\n");
		this.ut.writeToFile(data, file);
		this.backupsDir = file.parent.path;
	},
	importPrefs: function() {
		var file = this.pickFile(this.ut.getLocalized("importPrefs"), false, "ini");
		if(!file)
			return;
		var str = this.ut.readFromFile(file);
		if(!this.ut.hasPrefix(str, this.exportPrefsHeader)) {
			this.ut.alert(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFormat")
			);
			return;
		}
		this.backupsDir = file.parent.path;
		var _oldPrefs = [];
		this.pu.pref("prefsVersion", 0);
		str.replace(/[\r\n]{1,100}/g, "\n").split(/[\r\n]+/)
			.splice(1) // Remove header
			.forEach(function(line, i) {
				var first = line.charAt(0);
				if(
					first == ";" || first == "#"
					|| first == "[" && line.charAt(line.length - 1) == "]"
				)
					return; // Just for fun right now :)
				var indx = line.indexOf("=");
				if(indx == -1) {
					this.ut._warn(<>[Import INI] Skipped invalid line #{i + 2}: "{line}"</>);
					return;
				}
				var pName = line.substr(0, indx);
				if(!this.ut.hasPrefix(pName, this.pu.prefNS)) {
					this.ut._warn(<>[Import INI] Skipped pref with invalid name: "{pName}"</>);
					return;
				}
				var pbr = this.pu.pBr;
				var pType = this.pu.prefSvc.getPrefType(pName);
				var isOld = pType == pbr.PREF_INVALID; // Old format?
				if(isOld) {
					_oldPrefs.push(pName);
					this.ut._warn(<>[Import INI] Old pref: "{pName}"</>);
				}
				var pVal = line.substr(indx + 1);
				if(pType == pbr.PREF_INT || isOld && /^-?\d+$/.test(pVal)) // Convert string to number
					pVal = Number(pVal);
				else if(pType == pbr.PREF_BOOL || isOld && (pVal == "true" || pVal == "false")) // ...or boolean
					pVal = pVal == "true";
				this.pu.setPref(pName, pVal);
			}, this);
		this.pu.prefsMigration();
		_oldPrefs.forEach(function(pName) {
			this.pu.prefSvc.deleteBranch(pName);
		}, this);
		this.pu.savePrefFile();
		this.reloadPrefpanes(); // Changed prefs don't reloaded by default
	},

	// Clicking options management
	// Export/import:
	exportSets: function(partialExport, targetId, onlyCustomTypes) {
		if(typeof document == "object")
			this.selectTreePane();
		var ct = this.ct;
		if(targetId == ct.EXPORT_FILEPICKER) {
			var file = this.pickFile(
				this.ut.getLocalized("exportSets"), true, "js",
				!partialExport && this.ps.prefsFile.lastModifiedTime
			);
			if(!file)
				return;
			this.backupsDir = file.parent.path;
		}
		if(partialExport) {
			var pStr = this.extractPrefs(!onlyCustomTypes);
			if(targetId == ct.EXPORT_CLIPBOARD_STRING)
				this.ut.copyStr(pStr);
			else if(targetId == ct.EXPORT_CLIPBOARD_URI)
				this.ut.copyStr(ct.PROTOCOL_SETTINGS_ADD + this.ps.encURI(pStr));
			else
				this.ut.writeToFile(pStr, file);
		}
		else // Do not start full export to clipboard!
			this.ps.prefsFile.copyTo(file.parent, file.leafName);
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
		setTimeout(function(_this, its) {
			_this.setNodesProperties(its, { hc_copied: false });
		}, 200, this, its);

		return this.ps.getSettingsStr(newTypes, newPrefs);
	},
	importSets: function(partialImport, srcId, data) {
		this.selectTreePane();
		if(this.pu.pref("sets.importJSWarning")) {
			this.ut.fixMinimized();
			var ask = { value: false };
			var cnf = this.ut.promptsSvc.confirmCheck(
				window, this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("importSetsWarning"),
				this.ut.getLocalized("importSetsWarningNotShowAgain"), ask
			);
			if(!cnf)
				return;
			this.pu.pref("sets.importJSWarning", !ask.value);
		}
		var pSrc;
		var ct = this.ct;
		switch(srcId) {
			default:
			case ct.IMPORT_FILEPICKER:
				pSrc = this.pickFile(this.ut.getLocalized("importSets"), false, "js");
				if(!pSrc)
					return;
			break;
			case ct.IMPORT_CLIPBOARD:
				pSrc = this.ps.clipboardPrefs; // Valid or empty
				var fromClip = true;
			break;
			case ct.IMPORT_STRING:
				pSrc = this.ps.getPrefsStr(data);
			break;
			case ct.IMPORT_BACKUP:
				pSrc = this.ps.getFile(data);
		}
		//if(!pSrc)
		//	return;
		if(fromClip ? !pSrc : !this.ps.checkPrefs(pSrc)) {
			this.ut.alert(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFormat")
					+ (this.ps._hashError ? this.ut.getLocalized("invalidHash") : "")
			);
			return;
		}
		if(
			this.ps._hashMissing
			&& !this.ut.confirmEx(
				this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("hashMissingConfirm"),
				this.ut.getLocalized("continueImport")
			)
		)
			return;
		if(!this.ps.otherSrc) {
			this._savedPrefs = this.ps.prefs;
			this._savedTypes = this.ps.types;
		}
		this.ps.loadSettings(pSrc);
		this.setDialogButtons();
		//this.ps.reloadSettings(false);
		if(this.ps._loadStatus)
			return;
		this.setImportStatus(true, partialImport, srcId == 1 /* from clipboard */);
		if(partialImport)
			this.redrawTree();
		else
			this.updTree();
		if(pSrc instanceof Components.interfaces.nsILocalFile && !pSrc.parent.equals(this.ps._prefsDir))
			this.backupsDir = pSrc.parent.path;
	},
	createBackup: function() {
		var bName = this.ps.prefsFileName + this.ps.names.userBackup + new Date().toLocaleFormat("%Y%m%d%H%M%S");
		var bFile, i = 0;
		do bFile = this.ps.getFile(bName + (i++ ? "-" + i : "") + ".js");
		while(bFile.exists());
		this.ps.prefsFile.copyTo(null, bFile.leafName);
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized("backupCreated").replace("%f", bFile.leafName), null,
			this.ut.bind(this.reveal, this, [bFile])
		);
	},
	removeBackup: function(mi, dontAsk) {
		var fName = mi.getAttribute("hc_fileName");
		if(!fName)
			return false;
		var file = this.ps.getFile(fName);
		if(!file.exists()) {
			mi.parentNode.removeChild(mi);
			this.updRestorePopup();
			return false;
		}

		if(!dontAsk && this.pu.pref("sets.removeBackupConfirm")) {
			this.ut.closeMenus(mi);
			this.ut.fixMinimized();
			var ask = { value: false };
			var cnf = this.ut.promptsSvc.confirmCheck(
				window, this.ut.getLocalized("title"),
				this.ut.getLocalized("removeBackupConfirm").replace("%f", fName),
				this.ut.getLocalized("dontAskAgain"), ask
			);
			if(!cnf)
				return false;
			if(ask.value)
				this.pu.pref("sets.removeBackupConfirm", false);
		}

		file.remove(false);
		mi.parentNode.removeChild(mi);
		this.updRestorePopup();
		return true;
	},
	handleRestoreCommand: function(e) {
		var mi = e.target;
		if(!mi.hasAttribute("hc_fileName"))
			return;
		var butt = "button" in e && e.button;
		if(e.type == "command" || butt == 1) {
			var hasModifier = this.ut.hasModifier(e);
			this.importSets(hasModifier || butt == 1/*partialImport*/, this.ct.IMPORT_BACKUP, mi.getAttribute("hc_fileName"));
			this.ut.closeMenus(mi);
		}
		else if(butt == 2)
			this.removeBackup(mi, e.shiftKey);
	},
	get ubPopup() {
		delete this.ubPopup;
		return this.ubPopup = this.$("hc-sets-tree-restoreFromBackupPopup");
	},
	buildRestorePopup: function() {
		var popup = this.ubPopup;
		//this.ut.removeChilds(popup);
		var sep;
		for(;;) {
			sep = popup.firstChild;
			if(sep.localName == "menuseparator")
				break;
			popup.removeChild(sep);
		}

		var entries = this.ps.prefsDir.directoryEntries;
		var entry, fName;
		var _fTerms = [], _files = {}, _fTime;
		var _ubTerms = [], _ubFiles = {}, _ubTime;

		const fPrefix = this.ps.prefsFileName;
		const mainFile   = fPrefix + ".js";
		const corrupted  = fPrefix + this.ps.names.corrupted;
		const userBackup = fPrefix + this.ps.names.userBackup;
		const oldBackup  = fPrefix + this.ps.names.version;
		const testBackup = fPrefix + this.ps.names.testBackup;

		while(entries.hasMoreElements()) {
			entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			fName = entry.leafName;
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
				_ubTime = Number(RegExp.$1);
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

		var bytes = this.ut.getLocalized("bytes");
		var testBackupStatus = this.ut.storage("testBackupCreated") ? "thisSession" : "afterCrash";

		this.ut.sortAsNumbers(_fTerms).reverse().forEach(
			function(time) {
				var file = _files[time].shift();
				var fTime = new Date(time).toLocaleString();
				var fSize = file.fileSize.toString().replace(/(\d)(?=(?:\d{3})+(?:\D|$))/g, "$1 ");
				var fName = file.leafName;
				var fPath = file.path;
				popup.insertBefore(this.ut.parseFromXML(
					<menuitem xmlns={this.ut.XULNS}
						label={ fTime + " [" + fSize + " " + bytes + "] \u2013 " + fName }
						class="menuitem-iconic"
						image={ "moz-icon:file://" + fPath.replace(/\\/g, "/") + "?size=16" }
						tooltiptext={fPath}
						hc_fileName={fName}
						hc_userBackup={ this.ut.hasPrefix(fName, userBackup) }
						hc_oldBackup={  this.ut.hasPrefix(fName, oldBackup) }
						hc_testBackup={ testBackupStatus && this.ut.hasPrefix(fName, testBackup) }
					/>
				), sep);
			},
			this
		);
		_fTerms = _files = null;

		popup.__userBackups = this.ut.sortAsNumbers(_ubTerms).reverse().map(function(time) {
			return _ubFiles[time].shift(); // newest ... oldest
		});
		_ubTerms = _ubFiles = null;

		this.updRestorePopup(ubCount, isEmpty);
	},
	destroyRestorePopup: function() {
		delete this.ubPopup.__userBackups;
	},
	updRestorePopup: function(ubCount, isEmpty) {
		var popup = this.ubPopup;
		if(ubCount === undefined)
			ubCount = popup.getElementsByAttribute("hc_userBackup", "true").length;
		if(isEmpty === undefined && !ubCount)
			isEmpty = popup.getElementsByAttribute("hc_fileName", "*").length == 0;
		var menu = popup.parentNode;
		menu.setAttribute("disabled", isEmpty);
		if(isEmpty)
			popup.hidePopup();
		this.$("hc-sets-tree-removeUserBackupsExc10").setAttribute("disabled", ubCount <= 10);
		this.$("hc-sets-tree-removeAllUserBackups")  .setAttribute("disabled", ubCount == 0);
	},
	removeOldUserBackups: function(store) {
		var popup = this.ubPopup;
		var ub = popup.__userBackups;
		ub.slice(store, ub.length).forEach(
			function(file) {
				var fName = /[^\\\/]+$/.test(file.leafName) && RegExp.lastMatch;
				file.remove(false);
				Array.forEach(
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
		// Based on code of function showDownload() from chrome://mozapps/content/downloads/downloads.js in Firefox 3.6
		// See https://developer.mozilla.org/en/nsILocalFile#Remarks
		var nsilf = Components.interfaces.nsILocalFile;
		if(!(file instanceof nsilf))
			return false;
		try {
			file.reveal();
			return true;
		}
		catch(e) {
			this.ut._err(e);
		}
		if(!file.isDirectory()) {
			file = file.parent.QueryInterface(nsilf);
			if(!file)
				return false;
		}
		try {
			file.launch();
			return true;
		}
		catch(e) {
			this.ut._err(e);
		}
		var uri = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
			.newFileURI(file);
		Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
			.getService(Components.interfaces.nsIExternalProtocolService)
			.loadUrl(uri);
		return true;
	},

	setImportStatus: function(isImport, isPartial, fromClipboard, updMode) {
		this._import              = isImport;
		this._importPartial       = isImport && isPartial;
		this._importFromClipboard = isImport && fromClipboard;
		if(!updMode) {
			this.closeEditors();
			if(this.prefsSaved)
				this.applyButton.disabled = true;
		}
		var panel = this.$("hc-sets-tree-importPanel");
		panel.hidden = !isImport;
		if(!isImport)
			return;
		const lAttr = "hc_label" + (isPartial ? "Partial" : "Full");
		Array.forEach(
			panel.getElementsByAttribute(lAttr, "*"),
			function(elt) {
				elt.setAttribute("label", elt.getAttribute(lAttr));
			}
		);

		// Set same width to Ok and Cancel buttons:
		var okBtn = this.$("hc-sets-tree-buttonImportOk");
		var cancelBtn = this.$("hc-sets-tree-buttonImportCancel");
		okBtn.width = cancelBtn.width = null; // Reset width
		okBtn.width = cancelBtn.width = Math.max(okBtn.boxObject.width, cancelBtn.boxObject.width);

		this.$("hc-sets-tree-importRowDeletable").hidden = this._importPartial;

		!updMode && okBtn.focus();
	},
	toggleImportType: function() {
		this.setImportStatus(this._import, !this._importPartial, this._importFromClipboard, true);
	},
	importDone: function(ok) {
		if(ok && !this.buggyPrefsConfirm())
			return;

		var isPartial = this._importPartial;
		//var fromClip = this._importFromClipboard;
		this.setImportStatus(false);
		if(ok) {
			this.ps.checkForBackup();
			// Keep prefs file because content of new file may be equals!
			this.ps.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport, null, true);

			this.ps.otherSrc = false;
			isPartial && this.mergePrefs();
			this.ps.saveSettingsObjects(true);
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

	// Export/import utils:
	pickFile: function(pTitle, modeSave, ext, date) {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		fp.defaultString = this.ps.prefsFileName + (modeSave ? this.getFormattedDate(date) : "") + "." + ext;
		fp.defaultExtension = ext;
		fp.appendFilter(this.ut.getLocalized("hcPrefsFiles"), "handyclicks_prefs*." + ext);
		fp.appendFilter(this.ut.getLocalized(ext + "Files"), "*." + ext);
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
		var path = this.pu.pref("sets.backupsDir");
		if(!path)
			return null;
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			file.initWithPath(path);
		}
		catch(e) {
			return null;
		}
		return file.exists() && file.isDirectory() && file;
	},
	set backupsDir(path) {
		this.pu.pref("sets.backupsDir", path);
	},
	getFormattedDate: function(date) {
		var df = this.pu.pref("sets.dateFormat") || "";
		return df && (date ? new Date(date) : new Date()).toLocaleFormat(df);
	},

	checkClipboard: function() {
		this.$("hc-sets-cmd-partialImportFromClipboard").setAttribute("disabled", !this.ps.clipboardPrefs);
	}
};
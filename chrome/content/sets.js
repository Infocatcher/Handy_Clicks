var handyClicksSets = {
	_import: false,
	_partialImport: false,
	_importFromClipboard: false,
	_savedPrefs: null,
	_savedTypes: null,

	init: function(reloadFlag) {
		this.ps.loadSettings();
		this.initShortcuts();

		if(reloadFlag)
			this.redrawTree();
		else
			this.drawTree();

		this.updButtons();
		this.ps.oSvc.addObserver(this.updTree, this);

		this.updPrefsUI();
		this.pu.oSvc.addObserver(this.updPrefsUI, this);

		if(this.ut.fxVersion >= 3.5) {
			var s = this.$("hc-sets-tree-searchField");
			s.type = "search";
			s._clearSearch = function() { this.value = ""; this.oninput && this.oninput(); };
		}

		this.instantApply = this.pu.getPref("browser.preferences.instantApply");
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;
		var de = document.documentElement;
		var prefsButt = de.getButton("extra2");
		prefsButt.setAttribute("popup", "hc-sets-prefsManagementPopup");
		prefsButt.setAttribute("type", "menu");
		Array.forEach(
			this.$("hc-sets-tree-columns").getElementsByTagName("treecol"),
			function(col) {
				if(!col.tooltipText)
					col.tooltipText = col.getAttribute("label");
			}
		);
		this.focusSearch();
		this.treeScrollPos(false);
		if(this.ut.fxVersion >= 3.6) // Fix wrong restoring
			window.resizeTo(Number(de.width), Number(de.height));
	},
	initShortcuts: function() {
		var tr = this.tree = this.$("hc-sets-tree");
		this.tbo = tr.treeBoxObject;
		this.tView = tr.view;
		this.tSel = this.tView.selection;
		this.tBody = tr.body;
		this.searcher.init(this, tr, this.$("hc-sets-tree-searchField"));

		this.applyButton = document.documentElement.getButton("extra1");
	},
	destroy: function(reloadFlag) {
		this.closeEditors();
		this.treeScrollPos(true);
		reloadFlag && this.setImportStatus(false);
		delete this.rowsCache;
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
		var tr = this.tree, tb = this.tbo;
		if(saveFlag) {
			tr.setAttribute("hc_firstVisibleRow", tb.getFirstVisibleRow());
			tr.setAttribute("hc_lastVisibleRow", tb.getLastVisibleRow());
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
		this.tbo.scrollToRow(this.ut.mm(fvr, 0, maxRowsIndx));
	},

	/*** Actions pane ***/
	_prefsSaved: true,
	get prefsSaved() {
		return this.instantApply || this._prefsSaved;
	},

	drawTree: function() {
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.pref("delayedActionTimeout");
		this._daAfter = this.ut.getLocalized("after").replace("%t", daTime);
		this._forcedDisDa = daTime <= 0;
		this._expandDa = this.pu.pref("sets.treeExpandDelayedAction");
		this._localizeArgs = this.pu.pref("sets.localizeArguments");

		this._overrides = this._overridesDa = this._new = this._newDa = 0;

		var drawMode = this.pu.pref("sets.treeDrawMode");
		var p = this.ps.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._err(new Error("Invalid shortcut in prefs: \"" + sh + "\""), true);
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
					this.appendItems(modifiersContainer, p[sh], sh);
				break;
				case 1: // Normal (compact)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var label = button + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
					var buttonContainer = this.eltsCache[sh]
						|| this.appendContainerItem(this.tBody, sh, label);
					this.appendItems(buttonContainer, p[sh], sh);
				break;
				case 2: // Normal (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = button + (modifiers ? sep + modifiers : "") + sep;
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type))
						this.appendRow(this.tBody, sh, type, so[type], label + this.getTypeLabel(type));
				break;
				case 3: // Inverse
					var button = this.ps.getButtonId(sh);
					var buttonLabel = this.ut.getLocalized(button);
					var modifiers = this.ps.getModifiersStr(sh);
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(this.tBody, type, this.getTypeLabel(type));
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
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(this.tBody, type, this.getTypeLabel(type));
						this.appendRow(typeContainer, sh, type, so[type], label);
					}
				break;
				case 5: // Inverse (inline)
					var button = this.ps.getButtonStr(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var sep = " " + this.ps.keys.sep + " ";
					var label = sep + button + (modifiers ? sep + modifiers : "");
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type))
						this.eltsCache[type] = this.appendRow(
							this.tBody, sh, type, so[type], this.getTypeLabel(type) + label, this.eltsCache[type] || null
						);
				break;
			}
		}
		this.markOpenedEditors();
		if(this._import) {
			this.$("hc-sets-tree-importOverridesValue").value = this._overrides + "/" + this._overridesDa;
			this.$("hc-sets-tree-importNewValue")      .value = this._new       + "/" + this._newDa;
		}
		delete this.eltsCache;
	},
	markOpenedEditors: function() {
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
	redrawTree: function() {
		var cnt = this.tBody;
		this.ut.removeChilds(cnt);
		this.drawTree();
		this.searchInSetsTree(null, true);
		if(this.prefsSaved && !this.ps.otherSrc)
			this.applyButton.disabled = true;
		document.title = document.title.replace(/\*?$/, this.ps.otherSrc ? "*" : "");
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
		return this.eltsCache[hash] = tItem.getElementsByTagName("treechildren")[0];
	},
	appendItems: function(parent, items, shortcut) {
		for(var itemType in items) if(items.hasOwnProperty(itemType))
			this.appendRow(parent, shortcut, itemType, items[itemType]);
	},
	appendRow: function(parent, shortcut, itemType, fo, forcedLabel, insAfter) {
		var tItem = document.createElement("treeitem");
		var tRow = document.createElement("treerow");
		if(!this.ut.canHasProps(fo))
			fo = {};
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = forcedLabel || this.getTypeLabel(itemType, isCustomType);
		this.appendTreeCell(tRow, "label", typeLabel);
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

			if(!this.ut.canHasProps(da))
				da = {};

			this.appendTreeCell(daRow, "label", this.ut.getLocalized("delayed"));
			this.appendTreeCell(daRow, "label", this._daAfter);

			var daCustom = !!da.custom;
			var daLabel = this.getActionLabel(da);
			this.appendTreeCell(daRow, "label", daLabel);
			this.appendTreeCell(daRow, "label", this.getActionCode(da.action, daCustom));
			this.appendTreeCell(daRow, "label", this.getArguments(da.arguments || {}, this._localizeArgs));
			this.appendTreeCell(daRow, "label", this.getInitCode(da, true));

			this.addClildsProperties(daRow, {
				hc_disabled: this._forcedDisDa || !fo.enabled || !da.enabled,
				hc_buggy: this.isBuggyFuncObj(da, daCustom, daLabel),
				hc_custom: daCustom,
				hc_customType: isCustomType
			}, true);

			this.addProperties(
				this.appendTreeCell(daRow, "value", da.enabled), // checkbox
				{ hc_checkbox: true }
			);

			if(this._import) { //~ todo: test!
				var savedDa = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
				var overrideDa = savedDa;
				var equalsDa = this.ut.objEquals(da, savedDa);
				this.addClildsProperties(daRow, {
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

			this.rowsCache[shortcut + "-" + itemType + "-delayed"] = daRow; // Uses for search
		}

		this.addProperties(
			this.appendTreeCell(tRow, "value", fo.enabled), // checkbox
			{ hc_checkbox: true }
		);

		var isBuggy = this.isBuggyFuncObj(fo, isCustom, actLabel)
			|| (
				isCustomType && !this.ps.isOkCustomType(itemType)
				|| this.ut.isBuggyStr(typeLabel)
			);

		this.addClildsProperties(tRow, {
			hc_disabled: !fo.enabled,
			hc_buggy: isBuggy,
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
				var savedType = this.ut.getOwnProperty(this._savedTypes, itemType);
				var eqType = this.ut.objEquals(this.ut.getOwnProperty(this.ps.types, itemType), savedType);
				if(!eqType && (saved || savedType))
					override = true;
				equals = equals && eqType;
			}
			this.addClildsProperties(tRow, {
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
		this.rowsCache[shortcut + "-" + itemType] = tRow;
		return tItem;
	},
	getCustomTypeLabel: function(type) {
		var label = this.ut.getOwnProperty(this.ps.types, type, "label");
		return (label ? this.ps.dec(label) + " " : "") + "[" + type + "]";
	},
	getTypeLabel: function(type, isCustomType) {
		return (isCustomType === undefined ? this.ps.isCustomType(type) : isCustomType)
				? this.getCustomTypeLabel(type)
				: this.ut.getLocalized(type);
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
	addProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		for(var p in propsObj) if(propsObj.hasOwnProperty(p)) {
			propsVal = propsVal.replace(new RegExp("(?:^|\\s)" + p + "(?:\\s|$)"), " ");
			if(propsObj[p])
				propsVal += " " + p;
		}
		tar.setAttribute("properties", propsVal.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " "));
	},
	addClildsProperties: function(parent, propsObj, addToParent) {
		if(addToParent)
			this.addProperties(parent, propsObj);
		Array.forEach(
			parent.getElementsByTagName("*"),
			function(elt) {
				this.addProperties(elt, propsObj);
			},
			this
		);
	},
	addsClildsProperties: function(parents, propsObj, addToParent) {
		Array.forEach(
			parents,
			function(parent) {
				this.addClildsProperties(parent, propsObj, addToParent);
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
		for(var p in argsObj) if(argsObj.hasOwnProperty(p))
			res.push(
				localize
					? this.getLocalizedArguments(argsObj, p)
					: this.getRawArguments(argsObj, p)
			)
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
	updTree: function(saveSel) {
		this.tBody.style.visibility = "hidden"; // Do not show changes in progress
		if(saveSel === undefined)
			saveSel = true;

		var tbo = this.tbo;
		var fvr = tbo.getFirstVisibleRow();
		var lvr = tbo.getLastVisibleRow();
		if(saveSel) {
			var selRows = [];
			var numRanges = this.tSel.getRangeCount();
			var start = {}, end = {};
			for(var i = 0; i < numRanges; i++) {
				this.tSel.getRangeAt(i, start, end);
				selRows.push([start.value, end.value]);
			}
		}

		this.redrawTree();
		var rowsCount = this.tView.rowCount;
		if(!rowsCount)
			return;
		var maxRowsIndx = rowsCount - 1;

		saveSel && selRows.forEach(
			function(range) {
				if(range[0] <= maxRowsIndx)
					this.tSel.rangedSelect(range[0], this.ut.mm(range[1], 0, maxRowsIndx), true);
			},
			this
		);
		if(lvr > maxRowsIndx)
			fvr -= lvr - maxRowsIndx;
		tbo.scrollToRow(this.ut.mm(fvr, 0, maxRowsIndx));
		this.tBody.style.visibility = "";
	},
	forceUpdTree: function() {
		this.ps.loadSettings();
		this.updTree();
	},
	updButtons: function() {
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
			noSel || selIts.every(function(it) { return this.checkedState(it); }, this)
		);
		this.$("hc-sets-cmd-disable").setAttribute(
			"disabled",
			noSel || selIts.every(function(it) { return !this.checkedState(it); }, this)
		);
		var noTypes = noSel || !selIts.some(function(it) { return it.__isCustomType; });
		this.$("hc-sets-cmd-editType").setAttribute("disabled", noTypes);
		this.$("hc-sets-editType").hidden = noTypes;
	},
	get selectedItems() {
		var numRanges = this.tSel.getRangeCount();
		var tItemsArr = [];
		if(numRanges == 0)
			return tItemsArr;
		var start = {}, end = {}, tItem;
		for(var t = 0; t < numRanges; t++) {
			this.tSel.getRangeAt(t, start, end);
			for(var v = start.value; v <= end.value; v++) {
				tItem = this.getItemAtIndex(v);
				if(!tItem || !("__shortcut" in tItem))
					continue;
				//if(tItem.__isDelayed)
				//	tItem = tItem.parentNode.parentNode;
				tItemsArr.push(tItem);
				tItem.__index = v;
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
		return this.ut.toArray(tItemsArr); // Remove deleted items
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
		var curPane = prefWin.currentPane;
		var panes = prefWin.preferencePanes, pLen = panes.length;
		for(var n = 0; n < pLen; n++)
			if(panes[n] == curPane)
				break;
		n += nextFlag ? 1 : -1;
		if(n >= pLen)  n = 0;
		else if(n < 0) n = pLen - 1;
		prefWin.showPane(panes[n]);
		this.focusSearch();
	},

	addItems: function(e) {
		if(!this.isTreePaneSelected)
			return;
		if(e) {
			if(e.type == "command" || e.button > 0)
				this.openEditorWindow({ __shortcut: this.ps.getEvtStr(e) }, "shortcut", true);
			return;
		}
		var its = this.selectedItems;
		if(its.length == 1) {
			this.openEditorWindow(its[0], "shortcut", true);
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
		its.forEach(
			function(it) {
				this.openEditorWindow(it, "shortcut");
			},
			this
		);
	},
	editItemsTypes: function() {
		if(!this.isTreePaneSelected)
			return;
		var cIts = this.selectedItems.filter(
			function(it) {
				return it.__isCustomType;
			}
		);
		if(this.editorsLimit(cIts.length))
			return;
		cIts.forEach(
			function(it) {
				this.openEditorWindow(it, "itemType");
			},
			this
		);
	},
	editorsLimit: function(count) {
		var lim = this.pu.pref("sets.openEditorsLimit");
		if(lim <= 0 || count <= lim)
			return false;
		var ack = { value: false };
		var cnf = this.ut.promptsSvc.confirmCheck(
			window, this.ut.getLocalized("warningTitle"),
			this.ut.getLocalized("openEditorsWarning").replace("%n", count),
			this.ut.getLocalized("notAckAgain"), ack
		);
		if(!cnf)
			return true;
		if(ack.value)
			this.pu.pref("sets.openEditorsLimit", 0);
		return false;
	},
	isClickOnRow: function(e) {
		var row = {}, col = {}, obj = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, obj);
		return row.value > -1;
	},
	isClickOnContainer: function(e) {
		var row = {}, col = {}, obj = {};
		this.tbo.getCellAt(e.clientX, e.clientY, row, col, obj);
		return row.value > -1 && this.tView.isContainer(row.value);
	},
	deleteItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var tIts = this.selectedItems;
		if(!tIts.length)
			return;

		var del = tIts.map(
			function(tItem, i) { //~ todo: delayed info
				var type = tItem.__itemType, sh = tItem.__shortcut;
				var mdfs = this.ps.getModifiersStr(sh);
				var button = this.ps.getButtonStr(sh, true);
				var typeLabel = this.getTypeLabel(type, this.ps.isCustomType(type));
				var fObj = this.ut.getOwnProperty(this.ps.prefs, sh, type);
				if(tItem.__isDelayed) {
					typeLabel += " (" + this.ut.getLocalized("delayed") + ")";
					fObj = this.ut.getOwnProperty(fObj, "delayedAction");
				}
				var label = this.ut.canHasProps(fObj)
					? this.getActionLabel(fObj)
					: "?";
				return mdfs + " + " + button + " + " + typeLabel + " \u21d2 " /* "=>" */ + label.substr(0, 42);
			},
			this
		);
		var maxRows = 12;
		if(del.length > maxRows)
			del.splice(maxRows - 2, del.length - maxRows + 1, "\u2026" /* "..." */);

		if(
			!this.ut.confirmEx(
				this.ut.getLocalized("title"),
				this.ut.getLocalized("deleteConfirm").replace("%n", tIts.length)
					+ "\n\n" + del.join("\n")
			)
		)
			return;
		tIts.forEach(this.deleteItem, this);
		this.applyButton.disabled = false;
	},
	deleteItem: function(tItem) {
		var sh = tItem.__shortcut;
		var type = tItem.__itemType;
		if(!sh || !type)
			return;
		var p = this.ps.prefs;
		var so = p[sh];

		var tChld = tItem.parentNode;

		var hash = tItem.__shortcut + "-" + tItem.__itemType;
		delete this.rowsCache[hash + "-delayed"];

		if(tItem.__isDelayed) {
			var to = so[type];
			delete to.delayedAction;

			tChld.parentNode.removeChild(tChld);
		}
		else {
			delete this.rowsCache[hash];

			delete so[type];
			if(this.ut.isEmptyObj(so))
				delete p[sh];

			tChld.removeChild(tItem);
			while(!tChld.hasChildNodes() && tChld != this.tBody) {
				tItem = tChld.parentNode;
				tChld = tItem.parentNode;
				tChld.removeChild(tItem);
			}
		}
		this.searchInSetsTree(null, true);
	},
	openEditorWindow: function(tItem, mode, add) { // mode: "shortcut" or "itemType"
		var shortcut = tItem
			? tItem.__shortcut
			: Date.now() + "-" + Math.random();
		var itemType = tItem && add !== true
			? tItem.__itemType
			: Math.random();
		var isDelayed = tItem && add !== true && tItem.__isDelayed;
		this.wu.openEditor(this.ps.currentSrc, mode || "shortcut", shortcut, itemType, isDelayed);
	},
	setItemStatus: function(rowId, editStat) {
		rowId = rowId.replace(/@otherSrc$/, "");
		if(!(rowId in this.rowsCache))
			return;
		this.addClildsProperties(
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
			its.forEach(
				function(tItem) {
					this.toggleRowEnabled(tItem.__index, forcedEnabled);
				},
				this
			);
		}
		if(this.instantApply && !this.ps.otherSrc)
			this.ps.saveSettingsObjects(true);
		else
			this.applyButton.disabled = false;
		this.updButtons();
	},
	toggleRowEnabled: function(rowIndx, forcedEnabled) {
		var tItem = this.getItemAtIndex(rowIndx);
		var tRow = this.getRowForItem(tItem);
		var enabled = this.checkedState(tItem, forcedEnabled === undefined ? null : forcedEnabled);
		var forcedDisDa = this.pu.pref("delayedActionTimeout") <= 0;
		if(tItem.__isDelayed) {
			var pDis = !this.checkedState(tItem.parentNode.parentNode); // Check state of parent
			this.addProperties(tRow, { hc_disabled: forcedDisDa || pDis || !enabled });
		}
		else {
			this.addProperties(tRow, { hc_disabled: !enabled });
			if(tItem.__delayed) {
				var cRow = this.getRowForItem(tItem.__delayed);
				var cDis = !this.checkedState(tItem.__delayed);
				this.addProperties(cRow, { hc_disabled: forcedDisDa || cDis || !enabled });
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
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.tSel.selectAll();
	},
	smartSelect: function _ss(e) {
		if(e.button == 1)
			return;
		if(
			"mgGestureRecognizer" in window
			&& e.button == mgPrefs.mousebutton && !mgGestureRecognizer.checkPrevent(e)
		)
			return; // Do nothing, if Mouse Gestures Redox 3.0+ is active ( http://mousegestures.org/ )
		var row = this.tbo.getRowAt(e.clientX, e.clientY);
		var et = e.type;
		if(et == "mouseout") {
			_ss.row0 = _ss.row1 = undefined;
			return;
		}
		if(row == -1)
			return;
		if(et == "mousedown") {
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
			_ss.row0 = _ss.row1 = undefined;
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
	viewMenuCommand: function(mi) {
		if(mi.hasAttribute("value"))
			this.setDrawMode(mi.value);
		else if(mi.hasAttribute("hc_pref")) {
			const pName = mi.getAttribute("hc_pref");
			this.pu.pref(pName, !this.pu.pref(pName)); // => updPrefsUI()
		}
	},
	setDrawMode: function(dm) {
		// <preference instantApply="true" ... /> is bad on slow devices (it saves prefs.js file)
		this.pu.pref("sets.treeDrawMode", Number(dm)); // => updPrefsUI()
	},
	toggleColored: function() {
		var tr = this.tree;
		tr.setAttribute("hc_colored", tr.getAttribute("hc_colored") != "true");
	},

	toggleTreeContainers: function(oFlag) { //~ todo: collapse/expand one level per click?
		var tis = this.tBody.getElementsByTagName("treeitem"), ti;
		var isFunc = typeof oFlag == "function";
		isFunc && this.toggleTreeContainers(true);
		for(var i = tis.length - 1; i >= 0; i--) {
			ti = tis[i];
			ti.setAttribute(
				"open",
				isFunc
					? oFlag(this.tView.getLevel(this.tView.getIndexOfItem(ti)))
					: oFlag
			);
		}
	},
	toggleTreeContainersClick: function(e) {
		var b = e.button;
		var oFlag = b == 1 || b == 0 && (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey)
			? function(level) { return level < 1; }
			: b == 2;
		this.toggleTreeContainers(oFlag);
	},

	/*** Search in tree ***/
	focusSearch: function(e) {
		if(!this.isTreePaneSelected)
			return;
		var sIt = this.$("hc-sets-tree-searchField");
		if(!sIt)
			return;
		sIt.select();
		sIt.focus();
	},

	_searchDelay: 50,
	_searchTimeout: null,
	_lastSearch: 0,

	searcher: {
		_res: [], // rows numbers
		_current: 0,
		_wrapped: false,
		init: function(parent, tree, field) {
			this.__parent = parent;
			this.tree = tree;
			this.field = field;
		},
		reset: function() {
			this._res = [];
			this._current = 0;
		},
		add: function(r) {
			this._res.push(r);
		},
		get _length() {
			return this._res.length;
		},
		next: function() {
			if(++this._current >= this._length)
				this._wrapped = true, this._current = 0;
			this.select();
		},
		prev: function() {
			if(--this._current < 0)
				this._wrapped = true, this._current = this._length - 1;
			this.select();
		},
		select: function(i) {
			if(typeof i != "number") {
				if(!this._length)
					return;
				i = this._res[this._current];
			}
			this.field.setAttribute("hc_wrapped", this._wrapped);
			this._wrapped = false; // Reset flag
			this.__parent.toggleTreeContainers(true); // Expand tree
			this.tree.view.selection.select(i);
			this.tree.treeBoxObject.ensureRowIsVisible(i);
		},
		selectAll: function() {
			this._res.forEach(
				function(i) {
					this.tree.view.selection.rangedSelect(i, i, true);
				},
				this
			);
		}
	},
	navigateSearchResults: function(e) {
		var code = e.keyCode;
		if(code == e.DOM_VK_RETURN && e.ctrlKey)
			this.searcher.selectAll();
		else if(code == e.DOM_VK_DOWN || code == e.DOM_VK_RETURN && !e.shiftKey)
			this.searcher.next();
		else if(code == e.DOM_VK_UP || code == e.DOM_VK_RETURN && e.shiftKey)
			this.searcher.prev();
		else if(code == e.DOM_VK_ESCAPE && e.target.value) {
			e.preventDefault(); // Don't close dialog window
			if(e.target.type != "search") { // Firefox < 3.5
				e.target.value = "";
				this.searchInSetsTree();
			}
		}
		else
			return;
		e.preventDefault();
	},
	searchInSetsTree: function(sIt, notSelect) {
		if(sIt && this._searchTimeout === null) {
			var remTime = this._lastSearch + this._searchDelay - Date.now();
			if(remTime > 0) {
				this._searchTimeout = setTimeout(
					function(_this, _a) {
						_a.callee.apply(_this, _a);
						_this._searchTimeout = null;
					},
					remTime,
					this, arguments
				);
				return;
			}
		}
		this.searcher.reset();
		sIt = sIt || this.$("hc-sets-tree-searchField");
		var sTerm = this.ut.trim(sIt.value);
		var hasTerm = !!sTerm;
		sTerm = sTerm.toLowerCase().split(/\s+/);

		var tRow, rowText, okRow, indx;
		var notFound = true, count = 0;
		for(var h in this.rowsCache) {
			tRow = this.rowsCache[h];
			okRow = hasTerm;
			rowText = this.getRowText(tRow); //~ todo: cache?

			if(hasTerm && sTerm.some(function(s) { return rowText.indexOf(s) == -1; }))
				okRow = false;

			this.addProperties(tRow, { hc_search: okRow });
			if(!okRow)
				continue;
			count++;
			indx = this.tView.getIndexOfItem(tRow.parentNode);
			this.searcher.add(indx);
			if(notFound) {
				notFound = false;
				if(!notSelect) // Don't select for redraw
					this.searcher.select(indx);
			}
		}
		this.$("hc-sets-tree-searchResults").value = hasTerm ? count : "";
		sIt.setAttribute("hc_notFound", hasTerm && notFound);

		this._lastSearch = Date.now();
	},
	getRowText: function(tRow) {
		var tChld = tRow, tItem;
		var rowText = [];
		do {
			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
			Array.forEach(
				this.getRowForItem(tItem).getElementsByAttribute("label", "*"),
				function(elt) {
					var label = elt.getAttribute("label");
					label && rowText.push(label);
				},
				this
			);
		}
		while(tChld != this.tBody);
		return rowText.join("\n").toLowerCase();
	},

	/*** Prefs pane ***/
	updPrefsUI: function(prefName) {
		this.loadPrefs();
		this.updateAllDependencies();
		if(prefName == "sets.treeDrawMode")
			this.updTree(false);
		else if(prefName == "sets.treeExpandDelayedAction" || prefName == "sets.localizeArguments")
			this.updTree();
	},
	loadPrefs: function() {
		var buttons = this.pu.pref("disallowMousemoveButtons") || "";
		for(var i = 0; i <= 2; i++)
			this.$("hc-sets-disallowMousemove-" + i).checked = buttons.indexOf(i) > -1;
	},
	savePrefs: function(applyFlag) {
		var val = "";
		for(var i = 0; i <= 2; i++)
			if(this.$("hc-sets-disallowMousemove-" + i).checked)
				val += i;
		this.pu.pref("disallowMousemoveButtons", val);
		if(applyFlag && !this.instantApply) {
			this.savePrefpanes();
			this.applyButton.disabled = this._prefsSaved = true;
		}
		if(this.ps.otherSrc)
			this.ps.reloadSettings(applyFlag);
		else
			this.ps.saveSettingsObjects(applyFlag);
		if(
			!applyFlag && this.ps.otherSrc
			&& !this.ut.confirmEx(this.ut.getLocalized("title"), this.ut.getLocalized("importIncomplete"))
		)
			return false;
		return true;
	},
	savePrefpanes: function() {
		Array.forEach(
			document.getElementsByTagName("prefpane"),
			function(pp) {
				pp.writePreferences(true /* aFlushToDisk */);
			}
		);
	},
	prefsChanged: function(e) {
		var tar = e.target;
		if(!("hasAttribute" in tar))
			return;
		var ln = tar.localName;
		if(ln == "prefwindow") {
			this.focusSearch(e);
			return;
		}
		if(tar.localName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("hc_requiredFor"))
			this.updateDependencies(tar, true);
		if(tar.hasAttribute("preference")) {
			var p = this.$(tar.getAttribute("preference"));
			if(p.getAttribute("instantApply") == "true" || p.getAttribute("hc_instantApply") == "true")
				return;
		}
		else if(ln != "checkbox")
			return;
		if(this.instantApply)
			this.savePrefs();
		else
			this.applyButton.disabled = this._prefsSaved = false;
	},
	updateAllDependencies: function() {
		Array.forEach(
			document.getElementsByAttribute("hc_requiredFor", "*"),
			this.updateDependencies,
			this
		);
	},
	updateDependencies: function(it, checkAll) {
		var checkParent = it.getAttribute("hc_checkParent") == "true";
		if(checkParent && checkAll !== true)
			return;
		var dis = it.hasAttribute("hc_disabledValues")
			? new RegExp("(?:^|\\s)" + it.value + "(?:\\s|$)").test(it.getAttribute("hc_disabledValues"))
			: it.hasAttribute("checked") && !checkParent
				? it.getAttribute("checked") != "true"
				: Array.every(
					(checkParent ? it.parentNode : it).getElementsByTagName("checkbox"),
					function(ch) {
						return ch.getAttribute("checked") != "true";
					}
				);
		it.getAttribute("hc_requiredFor").split(/\s+/).forEach(
			function(req) {
				Array.forEach(
					document.getElementsByAttribute("hc_depends", req),
					function(dep) {
						this.desableChilds(dep, dis);
					},
					this
				);
			},
			this
		);
	},
	desableChilds: function(parent, dis) {
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

	// about:config entries
	// Reset prefs:
	resetPrefs: function() {
		this.pu.prefSvc.getBranch(this.pu.prefNS)
			.getChildList("", {})
			.forEach(this.resetPref, this);
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
		if(str.indexOf(this.exportPrefsHeader) != 0) {
			this.ut.alertEx(
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
			.forEach(
				function(line, i) {
					if(
						line.indexOf(";") == 0 || line.indexOf("#") == 0
						|| line.charAt(0) == "[" && line.charAt(line.length - 1) == "]"
					)
						return; // Just for fun right now :)
					var indx = line.indexOf("=");
					if(indx == -1) {
						this.ut._err(new Error("[Import INI] Skipped invalid line #" + (i + 2) + ": " + line), true);
						return;
					}
					var pName = line.substring(0, indx);
					if(pName.indexOf(this.pu.prefNS) != 0) {
						this.ut._err(new Error("[Import INI] Skipped pref with invalid name: " + pName), true);
						return;
					}
					var pbr = this.pu.pBr;
					var pType = this.pu.prefSvc.getPrefType(pName);
					var isOld = pType == pbr.PREF_INVALID; // Old format?
					if(isOld) {
						_oldPrefs.push(pName);
						this.ut._err(new Error("[Import INI] Old pref: " + pName), true);
					}
					var pVal = line.substring(indx + 1);
					if(pType == pbr.PREF_INT || isOld && /^-?\d+$/.test(pVal)) // Convert string to number
						pVal = Number(pVal);
					else if(pType == pbr.PREF_BOOL || isOld && (pVal == "true" || pVal == "false")) // ...or boolean
						pVal = pVal == "true";
					this.pu.setPref(pName, pVal);
				},
				this
			);
		this.pu.prefsMigration(true);
		_oldPrefs.forEach(
			function(pName) {
				this.pu.prefSvc.deleteBranch(pName);
			},
			this
		);
		this.pu.savePrefFile();
	},

	// Clicking options management
	// Export/import:
	exportSets: function(partialExport, targetId) {
		var toFile      = targetId == 0;
		var toClipboard = targetId == 1;
		var toURI       = targetId == 2;
		this.selectTreePane();
		if(toFile) {
			var file = this.pickFile(
				this.ut.getLocalized("exportSets"), true, "js",
				!partialExport && this.ps.prefsFile.lastModifiedTime
			);
			if(!file)
				return;
			this.backupsDir = file.parent.path;
		}
		if(partialExport) {
			var pStr = this.extractPrefs();
			if(toClipboard)
				this.ut.copyStr(pStr);
			else if(toURI)
				this.ut.copyStr("handyclicks://settings/add/" + this.ps.enc(pStr));
			else
				this.ut.writeToFile(pStr, file);
		}
		else // Do not start full export to clipboard!
			this.ps.prefsFile.copyTo(file.parent, file.leafName);
	},
	extractPrefs: function() {
		var exCts = { __proto__: null };
		var exSh = { __proto__: null };
		var its = this.selectedItems;
		its.forEach(
			function(it) {
				if(it.__isCustomType)
					exCts[it.__itemType] = true;
				exSh[it.__shortcut] = exSh[it.__shortcut] || { __proto__: null };
				exSh[it.__shortcut][it.__itemType] = true;
			},
			this
		);

		var cts = this.ps.types, newTypes = {};
		var p   = this.ps.prefs, newPrefs = {};

		var type, to;
		var sh, so, exTypes;

		for(type in cts) if(cts.hasOwnProperty(type)) {
			if(!(type in exCts) || !this.ps.isCustomType(type))
				continue;
			to = cts[type];
			if(!this.ps.isOkCustomObj(to))
				continue;
			this.ut.setOwnProperty(newTypes, type, to);
		}

		for(sh in p) if(p.hasOwnProperty(sh)) {
			if(!(sh in exSh) || !this.ps.isOkShortcut(sh))
				continue;
			so = p[sh];
			if(!this.ut.isObject(so))
				continue;
			exTypes = exSh[sh];
			for(type in so) if(so.hasOwnProperty(type)) {
				if(!(type in exTypes))
					continue;
				to = so[type];
				if(!this.ut.isObject(to))
					continue;
				this.ut.setOwnProperty(newPrefs, sh, type, to);
			}
		}

		this.addsClildsProperties(its, { hc_copied: true });
		setTimeout(function(_this, its) {
			_this.addsClildsProperties(its, { hc_copied: false });
		}, 200, this, its);

		return this.ps.getSettingsStr(newTypes, newPrefs);
	},
	importSets: function(partialImport, srcId, data) {
		this.selectTreePane();
		if(this.pu.pref("sets.importJSWarning")) {
			var ack = { value: false };
			var cnf = this.ut.promptsSvc.confirmCheck(
				window, this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("importSetsWarning"),
				this.ut.getLocalized("importSetsWarningNotShowAgain"), ack
			);
			if(!cnf)
				return;
			this.pu.pref("sets.importJSWarning", !ack.value);
		}
		var pSrc;
		switch(srcId) {
			default:
			case 0: pSrc = this.pickFile(this.ut.getLocalized("importSets"), false, "js"); break;
			case 1: pSrc = this.ps.getPrefsStr(this.ut.readFromClipboard(true));           break;
			case 2: pSrc = this.ps.dec(data);                                              break;
			case 3: pSrc = this.ps.getFile(data);
		}
		if(!pSrc)
			return;
		if(!this.checkPrefs(pSrc)) {
			this.ut.alertEx(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFormat")
					+ (this.ps._hashError ? this.ut.getLocalized("invalidHash") : "")
			);
			return;
		}
		if(this.ps._hashMissing) {
			var ps = this.ut.promptsSvc;
			// https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			// confirmEx always returns 1 if the user closes the window using the close button in the titlebar
			var button = ps.confirmEx(
				window, this.ut.getLocalized("warningTitle"),
				this.ut.getLocalized("hashMissingConfirm"),
				  ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
				+ ps.BUTTON_POS_1_DEFAULT,
				this.ut.getLocalized("continueImport"), "", "",
				null, {}
			);
			if(button == 1)
				return;
		}
		if(!this.ps.otherSrc) {
			this._savedPrefs = this.ps.prefs;
			this._savedTypes = this.ps.types;
		}
		this.ps.loadSettings(pSrc);
		//this.ps.reloadSettings(false);
		if(this.ps._loadError)
			return;
		this.setImportStatus(true, partialImport, srcId == 1 /* from clipboard */);
		if(partialImport)
			this.redrawTree();
		else
			this.updTree();
		if(pSrc instanceof Components.interfaces.nsILocalFile && srcId != 2 /* not from %profile%/handyclicks/ */)
			this.backupsDir = pSrc.parent.path;
	},
	createBackup: function() {
		var bName = this.ps.prefsFileName + this.ps.names.userBackup + new Date().toLocaleFormat("%Y%m%d%H%M%S");
		var bFile, i = 0;
		do bFile = this.ps.getFile(bName + (i++ ? "-" + i : "") + ".js");
		while(bFile.exists())
		this.ps.prefsFile.copyTo(null, bFile.leafName);
		this.ut.notifyInWindowCorner(
			this.ut.getLocalized("backupCreated").replace("%f", bFile.leafName)
		);
	},
	removeBackup: function(mi) {
		var fName = mi.getAttribute("hc_fileName");
		if(!fName)
			return false;
		var file = this.ps.getFile(fName);
		if(!file.exists()) {
			mi.parentNode.removeChild(mi);
			this.updRestorePopup();
			return false;
		}

		if(this.pu.pref("sets.removeBackupConfirm")) {
			this.ut.closeMenus(mi);
			var ack = { value: false };
			var cnf = this.ut.promptsSvc.confirmCheck(
				window, this.ut.getLocalized("title"),
				this.ut.getLocalized("removeBackupConfirm").replace("%f", fName),
				this.ut.getLocalized("notAckAgain"), ack
			);
			if(!cnf)
				return false;
			if(ack.value)
				this.pu.pref("sets.removeBackupConfirm", false);
		}

		file.remove(false);
		mi.parentNode.removeChild(mi);
		this.updRestorePopup();
		return true;
	},
	get ubPopup() {
		return this.$("hc-sets-tree-restoreFromBackupPopup");
	},
	buildRestorePopup: function() {
		var popup = this.ubPopup;
		//this.ut.removeChilds(popup);
		var sep;
		while(true) {
			sep = popup.firstChild;
			if(sep.localName == "menuseparator")
				break;
			popup.removeChild(sep);
		}

		var entries = this.ps.prefsDir.directoryEntries;
		var entry, fName;
		var _fTerms = [], _files = {}, _fTime;
		var _ubTerms = [], _ubFiles = {}, _ubTime;
		var mainFile = this.ps.prefsFileName + ".js";

		while(entries.hasMoreElements()) {
			entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(!entry.isFile())
				continue;
			fName = entry.leafName;
			if(
				fName.indexOf(this.ps.prefsFileName) != 0
				|| !/\.js$/i.test(fName)
				|| fName == mainFile
				|| fName.indexOf(this.ps.names.corrupted) != -1
			)
				continue;
			if(
				fName.indexOf(this.ps.names.userBackup) != -1
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

		var comparator = function(a, b) {
			return a > b; // sort as numbers
		};

		var bytes = this.ut.getLocalized("bytes");
		_fTerms.sort(comparator).reverse().forEach(
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
						image={ "moz-icon:file://" + fPath }
						tooltiptext={fPath}
						hc_fileName={fName}
						hc_old={ fName.indexOf(this.ps.names.version) != -1 }
						hc_userBackup={ fName.indexOf(this.ps.names.userBackup) != -1 }
					/>
				), sep);
			},
			this
		);
		_fTerms = _files = null;

		popup.__userBackups = _ubTerms.sort(comparator).reverse().map(function(time) {
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

	setImportStatus: function(isImport, isPartial, fromClipboard) {
		this._import              = isImport;
		this._partialImport       = isImport && isPartial;
		this._importFromClipboard = isImport && fromClipboard;
		this.closeEditors();
		if(this.prefsSaved)
			this.applyButton.disabled = true;
		var panel = this.$("hc-sets-tree-partialImportPanel");
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
		this.$("hc-sets-tree-buttonImportOk").focus();
	},
	importDone: function _id(ok) {
		var isPartial = this._partialImport;
		//var fromClip = this._importFromClipboard;
		this.setImportStatus(false);
		if(ok) {
			this.ps.otherSrc = false;
			if(isPartial)
				this.mergePrefs();
			else // Keep prefs file because content of new file may be equals!
				this.ps.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport, null, true);
			this.ps.saveSettingsObjects(true);
		}
		else {
			this.ps.loadSettings();
			this.updTree();
		}
		this.tree.focus();
	},
	mergePrefs: function() {
		var cts = this.ps.types;
		var p = this.ps.prefs;
		this.ps.loadSettings();

		var type, to;
		var sh, so;

		for(type in cts) if(cts.hasOwnProperty(type)) {
			if(!this.ps.isCustomType(type))
				continue;
			to = cts[type];
			if(!this.ps.isOkCustomObj(to))
				continue;
			this.ut.setOwnProperty(this.ps.types, type, to);
		}

		for(sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh))
				continue;
			so = p[sh];
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
		fp.init(window, pTitle, fp[modeSave ? "modeSave" : "modeOpen"]);
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
	checkPrefs: function(pSrc) {
		if(pSrc instanceof Components.interfaces.nsILocalFile)
			pSrc = this.ut.readFromFile(pSrc);
		if(!this.ps.checkPrefsStr(pSrc))
			return false;
		return true;
	},
	checkClipboard: function() {
		this.$("hc-sets-cmd-partialImportFromClipboard").setAttribute(
			"disabled",
			!this.ps.checkPrefsStr(this.ut.readFromClipboard(true))
		);
	}
};
var handyClicksSets = {
	_importFlag: false,
	_partialImportFlag: false,
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
		this.ps.oSvc.addPrefsObserver(this.updTree, this);

		this.updPrefsUI();
		this.pu.oSvc.addPrefsObserver(this.updPrefsUI, this);

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
		var prefsButt = document.documentElement.getButton("extra2");
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
	},
	initShortcuts: function() {
		var tree = this.$("hc-sets-tree");
		this.tree = tree;
		this.tbo = tree.treeBoxObject;
		this.tView = tree.view;
		this.tSel = this.tView.selection;
		this.tBody = tree.body;
		this.searcher.init(this, tree);

		this.cmdDelete = this.$("hc-sets-cmd-delete");
		this.cmdEdit = this.$("hc-sets-cmd-edit");
		this.cmdEditType = this.$("hc-sets-cmd-editType");
		this.cmdPExpFile = this.$("hc-sets-cmd-partialExportToFile");
		this.cmdPExpClip = this.$("hc-sets-cmd-partialExportToClipboard");
		this.miEditType = this.$("hc-sets-editType");

		this.applyButton = document.documentElement.getButton("extra1");
	},
	destroy: function(reloadFlag) {
		this.closeEditors();
	},
	closeEditors: function() {
		var pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			["handyclicks:editor"],
			function(w) {
				if(!("_handyClicksInitialized" in w) || w[pSvc].otherSrc)
					w.close();
			}
		);
	},

	/*** Actions pane ***/
	_prefsSaved: true,
	get prefsSaved() {
		return this.instantApply || this._prefsSaved;
	},
	$: function(id) {
		return document.getElementById(id);
	},

	drawTree: function() {
		this.eltsCache = { __proto__: null };
		this.rowsCache = { __proto__: null };

		var daTime = this.pu.pref("delayedActionTimeout");
		this._daAfter = this.ut.getLocalized("after").replace("%t", daTime);
		this._forcedDisDa = daTime <= 0;
		this._expandDa = this.pu.pref("sets.treeExpandDelayedAction");

		var drawMode = this.pu.pref("sets.treeDrawMode");
		var p = this.ps.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._err(new Error("Invalid shortcut in prefs: \"" + sh + "\""), true);
				continue;
			}
			switch(drawMode) {
				case 0:
				default:
					var button = this.ps.getButtonId(sh);
					var modifiers = this.ps.getModifiersStr(sh);
					var buttonContainer = this.eltsCache[button]
						|| this.appendContainerItem(this.tBody, button, this.ut.getLocalized(button));
					var modifiersContainer = this.eltsCache[sh]
						|| this.appendContainerItem(buttonContainer, sh, modifiers);
					this.appendItems(modifiersContainer, p[sh], sh);
				break;
				case 1:
					var button = this.ps.getButtonId(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var label = this.ut.getLocalized(button) + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
					var buttonContainer = this.eltsCache[sh]
						|| this.appendContainerItem(this.tBody, sh, label);
					this.appendItems(buttonContainer, p[sh], sh);
				break;
				case 2:
					var button = this.ps.getButtonId(sh);
					var modifiers = this.ps.getModifiersStr(sh);
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(this.tBody, type, this.getTypeLabel(type));
						var hash = type + "-" + button;
						var buttonContainer = this.eltsCache[hash]
							|| this.appendContainerItem(typeContainer, hash, this.ut.getLocalized(button));
						this.appendRow(buttonContainer, sh, type, so[type], modifiers);
					}
				break;
				case 3:
					var button = this.ps.getButtonId(sh, true);
					var modifiers = this.ps.getModifiersStr(sh, true);
					var so = p[sh];
					for(var type in so) if(so.hasOwnProperty(type)) {
						var typeContainer = this.eltsCache[type]
							|| this.appendContainerItem(this.tBody, type, this.getTypeLabel(type));
						var label = this.ut.getLocalized(button) + (modifiers ? " " + this.ps.keys.sep + " " + modifiers : "");
						this.appendRow(typeContainer, sh, type, so[type], label);
					}
				break;
			}
		}
		this.markOpenedEditors();
	},
	markOpenedEditors: function() {
		for(var rowId in this.rowsCache)
			this.setItemStatus(rowId, false);
		var wProp = this.wu.winIdProp;
		var otherSrc = this.ps.otherSrc;
		this.wu.forEachWindow(
			["handyclicks:editor"],
			function(w) {
				if(wProp in w)
					this.setItemStatus(w[wProp], w.handyClicksPrefSvc.otherSrc == otherSrc);
			},
			this
		);
	},
	redrawTree: function() {
		var cnt = this.tBody;
		while(cnt.hasChildNodes())
			cnt.removeChild(cnt.lastChild);
		this.drawTree();
		this.searchInSetsTree(null, true);
		if(this.prefsSaved && !this.ps.otherSrc)
			this.applyButton.disabled = true;
		document.title = document.title.replace(/\*?$/, this.ps.otherSrc ? "*" : "");
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem =
			<treeitem xmlns={this.ut.XULNS} container="true" open="true">
				<treerow>
					<treecell label={label} />
				</treerow>
				<treechildren />
			</treeitem>;
		tItem = this.ut.parseFromXML(tItem);
		parent.appendChild(tItem);
		return this.eltsCache[hash] = tItem.getElementsByTagName("treechildren")[0];
	},
	appendItems: function(parent, items, shortcut) {
		for(var itemType in items) if(items.hasOwnProperty(itemType))
			this.appendRow(parent, shortcut, itemType, items[itemType]);
	},
	appendRow: function(parent, shortcut, itemType, fo, forcedLabel) {
		var tItem = document.createElement("treeitem");
		var tRow = document.createElement("treerow");
		if(!this.ut.canHasProps(fo))
			fo = {};
		var isCustom = !!fo.custom;
		var isCustomType = this.ps.isCustomType(itemType);
		var typeLabel = forcedLabel || this.getTypeLabel(itemType, isCustomType);
		this.appendTreeCell(tRow, "label", typeLabel);
		this.appendTreeCell(tRow, "label", fo.eventType);
		var actLabel = isCustom ? this.ps.dec(fo.label) : this.ut.getLocalized(fo.action);
		this.appendTreeCell(tRow, "label", actLabel);
		this.appendTreeCell(tRow, "label", this.getActionCode(fo.action, isCustom));
		this.appendTreeCell(tRow, "label", this.getArguments(fo.arguments || {}));

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
			var daLabel = daCustom ? this.ps.dec(da.label) : this.ut.getLocalized(da.action);
			this.appendTreeCell(daRow, "label", daLabel);
			this.appendTreeCell(daRow, "label", this.getActionCode(da.action, daCustom));
			this.appendTreeCell(daRow, "label", this.getArguments(da.arguments || {}));

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

			if(this._importFlag) { //~ todo: test!
				var savedDa = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType, "delayedAction");
				var override = savedDa;
				var equals = this.ut.objEquals(da, savedDa);
				this.addClildsProperties(daRow, {
					hc_override: override,
					hc_equals: equals
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
				|| this.isBuggyLabel(typeLabel)
			);

		this.addClildsProperties(tRow, {
			hc_disabled: !fo.enabled,
			hc_buggy: isBuggy,
			hc_custom: isCustom,
			hc_customType: isCustomType
		}, true);
		if(this._importFlag) { //~ todo: test!
			var savedPref = this.ut.getOwnProperty(this._savedPrefs, shortcut, itemType);
			if(savedDa) // Ignore delayed actions
				savedPref.delayedAction = null;
			if(da)
				fo.delayedAction = null;
			var override = savedPref;
			var equals = this.ut.objEquals(fo, savedPref);
			if(isCustomType) {
				var savedType = this.ut.getOwnProperty(this._savedTypes, itemType);
				var eqType = this.ut.objEquals(this.ps.types[itemType], savedType);
				if(!eqType)
					override = true;
				equals = equals && eqType;
			}
			this.addClildsProperties(tRow, {
				hc_override: override,
				hc_equals: equals
			}, true);

			if(savedDa)
				savedPref.delayedAction = savedDa;
			if(da)
				fo.delayedAction = da;
		}

		tItem.__shortcut = shortcut;
		tItem.__itemType = itemType;
		tItem.__isCustomType = isCustomType;
		tItem.__isDelayed = false;
		tItem.__delayed = da && daItem;
		tItem.appendChild(tRow);
		parent.appendChild(tItem);
		this.rowsCache[shortcut + "-" + itemType] = tRow;
	},
	getCustomTypeLabel: function(type) {
		var label = this.ut.getOwnProperty(this.ps.types, type, "label");
		return (label ? this.ps.dec(label) + " " : "") + "(" + type + ")";
	},
	getTypeLabel: function(itemType, isCustomType) {
		if(isCustomType === undefined)
			isCustomType = this.ps.isCustomType(itemType);
		return isCustomType
			? this.getCustomTypeLabel(itemType)
			: this.ut.getLocalized(itemType);
	},
	getActionCode: function(action, isCustom) {
		return isCustom
			? this.ut.getLocalized("customFunction") + (this.oldTree ? " " : "\n") + this.ps.dec(action)
			: action;
	},
	isBuggyFuncObj: function(fo, isCustom, label) {
		return !this.ps.isOkFuncObj(fo) || !isCustom && this.isBuggyLabel(label);
	},
	isBuggyLabel: function(label) {
		return !label || /^\(.+\)$/.test(label); // See handyClicksUtils.getLocalized()
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
	getArguments: function(argsObj) {
		var res = [];
		for(var p in argsObj) if(argsObj.hasOwnProperty(p))
			res.push(p + " = " + uneval(argsObj[p])); //~ todo: this.ut.getLocalized(p) ?
		return res.join(this.oldTree ? ", " : ",\n ");
	},
	updTree: function() {
		var tbo = this.tbo;
		var fvr = tbo.getFirstVisibleRow();
		var numRanges = this.tSel.getRangeCount();
		var selRows = [];
		var start = {}, end = {};
		for(var i = 0; i < numRanges; i++) {
			this.tSel.getRangeAt(i, start, end);
			selRows.push([start.value, end.value]);
		}

		this.redrawTree();
		var rowsCount = this.tView.rowCount;
		if(!rowsCount)
			return;
		var maxRowsIndx = rowsCount - 1;

		selRows.forEach(
			function(range) {
				if(range[0] <= maxRowsIndx)
					this.tSel.rangedSelect(range[0], this.ut.mm(range[1], 0, maxRowsIndx), true);
			},
			this
		);
		if(typeof fvr == "number" && fvr < rowsCount)
			tbo.scrollToRow(this.ut.mm(fvr, 0, maxRowsIndx));
	},
	forceUpdTree: function() {
		this.ps.loadSettings();
		this.updTree();
	},
	updButtons: function() {
		var selIts = this.selectedItems;
		var noSel = !selIts.length;
		["cmdDelete", "cmdEdit", "cmdPExpFile", "cmdPExpClip"].forEach(
			function(hash) {
				this[hash].setAttribute("disabled", noSel);
			},
			this
		);
		var noTypes = noSel || !selIts.some(function(it) { return it.__isCustomType; });
		this.cmdEditType.setAttribute("disabled", noTypes);
		this.miEditType.hidden = noTypes;
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
				//	tItem = tItem.parentNode.parentNode; // ?
				tItemsArr.push(tItem);
				tItem.__index = v;
			}
		}
		tItemsArr.forEach(
			function(tItem, indx) {
				var daItem = !tItem.__isDelayed && tItem.__delayed;
				if(!daItem)
					return;
				tItemsArr.forEach(
					function(tItem2, indx2) {
						if(tItem2 === daItem && indx2 != indx)
							delete tItemsArr[indx2];
					}
				);
			}
		);
		var tItemsArr2 = [];
		tItemsArr.forEach(
			function(tItem) {
				tItem && tItemsArr2.push(tItem);
			}
		);
		return tItemsArr2;
	},
	getItemAtIndex: function(indx) {
		if(indx == -1 || indx >= this.tView.rowCount)
			return null;
		return this.tView.getItemAtIndex(indx); // <treeitem>
		//return this.tView.getItemAtIndex(indx).getElementsByTagName("treerow")[0] || null;
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
		var prefWin = this.$("handyClicks-settings");
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
		var cIts = [];
		this.selectedItems.forEach(
			function(it) {
				it.__isCustomType && cIts.push(it);
			},
			this
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
			this.ut.getLocalized("openEditorsWarningNotShowAgain"), ack
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
				var label = fObj
					? this.ut.getOwnProperty(fObj, "custom")
						? this.ps.dec(fObj.label || "")
						: this.ut.getLocalized(fObj.action || "")
					: "?";
				return mdfs + " + " + button + " + " + typeLabel + " \u21d2 " + label.substr(0, 42); // "=>" symbol
			},
			this
		);
		var maxRows = 12;
		if(del.length > maxRows)
			del.splice(maxRows - 2, del.length - maxRows + 1, "\u2026"); // "..." symbol

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
		if(tItem.__isDelayed) {
			var to = so[type];
			delete to.delayedAction;

			tChld.parentNode.removeChild(tChld);
		}
		else {
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
	},
	openEditorWindow: function(tItem, mode, add) { // mode: "shortcut" or "itemType"
		var shortcut = tItem
			? tItem.__shortcut
			: Date.now() + "-" + Math.random();
		var itemType = tItem && add !== true
			? tItem.__itemType
			: Math.random();
		this.wu.openEditor(this.ps.currentSrc, mode || "shortcut", shortcut, itemType, tItem && tItem.__isDelayed);
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
	treeClick: function(e) {
		if(e.button == 0)
			this.toggleEnabled(e);
		else if(e.button == 1)
			this.editItems(e);
	},
	toggleEnabled: function(e) { //~ todo: test!
		if(e) {
			var row = {}, col = {}, obj = {};
			this.tbo.getCellAt(e.clientX, e.clientY, row, col, obj);
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
					this.toggleRowEnabled(tItem.__index);
				},
				this
			);
		}
		if(this.instantApply && !this.ps.otherSrc)
			this.ps.saveSettingsObjects(true);
		else
			this.applyButton.disabled = false;
	},
	toggleRowEnabled: function(rowIndx) {
		var tItem = this.getItemAtIndex(rowIndx);
		var tRow = this.getRowForItem(tItem);
		var enabled = this.checkedState(tItem, true); // toggle
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
	checkedState: function(tItem, toggle) {
		var tRow = this.getRowForItem(tItem);
		var tCell = tRow.getElementsByAttribute("value", "*")[0];
		var enabled = tCell.getAttribute("value") == "true";
		if(toggle) {
			enabled = !enabled;
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

		setTimeout(function(_this, row0, row1, row) {
			if(row1 !== undefined)
				_this.tSel.clearRange(row0, row1);
			if(row0 != row)
				_this.tSel.rangedSelect(row0, row, true);
		}, 0, this, row0, row1, row);

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
	setDrawMode: function(dm) {
		// <preference instantApply="true" ... /> is bad on slow devices (it saves prefs.js file)
		if(!this.instantApply)
			this.pu.pref("sets.treeDrawMode", parseInt(dm)); // => updPrefsUI()
	},

	toggleTreeContainers: function(oFlag) {
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
		_res: [], // row numbers
		_current: 0,
		init: function(parent, tree) {
			this.__parent = parent;
			this.tree = tree;
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
				this._current = 0;
			this.select();
		},
		prev: function() {
			if(--this._current < 0)
				this._current = this._length - 1;
			this.select();
		},
		select: function(i) {
			if(typeof i != "number") {
				if(!this._length)
					return;
				i = this._res[this._current];
			}
			this.__parent.toggleTreeContainers(true);
			this.tree.view.selection.select(i);
			this.tree.treeBoxObject.ensureRowIsVisible(i);
		}
	},
	navigateSearchResults: function(e) {
		var code = e.keyCode;
		if(code == e.DOM_VK_DOWN || code == e.DOM_VK_RETURN && !e.shiftKey)
			this.searcher.next();
		else if(code == e.DOM_VK_UP || code == e.DOM_VK_RETURN && e.shiftKey)
			this.searcher.prev();
		else if(code == e.DOM_VK_ESCAPE && e.target.value)
			e.preventDefault(); // Don't close dialog window
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
		var notFound = true;
		for(var h in this.rowsCache) {
			tRow = this.rowsCache[h];
			okRow = hasTerm;
			rowText = this.getRowText(tRow); //~ todo: cache?

			if(hasTerm && sTerm.some(function(s) { return rowText.indexOf(s) == -1; }))
				okRow = false;

			this.addProperties(tRow, { hc_search: okRow });
			if(!okRow)
				continue;
			indx = this.tView.getIndexOfItem(tRow.parentNode);
			this.searcher.add(indx);
			if(notFound) {
				notFound = false;
				if(!notSelect) // Don't select for redraw
					this.searcher.select(indx);
			}
		}
		sIt.setAttribute("hc_notfound", hasTerm && notFound);

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
		while(tChld != this.tBody)
		return rowText.join("\n").toLowerCase();
	},

	/*** Prefs pane ***/
	updPrefsUI: function(prefName) {
		this.loadPrefs();
		this.updateAllDependencies();
		if(prefName == "sets.treeDrawMode")
			this.redrawTree();
		else if(prefName == "sets.treeExpandDelayedAction")
			this.updTree();
	},
	loadPrefs: function() {
		var buttons = this.pu.pref("disallowMousemoveButtons");
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
			this.applyButton.disabled = true;
			this._prefsSaved = true;
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
		var pps = document.getElementsByTagName("prefpane");
		for(var i = 0, len = pps.length; i < len; i++)
			pps[i].writePreferences(true /* aFlushToDisk */);
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
		if(tar.hasAttribute("hc_requiredfor"))
			this.updateDependencies(tar, true);
		if(tar.hasAttribute("preference")) {
			var p = document.getElementById(tar.getAttribute("preference"));
			if(p.getAttribute("instantApply") == "true" || p.getAttribute("hc_instantApply") == "true")
				return;
		}
		else if(ln != "checkbox")
			return;
		if(this.instantApply)
			this.savePrefs();
		else {
			this.applyButton.disabled = false;
			this._prefsSaved = false;
		}
	},
	updateAllDependencies: function() {
		Array.forEach(
			document.getElementsByAttribute("hc_requiredfor", "*"),
			this.updateDependencies,
			this
		);
	},
	updateDependencies: function(it, checkAll) {
		var checkParent = it.getAttribute("hc_checkparent") == "true";
		if(checkParent && checkAll !== true)
			return;
		var dis = it.hasAttribute("hc_disabledvalues")
			? new RegExp("(?:^|\\s)" + it.value + "(?:\\s|$)").test(it.getAttribute("hc_disabledvalues"))
			: it.hasAttribute("checked") && !checkParent
				? it.getAttribute("checked") != "true"
				: Array.every(
					(checkParent ? it.parentNode : it).getElementsByTagName("checkbox"),
					function(ch) {
						return ch.getAttribute("checked") != "true";
					}
				);
		it.getAttribute("hc_requiredfor").split(/\s+/).forEach(
			function(req) {
				var deps = document.getElementsByAttribute("hc_depends", req);
				for(var i = 0, len = deps.length; i < len; i++)
					this.desableChilds(deps[i], dis); // deps[i].disabled = dis;
			},
			this
		);
	},
	desableChilds: function(parent, dis) {
		parent.disabled = dis;
		var childs = parent.childNodes;
		for(var i = 0, len = childs.length; i < len; i++)
			this.desableChilds(childs[i], dis);
	},
	checkTreeContext: function() {
		var ln = document.popupNode.localName;
		return ln == "treechildren" || ln == "tree";
	},

	// about:config entries
	// Reset prefs:
	resetPrefs: function() {
		this.pu.prefSvc.getBranch(this.pu.nPrefix)
			.getChildList("", {})
			.forEach(this.resetPref, this);
	},
	resetPref: function(pName) {
		this.pu.resetPref(this.pu.nPrefix + pName);
	},
	// Export/import:
	exportPrefsHeader: "[Handy Clicks settings]",
	exportPrefs: function() {
		var file = this.pickFile(this.ut.getLocalized("exportPrefs"), true, "ini");
		if(!file)
			return;
		var data = this.exportPrefsHeader + "\n"
			+ this.pu.prefSvc.getBranch(this.pu.nPrefix)
				.getChildList("", {})
				.map(
					function(pName) {
						return this.pu.nPrefix + pName + "=" + this.pu.pref(pName);
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
		str.replace(/[\r\n]{1,100}/g, "\n").split(/[\r\n]+/)
			.splice(1) // Remove header
			.forEach(
				function(line, i) {
					var indx = line.indexOf("=");
					if(indx == -1) {
						this.ut._err(new Error("[Import INI] Skipped invalid line #" + i + ": " + line), true);
						return;
					}
					var pName = line.substring(0, indx);
					var pbr = this.pu.pBr;
					var pType = this.pu.prefSvc.getPrefType(pName);
					if(pType == pbr.PREF_INVALID || pName.indexOf(this.pu.nPrefix) != 0) {
						this.ut._err(new Error("[Import INI] Skipped pref with invalid name: " + pName), true);
						return;
					}
					var pVal = line.substring(indx + 1);
					if(pType == pbr.PREF_INT) // Convert string to number or boolean
						pVal = parseInt(pVal);
					else if(pType == pbr.PREF_BOOL)
						pVal = pVal == "true";
					this.pu.setPref(pName, pVal);
				},
				this
			);
	},

	// Clicking options management
	// Export/import:
	exportSets: function(partialExport, toClipboard) {
		this.selectTreePane();
		if(!toClipboard) {
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
		var p = this.ps.prefs, newPrefs = {};

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

		return this.ps.saveSettingsObjects(null, newTypes, newPrefs, true);
	},
	importSets: function(partialImport, fromClipboard) {
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
		var pSrc = fromClipboard
			? this.ut.readFromClipboard(true)
			: this.pickFile(this.ut.getLocalized("importSets"), false, "js");
		if(!pSrc)
			return;
		if(!this.checkPrefs(pSrc)) {
			this.ut.alertEx(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFormat")
			);
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
		this.setImportStatus(true, partialImport);
		if(partialImport)
			this.redrawTree();
		else {
			this.ps.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport, null, true);
			this.updTree();
		}
		if(pSrc instanceof Components.interfaces.nsILocalFile)
			this.backupsDir = pSrc.parent.path;
	},

	setImportStatus: function(isImport, isPartial) {
		this._importFlag = isImport;
		this._partialImportFlag = isPartial;
		this.closeEditors();
		if(this.prefsSaved)
			this.applyButton.disabled = true;
		var panel = this.$("hc-sets-tree-partialImportPanel");
		panel.hidden = !isImport;
		if(!isImport)
			return;
		var lAttr = "hc_label_" + (isPartial ? "partial" : "full");
		Array.forEach(
			panel.getElementsByAttribute(lAttr, "*"),
			function(elt) {
				elt.setAttribute("label", elt.getAttribute(lAttr));
			}
		);
		this.$("hc-sets-tree-buttonImportOk").focus();
	},
	importDone: function _id(ok) {
		var isPartial = this._partialImportFlag;
		this.setImportStatus(false);
		if(ok) {
			this.ps.otherSrc = false;
			if(isPartial)
				this.mergePrefs();
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
		fp.defaultExtension = "js";
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
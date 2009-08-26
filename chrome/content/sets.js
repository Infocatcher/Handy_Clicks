var handyClicksSets = {
	init: function() {
		this.ps.loadSettings();
		this.initShortcuts();

		this.drawTree();
		this.updButtons();
		this.ps.oSvc.addPrefsObserver(this.updTree, this);

		this.updPrefsUI(true);
		this.pu.oSvc.addPrefsObserver(this.updPrefsUI, this);
		// <preferences onchange="handyClicksSets.updPrefsUI();"> return some bugs

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
		this.focusSearch();
	},
	initShortcuts: function() {
		this.tree = this.$("hc-sets-tree");
		this.view = this.tree.view;
		this.selection = this.view.selection;
		this.content = this.$("hc-sets-tree-content");
		this.cmdDelete = this.$("hc-sets-cmd-delete");
		this.cmdEdit = this.$("hc-sets-cmd-edit");
		this.cmdEditType = this.$("hc-sets-cmd-editType");
		this.cmdPExpFile = this.$("hc-sets-cmd-partialExportToFile");
		this.cmdPExpClip = this.$("hc-sets-cmd-partialExportToClipboard");
		this.miEditType = this.$("hc-sets-editType");
		this.searcher._tree = this.tree;
		this.applyButton = document.documentElement.getButton("extra1");
	},
	destroy: function() {
		this.closeEditors();
	},
	closeEditors: function() {
		var pSvc = "handyClicksPrefSvc";
		this.wu.forEachWindow(
			"handyclicks:editor",
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
		this.DOMCache = { __proto__: null };
		this.rowsCache = { __proto__: null };
		var p = this.ps.prefs;
		for(var sh in p) if(p.hasOwnProperty(sh)) {
			if(!this.ps.isOkShortcut(sh) || !this.ut.isObject(p[sh])) {
				this.ut._err(new Error("Invalid shortcut in prefs: " + sh), true);
				continue;
			}
			var button = this.ps.getButtonId(sh);
			var buttonContainer = this.DOMCache[button] || this.appendContainerItem(null, button, this.ut.getLocalized(button));
			var modifiers = this.ps.getModifiersStr(sh);
			var modifiersContainer = this.DOMCache[sh] || this.appendContainerItem(buttonContainer, sh, modifiers);
			this.appendItems(modifiersContainer, p[sh], sh);
		}
		this.highlightAllOpened();
	},
	highlightAllOpened: function() {
		for(var rowId in this.rowsCache)
			this.setRowStatus(rowId, false);
		var wProp = this.wu.winIdProp;
		var otherSrc = this.ps.otherSrc;
		this.wu.forEachWindow(
			"handyclicks:editor",
			function(w) {
				if(wProp in w)
					this.setRowStatus(w[wProp], w.handyClicksPrefSvc.otherSrc == otherSrc);
			},
			this
		);
	},
	redrawTree: function() {
		var cnt = this.content;
		while(cnt.hasChildNodes())
			cnt.removeChild(cnt.lastChild);
		this.drawTree();
		this.searchInSetsTree(null, true);
		if(this.prefsSaved)
			this.applyButton.disabled = true;
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem =
			<treeitem xmlns={this.ut.XULNS} container="true" open="true">
				<treerow>
					<treecell label={label} />
				</treerow>
				<treechildren />
			</treeitem>;
		tItem = this.ut.fromXML(tItem);
		(parent || this.content).appendChild(tItem);
		return this.DOMCache[hash] = tItem.getElementsByTagName("treechildren")[0];
	},
	appendItems: function(parent, items, shortcut) {
		var tItem, tRow, it, typeLabel, isCustom, isCustomType;
		var isBuggy = false;
		for(var itemType in items) if(items.hasOwnProperty(itemType)) {
			tItem = document.createElement("treeitem");
			tRow = document.createElement("treerow");
			it = items[itemType];
			isCustom = !!it.custom;
			isCustomType = this.ps.isCustomType(itemType);
			typeLabel = isCustomType
				? this.getCustomTypeLabel(itemType)
				: this.ut.getLocalized(itemType);
			this.appendTreeCell(tRow, "label", typeLabel);
			this.appendTreeCell(tRow, "label", it.eventType);
			this.appendTreeCell(tRow, "label", isCustom ? this.ps.dec(it.label) : this.ut.getLocalized(it.action));
			this.appendTreeCell(tRow, "label",
				isCustom
					? this.ut.getLocalized("customFunction") + (this.oldTree ? " " : "\n") + this.ps.dec(it.action)
					: it.action
			);
			this.appendTreeCell(tRow, "label", this.getArguments(it.arguments || {}));
			this.addProperties(
				this.appendTreeCell(tRow, "value", it.enabled), // checkbox
				{ hc_editable: true }
			);

			isBuggy = !this.ps.isOkFuncObj(it)
				|| (isCustomType && !this.ps.types.hasOwnProperty(itemType));
			this.addProperties(tRow, { hc_disabled: !it.enabled, hc_buggy: isBuggy, hc_custom: isCustom || isCustomType });

			tRow.__shortcut = shortcut;
			tRow.__itemType = itemType;
			tRow.__isCustomType = isCustomType;
			tItem.appendChild(tRow);
			parent.appendChild(tItem);
			this.rowsCache[shortcut + "-" + itemType] = tRow;
		}
	},
	getCustomTypeLabel: function(type) {
		var label = this.ut.getOwnProperty(this.ps.types, type, "label");
		return (label ? this.ps.dec(label) + " " : "") + "(" + type + ")";
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
	addCellsProperties: function(rows, propsObj) {
		Array.forEach(
			rows,
			function(row) {
				Array.forEach(
					row.getElementsByTagName("treecell"),
					function(cell) {
						this.addProperties(cell, propsObj);
					},
					this
				);
			},
			this
		);
	},
	appendTreeCell: function(parent, attrName, attrValue) {
		var cell = document.createElement("treecell");
		cell.setAttribute(attrName, attrValue);
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
		var tbo = this.tree.treeBoxObject;
		var fvr = tbo.getFirstVisibleRow();
		var numRanges = this.selection.getRangeCount();
		var selRows = [];
		var start = {}, end = {};
		for(var i = 0; i < numRanges; i++) {
			this.selection.getRangeAt(i, start, end);
			selRows.push([start.value, end.value]);
		}

		this.redrawTree();
		var rowsCount = this.content.getElementsByTagName("treerow").length;
		if(!rowsCount)
			return;
		var maxRowsIndx = rowsCount - 1;

		selRows.forEach(
			function(range) {
				if(range[0] <= maxRowsIndx)
					this.selection.rangedSelect(range[0], this.ut.mm(range[1], 0, maxRowsIndx), true);
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
		var selRows = this.selectedRows;
		var noSel = !selRows.length;
		["cmdDelete", "cmdEdit", "cmdPExpFile", "cmdPExpClip"].forEach(
			function(hash) { this[hash].setAttribute("disabled", noSel); },
			this
		);
		var noTypes = noSel || !selRows.some(function(row) { return row.__isCustomType; });
		this.cmdEditType.setAttribute("disabled", noTypes);
		this.miEditType.hidden = noTypes;
	},
	get selectedRows() {
		var numRanges = this.selection.getRangeCount();
		var tRowsArr = [];
		if(numRanges == 0)
			return tRowsArr;
		var start = {}, end = {};
		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		for(var t = 0; t < numRanges; t++) {
			this.selection.getRangeAt(t, start, end);
			for(var v = start.value; v <= end.value; v++) {
				if(v == -1)
					continue;
				tRow = tRows[v];
				if(!tRow || this.view.isContainer(v) || !("__shortcut" in tRow) || !("__itemType" in tRow))
					continue;
				tRowsArr.push(tRow); // for deleting (getElementsByTagName is dinamically)
				tRow.__index = v;
			}
		}
		return tRowsArr;
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
	addItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var rows = this.selectedRows;
		if(rows.length == 1)
			this.openEditorWindow(rows[0], "shortcut", true);
		else
			this.openEditorWindow();
	},
	editItems: function(e) {
		if(e && !this.isClickOnRow(e)) {
			this.addItems();
			return;
		}
		if(e && e.button && e.button != 0)
			return;
		if(!this.isTreePaneSelected)
			return;
		var rows = this.selectedRows;
		if(this.editorsLimit(rows.length))
			return;
		this.selectedRows.forEach(this.openEditorWindow, this);
	},
	editItemsTypes: function() {
		if(!this.isTreePaneSelected)
			return;
		var cRows = [], rows = this.selectedRows;
		rows.forEach(
			function(row) {
				row.__isCustomType && cRows.push(row);
			},
			this
		);
		if(this.editorsLimit(cRows.length))
			return;
		cRows.forEach(
			function(row) {
				this.openEditorWindow(row, "itemType");
			},
			this
		);
	},
	editorsLimit: function(count) {
		var lim = this.pu.pref("sets.openEditorsLinit");
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
			this.pu.pref("sets.openEditorsLinit", 0);
		return false;
	},
	isClickOnRow: function(e) {
		var row = {}, col = {}, obj = {};
		this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		return row.value > -1;
	},
	deleteItems: function() {
		if(!this.isTreePaneSelected)
			return;
		var tRows = this.selectedRows;
		if(!tRows.length)
			return;

		var del = tRows.map(
			function(tRow, i) {
				tRow = tRows[i];
				var mdfs = this.ps.getModifiersStr(tRow.__shortcut);
				var button = this.ps.getButtonStr(tRow.__shortcut, true);
				var type = this.ps.isCustomType(type)
					? this.getCustomTypeLabel(tRow.__itemType)
					: this.ut.getLocalized(tRow.__itemType);
				var fObj = this.ut.getOwnProperty(this.ps.prefs, tRow.__shortcut, tRow.__itemType);
				var label = this.ut.isObject(fObj)
					? this.ut.getOwnProperty(fObj, "custom")
						? this.ps.dec(fObj.label || "")
						: this.ut.getLocalized(fObj.action || "")
					: "?";
				return mdfs + " + " + button + " + " + type + " \u21d2 " + label.substr(0, 42); // "=>" symbol
			},
			this
		);
		var maxRows = 12;
		if(del.length > maxRows)
			del.splice(maxRows - 2, del.length - maxRows + 1, "\u2026"); // "..." symbol

		if(
			!this.ut.confirmEx(
				this.ut.getLocalized("title"),
				this.ut.getLocalized("deleteConfirm").replace("%n", tRows.length)
					+ "\n\n" + del.join("\n")
			)
		)
			return;
		tRows.forEach(this.deleteItem, this);
		this.applyButton.disabled = false;
	},
	deleteItem: function(tRow) {
		var sh = tRow.__shortcut;
		var type = tRow.__itemType;
		if(!sh || !type)
			return;
		var p = this.ps.prefs;
		var so = p[sh];
		delete so[type];
		if(this.ut.isEmptyObj(so))
			delete p[sh];
		var tItem = tRow.parentNode;
		var tChld = tItem.parentNode;
		tChld.removeChild(tItem);
		for(var i = 0; i < 2; i++) {
			if(tChld.hasChildNodes())
				break;
			tItem = tChld.parentNode;
			tChld = tItem.parentNode;
			tChld.removeChild(tItem);
		}
	},
	openEditorWindow: function(tRow, mode, add) { // mode: "shortcut" or "itemType"
		var shortcut = tRow ? tRow.__shortcut : Date.now() + "-" + Math.random();
		var itemType = tRow && add !== true ? tRow.__itemType : null;
		this.wu.openEditor(this.ps.currentSrc, mode, shortcut, itemType);
	},
	setRowStatus: function(rowId, editStat) {
		rowId = rowId.replace(/-otherSrc$/, "");
		if(rowId in this.rowsCache)
			this.addCellsProperties([this.rowsCache[rowId]], { hc_edited: editStat });
	},
	toggleEnabled: function(e) {
		var rowIndx, column, tRow;
		var changed = true;
		if(e) {
			if(e.button != 0)
				return;
			var row = {}, col = {}, obj = {};
			this.tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
			if(row.value == -1 || col.value == null)
				return;
			rowIndx = row.value;
			column = col.value;
			changed = this.toggleRowEnabled(rowIndx, column, tRow);
		}
		else { // Space button pressed
			var fi = document.commandDispatcher.focusedElement;
			if(fi && fi.localName != "tree")
				return;
			var rows = this.selectedRows;
			if(!rows.length)
				return;
			var columns = this.tree.columns;
			column = columns[columns.length - 1];
			rows.forEach(
				function(tRow) {
					this.toggleRowEnabled(tRow.__index, column, tRow);
				},
				this
			);
		}
		if(!changed)
			return;
		if(this.instantApply && !this.ps.otherSrc)
			this.ps.saveSettingsObjects(true);
		else
			this.applyButton.disabled = false;
	},
	toggleRowEnabled: function(rowIndx, column, tRow) {
		var checked = this.view.getCellValue(rowIndx, column);
		if(!checked) // real checked is "true" or "false"
			return false;
		var enabled = checked != "true";
		tRow = tRow || this.content.getElementsByTagName("treerow")[rowIndx];
		this.addProperties(tRow, { disabled: !enabled });
		var tCell = tRow.getElementsByTagName("treecell")[column.index];
		tCell.setAttribute("value", enabled);
		this.ps.prefs[tRow.__shortcut][tRow.__itemType].enabled = enabled;
		return true;
	},
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.selection.selectAll();
	},
	smartSelect: function _ss(e) {
		var row = this.tree.treeBoxObject.getRowAt(e.clientX, e.clientY);
		var et = e.type;
		if(et == "mouseout")
			return _ss.row0 = _ss.row1 = undefined;
		if(row == -1)
			return false;
		if(et == "mousedown")
			return _ss.row0 = row;
		// mouseup or mousemove:
		var row0 = this.ut.getOwnProperty(_ss, "row0");
		if(row0 === undefined)
			return false;
		var row1 = this.ut.getOwnProperty(_ss, "row1");
		_ss.row1 = row;

		setTimeout(function(_this, row0, row1, row) {
			if(row1 !== undefined)
				_this.selection.clearRange(row0, row1);
			if(row0 != row)
				_this.selection.rangedSelect(row0, row, true);
		}, 0, this, row0, row1, row);

		if(et == "mouseup")
			return _ss.row0 = _ss.row1 = undefined;
		// mousemove:
		_ss.row1 = row;
		if(row <= this.tree.treeBoxObject.getFirstVisibleRow() + 2)
			var visRow = row - 2;
		else if(row >= this.tree.treeBoxObject.getLastVisibleRow() - 2)
			var visRow = row + 2;
		else
			return false;
		var maxRowsIndx = this.content.getElementsByTagName("treerow").length - 1;
		this.tree.treeBoxObject.ensureRowIsVisible(this.ut.mm(visRow, 0, maxRowsIndx));
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

	_alloySearch: true,
	_searchTimeout: null,
	_searchDelay: 50,
	_tryInterval: 20,
	searcher: {
		_res: [], // row numbers
		_tree: null,
		_current: 0,
		clear: function() { this._res = []; this._current = 0; },
		add: function(r) { this._res.push(r); },
		get _length() { return this._res.length; },
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
			this._tree.view.selection.select(i);
			this._tree.treeBoxObject.ensureRowIsVisible(i);
		}
	},
	navigateSearchResults: function(e) {
		if(e.keyCode == e.DOM_VK_DOWN)
			this.searcher.next();
		else if(e.keyCode == e.DOM_VK_UP)
			this.searcher.prev();
		else
			return;
		e.preventDefault();
	},
	_searchInSetsTree: function(sIt) {
		setTimeout(function(_this, sIt) { _this.searchInSetsTree(sIt); }, 0, this, sIt);
	},
	searchInSetsTree: function(sIt, notSelect) {
		if(sIt && !this._alloySearch) {
			clearTimeout(this._searchTimeout);
			this._searchTimeout = setTimeout(
				function(_this, _a) {
					_a.callee.apply(_this, _a);
				},
				this._tryInterval,
				this, arguments
			);
			return;
		}
		this._alloySearch = false;
		this.searcher.clear();
		sIt = sIt || this.$("hc-sets-tree-searchField");
		var sVal = sIt.value.replace(/^\s+|\s+$/g, "");
		var _sVal = sVal.toLowerCase().split(/\s+/);
		var sLen = _sVal.length;
		var hasVal = !!sVal;

		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		var labels, tmpArr, rowText;
		var okRow, notFound = true;
		var i, j, k, rLen, lLen;
		for(i = 0, rLen = tRows.length; i < rLen; i++) {
			tRow = tRows[i];
			if(tRow.__shortcut && tRow.__itemType) {
				okRow = hasVal;
				tmpArr = [];
				labels = tRow.getElementsByAttribute("label", "*");
				for(j = 0, lLen = labels.length; j < lLen; j++)
					tmpArr.push(labels[j].getAttribute("label"));
				rowText = tmpArr.join("\n").toLowerCase();
				if(hasVal)
					for(k = 0; k < sLen; k++)
						if(rowText.indexOf(_sVal[k]) == -1)
							okRow = false;
				this.addProperties(tRow, { hc_search: okRow });
				if(okRow) {
					this.searcher.add(i);
					if(notFound) {
						notFound = false;
						if(!notSelect) // Don't select for redraw
							this.searcher.select(i);
					}
				}
			}
		}
		sIt.setAttribute("hc_notfound", hasVal && notFound);
		setTimeout(function(_this) { _this._alloySearch = true; }, this._searchDelay, this);
	},

	/*** Prefs pane ***/
	updPrefsUI: function(loadFlag) {
		this.loadPrefs();
		if(loadFlag)
			this.updateAllDependencies();
		else {
			setTimeout(function(_this) { // Wait for prefpanes update
				_this.updateAllDependencies();
			}, 0, this);
		}
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
			&& !this.ut.confirmEx(this.ut.getLocalized("title"), this.ut.getLocalized("partialImportIncomplete"))
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
		if(!tar.hasAttribute("preference") && ln != "checkbox")
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
					function(ch) { return ch.getAttribute("checked") != "true"; }
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
			var file = this.pickFile(this.ut.getLocalized("exportSets"), true, "js");
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
		var rows = this.selectedRows;
		rows.forEach(
			function(row) {
				if(row.__isCustomType)
					exCts[row.__itemType] = true;
				exSh[row.__shortcut] = exSh[row.__shortcut] || { __proto__: null };
				exSh[row.__shortcut][row.__itemType] = true;
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

		this.addCellsProperties(rows, { hc_copied: true });
		setTimeout(function(_this, rows) {
			_this.addCellsProperties(rows, { hc_copied: false });
		}, 200, this, rows);

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
			? this.ut.readFromClipboard()
			: this.pickFile(this.ut.getLocalized("importSets"), false, "js");
		if(!pSrc)
			return;
		if(!this.checkPrefs(pSrc, partialImport)) {
			this.ut.alertEx(
				this.ut.getLocalized("importErrorTitle"),
				this.ut.getLocalized("invalidConfigFormat")
			);
			return;
		}
		if(partialImport) {
			!this.ps.otherSrc && this.ps.saveSettingsObjects(true); // Save current state
			this.ps.loadSettings(pSrc);
			if(this.ps._loadError)
				return;
			this.ps.reloadSettings(false);
			this.redrawTree();
			this.$("hc-sets-tree-partialImportPanel").hidden = false;
		}
		else {
			this.ps.moveFiles(this.ps.prefsFile, this.ps.names.beforeImport);
			// Do not start full import from clipboard!
			pSrc.copyTo(this.ps.prefsDir, this.ps.prefsFileName + ".js");
			//this.ps.reloadSettings(true);
			this.ps.loadSettings();
			this.updTree();
			this.applyButton.disabled = false;
		}
		if(pSrc instanceof Components.interfaces.nsILocalFile)
			this.backupsDir = pSrc.parent.path;
	},
	partialImportDone: function(ok) {
		if(ok)
			this.mergePrefs();
		else {
			this.ps.loadSettings();
			this.updTree();
		}
		this.$("hc-sets-tree-partialImportPanel").hidden = true;
		this.closeEditors();
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

		this.ps.saveSettingsObjects(true);
	},

	// Export/import utils:
	pickFile: function(pTitle, modeSave, ext) {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		fp.defaultString = this.ps.prefsFileName + (modeSave ? this.date : "") + "." + ext;
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
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try { file.initWithPath(path); }
		catch(e) { return null; }
		return file.exists() ? file : null;
	},
	set backupsDir(path) {
		this.pu.pref("sets.backupsDir", path);
	},
	get date() {
		return new Date().toLocaleFormat("_%Y-%m-%d_%H-%M");
	},
	checkPrefs: function(pSrc, partialImport) {
		if(pSrc instanceof Components.interfaces.nsILocalFile)
			pSrc = this.ut.readFromFile(pSrc);
		if(!this.ps.checkPrefsStr(pSrc))
			return false;
		if(!partialImport)
			this.ps._savedStr = pSrc; // Update cache - see this.ps.saveSettings()
		return true;
	},
	checkClipboard: function() {
		this.$("hc-sets-cmd-partialImportFromClipboard")
			.setAttribute("disabled", !this.ps.checkPrefsStr(this.ut.readFromClipboard()));
	}
};
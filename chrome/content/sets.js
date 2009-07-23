var handyClicksSets = {
	// Shortcuts:
	ut: handyClicksUtils,
	wu: handyClicksWinUtils,
	pu: handyClicksPrefUtils,
	ps: handyClicksPrefSvc,

	DOMCache: { __proto__: null },
	rowsCache: { __proto__: null },
	init: function() {
		this.initShortcuts();

		this.drawTree();
		this.updButtons();
		this.ps.addPrefsObserver(this.updTree, this);

		this.updPrefsUI();
		this.pu.addPrefsObserver(this.updPrefsUI, this);
		// <preferences ononchange="handyClicksSets.updPrefsUI();"> return some bugs

		if(this.ut.fxVersion >= 3.5) {
			var s = this.$("handyClicks-setsTreeSearch");
			s.type = "search";
			s._clearSearch = function() { this.value = ""; this.oninput && this.oninput(); };
		}

		this.instantApply = this.pu.getPref("browser.preferences.instantApply");
		if(this.instantApply)
			this.applyButton.hidden = true;
		else
			this.applyButton.disabled = true;
		this.focusSearch();
	},
	initShortcuts: function() {
		this.tree = this.$("handyClicks-setsTree");
		this.view = this.tree.view;
		this.selection = this.view.selection;
		this.content = this.$("handyClicks-setsTreeContent");
		this.cmdDelete = this.$("handyClicks-sets-cmdDelete");
		this.cmdEdit = this.$("handyClicks-sets-cmdEdit");
		this.cmdEditType = this.$("handyClicks-sets-cmdEditType");
		this.miEditType = this.$("handyClicks-sets-miEditType");
		this.searcher._tree = this.tree;
		this.applyButton = document.documentElement.getButton("extra1");
	},

	/*** Actions pane ***/
	$: function(id) {
		return document.getElementById(id);
	},
	drawTree: function() {
		var p = handyClicksPrefs;
		for(var sh in p) {
			if(!p.hasOwnProperty(sh))
				continue;
			if(!this.ps.isOkShortcut(sh) || typeof p[sh] != "object") {
				this.ut._err(this.ut.errPrefix + "Invalid shortcut in prefs: " + sh);
				continue;
			}
			var button = this.ps.getButtonStr(sh);
			var buttonContainer = this.DOMCache[button] || this.appendContainerItem(null, button, this.ut.getLocalised(button));
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
		var ws = this.wu.wm.getEnumerator("handyclicks:editor");
		var w;
		while(ws.hasMoreElements()) {
			w = ws.getNext();
			if(wProp in w)
				this.setRowStatus(w[wProp], true);
		}
	},
	redrawTree: function() {
		this.DOMCache = { __proto__: null };
		this.rowsCache = { __proto__: null };
		var cnt = this.content;
		while(cnt.hasChildNodes())
			cnt.removeChild(cnt.lastChild);
		this.drawTree();
	},
	appendContainerItem: function(parent, hash, label) {
		var tItem = document.createElement("treeitem");
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		var tRow = document.createElement("treerow");
		var tSell = document.createElement("treecell");
		tSell.setAttribute("label", label);
		tRow.appendChild(tSell);
		tItem.appendChild(tRow);
		var tChildren = tItem.appendChild(document.createElement("treechildren"));
		(parent || this.content).appendChild(tItem);
		this.DOMCache[hash] = tChildren;
		return tChildren;
	},
	appendItems: function(parent, items, shortcut) {
		var tItem, tRow, it, typeLabel, isCustom, isCustomType;
		var isBuggy = false;
		for(var itemType in items) {
			if(!items.hasOwnProperty(itemType))
				continue;
			tItem = document.createElement("treeitem");
			tRow = document.createElement("treerow");
			it = items[itemType];
			isCustom = !!it.custom;
			isCustomType = itemType.indexOf("custom_") == 0;
			typeLabel = isCustomType
				? this.getCustomTypeLabel(itemType)
				: this.ut.getLocalised(itemType);
			this.appendTreeCell(tRow, "label", typeLabel);
			this.appendTreeCell(tRow, "label", it.eventType);
			this.appendTreeCell(tRow, "label", isCustom ? this.ps.dec(it.label) : this.ut.getLocalised(it.action));
			this.appendTreeCell(tRow, "label",
				isCustom ? this.ut.getLocalised("customFunction") + this.ps.dec(it.action) : it.action
			);
			this.appendTreeCell(tRow, "label", this.getArguments(it.arguments || {}));
			var chBox = this.appendTreeCell(tRow, "value", it.enabled);
			this.addProperties(chBox, { hc_editable: true });

			isBuggy = !this.ps.isOkFuncObj(it)
				|| (isCustomType && !handyClicksCustomTypes.hasOwnProperty(itemType));
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
		var ct = this.ut.getProperty(handyClicksCustomTypes, type) || {};
		var label = this.ut.getProperty(ct, "label");
		return (label ? this.ps.dec(label) + " " : "") + "(" + type + ")";
	},
	addProperties: function(tar, propsObj) {
		var propsVal = tar.getAttribute("properties");
		for(var p in propsObj) {
			if(!propsObj.hasOwnProperty(p))
				continue;
			propsVal = propsVal.replace(p, "");
			if(propsObj[p])
				propsVal += " " + p;
		}
		tar.setAttribute("properties", propsVal.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " "));
	},
	appendTreeCell: function(parent, attrName, attrValue) {
		var cell = document.createElement("treecell");
		cell.setAttribute(attrName, attrValue);
		return parent.appendChild(cell);
	},
	getArguments: function(argsObj) {
		var res = [];
		for(var p in argsObj)
			if(argsObj.hasOwnProperty(p))
				res.push(p + " = " + uneval(argsObj[p])); //~ todo: this.ut.getLocalised(p) ?
		return res.join(", \n");
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
		this.updButtons();

		selRows.forEach(
			function(range) {
				this.selection.rangedSelect(range[0], range[1], true);
			},
			this
		);
		if(typeof fvr == "number")
			tbo.scrollToRow(fvr);
		this.searchInSetsTree(null, true);
	},
	updButtons: function() {
		var selRows = this.selectedRows;
		var noSel = !selRows.length;
		["cmdDelete", "cmdEdit"].forEach(
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
		var start = {};
		var end = {};
		var tRows = this.content.getElementsByTagName("treerow"), tRow;
		for(var t = 0; t < numRanges; t++) {
			this.selection.getRangeAt(t, start, end);
			for(var v = start.value; v <= end.value; v++) {
				if(this.view.isContainer(v))
					continue;
				tRow = tRows[v];
				if(tRow.__shortcut && tRow.__itemType) {
					tRowsArr.push(tRow); // for deleting (getElementsByTagName is dinamically)
					tRow.__index = v;
				}
			}
		}
		return tRowsArr;
	},
	get isTreePaneSelected() {
		var prefWin = this.$("handyClicks-settings");
		return prefWin.currentPane == prefWin.preferencePanes[0];
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
		if(this.isTreePaneSelected)
			this.openEditorWindow(null);
	},
	editItems: function(e) {
		if(e && e.originalTarget.localName != "treechildren") //~ todo: test in fx < 3.0
			return;
		if(e && !this.isClickOnRow(e)) {
			this.addItems();
			return;
		}
		if(e && e.button && e.button != 0)
			return;
		if(!this.isTreePaneSelected)
			return;
		this.selectedRows.forEach(this.openEditorWindow, this);
	},
	editItemsTypes: function() {
		if(!this.isTreePaneSelected)
			return;
		this.selectedRows.forEach(
			function(row) {
				if(row.__isCustomType)
					this.openEditorWindow(row, "itemType");
			},
			this
		);
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

		var del = [];
		var maxRows = 12;
		var tRow;
		for(var i = 0, len = tRows.length; i < len; i++) {
			tRow = tRows[i];
			var mdfs = this.ps.getModifiersStr(tRow.__shortcut);
			var button = this.ps.getLocaleButtonStr(tRow.__shortcut, true);
			var type = tRow.__itemType.indexOf("custom_") == 0
				? this.getCustomTypeLabel(tRow.__itemType)
				: this.ut.getLocalised(tRow.__itemType);
			var fObj = this.ut.getProperty(handyClicksPrefs, tRow.__shortcut, tRow.__itemType);
			var label = typeof fObj == "object"
				? this.ut.getProperty(fObj, "custom")
					? this.ps.dec(fObj.label || "")
					: this.ut.getLocalised(fObj.action || "")
				: "?";
			del.push(mdfs + " + " + button + " + " + type + " \u21d2 " + label.substr(0, 42)); // =>
		}
		if(del.length > maxRows)
			del.splice(maxRows - 2, del.length - maxRows + 1, "\u2026"); // ...

		if(
			!this.ut.confirmEx(
				this.ut.getLocalised("title"),
				this.ut.getLocalised("deleteConfirm").replace("%n", tRows.length)
					+ "\n\n" + del.join("\n")
			)
		)
			return;
		tRows.forEach(this.deleteItem, this);
		this.applyButton.disabled = false;
	},
	deleteItem: function(tRow) {
		var shortcut = tRow.__shortcut;
		var itemType = tRow.__itemType;
		if(shortcut && itemType) {
			var shortcutObj = handyClicksPrefs[shortcut];
			delete shortcutObj[itemType];
			if(this.isEmptyObj(shortcutObj))
				delete handyClicksPrefs[shortcut];

			var tItem = tRow.parentNode;
			var tChld = tItem.parentNode;
			tChld.removeChild(tItem);
			for(var i = 0; i < 2; i++)
				if(!tChld.hasChildNodes()) {
					tItem = tChld.parentNode;
					tChld = tItem.parentNode;
					tChld.removeChild(tItem);
				}
		}
	},
	isEmptyObj: function(obj) {
		for(var p in obj)
			if(obj.hasOwnProperty(p))
				return false;
		return true;
	},
	openEditorWindow: function(tRow, mode) { // mode: "shortcut" or "itemType"
		var shortcut = tRow ? tRow.__shortcut : Date.now() + "-" + Math.random();
		var itemType = tRow ? tRow.__itemType : null;
		this.wu.openEditor(mode, shortcut, itemType);
	},
	setRowStatus: function(rowId, editStat) {
		if(!(rowId in this.rowsCache))
			return;
		Array.prototype.forEach.call( // Status for all cells in row
			this.rowsCache[rowId].getElementsByTagName("treecell"),
			function(cell) {
				this.addProperties(cell, { hc_edited: editStat });
			},
			this
		);
		// this.addProperties(this.rowsCache[rowId], { hc_edited: editStat });
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
		if(this.instantApply)
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
		handyClicksPrefs[tRow.__shortcut][tRow.__itemType].enabled = enabled;
		return true;
	},
	selectAll: function() {
		if(this.isTreePaneSelected)
			this.selection.selectAll();
	},

	/*** Search in tree ***/
	focusSearch: function(e) {
		if(!this.isTreePaneSelected)
			return;
		var sIt = this.$("handyClicks-setsTreeSearch");
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
		sIt = sIt || this.$("handyClicks-setsTreeSearch");
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
	updPrefsUI: function() {
		this.loadPrefs();
		this.updateAllDependencies();
		this.showPrefs();
	},
	loadPrefs: function() {
		var id = "disallowMousemoveForButtons";
		var buttons = this.pu.pref(id);
		for(var i = 0; i <= 2; i++)
			this.$(id + "-" + i).checked = buttons.indexOf(i) > -1;
	},
	savePrefs: function(applyFlag) {
		var id = "disallowMousemoveForButtons";
		var val = "";
		for(var i = 0; i <= 2; i++)
			if(this.$(id + "-" + i).checked)
				val += i;
		this.pu.setPref("extensions.handyclicks." + id, val);
		this.ps.saveSettingsObjects(applyFlag);
		if(applyFlag && !this.instantApply) {
			this.savePrefpanes();
			this.applyButton.disabled = true;
		}
	},
	savePrefpanes: function() {
		var pps = document.getElementsByTagName("prefpane");
		for(var i = 0, len = pps.length; i < len; i++)
			pps[i].writePreferences(true); // aFlushToDisk
	},
	showPrefs: function(enablIt) {
		enablIt = enablIt || this.$("handyClicks-sets-enabled");
		enablIt.setAttribute("hc_hideallafter", enablIt.getAttribute("checked") != "true");
	},
	updateAllDependencies: function() {
		var reqs = document.getElementsByAttribute("hc_requiredfor", "*");
		for(var i = 0, len = reqs.length; i < len; i++)
			this.updateDependencies(reqs[i]);
	},
	prefsChanged: function(e) {
		var tar = e.target;
		if(tar.localName == "prefwindow") {
			this.focusSearch(e);
			return;
		}
		if(tar.localName == "menuitem")
			tar = tar.parentNode.parentNode;
		if(tar.hasAttribute("hc_requiredfor"))
			this.updateDependencies(tar);
		if(!tar.hasAttribute("preference") && tar.localName != "checkbox")
			return;
		if(this.instantApply)
			this.savePrefs();
		else
			this.applyButton.disabled = false;
	},
	updateDependencies: function(it) {
		var dis = it.hasAttribute("hc_disabledvalues")
			? new RegExp("(?:^|\\s)" + it.value + "(?:\\s|$)").test(it.getAttribute("hc_disabledvalues"))
			: it.getAttribute("checked") != "true";
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
	}
};
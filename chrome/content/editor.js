var handyClicksEditor = {
	init: function() {
		var wa = window.arguments;
		if(!wa[0] || !wa[1] || !window.opener)
			return;
		this.initShortcuts();
		this.initShortcutEditor();
		this.initCustomTypesEditor();
		this.mBox.selectedIndex = this.mode == "shortcut" ? 0 : 1;
	},
	$: function(id) {
		return document.getElementById(id);
	},
	initShortcuts: function() {
		this.op = window.opener;
		this.mBox = this.$("hc-editor-mainTabbox");
		this.fBox = this.$("hc-editor-funcsTabbox");
		this.code = this.$("hc-editor-funcField");
		var wa = window.arguments;
		this.mode = wa[0];
		this.target = wa[1];
		this.type = wa[2];
	},
	initShortcutEditor: function() {
		var setsObj = handyClicksPrefs[this.target][this.type];
		this.fBox.selectedIndex = setsObj.custom ? 1 : 0;
		if(setsObj.custom)
			this.code.value = decodeURIComponent(setsObj.action);
		var ml = this.appendFuncsList();
		ml.value = this.type;
		//~ todo:
		// appendItemTypes();
		// set
	},
	initCustomTypesEditor: function() {

	},
	appendFuncsList: function() {
		var sep = this.$("hc-editor-customTypesSep");
		var parent = sep.parentNode;
		var cTypes = handyClicksCustomTypes;
		var mi;
		for(var cType in cTypes) {
			mi = document.createElement("menuitem");
			mi.setAttribute("value", cType);
			mi.setAttribute("label", cType); //~ todo: other?
			parent.insertBefore(mi, sep);
		}
		return parent.parentNode; // <menulist>
	}
};
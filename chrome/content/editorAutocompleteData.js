var handyClicksAutocompleteData = {
	minLength: 3,
	get jsStatements() {
		var ret = this._jsStatements.filter(this.lengthFilter, this).concat(this.jsProps).sort();
		delete this.jsStatements;
		delete this._jsStatements;
		return this.jsStatements = ret;
	},
	get jsProps() {
		var ret = this._jsProps;

		var dummy = document.createElement("iframe");
		dummy.setAttribute("collapsed", "true");
		document.documentElement.appendChild(dummy);
		var win = dummy.contentWindow;
		setTimeout(function() {
			dummy.parentNode.removeChild(dummy);
		}, 0);

		var objs = [
			Object,
			Function.prototype,
			Array,  Array.prototype,
			Date,   Date.prototype,
			String, String.prototype,
			Number, Number.prototype,
			RegExp, RegExp.prototype,
			Math,
			Error,
			Node.prototype,
			Event.prototype,
			KeyEvent,
			Components,
			Components.interfaces,
			win,
			win.document,
			document.documentElement.style,
			new XMLHttpRequest(),
			navigator,
			screen,
			window.getSelection(),
			document.createRange(),
			document.styleSheets.length && document.styleSheets[0],
			document.createEvent("MouseEvents")
		].forEach(function(o) {
			o && this.appendProperties(ret, o);
		}, this);
		delete this.jsProps;
		delete this._jsProps;
		return this.jsProps = this.uniqueSort(ret.filter(this.lengthFilter, this));
	},
	get jsStrings() {
		var ret = this._jsStrings.filter(this.lengthFilter, this).sort();
		delete this.jsStrings;
		delete this._jsStrings;
		return this.jsStrings = ret;
	},
	appendProperties: function(arr, obj) {
		if("getOwnPropertyNames" in Object) { // JavaScript 1.8.5
			for(var o = obj; o; o = Object.getPrototypeOf(o))
				arr.push.apply(arr, Object.getOwnPropertyNames(o));
		}
		else {
			for(var p in obj)
				arr.push(p);
		}
	},
	lengthFilter: function(s) {
		return s.length >= this.minLength;
	},
	uniqueSort: function(arr) {
		return arr.sort().filter(function(it, i, arr) {
			return it !== arr[i - 1];
		});
	},
	// Keywords database:
	_jsStatements: [
		// Operators:
		"delete",
		"function",
		"in",
		"instanceof",
		"new",
		"typeof",
		"var",
		"void",
		// Non-standard operators:
		"const",
		"get",
		"let",
		"set",
		"yield",
		// Conditional:
		"break",
		"case",
		"catch",
		"continue",
		"default",
		"do",
		"else",
		"finally",
		"for",
		"if",
		"return",
		"switch",
		"throw",
		"try",
		"while",
		"with",
		// Keywords:
		"false",
		"null",
		"this",
		"true"
	],
	_jsProps: [
		// JSON methods:
		"stringify",
		"parse",

		// Window events:
		"ondrop",
		"onmozorientation",
		"onpagehide",
		"onpageshow",
		"onpaint",
		"onpopstate",
		"onabort",
		"onbeforeunload",
		"onblur",
		"onchange",
		"onclick",
		"onclose",
		"oncontextmenu",
		"ondragdrop",
		"onerror",
		"onfocus",
		"onhashchange",
		"onkeydown",
		"onkeypress",
		"onkeyup",
		"onload",
		"onmousedown",
		"onmousemove",
		"onmouseout",
		"onmouseover",
		"onmouseup",
		"onreset",
		"onresize",
		"onscroll",
		"onselect",
		"onsubmit",
		"onunload",

		// Window.location:
		// Window.location properties:
		"hash",
		"host",
		"hostname",
		"href",
		"pathname",
		"port",
		"protocol",
		"search",
		// Window.location methods:
		"assign",
		"reload",
		"replace",

		// Document events:
		"onafterscriptexecute",
		"onbeforescriptexecute",
		"onoffline",
		"ononline",
		"onreadystatechange",

		// Node events:
		"oncopy",
		"oncut",
		"onpaste",
		"offline",
		"onbeforeunload",
		"onblur",
		"onchange",
		"onclick",
		"oncontextmenu",
		"ondblclick",
		"onfocus",
		"onkeydown",
		"onkeypress",
		"onkeyup",
		"online",
		"onmousedown",
		"onmousemove",
		"onmouseout",
		"onmouseover",
		"onmouseup",
		"onresize",
		"onscroll",
		"textInput",

		// HTMLCollection methods:
		"item",
		"namedItem",

		// MutationObserver:
		"MutationObserver",
		//"observe",
		"disconnect",
		"takeRecords",
		// MutationRecord:
		"type",
		"target",
		"addedNodes",
		"removedNodes",
		"attributeName",
		"attributeNamespace",
		"oldValue",

		// Special:
		"__iterator__",
		"__proto__",

		// XPCOM:
		// nsISimpleEnumerator
		"getNext",
		"hasMoreElements",
		// nsIObserver
		"observe",
		// nsIObserverService
		"addObserver",
		"enumerateObservers",
		"notifyObservers",
		"removeObserver",
		// nsIEventHandler
		"handleEvent"
	],
	_jsStrings: [
		"abort",
		"beforeunload",
		"blur",
		"change",
		"click",
		"close",
		"command",
		"contextmenu",
		"copy",
		"cut",
		"dblclick",
		"dragdrop",
		"drop",
		"error",
		"focus",
		"hashchange",
		"keydown",
		"keypress",
		"keyup",
		"line",
		"load",
		"mousedown",
		"mousemove",
		"mouseout",
		"mouseover",
		"mouseup",
		"mozorientation",
		"pagehide",
		"pageshow",
		"paint",
		"paste",
		"popstate",
		"reset",
		"resize",
		"scroll",
		"select",
		"submit",
		"unload",

		"DOMActivate",
		"DOMAttributeNameChanged",
		"DOMAttrModified",
		"DOMCharacterDataModified",
		"DOMContentLoaded",
		"DOMElementNameChanged",
		"DOMFocusIn",
		"DOMFocusOut",
		"DOMFrameContentLoaded",
		"DOMLinkAdded",
		"DOMLinkRemoved",
		"DOMMenuItemActive",
		"DOMMenuItemInactive",
		"DOMModalDialogClosed",
		"DOMMouseScroll",
		"DOMNodeInserted",
		"DOMNodeInsertedIntoDocument",
		"DOMNodeRemoved",
		"DOMNodeRemovedFromDocument",
		"DOMSubtreeModified",
		"DOMTitleChanged",
		"DOMWillOpenModalDialog",
		"DOMWindowClose",

		"MozAfterPaint",
		"MozMousePixelScroll",
		"PluginNotFound",
		"PopupWindow",

		"boolean",
		"number",
		"object",
		"string",
		"undefined",
		"xml"
	]
};
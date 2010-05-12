var handyClicksAutocompleteData = {
	minLength: 3,
	get jsStatements() {
		var ret = this._jsStatements.filter(this.lengthFilter, this).concat(this.jsProps).sort();
		delete this.jsStatements;
		delete this._jsStatements;
		return this.jsStatements = ret;
	},
	get jsProps() {
		var ret = this._jsProps.filter(this.lengthFilter, this).sort();
		delete this.jsProps;
		delete this._jsProps;
		return this.jsProps = ret;
	},
	get jsStrings() {
		var ret = this._jsStrings.filter(this.lengthFilter, this).sort();
		delete this.jsStrings;
		delete this._jsStrings;
		return this.jsStrings = ret;
	},
	lengthFilter: function(s) {
		return s.length >= this.minLength;
	},
	// Keywords database:
	_jsStatements: [
		"delete",
		"function",
		"in",
		"instanceof",
		"new",
		"typeof",
		"var",
		"void",
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
		"false",
		"null",
		"this",
		"true",
		"const",
		"get",
		"let",
		"set",
		"yield",
		"each"
	],
	_jsProps: [
		"alert",
		"arguments",
		"Array",
		"back",
		"Boolean",
		"clearInterval",
		"clearTimeout",
		"close",
		"closed",
		"confirm",
		"content",
		"Date",
		"decodeURI",
		"decodeURIComponent",
		"directories",
		"document",
		"dump",
		"encodeURI",
		"encodeURIComponent",
		"Error",
		"escape",
		"eval",
		"EvalError",
		"find",
		"forward",
		"frameElement",
		"frames",
		"Function",
		"getAttention",
		"getComputedStyle",
		"getSelection",
		"history",
		"home",
		"Infinity",
		"innerHeight",
		"innerWidth",
		"isFinite",
		"isNaN",
		"location",
		"locationbar",
		"Math",
		"menubar",
		"moveBy",
		"moveTo",
		"navigator",
		"Number",
		"Object",
		"open",
		"openDialog",
		"opener",
		"outerHeight",
		"outerWidth",
		"parent",
		"parseFloat",
		"parseInt",
		"personalbar",
		"pkcs11",
		"print",
		"prompt",
		"RangeError",
		"ReferenceError",
		"RegExp",
		"resizeBy",
		"resizeTo",
		"screen",
		"screenX",
		"screenY",
		"scroll",
		"scrollbars",
		"scrollBy",
		"scrollByLines",
		"scrollByPages",
		"scrollMaxX",
		"scrollMaxY",
		"scrollTo",
		"scrollX",
		"scrollY",
		"self",
		"setInterval",
		"setTimeout",
		"sizeToContent",
		"status",
		"statusbar",
		"stop",
		"String",
		"SyntaxError",
		"toolbar",
		"TypeError",
		"undefined",
		"unescape",
		"updateCommands",
		"URIError",
		"window",
		"XMLHttpRequest",
		"abs",
		"acos",
		"addEventListener",
		"appendChild",
		"apply",
		"asin",
		"atan",
		"atan2",
		"attributes",
		"availHeight",
		"availLeft",
		"availTop",
		"availWidth",
		"baseURI",
		"blur",
		"call",
		"callee",
		"ceil",
		"charAt",
		"charCodeAt",
		"childNodes",
		"className",
		"click",
		"clientHeight",
		"clientLeft",
		"clientTop",
		"clientWidth",
		"cloneNode",
		"colorDepth",
		"concat",
		"constructor",
		"cos",
		"createComment",
		"createElement",
		"createElementNS",
		"createTextNode",
		"defaultView",
		"dir",
		"dispatchEvent",
		"documentElement",
		"E",
		"exec",
		"exp",
		"firstChild",
		"floor",
		"focus",
		"fromCharCode",
		"getAttribute",
		"getAttributeNode",
		"getAttributeNodeNS",
		"getAttributeNS",
		"getDate",
		"getDay",
		"getElementById",
		"getElementsByName",
		"getElementsByTagName",
		"getElementsByTagNameNS",
		"getFullYear",
		"getHours",
		"getMilliseconds",
		"getMinutes",
		"getMonth",
		"getSeconds",
		"getTime",
		"getTimezoneOffset",
		"getUTCDate",
		"getUTCDay",
		"getUTCFullYear",
		"getUTCHours",
		"getUTCMilliseconds",
		"getUTCMinutes",
		"getUTCMonth",
		"getUTCSeconds",
		"global",
		"hasAttribute",
		"hasAttributeNS",
		"hasAttributes",
		"hasChildNodes",
		"hasOwnProperty",
		"height",
		"href",
		"id",
		"ignoreCase",
		"index",
		"indexOf",
		"innerHTML",
		"input",
		"insertBefore",
		"isPrototypeOf",
		"isSupported",
		"join",
		"lang",
		"lastChild",
		"lastIndex",
		"lastIndexOf",
		"left",
		"length",
		"LN10",
		"LN2",
		"localName",
		"log",
		"LOG10E",
		"LOG2E",
		"match",
		"max",
		"MAX_VALUE",
		"message",
		"min",
		"MIN_VALUE",
		"multiline",
		"name",
		"namespaceURI",
		"NaN",
		"NEGATIVE_INFINITY",
		"nextSibling",
		"nodeName",
		"nodeType",
		"nodeValue",
		"normalize",
		"offline",
		"offsetHeight",
		"offsetLeft",
		"offsetParent",
		"offsetTop",
		"offsetWidth",
		"ownerDocument",
		"parentNode",
		"parse",
		"PI",
		"pixelDepth",
		"pop",
		"POSITIVE_INFINITY",
		"pow",
		"prefix",
		"preventDefault",
		"previousSibling",
		"propertyIsEnumerable",
		"prototype",
		"push",
		"random",
		"removeAttribute",
		"removeAttributeNode",
		"removeAttributeNS",
		"removeChild",
		"removeEventListener",
		"replace",
		"replaceChild",
		"reverse",
		"round",
		"scrollHeight",
		"scrollIntoView",
		"scrollLeft",
		"scrollTop",
		"scrollWidth",
		"search",
		"setAttribute",
		"setAttributeNode",
		"setAttributeNodeNS",
		"setAttributeNS",
		"setDate",
		"setFullYear",
		"setHours",
		"setMilliseconds",
		"setMinutes",
		"setMonth",
		"setSeconds",
		"setTime",
		"setUTCDate",
		"setUTCFullYear",
		"setUTCHours",
		"setUTCMilliseconds",
		"setUTCMinutes",
		"setUTCMonth",
		"setUTCSeconds",
		"shift",
		"sin",
		"slice",
		"sort",
		"source",
		"splice",
		"split",
		"sqrt",
		"SQRT1_2",
		"SQRT2",
		"stopPropagation",
		"style",
		"substr",
		"substring",
		"tabIndex",
		"tagName",
		"tan",
		"test",
		"textContent",
		"textInput",
		"title",
		"toDateString",
		"toExponential",
		"toFixed",
		"toLocaleDateString",
		"toLocaleLowerCase",
		"toLocaleString",
		"toLocaleTimeString",
		"toLocaleUpperCase",
		"toLowerCase",
		"top",
		"toPrecision",
		"toString",
		"toTimeString",
		"toUpperCase",
		"toUTCString",
		"unshift",
		"userAgent",
		"UTC",
		"valueOf",
		"width",
		"onabort",
		"onbeforeunload",
		"onblur",
		"onchange",
		"onclick",
		"oncontextmenu",
		"ondblclick",
		"onerror",
		"onfocus",
		"onkeydown",
		"onkeypress",
		"onkeyup",
		"online",
		"onload",
		"onmousedown",
		"onmousemove",
		"onmouseout",
		"onmouseover",
		"onmouseup",
		"onpaint",
		"onreset",
		"onresize",
		"onscroll",
		"onselect",
		"onsubmit",
		"onunload",
		"onreadystatechange",
		"multipart",
		"readyState",
		"responseText",
		"responseXML",
		"statusText",
		"abort",
		"getAllResponseHeaders",
		"getResponseHeader",
		"openRequest",
		"overrideMimeType",
		"send",
		"setRequestHeader",
		"addMicrosummaryGenerator",
		"addPanel",
		"addPersistentPanel",
		"addSearchEngine",
		"applicationCache",
		"atob",
		"attachEvent",
		"baseURIObject",
		"btoa",
		"caller",
		"detachEvent",
		"dialogArguments",
		"every",
		"filter",
		"forEach",
		"getAnonymousElementByAttribute",
		"getAnonymousNodes",
		"getElementsByAttribute",
		"getElementsByAttributeNS",
		"getElementsByClassName",
		"getPrototypeOf",
		"globalStorage",
		"innerText",
		"Iterator",
		"map",
		"nodePrincipal",
		"now",
		"oncopy",
		"oncut",
		"ondragdrop",
		"onpaste",
		"postMessage",
		"querySelector",
		"querySelectorAll",
		"reduce",
		"reduceRight",
		"returnValue",
		"showModalDialog",
		"sidebar",
		"some",
		"srcElement",
		"stack",
		"toLocaleFormat",
		"toSource",
		"uneval",
		"unwatch",
		"ValueChange",
		"watch",
		"windowZLevel",
		"__count__",
		"__defineGetter__",
		"__defineSetter__",
		"__iterator__",
		"__lookupGetter__",
		"__lookupSetter__",
		"__noSuchMethod__",
		"__parent__",
		"__proto__",
		"accelerator",
		"azimuth",
		"background",
		"backgroundAttachment",
		"backgroundColor",
		"backgroundImage",
		"backgroundPosition",
		"backgroundPositionX",
		"backgroundPositionY",
		"backgroundRepeat",
		"border",
		"borderBottom",
		"borderBottomColor",
		"borderBottomStyle",
		"borderBottomWidth",
		"borderCollapse",
		"borderColor",
		"borderLeft",
		"borderLeftColor",
		"borderLeftStyle",
		"borderLeftWidth",
		"borderRight",
		"borderRightColor",
		"borderRightStyle",
		"borderRightWidth",
		"borderSpacing",
		"borderStyle",
		"borderTop",
		"borderTopColor",
		"borderTopStyle",
		"borderTopWidth",
		"borderWidth",
		"bottom",
		"captionSide",
		"clear",
		"clip",
		"color",
		"counterIncrement",
		"counterReset",
		"cue",
		"cueAfter",
		"cueBefore",
		"cursor",
		"direction",
		"display",
		"elevation",
		"emptyCells",
		"float",
		"font",
		"fontFamily",
		"fontSize",
		"fontSizeAdjust",
		"fontStretch",
		"fontStyle",
		"fontVariant",
		"fontWeight",
		"imeMode",
		"layoutFlow",
		"layoutGrid",
		"layoutGridChar",
		"layoutGridLine",
		"layoutGridMode",
		"layoutGridType",
		"letterSpacing",
		"lineBreak",
		"lineHeight",
		"listStyle",
		"listStyleImage",
		"listStylePosition",
		"listStyleType",
		"margin",
		"marginBottom",
		"marginLeft",
		"marginRight",
		"marginTop",
		"markerOffset",
		"marks",
		"maxHeight",
		"maxWidth",
		"minHeight",
		"minWidth",
		"opacity",
		"orphans",
		"outline",
		"outlineColor",
		"outlineOffset",
		"outlineStyle",
		"outlineWidth",
		"overflow",
		"overflowX",
		"overflowY",
		"padding",
		"paddingBottom",
		"paddingLeft",
		"paddingRight",
		"paddingTop",
		"page",
		"pageBreakAfter",
		"pageBreakBefore",
		"pageBreakInside",
		"pause",
		"pauseAfter",
		"pauseBefore",
		"pitch",
		"pitchRange",
		"playDuring",
		"position",
		"quotes",
		"richness",
		"right",
		"rubyAlign",
		"rubyOverhang",
		"rubyPosition",
		"scrollbar3dlightColor",
		"scrollbarArrowColor",
		"scrollbarBaseColor",
		"scrollbarDarkshadowColor",
		"scrollbarFaceColor",
		"scrollbarHighlightColor",
		"scrollbarShadowColor",
		"size",
		"speak",
		"speakHeader",
		"speakNumeral",
		"speakPunctuation",
		"speechRate",
		"stress",
		"tableLayout",
		"textAlign",
		"textAlignLast",
		"textAutospace",
		"textDecoration",
		"textIndent",
		"textJustify",
		"textKashidaSpace",
		"textShadow",
		"textTransform",
		"textUnderlinePosition",
		"unicodeBidi",
		"verticalAlign",
		"visibility",
		"voiceFamily",
		"volume",
		"whiteSpace",
		"widows",
		"wordBreak",
		"wordSpacing",
		"wordWrap",
		"writingMode",
		"zIndex",
		"popupNode",
		"tooltipNode",
		"Components",
		"classes",
		"interfaces",
		"results",
		"getService",
		"createInstance",
		"QueryInterface",
		"hasMoreElements"
	],
	_jsStrings: [
		"abort",
		"beforeunload",
		"blur",
		"change",
		"click",
		"contextmenu",
		"dblclick",
		"error",
		"focus",
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
		"paint",
		"reset",
		"resize",
		"scroll",
		"select",
		"submit",
		"unload",
		"command",
		"copy",
		"cut",
		"dragdrop",
		"paste",
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
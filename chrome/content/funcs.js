var totalClicksFuncs = {
	tc: totalClicks,
	_charset: null,
	copyItemText: function(e) { // for all
		var tc = this.tc;
		var it = tc.item;
		var txt = it.textContent || it.label;
		tc._log("copyItemText -> " + txt);
		this.copyStr(txt);
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	get popup() {
		var pSet = document.getElementById("mainPopupSet");
		var id = "totalClicks-generatedPopup";
		var popup = document.getElementById(id);
		if(popup)
			pSet.removeChild(popup);
		popup = document.createElement("popup");
		popup.id = id;
		popup.tooltip = "totalClicks-tooltip";
		pSet.appendChild(popup);
		return popup;
	},
	createPopup: function(items) {
		var popup = this.popup;
		var it, mi;
		for(var i = 0; i < items.length; i++) {
			it = items[i];
			mi = document.createElement(it.label ? "menuitem" : "menuseparator");
			for(var p in it) {
				if(!p)
					continue;
				if(typeof it[p] != "string" || p.indexOf("__") == 0)
					mi[p] = it[p]; // not works for "oncommand"
				else
					mi.setAttribute(p, it[p]);
			}
			popup.appendChild(mi);
		}
		return popup;
	},
	showGeneratedPopup: function(items) {
		var popup = this.createPopup(items);
		var node = this.tc.origItem;
		document.popupNode = node;
		var xy = this.tc.getXY(this.tc.event);
		popup.showPopup(this.tc.isFx3 ? node : getBrowser(), xy.x, xy.y, "popup", null, null);
		return popup;
	},


	///////////////////
	_test: function(e) { //~ del
		this.tc._log("_test");
		var items = [
			{ label: "Label - 0", oncommand: "alert(this.label);" },
			{},
			{ label: "Label - 1", onclick: function() { alert(this.label); } },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0" },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0", mltt_line_1: "line-1" },
		];
		this.showGeneratedPopup(items);
		// popup.setAttribute("tooltip", "totalClicks-tooltip");
	},
	///////////////////

	startProcess: function(path, args) {
		args = args || [];
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		var process = Components.classes["@mozilla.org/process/util;1"]
			.getService(Components.interfaces.nsIProcess);
		file.initWithPath(path);
		process.init(file);
		process.run(false, args, args.length);
	},
	get charset() {
		if(this._charset == null) {
			this._charset = "";
			if(this.tc.p_convertURIs)
				if(this.tc.p_convertURIsTo)
					this._charset = this.tc.p_convertURIsTo;
				else { // thanks to IE Tab!
					var strBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
						.getService(Components.interfaces.nsIStringBundleService);
					try {
						this._charset =  strBundle.createBundle("chrome://global-platform/locale/intl.properties")
							.GetStringFromName("intl.charset.default");
					}
					catch(e) {
					}
				}
		}
		return this._charset;
	},
	convertStrFromUnicode: function(str) { //~ todo: test (not needed?)
		var charset = this.charset;
		this.tc._log("convert");
		if(!charset)
			return str;
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = charset;
		this.tc._log("!!! convert");
		return suc.ConvertFromUnicode(str);
	},
	openUriWithApp: function(e, popup) {
		var mi = e.target;
		if(mi.nodeName != "menuitem")
			return;
		var args = mi.__args || [];
		args.push(popup._uri);
		this.startProcess(mi.__path, args);
	},
	getBookmarkUri:	function(it, usePlacesURIs) {
		var uri = it.statusText || (it.node && it.node.uri) || it.getAttribute("siteURI") || "";
		return !usePlacesURIs && /^place:/.test(uri) ? "" : uri;
	},
	getTabUri: function(tab) {
		return tab.linkedBrowser.contentDocument.location.href;
	},
	getUriOfCurrentItem: function() {
		var it = this.tc.item;
		var uri = null;
		switch(this.tc.itemType) {
			case "link":
				uri = it.href;
			break;
			case "img":
				uri = it.src;
			break;
			case "bookmark":
			case "historyItem":
				uri = this.getBookmarkUri(it);
			break;
			case "tab":
				uri = this.getTabUri(it);
		}
		return uri;
	},
	decodeUri: function(value) { // code by Ex Bookmark Properties ( https://addons.mozilla.org/firefox/addon/7396 )
		// return decodeURIComponent(value);
		// Try to decode as UTF-8 if there's no encoding sequence that we would break.
		if(!/%25(?:3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/i.test(value))
			try {
				value = decodeURI(value)
					// 1. decodeURI decodes %25 to %, which creates unintended
					//    encoding sequences. Re-encode it, unless it's part of
					//    a sequence that survived decodeURI, i.e. one for:
					//    ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#'
					//    (RFC 3987 section 3.2)
					// 2. Re-encode whitespace so that it doesn't get eaten away
					//    by the location bar (bug 410726).
					.replace(/%(?!3B|2F|3F|3A|40|26|3D|2B|24|2C|23)|[\r\n\t]/ig, encodeURIComponent);
			}
			catch (e) {
			}
		// Encode bidirectional formatting characters.
		// (RFC 3987 sections 3.2 and 4.1 paragraph 6)
		value = value.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, encodeURIComponent);
		return value;
	},
	showOpenUriWithAppPopup: function(items) {
		var uri = this.getUriOfCurrentItem();
		if(!uri) { //~ todo: show pop-up massage
			return;
		}
		var it, n, args;
		for(var i = 0; i < items.length; i++) {
			it = items[i], n = 0;
			it.class = "menuitem-iconic";
			it.image = "moz-icon:file://" + it.__path;
			it["mltt_line_" + n++] = it.__path;
			if(it.__args instanceof Array) {
				args = it.__args;
				for(var j = 0; j < args.length; j++)
					it["mltt_line_" + n++] = args[j];
			}
			it["mltt_line_" + n++] = this.decodeUri(uri);
		}
		var popup = this.showGeneratedPopup(items);
		popup.setAttribute("oncommand", "totalClicksFuncs.openUriWithApp(event, this);");
		popup._uri = this.convertStrFromUnicode(uri);
	},

	///////////////////
	_test_showOpenUriWithAppPopup: function(e) { //~ del
		var items = [
			{ label: "Opera 9.5x", __path: "c:\\Program Files\\Opera 9.5\\opera.exe" },
			{ label: "IE 7.0", __path: "c:\\Program Files\\Internet Explorer\\iexplore.exe" },
			{},
			{ label: "Firefox 2.0.0.x - test", __path: "c:\\Program Files\\Mozilla Firefox 2.0.0.x\\firefox.exe", __args: ["-no-remote", "-p", "fx2.0"] },
		];
		this.showOpenUriWithAppPopup(items);
	},
	///////////////////

	fillInTooltip: function(tooltip) {
		var tNode = document.tooltipNode;
		var attrName = "mltt_line_0";
		var i = 0, lbl;
		while(tNode.hasAttribute(attrName)) {
			lbl = tooltip["_" + attrName];
			if(!lbl) {
				lbl = document.createElement("label");
				tooltip.appendChild(lbl);
				tooltip["_" + attrName] = lbl;
			}
			lbl.setAttribute("value", tNode.getAttribute(attrName));
			lbl.hidden = false;
			attrName = "mltt_line_" + ++i;
		}
		return tNode.hasAttribute("mltt_line_0");
	},
	hideAllChilds: function(tooltip) {
		var chs = tooltip.childNodes;
		for(var i = 0, len = chs.length; i < len; i++)
			chs[i].hidden = true;
	}
};
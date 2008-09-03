var handyClicksFuncs = {
	hc: handyClicks,
	_defaultCharset: null,
	copyItemText: function(e) { // for all
		var hc = this.hc;
		var it = hc.item;
		var txt = it.textContent || it.label || it.alt || it.value || "";
		hc._log("copyItemText -> " + txt);
		this.copyStr(txt);
		this.hc.blinkNode();
	},
	copyItemLink: function(e) {
		var uri = this.getUriOfCurrentItem() || "";
		this.copyStr(uri);
		this.hc.blinkNode();
	},
	copyStr: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	blinkNode: function(time, node) {
		node = node || this.hc.origItem;
		if(!node)
			return;
		var hasStl = node.hasAttribute("style");
		var origVis = node.style.visibility;
		node.style.visibility = "hidden";
		setTimeout(
			function() {
				node.style.visibility = origVis;
				if(!hasStl)
					node.removeAttribute("style");
			},
			time || 170
		);
	},
	getPopup: function(xml) {
		var pSet = document.getElementById("mainPopupSet");
		var id = "handyClicks-generatedPopup";
		var popup = document.getElementById(id);
		if(popup)
			pSet.removeChild(popup);
		popup = xml
			? new DOMParser().parseFromString(xml.toXMLString(), "application/xml").documentElement
			: document.createElement("popup");
		if(xml) {
			// Bug: labels of <menu> does not shown.
			this.hc._log("fixMenuLabels");
		}
		popup.id = id;
		popup.tooltip = "handyClicks-tooltip";
		pSet.appendChild(popup);
		return popup;
	},
	createPopup: function(items) {
		var popup = this.getPopup();
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
		this.hc.showPopupOnCurrentItem(popup);
		return popup;
	},
	showGeneratedFromXMLPopup: function(xml) {
		var popup = this.getPopup(xml);
		this.hc.showPopupOnCurrentItem(popup);
		return popup;
	},


	///////////////////
	_test: function(e) { //~ del
		this.hc._log("_test");
		var items = [
			{ label: "Label - 0", oncommand: "alert(this.label);" },
			{},
			{ label: "Label - 1", onclick: function() { alert(this.label); } },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0" },
			{ label: "Label - 2", oncommand: "alert(this.label);", mltt_line_0: "line-0", mltt_line_1: "line-1" },
		];
		this.showGeneratedPopup(items);
	},
	_xml_test: function(e) {
		var xml = <popup xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			oncommand="alert(event.target.label)">
				<menuitem label="Restart" />
				<menuitem label="Enlarge" />
				<menuitem label="Reduce" />
				<menuseparator />
				<menu label="XXXXXXXXXXXXx">
					<menupopup>
						<menuitem label="Submenu - 1" />
						<menuitem label="Submenu - 2" />
					</menupopup>
				</menu>
			</popup>;
		this.showGeneratedFromXMLPopup(xml);
	},
	///////////////////

	startProcess: function(path, args) {
		args = args || [];
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		if(!file.exists()) {
			alert(path + "\nnot found!"); //~todo: promptsService
			return;
		}
		var process = Components.classes["@mozilla.org/process/util;1"]
			.getService(Components.interfaces.nsIProcess);
		process.init(file);
		process.run(false, args, args.length);
	},
	get defaultCharset() { // thanks to IE Tab!
		if(this._defaultCharset == null) {
			var strBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
				.getService(Components.interfaces.nsIStringBundleService);
			try {
				this._defaultCharset = strBundle.createBundle("chrome://global-platform/locale/intl.properties")
					.GetStringFromName("intl.charset.default");
			}
			catch(e) {
				this._defaultCharset = "";
			}
		}
		return this._defaultCharset;
	},
	get charset() {
		return this.hc.getPref("convertURIs")
			? this.hc.getPref("convertURIsTo")
				? this.hc.getPref("convertURIsTo")
				: this.defaultCharset
			: "";
	},
	convertStrToUnicode: function(str) {

	},
	convertStrFromUnicode: function(str) {
		var charset = this.charset;
		if(!charset)
			return str;
		var suc = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		suc.charset = charset;
		try {
			str = decodeURIComponent(str); // to UTF-8
		}
		catch(e) { // does not work in fx 1.5
			str = suc.ConvertToUnicode(unescape(str)); // Thanks to IE Tab!
			str = decodeURI(str);
		}
		return suc.ConvertFromUnicode(str);
	},
	openUriWithApp: function(e, popup) {
		var mi = e.target;
		if(mi.nodeName != "menuitem")
			return;
		var args = mi.__args || [];
		args.push(popup.__uri);
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
		var it = this.hc.item;
		var uri = null;
		switch(this.hc.itemType) {
			case "link":
				uri = it.href;
			break;
			case "img":
				this.hc._log("getUriOfCurrentItem -> img -> !it.src && it.hasAttribute(\"src\") -> " + (!it.src && it.hasAttribute("src")));
				uri = it.src || it.getAttribute("src");
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
	showOpenUriWithAppsPopup: function(items) {
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
		popup.setAttribute("oncommand", "handyClicksFuncs.openUriWithApp(event, this);");
		popup.__uri = this.convertStrFromUnicode(uri);
	},

	///////////////////
	_test_showOpenUriWithAppsPopup: function(e) { //~ del
		var items = [
			{ label: "Opera 9.5x", __path: "c:\\Program Files\\Opera 9.5\\opera.exe" },
			{ label: "IE 7.0", __path: "c:\\Program Files\\Internet Explorer\\iexplore.exe" },
			{},
			{ label: "Firefox 2.0.0.x - test", __path: "c:\\Program Files\\Mozilla Firefox 2.0.0.x\\firefox.exe", __args: ["-no-remote", "-p", "fx2.0"] },
		];
		this.showOpenUriWithAppsPopup(items);
	},
	///////////////////

	setPrefs: function(prefsObj) {
		var origs = {};
		for(var p in prefsObj) {
			origs[p] = navigator.preference(p);
			navigator.preference(p, prefsObj[p]);
		}
		return origs;
	},
	restorePrefs: function(prefsObj) {
		for(var p in prefsObj)
			navigator.preference(p, prefsObj[p]);
	},

	submitFormToNewDoc: function(e, toNewWin, node) { // Thanks to SubmitToTab! //~ todo: add URL
		node = node || this.hc.item;
		node = new XPCNativeWrapper(node, "form", "click()");
		var origTarget = node.form.getAttribute("target");
		node.form.target = "_blank";

		var origPrefs = this.setPrefs(
			toNewWin
				? {
					"browser.link.open_newwindow": 2,
					"browser.block.target_new_window": false,
					"dom.disable_open_during_load": false
				}
				: {
					"browser.link.open_newwindow": 3,
					"browser.tabs.loadDivertedInBackground": true,
					"dom.disable_open_during_load": false
				}
		);
		node.click();

		if(origTarget)
			node.form.target = origTarget;
		else
			node.form.removeAttribute("target");
		node.form.target = origTarget ? origTarget : "_self"; //~ todo: removeAttribute ?
		this.restorePrefs(origPrefs);
	},

	fillInTooltip: function(tooltip) {
		var tNode = document.tooltipNode;
		var attrName = "mltt_line_0";
		var i = 0, lbl;
		while(tNode.hasAttribute(attrName)) {
			lbl = tooltip["_" + attrName];
			if(!lbl) {
				lbl = document.createElement("label");
				lbl.setAttribute("crop", "center");
				tooltip.firstChild.appendChild(lbl);
				tooltip["_" + attrName] = lbl;
			}
			lbl.setAttribute("value", tNode.getAttribute(attrName));
			lbl.hidden = false;
			attrName = "mltt_line_" + ++i;
		}
		return tNode.hasAttribute("mltt_line_0");
	},
	hideAllLabels: function(tooltip) {
		var chs = tooltip.firstChild.childNodes;
		for(var i = 0, len = chs.length; i < len; i++)
			chs[i].hidden = true;
	}
};
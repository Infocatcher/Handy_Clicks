var handyClicksJsUtils = {
	__proto__: handyClicksGlobals,

	isArray: function(arr) {
		var f = this.isArray = this.hasNativeMethod(Array, "isArray")
			? Array.isArray
			: function(arr) {
				return arr instanceof Array
					|| Object.prototype.toString.call(arr) == "[object Array]";
			};
		return f.apply(this, arguments);
	},
	isObject: function(o) {
		return typeof o == "object" && o !== null;
	},
	isEmptyObj: function(o) {
		// obj.__count__ is deprecated and removed in Firefox 4.0
		// Object.keys(o).length
		for(var p in o) if(Object.hasOwnProperty.call(o, p))
			return false;
		return true;
	},
	isPrimitive: function(v) {
		if(v === null || v === undefined)
			return true;
		var t = typeof v;
		return t == "string" || t == "number" || t == "boolean";
	},

	getOwnProperty: function(obj) { // this.getOwnProperty(obj, "a", "b", "propName") instead of obj.a.b.propName
		var u;
		if(this.isPrimitive(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; ++i) {
			p = a[i];
			if(!Object.hasOwnProperty.call(obj, p))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(this.isPrimitive(obj))
				return u;
		}
		return u;
	},
	getProperty: function(obj) {
		var u;
		if(this.isPrimitive(obj))
			return u;
		var a = arguments, p;
		for(var i = 1, len = a.length - 1; i <= len; ++i) {
			p = a[i];
			if(!(p in obj))
				return u;
			obj = obj[p];
			if(i == len)
				return obj;
			if(this.isPrimitive(obj))
				return u;
		}
		return u;
	},
	setOwnProperty: function(obj) { // obj, "x", "y", value
		var a = arguments, p;
		for(var i = 1, len = a.length - 2; i <= len; ++i) {
			p = a[i];
			if(!Object.hasOwnProperty.call(obj, p) || !this.isObject(obj[p]))
				obj[p] = {};
			if(i != len)
				obj = obj[p];
		}
		obj[p] = a[len + 1];
	},

	startsWith: function(str, prefix) {
		var f = this.startsWith = "startsWith" in String.prototype
			? String.prototype.startsWith.call.bind(String.prototype.startsWith)
			: function(str, prefix) {
				return str.substr(0, prefix.length) == prefix;
			};
		return f.apply(this, arguments);
	},
	removePrefix: function(str, prefix, forced) {
		if(forced || this.startsWith(str, prefix))
			return str.substr(prefix.length);
		return str;
	},
	endsWith: function(str, postfix) {
		var f = this.endsWith = "endsWith" in String.prototype
			? String.prototype.endsWith.call.bind(String.prototype.endsWith)
			: function(str, postfix) {
				return str.substr(-postfix.length) == postfix;
			};
		return f.apply(this, arguments);
	},
	removePostfix: function(str, postfix, forced) {
		if(forced || this.endsWith(str, postfix))
			return str.substr(0, str.length - postfix.length);
		return str;
	},

	isNativeFunction: function(func) {
		// Example: function alert() {[native code]}
		return /\[native code\]\s*\}$/.test(Function.toString.call(func));
	},
	hasNativeMethod: function(obj, methName) {
		return methName in obj && typeof obj[methName] == "function" && this.isNativeFunction(obj[methName]);
	}
};
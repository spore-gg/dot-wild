"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.containWildcardToken = exports.buildPath = exports.escapePath = exports.matchPath = exports.map = exports.forEach = exports.expand = exports.flatten = exports.has = exports.remove = exports.set = exports.get = exports.tokenize = void 0;
/**
 * Utilities
 */
var isObj = require('is-plain-object');
var isArray = function (val) { return Array.isArray(val); };
var isString = function (val) { return typeof val === 'string'; };
var isInteger = function (val) { return Number(val) == val && Number(val) % 1 === 0; }; // tslint:disable-line triple-equals
var isNumeric = function (val) { return !isArray(val) && (val - parseFloat(val) + 1) >= 0; };
var isData = function (data) { return isObj(data) || isArray(data); };
var isArrayKey = function (key) { return isInteger(key) && parseInt(key) >= 0; };
var hasProp = function (obj, key) { return obj && obj.hasOwnProperty(key); };
var objKeys = Object.keys;
var isEmpty = function (obj) {
    if (isArray(obj))
        return obj.length === 0;
    if (isObj(obj))
        return objKeys(obj).length === 0;
    if (isNumeric(obj))
        return parseFloat(obj) === 0;
    return !obj;
};
var regex = {
    dot: /^\./,
    prop: /[^[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
    escape: /\\(\\)?/g,
};
var each = function (obj, iteratee) {
    if (!obj)
        return;
    if (isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            if (iteratee(obj[i], i, obj) === false)
                break;
        }
    }
    else if (isObj(obj)) {
        var keys = objKeys(obj);
        for (var i = 0; i < keys.length; i++) {
            if (iteratee(obj[keys[i]], keys[i], obj) === false)
                break;
        }
    }
};
var merge = function (obj, source) {
    each(source, function (value, key) {
        if (hasProp(obj, key) && isData(obj)) {
            merge(obj[key], value);
        }
        else {
            obj[key] = value;
        }
    });
    return obj;
};
var splitTokens = function (input) {
    var tokens = ("" + input).split('.');
    var results = [];
    var store = [];
    tokens.forEach(function (token) {
        if (/^.*\\$/.test(token)) {
            store.push(token.slice(0, token.length - 1));
        }
        else if (store.length > 0) {
            results = __spreadArrays(results, [store.join('.') + "." + token]);
            store = [];
        }
        else {
            results.push(token);
        }
    });
    return results;
};
var matchToken = function (key, token) {
    if (token === '*')
        return true;
    return isInteger(token) ? key == token : key === token; // tslint:disable-line triple-equals
};
var hasToken = function (path) { return (path.indexOf('.') > -1 || path.indexOf('[') > -1); };
/**
 * Tokenize path string
 */
exports.tokenize = function (str) {
    var results = [];
    splitTokens(str).forEach(function (token) {
        token.replace(regex.prop, function (m, n, q, s) {
            results.push(q ? s.replace(regex.escape, '$1') : (n || m));
        });
    });
    return results;
};
var defaultGetOptions = {
    iterateObject: true,
    iterateArray: true,
};
var internalGet = function (data, path, value, options) {
    var _a;
    var opts = __assign(__assign({}, defaultGetOptions), (options || {}));
    if (!path || !isString(path)) {
        return {
            exist: false,
            wildcard: false,
            values: [[value, data, []]],
        };
    }
    var key = '__get_item__';
    var tokens = exports.tokenize(path);
    var length = tokens.length;
    var state = {
        index: 0,
        context: (_a = {}, _a[key] = [[data, data, []]], _a),
        wildcard: false,
    };
    tokens.forEach(function (token) {
        var _a;
        var next = [];
        each(state.context[key], function (_a) {
            var item = _a[0], _ = _a[1], p = _a[2];
            each(item, function (v, k) {
                if (!matchToken(k, token))
                    return;
                if (token !== '*') {
                    next.push([v, item, __spreadArrays(p, [k])]);
                }
                else {
                    if (!opts.iterateObject && isObj(item))
                        return;
                    if (!opts.iterateArray && isArray(item))
                        return;
                    state.wildcard = true;
                    next.push([v, item, __spreadArrays(p, [k])]);
                }
            });
        });
        if (next.length > 0) {
            state.context = (_a = {}, _a[key] = next, _a);
            state.index++;
        }
    });
    if (state.index !== length) {
        return {
            exist: false,
            wildcard: state.wildcard,
            values: [[value, null, []]],
        };
    }
    return {
        exist: true,
        wildcard: state.wildcard,
        values: state.context[key],
    };
};
exports.get = function (data, path, value, options) {
    if (value === void 0) { value = undefined; }
    var _a = internalGet(data, path, value, options), exist = _a.exist, wildcard = _a.wildcard, values = _a.values;
    if (!exist)
        return values[0][0];
    if (wildcard)
        return values.map(function (v) { return v[0]; });
    return values[0][0] === undefined ? value : values[0][0];
};
/**
 * Setter
 */
exports.set = function (data, path, value) {
    if (!path || !isString(path))
        return data;
    // NOTE: this is not a deep clone, so there might be side-effects
    // deep clone ends up wiping out File() objects (converts them to normal objects)
    var _data = __assign({}, data);
    if (!hasToken(path)) {
        _data[path] = value;
        return _data;
    }
    var tokens = exports.tokenize(path);
    if (tokens.indexOf('*') < 0) {
        var res = _data;
        each(tokens, function (token, i) {
            if (!isObj(_data[token]) && !isArray(_data[token])) {
                if (i < tokens.length - 1 && isArrayKey(tokens[i + 1])) {
                    _data[token] = [];
                }
                else {
                    _data[token] = {};
                }
            }
            if (i === tokens.length - 1) {
                _data[token] = value;
            }
            _data = _data[token];
        });
        return res;
    }
    else {
        var token_1 = tokens.shift();
        var nextPath_1 = tokens.map(function (v) { return v.replace('.', '\\.'); }).join('.');
        if (token_1 === undefined)
            return _data;
        each(_data, function (v, k) {
            if (matchToken(k, token_1)) {
                _data[k] = nextPath_1 ? exports.set(v, nextPath_1, value) : merge(v, value);
            }
        });
    }
    return _data;
};
/**
 * Deleter
 */
var arrayRemove = function (array, index) { return (array.slice(0, index).concat(array.slice(index + 1))); };
var simpleRemove = function (data, path) {
    if (isArray(data) && isArrayKey(path)) {
        data = arrayRemove(data, parseInt(path, 10));
    }
    else {
        delete data[path];
    }
    return data;
};
exports.remove = function (data, path) {
    if (!path || !isString(path)) {
        return data;
    }
    // NOTE: this is not a deep clone, so there might be side-effects
    // deep clone ends up wiping out File() objects (converts them to normal objects)
    var _data = __assign({}, data);
    if (!hasToken(path) && path !== '*') {
        return simpleRemove(_data, path);
    }
    var tokens = exports.tokenize(path);
    if (tokens.indexOf('*') < 0) {
        var result = _data;
        each(tokens, function (token, i) {
            if (i === tokens.length - 1) {
                if (isArray(_data)) {
                    _data.splice(parseInt(token, 10), 1);
                }
                else {
                    delete _data[token];
                }
                return false;
            }
            else {
                _data = _data[token];
                return isObj(_data) || isArray(_data);
            }
        });
        return result;
    }
    var first = tokens.shift();
    var later = tokens.join('.');
    var isDataArray = isArray(_data);
    var count = 0;
    if (first === undefined) {
        return _data;
    }
    each(_data, function (v, k) {
        if (!matchToken(k, first)) {
            return;
        }
        if ((!isObj(v) && !isArray(v)) || !later) {
            if (!later) {
                if (isDataArray) {
                    _data = arrayRemove(_data, parseInt(k, 10) - count);
                    count += isDataArray ? 1 : 0;
                }
                else {
                    delete _data[k];
                }
            }
            return;
        }
        _data[k] = exports.remove(v, later);
    });
    return _data;
};
/**
 * Check value
 */
exports.has = function (data, path) {
    var _a;
    if (!path || !isString(path))
        return false;
    var key = '__has__item';
    var tokens = exports.tokenize(path);
    var context = (_a = {}, _a[key] = [data], _a);
    var result = true;
    each(tokens, function (token) {
        var _a;
        var next = [];
        each(context[key], function (item) {
            each(item, function (v, k) {
                if (matchToken(k, token)) {
                    next.push(v);
                }
            });
        });
        if (next.length === 0) {
            result = false;
            return false;
        }
        else {
            context = (_a = {}, _a[key] = next, _a);
        }
        return true;
    });
    return result;
};
/**
 * Flatten values
 */
var internalFlatten = function (data, currentPath) {
    if (currentPath === void 0) { currentPath = null; }
    var results = {};
    if (isEmpty(data))
        return results;
    if (isArray(data) && data.length === 0) {
        var path = currentPath == null ? 0 : currentPath;
        results[path] = data;
        return results;
    }
    each(data, function (val, key) {
        var k = ("" + key).split('.').join('\\.');
        var p = currentPath == null ? k : currentPath + "." + k;
        if (isArray(val) || isObj(val)) {
            var children = internalFlatten(val, p);
            if (objKeys(children).length > 0) {
                results = merge(results, children);
            }
        }
        else {
            results[p] = val;
        }
    });
    return results;
};
exports.flatten = function (data) { return internalFlatten(data); };
/**
 * Expand vaules
 */
exports.expand = function (data) {
    var results = {};
    each(data, function (value, flat) {
        var keys = exports.tokenize(flat).reverse();
        var key = keys.shift();
        var child = isArrayKey(key) ? [] : {};
        child[key] = value;
        each(keys, function (k) {
            var _a;
            if (isArrayKey(k)) {
                var newChild = [];
                newChild[k] = child;
                child = newChild;
            }
            else {
                child = (_a = {}, _a[k] = child, _a);
            }
        });
        if (isArrayKey(keys[keys.length - 1]) && isEmpty(results)) {
            results = [];
        }
        results = merge(results, child);
    });
    return results;
};
/**
 * Executes a provided function once for each element.
 */
exports.forEach = function (data, path, iteratee, options) {
    var _a = internalGet(data, path, null, options), exist = _a.exist, values = _a.values;
    if (!exist)
        return;
    each(values, function (_a) {
        var v = _a[0], c = _a[1], p = _a[2];
        return iteratee(v, p[p.length - 1], c, p.join('.'), data);
    });
};
/**
 * Create a new element
 * with the results of calling a provided function on every element.
 */
exports.map = function (data, path, iteratee, options) {
    var _a = internalGet(data, path, null, options), exist = _a.exist, values = _a.values;
    if (!exist)
        return [];
    return values.map(function (_a) {
        var v = _a[0], c = _a[1], p = _a[2];
        return iteratee(v, p[p.length - 1], c, p.join('.'), data);
    });
};
/**
 * Match key
 */
exports.matchPath = function (pathA, pathB) {
    if (!isString(pathA) || !isString(pathB))
        return false;
    if (pathA === pathB)
        return true;
    var a = exports.tokenize(pathA);
    var b = exports.tokenize(pathB);
    return a.length !== b.length ? false : a.every(function (t, i) {
        return matchToken(t, b[i]) || matchToken(b[i], t);
    });
};
/**
 * Escape path string
 */
exports.escapePath = function (path) { return (!isString(path) ? '' : exports.tokenize(path).map(function (p) {
    return p.split('.').join('\\.');
}).join('\\.')); };
/**
 * Build path from Tokens like array
 */
exports.buildPath = function (tokens) { return (tokens.map(function (token) { return exports.escapePath("" + token); }).join('.')); };
/**
 * Check contains of wildcard syntax
 */
exports.containWildcardToken = function (path) { return (!isString(path) ? false : exports.tokenize(path).indexOf('*') > -1); };

/**
 * @copyright 2016 (c) commenthol
 * @license ISC
 */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _ = {
  merge: require('lodash.merge'),
  omit: require('lodash.omit'),
  set: require('lodash.set')
};

var _require = require('./internal/utils'),
    toYear = _require.toYear,
    toDate = _require.toDate;

var Data = require('./Data');
var DateFn = require('./DateFn');

var TYPES = ['public', 'bank', 'school', 'optional', 'observance'];

/**
 * @class
 * @param {Object} data - holiday data object - see data/holidays.json
 * @param {String|Object} country - if object use `{ country: {String}, state: {String}, region: {String} }`
 * @param {String} [state] - specifies state
 * @param {String} [region] - specifies region
 * @param {Object} [opts] - options
 * @param {Array|String} opts.languages - set language(s) with ISO 639-1 shortcodes
 * @param {String} opts.timezone - set timezone
 * @param {Array} opts.types - holiday types to consider
 * @example
 * ```js
 * new Holiday(data, 'US', 'la', 'no') // is the same as
 * new Holiday(data, 'us.la.no')       // is the same as
 * new Holiday(data, { country: 'us', state: 'la', region: 'no'})
 * ```
 */
function Holidays(data, country, state, region, opts) {
  if (!(this instanceof Holidays)) {
    return new Holidays(data, country, state, region, opts);
  }
  if (!data) {
    throw new TypeError('need holiday data');
  }
  this._data = data;
  this.init(country, state, region, opts);
}
module.exports = Holidays;

Holidays.prototype = {
  /**
   * initialize holidays for a country/state/region
   * @param {String|Object} country - if object use `{ country: {String}, state: {String}, region: {String} }`
   * @param {String} [state] - specifies state
   * @param {String} [region] - specifies region
   * @param {Object} [opts] - options
   * @param {Array|String} [opts.languages] - set language(s) with ISO 639-1 shortcodes
   * @param {String} [opts.timezone] - set timezone
   * @param {Array} [opts.types] - holiday types to consider
   */
  init: function init() {
    var _this = this;

    var _getArgs = getArgs.apply(undefined, arguments),
        _getArgs2 = _slicedToArray(_getArgs, 4),
        country = _getArgs2[0],
        state = _getArgs2[1],
        region = _getArgs2[2],
        opts = _getArgs2[3];

    // reset settings


    this.__conf = null;
    this.holidays = {};
    this.setLanguages();
    this._setTypes(opts.types);

    this.__conf = Data.splitName(country, state, region);
    this.__data = new Data(opts.data || this._data, this.__conf);

    if (opts.languages) {
      this.setLanguages(opts.languages);
    } else {
      this.setLanguages(this.__data.getLanguages());
    }

    var holidays = this.__data.getRules();
    if (holidays) {
      this.__timezone = opts.timezone || this.__data.getTimezones()[0];
      Object.keys(holidays).forEach(function (rule) {
        _this.setHoliday(rule, holidays[rule]);
      });
      return true;
    }
  },


  /**
   * set (custom) holiday
   * @param {String} rule - rule for holiday (check supported grammar) or date in ISO Format, e.g. 12-31 for 31th Dec
   * @param {Object|String} [opts] - holiday options, if String then opts is used as name
   * @param {Object} opts.name - translated holiday names e.g. `{ en: 'name', es: 'nombre', ... }`
   * @param {String} opts.type - holiday type `public|bank|school|observance`
   * @throws {TypeError}
   * @return {Boolean} if holiday could be set returns `true`
   */
  setHoliday: function setHoliday(rule, opts) {
    // remove days
    if (opts === false) {
      if (this.holidays[rule]) {
        this.holidays[rule] = false;
        return true;
      }
      return false;
    }

    // assign a name to rule
    if (!opts || typeof opts === 'string') {
      opts = opts || rule;
      var lang = this.getLanguages()[0];
      opts = _.set({ type: 'public' }, ['name', lang], opts);
    }

    // convert active properties to Date
    if (opts.active) {
      if (!Array.isArray(opts.active)) {
        throw TypeError('.active is not of type Array: ' + rule);
      }
      opts.active = opts.active.map(function (a) {
        var from = toDate(a.from);
        var to = toDate(a.to);
        if (!(from || to)) {
          throw TypeError('.active needs .from or .to property: ' + rule);
        }
        return { from: from, to: to };
      });
    }

    // check for supported type
    if (!this._hasType(opts.type)) {
      return false;
    }

    this.holidays[rule] = opts;

    var fn = new DateFn(rule, this.holidays);
    if (fn.ok) {
      this.holidays[rule].fn = fn;
      return true;
    } else {
      // throw Error('could not parse rule: ' + rule) // NEXT
      console.log('could not parse rule: ' + rule); // eslint-disable-line
    }
    return false;
  },


  /**
   * get all holidays for `year` with names using prefered `language`
   * @param {String|Date} [year] - if omitted current year is choosen
   * @param {String} [language] - ISO 639-1 code for language
   * @return {Array} of found holidays in given year sorted by Date:
   * ```
   * {String} date - ISO Date String of (start)-date in local format
   * {Date} start - start date of holiday
   * {Date} end - end date of holiday
   * {String} name - name of holiday using `language` (if available)
   * {String} type - type of holiday `public|bank|school|observance`
   * ```
   */
  getHolidays: function getHolidays(year, language) {
    var _this2 = this;

    year = toYear(year);

    var arr = [];
    var langs = this.getLanguages();
    if (language) {
      langs.unshift(language);
    }

    Object.keys(this.holidays).forEach(function (rule) {
      if (_this2.holidays[rule].fn) {
        _this2._dateByRule(year, rule).forEach(function (o) {
          arr.push(_this2._translate(o, langs));
        });
      }
    });

    // sort by date
    arr = arr.sort(function (a, b) {
      return +a.start - +b.start;
    }).map(function (a, i) {
      var b = arr[i + 1];
      if (b && a.name === b.name && +a.start === +b.start) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = TYPES[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var type = _step.value;

            if (type === a.type || type === b.type) {
              a.filter = true;
              b.type = type;
              break;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
      return a;
    }).filter(function (a) {
      if (!a.filter) return a;
    });

    return arr;
  },


  /**
   * check whether `date` is a holiday or not
   * @param {Date} [date]
   * @return {Object} holiday:
   * ```
   * {String} date - ISO Date String of (start)-date in local format
   * {Date} start - start date of holiday
   * {Date} end - end date of holiday
   * {String} name - name of holiday using `language` (if available)
   * {String} type - type of holiday `public|bank|school|observance`
   * ```
   */
  isHoliday: function isHoliday(date) {
    date = date || new Date();
    var year = toYear(date);
    var rules = Object.keys(this.holidays);
    for (var i in rules) {
      var hd = [].concat(this._dateByRule(year, rules[i]));
      for (var j in hd) {
        if (hd[j] && date >= hd[j].start && date < hd[j].end) {
          return this._translate(hd[j]);
        }
      }
    }
    return false;
  },


  /**
   * Query for available Countries, States, Regions
   * @param {String} [country]
   * @param {String} [state]
   * @param {String} [lang] - ISO-639 language shortcode
   * @return {Object} shortcode, name pairs of supported countries, states, regions
   */
  query: function query(country, state, lang) {
    var o = Data.splitName(country, state);
    if (!o || !o.country) {
      return this.getCountries(lang);
    } else if (!o.state) {
      return this.getStates(o.country, lang);
    } else {
      return this.getRegions(o.country, o.state, lang);
    }
  },


  /**
   * get supported countries
   * @param {String} [lang] - ISO-639 language shortcode
   * @return {Object} shortcode, name pairs of supported countries
   * ```js
   * { AD: 'Andorra',
   *   US: 'United States' }
   * ```
   */
  getCountries: function getCountries(lang) {
    return this.__data.getCountries(lang);
  },


  /**
   * get supported states for a given country
   * @param {String} country - shortcode of country
   * @param {String} [lang] - ISO-639 language shortcode
   * @return {Object} shortcode, name pairs of supported states, regions
   * ```js
   * { al: 'Alabama', ...
   *   wy: 'Wyoming' }
   * ```
   */
  getStates: function getStates(country, lang) {
    return this.__data.getStates(country, lang);
  },


  /**
   * get supported regions for a given country, state
   * @param {String} country - shortcode of country
   * @param {String} state - shortcode of state
   * @param {String} [lang] - ISO-639 language shortcode
   * @return {Object} shortcode, name pairs of supported regions
   * ```js
   * { no: 'New Orleans' }
   * ```
   */
  getRegions: function getRegions(country, state, lang) {
    return this.__data.getRegions(country, state, lang);
  },


  /**
   * get timezones for country, state, region
   * @return {Array} of {String}s containing the timezones
   */
  getTimezones: function getTimezones() {
    if (this.__data) {
      return this.__data.getTimezones();
    }
  },


  /**
   * sets timezone
   * @param {String} timezone - see `moment-timezone`
   * if `timezone` is `undefined` then all dates are considered local dates
   */
  setTimezone: function setTimezone(timezone) {
    this.__timezone = timezone;
  },


  /**
   * get languages for selected country, state, region
   * @return {Array} containing ISO 639-1 language shortcodes
   */
  getLanguages: function getLanguages() {
    return this.__languages;
  },


  /**
   * set language(s) for holiday names
   * @param {Array|String} language
   * @return {Array} set languages
   */
  setLanguages: function setLanguages(language) {
    if (typeof language === 'string') {
      language = [language];
    }
    var tmp = {};
    this.__languages = [].concat(language, 'en', this.__conf ? this.__data.getLanguages() : []).filter(function (l) {
      // filter out duplicates
      if (!l || tmp[l]) {
        return false;
      }
      tmp[l] = 1;
      return true;
    });
  },


  /**
   * get default day off as weekday
   * @return {String} weekday of day off
   */
  getDayOff: function getDayOff() {
    if (this.__conf) {
      return this.__data.getDayOff();
    }
  },


  /**
   * @private
   * @param {Number} year
   * @param {String} rule
   */
  _dateByRule: function _dateByRule(year, rule) {
    var _rule = this.holidays[rule];
    var dates = _rule.fn.inYear(year).get(this.__timezone).map(function (date) {
      var odate = _.merge({}, _.omit(date, ['substitute']), _.omit(_rule, ['fn', 'enable', 'disable', 'substitute', 'active']));
      if (_rule.substitute && date.substitute) {
        odate.substitute = true;
      }
      return odate;
    });

    return dates;
  },


  /**
   * translate holiday object `o` to a language
   * @private
   * @param {Object} o
   * @param {Array} langs - languages for translation
   * @return {Object} translated holiday object
   */
  _translate: function _translate(o, langs) {
    if (o && _typeof(o.name) === 'object') {
      langs = langs || this.getLanguages();
      for (var i in langs) {
        var name = o.name[langs[i]];
        if (name) {
          o.name = name;
          break;
        }
      }
      if (o.substitute) {
        for (var _i in langs) {
          var subst = this.__data.getSubstitueNames();
          var _name = subst[langs[_i]];
          if (_name) {
            o.name += ' (' + _name + ')';
            break;
          }
        }
      }
    }
    return o;
  },


  /**
   * set holiday types
   * @private
   * @param {Array} [t] - holiday types
   * @return {Object} new array of types
   */
  _setTypes: function _setTypes(t) {
    t = t || [];
    var types = {};
    TYPES.map(function (type) {
      for (var i in t) {
        if (type !== t[i]) {
          return;
        }
      }
      types[type] = 1;
    });
    this.__types = types;
  },


  /**
   * check for supported holiday type
   * @private
   * @param {String} type
   * @return {Boolean}
   */
  _hasType: function _hasType(type) {
    return !!this.__types[type];
  }
};

function getArgs(country, state, region, opts) {
  if ((typeof region === 'undefined' ? 'undefined' : _typeof(region)) === 'object') {
    opts = region;
    region = null;
  } else if ((typeof state === 'undefined' ? 'undefined' : _typeof(state)) === 'object') {
    opts = state;
    state = null;
  } else if ((typeof country === 'undefined' ? 'undefined' : _typeof(country)) === 'object') {
    opts = country;
    country = null;
  }
  opts = opts || {};
  return [country, state, region, opts];
}
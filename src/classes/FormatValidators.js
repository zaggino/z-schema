
    /*
     * these functions are used to validate formats
     * method registerFormat is available for adding new formats
     */
    /*jshint maxlen: false*/
    var FormatValidators = {
        'date': function (date) {
            if (!Utils.isString(date)) {
                return true;
            }
            // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
            var matches = Utils.getRegExp('^([0-9]{4})-([0-9]{2})-([0-9]{2})$').exec(date);
            if (matches === null) {
                return false;
            }
            // var year = matches[1];
            var month = matches[2];
            var day = matches[3];
            if (month < '01' || month > '12' || day < '01' || day > '31') {
                return false;
            }
            return true;
        },
        'date-time': function (dateTime) {
            if (!Utils.isString(dateTime)) {
                return true;
            }
            // date-time from http://tools.ietf.org/html/rfc3339#section-5.6
            var s = dateTime.toLowerCase().split('t');
            if (!FormatValidators.date(s[0])) {
                return false;
            }
            var matches = Utils.getRegExp('^([0-9]{2}):([0-9]{2}):([0-9]{2})(.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$').exec(s[1]);
            if (matches === null) {
                return false;
            }
            var hour = matches[1];
            var minute = matches[2];
            var second = matches[3];
            // var fraction = matches[4];
            // var timezone = matches[5];
            if (hour > '23' || minute > '59' || second > '59') {
                return false;
            }
            return true;
        },
        'email': function (email) {
            // http://fightingforalostcause.net/misc/2006/compare-email-regex.php
            return typeof email !== 'string' || Utils.getRegExp(/^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$/i).test(email);
        },
        'hostname': function (hostname) {
            if (!Utils.isString(hostname)) {
                return true;
            }
            /*
             http://json-schema.org/latest/json-schema-validation.html#anchor114
             A string instance is valid against this attribute if it is a valid
             representation for an Internet host name, as defined by RFC 1034, section 3.1 [RFC1034].

             http://tools.ietf.org/html/rfc1034#section-3.5

             <digit> ::= any one of the ten digits 0 through 9
             var digit = /[0-9]/;

             <letter> ::= any one of the 52 alphabetic characters A through Z in upper case and a through z in lower case
             var letter = /[a-zA-Z]/;

             <let-dig> ::= <letter> | <digit>
             var letDig = /[0-9a-zA-Z]/;

             <let-dig-hyp> ::= <let-dig> | "-"
             var letDigHyp = /[-0-9a-zA-Z]/;

             <ldh-str> ::= <let-dig-hyp> | <let-dig-hyp> <ldh-str>
             var ldhStr = /[-0-9a-zA-Z]+/;

             <label> ::= <letter> [ [ <ldh-str> ] <let-dig> ]
             var label = /[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?/;

             <subdomain> ::= <label> | <subdomain> "." <label>
             var subdomain = /^[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?(\.[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?)*$/;

             <domain> ::= <subdomain> | " "
             var domain = null;
             */
            var valid = Utils.getRegExp('^[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?(\\.[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?)*$').test(hostname);
            if (valid) {
                // the sum of all label octets and label lengths is limited to 255.
                if (hostname.length > 255) { return false; }
                // Each node has a label, which is zero to 63 octets in length
                var labels = hostname.split('.');
                for (var i = 0; i < labels.length; i++) { if (labels[i].length > 63) { return false; } }
            }
            return valid;
        },
        'host-name': function () {
            return FormatValidators.hostname.apply(this, arguments);
        },
        'ipv4': function (ipv4) {
            // https://www.owasp.org/index.php/OWASP_Validation_Regex_Repository
            return typeof ipv4 !== 'string' || Utils.getRegExp('^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$').test(ipv4);
        },
        'ipv6': function (ipv6) {
            // Stephen Ryan at Dartware @ http://forums.intermapper.com/viewtopic.php?t=452
            return typeof ipv6 !== 'string' || Utils.getRegExp('^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$').test(ipv6);
        },
        'regex': function (str) {
            try {
                Utils.getRegExp(str);
                return true;
            } catch (e) {
                return false;
            }
        },
        'uri': function (uri, validator) {
            if (validator.options.strictUris) {
                return FormatValidators['strict-uri'].apply(this, arguments);
            }
            // https://github.com/zaggino/z-schema/issues/18
            // RegExp from http://tools.ietf.org/html/rfc3986#appendix-B
            return typeof uri !== 'string' || Utils.getRegExp('^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?').test(uri);
        },
        'strict-uri': function (uri) {
            // http://mathiasbynens.be/demo/url-regex
            // https://gist.github.com/dperini/729294
            return typeof uri !== 'string' || Utils.getRegExp(
                '^' +
                    // protocol identifier
                    '(?:(?:https?|ftp)://)' +
                    // user:pass authentication
                    '(?:\\S+(?::\\S*)?@)?' +
                    '(?:' +
                    // IP address exclusion
                    // private & local networks
                    '(?!10(?:\\.\\d{1,3}){3})' +
                    '(?!127(?:\\.\\d{1,3}){3})' +
                    '(?!169\\.254(?:\\.\\d{1,3}){2})' +
                    '(?!192\\.168(?:\\.\\d{1,3}){2})' +
                    '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' +
                    // IP address dotted notation octets
                    // excludes loopback network 0.0.0.0
                    // excludes reserved space >= 224.0.0.0
                    // excludes network & broacast addresses
                    // (first & last IP address of each class)
                    '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
                    '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
                    '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
                    '|' +
                    // host name
                    '(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)' +
                    // domain name
                    '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*' +
                    // TLD identifier
                    '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
                    ')' +
                    // port number
                    '(?::\\d{2,5})?' +
                    // resource path
                    '(?:/[^\\s]*)?' +
                    '$', 'i'
            ).test(uri);
        }
    };
    /*jshint maxlen: 150*/
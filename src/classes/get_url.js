function getUrl(url, callback) {
    if (typeof XMLHttpRequest != 'undefined') {
        var httpRequest = new XMLHttpRequest;
        httpRequest.open('GET', url, true);
        httpRequest.onload = function(){
            if (httpRequest.status >= 200 && request.status < 400){
                // Success!
                callback(null, {}, request.responseText);
            } else {
                // We reached our target server, but it returned an error
                callback(new Error('bad status: ' + httpRequest.status));
            }
        };
        return;
    } else if (!getUrl.request) {
        getUrl.request = require('request');
    }
    getUrl.request.get(url, callback);
}
function Factory(schema){
    this.schema = ZSchema.Utils.compress(schema);
    this._count = 0;
    this._handlers = [];
}

Factory.prototype = {

    /**
     *
     * @param pattern {function|string|regex} determines whether this handler satisfies a given path
     * @param handler {function|value}
     */
    addHandler: function(pattern, handler){
        var new_handler = new FactoryHandler(pattern, handler, this);
        this._handlers.add(new_handler);
    },

    reset: function(){
        this._count = 0;
        Utils.forEach(this._handlers, function(value){
            value.reset();
        }, this);
    },

    index: function(){
        return this._count;
    }
};

/**
 *
 * @param pattern {function|string|regex} determines whether this handler satisfies a given path
 * @param handler {function|value}
 * @param factory {Factory}
 * @constructor
 */
function FactoryHandler(pattern, handler, factory){
    if (Utils.isString(pattern)){
        pattern = new RegExp((pattern));
    }

    this.pattern = pattern;
    this.handler = handler;
    this.factory = factory;
    this.memo = {}; // state memory
}

FactoryHandler.prototype = {

    handles: function(path, count){
        if (ZSchema.Utils.isFunction(this.pattern)){
            return this.pattern(path, count);
        } else {
            return this.pattern.test(path);
        }
    },

    reset: function(){
        this.memo = {};
    },

    handle: function (path, count){
        if (ZSchema.Utils.isFunction(this.handler)){
            return this.handler(path.count);
        } else if (ZSchema.Utils.isArray(this.handler)){
            return this.handler[this.factory.index()]; //@TODO: check on double array for count?
        } else {
            return this.handler;
        }
    }

};
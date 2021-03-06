/*!
 * Oscy.js
 * -------
 * Just another instrument by Oscillator on Web Audio API
 * 
 * @version 0.1.2 (2014/08/12)
 * @author mach3 <http://github.com/mach3>
 * @license MIT
 * @require jquery#1, jquery-easing
 */
(function($, global){

    var oscy = {};

    /**
     * Check Support
     * -------------
     */
    global.AudioContext = global.AudioContext || global.webkitAudioContext || null;
    if(! global.AudioContext){
        throw new Error("AudioContext is not supported");
    }
    global.AudioContext.prototype.createGain = global.AudioContext.prototype.createGain 
    || global.AudioContext.prototype.createGainNode;

    oscy.context = new AudioContext();


    /**
     * Utilities
     * ---------
     */
    var u = {
        /**
         * Extend object or function.prototype
         * @param {Function|Object} dest, src1, src2 ...
         */
        extend: function(){
            var args = u.toArray(arguments).map(function(obj){
                return $.isFunction(obj) ? obj.prototype : obj;
            });
            return $.extend.apply(null, args);
        },

        /**
         * Juggle array-like-object to array
         * @param {*} Object
         * @returns {Array}
         */
        toArray: function(obj){
            return Array.prototype.slice.call(obj);
        },

        /**
         * Bind function to the object
         * @param {Object} obj
         * @param {Array} props
         */
        bindObject: function(obj, props){
            props.forEach(function(name){
                if($.isFunction(obj[name])){
                    obj[name] = obj[name].bind(obj);
                }
            });
        },

        /**
         * Get last value from array
         * @param {Array}
         * @returns {*}
         */
        last: function(list){
            return list[list.length - 1];
        },

        /**
         * Get array of value referenced by key from collection
         * @param {Array} list
         * @param {String} key
         * @returns {Array}
         */
        columns: function(list, key){
            var res = [];
            u.toArray(list).forEach(function(item){
                res.push(item[key]);
            });
            return res;
        },

        /**
         * Return formatted string
         * @param {String...} template, args1, args2 ...
         */
        format: function(){
            var args = u.toArray(arguments);
            return args.shift().replace(/%s/g, function(){
                return args.length ? args.shift() : "";
            });
        }
    };


    /**
     * oscy.Config
     * -----------
     * @class Configure options
     */
    oscy.Config = function(){
    };

    u.extend(oscy.Config, {

        defaults: null,
        options: null,

        /**
         * Configure options
         */
        config: function(){
            var my, args, changed;

            my = this;
            args = u.toArray(arguments);
            if($.type(this.options) !== "object"){
                this.options = {};
                if(!! this.defaults){
                    this.config(this.defaults)
                }
            }
            changed = false;
            switch($.type(args[0])){
                case "string":
                    if(args.length < 2){
                        return this.options[args[0]];
                    }
                    changed = (args[1] !== this.options[args[0]]);
                    this.options[args[0]] = args[1];
                    if(changed && $.isFunction(this.onChange)){
                        this.onChange(args[0], args[1]);
                    }
                    return this;
                case "object":
                    $.each(args[0], function(key, value){
                        my.config(key, value);
                    });
                    return this;
                case "undefined":
                    return this.options;
                default: break;
            }
            return this;
        }

    });


    /**
     * oscy.Sound
     * ----------
     * @class Play sound
     */
    oscy.Sound = function(options){
        this._construct.apply(this, arguments);
    };

    u.extend(oscy.Sound, oscy.Config, {

        /**
         * Defaults for options:
         */
        defaults: {
            autoplay: false,
            type: "sine",
            frequency: 440,
            frequencyMax: 440 * 2,
            frequencyMin: 440 / 2,
            detune: 0,
            detuneMin: -500,
            detuneMax: 500,
            gain: 0
        },

        id: null,

        initialized: false,
        context: null,
        options: null,
        osc: null,
        gain: null,
        timer: null,

        /**
         * @constructor
         */
        _construct: function(id, options){
            // initialize
            this.id = id;
            this.config(options);
            this.context = oscy.context;
            this.osc = this.context.createOscillator();
            this.gain = this.context.createGain();

            // connection
            this.osc.connect(this.gain);
            this.gain.connect(this.context.destination);

            // update all params
            this.update();

            if(this.config("autoplay")){
                this.start();
            }

            this.initialized = true;
        },

        /**
         * Start to sound
         */
        start: function(){
            this.osc.start(0);
            return this;
        },

        /**
         * Stop to sound
         */
        stop: function(){
            this.osc.stop(0);
            return this;
        },

        /**
         * Handler for changing options
         * @param {String} key
         * @param {*} value
         */
        onChange: function(key, value){
            if(this.initialized){
                this.update(key, value);
            }
        },

        /**
         * Update oscillator attributes
         * @param {String} key
         * @param {*} value
         */
        update: function(key, value){
            var my = this;
            if(! arguments.length){
                $.each(this.config(), function(key, value){
                    my.update(key, value)
                });
                return this;
            }
            switch(key){
                case "frequency":
                case "detune":
                    this.osc[key].value = value;
                    break;
                case "type":
                    this.osc[key] = value;
                    break;
                case "gain":
                    this.gain.gain.value = value;
                    break;
                default: break;
            }
            return this;
        },

        /**
         * Fade the sound by effect
         * @param {Object} to
         * @param {String} effect
         * @param {Integer} duration
         * @param {Funcition} onComplete
         * @returns {jQueryDeferred}
         */
        fade: function(to, effect, duration, onComplete){
            var df, my, now, interval, from, diff, step;

            df = $.Deferred();

            if(!! this.timer){
                return this;
            }

            effect = $.easing[effect] || $.easing.swing;
            duration = duration || 1000;
            onComplete = $.isFunction(onComplete) ? onComplete : $.noop;

            my = this;
            now = 0;
            interval = 10;
            from = {};
            diff = {};

            $.each(to, function(key, value){
                from[key] = my.config(key);
                diff[key] = value - from[key];
            });

            step = function(){
                var r;

                if(now >= duration){
                    clearInterval(my.timer);
                    my.timer = null;
                    onComplete.call(my);
                    df.resolve(my);
                    return;
                }

                now += interval;
                r = effect(null, now, 0, 1, duration);

                $.each(to, function(key, value){
                    my.config(key, from[key] + diff[key] * r);
                });
            };

            this.timer = setInterval(step, interval);

            return df;
        },

        /**
         * Destructor
         */
        destruct: function(){
            this.stop();
            this.gain.disconnect(0);
            this.osc.disconnect(0);
        }

    });


    /**
     * oscy.RippleBase
     * ---------------
     * @class Show ripple for mouse event
     */
    oscy.RippleBase = function(options){
        this._construct.apply(this, arguments);
    };

    u.extend(oscy.RippleBase, oscy.Config, {

        /**
         * Defaults for options:
         */
        defaults: {
            panel: null,
            baseColor: "#000",
            size: 120
        },

        base: null,

        /**
         * @constructor
         * @param {Object} options
         */
        _construct: function(options){
            this.config(options);
            this.base = $("<div>").css({
                "position": "absolute",
                "left": 0,
                "top": 0,
                "width": "100%",
                "height": "100%",
                "background-color": this.config("baseColor"),
                "z-index": 1,
                "overflow": "hidden"
            });
            this.base.insertBefore(this.config("panel"));
        },

        /**
         * Get color by position
         * @param {Object} pos
         * @returns {String}
         */
        getColor: function(pos){
            var i = parseInt(pos.x * 360, 10);
            return "hsl(" + i + ", 100%, 50%)";
        },

        /**
         * Create ripple and show it
         * @param {Object} pos
         * @returns {HTMLIElement}
         */
        show: function(pos){
            var o, ripple, onComplete, color;

            o = this.options;
            ripple = $("<i>");
            onComplete = function(e){
                var node = $(e.target);
                node.remove();
                node.off(onComplete);
            };
            color = this.getColor(pos);

            ripple.css({
                "position": "absolute",
                "display": "block",
                "left": pos.offsetX,
                "top": pos.offsetY,
                "border-style": "solid",
                "border-width": 3,
                "border-color": color,
                "border-radius": "100%",
                "width": 1,
                "height": 1,
                "transition": "all 2s ease 0"
            })
            .on("transitionend", onComplete)
            .appendTo(this.base);

            setTimeout(function(){
                ripple.css({
                    "left": pos.offsetX - (o.size / 2),
                    "top": pos.offsetY - (o.size / 2),
                    "border-color": o.baseColor,
                    "width": o.size,
                    "height": o.size
                });
            }, 10)

            return ripple;
        }

    });


    /**
     * oscy.Composer
     * -------------
     * @class Create oscy instrument
     */
    oscy.Composer = function(selector, options){
        this._construct.apply(this, arguments);
    };

    u.extend(oscy.Composer, oscy.Config, {

        /**
         * Defaults for options:
         */
        defaults: {
            ripple: true,
            rippleBaseColor: "#000",
            type: "sine",
            effect: "easeInOutBounce",
            reverb: 1500,
            backgroundImage: [
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAAICAYAAADUZmU7AAABMklEQVRoQ+",
                "1a7QqDMAyssL3/A2/gBzK14tJerqwz3A9BXZKq6d2Sa4cxpTE9UtqO5+F8uY9cI7bn2D/0fc+v9Tleh/",
                "PlnnWN2LaMxY67J/cuCSUnR48EM0lifOd39cKXgRyZoYxW0OfY0VtC2fl38kNn7IDEQmzzZx5E0PXp9n",
                "/mdYyjPxILsb2asn0gjMLOsgdjiaCr6i3wq5q1GhML9a1HLIO6EvkjqERsRdBb9VxKwf3Tu05lEXRly+",
                "THkd16lSYaM64q6NA9sCro0OkVQZuaVct/YIZkGV8RdGgEi6BDp1cELYL+3j+h0kJDEUoadGUfL4IWQR",
                "sSCANhxpdcgpIGLQ36chsA2ap0WEUSQYugRdCeLT3/Io9I4giNYBF06PRK4pDEIYnDt6m25cquv3KfAP",
                "kWqGScetsTAAAAAElFTkSuQmCC",
            ].join("")
        },

        panel: null,
        rippleBase: null,
        sound: [],

        /**
         * @constructor
         * @param {String} selector
         * @param {Object} options
         */
        _construct: function(selector, options){
            u.bindObject(this, ["onStart", "onMove", "onStop"]);
            this.config(options);

            // Oscy panel
            this.panel = $(selector).css({
                "position": "absolute",
                "left": 0,
                "top": 0,
                "width": "100%",
                "height": "100%",
                "z-index":  2,
                "-webkit-user-select": "none",
                "background-image": u.format("url(%s)", this.config("backgroundImage")),
                "background-repeat": "no-repeat",
                "background-size": "100% 8px",
                "background-position": "left center",
                "opacity": ".3"
            });

            // Ripple base
            if(this.config("ripple")){
                this.rippleBase = new oscy.RippleBase({
                    panel: this.panel,
                    baseColor: this.config("rippleBaseColor"),
                    size: this.panel.width() / 3
                });
            }

            // Events
            this.panel.on({
                "mousedown touchstart": this.onStart,
                "mouseup touchend": this.onStop,
                "mousemove touchmove": this.onMove
            });
        },

        /**
         * Get position information by event object
         * @param {Event} e
         * @returns {Object}
         */
        touches: function(e){
            var pos, offset, size, push;

            e = e.originalEvent || e;

            pos = [];
            offset = this.panel.offset();
            size = {
                width: this.panel.outerWidth(),
                height: this.panel.outerHeight()
            };
            push = function(id, offsetX, offsetY){
                pos.push({
                    id: id,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    x: offsetX / size.width,
                    y: offsetY / size.height
                })
            };

            if(/^touch/.test(e.type)){
                $.each(e.changedTouches, function(i, touch){
                    push(touch.identifier, touch.pageX - offset.left, touch.pageY - offset.top);
                });
            } else {
                push(null, e.offsetX, e.offsetY);
            }

            return pos.slice(0, 3);
        },

        /**
         * Get sound object by id
         * @param {Integer} id
         * @returns {oscy.Sound}
         */
        getSoundById: function(id){
            var sound = this.sound.filter(function(s){
                return s.id === id;
            });
            return sound.length ? sound[0] : null;
        },

        /**
         * Fadeout and remove sound by id list
         * Return count of the removed
         * @param {Array} ids
         * @returns {Integer}
         */
        remove: function(ids){
            var my, done;

            my = this;
            done = 0;

            this.sound.forEach(function(sound, i){
                if(ids.indexOf(sound.id) >= 0){
                    sound.fade({gain: 0}, my.config("effect"), my.config("reverb"))
                    .done(sound.destruct.bind(sound));
                    // splice
                    my.sound = my.sound.filter(function(s){
                        return s.id !== sound.id;
                    });
                    done += 1;
                }
            });
            return done;
        },

        /**
         * Remove unused sound, return count of the removed
         * @param {Event} e
         * @returns {Integer}
         */
        removeGarbage: function(e){
            e = e.originalEvent || e;
            if(!! e.touches && ! e.touches.length && this.sound.length){
                return this.remove(u.columns(this.sound, "id"));
            }
            return 0;
        },

        /**
         * Update sounds detune and frequency by position
         * @param {oscy.Sound} sound
         * @param {Object} pos
         */
        updateSound: function(sound, pos){
            var o, getValue;

            o = sound.config();
            getValue = function(min, max, rate){
                return min + (max - min) * rate;
            };
            sound.config({
                detune: 1 - getValue(o.detuneMin, o.detuneMax, pos.y),
                frequency: getValue(o.frequencyMin, o.frequencyMax, pos.x)
            });
            return this;
        },

        /**
         * Show ripple by position
         * @param {Object} pos
         */
        showRipple: function(pos){
            if(this.config("ripple")){
                this.rippleBase.show(pos);
            }
        },

        /**
         * Handler for mousemove, touchstart
         * @param {Event} e
         */
        onStart: function(e){
            var my = this;

            e.preventDefault();
            this.touches(e).forEach(function(p){
                var sound = new oscy.Sound(p.id, {gain: 0.5, type: my.config("type")});
                my.updateSound(sound, p);
                my.sound.push(sound);
                sound.start();
                my.showRipple(p);
            });
        },

        /**
         * Handler for mousemove, touchmove
         * @param {Event} e
         */
        onMove: function(e){
            var my = this;

            e.preventDefault();
            this.touches(e).forEach(function(p){
                var sound;
                if(sound = my.getSoundById(p.id)){
                    my.updateSound(sound, p);
                    my.showRipple(p);
                }
            });
        },

        /**
         * Handler for mouseup, touchend
         * @param {Event} e
         */
        onStop: function(e){
            var my = this;
            e.preventDefault();
            this.remove(u.columns(this.touches(e), "id"));
            this.removeGarbage(e);
        }

    });


    /**
     * Exports
     * -------
     */
    global.Oscy = oscy.Composer;

}(jQuery, this));
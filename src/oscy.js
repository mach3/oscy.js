(function($, global){

	var u = {
		extend: function(){
			var args = u.toArray(arguments).map(function(obj){
				return $.isFunction(obj) ? obj.prototype : obj;
			});
			return $.extend.apply(null, args);
		},

		toArray: function(obj){
			return Array.prototype.slice.call(obj);
		},

		bindObject: function(obj, props){
			props.forEach(function(name){
				if($.isFunction(obj[name])){
					obj[name] = obj[name].bind(obj);
				}
			});
		},

		last: function(list){
			return list[list.length - 1];
		},

		random: function(list){
			var i = Math.floor(Math.random() * list.length);
			return list[i];
		}
	};


	var oscy = {};


	/**
	 * Check Support
	 */
	global.AudioContext = global.AudioContext || global.webkitAudioContext || null;

	if(! global.AudioContext){
		throw new Error("AudioContext is not supported");
	}

	global.AudioContext.prototype.createGain = global.AudioContext.prototype.createGain 
	|| global.AudioContext.prototype.createGainNode;


	/**
	 * Context
	 */
	oscy.context = new AudioContext();


	/**
	 * oscy.Config
	 */
	oscy.Config = function(){
	};

	u.extend(oscy.Config, {

		defaults: null,
		options: null,

		config: function(){
			var my = this;
			var args = u.toArray(arguments);
			if($.type(this.options) !== "object"){
				this.options = {};
				if(!! this.defaults){
					this.config(this.defaults)
				}
			}
			var changed = false;
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
	 *
	 */
	oscy.Sound = function(options){
		this._construct.apply(this, arguments);
	};

	u.extend(oscy.Sound, oscy.Config, {

		defaults: {
			autoplay: false,
			type: "sine",
			frequency: 0,
			frequencyMax: 0,
			frequencyMin: 0,
			detune: 0,
			detuneMin: 0,
			detuneMax: 0,
			gain: 0
		},

		types: ["sine", "square", "sawtooth", "triangle"],

		initialized: false,
		context: null,
		options: null,
		osc: null,
		gain: null,
		timer: null,

		_construct: function(options){
			// initialize
			this.config(options);
			this.context = oscy.context;
			this.osc = this.context.createOscillator();
			this.gain = this.context.createGain();

			// get initial values
			this.config({
				frequency: this.osc.frequency.defaultValue,
				frequencyMax: this.osc.frequency.defaultValue + 500,
				frequencyMin: this.osc.frequency.defaultValue - 500,
				detune: this.osc.detune.defaultValue,
				detuneMin: this.osc.detune.defaultValue - 3000,
				detuneMax: this.osc.detune.defaultValue + 1000
			});

			// get random type
			this.config("type", "sine");

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

		start: function(){
			this.osc.start(0);
		},

		stop: function(){
			this.osc.stop();
		},

		onChange: function(key, value){
			if(this.initialized){
				this.update(key, value);
			}
		},

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

		fade: function(to, effect, duration, onComplete){
			var df = $.Deferred();

			if(!! this.timer){
				return this;
			}

			effect = effect in $.easing ? $.easing[effect] : $.easing["linear"];
			duration = duration || 1000;
			onComplete = $.isFunction(onComplete) ? onComplete : $.noop;

			var my = this;
			var now = 0;
			var interval = 10;

			var from = {};
			var diff = {};

			$.each(to, function(key, value){
				from[key] = my.config(key);
				diff[key] = value - from[key];
			});


			var step = function(){
				if(now >= duration){
					clearInterval(my.timer);
					my.timer = null;
					onComplete.call(my);
					df.resolve(my);
					return;
				}

				now += interval;

				var r = effect(null, now, 0, 1, duration);

				$.each(to, function(key, value){
					my.config(key, from[key] + diff[key] * r);
				});

			};

			this.timer = setInterval(step, interval);

			return df;
		}

	});


	/**
	 * oscy.RippleBase
	 */
	oscy.RippleBase = function(options){
		this._construct.apply(this, arguments);
	};

	u.extend(oscy.RippleBase, oscy.Config, {

		defaults: {
			panel: null,
			baseColor: "#000",
			size: 120
		},

		base: null,

		_construct: function(options){
			this.config(options);
			// this.createColorMap();
			this.base = $("<div>").css({
				"position": "absolute",
				"left": 0,
				"top": 0,
				"width": "100%",
				"height": "100%",
				"background-color": this.config("baseColor"),
				"z-index": 1
			});
			this.base.insertBefore(this.config("panel"));
		},

		// createColorMap: function(){
		// 	var data = [];
		// 	"0369cf".split("").forEach(function(s){
		// 		data.push(s + s);
		// 	});
		// 	var map = [];
		// 	data.forEach(function(r){
		// 		data.forEach(function(g){
		// 			data.forEach(function(b){
		// 				map.push("#" + r + g + b);
		// 			});
		// 		});
		// 	});
		// 	this.map = map;
		// },

		getColor: function(pos){
			// var i, val;
			// i = parseInt(pos.centerY * pos.x * this.map.length, 10);
			// return this.map[i];
			var i = parseInt(pos.centerY * pos.x * 360, 10);
			return "hsl(" + i + ", 100%, 50%)";
		},

		show: function(pos){
			var o = this.options;
			var ripple = $("<i>");

			var onComplete = function(e){
				var node = $(e.target);
				node.remove();
				node.off(onComplete);
			};

			var color = this.getColor(pos);

			// this.base.append(ripple);

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
				"opacity": 1,
				"transition": "all 1s ease 0"
			})
			.on("transitionend", onComplete)
			.appendTo(this.base);


			setTimeout(function(){
				ripple.css({
					"opacity": 0,
					"left": pos.offsetX - (o.size / 2),
					"top": pos.offsetY - (o.size / 2),
					// "border-color": o.baseColor,
					"width": o.size,
					"height": o.size
				});
			}, 10)

			return ripple;
		}


	});


	/**
	 * oscy.Composer
	 */
	oscy.Composer = function(selector, options){
		this._construct.apply(this, arguments);
	};

	u.extend(oscy.Composer, oscy.Config, {

		defaults: {
			ripple: true,
			rippleBaseColor: "#000",
			backgroundImage: [
				"url(",
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAAICAYAAADUZmU7AAABMklEQVRoQ+",
				"1a7QqDMAyssL3/A2/gBzK14tJerqwz3A9BXZKq6d2Sa4cxpTE9UtqO5+F8uY9cI7bn2D/0fc+v9Tleh/",
				"PlnnWN2LaMxY67J/cuCSUnR48EM0lifOd39cKXgRyZoYxW0OfY0VtC2fl38kNn7IDEQmzzZx5E0PXp9n",
				"/mdYyjPxILsb2asn0gjMLOsgdjiaCr6i3wq5q1GhML9a1HLIO6EvkjqERsRdBb9VxKwf3Tu05lEXRly+",
				"THkd16lSYaM64q6NA9sCro0OkVQZuaVct/YIZkGV8RdGgEi6BDp1cELYL+3j+h0kJDEUoadGUfL4IWQR",
				"sSCANhxpdcgpIGLQ36chsA2ap0WEUSQYugRdCeLT3/Io9I4giNYBF06PRK4pDEIYnDt6m25cquv3KfAP",
				"kWqGScetsTAAAAAElFTkSuQmCC",
				")"
			].join("")
		},

		panel: null,
		rippleBase: null,
		sound: [],

		_construct: function(selector, options){

			u.bindObject(this, ["onStart", "onMove", "onStop"]);

			this.config(options);

			this.panel = $(selector).css({
				"position": "absolute",
				"left": 0,
				"top": 0,
				"width": "100%",
				"height": "100%",
				"z-index":  2,
				"-webkit-user-select": "none",
				"background-image": this.config("backgroundImage"),
				"background-repeat": "no-repeat",
				"background-size": "100% 8px",
				"background-position": "left center",
				"opacity": ".3"
			});

			if(this.config("ripple")){
				this.rippleBase = new oscy.RippleBase({
					panel: this.panel,
					baseColor: this.config("rippleBaseColor"),
					size: this.panel.width() / 3
				});
			}

			// events
			this.panel.on({
				"mousedown touchstart": this.onStart,
				"mouseup touchend": this.onStop,
				"mousemove touchmove": this.onMove
			});
		},

		getPosition: function(e){
			var pos;
			e = e.originalEvent || e;

			if(/^touch/.test(e.type)){
				if(! e.touches.length){
					return null;
				}
				e = e.touches[0];
				(function(offset){
					e.offsetX = e.pageX - offset.left;
					e.offsetY = e.pageY - offset.top;
				}(this.panel.offset()));
			}

			pos = {
				offsetX: e.offsetX,
				offsetY: e.offsetY,
				x: e.offsetX / this.panel.outerWidth(),
				y: e.offsetY / this.panel.outerHeight()
			};
			pos.centerX = 1 - (Math.abs(pos.x - 0.5) * 2);
			pos.centerY = 1 - (Math.abs(pos.y - 0.5) * 2);
			return pos;
		},

		updateSound: function(sound, pos){
			var getValue = function(min, max, rate){
				return min + (max - min) * rate;
			};
			var o = sound.config();
			sound.config({
				detune: getValue(o.detuneMin, o.detuneMax, pos.x),
				frequency: getValue(o.frequencyMin, o.frequencyMax, pos.centerY)
			});
		},

		showRipple: function(pos){
			if(this.config("ripple")){
				this.rippleBase.show(pos);
			}
		},

		onStart: function(e){
			e.preventDefault();

			var pos = this.getPosition(e);
			var sound = new oscy.Sound({gain: 0.5});
			this.updateSound(sound, pos);
			this.sound.push(sound);
			sound.start();

			this.showRipple(pos);
		},

		onMove: function(e){
			e.preventDefault();

			if(this.sound.length){
				var pos = this.getPosition(e);
				this.updateSound(u.last(this.sound), pos);
				this.showRipple(pos);
			}
		},

		onStop: function(e){
			e.preventDefault();

			var sound = this.sound.shift();
			sound.fade({gain: 0}, "easeInOutBounce", 3000);
		}


	});

	global.oscy = oscy;




}(jQuery, this));
/**
 * @license Copyright (c) 2010-2011 Brian Cavalier
 * LICENSE: see the LICENSE.txt file. If file is missing, this file is subject
 * to the MIT License at: http://www.opensource.org/licenses/mit-license.php.
 */

/*
	File: base.js
	Base wire plugin that provides properties, init, and destroy facets, and a
	proxy for plain JS objects.
*/
define([], function() {
	var tos, beget;
	tos = Object.prototype.toString;

	// In case Object.create isn't available
	function T() {}

	function objectCreate(prototype) {
		T.prototype = prototype;
		return new T();
	}

	beget = Object.create || objectCreate;
	
	function reject(resolver) {
		return function(err) {
			resolver.reject(err);
		};
	}
	
	function resolve(resolver) {
		return function(result) {
			resolver.resolve(result);
		};
	}

	function invoke(promise, func, target, args, wire) {
		var f, rejecter;

		f= target[func];

		rejecter = reject(promise);

		if(typeof f == 'function') {
			if(args) {
				wire(args).then(
					function(resolvedArgs) {
						try {
							var result = f.apply(target, (tos.call(resolvedArgs) == '[object Array]')
								? resolvedArgs
								: [resolvedArgs]);

							promise.resolve(result);
						} catch(e) {
							rejecter(e);
						}
					},
					rejecter
				);
			}			
		}
	}

	function invokeAll(promise, facet, wire) {
		var target, options;

		target  = facet.target;
		options = facet.options;

		if(typeof options == 'string') {
			invoke(promise, options, target, [], wire);

		} else {
			var promises, p, func;
			promises = [];

			for(func in options) {
				p = wire.deferred();
				promises.push(p);
				invoke(p, func, target, options[func], wire);
			}
			
			wire.whenAll(promises).then(
				resolve(promise),
				reject(promise)
			);
		}
	}

	// Factory that handles cases where you need to create an object literal
	// that has a property whose name would trigger another wire factory.
	// For example, if you need an object literal with a property named "create",
	// which would normally cause wire to try to construct an instance using
	// a constructor or other function, and will probably result in an error,
	// or an unexpected result:
	// myObject: {
	//	 create: "foo"
	//   ...
	// }
	//
	// You can use the literal factory to force creation of an object literal:
	// myObject: {
	//   literal: {
	//     create: "foo"
	//   }
	// }
	//
	// which will result in myObject.create == "foo" rather than attempting
	// to create an instance of an AMD module whose id is "foo".
	function literalFactory(promise, spec /*, wire */) {
		promise.resolve(spec.literal);
	}

	function protoFactory(promise, spec, wire) {
		var parentRef = spec.prototype;

		wire.resolveRef(parentRef).then(
			function(parent) {
				var child = beget(parent);
				promise.resolve(child);
			},
			reject(promise)
		);
	}

	function propertiesFacet(promise, facet, wire) {
		var options, promises, prop;
		promises = [];
		options = facet.options;

		for(prop in options) {
			promises.push(setProperty(facet, prop, options[prop], wire));
		}

		wire.whenAll(promises).then(
			resolve(promise),
			reject(promise)	
		);
	}

	function setProperty(proxy, name, val, wire) {
		var promise = wire(val);

		promise.then(function(resolvedValue) {
			proxy.set(name, resolvedValue);
		});

		return promise;
	}


	function initFacet(promise, facet, wire) {
		invokeAll(promise, facet, wire);
	}

	function pojoProxy(object /*, spec */) {
		return {
			get: function(property) {
				return object[property];
			},
			set: function(property, value) {
				object[property] = value;
				return value;
			},
			invoke: function(method, args) {
				return method.apply(object, args);
			}
		};
	}

	return {
		wire$plugin: function(ready, destroyed /*, options */) {
			var destroyFuncs = [];

			destroyed.then(function() {
				for(var i = 0, destroy; (destroy = destroyFuncs[i++]);) {
					destroy();
				}
				destroyFuncs = [];
			});

			function destroyFacet(promise, facet, wire) {
				promise.resolve();
				
				var target, options, w;
				
				target = facet.target;
				options = facet.options;
				w = wire;

				destroyFuncs.push(function destroyObject() {
					invokeAll(wire.deferred(), { options: options, target: target }, w);
				});
			}
			
			return {
				factories: {
					literal: literalFactory,
					prototype: protoFactory
				},
				facets: {
					// properties facet.  Sets properties on components
					// after creation.
					properties: {
						configure: propertiesFacet
					},
					// init facet.  Invokes methods on components after
					// they have been configured
					init: {
						initialize: initFacet
					},
					// destroy facet.  Registers methods to be invoked
					// on components when the enclosing context is destroyed
					destroy: {
						ready: destroyFacet
					}
				},
				proxies: [
					pojoProxy
				]
			};				
		}
	};
});
// Copyright 2015 Towry Wang. All rights reserved.
// Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

/**
 * @fileoverview Enable html element to be draggaed.
 */

(function (name, context, definition) {
    if (typeof module !== 'undefined' && module.exports) module.exports = definition();
    else if (typeof define === 'function' && define.amd) define(definition);
    else context[name] = definition();
})('superdrag', this, function () {

var doc = document;
var win = window;

var modernBrowser = true;

// detect if the browser support dnd
// this may fail on ios8
var dndSupported = (function () {
    var div = document.createElement('div');

    return ('draggable' in div) && ('ondragstart' in div) && (typeof div['ondrop'] === 'object');
}()); 

var cssTransformProperty;
var translate = (function () {
    var style = doc.documentElement.style;
    var prefixs = 'webkit o ms moz'.split(' ');
    var prefix = null;

    if (typeof style['transform'] === 'string') {
        cssTransformProperty = 'transform';
    } else {        
        for (var i = 0, ii = prefixs.length; i < ii; i++) {
            if (typeof style['-' + prefixs[i] + 'transform'] === 'string') {
                cssTransformProperty = '-' + prefixs[i] + 'transform';
                break;
            }
        }
    }

    if (!cssTransformProperty) return null;

    return function (x, y) {
        return 'translate(' + x + 'px, ' + y + 'px)';
    }
}());

var _animateId;
// Shim requestAnimationFrame
if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ( function() {
 
        return window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
 
            window.setTimeout( callback, 1000 / 60 );
 
        };
 
    } )();
}
if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = ( function() {
 
        return window.webkitCancelAnimationFrame ||
        window.mozCancelAnimationFrame ||
        window.oCancelAnimationFrame ||
        window.msCancelAnimationFrame ||
        function(id) {
 
            window.clearTimeout( id );
 
        };
 
    } )();
}

/**
 * EventListener wrapper
 */
function listener (fn) {
    return function (ex) {
        if (typeof ex == 'undefined' && window.event) {
            ex = window.event;
        }

        // pageX & pageY
        if (!ex.pageX && ex.x) {
            ex.pageX = ex.x;
        }
        if (!ex.pageY && ex.y) {
            ex.pageY = ex.y;
        }

        if (!ex.target && ex.srcElement) {
            ex.target = ex.srcElement;
        }

        fn.call(this, ex);
    }
}

/**
 * Compatible version for add event
 */
function addEventListener (ele, type, fn) {
    if (ele.addEventListener) {
        ele.addEventListener(type, fn, false);
    } else if (ele.attachEvent) {
        ele[type + fn] = fn.handleEvent ? listener(fn.handleEvent) : fn;
        obj.attachEvent('on' + type, ele[type + fn]);
    }
}

/**
 * Compatible version for remove event
 */
function removeEventListener (ele, type, fn) {
    if (ele.removeEventListener) {
        ele.removeEventListener(type, fn);
    } else if (ele.detachEvent) {
        ele.detachEvent('on' + type, ele[type + fn]);
        try {
            delete ele[type + fn];
        } catch (err) {
            ele[type + fn] = undefined;
        }
    }
}

/**
 * Get the style of element 
 */
var defView = doc.defaultView;
function getStyle (ele) {
    if (defView && defView.getComputedStyle) {
        return defView.getComputedStyle(ele, null);
    } else {
        return ele.currentStyle;
    }
}

/**
 * Get the position of element in the whole document
 * @return {Object}
 */
function getPosition (ele) {
    var x = 0;
    var y = 0;

    if (ele.getBoundingClientRect) {
        var rect = ele.getBoundingClientRect();

        return {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right
        }
    }

    var _ele = ele;

    while (ele && !isNaN(ele.offsetLeft) && !isNaN(ele.offsetTop)) {
        x += ele.offsetLeft - ele.scrollLeft;
        y += ele.offsetTop - ele.scrollTop;
        ele = ele.offsetParent;
    }

    var style = getStyle(_ele);

    return {
        top: y,
        left: x,
        right: x + (parseInt(style.width, 10) || 0),
        bottom: y + (parseInt(style.height, 10) || 0)
    }
}

/**
 * Class `superdrag`
 * @constructor
 */
function Superdrag () {
    this.initialize();
}

Superdrag.prototype = {
    /**
     * preserve the constructor
     */
    constructor: Superdrag,

    initialize: function () {
        this.position = {};

        this.startPoint = {x:0, y:0};
        this.dragPoint = {x:1, y:1};

        this.handle = '';
        this.zIndex = 0;

        this.options = {};
    },

    drag: function (elements, options) {
        if (!elements.length) {
            elements = [elements];
        }

        options = options || {};

        /**
         * The handle of the draggable element.
         */
        this.handle = options.handle || null;

        var self = this;
        var _handle;
        var style;
        var zIndex;

        for (var i = 0, ii = elements.length; i < ii; i++) {
            style = getStyle(elements[i]);
            zIndex = style.zIndex;
            if (zIndex !== 'auto' && (zIndex - 0) > self.zIndex) {
                self.zIndex = zIndex;
            }

            if (self.handle) {
                _handle = elements[i].querySelectorAll(self.handle);
            } else {
                _handle = [elements[i]];
            }

            for (var j = 0, jj = _handle.length; j < jj; j++) {
                addEventListener(_handle[j], 'mousedown', function (n) {
                    return listener(function (e) {
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        } else {
                            e.cancelBubble = true;
                        }

                        self.initMouseMove(elements[n]);
                    })
                }.call(this, i));
            }
        }

        return this;
    },

    initMouseMove: function (ele) {
        var self = this;
        var _listener;

        _listener = listener(function (e) {
            e.preventDefault();

            removeEventListener(ele, 'mousemove', _listener);

            self.dragItem = ele;

            self.position = getPosition(self.dragItem);
            self.startPoint = {x: e.pageX, y: e.pageY};
            self.dragPoint = {x: e.pageX, y: e.pageY};

            self.initDragItem();

            // prepare everthing before the real mousemove start
            {
                if (dndSupported) {
                    ele.setAttribute('draggable', true);
                    addEventListener(ele, 'dragend', self);
                    addEventListener(ele, 'dragstart', self);
                    addEventListener(doc, 'dragover', self);
                }

                else {
                    addEventListener(doc, 'mousemove', self.mouseMoveHandler());
                    self.ondragstart(e);
                }
            }
        });

        addEventListener(ele, 'mousemove', _listener);
        addEventListener(ele, 'mouseup', this.mouseUpHandlerForElement());
        addEventListener(doc, 'mouseup', this.mouseUpHandler());
    },

    handleEvent: function (e) {
        if ('on' + e.type in this) {
            listener(this['on' + e.type]).call(this, e);
        }
    },

    _mouseUpHandlerForElement: null,
    mouseUpHandlerForElement: function () {
        var self = this;

        this._mouseUpHandlerForElement = this._mouseUpHandlerForElement || listener(function (e) {
            self.isDragging = false;
        })
    },

    _mouseMoveHandler: null,
    mouseMoveHandler: function () {
        var self = this;

        // movehandler
        this._mouseMoveHandler = this._mouseMoveHandler || listener(function (e) {
            e.preventDefault();
            e.stopPropagation();

            self.ondrag(e);
        });

        return this._mouseMoveHandler;
    },

    mouseUpHandler: function () {
        var self = this;
        return function (e) {
            // if drag drop api is enabled
            if (self.dragItem && dndSupported) {
                self.dragItem.removeAttribute('draggable');
            }

            if (!self._mouseMoveHandler) return;

            self.removeMoveHandler();
            self.ondragend(e);
        }
    },

    removeMoveHandler: function () {
         removeEventListener(doc, 'mousemove', this._mouseMoveHandler);
    },

    initDragItem: function () {
        if (!this.dragItem) return;

        var drag = this.dragItem;
        var dragStyle = drag.getAttribute('style');

        // if we need the element back to original position
        // when mouse button released.
        if (dragStyle && !dndSupported && false) {
            drag.setAttribute('data-style', dragStyle);
        }

        var style = getStyle(drag);

        if (style.position == '' || style.position == 'static') {
            drag.style.position = 'relative';
        }
        drag.style.zIndex = ++this.zIndex;
    },

    setPosition: function () {
        if (!this.dragItem) return;

        var xdelt = this.dragPoint.x - this.startPoint.x;
        var ydelt = this.dragPoint.y - this.startPoint.y;

        var left, top, style;

        style = getStyle(this.dragItem);

        left = parseInt(style.left, 10) || 0;
        top = parseInt(style.top, 10) || 0;

        if (style.position != 'relative') {
            left = left + this.position.left + xdelt + 'px';
            top = top + this.position.top + ydelt + 'px';
        } else {
            left = left + xdelt + 'px';
            top = top + ydelt + 'px';
        }

        if (translate) {
            this.dragItem.style[cssTransformProperty] = '';
        }

        this.dragItem.style.left = left;
        this.dragItem.style.top = top;
    },

    // Event handlers
    ondragstart: function (e) {
        if (!this.dragItem) return;

        this.isDragging = true;
        if (!dndSupported) {
            this.animate();
        }
    },

    ondragend: function (e) {
        if (this.dragItem && dndSupported) {
            this.dragItem.removeAttribute('draggable');
            // remove dragover event from doc
            removeEventListener(doc, 'dragover', this);
        }

        this.setPosition();
        
        this.startPoint = {x: 0, y: 0};
        this.dragPoint = {x: 0, y: 0};
        this.isDragging = false;

        if (!dndSupported) {
            this.dragItem.removeAttribute('data-style');
        }
    },

    ondragenter: function (e) {
        return false;
    },

    ondrop: function (e) {
        e.stopPropagation();
    },

    ondrag: function (e) {
        if (!this.dragItem) return;

        this.dragPoint = {x: e.pageX, y: e.pageY};
    },

    ondragover: function (e) {
        if (e.preventDefault) {
            e.preventDefault();
        }

        this.dragPoint = {x: e.pageX, y: e.pageY};
    },

    animate: function () {
        var self = this;

        _animateId = _animateId || function () {
            if (!self.isDragging) {
                return;
            }

            self._animate();

            requestAnimationFrame(_animateId);
        }

        _animateId.call(this);
    },

    _animate: function () {
        if (translate) {
            var deltaX = this.dragPoint.x - this.startPoint.x;
            var deltaY = this.dragPoint.y - this.startPoint.y;
            this.dragItem.style[cssTransformProperty] = translate(deltaX, deltaY);
        } else {
            this.setPosition();
        }
    }
}

return new Superdrag();

})

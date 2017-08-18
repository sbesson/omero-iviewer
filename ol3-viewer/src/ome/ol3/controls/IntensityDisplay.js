//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
goog.provide('ome.ol3.controls.IntensityDisplay');

goog.require('ol');
goog.require('ol.events');
goog.require('ol.events.EventType');
goog.require('ol.control.Control');
goog.require('ol.css');


/**
 * @classdesc
 * A control for intensity display.
 * It handles the request on mouse move
 *
 * @constructor
 */
ome.ol3.controls.IntensityDisplay = function() {
    /**
     * a handle for the setTimeout routine
     * @type {number}
     * @private
     */
    this.movement_handle_ = null;

    /**
     * a possible request prefix we need to include
     * @type {string}
     * @private
     */
    this.prefix_ = "";

    /**
     * the look of the intensity display
     * @type {string}
     * @private
     */
    this.style_ =
        "filter:alpha(opacity=55);-webkit-box-shadow:none;" +
        "box-shadow:none;opacity:.55;";

    /**
     * flag that controls whether we query the intensity or not
     * @type {boolean}
     * @private
     */
    this.query_intensity_ = false;

    /**
     * a reference to the Image instance
     * @type {ome.ol3.source.Image}
     * @private
     */
    this.image_ = null;

    /**
     * handle on the intensity toggle listener
     * @type {number}
     * @private
     */
    this.toggle_intensity_listener_ = null;

    /**
     * handle on the pointer move listener
     * @type {number}
     * @private
     */
    this.pointer_move_listener_ = null;

    // set up html
    var container =
        ome.ol3.controls.IntensityDisplay.prototype.createUiElements_.call(this);

    // call super
    ol.control.Control.call(this, {
        element: container
    });
};
ol.inherits(ome.ol3.controls.IntensityDisplay, ol.control.Control);

/**
 * Adds the UI elements to display the intensities and turn requests off
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.createUiElements_ = function() {
    var cssClasses =
        'ol-intensity ' + ol.css.CLASS_UNSELECTABLE + ' ' +
            ol.css.CLASS_CONTROL;

    // main container
    var element = document.createElement('div');
    element.className = cssClasses;

    var button = document.createElement('button');
    button.id = 'intensity-display-toggler';
    button.className ="btn btn-default";
    button.setAttribute('type', 'button');
    button.appendChild(document.createTextNode(""));
    button.title = 'Click to turn ON intensity querying';
    button.style = this.style_;

    this.toggle_intensity_listener_ =
        ol.events.listen(
            element, ol.events.EventType.CLICK,
            ome.ol3.controls.IntensityDisplay.prototype.toggleIntensityDisplay_.bind(this));

    element.appendChild(button);

    return element;
};

/**
 * Makes control start listening to mouse movements and display coordinates
 * Does not mean that it we start requesting intensity values
 * see {@link toggleIntensityDisplay_}
 * @param {string=} prefix the prefix for the intensity request
 */
ome.ol3.controls.IntensityDisplay.prototype.enable = function(prefix) {
    this.query_intensity_ = false;
    this.prefix_ = prefix || "";
    this.image_ = this.getMap().getLayers().item(0).getSource();
    this.pointer_move_listener_ =
        ol.events.listen(
            this.getMap(),
            ol.MapBrowserEventType.POINTERMOVE,
            ome.ol3.controls.IntensityDisplay.prototype.handlePointerMove_.bind(this));
}

/**
 * Stop listening to mouse movements (and querying intensities)
 */
ome.ol3.controls.IntensityDisplay.prototype.disable = function() {
    this.query_intensity_ = false;
    if (this.pointer_move_listener_) {
        ol.events.unlistenByKey(this.pointer_move_listener_);
        this.pointer_move_listener_ = null;
    }
    if (typeof this.movement_handle_ === 'number') {
        clearTimeout(this.movement_handle_);
        this.movement_handle_ = null;
    }
    this.image_ = null;
    var el = document.getElementById('intensity-display-toggler');
    if (el) {
        el.style = "";
        el.innerHTML = "";
    }
}

/**
 * Handles the pointer move
 * (display of coordinates and a potential triggering of the intensity request)
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.handlePointerMove_ = function(e) {
    var el = document.getElementById('intensity-display-toggler');
    var x = e.coordinate[0], y = -e.coordinate[1];
    if (x < 0 || x >= this.image_.getWidth() ||
        y < 0 || y >= this.image_.getHeight()) {
            el.innerHTML = "";
            return;
        }
    el.innerHTML = x.toFixed(0) + "," + y.toFixed(0);

    if (this.query_intensity_) {
        clearTimeout(this.movement_handle_);
        this.movement_handle_ = null;

        var activeChannels = this.image_.getChannels();
        if (activeChannels.length === 0) return;
        var reqParams = {
            "server" : this.image_.server_,
            "uri" : this.prefix_ + "/get_intensity/?image=" + this.image_.id_ +
                    "&z=" + this.image_.getPlane() +
                    "&t=" + this.image_.getTime() + "&x=" +
                    parseInt(x) + "&y=" + parseInt(y) + "&c=" +
                    activeChannels.join(','),
            "success" : function(resp) {console.info(resp)},
            "error" : function(err) {console.info(err)}
        };

        this.movement_handle_ = setTimeout(
            function() {
                ome.ol3.utils.Net.sendRequest(reqParams);
            }, 500);
    }
}

/**
 * Enables/Disables intensity display on pointerdrag
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.toggleIntensityDisplay_ = function() {
    // could be we have not been enabled before
    if (this.pointer_move_listener_ === null || this.image_ === null) {
        this.disable(); // just to make sure
        this.enable(this.prefix_);
    };

    var el = document.getElementById('intensity-display-toggler');
    if (this.query_intensity_) {
        this.query_intensity_ = false;
        el.title = "Click to turn ON intensity querying";
        el.style = this.style_;
    } else {
        this.query_intensity_ = true;
        el.title = "Click to turn OFF intensity querying";
        el.style = this.style_ + 'border-color: #000';
    }
    el.blur();
}

/**
 * sort of destructor
 */
ome.ol3.controls.IntensityDisplay.prototype.disposeInternal = function() {
    if (this.toggle_intensity_listener_)
        ol.events.unlistenByKey(this.toggle_intensity_listener_);
    this.disable();
};

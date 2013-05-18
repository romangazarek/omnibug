/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

if ( typeof Omnibug == "undefined" ) {
    dump( ">>>   OmnibugContext: creating new Omnibug object\n" );
    var Omnibug = {};
}

Omnibug.OmnibugContext = function( panel ) {
    dump( ">>>   OmnibugContext: constructor, panel=" + panel + "\n" );
};

/**
 * Toggle a row
 * @param {HTMLElement} el link clicked to toggle
 */
Omnibug.OmnibugContext.prototype.toggle = function( el ) {
    //dump( ">>>   OmnibugContext: toggle, el=" + el + "\n" );

    var i, img,
        tr = el.parentNode.parentNode,
        td = tr.getElementsByTagName( "td" ),
        div = tr.getElementsByTagName( "div" )[0];

    // change expand/collapse icon
    for( i=0; i<td.length; ++i ) {
        if( td[i].className.match( /exp/ ) ) {
           img = td[i].getElementsByTagName( "img" )[0];
           if( img ) {
               img.src = "chrome://omnibug/skin/twisty" + ( img.src.match( /Closed/ ) ? "Open" : "Closed" ) + ".png";
           }
        }
    }

    // hide/show the content div
    if( div.className.match( /hid/ ) ) {
        div.className = 'reg';
    } else {
        div.className = 'hid';
    }
}


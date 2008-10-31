/* ***** BEGIN LICENSE BLOCK *****;
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Initial Developer of the Original Code is Christoph Dorn.
 *
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *     Christoph Dorn <christoph@christophdorn.com>
 *     Ross Simpson <simpsora@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * $Id$
 * $URL$
 */


/**
 * @TODOs:
 *  - add pattern preference input box
 *  - re-read prefs button, or something (like a prefs change listener that re-init'd)
 *  - fix clear button weirdness
 *  - platform-specific images (not just win)
 *  - menu opt for alwaysExpand
 */

if( typeof FBL === "undefined" ) {
    FBL = { ns: function() {} }
}

// Components.classes helper
if( typeof( "CC" ) !== "function" ) {
    function CC( className ) {
        return Components.classes[className];
    }
}

// Components.interfaces helper
if( typeof( "CI" ) !== "function" ) {
    function CI( ifaceName ) {
        return Components.interfaces[ifaceName];
    }
}


FBL.ns( function() { with( FBL ) {

    // ************************************************************************************************
    // Constants

    try {
        const nsIWebProgressListener = CI( "nsIWebProgressListener" );
        const nsIWebProgress = CI( "nsIWebProgress" );
        const nsISupportsWeakReference = CI( "nsISupportsWeakReference" );
        const nsISupports = CI( "nsISupports" );
    } catch( ex ) {
        dump( ">>>   Error instantiating component interfaces: " + ex + "\n" );
    }

    const NOTIFY_STATE_DOCUMENT = nsIWebProgress.NOTIFY_STATE_DOCUMENT;
    const NOTIFY_ALL = nsIWebProgress.NOTIFY_ALL;

    const STATE_IS_WINDOW = nsIWebProgressListener.STATE_IS_WINDOW;
    const STATE_IS_DOCUMENT = nsIWebProgressListener.STATE_IS_DOCUMENT;
    const STATE_IS_REQUEST = nsIWebProgressListener.STATE_IS_REQUEST;
    const STATE_START = nsIWebProgressListener.STATE_START;
    const STATE_STOP = nsIWebProgressListener.STATE_STOP;
    const STATE_TRANSFERRING = nsIWebProgressListener.STATE_TRANSFERRING;


    Firebug.Omnibug = extend( Firebug.Module, {
        requests: {},
        messages: [],
        contextLoaded: false,
        outFile: null,
        latestOmnibugContext: null,
        win: null,
        defaultRegex: null,
        userRegex: null,
        usefulKeys: {},
        highlightKeys: {},
        alwaysExpand: false,

        /**
         * Supposedly called when the browser exits; doesn't seem to ever be called
         */
        shutdown: function() {
            dump( ">>>   shutdown\n" );
            if( Firebug.getPref( 'defaultPanelName' ) === 'Omnibug' ) {
                Firebug.setPref( 'defaultPanelName', 'console' );
            }
        },

        /**
         * Called when panels are selected
         */
        showPanel: function( browser, panel ) {
            dump( ">>>   showPanel: browser=" + browser + "; panel=" + panel + "\n" );
            var isOmnibug = panel && panel.name === "Omnibug";
            var OmnibugButtons = browser.chrome.$( "fbOmnibugButtons" );
            collapse( OmnibugButtons, !isOmnibug );
        },

        /**
         * Called when the clear button is pushed
         */
        clearPanel: function() {
            FirebugContext.getPanel("Omnibug").clear();
        },

        /**
         * Called once, at browser startup
         */
        initialize: function() {
            dump( ">>>   initialize: arguments=" + arguments + "\n" );

            // set default pref
            var defaultPattern = Omnibug.Tools.getPreference( "defaultPattern" );
            if( defaultPattern !== "/b/ss/|2o7|moniforce\.gif" ) {
                dump( ">>>   initialize: resetting defaultPattern preference\n" );
                Omnibug.Tools.setPreference( "defaultPattern", "/b/ss/|2o7|moniforce\.gif" );
            }

            // initialize prefs
            this.initPrefs();
        },

        /**
         * Initialize prefs
         *   this is called by initialize(), as well as other times when prefs may be changed and need to be re-read
         */
        initPrefs: function() {
            dump( ">>>   initPrefs: (re)initializing preferences\n" );

            // always expand preference
            this.alwaysExpand = Omnibug.Tools.getPreference( "alwaysExpand" );

            // init logging
            this.initLogging();

            // init request-matching patterns
            this.initPatterns();
        },

        /**
         * Init logging behavior
         */
        initLogging: function() {
            dump( ">>>   initLogging: arguments=" + arguments + "\n" );

            var fileOutput = Omnibug.Tools.getPreference( "enableFileLogging" );
            dump( ">>>   initLogging: fileOutput=" + fileOutput + "\n" );
            if( fileOutput ) {
                var prefFile;
                try {
                    prefFile = Omnibug.Tools.getPreference( "logFileName" );
                } catch( ex ) {}

                try {
                    if( prefFile ) {
                        dump( ">>>   initLogging: enabling logging to " + prefFile + "\n" );
                        this.outFile = FileIO.open( prefFile );
                    } else {
                        dump( ">>>   initLogging: enabling logging to default log file\n" );
                        var path = FileIO.getTmpDir();
                        var fn = "omnibug.log";
                        this.outFile = FileIO.append( path, fn );
                    }

                    var msg = "File logging enabled; requests will be written to " + this.outFile.path;
                    dump( ">>>   initLogging: " + msg + "\n" );
                    this.messages.push( msg );
                } catch( ex ) {
                    dump( ">>>   initLogging: unable to create output file: " + ex + "\n" );
                }
            } else {
                dump( ">>>   initLogging: logging is disabled.\n" );
                this.outFile = null;
            }
        },

        /**
         * Called when new page is going to be rendered
         */
        initContext: function( context ) {
            dump( ">>>   initContext: context=" + context + "\n" );
            monitorContext( context );
        },

        /**
         * Called just before old page is thrown away;
         */
        destroyContext: function( context ) {
            dump( ">>>   destroyContext: context=" + context + "\n" );

            this.latestOmnibugContext = undefined;
            this.contextLoaded = false;
            if( context.omNetProgress ) {
                unmonitorContext( context );
            }
        },

        /**
         * Called when page is completely finished loading
         */
        loadedContext: function( context ) {
            dump( ">>>   loadedContext: context=" + context + "\n" );

            // Makes detach work.
            if ( ! context.omnibugContext && this.latestOmnibugContext ) {
                context.omnibugContext = this.latestOmnibugContext;
            }

            this.contextLoaded = true;

            // dump any messages waiting
            while( this.messages.length ) {
                FirebugContext.getPanel("Omnibug").printLine( this.messages.shift() );
            }

            //dump( ">>>   loadedContext: calling processRequests\n" );
            this.processRequests();
        },

        /**
         * ?
         */
        reattachContext: function( context ) {
            dump( ">>>   reattachContext: context=" + context + "\n" );

            // Makes detach work.
            if ( ! FirebugContext.getPanel( "Omnibug" ).document.omnibugContext ) {
                // Save a pointer back to this object from the iframe's document:
                FirebugContext.getPanel( "Omnibug" ).document.omnibugPanel = FirebugContext.getPanel( "Omnibug" );
                FirebugContext.getPanel( "Omnibug" ).document.omnibugContext = FirebugContext.omnibugContext;
            }
        },

        /**
         * Called as page is rendering (?)
         */
        showContext: function( browser, context ) {
            dump( ">>>   showContext: browser=" + browser + "; context=" + context + "\n" );
        },

        /**
         * ?
         */
        watchContext: function( win, context, isSystem ) {
            dump( ">>>   watchContext: win=" + win + "; context=" + context + "; isSystem=" + isSystem + "\n" );
        },

        /**
         * Called when navigating away from a page
         */
        unwatchWindow: function( context, win ) {
            dump( ">>>   unwatchWindow: context=" + context + "; win=" + win + "\n" );
            this.win = null;
        },

        /**
         * Called when a new page is going to be watched (?)
         */
        watchWindow: function( context, win ) {
            dump( ">>>   watchWindow: win=" + win + "; context=" + context + "\n" );
            this.win = win;
        },

        /**
         * Called to process the requests object and write to panel
         */
        processRequests: function() {
            dump( ">>>   processRequests: processing requests: " + objDump( this.requests ) + "\n" );
            for( var key in this.requests ) {
                dump( ">>>   req=" + this.requests[key] + "\n" );
                if( this.requests.hasOwnProperty( key ) ) {
                    dump( ">>>   processRequests: processing " + key + "\n" );
                    FirebugContext.getPanel( "Omnibug" ).decodeUrl( this.requests[key], key );
                    delete this.requests[key];
                }
            }
        },

        /**
         * Tools menu handler
         */
        omnibugTools: function( menuitem ) {
            dump( ">>>   omnibugTools: label=" + menuitem.label + "\n" );

            if( menuitem.label === "Choose log file" ) {
                if( Omnibug.Tools.chooseLogFile( this.win ) ) {
                    // successfully picked a log file
                    dump( ">>>   omnibugTools: logFileName=" + Omnibug.Tools.getPreference( "logFileName" ) + "\n" );

                    this.initPrefs();
                }
            }
        },


        /**
         * Init and compile regex patterns for matching requests
         */
        initPatterns: function() {
            dump( ">>>   initPatterns: initing patterns from prefs\n" );
            var defaultPattern = Omnibug.Tools.getPreference( "defaultPattern" ),
                userPattern = Omnibug.Tools.getPreference( "userPattern" );

            this.defaultRegex = new RegExp( defaultPattern );

            if( userPattern ) {
                this.userRegex = new RegExp( userPattern );
            }

            // init useful keys
            var keyList = Omnibug.Tools.getPreference( "usefulKeys" );
            if( keyList ) {
                var parts = keyList.split( "," );
                for( var part in parts ) {
                    if( parts.hasOwnProperty( part ) ) {
                        this.usefulKeys[parts[part]] = 1;
                    }
                }
            }
            dump( ">>>   initPatterns: usefulKeys=" + objDump( this.usefulKeys ) + "\n" );

            // init highlight keys
            keyList = Omnibug.Tools.getPreference( "highlightKeys" );
            if( keyList ) {
                var parts = keyList.split( "," );
                for( var part in parts ) {
                    if( parts.hasOwnProperty( part ) ) {
                        this.highlightKeys[parts[part]] = 1;
                    }
                }
            }
            dump( ">>>   initPatterns: highlightKeys=" + objDump( this.highlightKeys ) + "\n" );

        }

    } );


    /**
     * Panel
     */
    function OmnibugPanel() {}
    OmnibugPanel.prototype = extend( Firebug.Panel, {
        name: "Omnibug",
        title: "Omnibug",
        searchable: false,
        editable: false,
        cur: {},
        other: [],
        props: [],
        vars: [],
        htmlOutput: false,

        /**
         * Initialize the panel. This is called when the Panel is activated and
         * whenever the browser document changes (new URL, reload).
         *
         * (this must override a method in Firebug)
         */
        initialize: function( context, doc ) {
            this.context = context;
            this.document = doc;
            this.panelNode = doc.createElement( "div" );
            this.panelNode.ownerPanel = this;
            this.panelNode.className = "panelNode panelNode-omnibug";
            doc.body.appendChild( this.panelNode );

            dump( ">>>   panel initialize: arguments=" + arguments + "\n" );
            if ( FirebugContext.omnibugContext ) {
                dump( ">>>   initialize: context already exists\n" );
                return;
            }

            // Create a context for this instance.
            FirebugContext.omnibugContext = new Omnibug.OmnibugContext( this );

            this.document.omnibugPanel = this;
            this.document.omnibugContext = FirebugContext.omnibugContext;
        },

        /*
         * Called whenever the panel comes into view. Like toggling between browser tabs.
         */
        show: function() {
            dump( ">>>   show: arguments=" + arguments + "\n" );

            this.latestOmnibugContext = FirebugContext.omnibugContext;  // save this to make detach work

            // There is only ONE DOCUMENT shared by all browser tabs. So if the user opens two
            // browser tabs, we have to restore the appropriate context when switching between tabs.
            this.document.omnibugContext = FirebugContext.omnibugContext;
        },

        printLine: function( msg ) {
          var el = this.document.createElement( "p" );
          el.className = "om";
          el.innerHTML = msg;
          this.panelNode.appendChild( el );
        },

        clear: function() {
            /*
            var tables = this.panelNode.getElementsByTagName( "table" );
            for( var i=0; i<tables.length; ++i ) {
                //tables[i].parentNode.removeChild( tables[i] ); // doesn't work for some reason
                // @TODO: really should remove these for memory's sake
                tables[i].style.display = "none";
            }
            */

            /*
             * works better than the above.  still have to click clear more than once occasionally.. not sure why this is.
             * using this.panelNode.parentNode removes too much; subsequent requests without a page refresh won't get logged.
             */
            var el = this.panelNode;
                    for( var i=0; i<el.childNodes.length; ++i ) {
                el.removeChild( el.childNodes[i] );
            }
        },

        appendHtml: function( data ) {
            //dump( ">>>   htmlOutput=" + OmnibugPanel.htmlOutput + "\n" );
            var str = "";
            //var elType = "<div>";

            // @TODO: figure out if html has already been output, and only send the link tag if not.
            str = "<head><link rel='stylesheet' type='text/css' href='chrome://omnibug/content/omnibug.css' /></head><body>\n";

            elType = "html";
            OmnibugPanel.htmlOutput = true;

            //dump( ">>> dumping html:\n\n>>>" + data + "\n\n" );

            var el = this.document.createElement( elType );
            el.innerHTML = str + data;
            this.panelNode.appendChild( el );
        },

        decodeUrl: function( req, key ) {
            dump( ">>> decodeUrl: processing key=" + key + "\n" );
            OmnibugPanel.cur = { request: req, key: key };
            OmnibugPanel.props = [];
            OmnibugPanel.other = [];
            OmnibugPanel.vars = [];

            var val,
                u = new OmniUrl( req.name );

            u.getQueryNames().forEach( function( n ) {
                if( n ) {
                    val = u.getFirstQueryValue( n ).replace( "<", "&lt;" );  // escape HTML in output HTML

                    if( n.match( /^c(\d+)$/ ) ) {
                        OmnibugPanel.props[RegExp.$1] = val;
                    } else if( n.match( /^v(\d+)$/ ) ) {
                        OmnibugPanel.vars[RegExp.$1] = val;
                    } else {
                        OmnibugPanel.other.push( [ n, val ] );
                    }
                }
            } );
            this.report();
        },

        report: function() {
            var i, el, cn, len, html, mf, expanderImage, expanderClass,
                tmp = "";

            if( Firebug.Omnibug.alwaysExpand ) {
                expanderClass = "reg";
                expanderImage = "chrome://omnibug/skin/win/twistyOpen.png";
            } else {
                expanderClass = "hid";
                expanderImage = "chrome://omnibug/skin/win/twistyClosed.png";
            }

            html  = "<table cellspacing='0' border='0' class='req'><tr>";
            html += "<td class='exp'><a href='#' onClick='document.omnibugContext.toggle( this )'><img src='" + expanderImage + "' /></a></td>";
            html += "<td><p>" + OmnibugPanel.cur.request.name + "</p><div class='" + expanderClass + "'>";

            // omniture props
            if( OmnibugPanel.props.length ) {
                html += "<dt>Props</dt>";
                for( i = 0, len = OmnibugPanel.props.length; i < len; ++i ) {
                    if( OmnibugPanel.props[i] ) {
                        cn = this.isHighlightable( "prop" + i ) ? "hilite" : "";
                        html += "<dd class='" + cn + " " + ( i % 2 === 0 ? 'even' : 'odd' ) + "'>prop" + i + '= ' + OmnibugPanel.props[i] + "</dd>\n";
                    }
                }
            }

            // omniture eVars
            if( OmnibugPanel.vars.length ) {
                html += "<dt>eVars</dt>";
                for( i = 0, len = OmnibugPanel.vars.length; i < len; ++i ) {
                    if( OmnibugPanel.vars[i] ) {
                        cn = this.isHighlightable( "eVar" + i ) ? "hilite" : "";
                        html += "<dd class='" + cn + " " + ( i % 2 === 0 ? 'even' : 'odd' ) + "'>eVar" + i + '= ' + OmnibugPanel.vars[i] + "</dd>\n";
                    }
                }
            }


            // everything else
            var otherNamed = {},
                otherOther = {};

            if( OmnibugPanel.other.length ) {
                for( i = 0, len = OmnibugPanel.other.length; i < len; ++i ) {
                    if( OmnibugPanel.other[i] ) {
                        if( Firebug.Omnibug.usefulKeys[OmnibugPanel.other[i][0]] ) {
                            otherNamed[OmnibugPanel.other[i][0]] = OmnibugPanel.other[i][1];
                        } else {
                            otherOther[OmnibugPanel.other[i][0]] = OmnibugPanel.other[i][1];
                        }
                    }
                }
            }

            i = 0;

            // useful omniture params
            for( el in otherNamed ) {
                if( otherNamed.hasOwnProperty( el ) ) {
                    cn = this.isHighlightable( el ) ? "hilite" : "";
                    tmp += "<dd class='" + cn + " " + ( ++i % 2 === 0 ? 'even' : 'odd' ) + "'>" + el + '= ' + otherNamed[el] + "</dd>\n";
                }
            }
            if( !! tmp ) {
                html += "<dt>Useful</dt>";
                html += tmp;
            }

            i = 0;
            tmp = "";

            for( el in otherOther ) {
                if( otherOther.hasOwnProperty( el ) ) {
                    cn = this.isHighlightable( el ) ? "hilite" : "";
                    if( el.match( /mfinfo/ ) ) {
                        mf += "<dd class='" + cn + " " + ( ++i % 2 === 0 ? "even" : "odd" ) + "'>" + el + "= " + otherOther[el] + "</dd>\n";
                    } else {
                        tmp += "<dd class='" + cn + " " + ( ++i % 2 === 0 ? "even" : "odd" ) + "'>" + el + "= " + otherOther[el] + "</dd>\n";
                    }
                }
            }

            // moniforce
            if( !! mf ) {
                html += "<dt>Moniforce</dt>";
                html += mf;
            }

            // everything else, really
            if( !! tmp ) {
                html += "<dt>Other</dt>";
                html += tmp;
            }

            html += "</div></td></tr></table>\n";

            //dump( ">>>   output html:\n\n\n" + html + "\n\n\n" );
            FirebugContext.getPanel("Omnibug").appendHtml( html );
        },

        // returns true when the given name is in the highlightKeys list
        isHighlightable: function( elName ) {
            return Firebug.Omnibug.highlightKeys[elName];
        },


        // Options menu

        // Called every time the options menu is opened
        getOptionsMenuItems: function() {
            return [
                this.optionMenu( "Enable File Logging", "enableFileLogging" ),
                this.optionMenu( "Always expand entries", "alwaysExpand" )
            ];
        },

        // Return an option menu item
        optionMenu: function( label, option ) {
            var value = Omnibug.Tools.getPreference( option );
            var updatePref = function( key, val ) {
                Omnibug.Tools.setPreference( key, val );
                Firebug.Omnibug.initPrefs();
            };
            // bindFixed is from Firebug. It helps to pass the args along.
            return { label: label, nol10n: true, type: "checkbox", checked: value, command: bindFixed( updatePref, Firebug, option, !value ) }
        }

    } );


    /**
     * NetProgress
     */
    function OmNetProgress( context ) {
        this.context = context;
    }

    OmNetProgress.prototype = {
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // nsISupports

        QueryInterface: function( iid ) {
            if(    iid.equals( nsIWebProgressListener )
                || iid.equals( nsISupportsWeakReference )
                || iid.equals( nsISupports ) ) {
                return this;
            }

            throw Components.results.NS_NOINTERFACE;
        },



        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // nsIWebProgressListener

        onStateChange: function( progress, request, flag, status ) {
            //dump( ">>>   onStateChange: name=" + request.name + "; progress=" + progress + "; request=" + request + "; flag=" + flag + "; status=" + status + "\n" );
            var key, file,
                om = Firebug.Omnibug;

            //dump( ">>>   onStateChange: key=" + Md5Impl.md5( request.name ) + " (" + request.name.substring( 0, 75 ) + ")" + "\n" );
            if( request.name.match( om.defaultRegex ) || ( om.userRegex && request.name.match( om.userRegex ) ) ) {
                //dump( ">>>   onStateChange pattern match: key=" + Md5Impl.md5( request.name ) + " (" + request.name.substring( 0, 75 ) + ")" + "\n" );
                if( ! this.seenReqs[request.name] ) {
                    this.seenReqs[request.name] = true;

                    key = Md5Impl.md5( request.name );
                    dump( ">>>   onStateChange:\n>>>\tname=" + request.name.substring( 0, 100 ) + "\n>>>\tflags=" + getStateDescription( flag ) + "\n>>>\tmd5=" + key + "\n\n" );

                    // write the request to the panel.  must happen here so beacons will be called
                    FirebugContext.getPanel( "Omnibug" ).decodeUrl( request, key );

                    // add to requests object only if the context has been loaded (e.g. dump requests added from the previous page)
                    if( Firebug.Omnibug.contextLoaded ) {
                        dump( ">>>   onStateChange: adding request to request list: " + objDump( Firebug.Omnibug.requests ) + "\n" );
                        Firebug.Omnibug.requests[key] = request;
                    }

                    // write to file, if defined
                    file = Firebug.Omnibug.outFile;
                    if( file !== null ) {
                        FileIO.write( file, new Date() + "\t" + key + "\t" + request.name + "\n", "a" );
                    }
                }
            }
        },

        seenReqs: {},
        stateIsRequest: false,
        onLocationChange: function() {},
        onProgressChange: function() {},
        onStatusChange : function() {},
        onSecurityChange : function() {},
        onLinkIconAvailable : function() {}
    };


    function monitorContext( context ) {
        //dump( ">>>   monitorContext: context=" + context + "\n" );
        if( !context.omNetProgress ) {
            context.omNetProgress = new OmNetProgress( context );

            context.browser.addProgressListener( context.omNetProgress, NOTIFY_ALL );
        }
    }

    function unmonitorContext( context ) {
        //dump( ">>>   unmonitorContext: context=" + context + "\n" );
        if( context.omNetProgress ) {
            if( context.browser.docShell ) {
                context.browser.removeProgressListener( context.omNetProgress, NOTIFY_ALL );
            }

            delete context.omNetProgress;
        }
    }

    /*
     * local helpers
     */
    function getStateDescription( flag ) {
        var state = "";
        if( flag & nsIWebProgressListener.STATE_START ) {
            state += "STATE_START ";
        } else if( flag & nsIWebProgressListener.STATE_REDIRECTING ) {
            state += "STATE_REDIRECTING ";
        } else if( flag & nsIWebProgressListener.STATE_TRANSFERRING ) {
            state += "STATE_TRANSFERRING ";
        } else if( flag & nsIWebProgressListener.STATE_NEGOTIATING ) {
            state += "STATE_NEGOTIATING ";
        } else if( flag & nsIWebProgressListener.STATE_STOP ) {
            state += "STATE_STOP ";
        }

        if( flag & nsIWebProgressListener.STATE_IS_REQUEST )  { state += "STATE_IS_REQUEST "; }
        if( flag & nsIWebProgressListener.STATE_IS_DOCUMENT ) { state += "STATE_IS_DOCUMENT "; }
        if( flag & nsIWebProgressListener.STATE_IS_NETWORK )  { state += "STATE_IS_NETWORK "; }
        if( flag & nsIWebProgressListener.STATE_IS_WINDOW )   { state += "STATE_IS_WINDOW "; }
        if( flag & nsIWebProgressListener.STATE_RESTORING )   { state += "STATE_RESTORING "; }
        if( flag & nsIWebProgressListener.STATE_IS_INSECURE ) { state += "STATE_IS_INSECURE "; }
        if( flag & nsIWebProgressListener.STATE_IS_BROKEN )   { state += "STATE_IS_BROKEN "; }
        if( flag & nsIWebProgressListener.STATE_IS_SECURE )   { state += "STATE_IS_SECURE "; }
        if( flag & nsIWebProgressListener.STATE_SECURE_HIGH ) { state += "STATE_SECURE_HIGH "; }
        if( flag & nsIWebProgressListener.STATE_SECURE_MED )  { state += "STATE_SECURE_MED "; }
        if( flag & nsIWebProgressListener.STATE_SECURE_LOW )  { state += "STATE_SECURE_LOW "; }

        return state;
    }

    var OmniUrl = function( url ) {
        this.url = url;
        this.parseUrl();
    };

    OmniUrl.prototype = (function() {
        var U = {
            hasQueryValue: function( key ) {
                return typeof this.query[key] !== 'undefined';
            },
            getFirstQueryValue: function( key ) {
                return this.query[key] ? this.query[key][0] : '';
            },
            getQueryValues: function( key ) {
                return this.query[key] ? this.query[key] : [];
            },
            getQueryNames: function() {
                var i, a = [];
                for( i in this.query ) {
                    a.push( i );
                }
                return a;
            },
            getLocation: function() {
                return this.location;
            },
            getParamString: function() {
                return this.paramString;
            },
            addQueryValue: function( key ) {
                if( ! this.hasQueryValue( key ) ) {
                    this.query[key] = [];
                }
                for( var i=1; i<arguments.length; ++i ) {
                    this.query[key].push( arguments[i] );
                }
            },
            decode: function( val ) {
                var retVal;
                try {
                    return val ? decodeURIComponent( val.replace( /\+/g, "%20" ) ) : val === 0 ? val : '';
                } catch( e ) {
                    return val;
                }
            },
            parseUrl: function() {
                var url = this.url;
                var pieces = url.split( '?' );
                var p2 = pieces[0].split( ';' );
                this.query = {};
                this.queryString = '';
                this.anchor = '';
                this.location = p2[0];
                this.paramString = ( p2[1] ? p2[1] : '' );
                if( pieces[1] ) {
                    var p3 = pieces[1].split( '#' );
                    this.queryString = p3[0];
                    this.anchor = ( p3[1] ? p3[1] : '' );
                }
                if( this.queryString ) {
                    var kvPairs = this.queryString.split( /&/ );
                    for( var i=0; i<kvPairs.length; ++i ) {
                        var kv = kvPairs[i].split( '=' );
                        this.addQueryValue( kv[0] ? this.decode( kv[0] ) : "", kv[1] ? this.decode( kv[1] ) : "" );
                    }
                }
            }
        };
        return U;
    } )();



    function objDump( obj ) {
        var str = "Object{ ";
        for( var key in obj ) {
            if( obj.hasOwnProperty( key ) ) {
                str += key + "=" + obj[key] + "; ";
            }
        }
        return str + "}";
    }


    Firebug.registerModule( Firebug.Omnibug );
    Firebug.registerPanel( OmnibugPanel );

}} );


if( typeof Omnibug.Tools == "undefined" ) {
    Omnibug.Tools = {};
}

Omnibug.Tools.chooseLogFile = function( win ) {
    dump( ">>>   chooseLogFile: win=" + win + "\n" );

    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance( nsIFilePicker );
    fp.init( win, "Choose log file location", nsIFilePicker.modeSave );
    fp.defaultString = "omnibug.log";

    var rv = fp.show();
    if( rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace ) {
        var path = fp.file.path;
        dump( ">>>   chooseLogFile: new path = " + path + "\n" );

        Omnibug.Tools.setPreference( "logFileName", path );
        Omnibug.Tools.setPreference( "enableFileLogging", true );

        dump( ">>>   chooseLogFile: set new path; get=" + Omnibug.Tools.getPreference( "logFileName" ) + "\n" );

        return true;
    }
    return false;
}


/*
 * Get preferences service
 */
Omnibug.Tools.getPrefsService = function() {
    var ps;

    try {
        ps = Components.classes['@mozilla.org/preferences-service;1']
                       .getService( Components.interfaces.nsIPrefBranch2 );
    } catch( ex ) {
        dump( ">>>   getPrefsService: error getting prefs service: " + ex + "\n" );
    }

    return ps;
}


/**
 * Gets a preference from the preference service
 */
Omnibug.Tools.getPreference = function( key ) {
    var ps = Omnibug.Tools.getPrefsService();

    key = "extensions.omnibug." + key;
    switch( ps.getPrefType( key ) ) {
        case Components.interfaces.nsIPrefBranch.PREF_STRING:
            return ps.getCharPref( key );
        case Components.interfaces.nsIPrefBranch.PREF_INT:
            return ps.getIntPref( key );
        case Components.interfaces.nsIPrefBranch.PREF_BOOL:
            return ps.getBoolPref( key );
    }
}

/**
 * Sets a preference
 */
Omnibug.Tools.setPreference = function( key, val ) {
    var ps = Omnibug.Tools.getPrefsService();

    key = "extensions.omnibug." + key;
    switch( ps.getPrefType( key ) ) {
        /*
        case Components.interfaces.nsIPrefBranch.PREF_STRING:
            ps.setCharPref( key, val);
            break;
        */
        case Components.interfaces.nsIPrefBranch.PREF_INT:
            ps.setIntPref( key, val );
            break;
        case Components.interfaces.nsIPrefBranch.PREF_BOOL:
            ps.setBoolPref( key, val );
            break;
        default:
            ps.setCharPref( key, val);
            break;
    }
}

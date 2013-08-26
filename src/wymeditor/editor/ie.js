/*jslint evil: true */
/*
 * WYMeditor : what you see is What You Mean web-based editor
 * Copyright (c) 2005 - 2009 Jean-Francois Hovinne, http://www.wymeditor.org/
 * Dual licensed under the MIT (MIT-license.txt)
 * and GPL (GPL-license.txt) licenses.
 *
 * For further information visit:
 *        http://www.wymeditor.org/
 *
 * File Name:
 *        jquery.wymeditor.explorer.js
 *        MSIE specific class and functions.
 *        See the documentation for more info.
 *
 * File Authors:
 *        Jean-Francois Hovinne (jf.hovinne a-t wymeditor dotorg)
 *        Bermi Ferrer (wymeditor a-t bermi dotorg)
 *        Frédéric Palluel-Lafleur (fpalluel a-t gmail dotcom)
 *        Jonatan Lundin (jonatan.lundin a-t gmail dotcom)
 */

WYMeditor.WymClassExplorer = function (wym) {
    this._wym = wym;
    this._class = "className";
};

WYMeditor.WymClassExplorer.prototype.initIframe = function (iframe) {
    //This function is executed twice, though it is called once!
    //But MSIE needs that, otherwise designMode won't work.
    //Weird.
    this._iframe = iframe;
    this._doc = iframe.contentWindow.document;

    //add css rules from options
    var styles = this._doc.styleSheets[0],
      aCss = eval(this._options.editorStyles),
      wym = this,
      ieVersion;

    this.addCssRules(this._doc, aCss);

    this._doc.title = this._wym._index;

    //set the text direction
    jQuery('html', this._doc).attr('dir', this._options.direction);

    //init html value
    jQuery(this._doc.body).html(this._wym._options.html);

    //handle events
    this._doc.body.onfocus = function () {
        wym._doc.body.contentEditable = "true";
        wym._doc = iframe.contentWindow.document;
    };
    this._doc.onbeforedeactivate = function () {
        wym.saveCaret();
    };
    jQuery(this._doc).bind('keyup', wym.keyup);
    // Workaround for an ie8 => ie7 compatibility mode bug triggered
    // intermittently by certain combinations of CSS on the iframe
    ieVersion = parseInt(jQuery.browser.version, 10);
    if (ieVersion >= 8 && ieVersion < 9) {
        jQuery(this._doc).bind('keydown', function () {
            wym.fixBluescreenOfDeath();
        });
    }
    this._doc.onkeyup = function () {
        wym.saveCaret();
    };
    this._doc.onclick = function () {
        wym.saveCaret();
    };

    /* this doesn't work for me.
     * TODO: look into it later :-)

    this._doc.body.onbeforepaste = function() {
        wym._iframe.contentWindow.event.returnValue = false;
    };

    this._doc.body.onpaste = function() {
        wym._iframe.contentWindow.event.returnValue = false;
        wym.paste(window.clipboardData.getData("Text"));
    };
    */

    //callback can't be executed twice, so we check
    if (this._initialized) {

        //pre-bind functions
        if (jQuery.isFunction(this._options.preBind)) {
            this._options.preBind(this);
        }


        //bind external events
        this._wym.bindEvents();

        //post-init functions
        if (jQuery.isFunction(this._options.postInit)) {
            this._options.postInit(this);
        }

        //add event listeners to doc elements, e.g. images
        this.listen();
    }

    this._initialized = true;

    //init designMode
    this._doc.designMode = "on";
    try {
        // (bermi's note) noticed when running unit tests on IE6
        // Is this really needed, it trigger an unexisting property on IE6
        this._doc = iframe.contentWindow.document;
    } catch (e) {}

    jQuery(this._element).trigger('wymeditor:iframe_loaded');
};

(function (editorLoadSkin) {
    WYMeditor.WymClassExplorer.prototype.loadSkin = function () {
        // Mark container items as unselectable (#203)
        // Fix for issue explained:
        // http://stackoverflow.com/questions/1470932/ie8-iframe-designmode-loses-selection
        jQuery(this._box).find(this._options.containerSelector).attr('unselectable', 'on');

        editorLoadSkin.call(this);
    };
}(WYMeditor.editor.prototype.loadSkin));

/**
    fixBluescreenOfDeath
    ====================

    In ie8 when using ie7 compatibility mode, certain combinations of CSS on
    the iframe will trigger a bug that causes the rendering engine to give all
    block-level editable elements a negative left position that puts them off of
    the screen. This results in the editor looking blank (just the blue background)
    and requires the user to move the mouse or manipulate the DOM to force a
    re-render, which fixes the problem.

    This workaround detects the negative position and then manipulates the DOM
    to cause a re-render, which puts the elements back in position.

    A real fix would be greatly appreciated.
*/
WYMeditor.WymClassExplorer.prototype.fixBluescreenOfDeath = function () {
    var position = jQuery(this._doc).find('p').eq(0).position();
    if (position !== null && typeof position !== 'undefined' && position.left < 0) {
        jQuery(this._box).append('<br id="wym-bluescreen-bug-fix" />');
        jQuery(this._box).find('#wym-bluescreen-bug-fix').remove();
    }
};


WYMeditor.WymClassExplorer.prototype._exec = function (cmd, param) {
    if (param) {
        this._doc.execCommand(cmd, false, param);
    } else {
        this._doc.execCommand(cmd);
    }
};

WYMeditor.WymClassExplorer.prototype.selected = function () {
    var caretPos = this._iframe.contentWindow.document.caretPos;
    if (caretPos) {
        if (caretPos.parentElement) {
            return caretPos.parentElement();
        }
    }
};

WYMeditor.WymClassExplorer.prototype.saveCaret = function () {
    this._doc.caretPos = this._doc.selection.createRange();
};

WYMeditor.WymClassExplorer.prototype.saveCaret = function () {
    this._doc.caretPos = this._doc.selection.createRange();
};

WYMeditor.WymClassExplorer.prototype.addCssRule = function (styles, oCss) {
    // IE doesn't handle combined selectors (#196)
    var selectors = oCss.name.split(','),
        i;
    for (i = 0; i < selectors.length; i++) {
        styles.addRule(selectors[i], oCss.css);
    }
};

WYMeditor.WymClassExplorer.prototype.insert = function (html) {

    // Get the current selection
    var range = this._doc.selection.createRange();

    // Check if the current selection is inside the editor
    if (jQuery(range.parentElement()).parents().is(this._options.iframeBodySelector)) {
        try {
            // Overwrite selection with provided html
            range.pasteHTML(html);
        } catch (e) {}
    } else {
        // Fall back to the internal paste function if there's no selection
        this.paste(html);
    }
};

WYMeditor.WymClassExplorer.prototype.wrap = function (left, right) {
    // Get the current selection
    var range = this._doc.selection.createRange();

    // Check if the current selection is inside the editor
    if (jQuery(range.parentElement()).parents().is(this._options.iframeBodySelector)) {
        try {
            // Overwrite selection with provided html
            range.pasteHTML(left + range.text + right);
        } catch (e) {}
    }
};

/**
    wrapWithContainer
    =================

    Wraps the passed node in a container of the passed type. Also, restores the
    selection to being after the node within its new container.

    @param node A DOM node to be wrapped in a container
    @param containerType A string of an HTML tag that specifies the container
                         type to use for wrapping the node.
*/
WYMeditor.WymClassExplorer.prototype.wrapWithContainer = function (node, containerType) {
    var wym = this._wym,
        $wrappedNode,
        selection,
        range;

    $wrappedNode = jQuery(node).wrap('<' + containerType + ' />');
    selection = rangy.getIframeSelection(wym._iframe);
    range = rangy.createRange(wym._doc);
    range.selectNodeContents($wrappedNode[0]);
    range.collapse();
    selection.setSingleRange(range);
};

WYMeditor.WymClassExplorer.prototype.unwrap = function () {
    // Get the current selection
    var range = this._doc.selection.createRange(),
        text;

    // Check if the current selection is inside the editor
    if (jQuery(range.parentElement()).parents().is(this._options.iframeBodySelector)) {
        try {
            // Unwrap selection
            text = range.text;
            this._exec('Cut');
            range.pasteHTML(text);
        } catch (e) {}
    }
};

WYMeditor.WymClassExplorer.prototype.keyup = function (evt) {
    //'this' is the doc
    var wym = WYMeditor.INSTANCES[this.title],
        container,
        defaultRootContainer,
        notValidRootContainers,
        name,
        parentName,
        forbiddenMainContainer = false;

    notValidRootContainers =
        wym.documentStructureManager.structureRules.notValidRootContainers;
    defaultRootContainer =
        wym.documentStructureManager.structureRules.defaultRootContainer;
    this._selected_image = null;

    // If the inputted key cannont create a block element and is not a command,
    // check to make sure the selection is properly wrapped in a container
    if (!wym.keyCanCreateBlockElement(evt.which) &&
            evt.which !== WYMeditor.KEY.CTRL &&
            evt.which !== WYMeditor.KEY.COMMAND &&
            !evt.metaKey &&
            !evt.ctrlKey) {

        container = wym.selected();
        selectedNode = wym.selection().focusNode;
        if (container && container.tagName) {
            name = container.tagName.toLowerCase();
        }
        if (container.parentNode) {
            parentName = container.parentNode.tagName.toLowerCase();
        }

        // Fix forbidden main containers
        if (wym.isForbiddenMainContainer(name)) {
            name = parentName;
            forbiddenMainContainer = true;
        }

        // Wrap text nodes and forbidden main containers with default root node
        // tags
        if (name === WYMeditor.BODY && selectedNode.nodeName === "#text") {
            // If we're in a forbidden main container, switch the selected node
            // to its parent node so that we wrap the forbidden main container
            // itself and not its inner text content
            if (forbiddenMainContainer) {
                selectedNode = selectedNode.parentNode;
            }
            wym.wrapWithContainer(selectedNode, defaultRootContainer);
            wym.fixBodyHtml();
        }
        $(wym._element).trigger('wymeditor:doc_html_updated', [wym, $(wym._doc.body).html()]);
    }

    // If we potentially created a new block level element or moved to a new one
    // then we should ensure that they're in the proper format
    if (evt.keyCode === WYMeditor.KEY.UP ||
            evt.keyCode === WYMeditor.KEY.DOWN ||
            evt.keyCode === WYMeditor.KEY.BACKSPACE ||
            evt.keyCode === WYMeditor.KEY.ENTER) {

        if (jQuery.inArray(name, notValidRootContainers) > -1 &&
                parentName === WYMeditor.BODY) {
            wym.switchTo(container, defaultRootContainer);
            wym.fixBodyHtml();
        }
    }
};

WYMeditor.WymClassExplorer.prototype.setFocusToNode = function (node, toStart) {
    var range = this._doc.selection.createRange();
    toStart = toStart ? true : false;

    range.moveToElementText(node);
    range.collapse(toStart);
    range.select();
    node.focus();
};

/* @name spaceBlockingElements
 * @description Insert <br> elements between adjacent blocking elements and
 * p elements, between block elements or blocking elements and after blocking
 * elements.
 */
WYMeditor.WymClassExplorer.prototype.spaceBlockingElements = function () {
    var blockingSelector = WYMeditor.BLOCKING_ELEMENTS.join(', '),

        $body = jQuery(this._doc).find('body.wym_iframe'),
        children = $body.children(),
        placeholderNode = WYMeditor.WymClassExplorer.PLACEHOLDER_NODE,
        $firstChild,
        $lastChild,
        blockSepSelector;

    // If we potentially created a new block level element or moved to a new
    // one, then we should ensure the container is valid and the formatting is
    // proper.
    if (wym.keyCanCreateBlockElement(evt.which)) {
        // If the selected container is a root container, make sure it is not a
        // different possible default root container than the chosen one.
        container = wym.selected();
        name = container.tagName.toLowerCase();
        if (container.parentNode) {
            parentName = container.parentNode.tagName.toLowerCase();
        }
        if (jQuery.inArray(name, notValidRootContainers) > -1 &&
                parentName === WYMeditor.BODY) {
            wym.switchTo(container, defaultRootContainer);
        }

        // Fix formatting if necessary
        wym.fixBodyHtml();
    }
};

/* @name paste
 * @description         Paste text into the editor below the carret,
 *                      used for "Paste from Word".
 * @param String str    String to insert, two or more newlines separates
 *                      paragraphs. May contain inline HTML.
 */
WYMeditor.WymClassExplorer.prototype.paste = function (str) {
    var container = this.selected(),
        html = '',
        paragraphs,
        focusNode,
        i,
        l;

    // Insert where appropriate
    if (container && container.tagName.toLowerCase() !== WYMeditor.BODY) {
        // No .last() pre jQuery 1.4
        //focusNode = jQuery(html).insertAfter(container).last()[0];
        paragraphs = jQuery(container).append(str);
        focusNode = paragraphs[paragraphs.length - 1];
    } else {
        // Split string into paragraphs by two or more newlines
        paragraphs = str.split(new RegExp(this._newLine + '{2,}', 'g'));

        // Build html
        for (i = 0, l = paragraphs.length; i < l; i++) {
            html += '<p>' +
                (paragraphs[i].split(this._newLine).join('<br />')) +
                '</p>';
        }

        paragraphs = jQuery(html, this._doc).appendTo(this._doc.body);
        focusNode = paragraphs[paragraphs.length - 1];
    }

    // And remove br (if editor was empty)
    jQuery('body > br', this._doc).remove();

    // Restore focus
    this.setFocusToNode(focusNode);
};

/*jslint evil: true */
/* global -$ */
"use strict";

WYMeditor.WymClassSafari = function (wym) {
    this._wym = wym;
    this._class = "class";
};

WYMeditor.WymClassSafari.prototype.initIframe = function (iframe) {
    var wym = this;

    wym._iframe = iframe;
    wym._doc = iframe.contentDocument;

    wym._doc.title = wym._wym._index;

    // Set the text direction
    jQuery('html', wym._doc).attr('dir', wym._options.direction);

    //init designMode
    this._doc.body.contentEditable = "true";

    //init html value
    this._html(this._wym._options.html);

    if (jQuery.isFunction(wym._options.preBind)) {
        wym._options.preBind(wym);
    }

    // Bind external events
    wym._wym.bindEvents();

    jQuery(wym._doc).bind("keydown", wym.keydown);
    jQuery(wym._doc).bind("keyup", wym.keyup);
    if (jQuery.isFunction(wym._options.postInit)) {
        wym._options.postInit(wym);
    }

    // Add event listeners to doc elements, e.g. images
    wym.listen();

    jQuery(wym._element).trigger(
        WYMeditor.EVENTS.postIframeInitialization,
        wym._wym
    );
};

WYMeditor.WymClassSafari.prototype._exec = function (cmd, param) {
    if (!this.selected()) {
        return false;
    }

    var container,
        $container,
        tagName,
        structureRules,
        noClassOrAppleSpan;

    if (param) {
        this._doc.execCommand(cmd, '', param);
    } else {
        this._doc.execCommand(cmd, '', null);
    }

    container = this.selected();
    if (container) {
        $container = jQuery(container);
        tagName = container.tagName.toLowerCase();

        // Wrap this content in the default root container if we're in the body
        if (tagName === WYMeditor.BODY) {
            structureRules = this.documentStructureManager.structureRules;
            this._exec(
                WYMeditor.FORMAT_BLOCK,
                structureRules.defaultRootContainer
            );
            this.fixBodyHtml();
        }

        // If the cmd was FORMAT_BLOCK, check if the block was moved outside
        // the body after running the command. If it was moved outside, move it
        // back inside the body. This was added because running FORMAT_BLOCK on
        // an image inserted outside of a container was causing it to be moved
        // outside the body (See issue #400).
        if (cmd === WYMeditor.FORMAT_BLOCK &&
            $container.siblings('body.wym_iframe').length) {

            $container.siblings('body.wym_iframe').append(container);
        }

        // If the container is a span, strip it out if it doesn't have a class
        // but has an inline style of 'font-weight: normal;'.
        if (tagName === 'span') {
            noClassOrAppleSpan = !$container.attr('class') ||
                $container.attr('class').toLowerCase() === 'apple-style-span';
            if (noClassOrAppleSpan &&
                $container.attr('style') === 'font-weight: normal;') {

                $container.contents().unwrap();
            }
        }
    }

    return true;
};

//keydown handler, mainly used for keyboard shortcuts
WYMeditor.WymClassSafari.prototype.keydown = function (e) {
    //'this' is the doc
    var wym = WYMeditor.INSTANCES[this.title];

    if (e.ctrlKey) {
        if (e.which === WYMeditor.KEY.B) {
            //CTRL+b => STRONG
            wym._exec(WYMeditor.BOLD);
            e.preventDefault();
        }
        if (e.which === WYMeditor.KEY.I) {
            //CTRL+i => EMPHASIS
            wym._exec(WYMeditor.ITALIC);
            e.preventDefault();
        }
    } else if (e.shiftKey && e.which === WYMeditor.KEY.ENTER) {
        // Safari 4 and earlier would show a proper linebreak in the editor and
        // then strip it upon save with the default action in the case of
        // inserting a new line after bold text
        wym._exec('InsertLineBreak');
        e.preventDefault();
    }
};

// Keyup handler, mainly used for cleanups
WYMeditor.WymClassSafari.prototype.keyup = function (evt) {
    //'this' is the doc
    var wym = WYMeditor.INSTANCES[this.title],
        container,
        defaultRootContainer,
        notValidRootContainers,
        name,
        parentName;

    notValidRootContainers =
        wym.documentStructureManager.structureRules.notValidRootContainers;
    defaultRootContainer =
        wym.documentStructureManager.structureRules.defaultRootContainer;
    wym._selectedImage = null;

    // Fix to allow shift + return to insert a line break in older safari
    if (jQuery.browser.version < 534.1) {
        // Not needed in AT MAX chrome 6.0. Probably safe earlier
        if (evt.which === WYMeditor.KEY.ENTER && evt.shiftKey) {
            wym._exec('InsertLineBreak');
        }
    }

    // If the inputted key cannont create a block element and is not a command,
    // check to make sure the selection is properly wrapped in a container
    if (!wym.keyCanCreateBlockElement(evt.which) &&
            evt.which !== WYMeditor.KEY.CTRL &&
            evt.which !== WYMeditor.KEY.COMMAND &&
            !evt.metaKey &&
            !evt.ctrlKey) {

        container = wym.selected();
        name = container ? container.tagName.toLowerCase() : 'body';
        if (container && container.parentNode) {
            parentName = container.parentNode.tagName.toLowerCase();
        }

        // Fix forbidden main containers
        if (wym.isForbiddenMainContainer(name)) {
            name = parentName;
        }

        // Replace text nodes with default root tags and make sure the
        // container is valid if it is a root container
        if (name === WYMeditor.BODY ||
                (jQuery.inArray(name, notValidRootContainers) > -1 &&
                parentName === WYMeditor.BODY)) {

            wym._exec(WYMeditor.FORMAT_BLOCK, defaultRootContainer);
            wym.fixBodyHtml();
        }
    }

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
            wym._exec(WYMeditor.FORMAT_BLOCK, defaultRootContainer);
        }

        // Fix formatting if necessary
        wym.fixBodyHtml();
    }

    jQuery(wym._element)
      .trigger(
          WYMeditor.EVENTS.documentHTMLUpdated,
          [wym, jQuery(wym._doc.body).html()]
      );
};


// ==UserScript==
// @name         KawaiiDiscord
// @namespace    https://files.noodlebox.moe/
// @downloadURL  https://files.noodlebox.moe/userscripts/KawaiiDiscord.user.js
// @version      0.7.4
// @description  Break SFMLab Chat (now for Discord!)
// @author       noodlebox
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @match        *://discordapp.com/channels/*
// @match        *://discordapp.com/invite/*
// @match        *://canary.discordapp.com/channels/*
// @match        *://canary.discordapp.com/invite/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function ($) {
    "use strict";

    // Emote data
    var EmoteSet = function () {
        this.emoteMap = new Map();
        this.rollTables = new Map();
        this.template = "";
        this.caseSensitive = true;
        this.rolls = false;
        this.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    };
    // emoteStyle enum
    EmoteSet.emoteStyle = {
        STANDARD: 0, // Surrounded by ":"
        TWITCH: 1, // Composed of "word characters" (\w)
    };
    // template field names enum
    EmoteSet.templateField = {
        PATH: 0, // The unique path component for this emote name
        SIZE: 1, // emote size, usually a single digit between 1 and 4
    };
    EmoteSet.prototype.load = $.noop;
    EmoteSet.prototype.getUrl = function (emoteName, seed) {
        if (!this.caseSensitive) {
            emoteName = emoteName.toLowerCase();
        }
        if (this.rolls && emoteName.endsWith("#")) {
            var prefix = emoteName.slice(0, -1);
            var table = this.rollTables.get(prefix);
            if (table === undefined) {
                return undefined;
            }
            if (seed === undefined || seed === 0) {
                emoteName = this.rollDefault;
            } else {
                emoteName = table[seed % table.length];
            }
        }
        var path = this.emoteMap.get(emoteName);
        if (path === undefined) {
            return undefined;
        }
        return this.template.replace(/{(\d+)}/g, function (match, field) {
            switch (Number(field)) {
                case EmoteSet.templateField.PATH:
                    return path;
                case EmoteSet.templateField.SIZE:
                    return "1";
                default:
                    return match;
            }
        });
    };
    // Create and return an emote element, or undefined if no match found
    EmoteSet.prototype.createEmote = function (emoteName, seed) {
        var emoteURL = this.getUrl(emoteName, seed);
        if (emoteURL === undefined) {
            return undefined;
        }
        if (this.emoteStyle === EmoteSet.emoteStyle.STANDARD) {
            emoteName = ":"+emoteName+":";
        }
        // TODO: Apply special style to rolled emotes
        var emote = $("<img>", {
            src: emoteURL,
            draggable: "false",
            alt: emoteName,
            title: emoteName,
            class: "emoji kawaii-parseemotes",
        });
        return emote;
    };

    // Filter function for "Twitch-style" emotes, to avoid collisions with common words
    // Check if at least 3 word characters, and has at least one capital letter
    // Based on current FFZ naming requirements (older FFZ emotes may not satisfy these requirements)
    // See: https://www.frankerfacez.com/emoticons/submit
    function emoteFilter(name) {
        return (/^\w{3,}$/.test(name) && /[A-Z]/.test(name));
    }

    // Global Twitch emotes (emoteset 0), filtered by emoteFilter
    var twitchEmotes = new EmoteSet();
    twitchEmotes.template = "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0";
    twitchEmotes.emoteStyle = EmoteSet.emoteStyle.TWITCH;
    twitchEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
        $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0", {
            accepts: {json: "application/vnd.twitchtv.v3+json"},
            headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticon_sets[0].forEach(function (emoticon) {
                    if (emoteFilter(emoticon.code)) {
                        self.emoteMap.set(emoticon.code, emoticon.id);
                        loaded++;
                    } else {
                        skipped++;
                    }
                });
                console.info("KawaiiDiscord:", "Twitch global emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch global emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // Twitch subscriber emotes, filtered by emoteFilter
    var twitchSubEmotes = new EmoteSet();
    twitchSubEmotes.template = "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0";
    twitchSubEmotes.emoteStyle = EmoteSet.emoteStyle.TWITCH;
    twitchSubEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
        $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images", {
            accepts: {json: "application/vnd.twitchtv.v3+json"},
            headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticons.forEach(function (emoticon) {
                    if (emoticon.emoticon_set !== 0 && emoteFilter(emoticon.code)) {
                        self.emoteMap.set(emoticon.code, emoticon.id);
                        loaded++;
                    } else {
                        skipped++;
                    }
                });
                console.info("KawaiiDiscord:", "Twitch subscriber emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch subscriber emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // SFMLab emotes, now with more rolling than ever!
    var sfmlabEmotes = new EmoteSet();
    sfmlabEmotes.template = "https://sfmlab.com/static/emoji/img/{0}";
    sfmlabEmotes.caseSensitive = false;
    sfmlabEmotes.rolls = true;
    sfmlabEmotes.rollDefault = "mikeroll";
    sfmlabEmotes.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    sfmlabEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        $.ajax("https://sfmlab.com/emoji_json/", {
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                self.template = data.template;
                data.emotes.forEach(function (emote) {
                    var fixName = emote.name.toLowerCase();
                    self.emoteMap.set(fixName, emote.url);
                    loaded++;
                    // Build roll tables
                    var prefix = /^(.*\D)?\d*$/.exec(fixName)[1];
                    if (prefix !== undefined) {
                        var table = self.rollTables.get(prefix);
                        if (table === undefined) {
                            table = [];
                            self.rollTables.set(prefix, table);
                        }
                        table.push(fixName);
                    }
                });
                // Original data may come in unsorted, so sort here to ensure consistency
                self.rollTables.forEach(function(v) {v.sort();});
                console.info("KawaiiDiscord:", "SFMLab emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch subscriber emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // This is super hackish, and will likely break as Discord's internal API changes
    // Anything using this or what it returns should be prepared to catch some exceptions
    function getInternalProps(e) {
        try {
            var reactInternal = e[Object.keys(e).filter(k => k.startsWith("__reactInternalInstance"))[0]];
            return reactInternal._currentElement._owner._instance.props;
        } catch (err) {
            return undefined;
        }
    }

    // Get a consistent, but unpredictable index from the message snowflake ID
    // See: https://github.com/twitter/snowflake/tree/snowflake-2010#solution
    function getMessageSeed(e) {
        try {
            // Shift (roughly) 22 bits (10^3 ~ 2^10)
            // All numbers in JS are 64-bit floats, so this is necessary to avoid a huge loss of precision
            return Number(getInternalProps(e).message.id.slice(0, -6)) >>> 2;
        } catch (err) {
            // Something (not surprisingly) broke, but this isn't critical enough to completely bail over
            console.error("getMessageSeed:", e, err);
            return 0;
        }
    }

    // jQuery Plugins

    // Get or set the scroll distance from the bottom of an element
    // Usage identical to scrollTop()
    $.fn.scrollBottom = function (val) {
        var elem = this[0];
        if (val === undefined) {
            if (elem === undefined) {
                return undefined;
            }
            return elem.scrollHeight - (this.scrollTop() + this.height());
        }
        if (elem === undefined) {
            return this;
        }
        return this.scrollTop(elem.scrollHeight - (val + this.height()));
    };

    // Get the set of text nodes contained within a set of elements
    $.fn.textNodes = function () {
        return this.map(function () {
            const textNodes = [];
            let textNodeWalker, currentNode;

            if ($(this).find("code").length > 0) {
                // If there are any code blocks, rejecting that whole subtree is a bit faster
                textNodeWalker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
                    acceptNode: function (node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        if (node.nodeName.toLowerCase() === "code") {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    }
                });
            } else {
                textNodeWalker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
            }

            while ((currentNode = textNodeWalker.nextNode()) !== null) {
                textNodes.push(currentNode);
            }
            return textNodes;
        });
    };


    // Parse for standard emotes in message text
    $.fn.parseEmotesStandard = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        this.textNodes().each(function () {
            var sub = [];
            // separate out potential emotes
            // all standard emotes are composed of characters in [a-zA-Z0-9_], i.e. \w between two colons, :
            // use a regex with a capture group, so that we can preserve separators
            var words = this.data.split(/(:[\w#*]+:)/g);
            // non-emoteable words, for building a new text node if necessary
            var nonEmote = [];
            // whether the text in this node has been modified
            var modified = false;

            var seed = 0;
            var message = $(this).closest(".message").not(".message-sending");
            // Don't look up the useless id for messages being sent
            if (message.length !== 0) {
                // Get a seed for rolls
                seed = getMessageSeed(message[0]);
            }

            for (var i = 0; i < words.length; i += 2) {
                // words[i] is a separator
                // words[i+1] is our potential emote, or undefined

                // Keep the separator
                nonEmote.push(words[i]);
                if (words[i+1] === undefined) {
                    break;
                }

                var emote;
                for (var set of emoteSets) {
                    emote = set.createEmote(/^:([^:]+):$/.exec(words[i+1])[1], seed);
                    if (emote !== undefined) {
                        break;
                    }
                }
                if (emote !== undefined) {
                    modified = true;
                    // Create a new text node from any previous text
                    sub.push(document.createTextNode(nonEmote.join("")));
                    // Clear out stored words
                    nonEmote = [];
                    // Add the emote element
                    sub.push(emote);
                } else {
                    // Unrecognized as emote, keep the word
                    nonEmote.push(words[i+1]);
                }
            }
            // If no emotes were found, leave this text node unchanged
            if (modified) {
                // Replace this node's contents with remaining text
                this.data = nonEmote.join("");
            }
            $(this).before(sub);
        });

        return this;
    };

    // Parse for Twitch-style emotes in message text
    $.fn.parseEmotesTwitch = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        // Find and replace Twitch-style emotes
        // This requires picking apart text nodes more carefully
        this.textNodes().each(function () {
            var sub = [];
            // separate out potential emotes
            // all twitch emotes (that we care about) are composed of characters in [a-zA-Z0-9_], i.e. \w
            // use a regex with a capture group, so that we can preserve separators
            var words = this.data.split(/(\W+)/g);
            // non-emoteable words, for building a new text node if necessary
            var nonEmote = [];
            // whether the text in this node has been modified
            var modified = false;
            for (var i = 0; i < words.length; i += 2) {
                // words[i] is our potential emote
                // words[i+1] is a separator, or undefined
                var emote;
                for (var set of emoteSets) {
                    emote = set.createEmote(words[i]);
                    if (emote !== undefined) {
                        break;
                    }
                }
                if (emote !== undefined) {
                    modified = true;
                    // Create a new text node from any previous text
                    sub.push(document.createTextNode(nonEmote.join("")));
                    // Clear out stored words
                    nonEmote = [];
                    // Add the emote element
                    sub.push(emote);
                } else {
                    // Unrecognized as emote, keep the word
                    nonEmote.push(words[i]);
                }
                // Keep the separator
                nonEmote.push(words[i+1]);
            }
            // If no emotes were found, leave this text node unchanged
            if (modified) {
                // Replace this node's contents with remaining text
                this.data = nonEmote.join("");
            }
            $(this).before(sub);
        });

        return this;
    };

    // Parse emotes (of any style) in message text
    $.fn.parseEmotes = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        var standardSets = [];
        var twitchSets = [];
        for (var set of emoteSets) {
            if (set.emoteStyle === EmoteSet.emoteStyle.STANDARD) {
                standardSets.push(set);
            } else if (set.emoteStyle === EmoteSet.emoteStyle.TWITCH) {
                twitchSets.push(set);
            }
        }

        // Process messages for emote replacements
        this.parseEmotesStandard(standardSets).parseEmotesTwitch(twitchSets);

        // Properly jumboify emotes/emoji in messages with no other text
        this.not(".topic-expandable").has(".emoji").each(function () {
            // Get the "edited" text, if any, regardless of how it's styled or localized
            var edited = $(this).find(".edited").text();
            // Get the remaining message text
            var text = this.textContent.replace(edited, "").trim();
            if (text.length === 0) {
                $(this).find(".emoji").addClass("jumboable");
            } else {
                $(this).find(".emoji").removeClass("jumboable");
            }
        });

        return this;
    };

    // Replace title text with fancy tooltips
    $.fn.fancyTooltip = function () {
        return this.filter("[title]").each(function () {
            var title = $(this).attr("title");
            $(this).addClass("kawaii-fancytooltip").removeAttr("title");
            $(this).on("mouseover.fancyTooltip", function () {
                // Create and insert tooltip
                var tooltip = $("<div>").append(title).addClass("tooltip tooltip-top tooltip-normal");
                $(".tooltips").append(tooltip);

                // Position the tooltip
                var position = $(this).offset();
                position.top -= 30;
                position.left += $(this).width()/2 - tooltip.width()/2 - 10;
                tooltip.offset(position);

                // Set a handler to destroy the tooltip
                $(this).on("mouseout.fancyTooltip", function () {
                    // remove this handler
                    $(this).off("mouseout.fancyTooltip");
                    tooltip.remove();
                });
            });
        });
    };

    // Helper function for finding all elements matching selector affected by a mutation
    function mutationFind(mutation, selector) {
        var target = $(mutation.target), addedNodes = $(mutation.addedNodes);
        var mutated = target.add(addedNodes).filter(selector);
        var descendants = addedNodes.find(selector);
        var ancestors = target.parents(selector);
        return mutated.add(descendants).add(ancestors);
    }

    // Helper function for finding all elements matching selector removed by a mutation
    function mutationFindRemoved(mutation, selector) {
        var removedNodes = $(mutation.removedNodes);
        var mutated = removedNodes.filter(selector);
        var descendants = removedNodes.find(selector);
        return mutated.add(descendants);
    }

    // Attach observer to start triggering mutations
    function startObserver(observer) {
        // Get main app area and popouts
        for (let target of document.querySelectorAll([
                ".theme-dark",
                ".theme-light",
                ".theme-dark+span",
                ".theme-light+span",
        ].join(","))) {
            observer.observe(target, { childList:true, subtree:true });
        }
    }

    // Detach observer to stop triggering mutations
    function stopObserver(observer) {
        observer.disconnect();
    }

    // Watch for new chat messages
    var chat_observer = new MutationObserver(function (mutations, observer) {
        // Ignore changes made here
        stopObserver(observer);
        // Figure out whether we're scrolled to the bottom
        var messagesContainer = $(".messages");
        var atBottom = messagesContainer.scrollBottom() < 0.5;

        mutations.forEach(function (mutation) {
            // Get the set of messages and/or topic area affected by this mutation
            var messages = mutationFind(mutation, [
                    ".markup",
                    ".message-content",
                    ".topic-expandable",
                    ".markdown-modal.selectable",
            ].join(",")).not(":has(.message-content)");
            // Process messages
            messages.parseEmotes([sfmlabEmotes, twitchEmotes, twitchSubEmotes]).find(".kawaii-parseemotes").fancyTooltip();

            // Clean up any remaining tooltips
            mutationFindRemoved(mutation, ".kawaii-fancytooltip").trigger("mouseout.fancyTooltip");
        });

        // Ensure we're still scrolled to the bottom if necessary
        if (atBottom) {
            messagesContainer.scrollBottom(0);
        }
        // Resume observer
        startObserver(observer);
    });

    function parseEmoteSet(set) {
        // Ignore changes made here
        stopObserver(chat_observer);
        // Get the set of all messages and topic area
        var messages = $([
                    ".markup",
                    ".message-content",
                    ".topic-expandable",
                    ".markdown-modal.selectable",
            ].join(",")).not(":has(.message-content)");
        // Process messages
        messages.parseEmotes([set]).find(".kawaii-parseemotes").fancyTooltip();
        // Resume observer
        startObserver(chat_observer);
    }

    twitchEmotes.load({success: parseEmoteSet});
    //twitchSubEmotes.load({success: parseEmoteSet});
    sfmlabEmotes.load({success: parseEmoteSet});

    startObserver(chat_observer);
})(jQuery.noConflict(true));

// vim: et:ts=4:sw=4:sts=4

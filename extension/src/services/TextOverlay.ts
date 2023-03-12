import Overlay, { OverlayOptions } from './Overlay';

export enum OffsetAnchor {
    bottom,
    top,
}

export class TextOverlay {
    private readonly _overlay: Overlay;

    // private readonly nonFullscreenContainerClassName: string;
    // private readonly nonFullscreenContentClassName: string;
    // private readonly fullscreenContainerClassName: string;
    // private readonly fullscreenContentClassName: string;
    private readonly _offsetAnchor: OffsetAnchor = OffsetAnchor.bottom;

    // private fullscreenContainerElement?: HTMLElement;
    // private fullscreenContentElement?: HTMLElement;
    // private nonFullscreenContainerElement?: HTMLElement;
    // private nonFullscreenContentElement?: HTMLElement;
    // private nonFullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private _stylesInterval?: NodeJS.Timer;
    // private nonFullscreenElementFullscreenPollingInterval?: NodeJS.Timer;
    // private fullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    // private fullscreenElementFullscreenPollingInterval?: NodeJS.Timer;

    contentPositionOffset: number = 75;

    constructor(targetElement: HTMLElement, overlayOptions: OverlayOptions, offsetAnchor: OffsetAnchor) {
        // this.targetElement = targetElement;
        // this.nonFullscreenContainerClassName = nonFullscreenContainerClassName;
        // this.nonFullscreenContentClassName = nonFullscreenContentClassName;
        // this.fullscreenContainerClassName = fullscreenContainerClassName;
        // this.fullscreenContentClassName = fullscreenContentClassName;
        this._overlay = new Overlay(targetElement, {
            ...overlayOptions,
            onNonFullscreenContainerElementCreated: (container) => {
                this._applyNonFullscreenStyles(container);

                if (this._stylesInterval) {
                    clearInterval(this._stylesInterval);
                }

                this._stylesInterval = setInterval(() => this._applyNonFullscreenStyles(container), 1000);
            },
            onFullscreenContainerElementCreated: (container) => this._applyFullscreenStyles(container),
        });
        this._offsetAnchor = offsetAnchor;
    }

    setHtml(html: string) {
        this._overlay.setHtml(html);
        // this._nonFullscreenContentElement().innerHTML = `${html}\n`;
        // this._fullscreenContentElement().innerHTML = `${html}\n`;
    }

    appendHtml(html: string) {
        this._overlay.appendHtml(html);
        // const currentHtml = this._nonFullscreenContentElement().innerHTML;
        // const newHtml = currentHtml && currentHtml.length > 0 ? currentHtml + '<br>' + html : html;
        // this._nonFullscreenContentElement().innerHTML = `${newHtml}\n`;
        // this._fullscreenContentElement().innerHTML = `${newHtml}\n`;
    }

    refresh() {
        if (this._overlay.fullscreenContainerElement) {
            this._applyFullscreenStyles(this._overlay.fullscreenContainerElement);
        }

        if (this._overlay.nonFullscreenContainerElement) {
            this._applyNonFullscreenStyles(this._overlay.nonFullscreenContainerElement);
        }
    }

    hide() {
        if (this._stylesInterval) {
            clearInterval(this._stylesInterval);
        }

        this._overlay.hide();
        // if (this.overlay.nonFullscreenContentElement) {
        //     if (this.nonFullscreenElementFullscreenChangeListener) {
        //         document.removeEventListener('fullscreenchange', this.nonFullscreenElementFullscreenChangeListener);
        //     }

        //     if (this.stylesInterval) {
        //         clearInterval(this.stylesInterval);
        //     }

        //     if (this.nonFullscreenElementFullscreenPollingInterval) {
        //         clearInterval(this.nonFullscreenElementFullscreenPollingInterval);
        //     }

        //     this.nonFullscreenContentElement.remove();
        //     this.nonFullscreenContainerElement?.remove();
        //     this.nonFullscreenContainerElement = undefined;
        //     this.nonFullscreenContentElement = undefined;
        // }

        // if (this.fullscreenContentElement) {
        //     if (this.fullscreenElementFullscreenChangeListener) {
        //         document.removeEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
        //     }

        //     if (this.fullscreenElementFullscreenPollingInterval) {
        //         clearInterval(this.fullscreenElementFullscreenPollingInterval);
        //     }

        //     this.fullscreenContentElement.remove();
        //     this.fullscreenContainerElement?.remove();
        //     this.fullscreenContainerElement = undefined;
        //     this.fullscreenContentElement = undefined;
        // }
    }

    private _applyNonFullscreenStyles(container: HTMLElement) {
        const rect = this._overlay.targetElement.getBoundingClientRect();
        container.style.left = rect.left + rect.width / 2 + 'px';
        container.style.maxWidth = rect.width + 'px';

        if (this._offsetAnchor === OffsetAnchor.bottom) {
            // There doesn't seem to be a way to calculate the correct bottom offset.
            // Instead, use a large offset from the top.
            container.style.top = rect.top + rect.height + window.scrollY - this.contentPositionOffset + 'px';
            container.style.bottom = '';
        } else {
            container.style.top = rect.top + window.scrollY + this.contentPositionOffset + 'px';
            container.style.bottom = '';
        }
    }

    // private _fullscreenContentElement(): HTMLElement {
    //     if (this.fullscreenContentElement) {
    //         return this.fullscreenContentElement;
    //     }

    //     const div = document.createElement('div');
    //     const container = document.createElement('div');
    //     container.appendChild(div);
    //     container.className = this.fullscreenContainerClassName;
    //     div.className = this.fullscreenContentClassName;
    //     this._applyFullscreenStyles(container);
    //     this._findFullscreenParentElement(container).appendChild(container);
    //     container.style.display = 'none';
    //     const that = this;

    //     function toggle() {
    //         if (document.fullscreenElement && container.style.display === 'none') {
    //             container.style.display = '';
    //             container.remove();
    //             that._findFullscreenParentElement(container).appendChild(container);
    //         } else if (!document.fullscreenElement) {
    //             container.style.display = 'none';
    //         }
    //     }

    //     toggle();
    //     this.fullscreenElementFullscreenChangeListener = (e) => toggle();
    //     this.fullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
    //     document.addEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
    //     this.fullscreenContentElement = div;
    //     this.fullscreenContainerElement = container;

    //     return this.fullscreenContentElement;
    // }

    private _applyFullscreenStyles(container: HTMLElement) {
        container.style.maxWidth = '100%';

        if (this._offsetAnchor === OffsetAnchor.bottom) {
            container.style.top = '';
            container.style.bottom = this.contentPositionOffset + 'px';
        } else {
            container.style.top = this.contentPositionOffset + 'px';
            container.style.bottom = '';
        }
    }

    // private _findFullscreenParentElement(container: HTMLElement): HTMLElement {
    //     const testNode = container.cloneNode(true) as HTMLElement;
    //     testNode.innerHTML = '&nbsp;'; // The node needs to take up some space to perform test clicks
    //     let current = this.targetElement.parentElement;

    //     if (!current) {
    //         return document.body;
    //     }

    //     let chosen: HTMLElement | undefined = undefined;

    //     do {
    //         const rect = current.getBoundingClientRect();

    //         if (
    //             rect.height > 0 &&
    //             (typeof chosen === 'undefined' ||
    //                 // Typescript is not smart enough to know that it's possible for 'chosen' to be defined here
    //                 rect.height >= (chosen as HTMLElement).getBoundingClientRect().height) &&
    //             this._clickable(current, testNode)
    //         ) {
    //             chosen = current;
    //             break;
    //         }

    //         current = current.parentElement;
    //     } while (current && !current.isSameNode(document.body.parentElement));

    //     if (chosen) {
    //         return chosen;
    //     }

    //     return document.body;
    // }

    // private _clickable(container: HTMLElement, element: HTMLElement): boolean {
    //     container.appendChild(element);
    //     const rect = element.getBoundingClientRect();
    //     const clickedElement = document.elementFromPoint(rect.x, rect.y);
    //     const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);
    //     element.remove();
    //     return clickable;
    // }
}

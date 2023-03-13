import {
    AnkiSettingsToVideoMessage,
    AnkiUiSavedState,
    AutoPausePreference,
    CanvasResizer,
    CardUpdatedMessage,
    CopySubtitleMessage,
    CropAndResizeMessage,
    CurrentTimeFromVideoMessage,
    CurrentTimeToVideoMessage,
    humanReadableTime,
    MiscSettingsToVideoMessage,
    OffsetToVideoMessage,
    PauseFromVideoMessage,
    PlaybackRateFromVideoMessage,
    PlaybackRateToVideoMessage,
    PlayFromVideoMessage,
    PlayMode,
    PostMineAction,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    RecordMediaAndForwardSubtitleMessage,
    RerecordMediaMessage,
    ScreenshotTakenMessage,
    ShowAnkiUiAfterRerecordMessage,
    ShowAnkiUiMessage,
    StartRecordingMediaMessage,
    StopRecordingMediaMessage,
    SubtitleModel,
    SubtitleSettingsToVideoMessage,
    SubtitlesToVideoMessage,
    surroundingSubtitlesAroundInterval,
    TakeScreenshotFromExtensionMessage,
    VideoHeartbeatMessage,
    VideoToExtensionCommand,
} from '@project/common';
import AnkiUiContainer from './AnkiUiContainer';
import ControlsContainer from './ControlsContainer';
import DragContainer from './DragContainer';
import KeyBindings from './KeyBindings';
import Settings from './Settings';
import SubtitleContainer from './SubtitleContainer';
import VideoOverlayContainer from './VideoOverlayContainer';
import VideoDataSyncContainer from './VideoDataSyncContainer';

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = (e as CustomEvent).detail;
});
document.dispatchEvent(new CustomEvent('asbplayer-query-netflix'));

export default class Binding {
    subscribed: boolean = false;

    ankiUiSavedState?: AnkiUiSavedState;

    private _synced: boolean;
    private _recordingMedia: boolean;
    private recordingMediaStartedTimestamp?: number;
    private recordingMediaWithScreenshot: boolean;
    private _playMode: PlayMode = PlayMode.normal;

    readonly video: HTMLVideoElement;
    readonly subSyncAvailable: boolean;
    readonly subtitleContainer: SubtitleContainer;
    readonly videoDataSyncContainer: VideoDataSyncContainer;
    readonly controlsContainer: ControlsContainer;
    readonly dragContainer: DragContainer;
    readonly ankiUiContainer: AnkiUiContainer;
    readonly videoOverlayContainer: VideoOverlayContainer;
    readonly keyBindings: KeyBindings;
    readonly settings: Settings;

    private copyToClipboardOnMine: boolean;
    private recordMedia: boolean;
    private screenshot: boolean;
    private cleanScreenshot: boolean;
    private audioPaddingStart: number;
    private audioPaddingEnd: number;
    private maxImageWidth: number;
    private maxImageHeight: number;
    private autoPausePreference: AutoPausePreference;
    private condensedPlaybackMinimumSkipIntervalMs = 1000;
    private imageDelay = 0;

    private playListener?: EventListener;
    private pauseListener?: EventListener;
    private seekedListener?: EventListener;
    private playbackRateListener?: EventListener;
    private videoChangeListener?: EventListener;
    private listener?: (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private heartbeatInterval?: NodeJS.Timeout;

    constructor(video: HTMLVideoElement, syncAvailable: boolean) {
        this.video = video;
        this.subSyncAvailable = syncAvailable;
        this.subtitleContainer = new SubtitleContainer(video);
        this.videoDataSyncContainer = new VideoDataSyncContainer(this);
        this.controlsContainer = new ControlsContainer(video);
        this.dragContainer = new DragContainer(video);
        this.ankiUiContainer = new AnkiUiContainer();
        this.videoOverlayContainer = new VideoOverlayContainer(this);
        this.keyBindings = new KeyBindings();
        this.settings = new Settings();
        this.recordMedia = true;
        this.screenshot = true;
        this.cleanScreenshot = true;
        this.audioPaddingStart = 0;
        this.audioPaddingEnd = 500;
        this.maxImageWidth = 0;
        this.maxImageHeight = 0;
        this.autoPausePreference = AutoPausePreference.atEnd;
        this.copyToClipboardOnMine = false;
        this._synced = false;
        this._recordingMedia = false;
        this.recordingMediaWithScreenshot = false;
    }

    get synced() {
        return this._synced;
    }

    get recordingMedia() {
        return this._recordingMedia;
    }

    get url() {
        return window.location !== window.parent.location ? document.referrer : document.location.href;
    }

    get playMode() {
        return this._playMode;
    }

    set playMode(newPlayMode: PlayMode) {
        switch (newPlayMode) {
            case PlayMode.autoPause:
                this.subtitleContainer.autoPauseContext.onStartedShowing = () => {
                    if (this._recordingMedia || this.autoPausePreference !== AutoPausePreference.atStart) {
                        return;
                    }

                    this.pause();
                };
                this.subtitleContainer.autoPauseContext.onWillStopShowing = () => {
                    if (this._recordingMedia || this.autoPausePreference !== AutoPausePreference.atEnd) {
                        return;
                    }

                    this.pause();
                };
                this.subtitleContainer.notification('Auto-pause: On');
                break;
            case PlayMode.condensed:
                let seeking = false;
                this.subtitleContainer.onNextToShow = async (subtitle) => {
                    try {
                        if (
                            this._recordingMedia ||
                            seeking ||
                            this.video.paused ||
                            subtitle.start - this.video.currentTime * 1000 <=
                                this.condensedPlaybackMinimumSkipIntervalMs
                        ) {
                            return;
                        }

                        seeking = true;
                        this.seek(subtitle.start / 1000);
                        await this.play();
                        seeking = false;
                    } finally {
                        seeking = false;
                    }
                };
                this.subtitleContainer.notification('Condensed playback: On');
                break;
            case PlayMode.normal:
                if (this._playMode === PlayMode.autoPause) {
                    this.subtitleContainer.autoPauseContext.onStartedShowing = undefined;
                    this.subtitleContainer.autoPauseContext.onWillStopShowing = undefined;
                    this.subtitleContainer.notification('Auto-pause: Off');
                } else if (this._playMode === PlayMode.condensed) {
                    this.subtitleContainer.onNextToShow = undefined;
                    this.subtitleContainer.notification('Condensed playback: Off');
                }
                break;
            default:
                console.error('Unknown play mode ' + newPlayMode);
        }

        this._playMode = newPlayMode;
    }

    sourceString(timestamp: number, track: number = 0) {
        const subtitleFileNames = this.subtitleContainer.subtitleFileNames;
        const subtitleFileNameToUse = (subtitleFileNames && subtitleFileNames[track]) ?? '';
        return subtitleFileNameToUse === '' ? '' : `${subtitleFileNameToUse} (${humanReadableTime(timestamp)})`;
    }

    bind() {
        let bound = false;

        if (this.video.readyState === 4) {
            this._bind();
            bound = true;
        } else {
            this.video.addEventListener('canplay', (event) => {
                if (!bound) {
                    this._bind();
                    bound = true;
                }

                const command: VideoToExtensionCommand<ReadyStateFromVideoMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'readyState',
                        value: 4,
                    },
                    src: this.video.src,
                };

                chrome.runtime.sendMessage(command);
            });
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings().then(() => {
            this.videoDataSyncContainer.requestSubtitles();
        });
        this.subtitleContainer.bind();
        this.dragContainer.bind();
        this.videoOverlayContainer.bind();
    }

    _notifyReady() {
        const command: VideoToExtensionCommand<ReadyFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.video.duration,
                currentTime: this.video.currentTime,
                paused: this.video.paused,
                audioTracks: undefined,
                selectedAudioTrack: undefined,
                playbackRate: this.video.playbackRate,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    _subscribe() {
        this.playListener = (event) => {
            const command: VideoToExtensionCommand<PlayFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        };

        this.pauseListener = (event) => {
            const command: VideoToExtensionCommand<PauseFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        };

        this.seekedListener = (event) => {
            const command: VideoToExtensionCommand<CurrentTimeFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);

            this.subtitleContainer.autoPauseContext.clear();
        };

        this.playbackRateListener = (event) => {
            const command: VideoToExtensionCommand<PlaybackRateFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'playbackRate',
                    value: this.video.playbackRate,
                    echo: false,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
            this.subtitleContainer.notification(`Playback rate: ${this.video.playbackRate.toFixed(1)}`);
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);
        this.video.addEventListener('ratechange', this.playbackRateListener);

        if (this.subSyncAvailable) {
            this.videoChangeListener = () => {
                this.videoDataSyncContainer.requestSubtitles();
            };
            this.video.addEventListener('loadedmetadata', this.videoChangeListener);
        }

        this.heartbeatInterval = setInterval(() => {
            const command: VideoToExtensionCommand<VideoHeartbeatMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                    synced: this._synced,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            this.heartbeatInterval && clearInterval(this.heartbeatInterval);
        });

        this.listener = (
            request: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (request.sender === 'asbplayer-extension-to-video' && request.src === this.video.src) {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this.play();
                        break;
                    case 'pause':
                        this.pause();
                        break;
                    case 'currentTime':
                        const currentTimeMessage = request.message as CurrentTimeToVideoMessage;
                        this.seek(currentTimeMessage.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles':
                        const subtitlesMessage = request.message as SubtitlesToVideoMessage;
                        const subtitles: SubtitleModel[] = subtitlesMessage.value;
                        this.subtitleContainer.subtitles = subtitles.map((s, index) => ({ ...s, index }));
                        this.subtitleContainer.subtitleFileNames = subtitlesMessage.names || [subtitlesMessage.name];

                        if (this._playMode !== PlayMode.normal && (!subtitles || subtitles.length === 0)) {
                            this.playMode = PlayMode.normal;
                        }

                        this.subtitleContainer.showLoadedMessage();
                        this.videoDataSyncContainer.unbindVideoSelect();
                        this.ankiUiSavedState = undefined;
                        this._synced = true;
                        break;
                    case 'offset':
                        const offsetMessage = request.message as OffsetToVideoMessage;
                        this.subtitleContainer.offset(offsetMessage.value, true);
                        break;
                    case 'playbackRate':
                        const playbackRateMessage = request.message as PlaybackRateToVideoMessage;
                        this.video.playbackRate = playbackRateMessage.value;
                        break;
                    case 'subtitleSettings':
                        const subtitleSettingsMessage = request.message as SubtitleSettingsToVideoMessage;
                        this.subtitleContainer.setSubtitleSettings(subtitleSettingsMessage.value);
                        this.subtitleContainer.refresh();
                        break;
                    case 'ankiSettings':
                        const ankiSettingsMessage = request.message as AnkiSettingsToVideoMessage;
                        const ankiSettings = { ...ankiSettingsMessage.value };
                        ankiSettings.tags = typeof ankiSettings.tags === 'undefined' ? [] : ankiSettings.tags;
                        this.ankiUiContainer.ankiSettings = ankiSettings;
                        this.audioPaddingStart =
                            typeof ankiSettingsMessage.value.audioPaddingStart === 'undefined'
                                ? this.audioPaddingStart
                                : ankiSettingsMessage.value.audioPaddingStart;
                        this.audioPaddingEnd =
                            typeof ankiSettingsMessage.value.audioPaddingEnd === 'undefined'
                                ? this.audioPaddingEnd
                                : ankiSettingsMessage.value.audioPaddingEnd;
                        this.maxImageWidth =
                            typeof ankiSettingsMessage.value.maxImageWidth === 'undefined'
                                ? this.maxImageWidth
                                : ankiSettingsMessage.value.maxImageWidth;
                        this.maxImageHeight =
                            typeof ankiSettingsMessage.value.maxImageHeight === 'undefined'
                                ? this.maxImageHeight
                                : ankiSettingsMessage.value.maxImageHeight;
                        this.subtitleContainer.surroundingSubtitlesCountRadius =
                            typeof ankiSettingsMessage.value.surroundingSubtitlesCountRadius === 'undefined'
                                ? this.subtitleContainer.surroundingSubtitlesCountRadius
                                : ankiSettingsMessage.value.surroundingSubtitlesCountRadius;
                        this.subtitleContainer.surroundingSubtitlesTimeRadius =
                            typeof ankiSettingsMessage.value.surroundingSubtitlesTimeRadius === 'undefined'
                                ? this.subtitleContainer.surroundingSubtitlesTimeRadius
                                : ankiSettingsMessage.value.surroundingSubtitlesTimeRadius;
                        break;
                    case 'miscSettings':
                        const miscSettingsMessage = request.message as MiscSettingsToVideoMessage;
                        this.settings.set({ lastThemeType: miscSettingsMessage.value.themeType });
                        this.copyToClipboardOnMine = miscSettingsMessage.value.copyToClipboardOnMine;
                        this.autoPausePreference =
                            miscSettingsMessage.value.autoPausePreference ?? this.autoPausePreference;
                        this.keyBindings.setKeyBindSet(this, miscSettingsMessage.value.keyBindSet);
                        this.subtitleContainer.autoCopyCurrentSubtitle =
                            miscSettingsMessage.value.autoCopyCurrentSubtitle ?? false;
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        const copySubtitleMessage = request.message as CopySubtitleMessage;
                        this.copySubtitle(copySubtitleMessage.postMineAction);
                        break;
                    case 'toggle-recording':
                        if (this._synced) {
                            this._toggleRecordingMedia(PostMineAction.showAnkiDialog);
                        }
                        break;
                    case 'card-updated':
                        const cardUpdatedMessage = request.message as CardUpdatedMessage;
                        this.subtitleContainer.notification(`Updated card: ${request.message.cardName}`);
                        this.ankiUiSavedState = {
                            subtitle: cardUpdatedMessage.subtitle,
                            text: '',
                            sliderContext: {
                                subtitleStart: cardUpdatedMessage.subtitle.start,
                                subtitleEnd: cardUpdatedMessage.subtitle.end,
                                subtitles: cardUpdatedMessage.surroundingSubtitles,
                            },
                            definition: '',
                            image: cardUpdatedMessage.image,
                            audio: cardUpdatedMessage.audio,
                            word: cardUpdatedMessage.cardName,
                            source: this.sourceString(cardUpdatedMessage.subtitle.start),
                            url: cardUpdatedMessage.url ?? '',
                            customFieldValues: {},
                            timestampInterval: [cardUpdatedMessage.subtitle.start, cardUpdatedMessage.subtitle.end],
                            initialTimestampInterval: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            lastAppliedTimestampIntervalToText: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            lastAppliedTimestampIntervalToAudio: [
                                cardUpdatedMessage.subtitle.start,
                                cardUpdatedMessage.subtitle.end,
                            ],
                            dialogRequestedTimestamp: this.video.currentTime * 1000,
                        };
                        break;
                    case 'recording-finished':
                        this._recordingMedia = false;
                        this.recordingMediaStartedTimestamp = undefined;
                        break;
                    case 'show-anki-ui':
                        const showAnkiUiMessage = request.message as ShowAnkiUiMessage;
                        this.ankiUiContainer.show(
                            this,
                            showAnkiUiMessage.subtitle,
                            showAnkiUiMessage.surroundingSubtitles,
                            showAnkiUiMessage.image,
                            showAnkiUiMessage.audio
                        );
                        break;
                    case 'show-anki-ui-after-rerecord':
                        const showAnkiUiAfterRerecordMessage = request.message as ShowAnkiUiAfterRerecordMessage;
                        this.ankiUiContainer.showAfterRerecord(this, showAnkiUiAfterRerecordMessage.uiState);
                        break;
                    case 'take-screenshot':
                        this._takeScreenshot();
                        break;
                    case 'screenshot-taken':
                        const screenshotTakenMessage = request.message as ScreenshotTakenMessage;
                        this.subtitleContainer.forceHideSubtitles = false;

                        if (screenshotTakenMessage.ankiUiState) {
                            this.ankiUiContainer.showAfterRetakingScreenshot(this, screenshotTakenMessage.ankiUiState);
                        }

                        this.controlsContainer.show();
                        break;
                    case 'crop-and-resize':
                        const cropAndResizeMessage = request.message as CropAndResizeMessage;
                        this.cropAndResize(cropAndResizeMessage.dataUrl).then((dataUrl) => sendResponse({ dataUrl }));
                        return true;
                    case 'alert':
                        // ignore
                        break;
                }
            }
        };

        chrome.runtime.onMessage.addListener(this.listener);
        this.subscribed = true;
    }

    async _refreshSettings() {
        const currentSettings = await this.settings.getAll();
        this.recordMedia = currentSettings.recordMedia;
        this.screenshot = currentSettings.screenshot;
        this.cleanScreenshot = currentSettings.screenshot && currentSettings.cleanScreenshot;
        this.subtitleContainer.displaySubtitles = currentSettings.displaySubtitles;
        this.subtitleContainer.subtitlePositionOffsetBottom = currentSettings.subtitlePositionOffsetBottom;
        this.subtitleContainer.refresh();
        this.videoDataSyncContainer.updateSettings(currentSettings);
        this.keyBindings.setSettings(this, currentSettings);
        this.condensedPlaybackMinimumSkipIntervalMs = currentSettings.condensedPlaybackMinimumSkipIntervalMs;
        this.imageDelay = currentSettings.imageDelay;

        if (currentSettings.subsDragAndDrop) {
            this.dragContainer.bind();
        } else {
            this.dragContainer.unbind();
        }
    }

    unbind() {
        if (this.playListener) {
            this.video.removeEventListener('play', this.playListener);
            this.playListener = undefined;
        }

        if (this.pauseListener) {
            this.video.removeEventListener('pause', this.pauseListener);
            this.pauseListener = undefined;
        }

        if (this.seekedListener) {
            this.video.removeEventListener('seeked', this.seekedListener);
            this.seekedListener = undefined;
        }

        if (this.playbackRateListener) {
            this.video.removeEventListener('ratechange', this.playbackRateListener);
            this.playbackRateListener = undefined;
        }

        if (this.videoChangeListener) {
            this.video.removeEventListener('loadedmetadata', this.videoChangeListener);
            this.videoChangeListener = undefined;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
            this.listener = undefined;
        }

        this.subtitleContainer.unbind();
        this.dragContainer.unbind();
        this.keyBindings.unbind();
        this.videoDataSyncContainer.unbind();
        this.videoOverlayContainer.unbind();
        this.subscribed = false;
    }

    async _takeScreenshot() {
        if (!this.screenshot) {
            return;
        }

        await this._prepareScreenshot();

        const command: VideoToExtensionCommand<TakeScreenshotFromExtensionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'take-screenshot',
                ankiUiState: this.ankiUiSavedState,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
        this.ankiUiSavedState = undefined;
    }

    copySubtitle(postMineAction: PostMineAction) {
        if (this._synced) {
            if (this.subtitleContainer.subtitles.length > 0) {
                this._copySubtitle(postMineAction);
            } else {
                this._toggleRecordingMedia(postMineAction);
            }
        }
    }

    private async _copySubtitle(postMineAction: PostMineAction) {
        const [subtitle, surroundingSubtitles] = this.subtitleContainer.currentSubtitle();

        if (subtitle && surroundingSubtitles) {
            if (this.copyToClipboardOnMine) {
                navigator.clipboard.writeText(subtitle.text);
            }

            if (this.screenshot) {
                await this._prepareScreenshot();
            }

            if (this.recordMedia) {
                this._recordingMedia = true;
                this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
                const start = Math.max(0, subtitle.start - this.audioPaddingStart);
                this.seek(start / 1000);
                await this.play();
            }

            const ankiSettings =
                postMineAction === PostMineAction.updateLastCard ? this.ankiUiContainer.ankiSettings : undefined;

            const command: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'record-media-and-forward-subtitle',
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    record: this.recordMedia,
                    screenshot: this.screenshot,
                    url: this.url,
                    sourceString: this.sourceString(subtitle.start, subtitle.track),
                    postMineAction: postMineAction,
                    audioPaddingStart: this.audioPaddingStart,
                    audioPaddingEnd: this.audioPaddingEnd,
                    imageDelay: this.imageDelay,
                    playbackRate: this.video.playbackRate,
                    ankiSettings: ankiSettings,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }
    }

    async _toggleRecordingMedia(postMineAction: PostMineAction) {
        const ankiSettings =
            postMineAction === PostMineAction.updateLastCard ? this.ankiUiContainer.ankiSettings : undefined;
        if (this._recordingMedia) {
            const currentTimestamp = this.video.currentTime * 1000;
            const command: VideoToExtensionCommand<StopRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'stop-recording-media',
                    postMineAction: postMineAction,
                    startTimestamp: this.recordingMediaStartedTimestamp!,
                    endTimestamp: currentTimestamp,
                    playbackRate: this.video.playbackRate,
                    screenshot: this.recordingMediaWithScreenshot,
                    videoDuration: this.video.duration * 1000,
                    url: this.url,
                    sourceString: this.sourceString(this.recordingMediaStartedTimestamp!),
                    ankiSettings: ankiSettings,
                    ...this._surroundingSubtitlesAroundInterval(this.recordingMediaStartedTimestamp!, currentTimestamp),
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        } else {
            this.ankiUiSavedState = undefined;

            if (this.screenshot) {
                await this._prepareScreenshot();
            }

            const timestamp = this.video.currentTime * 1000;

            if (this.recordMedia) {
                this._recordingMedia = true;
                this.recordingMediaStartedTimestamp = timestamp;
                this.recordingMediaWithScreenshot = this.screenshot;
            }

            await this.video.play();

            const command: VideoToExtensionCommand<StartRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'start-recording-media',
                    timestamp: timestamp,
                    record: this.recordMedia,
                    postMineAction: postMineAction,
                    screenshot: this.screenshot,
                    url: this.url,
                    sourceString: this.sourceString(timestamp),
                    imageDelay: this.imageDelay,
                    ankiSettings: ankiSettings,
                },
                src: this.video.src,
            };

            chrome.runtime.sendMessage(command);
        }
    }

    private _surroundingSubtitlesAroundInterval(start: number, end: number) {
        return surroundingSubtitlesAroundInterval(
            this.subtitleContainer.subtitles,
            start,
            end,
            this.ankiUiContainer.ankiSettings!.surroundingSubtitlesCountRadius,
            this.ankiUiContainer.ankiSettings!.surroundingSubtitlesTimeRadius
        );
    }

    async _prepareScreenshot() {
        if (this.cleanScreenshot) {
            this.subtitleContainer.forceHideSubtitles = true;
            await this.controlsContainer.hide();
        }
    }

    async rerecord(start: number, end: number, uiState: AnkiUiSavedState) {
        const noSubtitles = this.subtitleContainer.subtitles.length === 0;
        const audioPaddingStart = noSubtitles ? 0 : this.audioPaddingStart;
        const audioPaddingEnd = noSubtitles ? 0 : this.audioPaddingEnd;
        this._recordingMedia = true;
        this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
        this.seek(Math.max(0, start - audioPaddingStart) / 1000);
        await this.play();

        const command: VideoToExtensionCommand<RerecordMediaMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'rerecord-media',
                duration: end - start,
                uiState: uiState,
                audioPaddingStart: audioPaddingStart,
                audioPaddingEnd: audioPaddingEnd,
                playbackRate: this.video.playbackRate,
                timestamp: start,
            },
            src: this.video.src,
        };

        chrome.runtime.sendMessage(command);
    }

    seek(timestamp: number) {
        if (netflix) {
            document.dispatchEvent(
                new CustomEvent('asbplayer-netflix-seek', {
                    detail: timestamp * 1000,
                })
            );
        } else {
            this.video.currentTime = timestamp;
        }
    }

    async play() {
        if (netflix) {
            await this._playNetflix();
            return;
        }

        try {
            await this.video.play();
        } catch (ex) {
            // Ignore exception

            if (this.video.readyState !== 4) {
                // Deal with Amazon Prime player pausing in the middle of play, without loss of generality
                return new Promise((resolve, reject) => {
                    const listener = async (evt: Event) => {
                        let retries = 3;

                        for (let i = 0; i < retries; ++i) {
                            try {
                                await this.video.play();
                                break;
                            } catch (ex2) {
                                console.error(ex2);
                            }
                        }

                        resolve(undefined);
                        this.video.removeEventListener('canplay', listener);
                    };

                    this.video.addEventListener('canplay', listener);
                });
            }
        }
    }

    _playNetflix() {
        return new Promise((resolve, reject) => {
            const listener = async (evt: Event) => {
                this.video.removeEventListener('play', listener);
                this.video.removeEventListener('playing', listener);
                resolve(undefined);
            };

            this.video.addEventListener('play', listener);
            this.video.addEventListener('playing', listener);
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-play'));
        });
    }

    pause() {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-pause'));
            return;
        }

        this.video.pause();
    }

    bindVideoSelect(doneListener: () => void) {
        this.videoDataSyncContainer.bindVideoSelect(doneListener);
    }

    unbindVideoSelect() {
        this.videoDataSyncContainer.unbindVideoSelect();
    }

    showVideoDataDialog() {
        this.videoDataSyncContainer.show();
    }

    async cropAndResize(tabImageDataUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const rect = this.video.getBoundingClientRect();
            const maxWidth = this.maxImageHeight;
            const maxHeight = this.maxImageHeight;

            image.onload = async () => {
                const canvas = document.createElement('canvas');
                const r = window.devicePixelRatio;
                const width = rect.width * r;
                const height = rect.height * r;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(image, rect.left * r, rect.top * r, width, height, 0, 0, width, height);

                if (maxWidth > 0 || maxHeight > 0) {
                    try {
                        await new CanvasResizer().resize(canvas, ctx, maxWidth, maxHeight);
                        resolve(canvas.toDataURL('image/jpeg'));
                    } catch (e) {
                        console.error('Failed to crop and resize image: ' + e);
                        reject(e);
                    }
                } else {
                    resolve(canvas.toDataURL('image/jpeg'));
                }
            };

            image.src = tabImageDataUrl;
        });
    }
}

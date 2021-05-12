import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import BroadcastChannelVideoProtocol from '../services/BroadcastChannelVideoProtocol';
import ChromeTabVideoProtocol from '../services/ChromeTabVideoProtocol';
import Clock from '../services/Clock';
import Controls from './Controls';
import Grid from '@material-ui/core/Grid';
import MediaAdapter from '../services/MediaAdapter';
import SubtitlePlayer from './SubtitlePlayer';
import VideoChannel from '../services/VideoChannel';

const useStyles = makeStyles({
    root: {
        maxHeight: 'calc(100vh - 64px)',
        position: 'relative',
        overflowX: 'hidden'
    },
    videoFrame: {
        width: '100%',
        height: '100%',
        border: 0
    }
});

function trackLength(audioRef, videoRef, subtitles, useOffset) {
    let subtitlesLength;
    if (subtitles && subtitles.length > 0) {
        if (useOffset) {
            subtitlesLength = subtitles.get(subtitles.length - 1).end;
        } else {
            subtitlesLength = subtitles.get(subtitles.length - 1).originalEnd;
        }
    } else {
        subtitlesLength = 0;
    }

    const audioLength = audioRef.current && audioRef.current.duration
        ? 1000 * audioRef.current.duration
        : 0;

    const videoLength = videoRef.current && videoRef.current.duration
        ? 1000 * videoRef.current.duration
        : 0;

    return Math.max(videoLength, Math.max(subtitlesLength, audioLength));
}

export default function Player(props) {
    const {subtitleReader, settingsProvider, extension, offsetRef, videoFrameRef, drawerOpen, onError, onUnloadVideo, onCopy, onLoaded, disableKeyEvents} = props;
    const {subtitleFile, audioFile, audioFileUrl, videoFile, videoFileUrl} = props.sources;
    const [tab, setTab] = useState();
    const [subtitles, setSubtitles] = useState();
    const subtitlesRef = useRef();
    subtitlesRef.current = subtitles;
    const [loadingSubtitles, setLoadingSubtitles] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState(0);
    const playingRef = useRef();
    playingRef.current = playing;
    const [, updateState] = useState();
    const [audioTracks, setAudioTracks] = useState();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState();
    const [offset, setOffset] = useState(0);
    const [channelId, setChannelId] = useState();
    const [videoPopOut, setVideoPopOut] = useState(false);
    const [condensedModeEnabled, setCondensedModeEnabled] = useState(false);
    const condensedModeEnabledRef = useRef();
    condensedModeEnabledRef.current = condensedModeEnabled;
    const forceUpdate = useCallback(() => updateState({}), []);
    const mousePositionRef = useRef({x:0, y:0});
    const audioRef = useRef();
    const videoRef = useRef();
    const mediaAdapter = useMemo(() => {
        if (audioFileUrl) {
            return new MediaAdapter(audioRef);
        } else if (videoFileUrl || tab) {
            return new MediaAdapter(videoRef);
        }

        return new MediaAdapter({});
    }, [audioFileUrl, videoFileUrl, tab]);
    const clock = useMemo(() => new Clock(), []);
    const classes = useStyles();
    const [availableTabs, setAvailableTabs] = useState([]);
    const lengthRef = useRef(0);
    lengthRef.current = trackLength(audioRef, videoRef, subtitles, true);

    const seek = useCallback(async (progress, clock, echo) => {
        const time = progress * lengthRef.current;
        clock.setTime(time);
        forceUpdate();

        if (echo) {
            await mediaAdapter.seek(time / 1000);
        }
    }, [forceUpdate, mediaAdapter]);

    useEffect(() => {
        async function init() {
            videoRef.current?.close();
            videoRef.current = null;
            clock.setTime(0);
            clock.stop();
            setPlaying(false);
            setAudioTracks(null);
            setSelectedAudioTrack(null);
            setOffset(0);
            setCondensedModeEnabled(false);
            audioRef.current.currentTime = 0;
            audioRef.current.pause();

            if (subtitleFile) {
                setLoadingSubtitles(true);

                try {
                    const subtitles = await subtitleReader.subtitles(subtitleFile);
                    setSubtitles(subtitles);
                    setLastJumpToTopTimestamp(Date.now());
                } catch (e) {
                    console.error(e);
                    onError(e.message);
                } finally {
                    setLoadingSubtitles(false);
                }
            }

            if (audioFileUrl) {
                await mediaAdapter.onReady();
                forceUpdate();
            } else if (videoFileUrl || tab) {
                let channel;

                if (videoFileUrl) {
                    const channelId = String(Date.now());
                    channel = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
                    setChannelId(channelId);
                } else if (tab) {
                    channel = new VideoChannel(new ChromeTabVideoProtocol(tab.id, extension));
                    channel.init();
                }

                videoRef.current = channel;
                let subscribed = false;

                channel.onReady((paused) => {
                    lengthRef.current = trackLength(audioRef, videoRef, subtitlesRef.current);
                    channel.ready(lengthRef.current);

                    if (subtitlesRef.current) {
                        channel.subtitleSettings(settingsProvider.subtitleSettings);
                        channel.subtitles(subtitlesRef.current.list().map(s => s.serialize()));
                    }

                    channel.condensedModeToggle(condensedModeEnabledRef.current);

                    if (channel.audioTracks && channel.audioTracks.length > 1) {
                        setAudioTracks(videoRef.current.audioTracks);
                        setSelectedAudioTrack(videoRef.current.selectedAudioTrack);
                    } else {
                        setAudioTracks(null);
                        setSelectedAudioTrack(null);
                    }

                    clock.setTime(videoRef.current.currentTime * 1000);

                    if (paused) {
                        clock.stop();
                    } else {
                        clock.start();
                    }

                    setPlaying(!paused);

                    if (!subscribed) {
                        channel.onPlay((echo) => play(clock, mediaAdapter, echo));
                        channel.onPause((echo) => pause(clock, mediaAdapter, echo));
                        channel.onExit(() => onUnloadVideo(videoFileUrl));
                        channel.onOffset((offset) => setOffset(Math.max(-lengthRef.current ?? 0, offset)));
                        channel.onPopOutToggle(() => setVideoPopOut(popOut => !popOut));
                        channel.onCopy((subtitle, audio, image) => onCopy(
                            subtitle,
                            audioFile,
                            videoFile,
                            subtitleFile,
                            channel.selectedAudioTrack,
                            audio,
                            image
                        ));
                        channel.onCondensedModeToggle(() => setCondensedModeEnabled(enabled => {
                            const newValue = !enabled;
                            channel.condensedModeToggle(newValue);
                            return newValue;
                        }));
                        channel.onCurrentTime(async (currentTime, echo) => {
                            const progress = currentTime * 1000 / lengthRef.current;

                            if (playingRef.current) {
                                clock.stop();
                            }

                            await seek(progress, clock, echo);

                            if (playingRef.current) {
                                clock.start();
                            }
                        });
                        channel.onAudioTrackSelected(async (id) => {
                            if (playingRef.current) {
                                clock.stop();
                            }

                            await mediaAdapter.onReady();
                            if (playingRef.current) {
                                clock.start();
                            }

                            setSelectedAudioTrack(id);
                        });

                        subscribed = true;
                    }
                });
            }
        }

        init().then(() => onLoaded());
    }, [subtitleReader, extension, settingsProvider, clock, mediaAdapter, seek, onLoaded, onError, onUnloadVideo, onCopy, subtitleFile, audioFile, audioFileUrl, videoFile, videoFileUrl, tab, forceUpdate, videoFrameRef]);

    useEffect(() => {
        if (!condensedModeEnabled) {
            return;
        }

        if (!subtitles || subtitles.length === 0) {
            return;
        }

        let seeking = false;
        let expectedSeekTime = 1000;

        const interval = setInterval(async () => {
            const length = lengthRef.current;

            if (!length) {
                return;
            }

            const progress = clock.progress(length);

            let currentOrNextIndex = 0;
            let currentIndex = -1;

            for (let i = subtitles.length - 1; i >= 0; --i) {
                const s = subtitles.get(i);
                const start = s.start / length;
                const end = s.end / length;

                if (progress >= start) {
                    if (progress < end) {
                        currentIndex = i;
                        currentOrNextIndex = i;
                    } else {
                        currentOrNextIndex = Math.min(subtitles.length - 1, i + 1);
                    }

                    break;
                }
            }

            if (currentIndex !== currentOrNextIndex) {
                const nextSubtitle = subtitles.get(currentOrNextIndex);

                if (nextSubtitle.start - progress * length < expectedSeekTime + 500) {
                    return;
                }

                if (playingRef.current) {
                    clock.stop();
                }

                if (!seeking) {
                    seeking = true;
                    const t0 = Date.now();
                    await seek(nextSubtitle.start / length, clock, true);
                    expectedSeekTime = Date.now() - t0;
                    seeking = false;
                }

                if (playingRef.current) {
                    clock.start();
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [subtitles, condensedModeEnabled, clock, seek]);

    useEffect(() => {
        if (videoPopOut && channelId && videoFileUrl) {
            window.open(
                process.env.PUBLIC_URL + '/?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=true',
                'asbplayer-video-' + videoFileUrl,
                "resizable,width=800,height=450"
            );
        }

        setLastJumpToTopTimestamp(Date.now());
    }, [videoPopOut, channelId, videoFileUrl, videoFrameRef]);

    function play(clock, mediaAdapter, echo) {
        setPlaying(true);
        clock.start();

        if (echo) {
            mediaAdapter.play();
        }
    };

    function pause(clock, mediaAdapter, echo) {
        setPlaying(false);
        clock.stop();

        if (echo) {
            mediaAdapter.pause();
        }
    };

    const handlePlay = useCallback(() => play(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handlePause = useCallback(() => pause(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handleSeek = useCallback(async (progress) => {
        if (playingRef.current) {
            clock.stop();
        }

        await seek(progress, clock, true);

        if (playingRef.current) {
            clock.start();
        }
    }, [clock, seek]);

    const handleSeekToSubtitle = useCallback(async (progress, shouldPlay) => {
        if (!shouldPlay) {
            pause(clock, mediaAdapter, true);
        }

        if (playingRef.current) {
            clock.stop();
        }

        await seek(progress, clock, true);

        if (shouldPlay && !playingRef.current) {
            // play method will start the clock again
            play(clock, mediaAdapter, true);
        }
    }, [clock, seek, mediaAdapter]);

    const handleCopy = useCallback((subtitle, audioBase64) => {
        onCopy(
            subtitle,
            audioFile,
            videoFile,
            subtitleFile,
            selectedAudioTrack
        );
    }, [onCopy, audioFile, videoFile, subtitleFile, selectedAudioTrack]);

    const handleMouseMove = useCallback((e) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    }, []);

    const handleAudioTrackSelected = useCallback(async (id) => {
        if (videoRef.current) {
            videoRef.current.audioTrackSelected(id);
        }

        pause(clock, mediaAdapter, true);

        await seek(0, clock, true);

        if (playingRef.current) {
            play(clock, mediaAdapter, true);
        }
    }, [clock, mediaAdapter, seek]);

    const handleTabSelected = useCallback((id) => {
        const tab = availableTabs.filter(t => t.id === id)[0];
        setTab(tab);
    }, [availableTabs]);

    const handleOffsetChange = useCallback((offset) => {
        setOffset(Math.max(-lengthRef.current ?? 0, offset));
    }, []);

    useEffect(() => {
        if (offsetRef) {
            offsetRef.current = offset;
        }

        setSubtitles((subtitles) => {
            if (!subtitles) {
                return;
            }

            const newSubtitles = subtitles.offsetBy(offset);
            videoRef.current?.subtitles(newSubtitles.list().map(s => s.serialize()));

            return newSubtitles;
        });

    }, [offset, offsetRef]);

    const handleVolumeChange = useCallback((v) => {
        if (audioRef.current) {
            audioRef.current.volume = v;
        }
    }, []);

    const handleCondensedModeToggle = useCallback(() =>  setCondensedModeEnabled(v => !v), []);

    useEffect(() => {
        const interval = setInterval(() => {
            const length = lengthRef.current;
            const progress = clock.progress(length);

            if (progress >= 1) {
                clock.setTime(0);
                clock.stop();
                mediaAdapter.pause();
                setPlaying(false);
                setLastJumpToTopTimestamp(Date.now());
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, subtitles, mediaAdapter]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (props.extension.tabs.length !== availableTabs.length) {
                setAvailableTabs(props.extension.tabs);
            } else {
                let update = false;

                for (let i = 0; i < availableTabs.length; ++i) {
                    const t1 = availableTabs[i];
                    const t2 = props.extension.tabs[i];
                    if (t1.id !== t2.id
                        || t1.title !== t2.title
                        || t1.src !== t2.src) {
                        update = true;
                        break;
                    }
                }

                if (update) {
                    setAvailableTabs(props.extension.tabs);
                }
            }

            let selectedTabMissing = tab && props.extension.tabs.filter(t => t.id === tab.id && t.src === tab.src).length === 0;

            if (selectedTabMissing) {
                setTab(null);
                props.onError('Lost connection with tab ' + tab.id + ' ' + tab.title);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [availableTabs, tab, props]);

    useEffect(() => {
        setTab(null);
    }, [audioFile, videoFile]);

    const length = lengthRef.current;
    const loaded = audioFileUrl || videoFileUrl || subtitles;
    const videoInWindow = loaded && videoFileUrl && channelId && !videoPopOut;

    return (
        <div
            onMouseMove={handleMouseMove}
            className={classes.root}
        >
            <Grid
                container
                direction="row"
                wrap="nowrap"
            >
                    {videoInWindow && (
                        <Grid item style={{flexGrow: 1, minWidth: 600}}>
                            <iframe
                                ref={videoFrameRef}
                                className={classes.videoFrame}
                                src={process.env.PUBLIC_URL + '/?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=false'}
                                title="asbplayer"
                            />
                        </Grid>
                    )}
                <Grid item style={{flexGrow: videoInWindow ? 0 : 1}}>
                    {loaded && !(videoFileUrl && !videoPopOut) && (
                        <Controls
                            mousePositionRef={mousePositionRef}
                            playing={playing}
                            clock={clock}
                            length={length}
                            displayLength={trackLength(audioRef, videoRef, subtitles, false)}
                            audioTracks={audioTracks}
                            selectedAudioTrack={selectedAudioTrack}
                            tabs={!videoFileUrl && !audioFileUrl && availableTabs}
                            selectedTab={tab && tab.id}
                            audioFile={audioFile?.name}
                            videoFile={videoFile?.name}
                            offsetEnabled={true}
                            offset={offset}
                            volumeEnabled={Boolean(audioFileUrl)}
                            condensedModeToggleEnabled={Boolean(audioFileUrl)}
                            condensedModeEnabled={condensedModeEnabled}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onSeek={handleSeek}
                            onAudioTrackSelected={handleAudioTrackSelected}
                            onTabSelected={handleTabSelected}
                            onUnloadAudio={() => props.onUnloadAudio(audioFileUrl)}
                            onUnloadVideo={() => props.onUnloadVideo(videoFileUrl)}
                            onOffsetChange={handleOffsetChange}
                            onVolumeChange={handleVolumeChange}
                            onCondensedModeToggle={handleCondensedModeToggle}
                            disableKeyEvents={disableKeyEvents}
                            settingsProvider={settingsProvider}
                        />
                    )}
                    <SubtitlePlayer
                        playing={playing}
                        subtitles={subtitles}
                        clock={clock}
                        length={length}
                        jumpToSubtitle={props.jumpToSubtitle}
                        drawerOpen={drawerOpen}
                        compressed={videoFileUrl && !videoPopOut}
                        loading={loadingSubtitles}
                        displayHelp={Boolean(videoFileUrl || audioFileUrl)}
                        disableKeyEvents={disableKeyEvents}
                        lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                        onSeek={handleSeekToSubtitle}
                        onCopy={handleCopy}
                    />
                </Grid>
            </Grid>
            <audio ref={audioRef} src={audioFileUrl} />
        </div>
    );
}
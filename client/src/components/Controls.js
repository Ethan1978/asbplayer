import React, { useCallback, useEffect, useState, useRef } from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import CloseIcon from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Popover from '@material-ui/core/Popover';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import Slider from '@material-ui/core/Slider';
import SpeedIcon from '@material-ui/icons/Speed';
import SubtitlesIcon from '@material-ui/icons/Subtitles';
import Tooltip from '@material-ui/core/Tooltip';
import VideocamIcon from '@material-ui/icons/Videocam';
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';

const useControlStyles = makeStyles((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '50%',
        bottom: 0,
        pointerEvents: 'none',
        color: "#fff"
    },
    buttonContainer: {
        flexDirection: 'row'
    },
    timeDisplay: {
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: '100%',
        cursor: 'default',
        fontSize: 20,
        marginLeft: 10
    },
    offsetInput: {
        height: '100%',
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontSize: 20,
        marginLeft: 10,
        width: 100,
        color: "#fff",
        pointerEvents: 'auto'
    },
    volumeInputContainerShown: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 5,
        pointerEvents: 'auto'
    },
    volumeInputContainerHidden: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 0,
        pointerEvents: 'auto'
    },
    volumeInputHidden: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        width: 0,
        pointerEvents: 'auto'
    },
    volumeInputShown: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        width: 100,
        pointerEvents: 'auto'
    },
    volumeInputThumbHidden: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        opacity: 0,
        pointerEvents: 'auto'
    },
    volumeInputThumbShown: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        opacity: 1,
        pointerEvents: 'auto'
    },
    subContainer: {
        background: "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, .4) 40%, rgba(0, 0, 0, 0.7))",
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
    },
    button: {
        pointerEvents: 'auto'
    },
    inactiveButton: {
        color: 'rgba(72, 72, 72, 0.7)',
        pointerEvents: 'auto'
    },
    progress: {
        margin: 5
    },
    closeButton: {
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        color: '#fff'
    },
    hideSubtitlePlayerToggleButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        pointerEvents: 'auto',
        color: '#fff'
    },
    gridContainer: {
        pointerEvents: 'auto',
        padding: 2,
    }
}));

const useProgressBarStyles = makeStyles((theme) => ({
    root: {
        height: 10,
    },
    container: {
        height: 10,
        pointerEvents: 'auto',
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        position: "absolute",
        width: "calc(100% - 20px)",
        marginLeft: 10
    },
    mouseEventListener: {
        zIndex: 1,
        height: 10,
        cursor: 'pointer',
        pointerEvents: 'auto',
        position: "absolute",
        width: '100%',
    },
    fillContainer: {
        background: 'rgba(30,30,30,0.7)',
        width: '100%',
        height: 5,
        position: 'relative',
    },
    fillContainerThick: {
        transition: theme.transitions.create('height', {
            easing: theme.transitions.easing.easeInOut,
            duration: 50,
        }),
        height: 8
    },
    fill: {
        background: 'linear-gradient(to left, #ff1f62, #49007a)',
        height: '100%'
    },
    handleContainer: {
        position: 'absolute',
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        height: '100%',
        bottom: 0
    },
    handle: {
        borderRadius: '50%',
        width: 16,
        height: 16,
        opacity: 0,
        left: -8,
        background: 'white',
        position: 'absolute',
    },
    handleOn: {
        opacity: 1,
        transition: theme.transitions.create('opacity', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.shortest,
        }),
    }
}));

const VolumeSlider = withStyles((theme) => ({
    root: {
        color: 'white',
        verticalAlign: 'middle'
    },
    thumb: {
        backgroundColor: 'white',
        color: 'white',
        '&:focus': {
            boxShadow: 'inherit'
        },
        '&:hover, &$active': {
            boxShadow: '0px 0px 0px 8px rgba(255, 255, 255, 0.1)',
        },
    },
    active: {
        color: 'white'
    },
}))(Slider);

function displayTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsInMinute = seconds % 60;
    return String(minutes) + ':' + String(secondsInMinute).padStart(2, '0');
}

function elementWidth(element) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
}

function ProgressBar(props) {
    const classes = useProgressBarStyles();
    const [mouseOver, setMouseOver] = useState(false);
    const containerRef = useRef(null);
    const onSeek = props.onSeek;

    const handleClick = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Account for margins by subtracting 10 from left/right sides
        const width = rect.right - rect.left - 20;
        const progress = Math.min(1, Math.max(0, (e.pageX - rect.left - 10) / width));
        onSeek(progress);
    }, [onSeek]);

    const handleMouseOver = useCallback(() => setMouseOver(true), []);
    const handleMouseOut = useCallback(() => setMouseOver(false), []);
    const progressWidth = containerRef.current ? elementWidth(containerRef.current) * props.value / 100 : 0;
    const fillStyle = {width: progressWidth};
    const handleStyle = {marginLeft: progressWidth};
    const fillContainerClassName = mouseOver ? classes.fillContainer + " " + classes.fillContainerThick : classes.fillContainer;
    const handleClassName = mouseOver ? classes.handle + " " + classes.handleOn : classes.handle;

    return (
        <div className={classes.root}>
            <div
                ref={containerRef}
                className={classes.container}>
                <div
                    className={fillContainerClassName}
                >
                    <div className={classes.fill} style={fillStyle}></div>
                    <div className={classes.handleContainer}>
                        <div className={handleClassName} style={handleStyle} />
                    </div>
                </div>
            </div>
            <div
                className={classes.mouseEventListener}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            >
            </div>
        </div>
    );
}

function AudioTrackSelector(props) {
    if (!props.audioTracks || props.audioTracks.length === 0) {
        return null;
    }

    const list = props.audioTracks.map((t) => {
        return (
            <ListItem
                key={t.id}
                selected={t.id === props.selectedAudioTrack}
                button onClick={() => props.onAudioTrackSelected(t.id)}>
                {t.language} {t.label}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>{list}</List>
            </Popover>
        </div>
    );
}

function TabSelector(props) {
    if (!props.tabs || props.tabs.length === 0) {
        return null;
    }

    const list = props.tabs.map((t) => {
        return (
            <ListItem
                key={t.id}
                selected={t.id === props.selectedTab}
                button onClick={() => props.onTabSelected(t.id)}>
                {t.id} {t.title} {t.src}
            </ListItem>
        );
    });

    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>{list}</List>
            </Popover>
        </div>
    );
}

function MediaUnloader(props) {
    return (
        <div>
            <Popover
                disableEnforceFocus={true}
                open={props.open}
                anchorEl={props.anchorEl}
                onClose={props.onClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}>
                <List>
                    <ListItem button onClick={(e) => props.onUnload()}>
                        Unload {props.file}
                    </ListItem>
                </List>
            </Popover>
        </div>
    );
}

export default function Controls({
    clock,
    playing,
    length,
    offsetEnabled,
    displayLength,
    offset,
    onAudioTrackSelected,
    onSeek,
    mousePositionRef,
    onShow,
    onPause,
    onPlay,
    onTabSelected,
    onUnloadAudio,
    onUnloadVideo,
    onOffsetChange,
    onVolumeChange,
    disableKeyEvents,
    settingsProvider,
    closeEnabled,
    onClose,
    volumeEnabled,
    condensedModeEnabled,
    condensedModeToggleEnabled,
    onCondensedModeToggle,
    subtitlesEnabled,
    subtitlesToggle,
    onSubtitlesToggle,
    videoFile,
    audioFile,
    audioTracks,
    selectedAudioTrack,
    tabs,
    selectedTab,
    popOutEnabled,
    popOut,
    onPopOutToggle,
    fullscreenEnabled,
    fullscreen,
    onFullscreenToggle,
    hideSubtitlePlayerToggleEnabled,
    subtitlePlayerHidden,
    onHideSubtitlePlayerToggle,
    }) {
    const classes = useControlStyles();
    const [show, setShow] = useState(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState();
    const [tabSelectorOpen, setTabSelectorOpen] = useState(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState();
    const [audioUnloaderOpen, setAudioUnloaderOpen] = useState(false);
    const [audioUnloaderAnchorEl, setAudioUnloaderAnchorEl] = useState();
    const [videoUnloaderOpen, setVideoUnloaderOpen] = useState(false);
    const [videoUnloaderAnchorEl, setVideoUnloaderAnchorEl] = useState();
    const [showVolumeBar, setShowVolumeBar] = useState(false);
    const [volume, setVolume] = useState(100);
    const [lastCommittedVolume, setLastCommittedVolume] = useState(100);
    const lastMousePositionRef = useRef({x: 0, y: 0});
    const lastShowTimestampRef = useRef(Date.now());
    const lastShowRef = useRef(true);
    const forceShowRef = useRef(false);
    const offsetInputRef = useRef();
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    const handleSeek = useCallback((progress) => {
        onSeek(progress);
    }, [onSeek]);

    function handleMouseOver(e) {
        forceShowRef.current = true;
    };

    function handleMouseOut(e) {
        forceShowRef.current = false;
    };

    useEffect(() => {
        const savedVolume = Number(settingsProvider.volume);
        setVolume(savedVolume);
        onVolumeChange(savedVolume / 100);

        if (savedVolume > 0) {
            setLastCommittedVolume(savedVolume);
        }
    }, [settingsProvider, onVolumeChange]);

    useEffect(() => {
        const interval = setInterval(() => {
            const currentShow = Date.now() - lastShowTimestampRef.current < 2000
                || Math.pow(mousePositionRef.current.x - lastMousePositionRef.current.x, 2)
                    + Math.pow(mousePositionRef.current.y - lastMousePositionRef.current.y, 2) > 100
                || forceShowRef.current
                || offsetInputRef.current === document.activeElement

            if (currentShow && !lastShowRef.current) {
                lastShowTimestampRef.current = Date.now();
                setShow(currentShow);
            } else if (!currentShow && lastShowRef.current) {
                setShow(currentShow);
            }

            lastShowRef.current = currentShow;
            lastMousePositionRef.current.x = mousePositionRef.current.x;
            lastMousePositionRef.current.y = mousePositionRef.current.y;
        }, 100);
        return () => clearInterval(interval);
    }, [mousePositionRef, setShow, show]);

    useEffect(() => onShow?.(show), [onShow, show]);

    useEffect(() => {
        if (disableKeyEvents) {
            return;
        }

        function handleKey(event) {
            if (event.keyCode === 32) {
                event.preventDefault();

                if (playing) {
                    onPause();
                } else {
                    onPlay();
                }
            } else if (event.keyCode === 13) {
                if (offsetInputRef.current === document.activeElement) {
                    const offset = Number(offsetInputRef.current.value);

                    if (Number.isNaN(offset)) {
                        return;
                    }

                     onOffsetChange(offset * 1000);
                     offsetInputRef.current.blur();
                }
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };
    }, [playing, onPause, onPlay, onOffsetChange, disableKeyEvents]);

    const handleOffsetInputClicked = useCallback((e) => e.target.setSelectionRange(0, e.target.value?.length || 0), []);

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate()
        }, 100);

        return () => clearInterval(interval);
    }, [forceUpdate]);

    useEffect(() => {
        if (offsetInputRef.current) {
            if (offset === 0) {
                offsetInputRef.current.value = null;
            } else {
                const offsetSeconds = offset / 1000;
                const value = offsetSeconds >= 0 ? "+" + offsetSeconds.toFixed(2) : String(offsetSeconds.toFixed(2));
                offsetInputRef.current.value = value;
            }
        }
    }, [offset]);

    const handleAudioTrackSelectorClosed = useCallback(() => {
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, []);

    const handleAudioTrackSelectorOpened = useCallback((e) => {
        setAudioTrackSelectorAnchorEl(e.currentTarget);
        setAudioTrackSelectorOpen(true);
    }, []);

    const handleAudioTrackSelected = useCallback((id) => {
        onAudioTrackSelected(id);
        setAudioTrackSelectorAnchorEl(null);
        setAudioTrackSelectorOpen(false);
    }, [onAudioTrackSelected]);

    const handleTabSelectorClosed = useCallback(() => {
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, []);

    const handleTabSelectorOpened = useCallback((e) => {
        setTabSelectorAnchorEl(e.currentTarget);
        setTabSelectorOpen(true);
    }, []);

    const handleTabSelected = useCallback((id) => {
        onTabSelected(id);
        setTabSelectorAnchorEl(null);
        setTabSelectorOpen(false);
    }, [onTabSelected]);

    const handleAudioUnloaderClosed = useCallback(() => {
        setAudioUnloaderAnchorEl(null);
        setAudioUnloaderOpen(false);
    }, []);

    const handleAudioUnloaderOpened = useCallback((e) => {
        setAudioUnloaderAnchorEl(e.currentTarget);
        setAudioUnloaderOpen(true);
    }, []);

    const handleUnloadAudio = useCallback(() => {
        onUnloadAudio();
        setAudioUnloaderOpen(false);
    }, [onUnloadAudio]);

    const handleVideoUnloaderClosed = useCallback((e) => {
        setVideoUnloaderAnchorEl(null);
        setVideoUnloaderOpen(false);
    }, []);

    const handleVideoUnloaderOpened = useCallback((e) => {
        setVideoUnloaderAnchorEl(e.currentTarget);
        setVideoUnloaderOpen(true);
    }, []);

    const handleUnloadVideo = useCallback(() => {
        onUnloadVideo();
        setVideoUnloaderOpen(false);
    }, [onUnloadVideo]);

    const handleVolumeMouseOut = useCallback(() => setShowVolumeBar(false), []);
    const handleVolumeMouseOver = useCallback(() => setShowVolumeBar(true), []);

    const handleVolumeChange = useCallback((e, value) => {
        setVolume(value);
        onVolumeChange(value / 100);
    }, [onVolumeChange]);

    const handleVolumeChangeCommitted = useCallback((e, value) => {
        if (value > 0) {
            setLastCommittedVolume(value);
        }

        settingsProvider.volume = value;
    }, [settingsProvider]);

    const handleVolumeToggle = useCallback((e, value) => {
        setVolume((volume) => {
            const newVolume = volume > 0 ? 0 : lastCommittedVolume;
            onVolumeChange(newVolume / 100);
            return newVolume;
        });
    }, [onVolumeChange, lastCommittedVolume]);

    const progress = clock.progress(length);

    return (
        <React.Fragment>
            {closeEnabled && (
                <Fade in={show} timeout={200}>
                    <IconButton
                        color="inherit"
                        className={classes.closeButton}
                        onClick={onClose}
                        onMouseOver={handleMouseOver}
                        onMouseOut={handleMouseOut}
                    >
                        <CloseIcon />
                    </IconButton>
                </Fade>
            )}
            {hideSubtitlePlayerToggleEnabled && (
                <Fade in={show} timeout={200}>
                    <IconButton
                        color="inherit"
                        className={classes.hideSubtitlePlayerToggleButton}
                        onClick={onHideSubtitlePlayerToggle}
                        onMouseOver={handleMouseOver}
                        onMouseOut={handleMouseOut}
                    >
                        {subtitlePlayerHidden ? <ArrowBackIcon /> : <ArrowForwardIcon />}
                    </IconButton>
                </Fade>
            )}
            <div
                className={classes.container}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            >
                <Fade in={show} timeout={200}>
                    <div className={classes.subContainer}>
                        <ProgressBar
                            onSeek={handleSeek}
                            value={progress * 100}
                        />
                        <Grid
                            container
                            className={classes.gridContainer}
                            direction="row"
                        >
                            <Grid item>
                                <IconButton
                                    color="inherit"
                                    onClick={() => playing ? onPause() : onPlay()}
                                >
                                    {playing
                                        ? <PauseIcon className={classes.button} />
                                        : <PlayArrowIcon className={classes.button} />}
                                </IconButton>
                            </Grid>
                            {volumeEnabled && (
                                <Grid item
                                    onMouseOver={handleVolumeMouseOver}
                                    onMouseOut={handleVolumeMouseOut}
                                    className={showVolumeBar ? classes.volumeInputContainerShown : classes.volumeInputContainerHidden}
                                >
                                    <IconButton color="inherit" onClick={handleVolumeToggle}>
                                        {volume === 0 ? (<VolumeOffIcon />) : (<VolumeUpIcon />)}
                                    </IconButton>
                                    <VolumeSlider
                                        onChange={handleVolumeChange}
                                        onChangeCommitted={handleVolumeChangeCommitted}
                                        value={volume}
                                        defaultValue={100}
                                        classes={{
                                            root: showVolumeBar ? classes.volumeInputShown : classes.volumeInputHidden,
                                            thumb: showVolumeBar ? classes.volumeInputThumbShown : classes.volumeInputThumbHidden
                                        }}
                                    />
                                </Grid>
                            )}
                            <Grid item>
                                <div className={classes.timeDisplay}>
                                    {displayTime(progress * length)} / {displayTime(displayLength || length)}
                                </div>
                            </Grid>
                            {offsetEnabled && (
                                <Grid item>
                                    <Input
                                        inputRef={offsetInputRef}
                                        disableUnderline={true}
                                        className={classes.offsetInput}
                                        placeholder={"±" + Number(0).toFixed(2)}
                                        onClick={handleOffsetInputClicked}
                                    />
                                </Grid>
                            )}
                            <Grid item style={{flexGrow: 1}}>
                            </Grid>
                            {condensedModeToggleEnabled && (
                                <Grid item>
                                    <Tooltip title="Condensed Mode">
                                        <IconButton color="inherit" onClick={onCondensedModeToggle}>
                                            <SpeedIcon className={condensedModeEnabled ? classes.button : classes.inactiveButton} />
                                        </IconButton>
                                    </Tooltip>
                                </Grid>
                            )}
                            {subtitlesToggle && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={onSubtitlesToggle}>
                                        <SubtitlesIcon className={subtitlesEnabled ? classes.button : classes.inactiveButton} />
                                    </IconButton>
                                </Grid>
                            )}
                            {videoFile && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={handleVideoUnloaderOpened}>
                                        <VideocamIcon className={classes.button} />
                                    </IconButton>
                                 </Grid>
                            )}
                            {audioFile && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={handleAudioUnloaderOpened}>
                                        <AudiotrackIcon className={classes.button} />
                                    </IconButton>
                                </Grid>
                            )}
                            {audioTracks && audioTracks.length > 1 &&  (
                                <Grid item>
                                    <IconButton color="inherit" onClick={handleAudioTrackSelectorOpened}>
                                        <QueueMusicIcon className={classes.button}  />
                                    </IconButton>
                                </Grid>
                            )}
                            {tabs && tabs.length > 0 && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={handleTabSelectorOpened}>
                                        <VideocamIcon className={selectedTab ? classes.button : classes.inactiveButton} />
                                    </IconButton>
                                </Grid>
                            )}
                            {popOutEnabled && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={onPopOutToggle}>
                                        <OpenInNewIcon className={classes.button} style={popOut ? {transform: 'rotateX(180deg)'} : {}}/>
                                    </IconButton>
                                </Grid>
                            )}
                            {fullscreenEnabled && (
                                <Grid item>
                                    <IconButton color="inherit" onClick={onFullscreenToggle}>
                                        {fullscreen
                                            ? (<FullscreenExitIcon className={classes.button} />)
                                            : (<FullscreenIcon className={classes.button} />)}
                                    </IconButton>
                                </Grid>
                            )}
                        </Grid>
                    </div>
                </Fade>
                <TabSelector
                    open={tabSelectorOpen && show}
                    anchorEl={tabSelectorAnchorEl}
                    tabs={tabs}
                    selectedTab={selectedTab}
                    onClose={handleTabSelectorClosed}
                    onTabSelected={handleTabSelected}
                />
                <AudioTrackSelector
                    open={audioTrackSelectorOpen && show}
                    anchorEl={audioTrackSelectorAnchorEl}
                    audioTracks={audioTracks}
                    selectedAudioTrack={selectedAudioTrack}
                    onClose={handleAudioTrackSelectorClosed}
                    onAudioTrackSelected={handleAudioTrackSelected}
                />
                <MediaUnloader
                    open={audioUnloaderOpen}
                    anchorEl={audioUnloaderAnchorEl}
                    file={audioFile}
                    onClose={handleAudioUnloaderClosed}
                    onUnload={handleUnloadAudio}
                />
                <MediaUnloader
                    open={videoUnloaderOpen}
                    anchorEl={videoUnloaderAnchorEl}
                    file={videoFile}
                    onClose={handleVideoUnloaderClosed}
                    onUnload={handleUnloadVideo}
                />
            </div>
        </React.Fragment>
    );
}

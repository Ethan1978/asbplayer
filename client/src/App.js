import React, { useCallback, useState, useMemo } from 'react';
import Api from './Api.js';
import Bar from './Bar.js';
import CopyHistory from './CopyHistory.js';
import Browser from './Browser.js';
import Player from './Player.js';
import VideoPlayer from './VideoPlayer.js';
import {
    Route,
    Redirect,
    Switch,
    useHistory
} from "react-router-dom";

function App() {
    const api = useMemo(() => new Api(), []);
    const history = useHistory();
    const [copiedSubtitles, setCopiedSubtitles] = useState([]);
    const [copyHistoryOpen, setCopyHistoryOpen] = useState(false);
    const [copyHistoryAnchorEl, setCopyHistoryAnchorEl] = useState(null);

    const handleOpenMedia = useCallback((media) => {
        var parameters = [];

        if (media.audioFile) {
            parameters.push('audio=' + encodeURIComponent(media.audioFile.path));
        }

        if (media.videoFile) {
            parameters.push('video=' + encodeURIComponent(media.videoFile.path));
        }

        if (media.subtitleFile) {
            parameters.push('subtitle=' + encodeURIComponent(media.subtitleFile.path));
        }

        parameters.push('name=' + encodeURIComponent(media.name));

        history.push('/view?' + parameters.join('&'));
    }, [history]);

    const handleOpenPath = useCallback((path) => {
        history.push('/browse/' + path);
    }, [history]);

    const handleCopy = useCallback((text, fileName) => {
        copiedSubtitles.push({
            timestamp: Date.now(),
            text: text,
            name: fileName
        });
        setCopiedSubtitles(copiedSubtitles);
    }, [setCopiedSubtitles, copiedSubtitles]);

    const handleOpenCopyHistory = useCallback((event) => {
        setCopyHistoryOpen(!copyHistoryOpen);
        setCopyHistoryAnchorEl(event.currentTarget);
    }, [setCopyHistoryOpen, copyHistoryOpen, setCopyHistoryAnchorEl]);

    const handleCloseCopyHistory = useCallback(() => {
        setCopyHistoryOpen(false);
        setCopyHistoryAnchorEl(null);
    }, [setCopyHistoryOpen, setCopyHistoryAnchorEl]);

    const handleDeleteCopyHistoryItem = useCallback(item => {
        const newCopiedSubtitles = [];

        for (let subtitle of copiedSubtitles) {
            if (item.timestamp !== subtitle.timestamp) {
                newCopiedSubtitles.push(subtitle);
            }
        }

        setCopiedSubtitles(newCopiedSubtitles);
    }, [copiedSubtitles, setCopiedSubtitles]);

    return (
        <div>
        <CopyHistory
            items={copiedSubtitles}
            open={copyHistoryOpen}
            anchorEl={copyHistoryAnchorEl}
            onClose={handleCloseCopyHistory}
            onDelete={handleDeleteCopyHistoryItem} />
        <Switch>
            <Route exact path="/" render={() => {
                const params = new URLSearchParams(window.location.search);
                const videoFile = params.get('video');
                const channel = params.get('channel');

                if (videoFile && channel) {
                    return (<Redirect to={"/video?video=" + videoFile + "&channel=" + channel} />);
                }

                return (<Redirect to="/browse" />)
            }} />
            <Route exact path="/browse">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route exact path="/browse/:path+">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Browser api={api} onOpenDirectory={handleOpenPath} onOpenMedia={handleOpenMedia} />
            </Route>
            <Route exact path="/video">
                <VideoPlayer api={api} />
            </Route>
            <Route exact path="/view">
                <Bar onOpenCopyHistory={handleOpenCopyHistory} />
                <Player api={api} onCopy={handleCopy} />
            </Route>
        </Switch>
        </div>
    );
}

export default App;

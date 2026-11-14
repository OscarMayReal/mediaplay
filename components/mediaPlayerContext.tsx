"use client"
import { useState, createContext, useRef, useContext, useEffect, type ReactNode, type RefObject } from "react";

type PlayerState = { paused: boolean; time: number; duration: number };
type PlayerMetadata = {
    title?: string;
    artist?: string;
    album?: string;
    pictureLoc?: string;
    path?: string;
    image?: string;
    type?: "music" | "video";
    src: string;
};

type MediaPlayerContextValue = {
    playerState: PlayerState;
    audioPlayerRef: RefObject<HTMLAudioElement | null>;
    playerMetadata: PlayerMetadata | null;
    setPlayerMetadata: (data: PlayerMetadata | null) => void;
    seek: (time: number) => void;
    playlist: PlayerMetadata[];
    setPlaylist: (data: PlayerMetadata[]) => void;
    playlistPos: number;
    setPlaylistPos: (data: number) => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null)

export function MediaPlayerProvider({children}: {children: ReactNode}) {
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
    const [playerState, setPlayerState] = useState<PlayerState>({paused: true, time: 0, duration: 0})
    const [playerMetadata, setPlayerMetadata] = useState<PlayerMetadata | null>(null)
    const [playlist, setPlaylist] = useState<PlayerMetadata[]>([])
    const [playlistPos, setPlaylistPos] = useState<number>(0)

    useEffect(() => {
        const audio = new Audio()
        audioPlayerRef.current = audio

        const syncState = () => {
            setPlayerState({
                paused: audio.paused,
                time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
                duration: Number.isFinite(audio.duration) ? audio.duration : 0,
            })
        }
        const resetTime = () => setPlayerState(state => ({...state, time: 0, duration: 0}))

        const timeUpdate = () => {
            if (!audio.seeking) syncState()
        }
        audio.addEventListener("timeupdate", timeUpdate)
        audio.addEventListener("seeked", syncState)
        audio.addEventListener("durationchange", syncState)
        audio.addEventListener("play", syncState)
        audio.addEventListener("pause", syncState)
        audio.addEventListener("loadstart", resetTime)

        return () => {
            audio.pause()
            audio.removeEventListener("timeupdate", timeUpdate)
            audio.removeEventListener("seeked", syncState)
            audio.removeEventListener("durationchange", syncState)
            audio.removeEventListener("play", syncState)
            audio.removeEventListener("pause", syncState)
            audio.removeEventListener("loadstart", resetTime)
            audioPlayerRef.current = null
        }
    }, [])

    useEffect(() => {
        if (!audioPlayerRef.current) return
        const ended = () => {
            if (!audioPlayerRef.current) return
            if ((playlist.length - 1) > playlistPos) {
                audioPlayerRef.current.src = playlist[playlistPos + 1].src
                audioPlayerRef.current.currentTime = 0
                audioPlayerRef.current?.play()
                setPlayerMetadata(playlist[playlistPos + 1])
                setPlaylistPos(playlistPos + 1)
            } else {
                setPlayerMetadata(null)
            }
        }
        audioPlayerRef.current.addEventListener("ended", ended)
        return () => {
            if (!audioPlayerRef.current) return
            audioPlayerRef.current.removeEventListener("ended", ended)
        }
    }, [playlist, playlistPos])

    const seek = (time: number) => {
        const audio = audioPlayerRef.current
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
        const targetTime = Math.max(0, Math.min(time, audio.duration))
        audio.currentTime = targetTime
        setPlayerState(state => ({...state, time: targetTime}))
    }

    useEffect(() => {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: playerMetadata?.title || undefined,
            artist: playerMetadata?.artist || undefined,
            album: playerMetadata?.album || undefined
        })
    }, [playerMetadata])

    return <MediaPlayerContext.Provider value={{
        playerState,
        audioPlayerRef,
        playerMetadata,
        setPlayerMetadata,
        seek,
        playlist,
        setPlaylist,
        playlistPos,
        setPlaylistPos
    }}>
        {children}
    </MediaPlayerContext.Provider>
}

export function useMediaPlayerContext() {
    return useContext(MediaPlayerContext)
}

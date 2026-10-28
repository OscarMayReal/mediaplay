"use client"
import { useState, createContext, useRef, useContext, useEffect, type ReactNode, type RefObject } from "react";

type MediaPlayerContextValue = {
    playerState: Object | null;
    audioPlayerRef: RefObject<HTMLAudioElement | null>;
    playerMetadata: Object | null;
    setPlayerMetadata: (data: Object | null) => void
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null)

export function MediaPlayerProvider({children}: {children: ReactNode}) {
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
    const [playerState, setPlayerState] = useState<Object | null>({paused: true})
    const [playerMetadata, setPlayerMetadata] = useState<Object | null>(null)
    useEffect(() => {
        audioPlayerRef.current = new Audio();
        audioPlayerRef.current.addEventListener("pause", () => {
            setPlayerState({...playerState, paused: true})
        })
        audioPlayerRef.current.addEventListener("play", () => {
            setPlayerState({...playerState, paused: false})
        })
        audioPlayerRef.current.addEventListener("ended", () => {
            setPlayerState({...playerState, paused: true})
            setPlayerMetadata(null)
        })

        return () => {
            audioPlayerRef.current?.pause();
            audioPlayerRef.current = null;
        };
    }, []);
    useEffect(() => {
        console.log(playerMetadata)
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
        setPlayerMetadata
    }}>
        {children}
    </MediaPlayerContext.Provider>
}

export function useMediaPlayerContext() {
    return useContext(MediaPlayerContext)
}

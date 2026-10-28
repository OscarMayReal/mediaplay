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
    const [playerState] = useState<Object | null>(null)
    const [playerMetadata, setPlayerMetadata] = useState<Object | null>(null)
    useEffect(() => {
        audioPlayerRef.current = new Audio();

        return () => {
            audioPlayerRef.current?.pause();
            audioPlayerRef.current = null;
        };
    }, []);
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

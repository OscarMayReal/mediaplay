"use client"
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { FastForwardIcon, PauseIcon, PlayIcon, RewindIcon } from "lucide-react";
import { IAudioMetadata, parseBlob } from "music-metadata";
import { Usable, use, useEffect, useRef, useState } from "react";

export default function MediaPlayer({params}: {params: Usable<{library: string, media: string}>}) {
    const {library, media} = use(params)
    const videoPlayerRef = useRef<HTMLVideoElement>(null)
    const [hoverVisible, setHoverVisible] = useState(false)
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [metadata, setMetadata] = useState<IAudioMetadata | null>(null)
    const [playerState, setPlayerState] = useState<{paused: boolean, time: number, duration: number}>({paused: false, time: 0, duration: 0})
    const seekBy = (seconds: number) => {
        const player = videoPlayerRef.current
        if (!player || !Number.isFinite(player.currentTime)) return

        const targetTime = player.currentTime + seconds
        player.currentTime = Math.max(0, Math.min(targetTime, player.duration || targetTime))
    }
    useEffect(() => {
        if (!videoPlayerRef.current) return
        const playMedia = () => {
            if (!videoPlayerRef.current) return
            videoPlayerRef.current.play()
        }
        const pauseMedia = () => {
            if (!videoPlayerRef.current) return
            videoPlayerRef.current.play()
        }
        const toggleMediaPlayback = () => {
            if (!videoPlayerRef.current) return
            if (videoPlayerRef.current.paused) {
                videoPlayerRef.current.play()
            } else {
                videoPlayerRef.current.pause()
            }
        }
        const spaceToggleMediaPlayback = (ev: KeyboardEvent) => {
            if (ev.key == " ") {
               toggleMediaPlayback() 
            } else if (ev.key == "ArrowLeft") {
                seekBy(-10)
            } else if (ev.key == "ArrowRight") {
                seekBy(10)
            }
        }
        videoPlayerRef.current.addEventListener("canplay", playMedia)
        window.addEventListener("keyup", spaceToggleMediaPlayback)

        return () => {
            videoPlayerRef.current?.removeEventListener("canplay", playMedia)
            window.removeEventListener("keyup", spaceToggleMediaPlayback)
        }
    }, [])
    useEffect(() => {
        const player = videoPlayerRef.current
        if (!player) return

        const handlePlay = () => setPlayerState(state => ({...state, paused: false}))
        const handlePause = () => setPlayerState(state => ({...state, paused: true}))
        const handleTimeChange = () => {
            setPlayerState(state => ({...state, time: player.currentTime, duration: player.duration}))
        }
        player.addEventListener("play", handlePlay)
        player.addEventListener("pause", handlePause)
        player.addEventListener("timeupdate", handleTimeChange)

        return () => {
            player.removeEventListener("play", handlePlay)
            player.removeEventListener("pause", handlePause)
            player.removeEventListener("timeupdate", handleTimeChange)
        }
    }, [])
    useEffect(() => {
        const handleHoverVisibility = () => {
            setHoverVisible(true)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = setTimeout(() => {
                setHoverVisible(false)
                hoverTimeoutRef.current = null
            }, 5000)
        }
        window.addEventListener("mousemove", handleHoverVisibility)
        return () => {
            window.removeEventListener("mousemove", handleHoverVisibility)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        }
    }, [])
    useEffect(() => {
        const mediafile = window.fs.readFileSync(decodePath(library) + "/" + decodePath(media))
        parseBlob(new Blob([mediafile])).then(data => {
            console.log(data)
            setMetadata(data)
        })
    }, [])
    const decodePath = (value: string) => decodeURIComponent(value).replaceAll("::slash::", "/")

    return <div className="relative bg-black h-full">
        <div className={`absolute top-0 h-[50px] w-screen titlebar bg-black/50 backdrop-blur-sm border-b-1 border-b-white/30 flex flex-row items-center transition-opacity ${hoverVisible ? "opacity-100" : "opacity-0"}`}>
            <div className="ml-22 text-white font-medium">{metadata?.common?.title}</div>
        </div>
        <video ref={videoPlayerRef} className="h-full w-full" src={window.app.getLocalFileUrl(decodePath(library), decodePath(media))}></video>
        <div className={`absolute bottom-5 h-auto w-[500px] left-1/2 -translate-x-1/2 rounded-xl bg-black/50 backdrop-blur-sm border-1 text-white border-white/30 flex flex-row items-center p-1 transition-opacity ${hoverVisible ? "opacity-100" : "opacity-0"}`}>
            <ButtonGroup>
                <Button size={"icon-sm"} variant={"ghost"} onClick={() => {
                    seekBy(-10)
                }}>
                    <RewindIcon />
                </Button>
                <Button size={"icon-sm"} variant={"ghost"} onClick={() => {
                    if (!videoPlayerRef.current) return
                    if (videoPlayerRef.current.paused) {
                        videoPlayerRef.current.play()
                    } else {
                        videoPlayerRef.current.pause()
                    }
                }}>
                    {playerState.paused ? <PlayIcon /> : <PauseIcon />}
                </Button>
                <Button size={"icon-sm"} variant={"ghost"} onClick={() => {
                    seekBy(10)
                }}>
                    <FastForwardIcon />
                </Button>
            </ButtonGroup>
            <Slider value={playerState.time} onValueChange={(value) => {
                if (!videoPlayerRef.current) return
                videoPlayerRef.current.currentTime = value
            }} max={playerState.duration} className="w-full mx-4" />
        </div>
    </div>
}

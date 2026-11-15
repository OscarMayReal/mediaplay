"use client"
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { FocusNode } from "@please/lrud";
import { ArrowLeftCircleIcon, FastForwardIcon, PauseIcon, PlayIcon, RewindIcon } from "lucide-react";
import { IAudioMetadata, parseBlob } from "music-metadata";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

export default function MediaPlayer({params}: {params: Promise<{library: string, media: string}>}) {
    const router = useRouter()
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
            if (hoverVisible) return
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
    }, [hoverVisible])
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
        window.addEventListener("keydown", (ev) => {
            if (ev.key == "Enter") {
                handleHoverVisibility()
            }
        })
        return () => {
            window.removeEventListener("mousemove", handleHoverVisibility)
            window.removeEventListener("keydown", (ev) => {
            if (ev.key == "Enter") {
                handleHoverVisibility()
            }
        })
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
        <video ref={videoPlayerRef} className="h-full w-full" src={window.app.getLocalFileUrl(decodePath(library), decodePath(media))}></video>
        <div className={`absolute bottom-0 text-background left--0 w-screen transition-opacity bg-gradient-to-b from-black/0 to-black/100 h-screen ${hoverVisible ? "opacity-100" : "opacity-0"}`}>
            {hoverVisible && <FocusNode onMountAssignFocusTo={"playpause"} onUp={() => {
                setHoverVisible(false)
            }} orientation="horizontal" className="flex flex-row items-center absolute bottom-2 left-0 w-screen p-12 text-white">
                {/* <div className="text-4xl">
                    {metadata?.common.title}
                </div> */}
                <FocusNode focusId={"back"} className="text-4xl text-background/75 [&.isFocused]:text-background [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    router.back()
                }}>
                    <ArrowLeftCircleIcon size={30} />
                    {metadata?.common.title}
                </FocusNode>
                <div className="flex-1"/>
                <FocusNode focusId={"playpause"} className="text-4xl text-background/75 [&.isFocused]:text-background [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    if (!videoPlayerRef.current) return
                    if (videoPlayerRef.current.paused) {
                        videoPlayerRef.current.play()
                    } else {
                        videoPlayerRef.current.pause()
                    }
                }}>
                    {playerState.paused ? <PlayIcon size={30} /> : <PauseIcon size={30} />}
                </FocusNode>
            </FocusNode>}
            <Progress className="absolute bottom-0 left-0 w-screen" value={playerState.time} max={playerState.durationn} />
        </div>
    </div>
}

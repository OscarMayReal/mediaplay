"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { FocusNode } from "@please/lrud"
import { ArrowLeftCircleIcon, ListIcon, MusicIcon, PauseIcon, PlayIcon, PodcastIcon, SettingsIcon, SkipForwardIcon, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LargeScreenHome() {
    const router = useRouter()
    const mediaPlayerContext = useMediaPlayerContext()
    return <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
        <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                router.back()
            }}>
                <ArrowLeftCircleIcon size={30} />
                Now Playing
            </FocusNode>
        </FocusNode>
        <div className="w-full h-full flex flex-row">
            <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full justify-center p-12">
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    if (mediaPlayerContext?.playerState.paused) {
                        mediaPlayerContext?.audioPlayerRef.current?.play()
                    } else {
                        mediaPlayerContext?.audioPlayerRef.current?.pause()
                    }
                }}>
                    {mediaPlayerContext?.playerState.paused ? <PlayIcon size={30} /> : <PauseIcon size={30} />}{mediaPlayerContext?.playerState.paused ? "Play" : "Pause"}
                </FocusNode>
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    if (!mediaPlayerContext) return
                    const nextPos = mediaPlayerContext.playlistPos + 1
                    const nextTrack = mediaPlayerContext.playlist[nextPos]
                    const player = mediaPlayerContext.audioPlayerRef.current
                    if (!nextTrack || !player) return

                    player.src = nextTrack.src
                    player.currentTime = 0
                    mediaPlayerContext.setPlayerMetadata(nextTrack)
                    mediaPlayerContext.setPlaylistPos(nextPos)
                    void player.play()
                }}>
                    <SkipForwardIcon size={30} />Next
                </FocusNode>
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/music")}>
                    <ListIcon size={30} />View Queue
                </FocusNode>
            </FocusNode>
            {mediaPlayerContext?.playerMetadata && <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <div className="flex flex-col gap-2">
                    <img className="w-75 h-75 rounded-xl" src={window.app.getLocalFileUrl(mediaPlayerContext?.playerMetadata.pictureLoc, "")} />
                    <div className="text-4xl pt-2 font-semibold">{mediaPlayerContext?.playerMetadata.title}</div>
                    <div className="text-2xl">{mediaPlayerContext?.playerMetadata.artist}</div>
                </div>
            </div>}
        </div>
    </FocusNode>
}

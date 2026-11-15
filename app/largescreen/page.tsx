"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { FocusNode } from "@please/lrud"
import { MusicIcon, PlayIcon, PodcastIcon, SettingsIcon, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LargeScreenHome() {
    const router = useRouter()
    const mediaPlayerContext = useMediaPlayerContext()
    return <div className="w-full h-full flex flex-row">
        <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full justify-center p-12">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/music")}>
                <MusicIcon size={30} />Music
            </FocusNode>
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/video")}>
                <VideoIcon size={30} />Video
            </FocusNode>
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/podcasts")}>
                <PodcastIcon size={30} />Podcasts
            </FocusNode>
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/settings")}>
                <SettingsIcon size={30} />Settings
            </FocusNode>
            {mediaPlayerContext?.playerMetadata !== null && <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.push("/largescreen/nowplaying")}>
                <PlayIcon size={30} />Now Playing
            </FocusNode>}
        </FocusNode>
    </div>
}
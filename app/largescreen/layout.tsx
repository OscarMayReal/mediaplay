"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { useTime } from "@/lib/useClock";
import { FocusRoot } from "@please/lrud";
import { FocusNode } from "@please/lrud";
import { MusicIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function LargeScreenHome({children}: {children: React.JSX.Element}) {
    const router = useRouter()
    const time = useTime()
    const mediaPlayerContext = useMediaPlayerContext()
    const pathname = usePathname()
    return <FocusRoot pointerEvents>
        <FocusNode className="flex flex-col w-full h-full" onBack={() => router.back()}>
            {children}
            {!pathname.startsWith("/largescreen/video/player") && <div className="text-3xl fixed right-13 top-13">{window.os.hostname()} • {time.toLocaleTimeString().split(":").splice(0, 2).join(":")} {time.toLocaleTimeString().split(" ")[1]}</div>}
        </FocusNode>
        {mediaPlayerContext?.playerMetadata !== null && pathname !== "/largescreen/nowplaying" && <>
            <Item
                aria-label="Now playing"
                className="relative isolate fixed bottom-8 left-3 w-fit max-w-[calc(100vw-5rem)] min-h-32 gap-6 border-0 bg-transparent p-6 before:pointer-events-none before:absolute before:-left-10 before:-right-24 before:-bottom-10 before:-top-12 before:-z-10 before:bg-background before:[mask-image:var(--player-mask)] before:[mask-composite:intersect] before:content-['']"
                style={{
                    "--player-mask": "linear-gradient(to top, black 0%, black 55%, transparent 100%), linear-gradient(to right, black 0%, black 60%, transparent 100%)",
                } as React.CSSProperties}
            >
            <ItemMedia variant={"image"} className="size-24 shrink-0">
                {mediaPlayerContext?.playerMetadata.pictureLoc
                    ? <img src={window.app.getLocalFileUrl(mediaPlayerContext?.playerMetadata.pictureLoc, "")} alt="" />
                    : <MusicIcon size={48} />}
            </ItemMedia>    
            <ItemContent className="gap-2">
                <ItemTitle className="text-4xl">
                    {mediaPlayerContext?.playerMetadata.title}
                </ItemTitle>
                <ItemDescription className="text-2xl">
                    {mediaPlayerContext?.playerMetadata.artist}
                </ItemDescription>
            </ItemContent>
            </Item>
        </>}
        {mediaPlayerContext?.playerMetadata !== null && <Progress className="fixed bottom-0 left-0 w-screen" progressTrackClassname="h-3" value={mediaPlayerContext?.playerState.time} max={mediaPlayerContext?.playerState.duration} />}
    </FocusRoot>
}

"use client"
import { ExpandableText } from "@/components/expandabletext";
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { usePortableMediaDrive } from "@/lib/useDrives";
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile";
import { PodcastIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Podcast } from "podparse";
import { Usable, use, useState } from "react";

type PodcastDb = {version: string; podcasts: Record<string, Podcast>};

export default function EmptyPage({params}: {params: Usable<{encodedpodcasturl: string}>}) {
    const {encodedpodcasturl} = use(params)
    const [podcast, setPodcast] = useState("")
    const drive = usePortableMediaDrive({autoReload: true})
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const podcastdbPath = musicPath ? musicPath + "/MediaPlayDb/podcastdb.json" : null
    const library = useReadFileJson<PodcastDb>({path: podcastdbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    const pathname = usePathname()
    return <div className="flex flex-col w-full h-full">
        <div className="flex flex-col p-2 border-b-1">
            <Item>
                <ItemMedia variant={"image"}>
                    <img src={library.data?.podcasts[decodeURIComponent(encodedpodcasturl)].meta.image.url} />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>
                        {library.data?.podcasts[decodeURIComponent(encodedpodcasturl)].meta.title}
                    </ItemTitle>
                    <ItemDescription>
                        {library.data?.podcasts[decodeURIComponent(encodedpodcasturl)].meta.owner.name}
                    </ItemDescription>
                </ItemContent>
            </Item>
        </div>
        <div className="flex flex-col p-6 pt-4 border-b-1">
            <h2 className="text-lg font-medium pb-2">Description</h2>
            <ExpandableText text={library.data?.podcasts[decodeURIComponent(encodedpodcasturl)].meta.description} />
        </div>
    </div>
}
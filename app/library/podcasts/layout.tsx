"use client"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { CheckIcon, ChevronRightIcon, DownloadIcon, XIcon } from "lucide-react";
import { DialogTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { usePortableMediaDrive } from "@/lib/useDrives";
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile";
import { MediaLibraryTags } from "@/lib/libraryDb";
import { toast } from "@/components/ui/toast"
import podparse, { Podcast } from "podparse"
import { usePathname, useRouter } from "next/navigation";

type PodcastDb = {version: string; podcasts: Record<string, any>};

export default function LibraryPage({children}: {children: React.ReactNode}) {
    const [podcastUrl, setPodcastUrl] = useState("")
    const [podcastLibrary, setPodcastLibary] = useState<null | any>(null)
    const drive = usePortableMediaDrive({autoReload: true})
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const podcastdbPath = musicPath ? musicPath + "/MediaPlayDb/podcastdb.json" : null
    const library = useReadFileJson<PodcastDb>({path: podcastdbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    useEffect(() => {
        console.log(podcastLibrary)
    }, [podcastLibrary])
    useEffect(() => {
        if (!podcastdbPath) return
        if (!window.fs.existsSync(podcastdbPath)) {
            window.fs.writeFileSync(podcastdbPath, JSON.stringify({version: "1", podcasts: {}}))
            setPodcastLibary({version: "1", podcasts: {}})
        } else {
            const podcastDb = window.fs.readFileSync(podcastdbPath, "utf8")
            setPodcastLibary(JSON.parse(podcastDb))
        }
    }, [config])
    return <div className="flex min-w-0 flex-1 flex-row h-full w-full overflow-hidden">
        <div className="flex flex-col w-[350px] h-full border-r-1 p-2 shrink-0">
            <div className="flex flex-row w-full p-2 pb-3 items-center">
                <h2 className="text-xl font-medium pl-1">
                    Podcasts
                </h2>
                <div className="flex flex-1" />
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger render={<Button variant={"ghost"} size={"sm"}>
                        <DownloadIcon />Add Podcast
                    </Button>}/>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Add Podcast
                            </DialogTitle>
                            <DialogDescription>
                                Enter the URL of the podcast's RSS feed
                            </DialogDescription>
                        </DialogHeader>
                        <Input value={podcastUrl} onChange={(event) => setPodcastUrl(event.target.value)} placeholder="Podcast URL" />
                        <DialogFooter>
                            <Button variant={"outline"}>
                                <XIcon />
                                Cancel
                            </Button>
                            <Button onClick={() => {
                                fetch(podcastUrl).then(res => res.text()).then((data) => {
                                    if (!podcastdbPath) return
                                    console.log(data)
                                    const json = podparse(data)
                                    console.log(podcastLibrary)
                                    const podcasts = podcastLibrary.podcasts
                                    if (podcasts[podcastUrl] || undefined == undefined) {
                                        podcasts[podcastUrl] = json
                                        setPodcastLibary({...podcastLibrary, podcasts: podcasts})
                                        window.fs.writeFileSync(podcastdbPath, JSON.stringify({...podcastLibrary, podcasts: podcasts}))
                                        toast.add({
                                            title: "Podcast Added",
                                            description: "Added podcast to your Library",
                                        })
                                    } else {
                                        toast.add({
                                            title: "Podcast Already Exists",
                                            description: "You already have this podcast in your Library",
                                        })
                                    }
                                    setCreateDialogOpen(false)
                                })
                            }}>
                                <DownloadIcon />
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <ItemGroup className="gap-0">
                {Object.entries(podcastLibrary?.podcasts || {}).map((data) => {
                    const key: string = data[0]
                    const value = data[1] as Podcast
                    return <Item key={key} className={`hover:bg-foreground/3 ${pathname == "/library/podcasts/" + encodeURIComponent(key) ? "bg-foreground/5 hover:bg-foreground/5" : ""}`} onClick={() => {
                        router.push("/library/podcasts/" + encodeURIComponent(key))
                    }}>
                        <ItemMedia variant={"image"}>
                            <img src={value.meta.image.url} />
                        </ItemMedia>
                        <ItemContent className="min-w-0">
                            <ItemTitle className="w-full min-w-0 truncate">
                                {value.meta.title}
                            </ItemTitle>
                            <ItemDescription className="w-full min-w-0 truncate">
                                {value.meta.owner.name}
                            </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ChevronRightIcon size="15" className="text-muted-foreground" />
                        </ItemActions>
                    </Item>
                })}
            </ItemGroup>
        </div>
        <div className="min-w-0 flex-1 h-full overflow-hidden">
            {children}
        </div>
    </div>
}

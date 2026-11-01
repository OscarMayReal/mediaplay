"use client"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import { DiscAlbumIcon, MusicIcon, VideoIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function LibraryLayout({children}: {children: React.ReactNode}) {
    const pathName = usePathname()
    const router = useRouter()
    return <SidebarProvider className="h-full w-full">
        <Sidebar collapsible="none" className="border-r-1 shrink-0">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Music</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenuButton className={pathName == "/library/music" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/music")}><MusicIcon />All Music</SidebarMenuButton>
                        <SidebarMenuButton className={pathName == "/library/music/albums" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/music/albums")}><DiscAlbumIcon />Albums</SidebarMenuButton>
                        {/* <SidebarMenuButton className={pathName == "/library/music/artists" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/music/artists")}><UserIcon />Artists</SidebarMenuButton> */}
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Video</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenuButton className={pathName == "/library/videos" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/videos")}><VideoIcon />Videos</SidebarMenuButton>
                    </SidebarGroupContent>
                </SidebarGroup>
                {/* <SidebarGroup>
                    <SidebarGroupLabel>Podcasts</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenuButton className={pathName == "/library/podcasts" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/podcasts")}><PodcastIcon />Podcasts</SidebarMenuButton>
                    </SidebarGroupContent>
                </SidebarGroup> */}
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            {children}
        </SidebarInset>
    </SidebarProvider>
}

"use client"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import { MusicIcon, PodcastIcon, VideoIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function LibraryLayout({children}: {children: React.JSX.Element}) {
    const pathName = usePathname()
    const router = useRouter()
    return <SidebarProvider className="h-full w-full">
        <Sidebar collapsible="none" className="border-r-1">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Library</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenuButton className={pathName == "/library/music" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/music")}><MusicIcon />Music</SidebarMenuButton>
                        <SidebarMenuButton className={pathName == "/library/videos" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/videos")}><VideoIcon />Videos</SidebarMenuButton>
                        <SidebarMenuButton className={pathName == "/library/podcasts" ? "bg-foreground/5 hover:bg-foreground/5!" : ""} onClick={() => router.push("/library/podcasts")}><PodcastIcon />Podcasts</SidebarMenuButton>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            {children}
        </SidebarInset>
    </SidebarProvider>
}
"use client"
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { CableIcon, FastForwardIcon, LibraryBigIcon, MusicIcon, PlayIcon, RewindIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DriveDataInterface } from "node-drivelist/dist/Interfaces";
import { usePathname, useRouter } from "next/navigation";
import { useDrives } from "@/lib/useDrives";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "./ui/item";

export default function AppHeader() {
    const router = useRouter()
    const drives = useDrives({autoReload: true})
    const pathName = usePathname()
    return (
        <header className="h-[50px] bg-muted border-b-1 w-full flex flex-row items-center titlebar shrink-0 relative">
            <ButtonGroup className="ml-22 nodrag">
                <Button variant="outline" size="icon"><RewindIcon /></Button>
                <Button variant="outline" size="icon"><PlayIcon /></Button>
                <Button variant="outline" size="icon"><FastForwardIcon /></Button>
            </ButtonGroup>
            {drives.drives.find(drive => drive.name?.endsWith("_MP")) && <Button variant="outline" size="icon" className="ml-2 nodrag" onClick={() => router.push(pathName !== "/device" ? "/device" : "/library")}>{pathName !== "/device" ? <CableIcon /> : <LibraryBigIcon />}</Button>}
            <HeaderMediaArea />
            <div className="flex-1" />
            <InputGroup className="w-[250px] mr-2 bg-white nodrag">
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search" />
            </InputGroup>
        </header>
    )
}

function HeaderMediaArea() {
    return <div className="w-[450px] h-full border-x-1 h-[50px] bg-background/50 absolute left-1/2 -translate-x-[50%] flex flex-row">
        <Item className="flex flex-row w-fit flex-nowrap p-0">
            <ItemMedia className="rounded-md border-1 bg-muted h-[35px] w-[35px] mr-0 ml-2 mt-1">
                <MusicIcon size={20} />
            </ItemMedia>
            <ItemContent className="gap-0">
                <ItemTitle className="text-nowrap">Media Title</ItemTitle>
                <ItemDescription className="text-nowrap">Media Artist</ItemDescription>
            </ItemContent>
        </Item>
    </div>
}
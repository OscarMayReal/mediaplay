"use client"
import { Item, ItemContent, ItemDescription, ItemHeader, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { useDrives } from "@/lib/useDrives";
import { MusicIcon } from "lucide-react";
import React from "react";

export function convertBytes(bytes: number, options: { useBinaryUnits?: boolean; decimals?: number } = {}): string {
  const { useBinaryUnits = false, decimals = 2 } = options;

  if (decimals < 0) {
    throw new Error(`Invalid decimals ${decimals}`);
  }

  const base = useBinaryUnits ? 1024 : 1000;
  const units = useBinaryUnits
    ? ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    : ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(base));

  return `${(bytes / Math.pow(base, i)).toFixed(decimals)} ${units[i]}`;
}

export default function DeviceLayout({children}: {children: React.JSX.Element}) {
    const drives = useDrives({autoReload: false})
    if (!drives.drives.find(drive => drive.name?.endsWith("_MP"))) return null
    return <div className="h-full w-full flex flex-col">
        <div className="h-[60px] flex flex-row w-full items-center border-b-1">
            <Item className="flex flex-row w-fit flex-nowrap">
                <ItemMedia className="rounded-md border-1 bg-muted h-[35px] w-[35px] mr-1">
                    <MusicIcon size={20} />
                </ItemMedia>
                <ItemContent className="gap-0">
                    <ItemTitle className="text-nowrap">Media Player</ItemTitle>
                    <ItemDescription className="text-nowrap">{convertBytes(drives.drives.find(drive => drive.name?.endsWith("_MP"))?.used)}/{convertBytes(drives.drives.find(drive => drive.name?.endsWith("_MP"))?.total)}</ItemDescription>
                </ItemContent>
            </Item>
            <Progress className={"w-full"} value={drives.drives.find(drive => drive.name?.endsWith("_MP"))?.used} max={drives.drives.find(drive => drive.name?.endsWith("_MP"))?.total} />
        </div>
        {children}
    </div>
}
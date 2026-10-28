"use client"
import { Item, ItemContent, ItemDescription, ItemHeader, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { useDrives } from "@/lib/useDrives";
import { MusicIcon } from "lucide-react";
import React from "react";

function convertBytes(bytes: number, options: { useBinaryUnits?: boolean; decimals?: number } = {}): string {
  const { useBinaryUnits = false, decimals = 2 } = options;

  if (decimals < 0) {
    throw new Error(`Invalid decimals ${decimals}`);
  }

  const base = useBinaryUnits ? 1024 : 1000;
  if (bytes <= 0) return "0 Bytes";
  const units = useBinaryUnits
    ? ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    : ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(base));

  return `${(bytes / Math.pow(base, i)).toFixed(decimals)} ${units[i]}`;
}

export default function DeviceLayout({children}: {children: React.ReactNode}) {
    const drives = useDrives({autoReload: false})
    const mediaDrive = drives.drives.find(drive => drive.name?.endsWith("_MP"))
    if (!mediaDrive) return null
    return <div className="h-full w-full flex flex-col">
        <div className="h-[60px] flex flex-row w-full items-center border-b-1">
            <Item className="flex flex-row w-fit flex-nowrap">
                <ItemMedia className="rounded-md border-1 bg-muted h-[35px] w-[35px] mr-1">
                    <MusicIcon size={20} />
                </ItemMedia>
                <ItemContent className="gap-0">
                    <ItemTitle className="text-nowrap">Media Player</ItemTitle>
                    <ItemDescription className="text-nowrap">{convertBytes(mediaDrive.used ?? 0)}/{convertBytes(mediaDrive.total ?? 0)}</ItemDescription>
                </ItemContent>
            </Item>
            <Progress className={"w-full"} value={mediaDrive.used ?? 0} max={mediaDrive.total ?? 0} />
        </div>
        {children}
    </div>
}

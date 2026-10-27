"use client"
import { Button } from "@/components/ui/button";
import { useDir } from "@/lib/useDir";
import { useReadConfigFile } from "@/lib/useReadFile";
import { PlayIcon } from "lucide-react";
import { parseBlob, parseFile } from "music-metadata";
import { useEffect } from "react";

const audioExtensions = [
  ".mp3",
  ".m4a",
  ".mp4",
  ".wav",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
  ".aiff",
  ".aif",
  ".wma",
  ".ape",
];

export default function LibraryPage() {
    const config = useReadConfigFile()
    useEffect(() => {
        console.log(config)
    }, [config])
    const libraryFiles = useDir({path: config?.data?.libraries?.find(item => item.type == "music").path, recursive: true})
    useEffect(() => {
        const files = libraryFiles.data?.filter(item => {
            for (var extension of audioExtensions) {
                if (item.endsWith(extension)) {
                    return true
                }
            }
        });
        (async () => {
            for (const file of files) {
                const mediafile = window.fs.readFileSync(config?.data?.libraries?.find(item => item.type == "music").path + "/" + file)
                const metadata = await parseBlob(new Blob([mediafile]))
                console.log(metadata)
            }
        })();
    }, [libraryFiles])
    return <div className="w-full h-full flex flex-col">
        <div className="w-full p-6 flex flex-row items-center">
            <h1 className="text-2xl font-bold">Music</h1>
            <div className="flex-1" />
            <Button><PlayIcon />Play All</Button>
        </div>
    </div>
}
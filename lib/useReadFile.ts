import { useEffect, useState } from "react";
import { getLibraries } from "./getLibraries";

export function useReadFileJson({path}: {path: string}) {
    function reload() {
        if (window.fs.existsSync(path)) {
            setFile({loaded: false, data: null, reload})
        }
        window.fsPromises.readFile(path, {
            encoding: "utf-8"
        }).then(data => {
            setFile({loaded: false, data: JSON.parse(data) || null, reload})
        })
    }
    const [file, setFile] = useState<{loaded: Boolean, data: Object | null, reload: () => void}>({loaded: false, data: null, reload})
    useEffect(() => {
        reload()
    }, [])
    return file
}

export function useReadConfigFile() {
    const libraries = getLibraries()
    return useReadFileJson({path: libraries.documents + "/MediaPlay/library.json"})
}
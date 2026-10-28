import { useEffect, useState } from "react"

export function useDir({path, recursive=false}: {path: string, recursive?: boolean}) {
    function reload() {
        console.log("path:", path)
        if (window.fs.existsSync(path)) {
            setFiles({loaded: false, data: null, reload})
        }
        window.fsPromises.readdir(path, {
            recursive 
        }).then(data => {
            setFiles({loaded: false, data: data || null, reload})
        })
    }
    const [files, setFiles] = useState<{loaded: boolean, data: string[] | null, reload: () => void}>({loaded: false, data: [], reload})
    useEffect(() => {
        if (path == null && path == undefined) return
        reload()
    }, [path])
    return files
}

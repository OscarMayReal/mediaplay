import { useCallback, useEffect, useState } from "react";
import { getLibraries } from "./getLibraries";

export type LibraryConfig = {
    libraries: { type: string; path: string; name: string }[];
};

export function useReadFileJson<T>({path}: {path: string | null | undefined}) {
    const [data, setData] = useState<T | null>(null);
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(() => {
        if (!path || typeof window === "undefined" || !window.fs) {
            return;
        }

        window.fsPromises.readFile(path, {encoding: "utf-8"})
            .then(contents => setData(JSON.parse(contents) as T))
            .catch(() => setData(null))
            .finally(() => setLoaded(true));
    }, [path]);

    useEffect(() => {
        reload();
    }, [reload]);

    return {loaded, data, reload};
}

export function useReadConfigFile() {
    const libraries = getLibraries();
    return useReadFileJson<LibraryConfig>({path: libraries ? libraries.documents + "/MediaPlay/library.json" : null});
}

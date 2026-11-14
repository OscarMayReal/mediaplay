import { useCallback, useEffect, useMemo, useState } from "react";
import { getLibraries } from "./getLibraries";

export type LibraryConfig = {
    libraries: { type: string; path: string; name: string }[];
    libraryLocations?: Record<string, string>;
};

export function useReadFileJson<T>({path}: {path: string | null | undefined}) {
    const [data, setData] = useState<T | null>(null);
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(() => {
        if (!path || typeof window === "undefined" || !window.fs) {
            return;
        }

        window.fsPromises.readFile(path, {encoding: "utf-8"})
            .then(contents => {
                const nextData = JSON.parse(contents) as T;
                setData(currentData => {
                    // Preserve the existing reference when a reload returns the
                    // same JSON value. This keeps consumers' effects from
                    // rerunning just because the file was read again.
                    return JSON.stringify(currentData) === JSON.stringify(nextData)
                        ? currentData
                        : nextData;
                });
            })
            .catch(() => setData(currentData => currentData === null ? currentData : null))
            .finally(() => setLoaded(true));
    }, [path]);

    useEffect(() => {
        reload();
    }, [reload]);

    return useMemo(() => ({loaded, data, reload}), [loaded, data, reload]);
}

export function useReadConfigFile() {
    const libraries = getLibraries();
    return useReadFileJson<LibraryConfig>({path: libraries ? libraries.documents + "/MediaPlay/library.json" : null});
}

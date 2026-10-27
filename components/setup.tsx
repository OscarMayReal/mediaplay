"use client"
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { ArrowRightIcon, CheckIcon, MusicIcon, VideoIcon } from "lucide-react";
import { FieldGroup } from "./ui/field";
import { getLibraries } from "@/lib/getLibraries";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "./ui/item";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";

export function SetupDialog() {
    const [isOpen, setIsOpen] = useState(false)
    useEffect(() => {
        const libraries = getLibraries()
        if (!window.fs.existsSync(libraries.documents + "/MediaPlay")) {
            setIsOpen(true)
        }
    }, [])
    const [step, setStep] = useState(0)
    return <Dialog open={isOpen}>
        <DialogContent showCloseButton={false}>
            {step == 0 && <Step0 />}
            {step == 1 && <Step1 />}
            {step == 2 && <Step2 />}
            <DialogFooter>
                {step !== 2 && <Button onClick={() => setStep(step + 1)}>Next <ArrowRightIcon /></Button>}
                {step == 2 && <Button onClick={() => setIsOpen(false)}><CheckIcon />Finish</Button>}
            </DialogFooter>
        </DialogContent>
    </Dialog>
}

function Step0() {
    useEffect(() => {
        const libraries = getLibraries()
        if (!window.fs.existsSync(libraries.documents + "/MediaPlay")) {
            window.fs.mkdirSync(libraries.documents + "/MediaPlay")
        }
    }, [])
    return <div className="flex flex-col gap-2">
        <h1 className="text-lg">Welcome To MediaPlay</h1>
        <div>This dialog will guide you through setting up MediaPlay</div>
    </div>
}

function Step1() {
    const [selectedLibraries, setSelectedLibraries] = useState<{type: string, path: string, name: string}[]>([])
    useEffect(() => {
        if (!window.fs.existsSync(libraries.documents + "/MediaPlay/library.json")) {
            window.fs.writeFileSync(libraries.documents + "/MediaPlay/library.json", JSON.stringify({
                libraries: []
            }))
        } else if (window.fs.existsSync(libraries.documents + "/MediaPlay/library.json")) {
            var library = JSON.parse(window.fs.readFileSync(libraries.documents + "/MediaPlay/library.json", "utf8"))
            library.libraries = selectedLibraries
            window.fs.writeFileSync(libraries.documents + "/MediaPlay/library.json", JSON.stringify(library))
        }
    }, [selectedLibraries])
    const libraries = getLibraries()
    return <div className="flex flex-col gap-2">
        <h1 className="text-lg">Configure Your Content</h1>
        <div>MediaPlay can automatically add default locations to your library</div>
        <ItemGroup className="rounded-md border-1 mt-2 gap-0">
            <Item>
                <ItemMedia variant="icon"><MusicIcon /></ItemMedia>
                <ItemContent>
                    <ItemTitle>Music</ItemTitle>
                    <ItemDescription>{libraries.music}</ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Switch checked={selectedLibraries.find(item => item.path == libraries.music) !== undefined} onCheckedChange={() => {
                        if (selectedLibraries.find(item => item.path == libraries.music) !== undefined) {
                            setSelectedLibraries(selectedLibraries.filter(item => item.path !== libraries.music))
                        } else {
                            setSelectedLibraries([...selectedLibraries, {path: libraries.music, type: "music", name: "Music"}])
                        }
                    }} />
                </ItemActions>
            </Item>
            <Separator />
            <Item>
                <ItemMedia variant="icon"><VideoIcon /></ItemMedia>
                <ItemContent>
                    <ItemTitle>Video</ItemTitle>
                    <ItemDescription>{libraries.videos}</ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Switch checked={selectedLibraries.find(item => item.path == libraries.videos) !== undefined} onCheckedChange={() => {
                        if (selectedLibraries.find(item => item.path == libraries.videos) !== undefined) {
                            setSelectedLibraries(selectedLibraries.filter(item => item.path !== libraries.videos))
                        } else {
                            setSelectedLibraries([...selectedLibraries, {path: libraries.videos, type: "videos", name: "Videos"}])
                        }
                    }} />
                </ItemActions>
            </Item>
        </ItemGroup>
    </div>
}

function Step2() {
    return <div className="flex flex-col gap-2">
        <h1 className="text-lg">Ready To Go!</h1>
        <div>You are now all set up, and ready to use MediaPlay. you can set up more features in settings</div>
    </div>
}
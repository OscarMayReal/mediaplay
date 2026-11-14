import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PodcastIcon } from "lucide-react";

export default function EmptyPage() {
    return <Empty className="w-full h-full gap-1">
        <EmptyMedia variant={"icon"}>
            <PodcastIcon />
        </EmptyMedia>
        <EmptyContent>
            <EmptyTitle>Podcasts</EmptyTitle>
            <EmptyDescription>Select an existing podcast or add a new one</EmptyDescription>
        </EmptyContent>
    </Empty>
}
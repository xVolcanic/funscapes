import type { Metadata } from "next";
import { ParkScene } from "./ParkScene";
import "./park.css";

export const metadata: Metadata = { title: "Funscapes · mini park assembly" };

export default async function ParkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <ParkScene debug={params.debug !== undefined} still={params.still !== undefined} night={params.night !== undefined} />;
}

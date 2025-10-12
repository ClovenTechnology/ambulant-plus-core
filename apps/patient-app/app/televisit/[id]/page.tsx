"use client";

// Reuse the SFU room page, but adapt param name: Id -> roomId
import SfuPage from "../../sfu/[roomId]/page";

export default function Televisit({ params }: { params: { Id: string } }) {
  return <SfuPage params={{ roomId: params.Id }} />;
}

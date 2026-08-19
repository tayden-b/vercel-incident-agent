import { WarRoom } from "@/components/war-room/war-room";

export default async function IncidentPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return <WarRoom incidentId={id} />;
}
